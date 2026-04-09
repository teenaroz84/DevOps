/**
 * Talend routes — queries against edoops.talend_logs_dashboard
 */
import { Router, Request, Response } from 'express';
import { getPgPool } from '../db/postgres';

const router = Router();

// Parse ?days= query param (1–15, default 7)
function daysClause(query: any): { clause: string; params: any[] } {
  const days = Math.min(15, Math.max(1, parseInt(String(query.days ?? '7'), 10) || 7));
  return {
    clause: `AND start_timestamp >= NOW() - INTERVAL '${days} days'`,
    params: [],
  };
}

async function safeQuery(sql: string, params: any[] = [], fallback: any[] = []): Promise<any[]> {
  const pool = getPgPool();
  try {
    const { rows } = await pool.query(sql, params);
    return rows;
  } catch (e: any) {
    console.error('Talend query error:', e.message);
    return fallback;
  }
}

// ─── GET /api/talend/summary ──────────────────────────────
// Execution status counts + top workspace/engine info
router.get('/summary', async (req: Request, res: Response) => {
  try {
    const { clause: dc } = daysClause(req.query);
    const [statusRows, workspaceRows, engineRows] = await Promise.all([
      safeQuery(`
        SELECT execution_status, COUNT(*)::int AS cnt
        FROM edoops.talend_logs_dashboard
        WHERE execution_status IS NOT NULL ${dc}
        GROUP BY execution_status
        ORDER BY cnt DESC
        LIMIT 20
      `),
      safeQuery(`
        SELECT workspace_name, COUNT(*)::int AS cnt
        FROM edoops.talend_logs_dashboard
        WHERE workspace_name IS NOT NULL ${dc}
        GROUP BY workspace_name
        ORDER BY cnt DESC
        LIMIT 10
      `),
      safeQuery(`
        SELECT remote_engine_name, COUNT(*)::int AS cnt
        FROM edoops.talend_logs_dashboard
        WHERE remote_engine_name IS NOT NULL ${dc}
        GROUP BY remote_engine_name
        ORDER BY cnt DESC
        LIMIT 10
      `),
    ]);

    const STATUS_COLOR: Record<string, string> = {
      'EXECUTION_SUCCESS': '#2e7d32',
      'SUCCESS':           '#2e7d32',
      'EXECUTION_FAILED':  '#d32f2f',
      'FAILED':            '#d32f2f',
      'EXECUTION_RUNNING': '#f57c00',
      'RUNNING':           '#f57c00',
    };

    res.json({
      statusBreakdown: statusRows.map((r: any) => ({
        status: r.execution_status,
        count:  r.cnt,
        color:  STATUS_COLOR[String(r.execution_status).toUpperCase()] || '#78909c',
      })),
      workspaces: workspaceRows.map((r: any) => ({ name: r.workspace_name, count: r.cnt })),
      engines:    engineRows.map((r: any) => ({ name: r.remote_engine_name, count: r.cnt })),
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Query failed', details: err.message });
  }
});

// ─── GET /api/talend/level-counts ────────────────────────
// Log level totals derived from fatal_count, error_count, warn_count, info_count
router.get('/level-counts', async (req: Request, res: Response) => {
  try {
    const { clause: dc } = daysClause(req.query);
    const rows = await safeQuery(`
      SELECT
        SUM(COALESCE(fatal_count, 0))::int AS fatal,
        SUM(COALESCE(error_count, 0))::int AS error,
        SUM(COALESCE(warn_count,  0))::int AS warn,
        SUM(COALESCE(info_count,  0))::int AS info
      FROM edoops.talend_logs_dashboard
      WHERE 1=1 ${dc}
    `);

    const raw = rows[0] ?? { fatal: 0, error: 0, warn: 0, info: 0 };
    const levels = [
      { level: 'FATAL', count: raw.fatal, color: '#c62828' },
      { level: 'ERROR', count: raw.error, color: '#e53935' },
      { level: 'WARN',  count: raw.warn,  color: '#f57c00' },
      { level: 'INFO',  count: raw.info,  color: '#1565c0' },
    ];
    res.json(levels);
  } catch (err: any) {
    res.status(500).json({ error: 'Query failed', details: err.message });
  }
});

// ─── GET /api/talend/recent-tasks ────────────────────────
// Latest 50 task executions — de-duped by task_execution_id
router.get('/recent-tasks', async (req: Request, res: Response) => {
  try {
    const { clause: dc } = daysClause(req.query);
    const rows = await safeQuery(`
      SELECT DISTINCT ON (task_execution_id)
        task_execution_id,
        task_name,
        execution_status,
        workspace_name,
        environment_name,
        remote_engine_name,
        artifact_name,
        artifact_version,
        run_type,
        count_of_attempts,
        start_timestamp,
        trigger_timestamp
      FROM edoops.talend_logs_dashboard
      WHERE task_execution_id IS NOT NULL ${dc}
      ORDER BY task_execution_id, start_timestamp DESC NULLS LAST
      LIMIT 50
    `);
    res.json(rows);
  } catch (err: any) {
    res.status(500).json({ error: 'Query failed', details: err.message });
  }
});

// ─── GET /api/talend/recent-errors ──────────────────────
// Task executions that had fatal / error / warn / info log counts > 0
router.get('/recent-errors', async (req: Request, res: Response) => {
  try {
    const { clause: dc } = daysClause(req.query);
    const rows = await safeQuery(`
      SELECT
        start_timestamp,
        task_name,
        workspace_name,
        remote_engine_name,
        artifact_name,
        COALESCE(fatal_count, 0)::int AS fatal_count,
        COALESCE(error_count, 0)::int AS error_count,
        COALESCE(warn_count,  0)::int AS warn_count,
        COALESCE(info_count,  0)::int AS info_count,
        CASE
          WHEN COALESCE(fatal_count, 0) > 0 THEN 'FATAL'
          WHEN COALESCE(error_count, 0) > 0 THEN 'ERROR'
          WHEN COALESCE(warn_count,  0) > 0 THEN 'WARN'
          WHEN COALESCE(info_count,  0) > 0 THEN 'INFO'
          ELSE 'UNKNOWN'
        END AS derived_level
      FROM edoops.talend_logs_dashboard
      WHERE (
        COALESCE(fatal_count, 0) > 0 OR
        COALESCE(error_count, 0) > 0 OR
        COALESCE(warn_count,  0) > 0 OR
        COALESCE(info_count,  0) > 0
      ) ${dc}
      ORDER BY start_timestamp DESC NULLS LAST
      LIMIT 200
    `);
    res.json(rows);
  } catch (err: any) {
    res.status(500).json({ error: 'Query failed', details: err.message });
  }
});

export default router;
