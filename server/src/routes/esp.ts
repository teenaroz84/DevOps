
/**
 * ESP routes — queries against PostgreSQL edoops ESP tables
 *
 * Platform resolution is driven by edoops.esp_plt_mapping:
 *   keys     → one pattern/key value per row (multiple rows per platform)
 *   plt_name → platform display name shared across multiple keys rows
 *
 * A single canonical keys value is chosen per plt_name with DISTINCT ON to serve
 * as the stable platform_id used in URLs and state.  All data queries still span
 * every keys row for the platform via:
 *     WHERE c.keys IN (SELECT keys FROM edoops.esp_plt_mapping WHERE plt_name = $1)
 */
import { Router, Request, Response } from 'express';
import { getPgPool } from '../db/postgres';

const router = Router();

const ESP_DEFAULT_DAYS = 2;
const ESP_MAX_DAYS = 5;

function parseDays(query: any): number {
  const n = parseInt(String(query.days ?? ESP_DEFAULT_DAYS), 10);
  return Math.min(Math.max(isNaN(n) ? ESP_DEFAULT_DAYS : n, 1), ESP_MAX_DAYS);
}

// ─── Helper: look up a platform by its canonical keys value (platform_id) ────
// Returns { platform_id, platform_name } or null if the keys value is unknown.
async function getPlatformRow(platformId: string): Promise<{ platform_id: string; platform_name: string } | null> {
  const pool = getPgPool();
  const r = await pool.query(
    `SELECT keys AS platform_id, plt_name AS platform_name
     FROM edoops.esp_plt_mapping WHERE keys = $1 LIMIT 1`,
    [platformId]
  );
  if (!r.rows.length) return null;
  return { platform_id: r.rows[0].platform_id, platform_name: r.rows[0].platform_name };
}

// Subquery: given a display plt_name ($1), returns all keys values for that platform.
// Used as: WHERE c.plt_name IN ${pltKeysSubquery}
const pltKeysSubquery = `(SELECT keys FROM edoops.esp_plt_mapping WHERE plt_name = $1)`;

// GET /api/esp/platform-summary
// Streams NDJSON — one JSON line per platform as each count query completes.
// This avoids a single slow mega-aggregate; each platform query runs independently
// and results reach the client progressively.
router.get('/platform-summary', async (_req: Request, res: Response) => {
  try {
    const pool = getPgPool();

    // Step 1: fast — esp_plt_mapping is a small lookup table
    const pltsResult = await pool.query(`
      SELECT DISTINCT ON (plt_name) keys AS platform_id, plt_name
      FROM edoops.esp_plt_mapping
      ORDER BY plt_name, keys
    `);

    res.setHeader('Content-Type', 'application/x-ndjson');
    res.setHeader('Cache-Control', 'no-cache');
    res.flushHeaders();

    // Step 2: run each platform's counts independently and write as they complete
    const queries = pltsResult.rows.map(async (plt: any) => {
      try {
        const r = await pool.query(`
          SELECT
            COUNT(DISTINCT c.jobname)                                                        AS total,
            COUNT(DISTINCT CASE
              WHEN c.last_run_date IS NOT NULL AND c.last_run_date::timestamp < NOW() - INTERVAL '2 days'
              THEN c.jobname END)                                                            AS idle,
            COUNT(DISTINCT CASE
              WHEN c.jobname LIKE '%JSDELAY%' OR c.jobname LIKE '%RETRIG%'
              THEN c.jobname END)                                                            AS special,
            COUNT(DISTINCT c.appl_name)                                                     AS app_count
          FROM edoops.esp_plt_mapping m
          LEFT JOIN edoops.esp_job_cmnd_plt c ON c.plt_name = m.keys
          WHERE m.plt_name = $1
        `, [plt.plt_name]);
        const row = r.rows[0];
        res.write(JSON.stringify({
          platform:      plt.platform_id,
          platform_name: plt.plt_name,
          total:         parseInt(row?.total     || '0', 10),
          idle:          parseInt(row?.idle      || '0', 10),
          special:       parseInt(row?.special   || '0', 10),
          app_count:     parseInt(row?.app_count || '0', 10),
        }) + '\n');
      } catch (e: any) {
        console.warn(`[ESP] platform-summary skipped ${plt.plt_name}: ${e.message}`);
      }
    });

    await Promise.allSettled(queries);
    res.end();
  } catch (err: any) {
    if (!res.headersSent) {
      res.status(500).json({ error: 'Query failed', details: err.message });
    } else {
      res.end();
    }
  }
});

