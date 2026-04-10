
/**
 * ESP routes — queries against PostgreSQL edoops ESP tables
 */
import { Router, Request, Response } from 'express';
import { getPgPool } from '../db/postgres';

const router = Router();

// ─── Platform groupings (wildcards match appl_name) ───────
// includes: trailing '*' → LIKE prefix; exact otherwise
// exclusions: same pattern — rows matching these are excluded
interface PlatformDef { includes: string[]; exclusions: string[] }
const PLATFORM_CONFIG: Record<string, PlatformDef> = {
  /* 'PowerCenter': {
    includes:   ['ERDP*'],
    exclusions: [],
  },
  'Abinitio': {
    includes:   ['DTDPL3*'],
    exclusions: [],
  },
  'EDL': {
    includes:   ['DTDPL*', 'DTDPCF24', 'DTDPIAM', 'DTDPPART', 'DTDPSFAR', 'DTDPSRA2', 'DTDPTMWD', 'SJDPSFDC', 'SJDFSCR', 'SJDP15RT'],
    exclusions: ['DTDPLCMN', 'DTDPLCRN', 'DTDPLXNX', 'DTDPLBP', 'DTDPLCR', 'DTDPLDC', 'DTDPLKDZ', 'DTDPLMK', 'DTDPLOS', 'DTDPLXNR', 'DTDPLMTV', 'DTDPL3*'],
  },
  'IICS/SF': {
    includes:   ['DTDPCF24', 'DTDPIAM', 'DTDPPART', 'DTDPSFAR', 'DTDPSRA2', 'DTDPTMWD', 'SJDPSFDC', 'SJDFSCR', 'SJDP15RT', 'DTDPLXNR', 'DTDPLMTV', 'DTDPL3*'],
    exclusions: ['DTDPWLT', 'DTDPAZM1'],
  } ,*/
  'Talend': {
    includes:   ['SFDPI*', 'SFDPE*', 'SFDPD*'],
    exclusions: [],
  },
  'PPCM': {
    includes:   ['DTDP36PM'],
    exclusions: [],
  },
  'PDA': {
    includes:   ['DTDP37PD'],
    exclusions: [],
  },
  'Permissible Call': {
    includes:   ['DTDP33TA', 'TZDP05EU'],
    exclusions: [],
  },
};

/**
 * Builds a SQL boolean expression for a platform's include+exclusion rules.
 * Operates on appl_name. All values come from server-side config — never user input.
 */
