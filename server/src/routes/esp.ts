
/**
 * ESP routes — queries against PostgreSQL edoops ESP tables.
 *
 * Platform resolution is now driven by edoops.esp_job_config:
 *   pltf_name      → canonical platform identifier and display label used by the UI
 *   appl_name      → application scope for platform-level filters
 *   jobname        → job scope for platform/job-level widgets
 *
 * Non-SLA routes resolve platform membership through esp_job_config rather than
 * esp_plt_mapping/plt_name. SLA routes remain based on job_sla_missed.
 */
import { Router, Request, Response } from 'express';
import { getPgPool } from '../db/postgres';

const router = Router();

const ESP_DEFAULT_DAYS = 2;
const ESP_MAX_DAYS = 30;
const ESP_SLA_VIOLATION_LIMIT = 250;
const ESP_SLA_QUEUE_LIMIT = 25;
const ESP_SLA_DETAIL_LIMIT = 100;

function parseDays(query: any): number {
  const n = parseInt(String(query.days ?? ESP_DEFAULT_DAYS), 10);
  return Math.min(Math.max(isNaN(n) ? ESP_DEFAULT_DAYS : n, 1), ESP_MAX_DAYS);
}

function parseLimit(query: any, fallback: number, max: number): number {
  const n = parseInt(String(query.limit ?? fallback), 10);
  if (isNaN(n)) return fallback;
  return Math.min(Math.max(n, 1), max);
}

function mapSlaMissedRow(row: any) {
  return {
    platform: row.jslmis_pltf_nm ?? null,
    batch_dt: row.jslmis_batch_dt ? String(row.jslmis_batch_dt).split('T')[0] : null,
    appl_lib: row.jslmis_appl_lib ?? null,
    application_desc: row.jslmis_application_desc ?? null,
    job_name: row.jslmis_job_nm ?? null,
    run_criteria: row.jslmis_run_criteria ?? null,
    sla_time: row.jslmis_sla_time ?? null,
    sla_type: row.jslmis_sla_typ ?? null,
    sla_status: row.jslmis_sla_status ?? null,
    job_start_time: row.jslmis_job_start_time ?? null,
    job_end_time: row.jslmis_job_end_time ?? null,
    time_diff: row.jslmis_time_diff ?? null,
    bus_unit: row.jslmis_bus_unit ?? null,
    sub_bus_unit: row.jslmis_sub_bus_unit ?? null,
    bus_summary: row.jslmis_bus_summary ?? null,
    last_updated: row.jslmis_last_updt_dttm ?? null,
    duration_minutes: row.duration_minutes != null ? parseFloat(row.duration_minutes) : null,
    running_minutes: row.running_minutes != null ? parseFloat(row.running_minutes) : null,
    sla_miss_count: row.sla_miss_count != null ? parseInt(row.sla_miss_count, 10) : null,
  };
}

// Returns { platform_id, platform_name } or null if the platform value is unknown.
async function getPlatformRow(platformId: string): Promise<{ platform_id: string; platform_name: string } | null> {
  const pool = getPgPool();
  const r = await pool.query(
    `SELECT DISTINCT pltf_name AS platform_id, pltf_name AS platform_name
     FROM edoops.esp_job_config WHERE pltf_name = $1 LIMIT 1`,
    [platformId]
  );
  if (!r.rows.length) return null;
  return { platform_id: r.rows[0].platform_id, platform_name: r.rows[0].platform_name };
}

// SLA routes still filter by the platform name carried in job_sla_missed.
const pltKeysSubquery = `(SELECT DISTINCT pltf_name FROM edoops.esp_job_config WHERE pltf_name = $1)`;

// GET /api/esp/platform-summary
// Streams NDJSON — one JSON line per platform.
router.get('/platform-summary', async (_req: Request, res: Response) => {
  try {
    const pool = getPgPool();
    const t0 = Date.now();

    const result = await pool.query(`
      WITH config_jobs AS MATERIALIZED (
        SELECT
          cfg.pltf_name,
          cfg.appl_name,
          cfg.jobname
        FROM edoops.esp_job_config cfg
        WHERE cfg.pltf_name IS NOT NULL
          AND cfg.appl_name IS NOT NULL
          AND cfg.jobname IS NOT NULL
      ),
      per_job AS (
        SELECT
          cfg.pltf_name,
          c.jobname,
          MAX(c.last_run_date) AS last_run_date
        FROM config_jobs cfg
        JOIN edoops.esp_job_cmnd c ON c.appl_name = cfg.appl_name AND c.jobname = cfg.jobname
        GROUP BY cfg.pltf_name, c.jobname
      ),
      counts AS (
        SELECT
          pltf_name,
          COUNT(*)::int AS total,
          COUNT(CASE WHEN last_run_date IS NOT NULL
                       AND last_run_date::timestamp < NOW() - INTERVAL '2 days'
                     THEN 1 END)::int AS idle,
          COUNT(CASE WHEN jobname LIKE '%JSDELAY%' OR jobname LIKE '%RETRIG%'
                     THEN 1 END)::int AS special
        FROM per_job
        GROUP BY pltf_name
      ),
      platforms AS (
        SELECT DISTINCT pltf_name AS platform_id, pltf_name AS platform_name
        FROM edoops.esp_job_config
        WHERE pltf_name IS NOT NULL
      )
      SELECT p.platform_id, p.platform_name,
             COALESCE(c.total,   0) AS total,
             COALESCE(c.idle,    0) AS idle,
             COALESCE(c.special, 0) AS special
      FROM platforms p
      LEFT JOIN counts c ON c.pltf_name = p.platform_name
      ORDER BY p.platform_name
    `);

    console.log(`[ESP] platform-summary — ${result.rows.length} platforms in ${Date.now() - t0}ms`);

    res.setHeader('Content-Type', 'application/x-ndjson');
    res.setHeader('Cache-Control', 'no-cache');
    res.flushHeaders();

    // Talend rows first so the client auto-selects Talend immediately
    const talend = result.rows.filter((r: any) =>  r.platform_name.toLowerCase().includes('talend'));
    const others = result.rows.filter((r: any) => !r.platform_name.toLowerCase().includes('talend'));
    for (const row of [...talend, ...others]) {
      res.write(JSON.stringify({
        platform:      row.platform_id,
        platform_name: row.platform_name,
        total:         row.total   ?? 0,
        idle:          row.idle    ?? 0,
        special:       row.special ?? 0,
      }) + '\n');
    }
    res.end();
  } catch (err: any) {
    if (!res.headersSent) {
      res.status(500).json({ error: 'Query failed', details: err.message });
    } else {
      res.end();
    }
  }
});