// GET /api/esp/platform-applications/:platformId
// Returns distinct appl_name values for a platform (for qualifiers display)
router.get('/platform-applications/:platformId', async (req: Request, res: Response) => {
  try {
    const pool = getPgPool();
    const platformId = decodeURIComponent(req.params.platformId);
    console.log('[ESP] platform-applications → platformId:', platformId);
    const plt = await getPlatformRow(platformId);
    if (!plt) return res.status(404).json({ error: 'Unknown platform' });
    const result = await pool.query(
      `SELECT DISTINCT appl_name FROM edoops.esp_job_cmnd_plt
       WHERE plt_name IN ${pltKeysSubquery}
       ORDER BY appl_name`,
      [plt.platform_name]
    );
    res.json(result.rows.map((r: any) => r.appl_name));
  } catch (err: any) {
    res.status(500).json({ error: 'Query failed', details: err.message });
  }
});

// GET /api/esp/platform-detail/:platformId
// Aggregated widget data for all apps in a platform
router.get('/platform-detail/:platformId', async (req: Request, res: Response) => {
  try {
    const pool = getPgPool();
    const platformId = decodeURIComponent(req.params.platformId);
    console.log('[ESP] platform-detail → platformId:', platformId);
    const plt = await getPlatformRow(platformId);
    if (!plt) return res.status(404).json({ error: 'Unknown platform' });
    const pltName = plt.platform_name;

    const safe = async <T>(fn: () => Promise<T>, fallback: T): Promise<T> => {
      try { return await fn(); } catch (e: any) {
        console.warn(`ESP platform query skipped (${e.message?.slice(0, 60)})`);
        return fallback;
      }
    };

    const [jobCount, idleCount, splCount, agents, jobTypes, cmplCodes, accounts, jobList, successors, predecessors] = await Promise.all([
      safe(() => pool.query(
        `SELECT COUNT(*) AS cnt FROM (SELECT DISTINCT jobname, appl_name FROM edoops.esp_job_cmnd_plt WHERE plt_name IN ${pltKeysSubquery}) AS sub`, [pltName])
        .then(r => parseInt(r.rows[0]?.cnt || '0', 10)), 0),
      safe(() => pool.query(
        `SELECT COUNT(*) AS cnt FROM (SELECT DISTINCT jobname, appl_name FROM edoops.esp_job_cmnd_plt WHERE plt_name IN ${pltKeysSubquery} AND last_run_date IS NOT NULL AND last_run_date::timestamp < NOW() - INTERVAL '2 days') AS sub`, [pltName])
        .then(r => parseInt(r.rows[0]?.cnt || '0', 10)), 0),
      safe(() => pool.query(
        `SELECT COUNT(DISTINCT jobname) AS cnt FROM edoops.esp_job_cmnd_plt WHERE plt_name IN ${pltKeysSubquery} AND (jobname LIKE '%JSDELAY%' OR jobname LIKE '%RETRIG%')`, [pltName])
        .then(r => parseInt(r.rows[0]?.cnt || '0', 10)), 0),
      safe(() => pool.query(
        `SELECT COALESCE(agent, 'Null') AS name, COUNT(*) AS count FROM edoops.esp_job_cmnd_plt WHERE plt_name IN ${pltKeysSubquery} GROUP BY agent ORDER BY count DESC`, [pltName])
        .then(r => r.rows.map((x: any) => ({ name: x.name, count: parseInt(x.count) }))), []),
      safe(() => pool.query(
        `SELECT COALESCE(jobtype, 'Null') AS name, COUNT(*) AS count FROM edoops.esp_job_cmnd_plt WHERE plt_name IN ${pltKeysSubquery} GROUP BY jobtype ORDER BY count DESC`, [pltName])
        .then(r => r.rows.map((x: any) => ({ name: x.name, count: parseInt(x.count) }))), []),
      safe(() => pool.query(
        `SELECT COALESCE(CAST(cmpl_cd AS TEXT), 'Null') AS name, COUNT(*) AS count FROM edoops.esp_job_cmnd_plt WHERE plt_name IN ${pltKeysSubquery} GROUP BY cmpl_cd ORDER BY count DESC`, [pltName])
        .then(r => r.rows.map((x: any) => ({ name: x.name, count: parseInt(x.count) }))), []),
      safe(() => pool.query(
        `SELECT COALESCE(user_job, 'Null') AS name, COUNT(*) AS count FROM edoops.esp_job_cmnd_plt WHERE plt_name IN ${pltKeysSubquery} GROUP BY user_job ORDER BY count DESC`, [pltName])
        .then(r => r.rows.map((x: any) => ({ name: x.name, count: parseInt(x.count) }))), []),
      safe(() => pool.query(`
        WITH filtered_jobs AS (
          SELECT c.jobname, c.appl_name, MAX(c.jobtype) AS job_type,
                 MAX(c.last_run_date) AS last_run_date
          FROM edoops.esp_job_cmnd_plt c
          WHERE c.plt_name IN ${pltKeysSubquery}
          GROUP BY c.jobname, c.appl_name
        ),
        latest_status AS (
          SELECT DISTINCT ON (s.appl_name, s.job_longname)
            s.appl_name, s.job_longname, s.ccfail
          FROM edoops.esp_job_stats_recent_plt s
          JOIN filtered_jobs f ON f.appl_name = s.appl_name AND f.jobname = s.job_longname
          ORDER BY s.appl_name, s.job_longname,
                   s.end_date DESC NULLS LAST, s.end_time DESC NULLS LAST,
                   s.start_date DESC NULLS LAST, s.start_time DESC NULLS LAST
        )
        SELECT
          f.jobname, f.appl_name, f.job_type, f.last_run_date,
          CASE
            WHEN ls.ccfail = 'YES' THEN 'FAILED'
            WHEN ls.ccfail = 'NO'  THEN 'SUCCESS'
            WHEN f.last_run_date IS NULL THEN 'NEVER RUN'
            ELSE 'UNKNOWN'
          END AS run_status
        FROM filtered_jobs f
        LEFT JOIN latest_status ls ON ls.appl_name = f.appl_name AND ls.job_longname = f.jobname
        ORDER BY f.last_run_date DESC NULLS LAST, f.jobname`, [pltName])
        .then(r => r.rows.map((x: any) => ({
          jobname: x.jobname, appl_name: x.appl_name,
          job_type: x.job_type ?? null, last_run_date: x.last_run_date, run_status: x.run_status ?? null,
        }))), []),
      safe(() => pool.query(
        `SELECT DISTINCT d.jobname, d.release AS successor_job
         FROM edoops.esp_job_dpndnt_plt d
         JOIN edoops.esp_job_cmnd_plt c ON d.appl_name = c.appl_name
         WHERE c.plt_name IN ${pltKeysSubquery}
         ORDER BY d.jobname`, [pltName])
        .then(r => r.rows.map((x: any) => ({ jobname: x.jobname, successor_job: x.successor_job }))), []),
      safe(() => pool.query(
        `SELECT DISTINCT d.jobname, d.release AS predecessor_job
         FROM edoops.esp_job_dpndnt_plt d
         JOIN edoops.esp_job_cmnd_plt c ON d.appl_name = c.appl_name
         WHERE c.plt_name IN ${pltKeysSubquery}
         ORDER BY d.jobname`, [pltName])
        .then(r => r.rows.map((x: any) => ({ jobname: x.jobname, predecessor_job: x.predecessor_job }))), []),
    ]);

    res.json({
      appl_name: plt.platform_name,
      platform_id: platformId,
      job_count: jobCount, idle_job_count: idleCount, spl_job_count: splCount,
      agents, job_types: jobTypes, completion_codes: cmplCodes, user_jobs: accounts,
      job_list: jobList, job_run_trend: [],
      successor_jobs: successors, predecessor_jobs: predecessors, metadata: [],
    });
  } catch (err: any) {
    console.error('ESP platform-detail error:', err.message);
    res.status(500).json({ error: 'Query failed', details: err.message });
  }
});

