/**
 * ServiceNow routes — queries against SQL Server [Adpops].[ebd].*
 */
import { Router, Request, Response } from 'express';
import { getMssqlPool } from '../db';

const router = Router();

// GET /api/servicenow/incidents
router.get('/incidents', async (_req: Request, res: Response) => {
  try {
    const pool = await getMssqlPool();
    const result = await pool.request().query(`
      SELECT sg.short_priority AS priority_field,
             COUNT(*)          AS incident_count
      FROM   [Adpops].[ebd].[service_now_inc] sn
      JOIN   [Adpops].[ebd].[sla_glossary]    sg
        ON   sn.sninc_priority = sg.snow_priority
      WHERE  sn.sninc_applkp_pltf_nm LIKE 'BI%'
        AND  sg.short_priority IN ('P1','P2','P3')
      GROUP BY sg.short_priority
      ORDER BY sg.short_priority
    `);
    res.json(result.recordset);
  } catch (err: any) {
    console.error('ServiceNow incidents error:', err.message);
    res.status(500).json({ error: 'Query failed', details: err.message });
  }
});

export default router;
