/**
 * ServiceNow routes — queries against edoops schema (PostgreSQL)
 * Source table: edoops.service_now_inc (incidents) joined with edoops.sla_glossary
 * Column prefix: sninc_
 */
import { Router, Request, Response } from 'express';
import { getPgPool } from '../db/postgres';
import {
  buildAgingOfOpenIncidentsHorizontalBarQuery,
  buildIncidentsByAssignmentGroupTop10Query,
  buildIncidentsByPlatformApplicationTop10Query,
  buildIncidentsByPriorityDonutQuery,
  buildIncidentStateOverTimeDailyStackedBarQuery,
  buildIncidentTrendDailyLineQuery,
  buildIncidentLifecycleDashboardQuery,
  buildSlaBreachRiskAlertBannerTicketsQuery,
  buildSlaPerformancePanelGaugeQuery,
  buildTopIncidentCategoriesQuery,
  buildTopIncidentsByUpdateCountQuery,
  buildTotalIncidentsDashboardQuery,
} from './queries/servicenowIncidentDashboardQueries';

const router = Router();
const SN_DEFAULT_DAYS = 7;
const SN_MAX_DAYS = 90;

function parseDays(query: any): number | null {
  const raw = String(query.days ?? SN_DEFAULT_DAYS).trim().toLowerCase();
  if (raw === 'all') return null;
  const n = parseInt(raw, 10);
  if (isNaN(n)) return SN_DEFAULT_DAYS;
  return Math.min(Math.max(n, 1), SN_MAX_DAYS);
}

// Known sninc_state values: 'new', 'In Progress', 'On Hold' (open) | 'Closed', 'Resolved', 'Canceled' (inactive)
const OPEN_INCIDENT_FILTER = `
  COALESCE(LOWER(TRIM(sn.sninc_state)), '') NOT IN ('closed', 'resolved', 'canceled')
`;

// GET /api/servicenow/incidents?platform=<value>
// Open incident count grouped by priority — no date filter, reflects current open state
router.get('/incidents', async (req: Request, res: Response) => {
  try {
    const pool = getPgPool();
    const platform = req.query.platform as string | undefined;
    const platformClause = platform
      ? `AND latest.sninc_applkp_pltf_nm = $1`
      : '';
    const params = platform ? [platform] : [];
    const result = await pool.query(`
      WITH latest_incidents AS (
        SELECT DISTINCT ON (sn.sninc_inc_num)
               sn.sninc_inc_num,
               sn.sninc_applkp_pltf_nm,
               sn.sninc_state,
               CASE sn.sninc_priority
                 WHEN '1 - Critical' THEN 'P1'
                 WHEN '2 - High' THEN 'P2'
                 WHEN '3 - Moderate' THEN 'P3'
                 WHEN '4 - Low' THEN 'P4'
                 WHEN '5 - Very Low' THEN 'P5'
               END AS priority_field
        FROM edoops.service_now_inc sn
        ORDER BY sn.sninc_inc_num, sn.sninc_last_updt_dttm::timestamp DESC NULLS LAST
      )
      SELECT latest.priority_field,
             COUNT(*)::int     AS incident_count
      FROM latest_incidents latest
      WHERE COALESCE(LOWER(TRIM(latest.sninc_state)), '') IN ('new', 'in progress', 'on hold')
        AND latest.sninc_applkp_pltf_nm IS NOT NULL
        ${platformClause}
        AND latest.priority_field IS NOT NULL
      GROUP BY latest.priority_field
      ORDER BY CASE priority_field
        WHEN 'P1' THEN 1
        WHEN 'P2' THEN 2
        WHEN 'P3' THEN 3
        WHEN 'P4' THEN 4
        WHEN 'P5' THEN 5
        ELSE 99
      END, priority_field
    `, params);
    res.json(result.rows);
  } catch (err: any) {
    console.error('ServiceNow incidents error:', err.message);
    res.status(500).json({ error: 'Query failed', details: err.message });
  }
});