// GET /api/esp/platform-run-trend/:platformId?days=N
router.get('/platform-run-trend/:platformId', async (req: Request, res: Response) => {
  try {
    const pool = getPgPool();
    const platformId = decodeURIComponent(req.params.platformId);
    const days = parseDays(req.query);
    console.log('[ESP] platform-run-trend → platformId:', platformId, 'days:', days);
    const plt = await getPlatformRow(platformId);
    if (!plt) return res.status(404).json({ error: 'Unknown platform' });
    const pltName = plt.platform_name;

    const result = await pool.query(`
      WITH base AS (
        SELECT s.end_date, s.end_time::time AS et, s.jobname, s.ccfail
        FROM edoops.esp_job_stats_recent_plt s
        JOIN edoops.esp_job_cmnd_plt c ON c.appl_name = s.appl_name AND c.jobname = s.job_longname
        WHERE c.plt_name IN ${pltKeysSubquery}
          AND s.end_date >= CURRENT_DATE - INTERVAL '${days} days'
      )
      SELECT
        end_date AS day,
        EXTRACT(HOUR FROM et)::int AS hour,
        COUNT(jobname)::int AS job_count,
        SUM(CASE WHEN ccfail = 'YES' THEN 1 ELSE 0 END)::int AS job_fail_count
      FROM base
      GROUP BY end_date, EXTRACT(HOUR FROM et)
      ORDER BY end_date, EXTRACT(HOUR FROM et)
    `, [pltName]);
    res.json(result.rows.map((r: any) => ({
      day:            r.day ? String(r.day).split('T')[0] : null,
      hour:           parseInt(r.hour, 10),
      job_count:      parseInt(r.job_count, 10),
      job_fail_count: parseInt(r.job_fail_count, 10),
    })));
  } catch (err: any) {
    res.status(500).json({ error: 'Query failed', details: err.message });
  }
});

