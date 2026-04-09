/**
 * Talend routes — queries against edoops.talend_logs
 */
import { Router, Request, Response } from 'express';
import { getPgPool } from '../db/postgres';

const router = Router();

// Parse ?days= query param (1–15, default 7)
function daysClause(query: any): { clause: string; params: any[] } {
  const days = Math.min(15, Math.max(1, parseInt(String(query.days ?? '7'), 10) || 7));
  return {
    clause: `AND execution_timestamp >= NOW() - INTERVAL '${days} days'`,
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
        FROM edoops.talend_logs
        WHERE execution_status IS NOT NULL ${dc}
        GROUP BY execution_status
        ORDER BY cnt DESC
        LIMIT 20
      `),
      safeQuery(`
        SELECT workspace_name, COUNT(*)::int AS cnt
        FROM edoops.talend_logs
        WHERE workspace_name IS NOT NULL ${dc}
        GROUP BY workspace_name
        ORDER BY cnt DESC
        LIMIT 10
      `),
      safeQuery(`
        SELECT remote_engine_name, COUNT(*)::int AS cnt
        FROM edoops.talend_logs
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
// Log level distribution (FATAL, ERROR, WARN, INFO, etc.)
router.get('/level-counts', async (req: Request, res: Response) => {
  try {
    const { clause: dc } = daysClause(req.query);
    const rows = await safeQuery(`
      SELECT level_text, COUNT(*)::int AS cnt
      FROM edoops.talend_logs
      WHERE level_text IS NOT NULL ${dc}
      GROUP BY level_text
      ORDER BY cnt DESC
      LIMIT 20
    `);

    const LEVEL_COLOR: Record<string, string> = {
      'FATAL': '#c62828',
      'ERROR': '#e53935',
      'WARN':  '#f57c00',
      'INFO':  '#1565c0',
      'DEBUG': '#78909c',
      'TRACE': '#9e9e9e',
    };

    res.json(rows.map((r: any) => ({
      level: r.level_text,
      count: r.cnt,
      color: LEVEL_COLOR[String(r.level_text).toUpperCase()] || '#78909c',
    })));
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
        execution_timestamp,
        trigger_timestamp
      FROM edoops.talend_logs
      WHERE task_execution_id IS NOT NULL ${dc}
      ORDER BY task_execution_id, execution_timestamp DESC NULLS LAST
      LIMIT 50
    `);
    res.json(rows);
  } catch (err: any) {
    res.status(500).json({ error: 'Query failed', details: err.message });
  }
});

// ─── GET /api/talend/recent-errors ──────────────────────
// Latest 50 FATAL / ERROR log entries with truncated message
router.get('/recent-errors', async (req: Request, res: Response) => {
  try {
    const { clause: dc } = daysClause(req.query);
    const rows = await safeQuery(`
      SELECT
        execution_timestamp,
        task_name,
        level_text,
        workspace_name,
        remote_engine_name,
        artifact_name,
        LEFT(message_text, 300)  AS message_text,
        class_text,
        thread
      FROM edoops.talend_logs
      WHERE level_text IN ('FATAL', 'ERROR')
        AND message_text IS NOT NULL ${dc}
      ORDER BY execution_timestamp DESC NULLS LAST
      LIMIT 50
    `);
    res.json(rows);
  } catch (err: any) {
    res.status(500).json({ error: 'Query failed', details: err.message });
  }
});

export default router;