// GET /api/servicenow/closed-incidents?platform=<value>
// Closed/resolved/cancelled incident count grouped by priority — no date filter, reflects current latest state
router.get('/closed-incidents', async (req: Request, res: Response) => {
  try {
    const pool = getPgPool();
    const days = parseDays(req.query);
    const recentClosedClause = days === null
      ? ''
      : `AND COALESCE(latest.sninc_closed_at, latest.sninc_resolved_at, latest.sninc_last_updt_dttm)::timestamp >= NOW() - INTERVAL '${days} days'`;
    const platform = req.query.platform as string | undefined;
    const platformClause = platform
      ? `AND latest.sninc_applkp_pltf_nm = $1`
      : '';
    const params = platform ? [platform] : [];
    const result = await pool.query(`
      WITH latest_incidents AS (
        SELECT DISTINCT ON (sn.sninc_inc_num)
               sn.sninc_inc_num,
               sn.sninc_applkp_pltf_nm,
               sn.sninc_state,
           sn.sninc_closed_at,
           sn.sninc_resolved_at,
           sn.sninc_last_updt_dttm,
               CASE sn.sninc_priority
                 WHEN '1 - Critical' THEN 'P1'
                 WHEN '2 - High' THEN 'P2'
                 WHEN '3 - Moderate' THEN 'P3'
                 WHEN '4 - Low' THEN 'P4'
                 WHEN '5 - Very Low' THEN 'P5'
               END AS priority_field
        FROM edoops.service_now_inc sn
        ORDER BY sn.sninc_inc_num, sn.sninc_last_updt_dttm::timestamp DESC NULLS LAST
      )
      SELECT latest.priority_field,
             COUNT(*)::int AS incident_count
      FROM latest_incidents latest
      WHERE COALESCE(LOWER(TRIM(latest.sninc_state)), '') IN ('closed', 'resolved', 'canceled', 'cancelled')
        ${recentClosedClause}
        AND latest.sninc_applkp_pltf_nm IS NOT NULL
        ${platformClause}
        AND latest.priority_field IS NOT NULL
      GROUP BY latest.priority_field
      ORDER BY CASE priority_field
        WHEN 'P1' THEN 1
        WHEN 'P2' THEN 2
        WHEN 'P3' THEN 3
        WHEN 'P4' THEN 4
        WHEN 'P5' THEN 5
        ELSE 99
      END, priority_field
    `, params);
    res.json(result.rows);
  } catch (err: any) {
    console.error('ServiceNow closed-incidents error:', err.message);
    res.status(500).json({ error: 'Query failed', details: err.message });
  }
});

// GET /api/servicenow/incidents-summary?platform=<value>
// Latest incident row per incident number, grouped by priority with open vs closed totals
router.get('/incidents-summary', async (req: Request, res: Response) => {
  try {
    const pool = getPgPool();
    const platform = req.query.platform as string | undefined;
    const platformClause = platform
      ? `AND latest.sninc_applkp_pltf_nm = $1`
      : '';
    const params = platform ? [platform] : [];
    const result = await pool.query(`
      WITH latest_incidents AS (
        SELECT DISTINCT ON (sn.sninc_inc_num)
               sn.sninc_inc_num,
               sn.sninc_applkp_pltf_nm,
               COALESCE(LOWER(TRIM(sn.sninc_state)), '') AS state_key,
               CASE sn.sninc_priority
                 WHEN '1 - Critical' THEN 'P1'
                 WHEN '2 - High' THEN 'P2'
                 WHEN '3 - Moderate' THEN 'P3'
                 WHEN '4 - Low' THEN 'P4'
                 WHEN '5 - Very Low' THEN 'P5'
               END AS priority_field
        FROM edoops.service_now_inc sn
        ORDER BY sn.sninc_inc_num, sn.sninc_last_updt_dttm::timestamp DESC NULLS LAST
      )
      SELECT latest.priority_field,
             COUNT(*) FILTER (WHERE latest.state_key IN ('new', 'in progress', 'on hold'))::int AS open_count,
             COUNT(*) FILTER (WHERE latest.state_key IN ('closed', 'resolved', 'canceled', 'cancelled'))::int AS closed_count
      FROM latest_incidents latest
      WHERE latest.sninc_applkp_pltf_nm IS NOT NULL
        ${platformClause}
        AND latest.priority_field IS NOT NULL
      GROUP BY latest.priority_field
      ORDER BY CASE latest.priority_field
        WHEN 'P1' THEN 1
        WHEN 'P2' THEN 2
        WHEN 'P3' THEN 3
        WHEN 'P4' THEN 4
        WHEN 'P5' THEN 5
        ELSE 99
      END, latest.priority_field
    `, params);
    res.json(result.rows);
  } catch (err: any) {
    console.error('ServiceNow incidents-summary error:', err.message);
    res.status(500).json({ error: 'Query failed', details: err.message });
  }
});