// GET /api/esp/platform-metadata/:platformId
router.get('/platform-metadata/:platformId', async (req: Request, res: Response) => {
  try {
    const pool = getPgPool();
    const platformId = decodeURIComponent(req.params.platformId);
    console.log('[ESP] platform-metadata → platformId:', platformId);
    const plt = await getPlatformRow(platformId);
    if (!plt) return res.status(404).json({ error: 'Unknown platform' });
    const result = await pool.query(`
      SELECT jobname, command, argument, agent, jobtype AS job_type,
             esp_command AS comp_code, runs, user_job, appl_name
      FROM edoops.esp_job_cmnd_plt
      WHERE plt_name IN ${pltKeysSubquery}
      ORDER BY jobname
    `, [plt.platform_name]);
    res.json(result.rows.map((r: any) => ({
      jobname: r.jobname, command: r.command ?? null, argument: r.argument ?? null,
      agent: r.agent ?? null, job_type: r.job_type ?? null, comp_code: r.comp_code ?? null,
      runs: r.runs != null ? parseInt(r.runs, 10) : null,
      user_job: r.user_job ?? null, appl_name: r.appl_name ?? null,
    })));
  } catch (err: any) {
    res.status(500).json({ error: 'Query failed', details: err.message });
  }
});

// GET /api/esp/platform-job-run-table/:platformId?days=N
router.get('/platform-job-run-table/:platformId', async (req: Request, res: Response) => {
  try {
    const pool = getPgPool();
    const platformId = decodeURIComponent(req.params.platformId);
    const days = parseDays(req.query);
    console.log('[ESP] platform-job-run-table → platformId:', platformId, 'days:', days);
    const plt = await getPlatformRow(platformId);
    if (!plt) return res.status(404).json({ error: 'Unknown platform' });
    const result = await pool.query(`
      SELECT ec.appl_name, es.job_longname, ec.command, ec.argument, ec.runs,
             es.start_date, es.start_time, es.end_date, es.end_time,
             es.exec_qtime, es.ccfail, es.comp_code
      FROM edoops.esp_job_cmnd_plt ec
      JOIN edoops.esp_job_stats_recent_plt es
        ON ec.appl_name = es.appl_name AND ec.jobname = es.job_longname
      WHERE ec.plt_name IN ${pltKeysSubquery}
        AND es.end_date >= CURRENT_DATE - INTERVAL '${days} days'
      ORDER BY es.end_date DESC, es.end_time DESC
    `, [plt.platform_name]);
    res.json(result.rows.map((r: any) => ({
      job_longname: r.job_longname, command: r.command ?? null, argument: r.argument ?? null,
      runs: r.runs != null ? parseInt(r.runs, 10) : null,
      start_date: r.start_date ? String(r.start_date).split('T')[0] : null,
      start_time: r.start_time ?? null,
      end_date: r.end_date ? String(r.end_date).split('T')[0] : null,
      end_time: r.end_time ?? null,
      exec_qtime: r.exec_qtime ?? null, ccfail: r.ccfail ?? null, comp_code: r.comp_code ?? null,
      appl_name: r.appl_name ?? null,
    })));
  } catch (err: any) {
    res.status(500).json({ error: 'Query failed', details: err.message });
  }
});

