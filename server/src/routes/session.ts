/**
 * Session routes — DynamoDB-backed chat history persistence (local dev server).
 *
 * GET    /api/sessions/:sessionId/:agentId  → { messages: [...] }
 * POST   /api/sessions/:sessionId/:agentId  → { ok: true }
 * DELETE /api/sessions/:sessionId/:agentId  → { ok: true }
 *
 * Schema matches the deployed Lambda + CloudFormation table exactly:
 *   PK  session_id  String  — browser session UUID
 *   SK  agent_id    String  — agent identifier (knowledge | esp | dmf …)
 *       messages    String  — JSON-serialised Message[]
 *       updated_at  String  — ISO timestamp
 *       ttl         Number  — Unix epoch; DynamoDB TTL (30 days)
 *
 * Requires AWS credentials in the environment (AWS_REGION, AWS_ACCESS_KEY_ID,
 * AWS_SECRET_ACCESS_KEY) or the default credential chain (SSO, instance role…).
 * Falls back gracefully to an empty history when DynamoDB is unreachable.
 */
import { Router, Request, Response } from 'express';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DeleteCommand, DynamoDBDocumentClient, GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';

const router = Router();

const TABLE = process.env.SESSIONS_TABLE || 'ChatSessions';
const TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days
const DEBUG_SESSIONS = process.env.DEBUG_SESSIONS === '1';

let ddb: DynamoDBDocumentClient | null = null;

function getClient(): DynamoDBDocumentClient {
  if (!ddb) {
    const base = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
    ddb = DynamoDBDocumentClient.from(base);
  }
  return ddb;
}

function debugLog(event: string, details?: Record<string, unknown>): void {
  if (!DEBUG_SESSIONS) return;
  details ? console.log(`[sessions] ${event}`, details) : console.log(`[sessions] ${event}`);
}

// GET /api/sessions/:sessionId/:agentId
router.get('/:sessionId/:agentId', async (req: Request, res: Response) => {
  const { sessionId, agentId } = req.params;
  debugLog('GET', { sessionId, agentId });
  try {
    const result = await getClient().send(new GetCommand({
      TableName: TABLE,
      Key: { session_id: sessionId, agent_id: agentId },
    }));
    const messages = result.Item ? JSON.parse(result.Item.messages || '[]') : [];
    res.json({ messages });
  } catch (err: any) {
    console.warn('[sessions] GET failed, returning empty history:', err.message);
    res.json({ messages: [] });
  }
});

// POST /api/sessions/:sessionId/:agentId
router.post('/:sessionId/:agentId', async (req: Request, res: Response) => {
  const { sessionId, agentId } = req.params;
  const messages = Array.isArray(req.body.messages) ? req.body.messages : [];
  debugLog('POST', { sessionId, agentId, messageCount: messages.length });
  try {
    await getClient().send(new PutCommand({
      TableName: TABLE,
      Item: {
        session_id: sessionId,
        agent_id: agentId,
        messages: JSON.stringify(messages),
        updated_at: new Date().toISOString(),
        ttl: Math.floor(Date.now() / 1000) + TTL_SECONDS,
      },
    }));
    res.json({ ok: true, persisted: true });
  } catch (err: any) {
    const errMsg = err.message || String(err);
    console.warn('[sessions] POST failed:', {
      message: errMsg,
      code: err.code,
      table: TABLE,
      region: process.env.AWS_REGION || 'us-east-1',
      hasAccessKey: !!process.env.AWS_ACCESS_KEY_ID,
      hasSecretKey: !!process.env.AWS_SECRET_ACCESS_KEY,
    });
    res.json({ ok: true, persisted: false, error: errMsg });
  }
});

// DELETE /api/sessions/:sessionId/:agentId
router.delete('/:sessionId/:agentId', async (req: Request, res: Response) => {
  const { sessionId, agentId } = req.params;
  debugLog('DELETE', { sessionId, agentId });
  try {
    await getClient().send(new DeleteCommand({
      TableName: TABLE,
      Key: { session_id: sessionId, agent_id: agentId },
    }));
    res.json({ ok: true, persisted: true });
  } catch (err: any) {
    console.warn('[sessions] DELETE failed, skipping remote delete:', err.message);
    res.json({ ok: true, persisted: false });
  }
});

// ─── Diagnostic endpoints ───────────────────────────────────────────────────

// GET /api/sessions/diagnostic/health
router.get('/diagnostic/health', async (req: Request, res: Response) => {
  const table = process.env.SESSIONS_TABLE || 'ChatSessions';
  const region = process.env.AWS_REGION || 'us-east-1';
  const hasAccessKey = !!process.env.AWS_ACCESS_KEY_ID;
  const hasSecretKey = !!process.env.AWS_SECRET_ACCESS_KEY;
  
  res.json({
    status: 'Server OK',
    config: {
      table,
      region,
      hasAccessKey,
      hasSecretKey,
      isDev: process.env.NODE_ENV !== 'production',
    },
    credentials: {
      method: hasAccessKey && hasSecretKey ? 'Environment Variables' : 'Instance Role / Default Chain',
      configured: hasAccessKey && hasSecretKey,
    }
  });
});

// GET /api/sessions/diagnostic/dynamodb
router.get('/diagnostic/dynamodb', async (req: Request, res: Response) => {
  const table = process.env.SESSIONS_TABLE || 'ChatSessions';
  const region = process.env.AWS_REGION || 'us-east-1';
  
  try {
    const result = await getClient().send(new GetCommand({
      TableName: table,
      Key: { 
        session_id: '__test__', 
        agent_id: '__test__' 
      },
    }));
    
    res.json({
      status: 'DynamoDB Connected',
      table,
      region,
      canRead: true,
      itemExists: !!result.Item
    });
  } catch (err: any) {
    res.json({
      status: 'DynamoDB Connection Failed',
      table,
      region,
      error: err.message || String(err),
      code: err.code || 'UNKNOWN',
      hint: 
        err.code === 'ResourceNotFoundException' 
          ? `Table "${table}" does not exist in region ${region}`
          : err.code === 'UnrecognizedClientException'
          ? 'AWS credentials not configured (missing AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY or instance role)'
          : err.code === 'ValidationException'
          ? 'Invalid table name or request'
          : 'Check AWS credentials, table name, and region'
    });
  }
});

export default router;
