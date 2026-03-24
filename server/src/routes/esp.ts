/**
 * ESP routes — queries against SQL Server dbo.esp_job_cmnd
 */
import { Router, Request, Response } from 'express';
import { getMssqlPool } from '../db';

const router = Router();

// GET /api/esp/job-counts
router.get('/job-counts', async (_req: Request, res: Response) => {
  try {
    const pool = await getMssqlPool();
    const result = await pool.request().query(`
      SELECT appl_name,
             COUNT(DISTINCT jobname) AS total_jobs
      FROM   dbo.esp_job_cmnd
      GROUP BY appl_name
      ORDER BY total_jobs DESC
    `);
    res.json(result.recordset);
  } catch (err: any) {
    console.error('ESP job-counts error:', err.message);
    res.status(500).json({ error: 'Query failed', details: err.message });
  }
});

export default router;