// GET /api/esp/platform-applications/:platformId?limit=200&offset=0&search=<text>
// Returns distinct appl_name values for a platform.
// Supports server-side filtering (search) and pagination (limit/offset).
router.get('/platform-applications/:platformId', async (req: Request, res: Response) => {
  try {
    const pool = getPgPool();
    const platformId = decodeURIComponent(req.params.platformId);
    const rawLimit  = parseInt(String(req.query.limit  ?? '200'), 10);
    const rawOffset = parseInt(String(req.query.offset ?? '0'),   10);
    const limit  = isNaN(rawLimit)  || rawLimit  < 1 ? 200 : Math.min(rawLimit, 1000);
    const offset = isNaN(rawOffset) || rawOffset < 0 ? 0   : rawOffset;
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    console.log('[ESP] platform-applications → platformId:', platformId, 'limit:', limit, 'offset:', offset, 'search:', search);
    const plt = await getPlatformRow(platformId);
    if (!plt) return res.status(404).json({ error: 'Unknown platform' });

    const params: any[] = [plt.platform_name];
    const searchClause = search ? `AND appl_name ILIKE $2` : '';
    if (search) params.push(`%${search}%`);

    const [totalResult, rowsResult] = await Promise.all([
      pool.query(
        `SELECT COUNT(DISTINCT appl_name) AS cnt FROM edoops.esp_job_config
         WHERE pltf_name = $1 ${searchClause}`,
        params
      ),
      pool.query(
        `SELECT DISTINCT appl_name FROM edoops.esp_job_config
         WHERE pltf_name = $1 ${searchClause}
         ORDER BY appl_name
         LIMIT ${limit} OFFSET ${offset}`,
        params
      ),
    ]);

    const total = parseInt(totalResult.rows[0]?.cnt || '0', 10);
    res.json({
      items: rowsResult.rows.map((r: any) => r.appl_name),
      total,
      hasMore: offset + limit < total,
      offset,
      limit,
    });
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

    const t0 = Date.now();

    // Single query: scan esp_job_cmnd once via MATERIALIZED CTE, derive all
    // aggregates from it. A second CTE (appl_names) extracts the 410 distinct
    // appl_name values so the successor/predecessor lookups use a small IN-list
    // instead of a JOIN against the full 25k-row base — the JOIN was causing a
    // massive row-multiplication (25k × dependency rows) before DISTINCT could
    // collapse it, which was the primary source of the 1.5min wait.
    const result = await pool.query(`
      WITH base AS MATERIALIZED (
        SELECT jobname, appl_name, agent, jobtype, user_job, last_run_date
        FROM edoops.esp_job_cmnd
        WHERE (appl_name, jobname) IN (
          SELECT DISTINCT appl_name, jobname
          FROM edoops.esp_job_config
          WHERE pltf_name = $1
            AND appl_name IS NOT NULL
            AND jobname IS NOT NULL
        )
      ),
      appl_names AS MATERIALIZED (
        SELECT DISTINCT appl_name FROM base
      ),
      configured_jobs AS MATERIALIZED (
        SELECT DISTINCT appl_name, jobname
        FROM edoops.esp_job_config
        WHERE pltf_name = $1
          AND appl_name IS NOT NULL
          AND jobname IS NOT NULL
      )
      SELECT
        (SELECT COUNT(DISTINCT jobname)::int FROM base) AS job_count,

        (SELECT COUNT(*)::int FROM (
           SELECT jobname FROM base
           GROUP BY jobname
           HAVING MAX(last_run_date) IS NOT NULL
              AND MAX(last_run_date)::timestamp < NOW() - INTERVAL '2 days'
         ) s) AS idle_count,

        (SELECT COUNT(DISTINCT jobname)::int FROM base
         WHERE jobname LIKE '%JSDELAY%' OR jobname LIKE '%RETRIG%') AS spl_count,

        (SELECT COALESCE(json_agg(a ORDER BY a.count DESC), '[]'::json)
         FROM (SELECT COALESCE(agent, 'Null') AS name, COUNT(*)::int AS count
               FROM base GROUP BY agent) a) AS agents,

        (SELECT COALESCE(json_agg(jt ORDER BY jt.count DESC), '[]'::json)
         FROM (SELECT COALESCE(jobtype, 'Null') AS name, COUNT(*)::int AS count
               FROM base GROUP BY jobtype) jt) AS job_types,

        (SELECT COALESCE(json_agg(uj ORDER BY uj.count DESC), '[]'::json)
         FROM (SELECT COALESCE(user_job, 'Null') AS name, COUNT(*)::int AS count
               FROM base GROUP BY user_job) uj) AS user_jobs,

          (SELECT COALESCE(json_agg(s), '[]'::json)
           FROM (SELECT DISTINCT d.jobname, d.appl_name, d.release AS successor_job
               FROM edoops.esp_job_dpndt d
               INNER JOIN configured_jobs cfgSrc ON cfgSrc.appl_name = d.appl_name AND cfgSrc.jobname = d.jobname
               INNER JOIN configured_jobs cfgDest ON cfgDest.appl_name = d.appl_name AND cfgDest.jobname = d.release
               WHERE d.appl_name IN (SELECT appl_name FROM appl_names)
               ORDER BY d.jobname LIMIT 200) s) AS successors,

        (SELECT COALESCE(json_agg(p), '[]'::json)
           FROM (SELECT DISTINCT d.jobname, d.appl_name, d.release AS predecessor_job
               FROM edoops.esp_job_dpndt d
               INNER JOIN configured_jobs cfgSrc ON cfgSrc.appl_name = d.appl_name AND cfgSrc.jobname = d.jobname
               INNER JOIN configured_jobs cfgDest ON cfgDest.appl_name = d.appl_name AND cfgDest.jobname = d.release
               WHERE d.appl_name IN (SELECT appl_name FROM appl_names)
               ORDER BY d.jobname LIMIT 200) p) AS predecessors
    `, [pltName]);

    console.log(`[ESP] platform-detail ${pltName} — ${Date.now() - t0}ms`);

    const r = result.rows[0] ?? {};
    const asArray = (v: any): any[] => Array.isArray(v) ? v : [];

    res.json({
      appl_name: plt.platform_name,
      platform_id: platformId,
      job_count:        r.job_count   ?? 0,
      idle_job_count:   r.idle_count  ?? 0,
      spl_job_count:    r.spl_count   ?? 0,
      agents:           asArray(r.agents),
      job_types:        asArray(r.job_types),
      completion_codes: [],
      user_jobs:        asArray(r.user_jobs),
      job_list: [], job_run_trend: [],
      successor_jobs:   asArray(r.successors),
      predecessor_jobs: asArray(r.predecessors),
      metadata: [],
    });
  } catch (err: any) {
    console.error('ESP platform-detail error:', err.message);
    res.status(500).json({ error: 'Query failed', details: err.message });
  }
});

