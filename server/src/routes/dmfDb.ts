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
        AND proc_dt >= CURRENT_DATE - INTERVAL '7 days'
      GROUP BY step_nm
      ORDER BY cnt DESC
      LIMIT 100
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
      WHERE  proc_dt >= CURRENT_DATE - INTERVAL '7 days'
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
    const [srcCds, datasetNms, srcNms, tgtNms, procTypes] = await Promise.all([
      safeQuery(`SELECT DISTINCT src_cd      FROM edoops.DMF_RUN_MASTER WHERE src_cd      IS NOT NULL AND proc_dt >= CURRENT_DATE - INTERVAL '7 days' ORDER BY src_cd      LIMIT 100`),
      safeQuery(`SELECT DISTINCT dataset_nm  FROM edoops.DMF_RUN_MASTER WHERE dataset_nm  IS NOT NULL AND proc_dt >= CURRENT_DATE - INTERVAL '7 days' ORDER BY dataset_nm  LIMIT 100`),
      safeQuery(`SELECT DISTINCT src_nm      FROM edoops.DMF_RUN_MASTER WHERE src_nm      IS NOT NULL AND proc_dt >= CURRENT_DATE - INTERVAL '7 days' ORDER BY src_nm      LIMIT 100`),
      safeQuery(`SELECT DISTINCT tgt_nm      FROM edoops.DMF_RUN_MASTER WHERE tgt_nm      IS NOT NULL AND proc_dt >= CURRENT_DATE - INTERVAL '7 days' ORDER BY tgt_nm      LIMIT 100`),
      safeQuery(`SELECT DISTINCT proc_typ_cd FROM edoops.DMF_RUN_MASTER WHERE proc_typ_cd IS NOT NULL AND proc_dt >= CURRENT_DATE - INTERVAL '7 days' ORDER BY proc_typ_cd LIMIT 100`),
    ]);
    res.json({
      sourceCodes:   srcCds.map((r: any)    => r.src_cd).filter(Boolean),
      datasetNames:  datasetNms.map((r: any) => r.dataset_nm).filter(Boolean),
      sourceNames:   srcNms.map((r: any)    => r.src_nm).filter(Boolean),
      targetNames:   tgtNms.map((r: any)    => r.tgt_nm).filter(Boolean),
      procTypeCodes: procTypes.map((r: any)  => r.proc_typ_cd).filter(Boolean),
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Query failed', details: err.message });
  }
});

