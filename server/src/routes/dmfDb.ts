/**
 * DMF routes — queries against PostgreSQL (DMF data loaded from Snowflake)
 */
import { Router, Request, Response } from 'express';
import { getPgPool } from '../db/postgres';

const router = Router();

async function safeQuery(sql: string, fallback: any[] = []): Promise<any[]> {
  const pool = getPgPool();
  try { const { rows } = await pool.query(sql); return rows; } catch (e: any) { console.error('DMF query error:', e.message); return fallback; }
}

const STATUS_COLOR: Record<string, string> = {
  'SUCCESS':      '#2e7d32',
  'FAILED':       '#d32f2f',
  'IN PROGRESS':  '#f57c00',
  'STARTED':      '#1565c0',
  'PARTIAL LOAD': '#ff9800',
};

/**
 * Converts a date_range query param ("1m","3m","6m","1y") into a
 * SQL fragment like "AND proc_dt >= CURRENT_DATE - INTERVAL '3 months'".
 * Returns an empty string when date_range is absent / "all".
 */
function dateRangeClause(dateRange: any, col = 'proc_dt'): string {
  const map: Record<string, string> = {
    '1m': `1 month`,
    '3m': `3 months`,
    '6m': `6 months`,
    '1y': `1 year`,
  };
  const interval = map[String(dateRange ?? '').toLowerCase()];
  return interval ? `AND ${col}::date >= CURRENT_DATE - INTERVAL '${interval}'` : '';
}

// ─── GET /api/dmf/failed-by-stage ─────────────────────────
// Counts FAILED runs grouped by step_nm from DMF_RUN_STEP_DETAIL
router.get('/failed-by-stage', async (_req: Request, res: Response) => {
  try {
    const STAGE_COLORS: Record<string, string> = {
      'ING': '#1565c0', 'INGESTION':    '#1565c0',
      'ENR': '#f57c00', 'ENRICHMENT':   '#f57c00',
      'DIS': '#2e7d32', 'DISTRIBUTION': '#2e7d32',
      'INT': '#7b1fa2', 'INTEGRATION':  '#7b1fa2',
    };
    const rows = await safeQuery(`
      SELECT step_nm, COUNT(*) AS cnt
      FROM edoops.DMF_RUN_STEP_DETAIL
      WHERE step_status = 'FAILED'
      GROUP BY step_nm
      ORDER BY cnt DESC
    `);
    res.json(rows.map((r: any) => ({
      name:  r.step_nm,
      value: parseInt(r.cnt, 10),
      color: STAGE_COLORS[(r.step_nm || '').toUpperCase()] || '#757575',
    })));
  } catch (err: any) {
    console.error('DMF failed-by-stage error:', err.message);
    res.status(500).json({ error: 'Query failed', details: err.message });
  }
});

// ─── GET /api/dmf/run-status ───────────────────────────────
router.get('/run-status', async (_req: Request, res: Response) => {
  try {
    const pool = getPgPool();
    const { rows } = await pool.query(`
      SELECT run_status, COUNT(*) AS cnt
      FROM   edoops.DMF_RUN_MASTER
      GROUP BY run_status
      ORDER BY cnt DESC
    `);
    res.json(rows.map((r: any) => ({
      name:  r.run_status,
      value: parseInt(r.cnt, 10),
      color: STATUS_COLOR[(r.run_status || '').toUpperCase()] || '#757575',
    })));
  } catch (err: any) {
    console.error('DMF run-status error:', err.message);
    res.status(500).json({ error: 'Query failed', details: err.message });
  }
});