// GET /api/servicenow/missed-incidents?platform=<value>
// Open incident count with SLA metadata + breach status; optionally filtered by platform
router.get('/missed-incidents', async (req: Request, res: Response) => {
  try {
    const pool = getPgPool();
    const days = parseDays(req.query);
    const openedAtClause = days === null
      ? ''
      : `WHERE sn.sninc_opened_at::timestamp >= NOW() - INTERVAL '${days} days'`;
    const platform = req.query.platform as string | undefined;
    const platformClause = platform ? `AND sn.sninc_applkp_pltf_nm = $1 AND sn.sninc_applkp_pltf_nm is not null` : `AND sn.sninc_applkp_pltf_nm is not null`;
    const params = platform ? [platform] : [];
    const result = await pool.query(`
      SELECT sg.short_priority AS priority_field,
             COUNT(*)::int AS incident_count,
             COUNT(CASE WHEN sla_breached THEN 1 END)::int AS breached_count,
             MAX(sg.response_sla) AS response_sla,
             MAX(sg.resolution_sla) AS resolution_sla,
             MAX(sg.details_url) AS details_url
      FROM (
        SELECT DISTINCT ON (sn.sninc_inc_num)
               sn.sninc_priority,
               sn.sninc_applkp_pltf_nm,
               CASE
                 WHEN EXTRACT(EPOCH FROM (NOW() - sn.sninc_opened_at::timestamp)) / 3600 >
                      SUBSTRING(sg.resolution_sla, 1, POSITION(' ' IN sg.resolution_sla) - 1)::int *
                      CASE WHEN sg.resolution_sla ILIKE '%day%' THEN 24
                           WHEN sg.resolution_sla ILIKE '%hr%' THEN 1
                           ELSE 1 END
                 THEN true
                 ELSE false
               END AS sla_breached
        FROM edoops.service_now_inc sn
        JOIN edoops.sla_glossary sg
          ON sn.sninc_priority = sg.snow_priority
        ${openedAtClause}
        ORDER BY sn.sninc_inc_num, sn.sninc_last_updt_dttm DESC
      ) sn
      JOIN edoops.sla_glossary sg
        ON sn.sninc_priority = sg.snow_priority
      WHERE sg.short_priority IN ('P1', 'P2', 'P3', 'P4', 'P5')
        ${platformClause}
      GROUP BY sg.short_priority, sg.response_sla, sg.resolution_sla, sg.details_url
      ORDER BY incident_count DESC,
        CASE sg.short_priority
          WHEN 'P1' THEN 1
          WHEN 'P2' THEN 2
          WHEN 'P3' THEN 3
          WHEN 'P4' THEN 4
          ELSE 99
        END, sg.short_priority
    `, params);
    res.json(result.rows);
  } catch (err: any) {
    console.error('ServiceNow missed-incidents error:', err.message);
    res.status(500).json({ error: 'Query failed', details: err.message });
  }
});

// GET /api/servicenow/incident-list?platform=<value>
// All incident records (all states), most recent row per incident number, filtered by days
router.get('/incident-list', async (req: Request, res: Response) => {
  try {
    const pool = getPgPool();
    const days = parseDays(req.query);
    const recentClosedClause = days === null
      ? ''
      : `
            OR sn.sninc_closed_at::timestamp >= NOW() - INTERVAL '${days} days'
            OR (COALESCE(sn.sninc_resolved_at, sn.sninc_last_updt_dttm)::timestamp >= NOW() - INTERVAL '${days} days')`;
    const platform = req.query.platform as string | undefined;
    const platformClause = platform ? `AND latest.sninc_applkp_pltf_nm = $1` : '';
    const params = platform ? [platform] : [];
    const result = await pool.query(`
      SELECT latest.sninc_inc_num,
             sg.short_priority AS priority_field,
             latest.sninc_state,
             latest.sninc_opened_at,
             latest.sninc_last_updt_dttm,
             latest.sninc_capability,
             latest.sninc_short_desc,
             latest.sninc_assignment_grp
      FROM (
        select * from (
          SELECT sninc_inc_num,
                 sninc_priority,
                 sninc_state,
                 sninc_capability,
                 sninc_short_desc,
                 sninc_opened_at,
                 sninc_assignment_grp,
                 sninc_applkp_pltf_nm,
                 sninc_closed_at,
                 sninc_resolved_at,
                 sninc_last_updt_dttm,
                 ROW_NUMBER() over(
                   partition by sninc_inc_num
                   order by sninc_last_updt_dttm desc
                 ) as latest_rec
          FROM edoops.service_now_inc
        ) sn
        WHERE sn.latest_rec = 1
          AND sn.sninc_applkp_pltf_nm IS NOT NULL
          AND (
            COALESCE(LOWER(TRIM(sn.sninc_state)), '') NOT IN ('closed', 'resolved', 'canceled')
            ${recentClosedClause}
          )
        ORDER BY sn.sninc_opened_at, sn.sninc_inc_num, sn.sninc_last_updt_dttm DESC
      ) latest
      JOIN edoops.sla_glossary sg ON latest.sninc_priority = sg.snow_priority
      WHERE 1=1
        ${platformClause}
    `, params);
    res.json(result.rows);
  } catch (err: any) {
    console.error('ServiceNow incident-list error:', err.message);
    res.status(500).json({ error: 'Query failed', details: err.message });
  }
});

