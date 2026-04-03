/**
 * ServiceNow routes — queries against edoops schema (PostgreSQL)
 * Source table: edoops.service_now_inc (incidents) joined with edoops.sla_glossary
 * Column prefix: sninc_
 */
import { Router, Request, Response } from 'express';
import { getPgPool } from '../db/postgres';

const router = Router();

// GET /api/servicenow/incidents
// Open P1/P2/P3 incident count grouped by priority
router.get('/incidents', async (_req: Request, res: Response) => {
  try {
    const pool = getPgPool();
    const result = await pool.query(`
      SELECT sg.short_priority AS priority_field,
             COUNT(*)::int     AS incident_count
      FROM   edoops.service_now_inc sn
      JOIN   edoops.sla_glossary    sg
        ON   sn.sninc_priority = sg.snow_priority
      WHERE  sn.sninc_applkp_pltf_nm LIKE 'BI%'
        AND  sg.short_priority IN ('P1','P2','P3')
      GROUP BY sg.short_priority
      ORDER BY sg.short_priority
    `);
    res.json(result.rows);
  } catch (err: any) {
    console.error('ServiceNow incidents error:', err.message);
    res.status(500).json({ error: 'Query failed', details: err.message });
  }
});

// GET /api/servicenow/missed-incidents
// Open P3/P4 incident count for "missed SLA" bar chart
router.get('/missed-incidents', async (_req: Request, res: Response) => {
  try {
    const pool = getPgPool();
    const result = await pool.query(`
      SELECT sg.short_priority AS priority_field,
             COUNT(*)::int     AS incident_count
      FROM   edoops.service_now_inc sn
      JOIN   edoops.sla_glossary    sg
        ON   sn.sninc_priority = sg.snow_priority
      WHERE  sn.sninc_applkp_pltf_nm LIKE 'BI%'
        AND  sg.short_priority IN ('P3','P4')
      GROUP BY sg.short_priority
      ORDER BY sg.short_priority
    `);
    res.json(result.rows);
  } catch (err: any) {
    console.error('ServiceNow missed-incidents error:', err.message);
    res.status(500).json({ error: 'Query failed', details: err.message });
  }
});

// GET /api/servicenow/incident-list
// Detailed P3/P4 incident records: number, priority, capability, description, assignment group
router.get('/incident-list', async (_req: Request, res: Response) => {
  try {
    const pool = getPgPool();
    const result = await pool.query(`
      SELECT sn.sninc_inc_num        AS sninc_inc_num,
             sg.short_priority       AS priority_field,
             sn.sninc_capability     AS sninc_capability,
             sn.sninc_short_desc     AS sninc_short_desc,
             sn.sninc_assignment_grp AS sninc_assignment_grp
      FROM   edoops.service_now_inc sn
      JOIN   edoops.sla_glossary    sg
        ON   sn.sninc_priority = sg.snow_priority
      WHERE  sn.sninc_applkp_pltf_nm LIKE 'BI%'
        AND  sg.short_priority IN ('P3','P4')
      ORDER BY sg.short_priority, sn.sninc_inc_num
      LIMIT 200
    `);
    res.json(result.rows);
  } catch (err: any) {
    console.error('ServiceNow incident-list error:', err.message);
    res.status(500).json({ error: 'Query failed', details: err.message });
  }
});

// GET /api/servicenow/emergency-changes
// Open Emergency Changes (service_now_chg) by priority
router.get('/emergency-changes', async (_req: Request, res: Response) => {
  try {
    const pool = getPgPool();
    const result = await pool.query(`
      SELECT sg.short_priority AS priority_field,
             COUNT(*)::int     AS incident_count
      FROM   edoops.service_now_chg sn
      JOIN   edoops.sla_glossary    sg
        ON   sn.snchg_priority = sg.snow_priority
      WHERE  sn.snchg_pltf_nm LIKE 'BI%'
        AND  sg.short_priority IN ('P1','P2','P3')
      GROUP BY sg.short_priority
      ORDER BY sg.short_priority
    `);
    res.json(result.rows);
  } catch (err: any) {
    console.error('ServiceNow emergency-changes error:', err.message);
    res.status(500).json({ error: 'Query failed', details: err.message });
  }
});

// GET /api/servicenow/incident-detail?priority=P1
// Full incident records for a given priority (defaults to P1-P4)
router.get('/incident-detail', async (req: Request, res: Response) => {
  try {
    const pool = getPgPool();
    const priority = req.query.priority as string | undefined;
    const priorities = priority ? [priority] : ['P1', 'P2', 'P3', 'P4'];
    const result = await pool.query(`
      SELECT sn.sninc_inc_num        AS sninc_inc_num,
             sg.short_priority       AS priority_field,
             sn.sninc_capability     AS sninc_capability,
             sn.sninc_short_desc     AS sninc_short_desc,
             sn.sninc_assignment_grp AS sninc_assignment_grp
      FROM   edoops.service_now_inc sn
      JOIN   edoops.sla_glossary    sg
        ON   sn.sninc_priority = sg.snow_priority
      WHERE  sn.sninc_applkp_pltf_nm LIKE 'BI%'
        AND  sg.short_priority = ANY($1)
      ORDER BY sg.short_priority, sn.sninc_inc_num
      LIMIT 500
    `, [priorities]);
    res.json(result.rows);
  } catch (err: any) {
    console.error('ServiceNow incident-detail error:', err.message);
    res.status(500).json({ error: 'Query failed', details: err.message });
  }
});

export default router;
