/**
 * PostgreSQL routes — queries against the PostgreSQL database.
 */
import { Router, Request, Response } from 'express';
import { getPgPool } from '../db';

const router = Router();

// GET /api/postgres/pipelines
router.get('/pipelines', async (_req: Request, res: Response) => {
  try {
    const pool = getPgPool();
    const result = await pool.query(`
      SELECT id, name, status, success_rate, last_run, avg_duration, owner, schedule
      FROM   pipelines
      ORDER BY name
    `);
    res.json(result.rows);
  } catch (err: any) {
    console.error('Postgres pipelines error:', err.message);
    res.status(500).json({ error: 'Query failed', details: err.message });
  }
});

export default router; 


// --- DMF: Run Status ---
// GET /api/postgres/dmf-run-status
router.get('/dmf-run-status', async (_req: Request, res: Response) => {
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

// --- ESP: Job Counts ---
// GET /api/postgres/esp-job-counts
router.get('/esp-job-counts', async (_req: Request, res: Response) => {
  try {
    const pool = getPgPool();
    const result = await pool.query(`
      SELECT appl_name,
             COUNT(DISTINCT jobname) AS total_jobs
      FROM   esp_job_cmnd
      GROUP BY appl_name
      ORDER BY total_jobs DESC
    `);
    res.json(result.rows);
  } catch (err: any) {
    console.error('ESP job-counts error:', err.message);
    res.status(500).json({ error: 'Query failed', details: err.message });
  }
});

// --- ServiceNow: Incidents ---
// GET /api/postgres/servicenow-incidents
router.get('/servicenow-incidents', async (_req: Request, res: Response) => {
  try {
    const pool = getPgPool();
    const result = await pool.query(`
      SELECT sg.short_priority AS priority_field,
             COUNT(*)          AS incident_count
      FROM   service_now_inc sn
      JOIN   sla_glossary    sg
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
