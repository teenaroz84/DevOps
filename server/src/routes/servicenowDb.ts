/**
 * ServiceNow routes — queries against edoops schema (PostgreSQL)
 * Source table: edoops.service_now_inc (incidents) joined with edoops.sla_glossary
 * Column prefix: sninc_
 */
import { Router, Request, Response } from 'express';
import { getPgPool } from '../db/postgres';

const router = Router();

// ServiceNow incident tables are not fully normalized across environments.
// Use to_jsonb(...) so missing candidate fields simply yield NULL instead of
// breaking the query, then exclude common terminal states.
const OPEN_INCIDENT_FILTER = `
  COALESCE(LOWER(to_jsonb(sn) ->> 'sninc_active'), '') NOT IN ('false', 'f', '0', 'no', 'n')
  AND COALESCE(
    LOWER(to_jsonb(sn) ->> 'sninc_status'),
    LOWER(to_jsonb(sn) ->> 'sninc_state'),
    LOWER(to_jsonb(sn) ->> 'sninc_inc_state'),
    LOWER(to_jsonb(sn) ->> 'sninc_close_state'),
    ''
  ) NOT IN ('closed', 'resolved', 'cancelled', 'canceled', 'complete', 'completed')
`;

// GET /api/servicenow/incidents?platform=<value>
// Open P1/P2 incident count grouped by priority; optionally filtered by platform
router.get('/incidents', async (req: Request, res: Response) => {
  try {
    const pool = getPgPool();
    const platform = req.query.platform as string | undefined;
    const platformClause = platform ? `AND sn.sninc_applkp_pltf_nm = $1` : '';
    const params = platform ? [platform] : [];
    const result = await pool.query(`
      SELECT sg.short_priority AS priority_field,
             COUNT(*)::int     AS incident_count
      FROM (
        SELECT DISTINCT ON (sn.sninc_inc_num)
               sn.sninc_priority,
               sn.sninc_applkp_pltf_nm
        FROM   edoops.service_now_inc sn
         WHERE  ${OPEN_INCIDENT_FILTER}
        ORDER BY sn.sninc_inc_num, sn.sninc_last_updt_dttm DESC
      ) sn
      JOIN   edoops.sla_glossary sg
        ON   sn.sninc_priority = sg.snow_priority
      WHERE  sg.short_priority IN ('P1','P2')
        ${platformClause}
      GROUP BY sg.short_priority
      ORDER BY sg.short_priority
    `, params);
    res.json(result.rows);
  } catch (err: any) {
    console.error('ServiceNow incidents error:', err.message);
    res.status(500).json({ error: 'Query failed', details: err.message });
  }
});

// GET /api/servicenow/missed-incidents?platform=<value>
// Open P3/P4 incident count for "missed SLA" bar chart; optionally filtered by platform
router.get('/missed-incidents', async (req: Request, res: Response) => {
  try {
    const pool = getPgPool();
    const platform = req.query.platform as string | undefined;
    const platformClause = platform ? `AND sn.sninc_applkp_pltf_nm = $1` : '';
    const params = platform ? [platform] : [];
    const result = await pool.query(`
      SELECT sg.short_priority AS priority_field,
             COUNT(*)::int     AS incident_count
      FROM (
        SELECT DISTINCT ON (sn.sninc_inc_num)
               sn.sninc_priority,
               sn.sninc_applkp_pltf_nm
        FROM   edoops.service_now_inc sn
         WHERE  ${OPEN_INCIDENT_FILTER}
        ORDER BY sn.sninc_inc_num, sn.sninc_last_updt_dttm DESC
      ) sn
      JOIN   edoops.sla_glossary sg
        ON   sn.sninc_priority = sg.snow_priority
      WHERE  sg.short_priority IN ('P3','P4')
        ${platformClause}
      GROUP BY sg.short_priority
      ORDER BY sg.short_priority
    `, params);
    res.json(result.rows);
  } catch (err: any) {
    console.error('ServiceNow missed-incidents error:', err.message);
    res.status(500).json({ error: 'Query failed', details: err.message });
  }
});