// ─── GET /api/dmf/lineage/meta ─────────────────────────────
router.get('/lineage/meta', async (_req: Request, res: Response) => {
  try {
    const pool = getPgPool();
    // Single scan: collect all distinct values in one pass
    const { rows } = await pool.query(`
      SELECT
        ARRAY_AGG(DISTINCT src_cd      ORDER BY src_cd)      FILTER (WHERE src_cd      IS NOT NULL) AS src_cds,
        ARRAY_AGG(DISTINCT dataset_nm  ORDER BY dataset_nm)  FILTER (WHERE dataset_nm  IS NOT NULL) AS dataset_nms,
        ARRAY_AGG(DISTINCT src_nm      ORDER BY src_nm)      FILTER (WHERE src_nm      IS NOT NULL) AS src_nms,
        ARRAY_AGG(DISTINCT tgt_nm      ORDER BY tgt_nm)      FILTER (WHERE tgt_nm      IS NOT NULL) AS tgt_nms,
        ARRAY_AGG(DISTINCT proc_typ_cd ORDER BY proc_typ_cd) FILTER (WHERE proc_typ_cd IS NOT NULL) AS proc_typ_cds
      FROM edoops.DMF_RUN_MASTER
    `);
    const r = rows[0] || {};
    res.json({
      sourceCodes:   r.src_cds      ?? [],
      datasetNames:  r.dataset_nms  ?? [],
      sourceNames:   r.src_nms      ?? [],
      targetNames:   r.tgt_nms      ?? [],
      procTypeCodes: r.proc_typ_cds ?? [],
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Query failed', details: err.message });
  }
});

// ─── GET /api/dmf/lineage/counts ───────────────────────────
// Single-pass: all GROUP BY aggregations in one query joined client-side.
router.get('/lineage/counts', async (req: Request, res: Response) => {
  try {
    const pool = getPgPool();
    const { src_cd, date_range } = req.query;
    const conditions: string[] = [];
    const params: any[] = [];
    if (src_cd && String(src_cd) !== 'All') {
      conditions.push(`src_cd = $${params.length + 1}`);
      params.push(String(src_cd));
    }
    const drClause = dateRangeClause(date_range);
    const where = conditions.length > 0
      ? `WHERE ${conditions.join(' AND ')} ${drClause}`
      : drClause ? `WHERE 1=1 ${drClause}` : '';

    // One scan for each grouping dimension — still runs in parallel but each is O(N) not 5×O(N)
    const [totalRes, statusRes, procTypeRes, srcCdRes, tgtNmRes] = await Promise.all([
      pool.query(`
        SELECT
          COUNT(*) AS total,
          SUM(CASE WHEN UPPER(run_status) = 'SUCCESS' THEN 1 ELSE 0 END) AS success_cnt,
          SUM(CASE WHEN UPPER(run_status) = 'FAILED'  THEN 1 ELSE 0 END) AS failed_cnt
        FROM edoops.DMF_RUN_MASTER ${where}
      `, params),
      pool.query(`
        SELECT run_status, COUNT(*) AS cnt
        FROM edoops.DMF_RUN_MASTER ${where}
        GROUP BY run_status ORDER BY cnt DESC
      `, params),
      pool.query(`
        SELECT proc_typ_cd, COUNT(*) AS cnt
        FROM edoops.DMF_RUN_MASTER ${where}
        GROUP BY proc_typ_cd ORDER BY cnt DESC
      `, params),
      pool.query(`
        SELECT src_cd, COUNT(*) AS cnt
        FROM edoops.DMF_RUN_MASTER ${where}
        GROUP BY src_cd ORDER BY cnt DESC
      `, params),
      pool.query(`
        SELECT tgt_nm, COUNT(*) AS cnt
        FROM edoops.DMF_RUN_MASTER ${where}
        GROUP BY tgt_nm ORDER BY cnt DESC
      `, params),
    ]);

    res.json({
      total: parseInt(totalRes.rows[0]?.total ?? '0'),
      byStatus: statusRes.rows.map((r: any) => ({
        status: (r.run_status || '').toUpperCase() === 'SUCCESS' ? 'success' : 'failed',
        count: parseInt(r.cnt),
      })),
      byProcType: procTypeRes.rows.map((r: any) => ({
        procTypeCode: r.proc_typ_cd || '',
        count: parseInt(r.cnt),
      })),
      bySrcCd: srcCdRes.rows.map((r: any) => ({
        sourceCode: r.src_cd || '',
        count: parseInt(r.cnt),
      })),
      byTgtNm: tgtNmRes.rows.map((r: any) => ({
        targetName: r.tgt_nm || '',
        count: parseInt(r.cnt),
      })),
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Query failed', details: err.message });
  }
});

// ─── GET /api/dmf/lineage/jobs ─────────────────────────────
// Accepts: src_cd, dataset_nm, src_nm, tgt_nm, proc_typ_cd, run_status, step_nm, date_range
// Date range is applied first to minimise the scan window.
router.get('/lineage/jobs', async (req: Request, res: Response) => {
  try {
    const pool = getPgPool();
    const { src_cd, dataset_nm, src_nm, tgt_nm, proc_typ_cd, run_status, date_range } = req.query;

    const conditions: string[] = [];
    const params: any[] = [];

    // Apply date range FIRST so the planner can use any proc_dt index
    const drClause = dateRangeClause(date_range);
    if (drClause) {
      // inline into conditions so it participates in the index scan
      const map: Record<string, string> = { '1m': '1 month', '3m': '3 months', '6m': '6 months', '1y': '1 year' };
      const interval = map[String(date_range ?? '').toLowerCase()];
      if (interval) {
        conditions.push(`proc_dt::date >= CURRENT_DATE - INTERVAL '${interval}'`);
      }
    }

    const add = (col: string, val: any) => {
      if (val && String(val) !== 'All') {
        conditions.push(`${col} = $${params.length + 1}`);
        params.push(String(val));
      }
    };
    add('src_cd',      src_cd);
    add('dataset_nm',  dataset_nm);
    add('src_nm',      src_nm);
    add('tgt_nm',      tgt_nm);
    add('proc_typ_cd', proc_typ_cd);
    if (run_status && String(run_status) !== 'All') {
      conditions.push(`UPPER(run_status) = $${params.length + 1}`);
      params.push(String(run_status).toUpperCase());
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const { rows } = await pool.query(`
      SELECT proc_dt, src_cd, dataset_nm, proc_typ_cd,
             src_nm, tgt_nm, run_strt_tm, run_end_tm, run_status
      FROM edoops.DMF_RUN_MASTER
      ${where}
      ORDER BY proc_dt DESC
    `, params);
    res.json(rows.map((r: any, i: number) => ({
      id:              `${i}-${r.src_cd}-${r.proc_dt}`,
      processDate:     r.proc_dt     ? String(r.proc_dt).split('T')[0]     : '',
      sourceCode:      r.src_cd      || '',
      datasetName:     r.dataset_nm  || '',
      processTypeCode: r.proc_typ_cd || '',
      sourceName:      r.src_nm      || '',
      targetName:      r.tgt_nm      || '',
      runStartTime:    r.run_strt_tm ? String(r.run_strt_tm).slice(0, 19) : '',
      runEndTime:      r.run_end_tm  ? String(r.run_end_tm).slice(0, 19)  : '',
      status:          (r.run_status || '').toUpperCase() === 'SUCCESS' ? 'success' : 'failed',
    })));
  } catch (err: any) {
    res.status(500).json({ error: 'Query failed', details: err.message });
  }
});

// ─── GET /api/dmf/analytics/meta ──────────────────────────
// Single-pass: all distinct filter values from both tables in one round-trip
router.get('/analytics/meta', async (_req: Request, res: Response) => {
  try {
    const pool = getPgPool();
    const [detailMeta, masterMeta] = await Promise.all([
      pool.query(`
        SELECT
          ARRAY_AGG(DISTINCT src_typ  ORDER BY src_typ)  FILTER (WHERE src_typ  IS NOT NULL) AS src_typs,
          ARRAY_AGG(DISTINCT tgt_typ  ORDER BY tgt_typ)  FILTER (WHERE tgt_typ  IS NOT NULL) AS tgt_typs,
          ARRAY_AGG(DISTINCT step_nm  ORDER BY step_nm)  FILTER (WHERE step_nm  IS NOT NULL) AS step_nms
        FROM edoops.DMF_RUN_STEP_DETAIL
      `),
      pool.query(`
        SELECT
          ARRAY_AGG(DISTINCT run_status ORDER BY run_status) FILTER (WHERE run_status IS NOT NULL) AS run_statuses,
          ARRAY_AGG(DISTINCT tgt_nm     ORDER BY tgt_nm)     FILTER (WHERE tgt_nm     IS NOT NULL) AS tgt_nms
        FROM edoops.DMF_RUN_MASTER
      `),
    ]);
    const d = detailMeta.rows[0] || {};
    const m = masterMeta.rows[0] || {};
    res.json({
      sourceTypes:  d.src_typs      ?? [],
      targetTypes:  d.tgt_typs      ?? [],
      stepNames:    d.step_nms      ?? [],
      runStatuses:  m.run_statuses  ?? [],
      targetNames:  m.tgt_nms       ?? [],
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Query failed', details: err.message });
  }
});

// ─── GET /api/dmf/analytics ────────────────────────────────
// Accepts: src_typ, tgt_typ, step_nm, tgt_nm, run_status, date_range
// All 6 result sets derived from a single filtered CTE per table.
router.get('/analytics', async (req: Request, res: Response) => {
  try {
    const { src_typ, tgt_typ, step_nm, tgt_nm, run_status, date_range } = req.query;
    const drDetail = dateRangeClause(date_range);

    const masterConds: string[]  = ['1=1'];
    const detailConds: string[]  = ['1=1'];
    const masterParams: any[]    = [];
    const detailParams: any[]    = [];

    const addMaster = (col: string, val: any) => {
      if (val && String(val) !== 'All') {
        masterConds.push(`${col} = $${masterParams.length + 1}`);
        masterParams.push(String(val));
      }
    };
    const addDetail = (col: string, val: any) => {
      if (val && String(val) !== 'All') {
        detailConds.push(`${col} = $${detailParams.length + 1}`);
        detailParams.push(String(val));
      }
    };

    addMaster('tgt_nm',     tgt_nm);
    addMaster('run_status', run_status);
    addDetail('src_typ',    src_typ);
    addDetail('tgt_typ',    tgt_typ);
    addDetail('step_nm',    step_nm);

    const mWherePlain = masterConds.join(' AND ') + ` ${dateRangeClause(date_range)}`;
    const dWhere      = detailConds.join(' AND ') + ` ${drDetail}`;

    // Status summary: when detail filters active, restrict via EXISTS subquery
    let statusSql: string;
    let statusParams: any[];
    if (detailParams.length > 0) {
      const subConds: string[] = [];
      let pIdx = masterParams.length + 1;
      if (src_typ && String(src_typ) !== 'All') { subConds.push(`d.src_typ = $${pIdx++}`); }
      if (tgt_typ && String(tgt_typ) !== 'All') { subConds.push(`d.tgt_typ = $${pIdx++}`); }
      if (step_nm && String(step_nm) !== 'All') { subConds.push(`d.step_nm = $${pIdx++}`); }
      const subFilter = subConds.length > 0 ? subConds.join(' AND ') + ` ${drDetail}` : `1=1 ${drDetail}`;
      statusSql = `
        SELECT run_status, COUNT(*) AS cnt
        FROM edoops.DMF_RUN_MASTER m
        WHERE ${mWherePlain}
          AND EXISTS (
            SELECT 1 FROM edoops.DMF_RUN_STEP_DETAIL d
            WHERE d.run_id = m.run_id AND ${subFilter}
          )
        GROUP BY run_status
      `;
      statusParams = [...masterParams, ...detailParams];
    } else {
      statusSql = `SELECT run_status, COUNT(*) AS cnt FROM edoops.DMF_RUN_MASTER WHERE ${mWherePlain} GROUP BY run_status`;
      statusParams = masterParams;
    }

    // Analytics detail queries — all parallel, each single-pass GROUP BY
    const pool = getPgPool();
    const [statusRows, detailAggRows, failSrcRows, execTimeRows] = await Promise.all([
      pool.query(statusSql, statusParams),
      // Single scan of DMF_RUN_STEP_DETAIL for src_typ, tgt_typ, step failures
      pool.query(`
        SELECT
          src_typ,
          tgt_typ,
          CASE WHEN step_status = 'FAILED' THEN step_nm ELSE NULL END AS failed_step_nm,
          COUNT(*) AS cnt
        FROM edoops.DMF_RUN_STEP_DETAIL
        WHERE ${dWhere}
        GROUP BY src_typ, tgt_typ, CASE WHEN step_status = 'FAILED' THEN step_nm ELSE NULL END
      `, detailParams),
      pool.query(`
        SELECT src_nm, COUNT(*) AS cnt
        FROM edoops.DMF_RUN_MASTER
        WHERE ${mWherePlain} AND run_status = 'FAILED'
        GROUP BY src_nm ORDER BY cnt DESC
      `, masterParams),
      pool.query(`
        SELECT dataset_nm,
               AVG(EXTRACT(EPOCH FROM (run_end_tm::timestamp - run_strt_tm::timestamp)) * 1000) AS avg_ms
        FROM edoops.DMF_RUN_MASTER
        WHERE ${mWherePlain}
          AND run_end_tm IS NOT NULL AND run_strt_tm IS NOT NULL
        GROUP BY dataset_nm ORDER BY avg_ms DESC
      `, masterParams),
    ]);

    // Pivot the combined detail aggregation into the three separate lists
    const srcTypMap:  Record<string, number> = {};
    const tgtTypMap:  Record<string, number> = {};
    const stepMap:    Record<string, number> = {};
    for (const r of detailAggRows.rows) {
      const c = parseInt(r.cnt, 10);
      if (r.src_typ)       srcTypMap[r.src_typ]       = (srcTypMap[r.src_typ]       || 0) + c;
      if (r.tgt_typ)       tgtTypMap[r.tgt_typ]       = (tgtTypMap[r.tgt_typ]       || 0) + c;
      if (r.failed_step_nm) stepMap[r.failed_step_nm] = (stepMap[r.failed_step_nm]  || 0) + c;
    }

    res.json({
      statusSummary:      statusRows.rows.map((r: any)   => ({ status:  r.run_status, count: parseInt(r.cnt, 10) })),
      sourceTypeCounts:   Object.entries(srcTypMap).sort((a,b) => b[1]-a[1]).map(([type, count]) => ({ type, count })),
      targetTypeCounts:   Object.entries(tgtTypMap).sort((a,b) => b[1]-a[1]).map(([type, count]) => ({ type, count })),
      stepFailureCounts:  Object.entries(stepMap).sort((a,b) => b[1]-a[1]).map(([step, count]) => ({ step, count })),
      failuresBySource:   failSrcRows.rows.map((r: any)  => ({ source:  r.src_nm,     count: parseInt(r.cnt, 10) })),
      datasetsByExecTime: execTimeRows.rows.map((r: any) => ({ dataset: r.dataset_nm, avgMs: Math.round(parseFloat(r.avg_ms) || 0) })),
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Query failed', details: err.message });
  }
});

// ─── GET /api/dmf/status-trend ─────────────────────────────
// Groups by run_status × calendar month; date filter applied first.
router.get('/status-trend', async (req: Request, res: Response) => {
  try {
    const pool = getPgPool();
    const drClause = dateRangeClause(req.query.date_range);
    const { rows } = await pool.query(`
      SELECT run_status,
             DATE_TRUNC('month', proc_dt::date) AS month_start,
             COUNT(*) AS cnt
      FROM edoops.DMF_RUN_MASTER
      WHERE 1=1 ${drClause}
      GROUP BY run_status, DATE_TRUNC('month', proc_dt::date)
      ORDER BY month_start
    `);

    const keyMap: Record<string, string> = {
      'SUCCESS':      'success',
      'FAILED':       'failed',
      'IN PROGRESS':  'inProgress',
      'IN_PROGRESS':  'inProgress',
      'PARTIAL LOAD': 'partialLoad',
      'PARTIAL_LOAD': 'partialLoad',
    };

    const monthSet = new Map<string, string>(); // ISO → display label
    rows.forEach((r: any) => {
      const iso = String(r.month_start).slice(0, 10);
      if (!monthSet.has(iso)) monthSet.set(iso, new Date(iso).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }));
    });
    const sortedMonths = [...monthSet.entries()].sort((a, b) => a[0].localeCompare(b[0]));

    res.json(sortedMonths.map(([iso, label]) => {
      const entry: Record<string, any> = { month: label };
      rows.filter((r: any) => String(r.month_start).slice(0, 10) === iso).forEach((r: any) => {
        const key = keyMap[(r.run_status || '').toUpperCase()] || r.run_status;
        entry[key] = (entry[key] || 0) + parseInt(r.cnt, 10);
      });
      return entry;
    }));
  } catch (err: any) {
    res.status(500).json({ error: 'Query failed', details: err.message });
  }
});

// ─── GET /api/dmf/rows-trend ───────────────────────────────
// Returns [{ month, rowsLoaded, rowsParsed, rowsRjctd }]
router.get('/rows-trend', async (req: Request, res: Response) => {
  try {
    const pool = getPgPool();
    const drClause = dateRangeClause(req.query.date_range);
    const { rows } = await pool.query(`
      SELECT DATE_TRUNC('month', proc_dt::date) AS month_start,
             SUM(rows_loaded) AS rows_loaded,
             SUM(rows_parsed) AS rows_parsed,
             SUM(rows_rjctd)  AS rows_rjctd
      FROM edoops.DMF_RUN_STEP_DETAIL
      WHERE 1=1 ${drClause}
      GROUP BY DATE_TRUNC('month', proc_dt::date)
      ORDER BY month_start
    `);
    res.json(rows.map((r: any) => ({
      month:      new Date(String(r.month_start).slice(0, 10)).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
      rowsLoaded: parseInt(r.rows_loaded, 10) || 0,
      rowsParsed: parseInt(r.rows_parsed, 10) || 0,
      rowsRjctd:  parseInt(r.rows_rjctd,  10) || 0,
    })));
  } catch (err: any) {
    res.status(500).json({ error: 'Query failed', details: err.message });
  }
});

// ─── GET /api/dmf/jobs-trend ───────────────────────────────
// Pivots (proc_typ_cd × month) → [{ month, ING, ENR, DIS, INT }]
router.get('/jobs-trend', async (req: Request, res: Response) => {
  try {
    const pool = getPgPool();
    const drClause = dateRangeClause(req.query.date_range);
    const { rows } = await pool.query(`
      SELECT proc_typ_cd,
             DATE_TRUNC('month', proc_dt::date) AS month_start,
             COUNT(DISTINCT run_id) AS cnt
      FROM edoops.DMF_RUN_MASTER
      WHERE 1=1 ${drClause}
      GROUP BY proc_typ_cd, DATE_TRUNC('month', proc_dt::date)
      ORDER BY month_start
    `);

    const monthSet = new Map<string, string>();
    rows.forEach((r: any) => {
      const iso = String(r.month_start).slice(0, 10);
      if (!monthSet.has(iso)) monthSet.set(iso, new Date(iso).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }));
    });
    const sortedMonths = [...monthSet.entries()].sort((a, b) => a[0].localeCompare(b[0]));

    res.json(sortedMonths.map(([iso, label]) => {
      const entry: Record<string, any> = { month: label };
      rows.filter((r: any) => String(r.month_start).slice(0, 10) === iso).forEach((r: any) => {
        entry[r.proc_typ_cd] = parseInt(r.cnt, 10);
      });
      return entry;
    }));
  } catch (err: any) {
    res.status(500).json({ error: 'Query failed', details: err.message });
  }
});

// ─── GET /api/dmf/step-failure-trend ──────────────────────
// Returns [{ period, count }] — step failures per month
router.get('/step-failure-trend', async (req: Request, res: Response) => {
  try {
    const pool = getPgPool();
    const drClause = dateRangeClause(req.query.date_range);
    const { rows } = await pool.query(`
      SELECT DATE_TRUNC('month', proc_dt::date) AS month_start,
             COUNT(*) AS cnt
      FROM edoops.DMF_RUN_STEP_DETAIL
      WHERE step_status = 'FAILED' ${drClause}
      GROUP BY DATE_TRUNC('month', proc_dt::date)
      ORDER BY month_start
    `);
    res.json(rows.map((r: any) => ({
      period: new Date(String(r.month_start).slice(0, 10)).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
      count:  parseInt(r.cnt, 10) || 0,
    })));
  } catch (err: any) {
    res.status(500).json({ error: 'Query failed', details: err.message });
  }
});

// ─── GET /api/dmf/summary ─────────────────────────────────
// Aggregate KPIs for the overview tab
router.get('/summary', async (_req: Request, res: Response) => {
  try {
    const pool = getPgPool();
    const { rows } = await pool.query(`
      SELECT
        COUNT(*)                                                                            AS total_runs,
        SUM(CASE WHEN run_status = 'SUCCESS'                              THEN 1 ELSE 0 END) AS success_count,
        SUM(CASE WHEN run_status = 'FAILED'                               THEN 1 ELSE 0 END) AS failed_count,
        SUM(CASE WHEN run_status IN ('IN PROGRESS','IN_PROGRESS','STARTED') THEN 1 ELSE 0 END) AS in_progress_count
      FROM edoops.DMF_RUN_MASTER
    `);
    const r = rows[0] || {};
    const total      = parseInt(r.total_runs,      10) || 0;
    const success    = parseInt(r.success_count,   10) || 0;
    const failed     = parseInt(r.failed_count,    10) || 0;
    const inProgress = parseInt(r.in_progress_count, 10) || 0;
    const rate       = total > 0 ? Math.round((success / total) * 100) : 0;
    res.json({
      totalRuns:     { value: total,      trend: '',  label: 'Last 7 days' },
      failedRuns:    { value: failed,     trend: '',  label: 'Last 7 days' },
      runsInProgress:{ value: inProgress, trend: '',  label: 'Currently active' },
      successRate:   { value: rate,       trend: '',  label: '% of total runs' },
    });
  } catch (err: any) {
    console.error('DMF summary error:', err.message);
    res.status(500).json({ error: 'Query failed', details: err.message });
  }
});

// ─── GET /api/dmf/stages ──────────────────────────────────
// Per-stage (proc_typ_cd) success / in-progress / failed breakdown
router.get('/stages', async (_req: Request, res: Response) => {
  try {
    const pool = getPgPool();
    const { rows } = await pool.query(`
      SELECT
        proc_typ_cd                                                                           AS stage,
        SUM(CASE WHEN run_status = 'SUCCESS'                              THEN 1 ELSE 0 END)  AS success,
        SUM(CASE WHEN run_status IN ('IN PROGRESS','IN_PROGRESS','STARTED') THEN 1 ELSE 0 END) AS in_progress,
        SUM(CASE WHEN run_status = 'FAILED'                               THEN 1 ELSE 0 END)  AS failed,
        COUNT(*)                                                                              AS total
      FROM edoops.DMF_RUN_MASTER
      GROUP BY proc_typ_cd
      ORDER BY proc_typ_cd
    `);
    res.json(rows.map((r: any) => {
      const total   = parseInt(r.total,       10) || 1;
      const success = parseInt(r.success,     10) || 0;
      return {
        stage:      r.stage,
        success:    success,
        inProgress: parseInt(r.in_progress, 10) || 0,
        failed:     parseInt(r.failed,      10) || 0,
        rate:       Math.round((success / total) * 100),
      };
    }));
  } catch (err: any) {
    console.error('DMF stages error:', err.message);
    res.status(500).json({ error: 'Query failed', details: err.message });
  }
});

// ─── GET /api/dmf/runs-over-time ──────────────────────────
// Daily run counts (total + failed) for the last 14 days
router.get('/runs-over-time', async (_req: Request, res: Response) => {
  try {
    const pool = getPgPool();
    const { rows } = await pool.query(`
      SELECT
        proc_dt::date                                                   AS date,
        COUNT(*)                                                        AS total,
        SUM(CASE WHEN run_status = 'FAILED' THEN 1 ELSE 0 END)         AS failed
      FROM edoops.DMF_RUN_MASTER
      GROUP BY proc_dt::date
      ORDER BY proc_dt::date
    `);
    res.json(rows.map((r: any) => ({
      date:   String(r.date).split('T')[0],
      total:  parseInt(r.total,  10) || 0,
      failed: parseInt(r.failed, 10) || 0,
    })));
  } catch (err: any) {
    console.error('DMF runs-over-time error:', err.message);
    res.status(500).json({ error: 'Query failed', details: err.message });
  }
});

// ─── GET /api/dmf/error-reasons ───────────────────────────
// Failed step counts pivoted by stage (proc_typ_cd)
router.get('/error-reasons', async (_req: Request, res: Response) => {
  try {
    const rows = await safeQuery(`
      SELECT
        step_nm,
        proc_typ_cd,
        COUNT(*) AS cnt
      FROM edoops.DMF_RUN_STEP_DETAIL
      WHERE step_status = 'FAILED'
      GROUP BY step_nm, proc_typ_cd
      ORDER BY step_nm
    `);

    // Pivot rows into { reason, ingestion, enrichment, distribution, integration }
    const map: Record<string, any> = {};
    rows.forEach((r: any) => {
      const reason = r.step_nm || 'Unknown';
      if (!map[reason]) map[reason] = { reason, ingestion: 0, enrichment: 0, distribution: 0, integration: 0 };
      const code  = (r.proc_typ_cd || '').toUpperCase();
      const count = parseInt(r.cnt, 10) || 0;
      if      (code === 'ING' || code === 'INGESTION')    map[reason].ingestion    += count;
      else if (code === 'ENR' || code === 'ENRICHMENT')   map[reason].enrichment   += count;
      else if (code === 'DIS' || code === 'DISTRIBUTION') map[reason].distribution += count;
      else if (code === 'INT' || code === 'INTEGRATION')  map[reason].integration  += count;
    });
    res.json(Object.values(map));
  } catch (err: any) {
    console.error('DMF error-reasons error:', err.message);
    res.status(500).json({ error: 'Query failed', details: err.message });
  }
});

// ─── GET /api/dmf/recent-failures ────────────────────────
// Last 50 FAILED runs from DMF_RUN_MASTER
router.get('/recent-failures', async (_req: Request, res: Response) => {
  try {
    const pool = getPgPool();
    const { rows } = await pool.query(`
      SELECT run_id, dataset_nm, proc_typ_cd, run_strt_tm, run_end_tm, src_nm, tgt_nm, run_status
      FROM edoops.DMF_RUN_MASTER
      WHERE run_status = 'FAILED'
      ORDER BY proc_dt DESC, run_strt_tm DESC
    `);
    res.json(rows.map((r: any, i: number) => ({
      id:               `rf-${i}-${r.run_id || i}`,
      etlProcess:       r.dataset_nm   || r.src_nm || 'Unknown',
      runId:            r.run_id       || '',
      batchId:          r.proc_typ_cd  || '',
      startTime:        r.run_strt_tm  ? String(r.run_strt_tm).slice(0, 19) : '',
      endTime:          r.run_end_tm   ? String(r.run_end_tm).slice(0, 19)  : '',
      failedStage:      r.proc_typ_cd  || '',
      errorDescription: `Run ${r.run_id || 'Unknown'} failed`,
      details:          `Source: ${r.src_nm || 'N/A'} → Target: ${r.tgt_nm || 'N/A'}`,
    })));
  } catch (err: any) {
    console.error('DMF recent-failures error:', err.message);
    res.status(500).json({ error: 'Query failed', details: err.message });
  }
});

export default router;

