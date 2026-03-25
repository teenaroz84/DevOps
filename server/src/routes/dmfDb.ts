/**
 * DMF routes — queries against Snowflake _DMF.CORE.*
 */
import { Router, Request, Response } from 'express';
import { getPgPool } from '../db/postgres';

const router = Router();

// GET /api/dmf/run-status
router.get('/run-status', async (_req: Request, res: Response) => {
  try {
    const pool = getPgPool();
    const result = await pool.query(`
      SELECT run_status,
             COUNT(*) AS status_count
      FROM   dmf_run_master
      WHERE  proc_dt >= NOW() - INTERVAL '3 months'
      GROUP BY run_status
      ORDER BY status_count DESC
    `);

    const colorMap: Record<string, string> = {
      'SUCCESS':      '#2e7d32',
      'FAILED':       '#d32f2f',
      'IN PROGRESS':  '#f57c00',
      'STARTED':      '#1565c0',
      'PARTIAL LOAD': '#ff9800',
    };

    const data = result.rows.map((row: any) => ({
      name:  row.run_status,
      value: parseInt(row.status_count, 10),
      color: colorMap[(row.run_status || '').toUpperCase()] || '#757575',
    }));

    res.json(data);
  } catch (err: any) {
    console.error('DMF run-status error:', err.message);
    res.status(500).json({ error: 'Query failed', details: err.message });
  }
});

export default router;