// GET /api/servicenow/incident-list?platform=<value>
// All open incident records; optionally filtered by platform
router.get('/incident-list', async (req: Request, res: Response) => {
  try {
    const pool = getPgPool();
    const platform = req.query.platform as string | undefined;
    const platformClause = platform ? `AND latest.sninc_applkp_pltf_nm = $1` : '';
    const params = platform ? [platform] : [];
    const result = await pool.query(`
      SELECT sninc_inc_num, priority_field, sninc_capability, sninc_short_desc, sninc_assignment_grp
      FROM (
        SELECT DISTINCT ON (sn.sninc_inc_num)
               sn.sninc_inc_num        AS sninc_inc_num,
               sg.short_priority       AS priority_field,
               sn.sninc_capability     AS sninc_capability,
               sn.sninc_short_desc     AS sninc_short_desc,
               sn.sninc_assignment_grp AS sninc_assignment_grp,
               sn.sninc_applkp_pltf_nm
        FROM   edoops.service_now_inc sn
        JOIN   edoops.sla_glossary    sg
          ON   sn.sninc_priority = sg.snow_priority
        WHERE  ${OPEN_INCIDENT_FILTER}
        ORDER BY sn.sninc_inc_num, sn.sninc_last_updt_dttm DESC
      ) latest
      WHERE  1=1
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
    const platform = req.query.platform as string | undefined;
    const platformClause = platform ? `AND sn.snchg_pltf_nm = $1` : '';
    const params = platform ? [platform] : [];
    const result = await pool.query(`
      SELECT sg.short_priority AS priority_field,
             COUNT(*)::int     AS incident_count
      FROM   edoops.service_now_chg sn
      JOIN   edoops.sla_glossary    sg
        ON   sn.snchg_priority = sg.snow_priority
      WHERE  sg.short_priority IN ('P1','P2','P3')
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

// GET /api/servicenow/incident-detail?priority=P1&platform=<value>
// Full incident records for a given priority; optionally filtered by platform
router.get('/incident-detail', async (req: Request, res: Response) => {
  try {
    const pool = getPgPool();
    const priority = req.query.priority as string | undefined;
    const platform = req.query.platform as string | undefined;
    const priorities = priority ? [priority] : ['P1', 'P2', 'P3', 'P4'];
    const params: any[] = [priorities];
    let platformClause = '';
    if (platform) {
      params.push(platform);
      platformClause = `AND latest.sninc_applkp_pltf_nm = $${params.length}`;
    }
    const result = await pool.query(`
      SELECT sninc_inc_num, priority_field, sninc_capability, sninc_short_desc, sninc_assignment_grp
      FROM (
        SELECT DISTINCT ON (sn.sninc_inc_num)
               sn.sninc_inc_num        AS sninc_inc_num,
               sg.short_priority       AS priority_field,
               sn.sninc_capability     AS sninc_capability,
               sn.sninc_short_desc     AS sninc_short_desc,
               sn.sninc_assignment_grp AS sninc_assignment_grp,
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
// Open incident counts grouped by capability
router.get('/by-capability', async (req: Request, res: Response) => {
  try {
    const pool = getPgPool();
    const platform = req.query.platform as string | undefined;
    const platformClause = platform ? `AND latest.sninc_applkp_pltf_nm = $1` : '';
    const params = platform ? [platform] : [];
    const result = await pool.query(`
      SELECT sninc_capability AS capability,
             COUNT(*)::int    AS incident_count
      FROM (
        SELECT DISTINCT ON (sn.sninc_inc_num)
               sn.sninc_capability,
               sn.sninc_applkp_pltf_nm
        FROM   edoops.service_now_inc sn
         WHERE  ${OPEN_INCIDENT_FILTER}
        ORDER BY sn.sninc_inc_num, sn.sninc_last_updt_dttm DESC
      ) latest
      WHERE  sninc_capability IS NOT NULL
        ${platformClause}
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
// Open incident counts grouped by assignment group
router.get('/by-assignment-group', async (req: Request, res: Response) => {
  try {
    const pool = getPgPool();
    const platform = req.query.platform as string | undefined;
    const platformClause = platform ? `AND latest.sninc_applkp_pltf_nm = $1` : '';
    const params = platform ? [platform] : [];
    const result = await pool.query(`
      SELECT sninc_assignment_grp AS assignment_group,
             COUNT(*)::int        AS incident_count
      FROM (
        SELECT DISTINCT ON (sn.sninc_inc_num)
               sn.sninc_assignment_grp,
               sn.sninc_applkp_pltf_nm
        FROM   edoops.service_now_inc sn
         WHERE  ${OPEN_INCIDENT_FILTER}
        ORDER BY sn.sninc_inc_num, sn.sninc_last_updt_dttm DESC
      ) latest
      WHERE  sninc_assignment_grp IS NOT NULL
        ${platformClause}
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

// GET /api/servicenow/platforms
// All non-null platform names with a flag if they have any active P1/P2 incidents
router.get('/platforms', async (_req: Request, res: Response) => {
  try {
    const pool = getPgPool();
    const result = await pool.query(`
      SELECT platform, BOOL_OR(priority_field IN ('P1','P2')) AS has_critical
      FROM (
        SELECT DISTINCT ON (sn.sninc_inc_num)
               sn.sninc_applkp_pltf_nm AS platform,
               sg.short_priority       AS priority_field
        FROM   edoops.service_now_inc sn
        LEFT JOIN edoops.sla_glossary sg
          ON sn.sninc_priority = sg.snow_priority
        WHERE  sn.sninc_applkp_pltf_nm IS NOT NULL
          AND ${OPEN_INCIDENT_FILTER}
        ORDER BY sn.sninc_inc_num, sn.sninc_last_updt_dttm DESC
      ) latest
      GROUP BY platform
      ORDER BY platform
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