// GET /api/esp/applications
// Returns all distinct appl_names with their canonical platform_id and plt_name
router.get('/applications', async (_req: Request, res: Response) => {
  try {
    const pool = getPgPool();
    const result = await pool.query(`
      WITH plt_ids AS (
        SELECT DISTINCT ON (plt_name) keys AS platform_id, plt_name
        FROM edoops.esp_plt_mapping
        ORDER BY plt_name, keys
      )
      SELECT DISTINCT ON (c.appl_name)
        c.appl_name,
        pi.platform_id,
        pi.plt_name AS platform_name
      FROM edoops.esp_job_cmnd_plt c
      LEFT JOIN plt_ids pi ON c.plt_name IN (SELECT keys FROM edoops.esp_plt_mapping WHERE plt_name = pi.plt_name)
      ORDER BY c.appl_name
    `);
    res.json({
      applications: result.rows.map((row: any) => ({
        appl_name:     row.appl_name,
        platform_id:   row.platform_id   ?? null,
        platform_name: row.platform_name ?? null,
      }))
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
      FROM edoops.esp_job_cmnd_plt
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
      FROM edoops.esp_job_cmnd_plt
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
      FROM   edoops.esp_job_cmnd_plt
      GROUP BY appl_name
      ORDER BY total_jobs DESC
    `);
    res.json({
      jobs_summary: result.rows.map((row: any) => ({
        appl_name: row.appl_name,
        total_jobs: parseInt(row.total_jobs, 10) || 0
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
      FROM edoops.esp_job_cmnd_plt
      WHERE last_run_date::timestamp < NOW() - INTERVAL '2 days'
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
      FROM edoops.esp_job_cmnd_plt
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
      SELECT jobtype AS job_type, COUNT(DISTINCT jobname) AS count
      FROM edoops.esp_job_cmnd_plt
      GROUP BY jobtype
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

// GET /api/esp/user-jobs
router.get('/user-jobs', async (_req: Request, res: Response) => {
  try {
    const pool = getPgPool();
    const result = await pool.query(`
      SELECT COALESCE(user_job, 'Null') AS user_job, COUNT(DISTINCT jobname) AS count
      FROM edoops.esp_job_cmnd_plt
      GROUP BY user_job
      ORDER BY count DESC
    `);
    res.json({
      user_jobs: result.rows.map((row: any) => ({
        user_job: row.user_job,
        count: row.count
      }))
    });
  } catch (err: any) {
    console.error('ESP user-jobs error:', err.message);
    res.status(500).json({ error: 'Query failed', details: err.message });
  }
});

// GET /api/esp/metadata/:appl_name
// Full metadata from edoops.esp_job_cmnd_plt: jobname, command, argument, agent, jobtype, comp_code, runs, user_job
router.get('/metadata/:appl_name', async (req: Request, res: Response) => {
  try {
    const pool = getPgPool();
    const appl_name = decodeURIComponent(req.params.appl_name);
    const result = await pool.query(
      `SELECT jobname,
              command,
              argument,
              agent,
              jobtype AS job_type,
              esp_command AS comp_code,
              runs,
              user_job
      FROM edoops.esp_job_cmnd_plt
       WHERE appl_name = $1
       ORDER BY jobname`,

      [appl_name]
    );
    res.json(result.rows.map((r: any) => ({
      jobname:    r.jobname,
      command:    r.command   ?? null,
      argument:   r.argument  ?? null,
      agent:      r.agent     ?? null,
      job_type:   r.job_type  ?? null,
      comp_code:  r.comp_code ?? null,
      runs:       r.runs != null ? parseInt(r.runs, 10) : null,
      user_job:   r.user_job  ?? null,
    })));
  } catch (err: any) {
    console.error('ESP metadata error:', err.message);
    res.status(500).json({ error: 'Query failed', details: err.message });
  }
});

// GET /api/esp/job-run-table/:appl_name?days=N
// Joins edoops.esp_job_cmnd_plt + edoops.esp_job_stats_recent_plt for detailed run records
router.get('/job-run-table/:appl_name', async (req: Request, res: Response) => {
  try {
    const pool = getPgPool();
    const appl_name = decodeURIComponent(req.params.appl_name);
    const days = parseDays(req.query);
    console.log('[ESP] job-run-table → appl_name:', appl_name, 'days:', days);
    const result = await pool.query(
      `SELECT ec.appl_name,
              es.job_longname,
              ec.command,
              ec.argument,
              ec.runs,
              es.start_date,
              es.start_time,
              es.end_date,
              es.end_time,
              es.exec_qtime,
              es.ccfail,
              es.comp_code
      FROM edoops.esp_job_cmnd_plt ec
      JOIN edoops.esp_job_stats_recent_plt es
         ON ec.appl_name = es.appl_name
        AND ec.jobname   = es.job_longname
       WHERE ec.appl_name = $1
        AND es.end_date >= CURRENT_DATE - INTERVAL '${days} days'
       ORDER BY es.end_date DESC, es.end_time DESC`,
      [appl_name]
    );
    res.json(result.rows.map((r: any) => ({
      job_longname: r.job_longname,
      command:      r.command    ?? null,
      argument:     r.argument   ?? null,
      runs:         r.runs != null ? parseInt(r.runs, 10) : null,
      start_date:   r.start_date ? String(r.start_date).split('T')[0] : null,
      start_time:   r.start_time ?? null,
      end_date:     r.end_date   ? String(r.end_date).split('T')[0]   : null,
      end_time:     r.end_time   ?? null,
      exec_qtime:   r.exec_qtime ?? null,
      ccfail:       r.ccfail     ?? null,
      comp_code:    r.comp_code  ?? null,
    })));
  } catch (err: any) {
    console.error('ESP job-run-table error:', err.message);
    res.status(500).json({ error: 'Query failed', details: err.message });
  }
});

// GET /api/esp/job-run-trend/:appl_name?days=N
// Uses edoops.esp_job_stats_recent_plt (end_time, end_date, jobname, ccfail)
router.get('/job-run-trend/:appl_name', async (req: Request, res: Response) => {
  try {
    const pool = getPgPool();
    const appl_name = decodeURIComponent(req.params.appl_name);
    const days = parseDays(req.query);
    console.log('[ESP] job-run-trend → appl_name:', appl_name, 'days:', days);

    const result = await pool.query(
      `WITH base AS (
         SELECT
           end_date,
           end_time::time AS et,
           jobname,
           ccfail
         FROM edoops.esp_job_stats_recent_plt
         WHERE appl_name = $1
           AND end_date >= CURRENT_DATE - INTERVAL '${days} days'
       )
       SELECT
         end_date                                               AS day,
         EXTRACT(HOUR FROM et)::int                            AS hour,
         COUNT(jobname)::int                                   AS job_count,
         SUM(CASE WHEN ccfail = 'YES' THEN 1 ELSE 0 END)::int AS job_fail_count
       FROM base
       GROUP BY end_date, EXTRACT(HOUR FROM et)
       ORDER BY end_date, EXTRACT(HOUR FROM et)`,
      [appl_name]
    );

    res.json(result.rows.map((r: any) => ({
      day:            r.day ? String(r.day).split('T')[0] : null,
      hour:           parseInt(r.hour, 10),
      job_count:      parseInt(r.job_count, 10),
      job_fail_count: parseInt(r.job_fail_count, 10),
    })));
  } catch (err: any) {
    console.error('ESP job-run-trend error:', err.message);
    res.status(500).json({ error: 'Query failed', details: err.message });
  }
});

// GET /api/esp/run-trend-by-job/:jobname?days=N
// Returns hourly run/fail counts for a single job across all applications
router.get('/run-trend-by-job/:jobname', async (req: Request, res: Response) => {
  try {
    const pool = getPgPool();
    const jobname = decodeURIComponent(req.params.jobname);
    const days = parseDays(req.query);
    console.log('[ESP] run-trend-by-job → jobname:', jobname, 'days:', days);

    const result = await pool.query(
      `WITH base AS (
         SELECT
           end_date,
           end_time::time AS et,
           job_longname,
           ccfail
         FROM edoops.esp_job_stats_recent_plt
         WHERE job_longname = $1
           AND end_date >= CURRENT_DATE - INTERVAL '${days} days'
       )
       SELECT
         end_date                                               AS day,
         EXTRACT(HOUR FROM et)::int                            AS hour,
         COUNT(job_longname)::int                              AS job_count,
         SUM(CASE WHEN ccfail = 'YES' THEN 1 ELSE 0 END)::int AS job_fail_count
       FROM base
       GROUP BY end_date, EXTRACT(HOUR FROM et)
       ORDER BY end_date, EXTRACT(HOUR FROM et)`,
      [jobname]
    );

    res.json(result.rows.map((r: any) => ({
      day:            r.day ? String(r.day).split('T')[0] : null,
      hour:           parseInt(r.hour, 10),
      job_count:      parseInt(r.job_count, 10),
      job_fail_count: parseInt(r.job_fail_count, 10),
    })));
  } catch (err: any) {
    console.error('ESP run-trend-by-job error:', err.message);
    res.status(500).json({ error: 'Query failed', details: err.message });
  }
});

// GET /api/esp/run-trend-by-appl-job?appl_name=X&field=agent|job_type|user_job&value=Y&days=N
// Returns hourly run/fail counts for all jobs matching a widget-filter dimension within an app/platform
router.get('/run-trend-by-dimension', async (req: Request, res: Response) => {
  try {
    const pool = getPgPool();
    const field = String(req.query.field ?? '');
    const value = String(req.query.value ?? '');
    const rawDays = parseInt(String(req.query.days ?? '2'), 10);
    const days = Math.min(Math.max(rawDays, 1), ESP_MAX_DAYS);

    const ALLOWED_FIELDS: Record<string, string> = { agent: 'agent', job_type: 'jobtype', user_job: 'user_job' };
    const col = ALLOWED_FIELDS[field];
    if (!col) return res.status(400).json({ error: 'Invalid field' });

    const safeValue = value === 'Null' ? null : value;
    const whereClause = safeValue === null
      ? `ec.${col} IS NULL`
      : `ec.${col} = $2`;
    const params: any[] = safeValue === null ? [days] : [days, safeValue];

    const result = await pool.query(
      `WITH base AS (
         SELECT
           es.end_date,
           es.end_time::time AS et,
           es.job_longname,
           es.ccfail
         FROM edoops.esp_job_stats_recent_plt es
         JOIN edoops.esp_job_cmnd_plt ec ON ec.appl_name = es.appl_name AND ec.jobname = es.job_longname
         WHERE ${whereClause}
           AND es.end_date >= CURRENT_DATE - INTERVAL '$1 days'
       )
       SELECT
         end_date                                               AS day,
         EXTRACT(HOUR FROM et)::int                            AS hour,
         COUNT(job_longname)::int                              AS job_count,
         SUM(CASE WHEN ccfail = 'YES' THEN 1 ELSE 0 END)::int AS job_fail_count
       FROM base
       GROUP BY end_date, EXTRACT(HOUR FROM et)
       ORDER BY end_date, EXTRACT(HOUR FROM et)`,
      params
    );

    res.json(result.rows.map((r: any) => ({
      day:            r.day ? String(r.day).split('T')[0] : null,
      hour:           parseInt(r.hour, 10),
      job_count:      parseInt(r.job_count, 10),
      job_fail_count: parseInt(r.job_fail_count, 10),
    })));
  } catch (err: any) {
    console.error('ESP run-trend-by-dimension error:', err.message);
    res.status(500).json({ error: 'Query failed', details: err.message });
  }
});

// GET /api/esp/job-run-trend  (legacy — no appl_name, kept for compat)
router.get('/job-run-trend', async (_req: Request, res: Response) => {
  try {
    const pool = getPgPool();
    // Example: jobs run per hour for last 2 days
    const result = await pool.query(`
      SELECT DATE_TRUNC('hour', last_run_date) AS hour, COUNT(*) AS count
      FROM edoops.esp_job_cmnd_plt
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
// GET /api/esp/summary/:appl_name?days=N  — all widget data for one application
router.get('/summary/:appl_name', async (req: Request, res: Response) => {
  try {
    const pool = getPgPool();
    const appl_name = decodeURIComponent(req.params.appl_name);
    const days = parseDays(req.query);
    console.log('[ESP] summary → appl_name:', appl_name, 'days:', days);

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
        `SELECT COUNT(DISTINCT jobname) AS cnt FROM edoops.esp_job_cmnd_plt WHERE appl_name = $1`,
        [appl_name]).then(r => parseInt(r.rows[0]?.cnt || '0', 10)), 0),

      safe(() => pool.query(
        `SELECT COUNT(DISTINCT jobname) AS cnt FROM edoops.esp_job_cmnd_plt WHERE appl_name = $1 AND (last_run_date IS NULL OR last_run_date::timestamp < NOW() - INTERVAL '2 days')`,
        [appl_name]).then(r => parseInt(r.rows[0]?.cnt || '0', 10)), 0),

      safe(() => pool.query(
        `SELECT COUNT(DISTINCT jobname) AS cnt FROM edoops.esp_job_cmnd_plt WHERE appl_name = $1 AND (jobname LIKE '%JSDELAY%' OR jobname LIKE '%RETRIG%')`,
        [appl_name]).then(r => parseInt(r.rows[0]?.cnt || '0', 10)), 0),

      safe(() => pool.query(
        `SELECT COALESCE(agent, 'Null') AS name, COUNT(*) AS count FROM edoops.esp_job_cmnd_plt WHERE appl_name = $1 GROUP BY agent ORDER BY count DESC`,
        [appl_name]).then(r => r.rows.map((x: any) => ({ name: x.name, count: parseInt(x.count) }))), []),

      safe(() => pool.query(
        `SELECT COALESCE(jobtype, 'Null') AS name, COUNT(*) AS count FROM edoops.esp_job_cmnd_plt WHERE appl_name = $1 GROUP BY jobtype ORDER BY count DESC`,
        [appl_name]).then(r => r.rows.map((x: any) => ({ name: x.name, count: parseInt(x.count) }))), []),

      safe(() => pool.query(
        `SELECT COALESCE(CAST(cmpl_cd AS TEXT), 'Null') AS name, COUNT(*) AS count FROM edoops.esp_job_cmnd_plt WHERE appl_name = $1 GROUP BY cmpl_cd ORDER BY count DESC`,
        [appl_name]).then(r => r.rows.map((x: any) => ({ name: x.name, count: parseInt(x.count) }))), []),

      safe(() => pool.query(
        `SELECT COALESCE(user_job, 'Null') AS name, COUNT(*) AS count FROM edoops.esp_job_cmnd_plt WHERE appl_name = $1 GROUP BY user_job ORDER BY count DESC`,
        [appl_name]).then(r => r.rows.map((x: any) => ({ name: x.name, count: parseInt(x.count) }))), []),

      safe(() => pool.query(
        `SELECT
            c.jobname,
            c.jobtype AS job_type,
            c.last_run_date,
            CASE
              WHEN latest.ccfail = 'YES' THEN 'FAILED'
              WHEN latest.ccfail = 'NO' THEN 'SUCCESS'
              WHEN c.last_run_date IS NULL THEN 'NEVER RUN'
              ELSE 'UNKNOWN'
            END AS run_status
         FROM edoops.esp_job_cmnd_plt c
         LEFT JOIN LATERAL (
           SELECT s.ccfail
           FROM edoops.esp_job_stats_recent_plt s
           WHERE s.appl_name = c.appl_name
             AND s.job_longname = c.jobname
           ORDER BY s.end_date DESC NULLS LAST, s.end_time DESC NULLS LAST, s.start_date DESC NULLS LAST, s.start_time DESC NULLS LAST
           LIMIT 1
         ) latest ON true
         WHERE c.appl_name = $1
         ORDER BY c.last_run_date DESC NULLS LAST, c.jobname`,
        [appl_name]).then(r => r.rows.map((x: any) => ({ jobname: x.jobname, job_type: x.job_type ?? null, last_run_date: x.last_run_date, run_status: x.run_status ?? null }))), []),

      safe(() => pool.query(
        `SELECT DATE(last_run_date::timestamp) AS day, EXTRACT(HOUR FROM last_run_date::timestamp)::int AS hour, COUNT(*)::int AS count
         FROM edoops.esp_job_cmnd_plt WHERE appl_name = $1 AND last_run_date >= NOW() - INTERVAL '${days} days'
         GROUP BY DATE(last_run_date::timestamp), EXTRACT(HOUR FROM last_run_date::timestamp) ORDER BY DATE(last_run_date::timestamp), EXTRACT(HOUR FROM last_run_date::timestamp)`,
        [appl_name]).then(r => r.rows.map((x: any) => ({ day: String(x.day), hour: parseInt(x.hour), count: parseInt(x.count) }))), []),

      safe(() => pool.query(
        `SELECT jobname, release AS successor_job FROM edoops.esp_job_dpndnt_plt WHERE appl_name = $1 ORDER BY jobname`,
        [appl_name]).then(r => r.rows.map((x: any) => ({ jobname: x.jobname, successor_job: x.successor_job }))), []),

      safe(() => pool.query(
        `SELECT jobname, release AS predecessor_job FROM edoops.esp_job_dpndnt_plt WHERE release = $1 ORDER BY jobname`,
        [appl_name]).then(r => r.rows.map((x: any) => ({ jobname: x.jobname, predecessor_job: x.predecessor_job }))), []),

      safe(() => pool.query(
        `SELECT jobname, command, argument FROM edoops.esp_job_cmnd_plt WHERE appl_name = $1 ORDER BY jobname`,
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
      user_jobs: accounts,
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
      SELECT DISTINCT appl_name FROM edoops.esp_job_cmnd_plt ORDER BY appl_name
    `);
    const applNames = appsResult.rows.map((row: any) => row.appl_name);

    // For each appl_id, get counts and trend
    const summary = [];
    for (const appl_name of applNames) {
      // Job count
      const jobCountResult = await pool.query(`
        SELECT COUNT(DISTINCT jobname) AS job_count FROM edoops.esp_job_cmnd_plt WHERE appl_name = $1
      `, [appl_name]);
      const job_count = parseInt(jobCountResult.rows[0]?.job_count || '0', 10);

      // Idle job count (not run in last 2 days)
      const idleJobResult = await pool.query(`
        SELECT COUNT(DISTINCT jobname) AS idle_job_count FROM edoops.esp_job_cmnd_plt WHERE appl_name = $1 AND last_run_date::timestamp < NOW() - INTERVAL '2 days'
      `, [appl_name]);
      const idle_job_count = parseInt(idleJobResult.rows[0]?.idle_job_count || '0', 10);

      // Special job count
      const splJobResult = await pool.query(`
        SELECT COUNT(DISTINCT jobname) AS spl_job_count FROM edoops.esp_job_cmnd_plt WHERE appl_name = $1 AND (jobname LIKE '%JSDDELAY%' OR jobname LIKE '%RETRIG%')
      `, [appl_name]);
      const spl_job_count = parseInt(splJobResult.rows[0]?.spl_job_count || '0', 10);

      // Account (first account found for this appl_name)
      const accountResult = await pool.query(`
        SELECT account FROM edoops.esp_job_cmnd_plt WHERE appl_name = $1 LIMIT 1
      `, [appl_name]);
      const account = accountResult.rows[0]?.account || null;

      // Job run trend (last 2 days, jobs per hour)
      const trendResult = await pool.query(`
        SELECT DATE_TRUNC('hour', last_run_date) AS hour, COUNT(*) AS count
        FROM edoops.esp_job_cmnd_plt
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