// GET /api/esp/platform-job-list/:platformId?limit=N&offset=N&applName=<name>
// Paginated job list for a platform — kept separate from platform-detail so the
// aggregate widgets render immediately while this heavier query runs in the background.
// Default limit = 2000; max = 5000. Returns { jobs, total, limited }.
const PLATFORM_JOB_LIST_MAX = 5000;
const PLATFORM_JOB_LIST_DEFAULT = 2000;
router.get('/platform-job-list/:platformId', async (req: Request, res: Response) => {
  try {
    const pool = getPgPool();
    const platformId = decodeURIComponent(req.params.platformId);
    const rawLimit = parseInt(String(req.query.limit ?? PLATFORM_JOB_LIST_DEFAULT), 10);
    const limit = Math.min(Math.max(isNaN(rawLimit) ? PLATFORM_JOB_LIST_DEFAULT : rawLimit, 1), PLATFORM_JOB_LIST_MAX);
    const rawOffset = parseInt(String(req.query.offset ?? '0'), 10);
    const offset = isNaN(rawOffset) || rawOffset < 0 ? 0 : rawOffset;
    const applName = typeof req.query.applName === 'string' ? req.query.applName.trim() : '';
    const plt = await getPlatformRow(platformId);
    if (!plt) return res.status(404).json({ error: 'Unknown platform' });
    const pltName = plt.platform_name;

    const params: any[] = [pltName];
    let applClause = '';
    let limitParam = '$2';
    let offsetParam = '$3';

    if (applName) {
      params.push(applName);
      applClause = ' AND appl_name = $2';
      limitParam = '$3';
      offsetParam = '$4';
    }

    params.push(limit, offset);

    const baseConfigCte = `
      WITH config_jobs AS MATERIALIZED (
        SELECT DISTINCT cfg.appl_name, cfg.jobname
        FROM edoops.esp_job_config cfg
        WHERE cfg.pltf_name = $1
          AND cfg.appl_name IS NOT NULL
          AND cfg.jobname IS NOT NULL
          ${applClause}
      ),
      source_jobs AS MATERIALIZED (
        SELECT c.appl_name, c.jobname, c.jobtype AS job_type
        FROM edoops.esp_job_cmnd c
        JOIN config_jobs cfg ON cfg.appl_name = c.appl_name AND cfg.jobname = c.jobname
      )
    `;

    const [totalResult, jobsResult] = await Promise.all([
      pool.query(
        `${baseConfigCte}
         SELECT COUNT(DISTINCT jobname) AS cnt
         FROM source_jobs`,
        params.slice(0, applName ? 2 : 1)
      ),
      pool.query(`
        ${baseConfigCte},
        latest_cmd AS MATERIALIZED (
          SELECT DISTINCT ON (jobname)
            jobname,
            appl_name,
            job_type
          FROM source_jobs
          ORDER BY jobname, appl_name
        ),
        latest_stats AS MATERIALIZED (
          SELECT DISTINCT ON (cfg.jobname)
            cfg.jobname,
            s.appl_name,
            TO_CHAR(
              NULLIF(s.start_date::text, '')::timestamp
              + COALESCE(NULLIF(s.start_time::text, '')::time, TIME '00:00:00'),
              'YYYY-MM-DD"T"HH24:MI:SS'
            ) AS last_run_date,
            s.ccfail
          FROM config_jobs cfg
          JOIN edoops.esp_job_stats_recent s
            ON s.appl_name = cfg.appl_name
           AND s.job_longname = cfg.jobname
          ORDER BY cfg.jobname, s.end_date DESC NULLS LAST, s.end_time DESC NULLS LAST, s.start_date DESC NULLS LAST, s.start_time DESC NULLS LAST
        )
        SELECT
          lc.jobname,
          lc.appl_name,
          lc.job_type,
          ls.last_run_date,
          CASE
            WHEN ls.ccfail = 'YES' THEN 'FAILED'
            WHEN ls.ccfail = 'NO' THEN 'SUCCESS'
            WHEN ls.last_run_date IS NULL THEN 'NEVER RUN'
            ELSE 'UNKNOWN'
          END AS run_status
        FROM latest_cmd lc
        LEFT JOIN latest_stats ls ON ls.jobname = lc.jobname AND ls.appl_name = lc.appl_name
        ORDER BY ls.last_run_date DESC NULLS LAST, lc.jobname
        LIMIT ${limitParam} OFFSET ${offsetParam}
      `, params),
    ]);

    const total = parseInt(totalResult.rows[0]?.cnt || '0', 10);
    res.json({
      jobs: jobsResult.rows.map((x: any) => ({
        jobname: x.jobname, appl_name: x.appl_name,
        job_type: x.job_type ?? null, last_run_date: x.last_run_date,
        run_status: x.run_status ?? null,
      })),
      total,
      limited: total > limit || offset > 0,
      limit,
      offset,
      hasMore: offset + limit < total,
    });
  } catch (err: any) {
    console.error('ESP platform-job-list error:', err.message);
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
        SELECT s.end_date, s.end_time::time AS et, s.job_longname AS jobname, s.ccfail
        FROM edoops.esp_job_stats_recent s
        JOIN (
          SELECT DISTINCT appl_name, jobname
          FROM edoops.esp_job_config
          WHERE pltf_name = $1
            AND appl_name IS NOT NULL
            AND jobname IS NOT NULL
        ) cfg ON cfg.appl_name = s.appl_name AND cfg.jobname = s.job_longname
        WHERE s.end_date >= CURRENT_DATE - INTERVAL '${days} days'
      )
      SELECT
        TO_CHAR(end_date, 'YYYY-MM-DD') AS day,
        EXTRACT(HOUR FROM et)::int AS hour,
        COUNT(jobname)::int AS job_count,
        SUM(CASE WHEN ccfail = 'YES' THEN 1 ELSE 0 END)::int AS job_fail_count
      FROM base
      GROUP BY end_date, EXTRACT(HOUR FROM et)
      ORDER BY end_date, EXTRACT(HOUR FROM et)
    `, [pltName]);
    res.json(result.rows.map((r: any) => ({
      day:            r.day ?? null,
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
      FROM edoops.esp_job_cmnd
      WHERE (appl_name, jobname) IN (
        SELECT DISTINCT appl_name, jobname
        FROM edoops.esp_job_config
        WHERE pltf_name = $1
          AND appl_name IS NOT NULL
          AND jobname IS NOT NULL
      )
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
      FROM edoops.esp_job_cmnd ec
      JOIN (
        SELECT DISTINCT appl_name, jobname
        FROM edoops.esp_job_config
        WHERE pltf_name = $1
          AND appl_name IS NOT NULL
          AND jobname IS NOT NULL
      ) cfg ON cfg.appl_name = ec.appl_name AND cfg.jobname = ec.jobname
      JOIN edoops.esp_job_stats_recent es
        ON ec.appl_name = es.appl_name AND ec.jobname = es.job_longname
      WHERE es.end_date >= CURRENT_DATE - INTERVAL '${days} days'
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

// GET /api/esp/sla-violations?platformId=<id>&applName=<name>&limit=N
// Returns the latest SLA missed rows from edoops.job_sla_missed narrowed by the
// current platform and optionally one applib.
router.get('/sla-violations', async (req: Request, res: Response) => {
  try {
    const pool = getPgPool();
    const platformId = typeof req.query.platformId === 'string' ? decodeURIComponent(req.query.platformId) : '';
    const applName = typeof req.query.applName === 'string' ? req.query.applName.trim() : '';
    const limit = parseLimit(req.query, ESP_SLA_VIOLATION_LIMIT, 1000);

    if (!platformId) {
      return res.status(400).json({ error: 'platformId is required' });
    }

    const plt = await getPlatformRow(platformId);
    if (!plt) return res.status(404).json({ error: 'Unknown platform' });

    const params: any[] = [plt.platform_name];
    let applClause = '';
    if (applName) {
      params.push(applName);
      applClause = ' AND s.jslmis_appl_lib = $2';
    }

    const result = await pool.query(
      `SELECT
         s.jslmis_pltf_nm,
         s.jslmis_batch_dt,
         s.jslmis_appl_lib,
         s.jslmis_job_nm,
         s.jslmis_run_criteria,
         s.jslmis_sla_time,
         s.jslmis_sla_typ,
         s.jslmis_job_start_time,
         s.jslmis_job_end_time,
         s.jslmis_sla_status,
         s.jslmis_time_diff,
         s.jslmis_application_desc,
         s.jslmis_ccfail,
         s.jslmis_bus_unit,
         s.jslmis_sub_bus_unit,
         s.jslmis_bus_summary,
         s.jslmis_last_updt_dttm
       FROM edoops.job_sla_missed s
       WHERE s.jslmis_pltf_nm IN ${pltKeysSubquery}${applClause}
       ORDER BY s.jslmis_batch_dt DESC NULLS LAST,
                s.jslmis_job_start_time DESC NULLS LAST,
                s.jslmis_job_nm ASC
       LIMIT ${limit}`,
      params
    );

    res.json(result.rows.map((r: any) => ({
      platform: r.jslmis_pltf_nm ?? null,
      batch_dt: r.jslmis_batch_dt ? String(r.jslmis_batch_dt).split('T')[0] : null,
      appl_lib: r.jslmis_appl_lib ?? null,
      job_name: r.jslmis_job_nm ?? null,
      run_criteria: r.jslmis_run_criteria ?? null,
      sla_time: r.jslmis_sla_time ?? null,
      sla_type: r.jslmis_sla_typ ?? null,
      job_start_time: r.jslmis_job_start_time ?? null,
      job_end_time: r.jslmis_job_end_time ?? null,
      sla_status: r.jslmis_sla_status ?? null,
      time_diff: r.jslmis_time_diff ?? null,
      application_desc: r.jslmis_application_desc ?? null,
      ccfail: r.jslmis_ccfail ?? null,
      bus_unit: r.jslmis_bus_unit ?? null,
      sub_bus_unit: r.jslmis_sub_bus_unit ?? null,
      bus_summary: r.jslmis_bus_summary ?? null,
      last_updated: r.jslmis_last_updt_dttm ?? null,
    })));
  } catch (err: any) {
    console.error('ESP sla-violations error:', err.message);
    res.status(500).json({ error: 'Query failed', details: err.message });
  }
});

// GET /api/esp/sla-missed-dashboard?platformId=<id>&applName=<name>
// Aggregates the SLA missed jobs dashboard directly from PostgreSQL.
router.get('/sla-missed-dashboard', async (req: Request, res: Response) => {
  try {
    const pool = getPgPool();
    const platformId = typeof req.query.platformId === 'string' ? decodeURIComponent(req.query.platformId) : '';
    const applName = typeof req.query.applName === 'string' ? req.query.applName.trim() : '';
    const params: any[] = [];
    let whereClause = '1=1';

    if (platformId) {
      const plt = await getPlatformRow(platformId);
      if (!plt) return res.status(404).json({ error: 'Unknown platform' });
      params.push(plt.platform_name);
      whereClause = `s.jslmis_pltf_nm IN ${pltKeysSubquery}`;
    }

    if (applName) {
      params.push(applName);
      whereClause += ` AND s.jslmis_appl_lib = $${params.length}`;
    }

    const safe = async <T>(fn: () => Promise<T>, fallback: T): Promise<T> => {
      try {
        return await fn();
      } catch (error: any) {
        console.warn('[ESP] sla-missed-dashboard query skipped:', error.message);
        return fallback;
      }
    };

    const detailFields = `
      s.jslmis_pltf_nm,
      s.jslmis_batch_dt,
      s.jslmis_appl_lib,
      s.jslmis_application_desc,
      s.jslmis_job_nm,
      s.jslmis_run_criteria,
      s.jslmis_sla_time,
      s.jslmis_sla_typ,
      s.jslmis_sla_status,
      s.jslmis_job_start_time,
      s.jslmis_job_end_time,
      s.jslmis_time_diff,
      s.jslmis_bus_unit,
      s.jslmis_sub_bus_unit,
      s.jslmis_bus_summary,
      s.jslmis_last_updt_dttm
    `;

    const [
      metrics,
      dailyMisses,
      hourlyMisses,
      platformTrend,
      slaTypeTrend,
      topApplications,
      topBusinessUnits,
      missesByPlatform,
      missesBySlaType,
      missesByRunCriteria,
      topRepeatedJobs,
      openQueue,
      longestRunning,
      recentlyUpdated,
      noEndTime,
      percentByPlatform,
      percentByBusinessUnit,
      dailyOpenClosed,
      avgDurationByApplication,
    ] = await Promise.all([
      safe(async () => {
        const result = await pool.query(
          `WITH base AS MATERIALIZED (
             SELECT *
             FROM edoops.job_sla_missed s
             WHERE ${whereClause}
           )
           SELECT
             COUNT(*) FILTER (WHERE jslmis_batch_dt = CURRENT_DATE)::int AS total_sla_missed_jobs_today,
             COUNT(*) FILTER (WHERE jslmis_job_end_time IS NULL)::int AS open_missed_jobs_right_now,
             COUNT(DISTINCT jslmis_application_desc) FILTER (WHERE jslmis_batch_dt = CURRENT_DATE)::int AS distinct_applications_impacted,
             COUNT(DISTINCT jslmis_bus_unit) FILTER (WHERE jslmis_batch_dt = CURRENT_DATE)::int AS distinct_business_units_impacted,
             ROUND(AVG(CASE
               WHEN jslmis_job_start_time IS NOT NULL
               THEN EXTRACT(EPOCH FROM (COALESCE(jslmis_job_end_time, CURRENT_TIMESTAMP) - jslmis_job_start_time)) / 60
             END)::numeric, 2) AS avg_delay_minutes,
             ROUND(MAX(CASE
               WHEN jslmis_job_start_time IS NOT NULL
               THEN EXTRACT(EPOCH FROM (COALESCE(jslmis_job_end_time, CURRENT_TIMESTAMP) - jslmis_job_start_time)) / 60
             END)::numeric, 2) AS longest_delay_minutes
           FROM base`,
          params,
        );
        const row = result.rows[0] ?? {};
        return {
          total_sla_missed_jobs_today: parseInt(row.total_sla_missed_jobs_today ?? '0', 10),
          open_missed_jobs_right_now: parseInt(row.open_missed_jobs_right_now ?? '0', 10),
          distinct_applications_impacted: parseInt(row.distinct_applications_impacted ?? '0', 10),
          distinct_business_units_impacted: parseInt(row.distinct_business_units_impacted ?? '0', 10),
          avg_delay_minutes: row.avg_delay_minutes != null ? parseFloat(row.avg_delay_minutes) : null,
          longest_delay_minutes: row.longest_delay_minutes != null ? parseFloat(row.longest_delay_minutes) : null,
        };
      }, {
        total_sla_missed_jobs_today: 0,
        open_missed_jobs_right_now: 0,
        distinct_applications_impacted: 0,
        distinct_business_units_impacted: 0,
        avg_delay_minutes: null,
        longest_delay_minutes: null,
      }),
      safe(async () => {
        const result = await pool.query(
          `SELECT
             s.jslmis_batch_dt AS day,
             COUNT(*)::int AS sla_misses
           FROM edoops.job_sla_missed s
           WHERE ${whereClause}
             AND s.jslmis_batch_dt >= CURRENT_DATE - INTERVAL '14 days'
           GROUP BY s.jslmis_batch_dt
           ORDER BY s.jslmis_batch_dt`,
          params,
        );
        return result.rows.map((row: any) => ({
          day: row.day ? String(row.day).split('T')[0] : null,
          sla_misses: parseInt(row.sla_misses, 10),
        }));
      }, []),
      safe(async () => {
        const result = await pool.query(
          `SELECT
             EXTRACT(HOUR FROM s.jslmis_job_start_time)::int AS job_start_hour,
             COUNT(*)::int AS sla_misses
           FROM edoops.job_sla_missed s
           WHERE ${whereClause}
             AND s.jslmis_job_start_time IS NOT NULL
             AND s.jslmis_batch_dt >= CURRENT_DATE - INTERVAL '7 days'
           GROUP BY EXTRACT(HOUR FROM s.jslmis_job_start_time)
           ORDER BY job_start_hour`,
          params,
        );
        return result.rows.map((row: any) => ({
          hour: parseInt(row.job_start_hour, 10),
          sla_misses: parseInt(row.sla_misses, 10),
        }));
      }, []),
      safe(async () => {
        const result = await pool.query(
          `SELECT
             s.jslmis_batch_dt AS day,
             s.jslmis_pltf_nm AS platform,
             COUNT(*)::int AS sla_misses
           FROM edoops.job_sla_missed s
           WHERE ${whereClause}
             AND s.jslmis_batch_dt >= CURRENT_DATE - INTERVAL '7 days'
           GROUP BY s.jslmis_batch_dt, s.jslmis_pltf_nm
           ORDER BY s.jslmis_batch_dt, s.jslmis_pltf_nm`,
          params,
        );
        return result.rows.map((row: any) => ({
          day: row.day ? String(row.day).split('T')[0] : null,
          platform: row.platform ?? 'Unknown',
          sla_misses: parseInt(row.sla_misses, 10),
        }));
      }, []),
      safe(async () => {
        const result = await pool.query(
          `SELECT
             s.jslmis_batch_dt AS day,
             COALESCE(s.jslmis_sla_typ, 'Unknown') AS sla_type,
             COUNT(*)::int AS sla_misses
           FROM edoops.job_sla_missed s
           WHERE ${whereClause}
             AND s.jslmis_batch_dt >= CURRENT_DATE - INTERVAL '7 days'
           GROUP BY s.jslmis_batch_dt, COALESCE(s.jslmis_sla_typ, 'Unknown')
           ORDER BY s.jslmis_batch_dt, sla_type`,
          params,
        );
        return result.rows.map((row: any) => ({
          day: row.day ? String(row.day).split('T')[0] : null,
          sla_type: row.sla_type ?? 'Unknown',
          sla_misses: parseInt(row.sla_misses, 10),
        }));
      }, []),
      safe(async () => {
        const result = await pool.query(
          `SELECT
             COALESCE(s.jslmis_application_desc, 'Unknown') AS name,
             COUNT(*)::int AS sla_misses
           FROM edoops.job_sla_missed s
           WHERE ${whereClause}
             AND s.jslmis_batch_dt >= CURRENT_DATE - INTERVAL '7 days'
           GROUP BY COALESCE(s.jslmis_application_desc, 'Unknown')
           ORDER BY sla_misses DESC, name
           LIMIT 10`,
          params,
        );
        return result.rows.map((row: any) => ({ name: row.name, sla_misses: parseInt(row.sla_misses, 10) }));
      }, []),
      safe(async () => {
        const result = await pool.query(
          `SELECT
             COALESCE(s.jslmis_bus_unit, 'Unknown') AS name,
             COUNT(*)::int AS sla_misses
           FROM edoops.job_sla_missed s
           WHERE ${whereClause}
             AND s.jslmis_batch_dt >= CURRENT_DATE - INTERVAL '7 days'
           GROUP BY COALESCE(s.jslmis_bus_unit, 'Unknown')
           ORDER BY sla_misses DESC, name
           LIMIT 10`,
          params,
        );
        return result.rows.map((row: any) => ({ name: row.name, sla_misses: parseInt(row.sla_misses, 10) }));
      }, []),
      safe(async () => {
        const result = await pool.query(
          `SELECT
             COALESCE(s.jslmis_pltf_nm, 'Unknown') AS name,
             COUNT(*)::int AS sla_misses
           FROM edoops.job_sla_missed s
           WHERE ${whereClause}
             AND s.jslmis_batch_dt >= CURRENT_DATE - INTERVAL '7 days'
           GROUP BY COALESCE(s.jslmis_pltf_nm, 'Unknown')
           ORDER BY sla_misses DESC, name`,
          params,
        );
        return result.rows.map((row: any) => ({ name: row.name, sla_misses: parseInt(row.sla_misses, 10) }));
      }, []),
      safe(async () => {
        const result = await pool.query(
          `SELECT
             COALESCE(s.jslmis_sla_typ, 'Unknown') AS name,
             COUNT(*)::int AS sla_misses
           FROM edoops.job_sla_missed s
           WHERE ${whereClause}
             AND s.jslmis_batch_dt >= CURRENT_DATE - INTERVAL '7 days'
           GROUP BY COALESCE(s.jslmis_sla_typ, 'Unknown')
           ORDER BY sla_misses DESC, name`,
          params,
        );
        return result.rows.map((row: any) => ({ name: row.name, sla_misses: parseInt(row.sla_misses, 10) }));
      }, []),
      safe(async () => {
        const result = await pool.query(
          `SELECT
             COALESCE(s.jslmis_run_criteria, 'Unknown') AS name,
             COUNT(*)::int AS sla_misses
           FROM edoops.job_sla_missed s
           WHERE ${whereClause}
             AND s.jslmis_batch_dt >= CURRENT_DATE - INTERVAL '7 days'
           GROUP BY COALESCE(s.jslmis_run_criteria, 'Unknown')
           ORDER BY sla_misses DESC, name
           LIMIT 10`,
          params,
        );
        return result.rows.map((row: any) => ({ name: row.name, sla_misses: parseInt(row.sla_misses, 10) }));
      }, []),
      safe(async () => {
        const result = await pool.query(
          `SELECT
             s.jslmis_job_nm,
             COUNT(*)::int AS sla_miss_count
           FROM edoops.job_sla_missed s
           WHERE ${whereClause}
             AND s.jslmis_batch_dt >= CURRENT_DATE - INTERVAL '30 days'
           GROUP BY s.jslmis_job_nm
           ORDER BY sla_miss_count DESC, s.jslmis_job_nm
           LIMIT 10`,
          params,
        );
        return result.rows.map((row: any) => ({
          job_name: row.jslmis_job_nm ?? null,
          sla_miss_count: parseInt(row.sla_miss_count, 10),
        }));
      }, []),
      safe(async () => {
        const result = await pool.query(
          `SELECT
             ${detailFields},
             ROUND(EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - s.jslmis_job_start_time)) / 60, 2) AS running_minutes
           FROM edoops.job_sla_missed s
           WHERE ${whereClause}
             AND s.jslmis_job_end_time IS NULL
           ORDER BY s.jslmis_job_start_time ASC NULLS LAST
           LIMIT ${ESP_SLA_QUEUE_LIMIT}`,
          params,
        );
        return result.rows.map(mapSlaMissedRow);
      }, []),
      safe(async () => {
        const result = await pool.query(
          `SELECT
             ${detailFields},
             ROUND(EXTRACT(EPOCH FROM (COALESCE(s.jslmis_job_end_time, CURRENT_TIMESTAMP) - s.jslmis_job_start_time)) / 60, 2) AS duration_minutes
           FROM edoops.job_sla_missed s
           WHERE ${whereClause}
             AND s.jslmis_job_start_time IS NOT NULL
           ORDER BY duration_minutes DESC NULLS LAST
           LIMIT 10`,
          params,
        );
        return result.rows.map(mapSlaMissedRow);
      }, []),
      safe(async () => {
        const result = await pool.query(
          `SELECT ${detailFields}
           FROM edoops.job_sla_missed s
           WHERE ${whereClause}
           ORDER BY s.jslmis_last_updt_dttm DESC NULLS LAST
           LIMIT 10`,
          params,
        );
        return result.rows.map(mapSlaMissedRow);
      }, []),
      safe(async () => {
        const result = await pool.query(
          `SELECT ${detailFields}
           FROM edoops.job_sla_missed s
           WHERE ${whereClause}
             AND s.jslmis_job_end_time IS NULL
           ORDER BY s.jslmis_job_start_time ASC NULLS LAST
           LIMIT 50`,
          params,
        );
        return result.rows.map(mapSlaMissedRow);
      }, []),
      safe(async () => {
        const result = await pool.query(
          `SELECT
             COALESCE(s.jslmis_pltf_nm, 'Unknown') AS name,
             COUNT(*)::int AS sla_misses,
             ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 2) AS pct_of_total
           FROM edoops.job_sla_missed s
           WHERE ${whereClause}
             AND s.jslmis_batch_dt >= CURRENT_DATE - INTERVAL '7 days'
           GROUP BY COALESCE(s.jslmis_pltf_nm, 'Unknown')
           ORDER BY sla_misses DESC, name`,
          params,
        );
        return result.rows.map((row: any) => ({
          name: row.name,
          sla_misses: parseInt(row.sla_misses, 10),
          pct_of_total: parseFloat(row.pct_of_total),
        }));
      }, []),
      safe(async () => {
        const result = await pool.query(
          `SELECT
             COALESCE(s.jslmis_bus_unit, 'Unknown') AS name,
             COUNT(*)::int AS sla_misses,
             ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 2) AS pct_of_total
           FROM edoops.job_sla_missed s
           WHERE ${whereClause}
             AND s.jslmis_batch_dt >= CURRENT_DATE - INTERVAL '7 days'
           GROUP BY COALESCE(s.jslmis_bus_unit, 'Unknown')
           ORDER BY sla_misses DESC, name`,
          params,
        );
        return result.rows.map((row: any) => ({
          name: row.name,
          sla_misses: parseInt(row.sla_misses, 10),
          pct_of_total: parseFloat(row.pct_of_total),
        }));
      }, []),
      safe(async () => {
        const result = await pool.query(
          `SELECT
             s.jslmis_batch_dt AS day,
             SUM(CASE WHEN s.jslmis_job_end_time IS NULL THEN 1 ELSE 0 END)::int AS open_jobs,
             SUM(CASE WHEN s.jslmis_job_end_time IS NOT NULL THEN 1 ELSE 0 END)::int AS closed_jobs
           FROM edoops.job_sla_missed s
           WHERE ${whereClause}
             AND s.jslmis_batch_dt >= CURRENT_DATE - INTERVAL '14 days'
           GROUP BY s.jslmis_batch_dt
           ORDER BY s.jslmis_batch_dt`,
          params,
        );
        return result.rows.map((row: any) => ({
          day: row.day ? String(row.day).split('T')[0] : null,
          open_jobs: parseInt(row.open_jobs, 10),
          closed_jobs: parseInt(row.closed_jobs, 10),
        }));
      }, []),
      safe(async () => {
        const result = await pool.query(
          `SELECT
             COALESCE(s.jslmis_application_desc, 'Unknown') AS name,
             ROUND(AVG(EXTRACT(EPOCH FROM (COALESCE(s.jslmis_job_end_time, CURRENT_TIMESTAMP) - s.jslmis_job_start_time)) / 60)::numeric, 2) AS avg_duration_minutes
           FROM edoops.job_sla_missed s
           WHERE ${whereClause}
             AND s.jslmis_job_start_time IS NOT NULL
             AND s.jslmis_batch_dt >= CURRENT_DATE - INTERVAL '7 days'
           GROUP BY COALESCE(s.jslmis_application_desc, 'Unknown')
           ORDER BY avg_duration_minutes DESC NULLS LAST, name
           LIMIT 10`,
          params,
        );
        return result.rows.map((row: any) => ({
          name: row.name,
          avg_duration_minutes: row.avg_duration_minutes != null ? parseFloat(row.avg_duration_minutes) : 0,
        }));
      }, []),
    ]);

    res.json({
      metrics,
      daily_misses: dailyMisses,
      hourly_misses: hourlyMisses,
      platform_trend: platformTrend,
      sla_type_trend: slaTypeTrend,
      top_applications: topApplications,
      top_business_units: topBusinessUnits,
      misses_by_platform: missesByPlatform,
      misses_by_sla_type: missesBySlaType,
      misses_by_run_criteria: missesByRunCriteria,
      top_repeated_jobs: topRepeatedJobs,
      open_queue: openQueue,
      longest_running: longestRunning,
      recently_updated: recentlyUpdated,
      no_end_time: noEndTime,
      percent_by_platform: percentByPlatform,
      percent_by_business_unit: percentByBusinessUnit,
      daily_open_closed: dailyOpenClosed,
      avg_duration_by_application: avgDurationByApplication,
    });
  } catch (err: any) {
    console.error('ESP sla-missed-dashboard error:', err.message);
    res.status(500).json({ error: 'Query failed', details: err.message });
  }
});

// GET /api/esp/sla-missed-job-detail?platformId=<id>&jobName=<name>&applName=<name>&limit=N
router.get('/sla-missed-job-detail', async (req: Request, res: Response) => {
  try {
    const pool = getPgPool();
    const platformId = typeof req.query.platformId === 'string' ? decodeURIComponent(req.query.platformId) : '';
    const jobName = typeof req.query.jobName === 'string' ? req.query.jobName.trim() : '';
    const applName = typeof req.query.applName === 'string' ? req.query.applName.trim() : '';
    const limit = parseLimit(req.query, ESP_SLA_DETAIL_LIMIT, 500);

    if (!jobName) {
      return res.status(400).json({ error: 'jobName is required' });
    }

    const params: any[] = [jobName];
    let whereClause = 's.jslmis_job_nm = $1';

    if (platformId) {
      const plt = await getPlatformRow(platformId);
      if (!plt) return res.status(404).json({ error: 'Unknown platform' });
      params.unshift(plt.platform_name);
      whereClause = `s.jslmis_pltf_nm IN ${pltKeysSubquery} AND s.jslmis_job_nm = $2`;
    }

    if (applName) {
      params.push(applName);
      whereClause += ` AND s.jslmis_appl_lib = $${params.length}`;
    }

    const result = await pool.query(
      `SELECT
         s.jslmis_pltf_nm,
         s.jslmis_batch_dt,
         s.jslmis_appl_lib,
         s.jslmis_application_desc,
         s.jslmis_job_nm,
         s.jslmis_run_criteria,
         s.jslmis_sla_time,
         s.jslmis_sla_typ,
         s.jslmis_sla_status,
         s.jslmis_job_start_time,
         s.jslmis_job_end_time,
         s.jslmis_time_diff,
         s.jslmis_bus_unit,
         s.jslmis_sub_bus_unit,
         s.jslmis_bus_summary,
         s.jslmis_last_updt_dttm
       FROM edoops.job_sla_missed s
       WHERE ${whereClause}
       ORDER BY s.jslmis_last_updt_dttm DESC NULLS LAST
       LIMIT ${limit}`,
      params,
    );

    res.json(result.rows.map(mapSlaMissedRow));
  } catch (err: any) {
    console.error('ESP sla-missed-job-detail error:', err.message);
    res.status(500).json({ error: 'Query failed', details: err.message });
  }
});

// GET /api/esp/applications
// Returns all distinct appl_names with their canonical platform id/name.
router.get('/applications', async (_req: Request, res: Response) => {
  try {
    const pool = getPgPool();
    const result = await pool.query(`
      SELECT DISTINCT ON (cfg.appl_name)
        cfg.appl_name,
        cfg.pltf_name AS platform_id,
        cfg.pltf_name AS platform_name
      FROM edoops.esp_job_config cfg
      WHERE cfg.appl_name IS NOT NULL
      ORDER BY cfg.appl_name, cfg.pltf_name
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
// Filters to only configured jobs in esp_job_config for consistency with other endpoints
router.get('/metadata/:appl_name', async (req: Request, res: Response) => {
  try {
    const pool = getPgPool();
    const appl_name = decodeURIComponent(req.params.appl_name);
    const result = await pool.query(
      `SELECT c.jobname,
              c.command,
              c.argument,
              c.agent,
              c.jobtype AS job_type,
              c.esp_command AS comp_code,
              c.runs,
              c.user_job
      FROM edoops.esp_job_cmnd c
      JOIN edoops.esp_job_config cfg ON cfg.appl_name = c.appl_name AND cfg.jobname = c.jobname
      WHERE c.appl_name = $1
      ORDER BY c.jobname`,

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
// Joins edoops.esp_job_cmnd + edoops.esp_job_stats_recent for detailed run records
// Filters to only configured jobs in esp_job_config for consistency with other endpoints
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
      FROM edoops.esp_job_cmnd ec
      JOIN edoops.esp_job_stats_recent es
         ON ec.appl_name = es.appl_name
        AND ec.jobname   = es.job_longname
      JOIN edoops.esp_job_config cfg ON cfg.appl_name = ec.appl_name AND cfg.jobname = ec.jobname
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
// Uses edoops.esp_job_stats_recent (end_time, end_date, jobname, ccfail)
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
         FROM edoops.esp_job_stats_recent
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
// GET /api/esp/summary/:appl_name?days=N  — all widget data for one application
router.get('/summary/:appl_name', async (req: Request, res: Response) => {
  try {
    const pool = getPgPool();
    const appl_name = decodeURIComponent(req.params.appl_name);
    const days = parseDays(req.query);
    const platformId = typeof req.query.platformId === 'string' ? req.query.platformId.trim() : '';
    const pf = platformId ? ' AND cfg.pltf_name = $2' : '';
    const bp = platformId ? [appl_name, platformId] : [appl_name];
    console.log('[ESP] summary → appl_name:', appl_name, 'days:', days, 'platformId:', platformId);

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
        `SELECT COUNT(DISTINCT c.jobname) AS cnt FROM edoops.esp_job_cmnd c
         JOIN edoops.esp_job_config cfg ON cfg.appl_name = c.appl_name AND cfg.jobname = c.jobname
         WHERE c.appl_name = $1${pf}`,
        bp).then(r => parseInt(r.rows[0]?.cnt || '0', 10)), 0),

      safe(() => pool.query(
        `SELECT COUNT(DISTINCT c.jobname) AS cnt FROM edoops.esp_job_cmnd c
         JOIN edoops.esp_job_config cfg ON cfg.appl_name = c.appl_name AND cfg.jobname = c.jobname
         WHERE c.appl_name = $1${pf} AND c.last_run_date IS NOT NULL AND c.last_run_date::timestamp < NOW() - INTERVAL '2 days'`,
        bp).then(r => parseInt(r.rows[0]?.cnt || '0', 10)), 0),

      safe(() => pool.query(
        `SELECT COUNT(DISTINCT c.jobname) AS cnt FROM edoops.esp_job_cmnd c
         JOIN edoops.esp_job_config cfg ON cfg.appl_name = c.appl_name AND cfg.jobname = c.jobname
         WHERE c.appl_name = $1${pf} AND (c.jobname LIKE '%JSDELAY%' OR c.jobname LIKE '%RETRIG%')`,
        bp).then(r => parseInt(r.rows[0]?.cnt || '0', 10)), 0),

      safe(() => pool.query(
        `SELECT COALESCE(c.agent, 'Null') AS name, COUNT(*) AS count FROM edoops.esp_job_cmnd c
         JOIN edoops.esp_job_config cfg ON cfg.appl_name = c.appl_name AND cfg.jobname = c.jobname
         WHERE c.appl_name = $1${pf} GROUP BY c.agent ORDER BY count DESC`,
        bp).then(r => r.rows.map((x: any) => ({ name: x.name, count: parseInt(x.count) }))), []),

      safe(() => pool.query(
        `SELECT COALESCE(c.jobtype, 'Null') AS name, COUNT(*) AS count FROM edoops.esp_job_cmnd c
         JOIN edoops.esp_job_config cfg ON cfg.appl_name = c.appl_name AND cfg.jobname = c.jobname
         WHERE c.appl_name = $1${pf} GROUP BY c.jobtype ORDER BY count DESC`,
        bp).then(r => r.rows.map((x: any) => ({ name: x.name, count: parseInt(x.count) }))), []),

      safe(() => pool.query(
        `SELECT COALESCE(CAST(c.cmpl_cd AS TEXT), 'Null') AS name, COUNT(*) AS count FROM edoops.esp_job_cmnd c
         JOIN edoops.esp_job_config cfg ON cfg.appl_name = c.appl_name AND cfg.jobname = c.jobname
         WHERE c.appl_name = $1${pf} GROUP BY c.cmpl_cd ORDER BY count DESC`,
        bp).then(r => r.rows.map((x: any) => ({ name: x.name, count: parseInt(x.count) }))), []),

      safe(() => pool.query(
        `SELECT COALESCE(c.user_job, 'Null') AS name, COUNT(*) AS count FROM edoops.esp_job_cmnd c
         JOIN edoops.esp_job_config cfg ON cfg.appl_name = c.appl_name AND cfg.jobname = c.jobname
         WHERE c.appl_name = $1${pf} GROUP BY c.user_job ORDER BY count DESC`,
        bp).then(r => r.rows.map((x: any) => ({ name: x.name, count: parseInt(x.count) }))), []),

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
         FROM (
           SELECT DISTINCT ON (c.jobname) c.jobname, c.jobtype, c.last_run_date, c.appl_name
           FROM edoops.esp_job_cmnd c
           JOIN edoops.esp_job_config cfg ON cfg.appl_name = c.appl_name AND cfg.jobname = c.jobname
           WHERE c.appl_name = $1${pf}
           ORDER BY c.jobname, c.last_run_date DESC NULLS LAST
         ) c
         LEFT JOIN LATERAL (
           SELECT s.ccfail
           FROM edoops.esp_job_stats_recent s
           WHERE s.appl_name = c.appl_name
             AND s.job_longname = c.jobname
           ORDER BY s.end_date DESC NULLS LAST, s.end_time DESC NULLS LAST, s.start_date DESC NULLS LAST, s.start_time DESC NULLS LAST
           LIMIT 1
         ) latest ON true
         ORDER BY c.last_run_date DESC NULLS LAST, c.jobname`,
        bp).then(r => r.rows.map((x: any) => ({ jobname: x.jobname, job_type: x.job_type ?? null, last_run_date: x.last_run_date, run_status: x.run_status ?? null }))), []),

      safe(() => pool.query(
        `SELECT DATE(c.last_run_date::timestamp) AS day, EXTRACT(HOUR FROM c.last_run_date::timestamp)::int AS hour, COUNT(*)::int AS count
         FROM edoops.esp_job_cmnd c
         JOIN edoops.esp_job_config cfg ON cfg.appl_name = c.appl_name AND cfg.jobname = c.jobname
         WHERE c.appl_name = $1${pf} AND c.last_run_date >= NOW() - INTERVAL '${days} days'
         GROUP BY DATE(c.last_run_date::timestamp), EXTRACT(HOUR FROM c.last_run_date::timestamp) ORDER BY DATE(c.last_run_date::timestamp), EXTRACT(HOUR FROM c.last_run_date::timestamp)`,
        bp).then(r => r.rows.map((x: any) => ({ day: String(x.day), hour: parseInt(x.hour), count: parseInt(x.count) }))), []),

      safe(() => pool.query(
        `SELECT DISTINCT d.jobname, d.appl_name, d.release AS successor_job FROM edoops.esp_job_dpndt d
         JOIN edoops.esp_job_config cfgSrc ON cfgSrc.appl_name = d.appl_name AND cfgSrc.jobname = d.jobname
         JOIN edoops.esp_job_config cfgDest ON cfgDest.appl_name = d.appl_name AND cfgDest.jobname = d.release
         WHERE d.appl_name = $1 ORDER BY d.jobname`,
        [appl_name]).then(r => r.rows.map((x: any) => ({ jobname: x.jobname, appl_name: x.appl_name, successor_job: x.successor_job }))), []),

      safe(() => pool.query(
        `SELECT DISTINCT d.jobname, d.appl_name, d.release AS predecessor_job FROM edoops.esp_job_dpndt d
         JOIN edoops.esp_job_config cfgSrc ON cfgSrc.appl_name = d.appl_name AND cfgSrc.jobname = d.jobname
         JOIN edoops.esp_job_config cfgDest ON cfgDest.appl_name = d.appl_name AND cfgDest.jobname = d.release
         WHERE d.release = $1 ORDER BY d.jobname`,
        [appl_name]).then(r => r.rows.map((x: any) => ({ jobname: x.jobname, appl_name: x.appl_name, predecessor_job: x.predecessor_job }))), []),

      safe(() => pool.query(
        `SELECT c.jobname, c.command, c.argument FROM edoops.esp_job_cmnd c
         JOIN edoops.esp_job_config cfg ON cfg.appl_name = c.appl_name AND cfg.jobname = c.jobname
         WHERE c.appl_name = $1${pf} ORDER BY c.jobname`,
        bp).then(r => r.rows.map((x: any) => ({ jobname: x.jobname, command: x.command ?? null, argument: x.argument ?? null }))), []),
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
        SELECT COUNT(DISTINCT jobname) AS idle_job_count FROM edoops.esp_job_cmnd WHERE appl_name = $1 AND last_run_date::timestamp < NOW() - INTERVAL '2 days'
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