// ─── GET /api/dmf/lineage/jobs ─────────────────────────────
// Accepts query params: src_cd, dataset_nm, src_nm, tgt_nm, proc_typ_cd, run_status
router.get('/lineage/jobs', async (req: Request, res: Response) => {
  try {
    const pool = getPgPool();
    const { src_cd, dataset_nm, src_nm, tgt_nm, proc_typ_cd, run_status } = req.query;

    const conditions: string[] = [];
    const params: any[] = [];
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
    // run_status filter: frontend sends 'success'/'failed', DB stores 'SUCCESS'/'FAILED'
    if (run_status && String(run_status) !== 'All') {
      conditions.push(`UPPER(run_status) = $${params.length + 1}`);
      params.push(String(run_status).toUpperCase());
    }

    // Always scope to 7 days unless a filter is already applied
    if (conditions.length === 0) {
      conditions.push(`proc_dt >= CURRENT_DATE - INTERVAL '7 days'`);
    }
    const where = `WHERE ${conditions.join(' AND ')}`;
    const { rows } = await pool.query(`
      SELECT DISTINCT proc_dt, src_cd, dataset_nm, proc_typ_cd,
                      src_nm, tgt_nm, run_strt_tm, run_end_tm, run_status
      FROM edoops.DMF_RUN_MASTER
      ${where}
      ORDER BY proc_dt DESC
      LIMIT 100
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
// Distinct filter values for the analytics tab dropdowns
router.get('/analytics/meta', async (_req: Request, res: Response) => {
  try {
    const [srcTyps, tgtTyps, stepNms, runStatuses, tgtNms] = await Promise.all([
      safeQuery(`SELECT DISTINCT src_typ  FROM edoops.DMF_RUN_STEP_DETAIL WHERE src_typ  IS NOT NULL AND proc_dt >= CURRENT_DATE - INTERVAL '7 days' ORDER BY src_typ  LIMIT 100`),
      safeQuery(`SELECT DISTINCT tgt_typ  FROM edoops.DMF_RUN_STEP_DETAIL WHERE tgt_typ  IS NOT NULL AND proc_dt >= CURRENT_DATE - INTERVAL '7 days' ORDER BY tgt_typ  LIMIT 100`),
      safeQuery(`SELECT DISTINCT step_nm  FROM edoops.DMF_RUN_STEP_DETAIL WHERE step_nm  IS NOT NULL AND proc_dt >= CURRENT_DATE - INTERVAL '7 days' ORDER BY step_nm  LIMIT 100`),
      safeQuery(`SELECT DISTINCT run_status FROM edoops.DMF_RUN_MASTER    WHERE run_status IS NOT NULL AND proc_dt >= CURRENT_DATE - INTERVAL '7 days' ORDER BY run_status`),
      safeQuery(`SELECT DISTINCT tgt_nm   FROM edoops.DMF_RUN_MASTER     WHERE tgt_nm   IS NOT NULL AND proc_dt >= CURRENT_DATE - INTERVAL '7 days' ORDER BY tgt_nm   LIMIT 100`),
    ]);
    res.json({
      sourceTypes:  srcTyps.map((r: any) => r.src_typ).filter(Boolean),
      targetTypes:  tgtTyps.map((r: any) => r.tgt_typ).filter(Boolean),
      stepNames:    stepNms.map((r: any) => r.step_nm).filter(Boolean),
      runStatuses:  runStatuses.map((r: any) => r.run_status).filter(Boolean),
      targetNames:  tgtNms.map((r: any) => r.tgt_nm).filter(Boolean),
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Query failed', details: err.message });
  }
});

// ─── GET /api/dmf/analytics ────────────────────────────────
// Accepts optional query params: src_typ, tgt_typ, step_nm, tgt_nm, run_status
router.get('/analytics', async (req: Request, res: Response) => {
  try {
    const { src_typ, tgt_typ, step_nm, tgt_nm, run_status } = req.query;

    // Build shared WHERE snippets (parameterised)
    // master_conditions applies to DMF_RUN_MASTER; detail_conditions applies to DMF_RUN_STEP_DETAIL
    const masterConds: string[]  = [`proc_dt >= CURRENT_DATE - INTERVAL '7 days'`];
    const detailConds: string[]  = [`proc_dt >= CURRENT_DATE - INTERVAL '7 days'`];
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

    const mWhere = masterConds.join(' AND ');
    const dWhere = detailConds.join(' AND ');

    const pool = getPgPool();
    const [statusRows, srcTypRows, tgtTypRows, stepRows, failSrcRows, execTimeRows] = await Promise.all([
      pool.query(`SELECT run_status, COUNT(*) AS cnt FROM edoops.DMF_RUN_MASTER     WHERE ${mWhere} GROUP BY run_status`,  masterParams),
      pool.query(`SELECT src_typ,    COUNT(*) AS cnt FROM edoops.DMF_RUN_STEP_DETAIL WHERE ${dWhere} GROUP BY src_typ`,     detailParams),
      pool.query(`SELECT tgt_typ,    COUNT(*) AS cnt FROM edoops.DMF_RUN_STEP_DETAIL WHERE ${dWhere} GROUP BY tgt_typ`,     detailParams),
      pool.query(`SELECT step_nm,    COUNT(*) AS cnt FROM edoops.DMF_RUN_STEP_DETAIL WHERE ${dWhere} GROUP BY step_nm`,     detailParams),
      pool.query(`SELECT src_nm,     COUNT(*) AS cnt FROM edoops.DMF_RUN_MASTER     WHERE ${mWhere} AND run_status = 'FAILED' GROUP BY src_nm ORDER BY cnt DESC LIMIT 100`, masterParams),
      pool.query(`
        SELECT dataset_nm,
               AVG(EXTRACT(EPOCH FROM (run_end_tm::timestamp - run_strt_tm::timestamp)) * 1000) AS avg_ms
        FROM edoops.DMF_RUN_MASTER
        WHERE ${mWhere}
          AND run_end_tm IS NOT NULL AND run_strt_tm IS NOT NULL
        GROUP BY dataset_nm ORDER BY avg_ms DESC
        LIMIT 100
      `, masterParams),
    ]);

    res.json({
      statusSummary:      statusRows.rows.map((r: any)     => ({ status:  r.run_status, count: parseInt(r.cnt, 10) })),
      sourceTypeCounts:   srcTypRows.rows.map((r: any)     => ({ type:    r.src_typ,    count: parseInt(r.cnt, 10) })),
      targetTypeCounts:   tgtTypRows.rows.map((r: any)     => ({ type:    r.tgt_typ,    count: parseInt(r.cnt, 10) })),
      stepFailureCounts:  stepRows.rows.map((r: any)       => ({ step:    r.step_nm,    count: parseInt(r.cnt, 10) })),
      failuresBySource:   failSrcRows.rows.map((r: any)    => ({ source:  r.src_nm,     count: parseInt(r.cnt, 10) })),
      datasetsByExecTime: execTimeRows.rows.map((r: any)   => ({ dataset: r.dataset_nm, avgMs: Math.round(parseFloat(r.avg_ms) || 0) })),
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Query failed', details: err.message });
  }
});

// ─── GET /api/dmf/status-trend ─────────────────────────────
// Pivots (run_status × month) → [{ month, success, failed, inProgress, partialLoad }]
router.get('/status-trend', async (_req: Request, res: Response) => {
  try {
    const pool = getPgPool();
    const { rows } = await pool.query(`
      SELECT run_status,
             TO_CHAR(proc_dt, 'Mon') AS month_name,
             COUNT(*) AS cnt
      FROM edoops.DMF_RUN_MASTER
      WHERE proc_dt >= CURRENT_DATE - INTERVAL '7 days'
      GROUP BY run_status, TO_CHAR(proc_dt, 'Mon')
      ORDER BY MIN(proc_dt)
    `);

    const keyMap: Record<string, string> = {
      'SUCCESS':      'success',
      'FAILED':       'failed',
      'IN PROGRESS':  'inProgress',
      'IN_PROGRESS':  'inProgress',
      'PARTIAL LOAD': 'partialLoad',
      'PARTIAL_LOAD': 'partialLoad',
    };

    const months = [...new Set(rows.map((r: any) => r.month_name as string))];
    res.json(months.map(month => {
      const entry: Record<string, any> = { month };
      rows.filter((r: any) => r.month_name === month).forEach((r: any) => {
        const key = keyMap[(r.run_status || '').toUpperCase()] || r.run_status;
        entry[key] = parseInt(r.cnt, 10);
      });
      return entry;
    }));
  } catch (err: any) {
    res.status(500).json({ error: 'Query failed', details: err.message });
  }
});

// ─── GET /api/dmf/rows-trend ───────────────────────────────
// Returns [{ month, rowsLoaded, rowsParsed, rowsRjctd }]
router.get('/rows-trend', async (_req: Request, res: Response) => {
  try {
    const pool = getPgPool();
    const { rows } = await pool.query(`
      SELECT TO_CHAR(proc_dt, 'Mon') AS month_name,
             SUM(rows_loaded) AS rows_loaded,
             SUM(rows_parsed) AS rows_parsed,
             SUM(rows_rjctd)  AS rows_rjctd
      FROM edoops.DMF_RUN_STEP_DETAIL
      WHERE proc_dt >= CURRENT_DATE - INTERVAL '7 days'
      GROUP BY TO_CHAR(proc_dt, 'Mon')
      ORDER BY MIN(proc_dt)
    `);
    res.json(rows.map((r: any) => ({
      month:      r.month_name,
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
router.get('/jobs-trend', async (_req: Request, res: Response) => {
  try {
    const pool = getPgPool();
    const { rows } = await pool.query(`
      SELECT proc_typ_cd,
             TO_CHAR(proc_dt, 'Mon') AS month_name,
             COUNT(DISTINCT run_id)  AS cnt
      FROM edoops.DMF_RUN_MASTER
      WHERE proc_dt >= CURRENT_DATE - INTERVAL '7 days'
      GROUP BY proc_typ_cd, TO_CHAR(proc_dt, 'Mon')
      ORDER BY MIN(proc_dt)
    `);

    const months = [...new Set(rows.map((r: any) => r.month_name as string))];
    res.json(months.map(month => {
      const entry: Record<string, any> = { month };
      rows.filter((r: any) => r.month_name === month).forEach((r: any) => {
        entry[r.proc_typ_cd] = parseInt(r.cnt, 10);
      });
      return entry;
    }));
  } catch (err: any) {
    res.status(500).json({ error: 'Query failed', details: err.message });
  }
});

// ─── GET /api/dmf/step-failure-trend ──────────────────────
// Returns [{ period, count }] — total step executions per month
router.get('/step-failure-trend', async (_req: Request, res: Response) => {
  try {
    const pool = getPgPool();
    const { rows } = await pool.query(`
      SELECT TO_CHAR(proc_dt, 'Mon') AS period,
             COUNT(*) AS cnt
      FROM edoops.DMF_RUN_STEP_DETAIL
      WHERE proc_dt >= CURRENT_DATE - INTERVAL '7 days'
      GROUP BY TO_CHAR(proc_dt, 'Mon')
      ORDER BY MIN(proc_dt)
    `);
    res.json(rows.map((r: any) => ({
      period: r.period,
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
      WHERE proc_dt >= CURRENT_DATE - INTERVAL '7 days'
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
      WHERE proc_dt >= CURRENT_DATE - INTERVAL '7 days'
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
      WHERE proc_dt >= CURRENT_DATE - INTERVAL '7 days'
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
        AND proc_dt >= CURRENT_DATE - INTERVAL '7 days'
      GROUP BY step_nm, proc_typ_cd
      ORDER BY step_nm
      LIMIT 100
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
        AND proc_dt >= CURRENT_DATE - INTERVAL '7 days'
      ORDER BY proc_dt DESC, run_strt_tm DESC
      LIMIT 100
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

