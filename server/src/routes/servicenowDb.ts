/**
 * ServiceNow routes — queries against edoops schema (PostgreSQL)
 */
import { Router, Request, Response } from 'express';
import { getPgPool } from '../db/postgres';

const router = Router();

// GET /api/servicenow/incidents
// Open P1/P2/P3 problems by priority from service_now_prb
router.get('/incidents', async (_req: Request, res: Response) => {
  try {
    const pool = getPgPool();
    const result = await pool.query(`
      SELECT sg.short_priority AS priority_field,
             COUNT(*)::int     AS incident_count
      FROM   edoops.service_now_prb sn
      JOIN   edoops.sla_glossary    sg
        ON   sn.snprb_priority = sg.snow_priority
      WHERE  sn.snprb_pltf_nm LIKE 'BI%'
        AND  sg.short_priority IN ('P1','P2','P3','P4','P5')
      GROUP BY sg.short_priority
      ORDER BY sg.short_priority
    `);
    res.json(result.rows);
  } catch (err: any) {
    console.error('ServiceNow incidents error:', err.message);
    res.status(500).json({ error: 'Query failed', details: err.message });
  }
});

// GET /api/servicenow/ageing-problems
// Long-running open problems (open > 30 days), individual records
router.get('/ageing-problems', async (_req: Request, res: Response) => {
  try {
    const pool = getPgPool();
    const result = await pool.query(`
      SELECT sg.short_priority                          AS priority_field,
             sn.snprb_pltf_nm,
             sn.snprb_opened_at_dttm,
             sn.snprb_prb_state
      FROM   edoops.service_now_prb sn
      JOIN   edoops.sla_glossary    sg
        ON   sn.snprb_priority = sg.snow_priority
      WHERE  sn.snprb_pltf_nm LIKE 'BI%'
        AND  sg.short_priority IN ('P1','P2','P3')
        AND  sn.snprb_prb_state NOT IN ('closed','resolved')
        AND  sn.snprb_opened_at_dttm::date < (CURRENT_DATE - INTERVAL '30 days')
      ORDER BY sg.short_priority, sn.snprb_opened_at_dttm
      LIMIT 150
    `);
    res.json(result.rows);
  } catch (err: any) {
    console.error('ServiceNow ageing-problems error:', err.message);
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

export default router;