function buildPlatformCondition(def: PlatformDef, col = 'appl_name'): string {
  const toSql = (pat: string, negate = false): string => {
    if (pat.endsWith('*')) {
      const prefix = pat.slice(0, -1).replace(/'/g, "''");
      return negate ? `${col} NOT LIKE '${prefix}%'` : `${col} LIKE '${prefix}%'`;
    }
    const val = pat.replace(/'/g, "''");
    return negate ? `${col} <> '${val}'` : `${col} = '${val}'`;
  };
  const includes = def.includes.map(p => toSql(p, false));
  const excludes = def.exclusions.map(p => toSql(p, true));
  const includeSql = includes.length === 1 ? includes[0] : `(${includes.join(' OR ')})`;
  return excludes.length > 0
    ? `(${includeSql} AND ${excludes.join(' AND ')})`
    : `(${includeSql})`;
}

// GET /api/esp/platform-summary
// Returns per-platform totals+idle+special job counts for KPI cards
router.get('/platform-summary', async (_req: Request, res: Response) => {
  try {
    const pool = getPgPool();
    const results = await Promise.all(
      Object.entries(PLATFORM_CONFIG).map(async ([name, def]) => {
        const cond = buildPlatformCondition(def);
        const safe = async <T>(fn: () => Promise<T>, fallback: T): Promise<T> => {
          try { return await fn(); } catch { return fallback; }
        };
        const [total, idle, special, app_count] = await Promise.all([
          safe(() => pool.query(`SELECT COUNT(DISTINCT jobname) AS cnt FROM edoops.esp_job_cmnd WHERE ${cond}`)
            .then(r => parseInt(r.rows[0]?.cnt || '0', 10)), 0),
          safe(() => pool.query(`SELECT COUNT(DISTINCT jobname) AS cnt FROM edoops.esp_job_cmnd WHERE ${cond} AND (last_run_date IS NULL OR last_run_date < NOW() - INTERVAL '2 days')`)
            .then(r => parseInt(r.rows[0]?.cnt || '0', 10)), 0),
          safe(() => pool.query(`SELECT COUNT(DISTINCT jobname) AS cnt FROM edoops.esp_job_cmnd WHERE ${cond} AND (jobname LIKE '%JSDELAY%' OR jobname LIKE '%RETRIG%')`)
            .then(r => parseInt(r.rows[0]?.cnt || '0', 10)), 0),
          safe(() => pool.query(`SELECT COUNT(DISTINCT appl_name) AS cnt FROM edoops.esp_job_cmnd WHERE ${cond}`)
            .then(r => parseInt(r.rows[0]?.cnt || '0', 10)), 0),
        ]);
        return { platform: name, total, idle, special, app_count };
      })
    );
    res.json(results);
  } catch (err: any) {
    res.status(500).json({ error: 'Query failed', details: err.message });
  }
});

// GET /api/esp/platform-applications/:platform
// Returns distinct appl_name values matching the platform config (for qualifiers display)
router.get('/platform-applications/:platform', async (req: Request, res: Response) => {
  try {
    const pool = getPgPool();
    const platformName = decodeURIComponent(req.params.platform);
    console.log('[ESP] platform-applications → platform:', platformName);
    const def = PLATFORM_CONFIG[platformName];
    if (!def) return res.status(404).json({ error: 'Unknown platform' });
    const cond = buildPlatformCondition(def);
    const result = await pool.query(
      `SELECT DISTINCT appl_name FROM edoops.esp_job_cmnd WHERE ${cond} ORDER BY appl_name`
    );
    res.json(result.rows.map((r: any) => r.appl_name));
  } catch (err: any) {
    res.status(500).json({ error: 'Query failed', details: err.message });
  }
});

// GET /api/esp/platform-detail/:platform
// Same shape as /summary/:appl_name but aggregated across all appl_names in the platform group
router.get('/platform-detail/:platform', async (req: Request, res: Response) => {
  try {
    const pool = getPgPool();
    const platformName = decodeURIComponent(req.params.platform);
    console.log('[ESP] platform-detail → platform:', platformName);
    const def = PLATFORM_CONFIG[platformName];
    if (!def) return res.status(404).json({ error: 'Unknown platform' });
    const cond = buildPlatformCondition(def);

    const safe = async <T>(fn: () => Promise<T>, fallback: T): Promise<T> => {
      try { return await fn(); } catch (e: any) {
        console.warn(`ESP platform query skipped (${e.message?.slice(0, 60)})`);
        return fallback;
      }
    };

    const [jobCount, idleCount, splCount, agents, jobTypes, cmplCodes, accounts, jobList, successors, predecessors] = await Promise.all([
      safe(() => pool.query(`SELECT COUNT(DISTINCT jobname) AS cnt FROM edoops.esp_job_cmnd WHERE ${cond}`)
        .then(r => parseInt(r.rows[0]?.cnt || '0', 10)), 0),
      safe(() => pool.query(`SELECT COUNT(DISTINCT jobname) AS cnt FROM edoops.esp_job_cmnd WHERE ${cond} AND (last_run_date IS NULL OR last_run_date < NOW() - INTERVAL '2 days')`)
        .then(r => parseInt(r.rows[0]?.cnt || '0', 10)), 0),
      safe(() => pool.query(`SELECT COUNT(DISTINCT jobname) AS cnt FROM edoops.esp_job_cmnd WHERE ${cond} AND (jobname LIKE '%JSDELAY%' OR jobname LIKE '%RETRIG%')`)
        .then(r => parseInt(r.rows[0]?.cnt || '0', 10)), 0),
      safe(() => pool.query(`SELECT COALESCE(agent, 'Null') AS name, COUNT(*) AS count FROM edoops.esp_job_cmnd WHERE ${cond} GROUP BY agent ORDER BY count DESC`)
        .then(r => r.rows.map((x: any) => ({ name: x.name, count: parseInt(x.count) }))), []),
      safe(() => pool.query(`SELECT COALESCE(jobtype, 'Null') AS name, COUNT(*) AS count FROM edoops.esp_job_cmnd WHERE ${cond} GROUP BY jobtype ORDER BY count DESC`)
        .then(r => r.rows.map((x: any) => ({ name: x.name, count: parseInt(x.count) }))), []),
      safe(() => pool.query(`SELECT COALESCE(CAST(cmpl_cd AS TEXT), 'Null') AS name, COUNT(*) AS count FROM edoops.esp_job_cmnd WHERE ${cond} GROUP BY cmpl_cd ORDER BY count DESC`)
        .then(r => r.rows.map((x: any) => ({ name: x.name, count: parseInt(x.count) }))), []),
      safe(() => pool.query(`SELECT COALESCE(user_job, 'Null') AS name, COUNT(*) AS count FROM edoops.esp_job_cmnd WHERE ${cond} GROUP BY user_job ORDER BY count DESC`)
        .then(r => r.rows.map((x: any) => ({ name: x.name, count: parseInt(x.count) }))), []),
      safe(() => pool.query(`SELECT jobname, appl_name, last_run_date FROM edoops.esp_job_cmnd WHERE ${cond} ORDER BY jobname`)
        .then(r => r.rows.map((x: any) => ({ jobname: x.jobname, appl_name: x.appl_name, last_run_date: x.last_run_date }))), []),
      safe(() => pool.query(`SELECT d.jobname, d.release AS successor_job FROM edoops.esp_job_dpndnt d JOIN edoops.esp_job_cmnd c ON d.appl_name = c.appl_name WHERE ${buildPlatformCondition(def, 'c.appl_name')} ORDER BY d.jobname`)
        .then(r => r.rows.map((x: any) => ({ jobname: x.jobname, successor_job: x.successor_job }))), []),
      safe(() => pool.query(`SELECT d.jobname, d.release AS predecessor_job FROM edoops.esp_job_dpndnt d WHERE d.release IN (SELECT DISTINCT appl_name FROM edoops.esp_job_cmnd WHERE ${cond}) ORDER BY d.jobname`)
        .then(r => r.rows.map((x: any) => ({ jobname: x.jobname, predecessor_job: x.predecessor_job }))), []),
    ]);

    res.json({
      appl_name: platformName,
      job_count: jobCount,
      idle_job_count: idleCount,
      spl_job_count: splCount,
      agents, job_types: jobTypes, completion_codes: cmplCodes, user_jobs: accounts,
      job_list: jobList, job_run_trend: [], successor_jobs: successors, predecessor_jobs: predecessors, metadata: [],
    });
  } catch (err: any) {
    console.error('ESP platform-detail error:', err.message);
    res.status(500).json({ error: 'Query failed', details: err.message });
  }
});

// GET /api/esp/platform-run-trend/:platform?days=N
router.get('/platform-run-trend/:platform', async (req: Request, res: Response) => {
  try {
    const pool = getPgPool();
    const platformName = decodeURIComponent(req.params.platform);
    const def = PLATFORM_CONFIG[platformName];
    if (!def) return res.status(404).json({ error: 'Unknown platform' });
    const cond = buildPlatformCondition(def);
    const rawDays = parseInt(String(req.query.days ?? '2'), 10);
    const days = Math.min(Math.max(rawDays, 1), 7);
    console.log('[ESP] platform-run-trend → platform:', platformName, '| days:', days);

    const result = await pool.query(`
      WITH base AS (
        SELECT
          end_date,
          end_time::time AS et,
          s.jobname,
          s.ccfail
        FROM edoops.esp_job_stats_recent s
        JOIN edoops.esp_job_cmnd c ON c.appl_name = s.appl_name AND c.jobname = s.job_longname
        WHERE ${buildPlatformCondition(def, 'c.appl_name')}
          AND end_date >= CURRENT_DATE - INTERVAL '${days} days'
      )
      SELECT
        end_date AS day,
        EXTRACT(HOUR FROM et)::int AS hour,
        COUNT(jobname)::int AS job_count,
        SUM(CASE WHEN ccfail = 'YES' THEN 1 ELSE 0 END)::int AS job_fail_count
      FROM base
      GROUP BY end_date, EXTRACT(HOUR FROM et)
      ORDER BY end_date, EXTRACT(HOUR FROM et)
    `);
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

// GET /api/esp/platform-metadata/:platform
router.get('/platform-metadata/:platform', async (req: Request, res: Response) => {
  try {
    const pool = getPgPool();
    const platformName = decodeURIComponent(req.params.platform);
    console.log('[ESP] platform-metadata → platform:', platformName);
    const def = PLATFORM_CONFIG[platformName];
    if (!def) return res.status(404).json({ error: 'Unknown platform' });
    const cond = buildPlatformCondition(def);
    const result = await pool.query(`
      SELECT jobname, command, argument, agent, jobtype AS job_type, esp_command AS comp_code, runs, user_job, appl_name
      FROM edoops.esp_job_cmnd
      WHERE ${cond}
      ORDER BY jobname
    `);
    res.json(result.rows.map((r: any) => ({
      jobname: r.jobname, command: r.command ?? null, argument: r.argument ?? null,
      agent: r.agent ?? null, job_type: r.job_type ?? null, comp_code: r.comp_code ?? null,
      runs: r.runs != null ? parseInt(r.runs, 10) : null, user_job: r.user_job ?? null, appl_name: r.appl_name ?? null,
    })));
  } catch (err: any) {
    res.status(500).json({ error: 'Query failed', details: err.message });
  }
});

// GET /api/esp/platform-job-run-table/:platform
router.get('/platform-job-run-table/:platform', async (req: Request, res: Response) => {
  try {
    const pool = getPgPool();
    const platformName = decodeURIComponent(req.params.platform);
    console.log('[ESP] platform-job-run-table → platform:', platformName);
    const def = PLATFORM_CONFIG[platformName];
    if (!def) return res.status(404).json({ error: 'Unknown platform' });
    const cond = buildPlatformCondition(def, 'ec.appl_name');
    const result = await pool.query(`
      SELECT ec.appl_name, es.job_longname, ec.command, ec.argument, ec.runs,
             es.start_date, es.start_time, es.end_date, es.end_time,
             es.exec_qtime, es.ccfail, es.comp_code
      FROM edoops.esp_job_cmnd ec
      JOIN edoops.esp_job_stats_recent es ON ec.appl_name = es.appl_name AND ec.jobname = es.job_longname
      WHERE ${cond}
      ORDER BY es.end_date DESC, es.end_time DESC
    `);
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
router.get('/applications', async (_req: Request, res: Response) => {
  try {
    const pool = getPgPool();
    const result = await pool.query(`
      SELECT DISTINCT appl_name
      FROM edoops.esp_job_cmnd
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
      FROM edoops.esp_job_cmnd
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
      FROM edoops.esp_job_cmnd
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
      FROM   edoops.esp_job_cmnd
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
      FROM edoops.esp_job_cmnd
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
      FROM edoops.esp_job_cmnd
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
      FROM edoops.esp_job_cmnd
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
      FROM edoops.esp_job_cmnd
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
// Full metadata from edoops.esp_job_cmnd: jobname, command, argument, agent, jobtype, comp_code, runs, user_job
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
      FROM edoops.esp_job_cmnd
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

// GET /api/esp/job-run-table/:appl_name
// Joins edoops.esp_job_cmnd + edoops.esp_job_stats_recent for detailed run records
router.get('/job-run-table/:appl_name', async (req: Request, res: Response) => {
  try {
    const pool = getPgPool();
    const appl_name = decodeURIComponent(req.params.appl_name);
    console.log('[ESP] job-run-table → appl_name:', appl_name);
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
      FROM edoops.esp_job_cmnd ec
      JOIN edoops.esp_job_stats_recent es
         ON ec.appl_name = es.appl_name
        AND ec.jobname   = es.job_longname
       WHERE ec.appl_name = $1
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
// Uses edoops.esp_job_stats_recent (end_time, end_date, jobname, ccfail)
router.get('/job-run-trend/:appl_name', async (req: Request, res: Response) => {
  try {
    const pool = getPgPool();
    const appl_name = decodeURIComponent(req.params.appl_name);
    const rawDays = parseInt(String(req.query.days ?? '2'), 10);
    const days = Math.min(Math.max(rawDays, 1), 7);
    console.log('[ESP] job-run-trend → appl_name:', appl_name, '| days:', days);

    const result = await pool.query(
      `WITH base AS (
         SELECT
           end_date,
           end_time::time AS et,
           jobname,
           ccfail
         FROM edoops.esp_job_stats_recent
         WHERE appl_name = $1
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
    const rawDays = parseInt(String(req.query.days ?? '2'), 10);
    const days = Math.min(Math.max(rawDays, 1), 7);
    console.log('[ESP] run-trend-by-job → jobname:', jobname, '| days:', days);

    const result = await pool.query(
      `WITH base AS (
         SELECT
           end_date,
           end_time::time AS et,
           job_longname,
           ccfail
         FROM edoops.esp_job_stats_recent
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
    const days = Math.min(Math.max(rawDays, 1), 7);

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
         FROM edoops.esp_job_stats_recent es
         JOIN edoops.esp_job_cmnd ec ON ec.appl_name = es.appl_name AND ec.jobname = es.job_longname
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
      FROM edoops.esp_job_cmnd
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
    console.log('[ESP] summary → appl_name:', appl_name);

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
        `SELECT COUNT(DISTINCT jobname) AS cnt FROM edoops.esp_job_cmnd WHERE appl_name = $1`,
        [appl_name]).then(r => parseInt(r.rows[0]?.cnt || '0', 10)), 0),

      safe(() => pool.query(
        `SELECT COUNT(DISTINCT jobname) AS cnt FROM edoops.esp_job_cmnd WHERE appl_name = $1 AND (last_run_date IS NULL OR last_run_date < NOW() - INTERVAL '2 days')`,
        [appl_name]).then(r => parseInt(r.rows[0]?.cnt || '0', 10)), 0),

      safe(() => pool.query(
        `SELECT COUNT(DISTINCT jobname) AS cnt FROM edoops.esp_job_cmnd WHERE appl_name = $1 AND (jobname LIKE '%JSDELAY%' OR jobname LIKE '%RETRIG%')`,
        [appl_name]).then(r => parseInt(r.rows[0]?.cnt || '0', 10)), 0),

      safe(() => pool.query(
        `SELECT COALESCE(agent, 'Null') AS name, COUNT(*) AS count FROM edoops.esp_job_cmnd WHERE appl_name = $1 GROUP BY agent ORDER BY count DESC`,
        [appl_name]).then(r => r.rows.map((x: any) => ({ name: x.name, count: parseInt(x.count) }))), []),

      safe(() => pool.query(
        `SELECT COALESCE(jobtype, 'Null') AS name, COUNT(*) AS count FROM edoops.esp_job_cmnd WHERE appl_name = $1 GROUP BY jobtype ORDER BY count DESC`,
        [appl_name]).then(r => r.rows.map((x: any) => ({ name: x.name, count: parseInt(x.count) }))), []),

      safe(() => pool.query(
        `SELECT COALESCE(CAST(cmpl_cd AS TEXT), 'Null') AS name, COUNT(*) AS count FROM edoops.esp_job_cmnd WHERE appl_name = $1 GROUP BY cmpl_cd ORDER BY count DESC`,
        [appl_name]).then(r => r.rows.map((x: any) => ({ name: x.name, count: parseInt(x.count) }))), []),

      safe(() => pool.query(
        `SELECT COALESCE(user_job, 'Null') AS name, COUNT(*) AS count FROM edoops.esp_job_cmnd WHERE appl_name = $1 GROUP BY user_job ORDER BY count DESC`,
        [appl_name]).then(r => r.rows.map((x: any) => ({ name: x.name, count: parseInt(x.count) }))), []),

      safe(() => pool.query(
        `SELECT jobname, last_run_date FROM edoops.esp_job_cmnd WHERE appl_name = $1 ORDER BY jobname`,
        [appl_name]).then(r => r.rows.map((x: any) => ({ jobname: x.jobname, last_run_date: x.last_run_date }))), []),

      safe(() => pool.query(
        `SELECT DATE(last_run_date::timestamp) AS day, EXTRACT(HOUR FROM last_run_date::timestamp)::int AS hour, COUNT(*)::int AS count
         FROM edoops.esp_job_cmnd WHERE appl_name = $1 AND last_run_date::timestamp >= NOW() - INTERVAL '2 days'
         GROUP BY DATE(last_run_date::timestamp), EXTRACT(HOUR FROM last_run_date::timestamp) ORDER BY DATE(last_run_date::timestamp), EXTRACT(HOUR FROM last_run_date::timestamp)`,
        [appl_name]).then(r => r.rows.map((x: any) => ({ day: String(x.day), hour: parseInt(x.hour), count: parseInt(x.count) }))), []),

      safe(() => pool.query(
        `SELECT jobname, release AS successor_job FROM edoops.esp_job_dpndnt WHERE appl_name = $1 ORDER BY jobname`,
        [appl_name]).then(r => r.rows.map((x: any) => ({ jobname: x.jobname, successor_job: x.successor_job }))), []),

      safe(() => pool.query(
        `SELECT jobname, release AS predecessor_job FROM edoops.esp_job_dpndnt WHERE release = $1 ORDER BY jobname`,
        [appl_name]).then(r => r.rows.map((x: any) => ({ jobname: x.jobname, predecessor_job: x.predecessor_job }))), []),

      safe(() => pool.query(
        `SELECT jobname, command, argument FROM edoops.esp_job_cmnd WHERE appl_name = $1 ORDER BY jobname`,
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
      SELECT DISTINCT appl_name FROM edoops.esp_job_cmnd ORDER BY appl_name
    `);
    const applNames = appsResult.rows.map((row: any) => row.appl_name);

    // For each appl_id, get counts and trend
    const summary = [];
    for (const appl_name of applNames) {
      // Job count
      const jobCountResult = await pool.query(`
        SELECT COUNT(DISTINCT jobname) AS job_count FROM edoops.esp_job_cmnd WHERE appl_name = $1
      `, [appl_name]);
      const job_count = parseInt(jobCountResult.rows[0]?.job_count || '0', 10);

      // Idle job count (not run in last 2 days)
      const idleJobResult = await pool.query(`
        SELECT COUNT(DISTINCT jobname) AS idle_job_count FROM edoops.esp_job_cmnd WHERE appl_name = $1 AND last_run_date < NOW() - INTERVAL '2 days'
      `, [appl_name]);
      const idle_job_count = parseInt(idleJobResult.rows[0]?.idle_job_count || '0', 10);

      // Special job count
      const splJobResult = await pool.query(`
        SELECT COUNT(DISTINCT jobname) AS spl_job_count FROM edoops.esp_job_cmnd WHERE appl_name = $1 AND (jobname LIKE '%JSDDELAY%' OR jobname LIKE '%RETRIG%')
      `, [appl_name]);
      const spl_job_count = parseInt(splJobResult.rows[0]?.spl_job_count || '0', 10);

      // Account (first account found for this appl_name)
      const accountResult = await pool.query(`
        SELECT account FROM edoops.esp_job_cmnd WHERE appl_name = $1 LIMIT 1
      `, [appl_name]);
      const account = accountResult.rows[0]?.account || null;

      // Job run trend (last 2 days, jobs per hour)
      const trendResult = await pool.query(`
        SELECT DATE_TRUNC('hour', last_run_date) AS hour, COUNT(*) AS count
        FROM edoops.esp_job_cmnd
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
