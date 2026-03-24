/**
 * DMF routes — queries against Snowflake _DMF.CORE.*
 */
import { Router, Request, Response } from 'express';
import { querySnowflake } from '../db';

const router = Router();

// GET /api/dmf/run-status
router.get('/run-status', async (_req: Request, res: Response) => {
  try {
    const rows = await querySnowflake(`
      SELECT run_status,
             COUNT(*) AS status_count
      FROM   _DMF.CORE.DMF_RUN_MASTER
      WHERE  proc_dt >= DATEADD(month, -3, CURRENT_DATE)
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

    const data = rows.map((row: any) => ({
      name:  row.RUN_STATUS || row.run_status,
      value: parseInt(row.STATUS_COUNT || row.status_count, 10),
      color: colorMap[(row.RUN_STATUS || row.run_status || '').toUpperCase()] || '#757575',
    }));

    res.json(data);
  } catch (err: any) {
    console.error('DMF run-status error:', err.message);
    res.status(500).json({ error: 'Query failed', details: err.message });
  }
});

export default router;