// GET /api/servicenow/emergency-changes?platform=<value>
// Open Emergency Changes (service_now_chg) by priority; optionally filtered by platform
router.get('/emergency-changes', async (req: Request, res: Response) => {
  try {
    const pool = getPgPool();
    const days = parseDays(req.query);
    const platform = req.query.platform as string | undefined;
    const platformClause = platform ? `AND sn.snchg_pltf_nm = $1` : '';
    const openedClause = days === null
      ? ''
      : `AND COALESCE(sn.snchg_opened_at_dttm, sn.snchg_plnd_start_dttm, sn.snchg_last_updt_dttm)::timestamp >= NOW() - INTERVAL '${days} days'`;
    const params = platform ? [platform] : [];
    const result = await pool.query(`
      SELECT sg.short_priority AS priority_field,
             COUNT(*)::int     AS incident_count
      FROM   edoops.service_now_chg sn
      JOIN   edoops.sla_glossary    sg
        ON   sn.snchg_priority = sg.snow_priority
      WHERE  sg.short_priority IN ('P1','P2','P3')
        ${openedClause}
        ${platformClause}
      GROUP BY sg.short_priority
      ORDER BY sg.short_priority
    `, params);
    res.json(result.rows);
  } catch (err: any) {
    console.error('ServiceNow emergency-changes error:', err.message);
    res.status(500).json({ error: 'Query failed', details: err.message });
  }
});

// GET /api/servicenow/changes-opened?platform=<value>&days=<n>
// Opened change count grouped by priority using opened/planned start timestamps
router.get('/changes-opened', async (req: Request, res: Response) => {
  try {
    const pool = getPgPool();
    const days = parseDays(req.query);
    const platform = req.query.platform as string | undefined;
    const platformClause = platform ? `AND sn.snchg_pltf_nm = $1` : '';
    const openedClause = days === null
      ? ''
      : `AND COALESCE(sn.snchg_opened_at_dttm, sn.snchg_plnd_start_dttm, sn.snchg_last_updt_dttm)::timestamp >= NOW() - INTERVAL '${days} days'`;
    const params = platform ? [platform] : [];
    const result = await pool.query(`
      SELECT sg.short_priority AS priority_field,
             COUNT(*)::int AS incident_count
      FROM edoops.service_now_chg sn
      JOIN edoops.sla_glossary sg
        ON sn.snchg_priority = sg.snow_priority
      WHERE sg.short_priority IN ('P1', 'P2', 'P3', 'P4', 'P5')
        AND sn.snchg_pltf_nm IS NOT NULL
        ${openedClause}
        ${platformClause}
      GROUP BY sg.short_priority
      ORDER BY CASE sg.short_priority
        WHEN 'P1' THEN 1
        WHEN 'P2' THEN 2
        WHEN 'P3' THEN 3
        WHEN 'P4' THEN 4
        WHEN 'P5' THEN 5
        ELSE 99
      END, sg.short_priority
    `, params);
    res.json(result.rows);
  } catch (err: any) {
    console.error('ServiceNow changes-opened error:', err.message);
    res.status(500).json({ error: 'Query failed', details: err.message });
  }
});

// GET /api/servicenow/changes-closed?platform=<value>&days=<n>
// Closed change count grouped by priority using closed/planned end/latest update timestamps
router.get('/changes-closed', async (req: Request, res: Response) => {
  try {
    const pool = getPgPool();
    const days = parseDays(req.query);
    const platform = req.query.platform as string | undefined;
    const platformClause = platform ? `AND sn.snchg_pltf_nm = $1` : '';
    const closedClause = days === null
      ? ''
      : `AND COALESCE(sn.snchg_closed_at_dttm, sn.snchg_plnd_end_dttm, sn.snchg_last_updt_dttm)::timestamp >= NOW() - INTERVAL '${days} days'`;
    const params = platform ? [platform] : [];
    const result = await pool.query(`
      SELECT sg.short_priority AS priority_field,
             COUNT(*)::int AS incident_count
      FROM edoops.service_now_chg sn
      JOIN edoops.sla_glossary sg
        ON sn.snchg_priority = sg.snow_priority
      WHERE sg.short_priority IN ('P1', 'P2', 'P3', 'P4', 'P5')
        AND sn.snchg_pltf_nm IS NOT NULL
        AND COALESCE(sn.snchg_closed_at_dttm, sn.snchg_plnd_end_dttm) IS NOT NULL
        ${closedClause}
        ${platformClause}
      GROUP BY sg.short_priority
      ORDER BY CASE sg.short_priority
        WHEN 'P1' THEN 1
        WHEN 'P2' THEN 2
        WHEN 'P3' THEN 3
        WHEN 'P4' THEN 4
        WHEN 'P5' THEN 5
        ELSE 99
      END, sg.short_priority
    `, params);
    res.json(result.rows);
  } catch (err: any) {
    console.error('ServiceNow changes-closed error:', err.message);
    res.status(500).json({ error: 'Query failed', details: err.message });
  }
});

