
/**
 * ESP routes — queries against SQL Server dbo.esp_job_cmnd
 */
import { Router, Request, Response } from 'express';
import { getPgPool } from '../db/postgres';

const router = Router();

// GET /api/esp/job-counts

// GET /api/esp/applications
router.get('/applications', async (_req: Request, res: Response) => {
  try {
    const pool = getPgPool();
    const result = await pool.query(`
      SELECT DISTINCT appl_name
      FROM esp_job_cmnd
      ORDER BY appl_name
    `);
    res.json({
      applications: result.rows.map((row: any) => ({ appl_name: row.appl_name }))
    });
  } catch (err: any) {
    console.error('ESP applications error:', err.message);
    res.status(500).json({ error: 'Query failed', details: err.message });
  }
});

// GET /api/esp/job-list
router.get('/job-list', async (_req: Request, res: Response) => {
  try {
    const pool = getPgPool();
    const result = await pool.query(`
      SELECT appl_name, last_run_date
      FROM esp_job_cmnd
      ORDER BY jobname
    `);
    res.json({
      job_lists: result.rows.map((row: any) => ({
        appl_name: row.appl_name,
        last_run_date: row.last_run_date
      }))
    });
  } catch (err: any) {
    console.error('ESP job-list error:', err.message);
    res.status(500).json({ error: 'Query failed', details: err.message });
  }
});

// GET /api/esp/special-jobs
router.get('/special-jobs', async (_req: Request, res: Response) => {
  try {
    const pool = getPgPool();
    const result = await pool.query(`
      SELECT appl_name, COUNT(DISTINCT jobname) AS spl_jobs
      FROM esp_job_cmnd
      WHERE jobname LIKE '%JSDDELAY%' OR jobname LIKE '%RETRIG%'
      GROUP BY appl_name
    `);
    res.json({
      spl_jobs: result.rows.map((row: any) => ({
        appl_name: row.appl_name,
        spl_jobs: row.spl_jobs
      }))
    });
  } catch (err: any) {
    console.error('ESP special-jobs error:', err.message);
    res.status(500).json({ error: 'Query failed', details: err.message });
  }
});

// GET /api/esp/job-counts
router.get('/job-counts', async (_req: Request, res: Response) => {
  try {
    const pool = getPgPool();
    const result = await pool.query(`
      SELECT appl_name,
             COUNT(DISTINCT jobname) AS total_jobs
      FROM   esp_job_cmnd
      GROUP BY appl_name
      ORDER BY total_jobs DESC
    `);
    res.json({
      jobs_summary: result.rows.map((row: any) => ({
        appl_name: row.appl_name,
        total_jobs: row.total_jobs
      }))
    });
  } catch (err: any) {
    console.error('ESP job-counts error:', err.message);
    res.status(500).json({ error: 'Query failed', details: err.message });
  }
});

// GET /api/esp/idle-jobs
router.get('/idle-jobs', async (_req: Request, res: Response) => {
  try {
    const pool = getPgPool();
    // Example: jobs not run in last 2 days (adjust as needed)
    const result = await pool.query(`
      SELECT appl_name, COUNT(DISTINCT jobname) AS idle_jobs
      FROM esp_job_cmnd
      WHERE last_run_date < NOW() - INTERVAL '2 days'
      GROUP BY appl_name
    `);
    res.json({
      idle_jobs: result.rows.map((row: any) => ({
        appl_name: row.appl_name,
        idle_jobs: row.idle_jobs
      }))
    });
  } catch (err: any) {
    console.error('ESP idle-jobs error:', err.message);
    res.status(500).json({ error: 'Query failed', details: err.message });
  }
});

// GET /api/esp/agents
router.get('/agents', async (_req: Request, res: Response) => {
  try {
    const pool = getPgPool();
    const result = await pool.query(`
      SELECT agent, COUNT(DISTINCT jobname) AS count
      FROM esp_job_cmnd
      GROUP BY agent
      ORDER BY count DESC
    `);
    res.json({
      agents: result.rows.map((row: any) => ({
        agent: row.agent,
        count: row.count
      }))
    });
  } catch (err: any) {
    console.error('ESP agents error:', err.message);
    res.status(500).json({ error: 'Query failed', details: err.message });
  }
});

