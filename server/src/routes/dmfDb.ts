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

// ─── GET /api/dmf/run-status ───────────────────────────────
router.get('/run-status', async (_req: Request, res: Response) => {
  try {
    const pool = getPgPool();
    const { rows } = await pool.query(`
      SELECT run_status, COUNT(*) AS cnt
      FROM   "_DMF"."CORE"."DMF_RUN_MASTER"
      WHERE  proc_dt >= CURRENT_DATE - INTERVAL '3 months'
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
    const [srcCds, datasetNms, srcNms, tgtNms] = await Promise.all([
      safeQuery(`SELECT DISTINCT src_cd     FROM "_DMF"."CORE"."DMF_RUN_MASTER" ORDER BY src_cd`),
      safeQuery(`SELECT DISTINCT dataset_nm FROM "_DMF"."CORE"."DMF_RUN_MASTER" ORDER BY dataset_nm`),
      safeQuery(`SELECT DISTINCT src_nm     FROM "_DMF"."CORE"."DMF_RUN_MASTER" ORDER BY src_nm`),
      safeQuery(`SELECT DISTINCT tgt_nm     FROM "_DMF"."CORE"."DMF_RUN_MASTER" ORDER BY tgt_nm`),
    ]);
    res.json({
      sourceCodes:  srcCds.map((r: any)    => r.src_cd).filter(Boolean),
      datasetNames: datasetNms.map((r: any) => r.dataset_nm).filter(Boolean),
      sourceNames:  srcNms.map((r: any)    => r.src_nm).filter(Boolean),
      targetNames:  tgtNms.map((r: any)    => r.tgt_nm).filter(Boolean),
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Query failed', details: err.message });
  }
});

// ─── GET /api/dmf/lineage/jobs ─────────────────────────────
router.get('/lineage/jobs', async (_req: Request, res: Response) => {
  try {
    const pool = getPgPool();
    const { rows } = await pool.query(`
      SELECT DISTINCT proc_dt, src_cd, dataset_nm, proc_typ_cd,
                      src_nm, tgt_nm, run_strt_tm, run_end_tm, run_status
      FROM "_DMF"."CORE"."DMF_RUN_MASTER"
      ORDER BY proc_dt DESC
    `);
    res.json(rows.map((r: any, i: number) => ({
      id:              `${i}-${r.src_cd}-${r.proc_dt}`,
      processDate:     r.proc_dt ? String(r.proc_dt).split('T')[0] : '',
      sourceCode:      r.src_cd      || '',
      datasetName:     r.dataset_nm  || '',
      processTypeCode: r.proc_typ_cd || '',
      sourceName:      r.src_nm      || '',
      targetName:      r.tgt_nm      || '',
      runStartTime:    r.run_strt_tm ? String(r.run_strt_tm) : '',
      runEndTime:      r.run_end_tm  ? String(r.run_end_tm)  : '',
      status:          (r.run_status || '').toUpperCase() === 'SUCCESS' ? 'success' : 'failed',
    })));
  } catch (err: any) {
    res.status(500).json({ error: 'Query failed', details: err.message });
  }
});

// ─── GET /api/dmf/analytics ────────────────────────────────
router.get('/analytics', async (_req: Request, res: Response) => {
  try {
    const [statusRows, srcTypRows, tgtTypRows, stepRows, failSrcRows, execTimeRows] = await Promise.all([
      safeQuery(`
        SELECT run_status, COUNT(*) AS cnt
        FROM "_DMF"."CORE"."DMF_RUN_MASTER"
        WHERE proc_dt >= CURRENT_DATE - INTERVAL '3 months'
        GROUP BY run_status
      `),
      safeQuery(`
        SELECT src_typ, COUNT(*) AS cnt
        FROM "_DMF"."CORE"."DMF_RUN_STEP_DETAIL"
        WHERE proc_dt >= CURRENT_DATE - INTERVAL '3 months'
        GROUP BY src_typ
      `),
      safeQuery(`
        SELECT tgt_typ, COUNT(*) AS cnt
        FROM "_DMF"."CORE"."DMF_RUN_STEP_DETAIL"
        WHERE proc_dt >= CURRENT_DATE - INTERVAL '3 months'
        GROUP BY tgt_typ
      `),
      safeQuery(`
        SELECT step_nm, COUNT(*) AS cnt
        FROM "_DMF"."CORE"."DMF_RUN_STEP_DETAIL"
        WHERE proc_dt >= CURRENT_DATE - INTERVAL '3 months'
        GROUP BY step_nm
      `),
      safeQuery(`
        SELECT src_nm, COUNT(*) AS cnt
        FROM "_DMF"."CORE"."DMF_RUN_MASTER"
        WHERE proc_dt >= CURRENT_DATE - INTERVAL '3 months'
          AND run_status = 'FAILED'
        GROUP BY src_nm
        ORDER BY cnt DESC
      `),
      safeQuery(`
        SELECT dataset_nm,
               AVG(EXTRACT(EPOCH FROM (run_end_tm - run_strt_tm)) * 1000) AS avg_ms
        FROM "_DMF"."CORE"."DMF_RUN_MASTER"
        WHERE proc_dt >= CURRENT_DATE - INTERVAL '3 months'
        GROUP BY dataset_nm
        ORDER BY avg_ms DESC
      `),
    ]);

    res.json({
      statusSummary:      statusRows.map((r: any)    => ({ status:  r.run_status, count: parseInt(r.cnt, 10)              })),
      sourceTypeCounts:   srcTypRows.map((r: any)    => ({ type:    r.src_typ,    count: parseInt(r.cnt, 10)              })),
      targetTypeCounts:   tgtTypRows.map((r: any)    => ({ type:    r.tgt_typ,    count: parseInt(r.cnt, 10)              })),
      stepFailureCounts:  stepRows.map((r: any)      => ({ step:    r.step_nm,    count: parseInt(r.cnt, 10)              })),
      failuresBySource:   failSrcRows.map((r: any)   => ({ source:  r.src_nm,     count: parseInt(r.cnt, 10)              })),
      datasetsByExecTime: execTimeRows.map((r: any)  => ({ dataset: r.dataset_nm, avgMs: Math.round(parseFloat(r.avg_ms) || 0) })),
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
      FROM "_DMF"."CORE"."DMF_RUN_MASTER"
      WHERE proc_dt >= CURRENT_DATE - INTERVAL '3 months'
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
      FROM "_DMF"."CORE"."DMF_RUN_STEP_DETAIL"
      WHERE proc_dt >= CURRENT_DATE - INTERVAL '3 months'
      GROUP BY month_name
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
      FROM "_DMF"."CORE"."DMF_RUN_MASTER"
      WHERE proc_dt >= CURRENT_DATE - INTERVAL '3 months'
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
      FROM "_DMF"."CORE"."DMF_RUN_STEP_DETAIL"
      WHERE proc_dt >= CURRENT_DATE - INTERVAL '3 months'
      GROUP BY period
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

export default router;