// GET /api/servicenow/changes-by-platform?platform=<value>&days=<n>
// Change counts grouped by platform using opened/planned start/latest update timestamps
router.get('/changes-by-platform', async (req: Request, res: Response) => {
  try {
    const pool = getPgPool();
    const days = parseDays(req.query);
    const platform = req.query.platform as string | undefined;
    const platformClause = platform ? `AND sn.snchg_pltf_nm = $1` : '';
    const openedClause = days === null
      ? ''
      : `AND COALESCE(sn.snchg_opened_at_dttm, sn.snchg_plnd_start_dttm, sn.snchg_last_updt_dttm)::timestamp >= NOW() - INTERVAL '${days} days'`;
    const params = platform ? [platform] : [];
    const result = await pool.query(`
      SELECT sn.snchg_pltf_nm AS platform,
             COUNT(*)::int AS incident_count
      FROM edoops.service_now_chg sn
      WHERE sn.snchg_pltf_nm IS NOT NULL
        ${openedClause}
        ${platformClause}
      GROUP BY sn.snchg_pltf_nm
      ORDER BY incident_count DESC, sn.snchg_pltf_nm
      LIMIT 10
    `, params);
    res.json(result.rows);
  } catch (err: any) {
    console.error('ServiceNow changes-by-platform error:', err.message);
    res.status(500).json({ error: 'Query failed', details: err.message });
  }
});

// GET /api/servicenow/incident-detail?priority=P1&platform=<value>
// Full open incident records for a given priority — no date filter, matches Open Incidents by Priority KPI
router.get('/incident-detail', async (req: Request, res: Response) => {
  try {
    const pool = getPgPool();
    const priority = req.query.priority as string | undefined;
    const platform = req.query.platform as string | undefined;
    const priorities = priority ? [priority] : ['P1', 'P2', 'P3', 'P4', 'P5'];
    const params: any[] = [priorities];
    let platformClause = '';
    if (platform) {
      params.push(platform);
      platformClause = `AND latest.sninc_applkp_pltf_nm = $${params.length}`;
    }
    const result = await pool.query(`
      SELECT sninc_inc_num, priority_field, sninc_capability, sninc_short_desc, sninc_assignment_grp, response_sla, resolution_sla,
             sninc_opened_at, sninc_last_updt_dttm,
             EXTRACT(EPOCH FROM (NOW() - sninc_opened_at::timestamp)) / 3600 AS elapsed_hours,
             CASE 
               WHEN EXTRACT(EPOCH FROM (NOW() - sninc_opened_at::timestamp)) / 3600 > 
                    SUBSTRING(resolution_sla, 1, POSITION(' ' IN resolution_sla) - 1)::int * 
                    CASE WHEN resolution_sla ILIKE '%day%' THEN 24
                         WHEN resolution_sla ILIKE '%hr%' THEN 1
                         ELSE 1 END
               THEN true
               ELSE false
             END AS sla_breached
      FROM (
        SELECT DISTINCT ON (sn.sninc_inc_num)
               sn.sninc_inc_num        AS sninc_inc_num,
               sg.short_priority       AS priority_field,
               sn.sninc_capability     AS sninc_capability,
               sn.sninc_short_desc     AS sninc_short_desc,
               sn.sninc_assignment_grp AS sninc_assignment_grp,
               sg.response_sla         AS response_sla,
               sg.resolution_sla       AS resolution_sla,
               sn.sninc_opened_at      AS sninc_opened_at,
               sn.sninc_last_updt_dttm AS sninc_last_updt_dttm,
               sn.sninc_applkp_pltf_nm
        FROM   edoops.service_now_inc sn
        JOIN   edoops.sla_glossary    sg
          ON   sn.sninc_priority = sg.snow_priority
        WHERE  ${OPEN_INCIDENT_FILTER}
        ORDER BY sn.sninc_inc_num, sn.sninc_last_updt_dttm DESC
      ) latest
      WHERE  priority_field = ANY($1)
        ${platformClause}
    `, params);
    res.json(result.rows);
  } catch (err: any) {
    console.error('ServiceNow incident-detail error:', err.message);
    res.status(500).json({ error: 'Query failed', details: err.message });
  }
});

