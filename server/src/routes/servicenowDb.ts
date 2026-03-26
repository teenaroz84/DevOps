/**
 * ServiceNow routes — queries against SQL Server [Adpops].[ebd].*
 */
import { Router, Request, Response } from 'express';
import { getPgPool } from '../db/postgres';

const router = Router();

// GET /api/servicenow/incidents
router.get('/incidents', async (_req: Request, res: Response) => {
  try {
    const pool = getPgPool();
    const result = await pool.query(`
      SELECT sg.short_priority AS priority_field,
             COUNT(*)          AS incident_count
      FROM   edoops.service_now_prb sn
      JOIN   edoops.sla_glossary    sg
        ON   sn.snprb_priority = sg.snow_priority
      WHERE  sn.snprb_applkp_pltf_nm LIKE 'BI%'
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

export default router;