// GET /api/esp/job-types
router.get('/job-types', async (_req: Request, res: Response) => {
  try {
    const pool = getPgPool();
    const result = await pool.query(`
      SELECT job_type, COUNT(DISTINCT jobname) AS count
      FROM esp_job_cmnd
      GROUP BY job_type
      ORDER BY count DESC
    `);
    res.json({
      job_types: result.rows.map((row: any) => ({
        job_type: row.job_type,
        count: row.count
      }))
    });
  } catch (err: any) {
    console.error('ESP job-types error:', err.message);
    res.status(500).json({ error: 'Query failed', details: err.message });
  }
});

// GET /api/esp/accounts
router.get('/accounts', async (_req: Request, res: Response) => {
  try {
    const pool = getPgPool();
    const result = await pool.query(`
      SELECT account, COUNT(DISTINCT jobname) AS count
      FROM esp_job_cmnd
      GROUP BY account
      ORDER BY count DESC
    `);
    res.json({
      accounts: result.rows.map((row: any) => ({
        account: row.account,
        count: row.count
      }))
    });
  } catch (err: any) {
    console.error('ESP accounts error:', err.message);
    res.status(500).json({ error: 'Query failed', details: err.message });
  }
});

// GET /api/esp/job-run-trend
router.get('/job-run-trend', async (_req: Request, res: Response) => {
  try {
    const pool = getPgPool();
    // Example: jobs run per hour for last 2 days
    const result = await pool.query(`
      SELECT DATE_TRUNC('hour', last_run_date) AS hour, COUNT(*) AS count
      FROM esp_job_cmnd
      WHERE last_run_date >= NOW() - INTERVAL '2 days'
      GROUP BY hour
      ORDER BY hour
    `);
    res.json({
      trend: result.rows.map((row: any) => ({
        hour: row.hour,
        count: row.count
      }))
    });
  } catch (err: any) {
    console.error('ESP job-run-trend error:', err.message);
    res.status(500).json({ error: 'Query failed', details: err.message });
  }
});
// GET /api/esp/summary/:appl_name  — all widget data for one application
router.get('/summary/:appl_name', async (req: Request, res: Response) => {
  try {
    const pool = getPgPool();
    const appl_name = decodeURIComponent(req.params.appl_name);

    // Helper: run query safely; return fallback on any DB error
    const safe = async <T>(fn: () => Promise<T>, fallback: T): Promise<T> => {
      try { return await fn(); } catch (e: any) {
        console.warn(`ESP query skipped (${e.message?.slice(0, 60)})`);
        return fallback;
      }
    };

    const [
      jobCount, idleCount, splCount,
      agents, jobTypes, cmplCodes, accounts,
      jobList, trend, successors, predecessors, metadata,
    ] = await Promise.all([
      safe(() => pool.query(
        `SELECT COUNT(DISTINCT jobname) AS cnt FROM esp_job_cmnd WHERE appl_name = $1`,
        [appl_name]).then(r => parseInt(r.rows[0]?.cnt || '0', 10)), 0),

      safe(() => pool.query(
        `SELECT COUNT(DISTINCT jobname) AS cnt FROM esp_job_cmnd WHERE appl_name = $1 AND (last_run_date IS NULL OR last_run_date < NOW() - INTERVAL '2 days')`,
        [appl_name]).then(r => parseInt(r.rows[0]?.cnt || '0', 10)), 0),

      safe(() => pool.query(
        `SELECT COUNT(DISTINCT jobname) AS cnt FROM esp_job_cmnd WHERE appl_name = $1 AND (jobname LIKE '%JSDELAY%' OR jobname LIKE '%RETRIG%')`,
        [appl_name]).then(r => parseInt(r.rows[0]?.cnt || '0', 10)), 0),

      safe(() => pool.query(
        `SELECT COALESCE(agent, 'Null') AS name, COUNT(*) AS count FROM esp_job_cmnd WHERE appl_name = $1 GROUP BY agent ORDER BY count DESC LIMIT 10`,
        [appl_name]).then(r => r.rows.map((x: any) => ({ name: x.name, count: parseInt(x.count) }))), []),

      safe(() => pool.query(
        `SELECT COALESCE(job_type, 'Null') AS name, COUNT(*) AS count FROM esp_job_cmnd WHERE appl_name = $1 GROUP BY job_type ORDER BY count DESC`,
        [appl_name]).then(r => r.rows.map((x: any) => ({ name: x.name, count: parseInt(x.count) }))), []),

      safe(() => pool.query(
        `SELECT COALESCE(CAST(cmpl_cd AS TEXT), 'Null') AS name, COUNT(*) AS count FROM esp_job_cmnd WHERE appl_name = $1 GROUP BY cmpl_cd ORDER BY count DESC`,
        [appl_name]).then(r => r.rows.map((x: any) => ({ name: x.name, count: parseInt(x.count) }))), []),

      safe(() => pool.query(
        `SELECT COALESCE(account, 'Null') AS name, COUNT(*) AS count FROM esp_job_cmnd WHERE appl_name = $1 GROUP BY account ORDER BY count DESC LIMIT 10`,
        [appl_name]).then(r => r.rows.map((x: any) => ({ name: x.name, count: parseInt(x.count) }))), []),

      safe(() => pool.query(
        `SELECT jobname, last_run_date FROM esp_job_cmnd WHERE appl_name = $1 ORDER BY jobname`,
        [appl_name]).then(r => r.rows.map((x: any) => ({ jobname: x.jobname, last_run_date: x.last_run_date }))), []),

      safe(() => pool.query(
        `SELECT DATE(last_run_date) AS day, EXTRACT(HOUR FROM last_run_date) AS hour, COUNT(*) AS count
         FROM esp_job_cmnd WHERE appl_name = $1 AND last_run_date >= NOW() - INTERVAL '2 days'
         GROUP BY day, hour ORDER BY day, hour`,
        [appl_name]).then(r => r.rows.map((x: any) => ({ day: String(x.day), hour: parseInt(x.hour), count: parseInt(x.count) }))), []),

      safe(() => pool.query(
        `SELECT jobname, release AS successor_job FROM esp_job_dpndnt WHERE appl_name = $1 ORDER BY jobname LIMIT 50`,
        [appl_name]).then(r => r.rows.map((x: any) => ({ jobname: x.jobname, successor_job: x.successor_job }))), []),

      safe(() => pool.query(
        `SELECT jobname, release AS predecessor_job FROM esp_job_dpndnt WHERE release = $1 ORDER BY jobname LIMIT 50`,
        [appl_name]).then(r => r.rows.map((x: any) => ({ jobname: x.jobname, predecessor_job: x.predecessor_job }))), []),

      safe(() => pool.query(
        `SELECT jobname, cmnd AS command, argument FROM esp_job_cmnd WHERE appl_name = $1 ORDER BY jobname LIMIT 100`,
        [appl_name]).then(r => r.rows.map((x: any) => ({ jobname: x.jobname, command: x.command ?? null, argument: x.argument ?? null }))), []),
    ]);

    res.json({
      appl_name,
      job_count: jobCount,
      idle_job_count: idleCount,
      spl_job_count: splCount,
      agents,
      job_types: jobTypes,
      completion_codes: cmplCodes,
      accounts,
      job_list: jobList,
      job_run_trend: trend,
      successor_jobs: successors,
      predecessor_jobs: predecessors,
      metadata,
    });
  } catch (err: any) {
    console.error('ESP summary detail error:', err.message);
    res.status(500).json({ error: 'Query failed', details: err.message });
  }
});
// MOCK: Sample output for /api/esp/summary for UI testing
router.get('/summary', async (_req: Request, res: Response) => {
  // Sample data for 2 applications
  return res.json({
    summary: [
      {
        appl_name: 'FINANCE_ETL',
        job_count: 107,
        idle_job_count: 16,
        spl_job_count: 5,
        account: 'sv-eldprd1_metrics',
        job_run_trend: [
          { hour: '2026-03-24T10:00:00Z', count: 10 },
          { hour: '2026-03-24T11:00:00Z', count: 18 },
          { hour: '2026-03-24T12:00:00Z', count: 30 },
          { hour: '2026-03-24T13:00:00Z', count: 22 },
          { hour: '2026-03-24T14:00:00Z', count: 19 },
          { hour: '2026-03-24T15:00:00Z', count: 21 },
        ]
      },
      {
        appl_name: 'CUSTOMER_360',
        job_count: 88,
        idle_job_count: 12,
        spl_job_count: 3,
        account: 'sv-cust360_metrics',
        job_run_trend: [
          { hour: '2026-03-24T10:00:00Z', count: 7 },
          { hour: '2026-03-24T11:00:00Z', count: 12 },
          { hour: '2026-03-24T12:00:00Z', count: 15 },
          { hour: '2026-03-24T13:00:00Z', count: 14 },
          { hour: '2026-03-24T14:00:00Z', count: 13 },
          { hour: '2026-03-24T15:00:00Z', count: 11 },
        ]
      }
    ]
  });
});
// GET /api/esp/summary
router.get('/summary-actual', async (_req: Request, res: Response) => {
  try {
    const pool = getPgPool();
    // Get all appl_ids
    const appsResult = await pool.query(`
      SELECT DISTINCT appl_name FROM esp_job_cmnd ORDER BY appl_name
    `);
    const applNames = appsResult.rows.map((row: any) => row.appl_name);

    // For each appl_id, get counts and trend
    const summary = [];
    for (const appl_name of applNames) {
      // Job count
      const jobCountResult = await pool.query(`
        SELECT COUNT(DISTINCT jobname) AS job_count FROM esp_job_cmnd WHERE appl_name = $1
      `, [appl_name]);
      const job_count = parseInt(jobCountResult.rows[0]?.job_count || '0', 10);

      // Idle job count (not run in last 2 days)
      const idleJobResult = await pool.query(`
        SELECT COUNT(DISTINCT jobname) AS idle_job_count FROM esp_job_cmnd WHERE appl_name = $1 AND last_run_date < NOW() - INTERVAL '2 days'
      `, [appl_name]);
      const idle_job_count = parseInt(idleJobResult.rows[0]?.idle_job_count || '0', 10);

      // Special job count
      const splJobResult = await pool.query(`
        SELECT COUNT(DISTINCT jobname) AS spl_job_count FROM esp_job_cmnd WHERE appl_name = $1 AND (jobname LIKE '%JSDDELAY%' OR jobname LIKE '%RETRIG%')
      `, [appl_name]);
      const spl_job_count = parseInt(splJobResult.rows[0]?.spl_job_count || '0', 10);

      // Account (first account found for this appl_name)
      const accountResult = await pool.query(`
        SELECT account FROM esp_job_cmnd WHERE appl_name = $1 LIMIT 1
      `, [appl_name]);
      const account = accountResult.rows[0]?.account || null;

      // Job run trend (last 2 days, jobs per hour)
      const trendResult = await pool.query(`
        SELECT DATE_TRUNC('hour', last_run_date) AS hour, COUNT(*) AS count
        FROM esp_job_cmnd
        WHERE appl_name = $1 AND last_run_date >= NOW() - INTERVAL '2 days'
        GROUP BY hour
        ORDER BY hour
      `, [appl_name]);
      const job_run_trend = trendResult.rows.map((row: any) => ({ hour: row.hour, count: row.count }));

      summary.push({
        appl_name,
        job_count,
        idle_job_count,
        spl_job_count,
        account,
        job_run_trend
      });
    }

    res.json({ summary });
  } catch (err: any) {
    console.error('ESP summary error:', err.message);
    res.status(500).json({ error: 'Query failed', details: err.message });
  }
});

export default router;