// GET /api/servicenow/by-capability?platform=<value>
// All incident counts (all statuses) grouped by capability, most recent per incident
router.get('/by-capability', async (req: Request, res: Response) => {
  try {
    const pool = getPgPool();
    const days = parseDays(req.query);
    const openedAtClause = days === null
      ? ''
      : `and sn.sninc_opened_at::timestamp >= NOW() - INTERVAL '${days} days'`;
    const platform = req.query.platform as string | undefined;
    const platformClause = platform ? `AND sn.sninc_applkp_pltf_nm IS NOT NULL AND sn.sninc_applkp_pltf_nm = $1` : `AND sn.sninc_applkp_pltf_nm IS NOT NULL`;
    const params = platform ? [platform] : [];
    const result = await pool.query(`
      select sninc_capability AS capability,
             COUNT(*)::int AS incident_count
      FROM (
        select sn.sninc_inc_num,
               sn.sninc_capability,
               sn.sninc_applkp_pltf_nm
        from (
          SELECT sninc_inc_num,
                 sninc_capability,
                 sninc_applkp_pltf_nm,
                 sninc_opened_at,
                 ROW_NUMBER() over(
                   partition by sninc_inc_num
                   order by sninc_last_updt_dttm desc
                 ) as latest_rec
          FROM edoops.service_now_inc
        ) sn
        WHERE sn.latest_rec = 1
          ${platformClause}
          ${openedAtClause}
          AND sn.sninc_capability IS NOT NULL
      )
      GROUP BY sninc_capability
      ORDER BY incident_count DESC
      LIMIT 10
    `, params);
    res.json(result.rows);
  } catch (err: any) {
    console.error('ServiceNow by-capability error:', err.message);
    res.status(500).json({ error: 'Query failed', details: err.message });
  }
});

// GET /api/servicenow/by-assignment-group?platform=<value>
// All incident counts (all statuses) grouped by assignment group, most recent per incident
router.get('/by-assignment-group', async (req: Request, res: Response) => {
  try {
    const pool = getPgPool();
    const days = parseDays(req.query);
    const openedAtClause = days === null
      ? ''
      : `AND sn.sninc_opened_at::timestamp >= NOW() - INTERVAL '${days} days'`;
    const platform = req.query.platform as string | undefined;
    const platformClause = platform ? `AND sn.sninc_applkp_pltf_nm IS NOT NULL AND sn.sninc_applkp_pltf_nm = $1` : `AND sn.sninc_applkp_pltf_nm IS NOT NULL`;
    const params = platform ? [platform] : [];
    const result = await pool.query(`
      select sninc_assignment_grp AS assignment_group,
             COUNT(*)::int AS incident_count
      FROM (
        select sn.sninc_inc_num,
               sn.sninc_assignment_grp,
               sn.sninc_applkp_pltf_nm
        from (
          SELECT sninc_inc_num,
                 sninc_assignment_grp,
                 sninc_applkp_pltf_nm,
                 sninc_opened_at,
                 ROW_NUMBER() over(
                   partition by sninc_inc_num
                   order by sninc_last_updt_dttm desc
                 ) as latest_rec
          FROM edoops.service_now_inc
        ) sn
        WHERE sn.latest_rec = 1
          ${platformClause}
          ${openedAtClause}
          AND sn.sninc_assignment_grp IS NOT NULL
      )
      GROUP BY sninc_assignment_grp
      ORDER BY incident_count DESC
      LIMIT 10
    `, params);
    res.json(result.rows);
  } catch (err: any) {
    console.error('ServiceNow by-assignment-group error:', err.message);
    res.status(500).json({ error: 'Query failed', details: err.message });
  }
});

// GET /api/servicenow/platforms?days=7
// All non-null platform names with a flag if they have any active P1/P2 incidents
// GET /api/servicenow/incidents-dashboard-summary?platform=<value>&days=<n>
// Summary cards for the revamped incidents overview first section
router.get('/incidents-dashboard-summary', async (req: Request, res: Response) => {
  try {
    const pool = getPgPool();
    const platform = (req.query.platform as string | undefined)?.trim() || undefined;
    const days = parseDays(req.query);
    const params = platform ? [platform] : [];

    const [totalsResult, lifecycleResult] = await Promise.all([
      pool.query(buildTotalIncidentsDashboardQuery(days, Boolean(platform)), params),
      pool.query(buildIncidentLifecycleDashboardQuery(days, Boolean(platform)), params),
    ]);

    const totals = (totalsResult.rows[0] ?? {}) as Record<string, unknown>;
    const lifecycle = (lifecycleResult.rows[0] ?? {}) as Record<string, unknown>;
    res.json({
      days: days ?? 'all',
      platform: platform ?? null,
      total_incidents: Number(totals.total_incidents ?? 0),
      current_90d: Number(totals.current_90d ?? 0),
      prev_90d: Number(totals.prev_90d ?? 0),
      new_current: Number(lifecycle.new_current ?? 0),
      open_current: Number(lifecycle.open_current ?? 0),
      closed_current: Number(lifecycle.closed_current ?? 0),
      reopened_current: Number(lifecycle.reopened_current ?? 0),
      new_prev: Number(lifecycle.new_prev ?? 0),
      open_prev: Number(lifecycle.open_prev ?? 0),
      closed_prev: Number(lifecycle.closed_prev ?? 0),
      reopened_prev: Number(lifecycle.reopened_prev ?? 0),
    });
  } catch (err: any) {
    console.error('ServiceNow incidents-dashboard-summary error:', err.message);
    res.status(500).json({ error: 'Query failed', details: err.message });
  }
});

// GET /api/servicenow/incident-trend?platform=<value>&days=<n>
// Daily count of incidents by open/closed status (most recent row per incident per day)
router.get('/incident-trend', async (req: Request, res: Response) => {
  try {
    const pool = getPgPool();
    const result = await pool.query(buildIncidentTrendDailyLineQuery());
    res.json(result.rows.map((r: any) => ({
      day: r.incident_date ?? null,
      total: Number(r.incident_count ?? 0),
    })));
  } catch (err: any) {
    console.error('ServiceNow incident-trend error:', err.message);
    res.status(500).json({ error: 'Query failed', details: err.message });
  }
});

// GET /api/servicenow/incident-state-daily?platform=<value>&days=<n>
// Daily state breakdown using the latest row per incident per day
router.get('/incident-state-daily', async (req: Request, res: Response) => {
  try {
    const pool = getPgPool();
    const result = await pool.query(buildIncidentStateOverTimeDailyStackedBarQuery());
    res.json(result.rows.map((r: any) => ({
      day: r.incident_date ?? null,
      new: Number(r.new_count ?? 0),
      open: Number(r.open_count ?? 0),
      closed: Number(r.closed_count ?? 0),
      total: Number(r.total_count ?? 0),
    })));
  } catch (err: any) {
    console.error('ServiceNow incident-state-daily error:', err.message);
    res.status(500).json({ error: 'Query failed', details: err.message });
  }
});

// GET /api/servicenow/by-platform?platform=<value>&days=<n>
// Top 10 platforms by incident count using latest row per incident
router.get('/by-platform', async (req: Request, res: Response) => {
  try {
    const pool = getPgPool();
    const days = parseDays(req.query);
    const openedAtClause = days === null
      ? ''
      : `AND latest.sninc_opened_at::timestamp >= NOW() - INTERVAL '${days} days'`;
    const platform = req.query.platform as string | undefined;
    const platformClause = platform ? `AND latest.sninc_applkp_pltf_nm = $1` : '';
    const params = platform ? [platform] : [];
    const result = await pool.query(`
      SELECT latest.sninc_applkp_pltf_nm AS platform,
             COUNT(*)::int AS incident_count
      FROM (
        SELECT DISTINCT ON (sn.sninc_inc_num)
               sn.sninc_inc_num,
               sn.sninc_applkp_pltf_nm,
               sn.sninc_opened_at
        FROM edoops.service_now_inc sn
        ORDER BY sn.sninc_inc_num, sn.sninc_last_updt_dttm::timestamp DESC NULLS LAST
      ) latest
      WHERE latest.sninc_applkp_pltf_nm IS NOT NULL
        ${platformClause}
        ${openedAtClause}
      GROUP BY latest.sninc_applkp_pltf_nm
      ORDER BY incident_count DESC, latest.sninc_applkp_pltf_nm
      LIMIT 10
    `, params);
    res.json(result.rows);
  } catch (err: any) {
    console.error('ServiceNow by-platform error:', err.message);
    res.status(500).json({ error: 'Query failed', details: err.message });
  }
});

// GET /api/servicenow/top-incident-updates?platform=<value>
// Top 10 incident numbers by update volume over the last 90 days
router.get('/top-incident-updates', async (req: Request, res: Response) => {
  try {
    const pool = getPgPool();
    const platform = req.query.platform as string | undefined;
    const platformClause = platform ? `AND sn.sninc_applkp_pltf_nm = $1` : '';
    const params = platform ? [platform] : [];
    const result = await pool.query(`
      SELECT sn.sninc_inc_num,
             COUNT(*)::int AS updates_count,
             (ARRAY_AGG(sn.sninc_state ORDER BY sn.sninc_last_updt_dttm::timestamp DESC NULLS LAST))[1] AS current_state,
             MAX(sn.sninc_last_updt_dttm)::text AS last_updated_at
      FROM edoops.service_now_inc sn
      WHERE sn.sninc_last_updt_dttm::timestamp >= NOW() - INTERVAL '90 days'
        ${platformClause}
      GROUP BY sn.sninc_inc_num
      ORDER BY updates_count DESC, MAX(sn.sninc_last_updt_dttm::timestamp) DESC NULLS LAST
      LIMIT 10
    `, params);
    res.json(result.rows);
  } catch (err: any) {
    console.error('ServiceNow top-incident-updates error:', err.message);
    res.status(500).json({ error: 'Query failed', details: err.message });
  }
});

// GET /api/servicenow/incidents-assignment-group-top10
// Widget 6: Incidents by Assignment Group (top 10 horizontal bars)
router.get('/incidents-assignment-group-top10', async (_req: Request, res: Response) => {
  try {
    const pool = getPgPool();
    const result = await pool.query(buildIncidentsByAssignmentGroupTop10Query());
    res.json(result.rows);
  } catch (err: any) {
    console.error('ServiceNow incidents-assignment-group-top10 error:', err.message);
    res.status(500).json({ error: 'Query failed', details: err.message });
  }
});

// GET /api/servicenow/incidents-platform-application-top10
// Widget 7: Incidents by Platform/Application (top 10 horizontal bars)
router.get('/incidents-platform-application-top10', async (_req: Request, res: Response) => {
  try {
    const pool = getPgPool();
    const result = await pool.query(buildIncidentsByPlatformApplicationTop10Query());
    res.json(result.rows);
  } catch (err: any) {
    console.error('ServiceNow incidents-platform-application-top10 error:', err.message);
    res.status(500).json({ error: 'Query failed', details: err.message });
  }
});

// GET /api/servicenow/incidents-priority-donut
// Widget 8: Incidents by Priority (donut chart)
router.get('/incidents-priority-donut', async (_req: Request, res: Response) => {
  try {
    const pool = getPgPool();
    const result = await pool.query(buildIncidentsByPriorityDonutQuery());
    res.json(result.rows);
  } catch (err: any) {
    console.error('ServiceNow incidents-priority-donut error:', err.message);
    res.status(500).json({ error: 'Query failed', details: err.message });
  }
});

// GET /api/servicenow/sla-performance-panel
// Widget 9: SLA performance panel (gauge)
router.get('/sla-performance-panel', async (_req: Request, res: Response) => {
  try {
    const pool = getPgPool();
    const result = await pool.query(buildSlaPerformancePanelGaugeQuery());
    res.json(result.rows[0] ?? {
      within_sla: 0,
      breaching_soon: 0,
      breached: 0,
      total_open: 0,
      within_sla_pct: 0,
    });
  } catch (err: any) {
    console.error('ServiceNow sla-performance-panel error:', err.message);
    res.status(500).json({ error: 'Query failed', details: err.message });
  }
});

// GET /api/servicenow/sla-breach-risk-alert-tickets
// Widget 10: SLA breach risk tickets within the next 4 hours
router.get('/sla-breach-risk-alert-tickets', async (_req: Request, res: Response) => {
  try {
    const pool = getPgPool();
    const result = await pool.query(buildSlaBreachRiskAlertBannerTicketsQuery());
    res.json(result.rows);
  } catch (err: any) {
    console.error('ServiceNow sla-breach-risk-alert-tickets error:', err.message);
    res.status(500).json({ error: 'Query failed', details: err.message });
  }
});

// GET /api/servicenow/open-incident-ageing
// Widget 11: Aging buckets for open incidents
router.get('/open-incident-ageing', async (_req: Request, res: Response) => {
  try {
    const pool = getPgPool();
    const result = await pool.query(buildAgingOfOpenIncidentsHorizontalBarQuery());
    res.json(result.rows);
  } catch (err: any) {
    console.error('ServiceNow open-incident-ageing error:', err.message);
    res.status(500).json({ error: 'Query failed', details: err.message });
  }
});

// GET /api/servicenow/top-incident-categories
// Widget 12: Top 5 open incident categories
router.get('/top-incident-categories', async (_req: Request, res: Response) => {
  try {
    const pool = getPgPool();
    const result = await pool.query(buildTopIncidentCategoriesQuery());
    res.json(result.rows);
  } catch (err: any) {
    console.error('ServiceNow top-incident-categories error:', err.message);
    res.status(500).json({ error: 'Query failed', details: err.message });
  }
});

// GET /api/servicenow/top-incidents-by-update-count
// Widget 13: Most frequently updated incidents
router.get('/top-incidents-by-update-count', async (_req: Request, res: Response) => {
  try {
    const pool = getPgPool();
    const result = await pool.query(buildTopIncidentsByUpdateCountQuery());
    res.json(result.rows);
  } catch (err: any) {
    console.error('ServiceNow top-incidents-by-update-count error:', err.message);
    res.status(500).json({ error: 'Query failed', details: err.message });
  }
});

router.get('/platforms', async (req: Request, res: Response) => {
  try {
    const pool = getPgPool();
    const days = parseDays(req.query);
    const result = await pool.query(`
      SELECT DISTINCT sn.sninc_applkp_pltf_nm AS platform,
             BOOL_OR(sg.short_priority IN ('P1','P2')) AS has_critical
      FROM   edoops.service_now_inc sn
      LEFT JOIN edoops.sla_glossary sg
        ON sn.sninc_priority = sg.snow_priority
      WHERE  sn.sninc_applkp_pltf_nm IS NOT NULL
      GROUP BY sn.sninc_applkp_pltf_nm
      ORDER BY sn.sninc_applkp_pltf_nm
    `);
    res.json(result.rows.map((r: any) => ({
      platform:    r.platform,
      hasCritical: r.has_critical === true,
    })));
  } catch (err: any) {
    console.error('ServiceNow platforms error:', err.message);
    res.status(500).json({ error: 'Query failed', details: err.message });
  }
});

export default router;
