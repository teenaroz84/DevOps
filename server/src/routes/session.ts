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
import { DescribeTableCommand, DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { BatchWriteCommand, DeleteCommand, DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';

const router = Router();

const TABLE = process.env.SESSIONS_TABLE || 'aws3748-dt57-edoops-session-store';
const PARTITION_KEY = process.env.SESSIONS_PARTITION_KEY || process.env.SESSIONS_PK || 'session_id';
const SORT_KEY = process.env.SESSIONS_SORT_KEY || process.env.SESSIONS_SK || 'agent_id';
const TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days
const DEBUG_SESSIONS = process.env.DEBUG_SESSIONS === '1';

let ddb: DynamoDBDocumentClient | null = null;
let keySchemaCache: { partitionKey: string; sortKey: string } | null = null;

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

async function resolveKeySchema(): Promise<{ partitionKey: string; sortKey: string }> {
  if (keySchemaCache) return keySchemaCache;

  const region = process.env.AWS_REGION || 'us-east-1';
  const base = new DynamoDBClient({ region });
  const tableInfo = await base.send(new DescribeTableCommand({ TableName: TABLE }));
  const schema = tableInfo.Table?.KeySchema || [];
  const hash = schema.find((k) => k.KeyType === 'HASH')?.AttributeName;
  const range = schema.find((k) => k.KeyType === 'RANGE')?.AttributeName;

  keySchemaCache = {
    partitionKey: hash || PARTITION_KEY,
    sortKey: range || SORT_KEY,
  };
  return keySchemaCache;
}

function getSortKeyValue(sortKey: string, sessionId: string, agentId: string): string {
  if (sortKey === 'agent_id') return agentId;
  if (sortKey === 'session_id_timestamp') return `${agentId}#${Date.now()}`;
  return agentId;
}

type SessionRecordInput = {
  session_id?: string;
  sessionId?: string;
  pk?: string;
  PK?: string;
  agent_id?: string;
  agentId?: string;
  sk?: string;
  SK?: string;
  messages?: unknown[] | string;
  updated_at?: string;
  updatedAt?: string;
  ttl?: number;
};

type SessionItem = {
  session_id: string;
  agent_id: string;
  messages: string;
  updated_at: string;
  ttl: number;
};

function toSessionItem(record: SessionRecordInput): SessionItem | null {
  const session_id = record.session_id ?? record.sessionId ?? record.pk ?? record.PK;
  const agent_id = record.agent_id ?? record.agentId ?? record.sk ?? record.SK;
  if (!session_id || !agent_id) return null;

  const rawMessages = Array.isArray(record.messages)
    ? record.messages
    : (() => {
        if (typeof record.messages !== 'string') return [];
        try {
          const parsed = JSON.parse(record.messages);
          return Array.isArray(parsed) ? parsed : [];
        } catch {
          return [];
        }
      })();

  return {
    session_id,
    agent_id,
    messages: JSON.stringify(rawMessages),
    updated_at: record.updated_at ?? record.updatedAt ?? new Date().toISOString(),
    ttl: Number.isFinite(record.ttl) ? Number(record.ttl) : Math.floor(Date.now() / 1000) + TTL_SECONDS,
  };
}

function buildSessionKey(sessionId: string, sortValue: string, partitionKey: string, sortKey: string): Record<string, string> {
  return {
    [partitionKey]: sessionId,
    [sortKey]: sortValue,
  };
}

function buildSessionItem(
  sessionId: string,
  agentId: string,
  messages: unknown[],
  partitionKey: string,
  sortKey: string,
): Record<string, unknown> {
  const sortValue = getSortKeyValue(sortKey, sessionId, agentId);
  return {
    [partitionKey]: sessionId,
    [sortKey]: sortValue,
    // Keep canonical fields for backward compatibility and easy querying.
    session_id: sessionId,
    agent_id: agentId,
    messages: JSON.stringify(messages),
    updated_at: new Date().toISOString(),
    ttl: Math.floor(Date.now() / 1000) + TTL_SECONDS,
  };
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}

async function findLatestAgentItem(
  sessionId: string,
  agentId: string,
  partitionKey: string,
  sortKey: string,
): Promise<Record<string, unknown> | undefined> {
  // Fast path for new format: session_id_timestamp = "<agentId>#<epoch>"
  if (sortKey === 'session_id_timestamp') {
    const prefixed = await getClient().send(new QueryCommand({
      TableName: TABLE,
      KeyConditionExpression: '#pk = :sid AND begins_with(#sk, :prefix)',
      ExpressionAttributeNames: { '#pk': partitionKey, '#sk': sortKey },
      ExpressionAttributeValues: { ':sid': sessionId, ':prefix': `${agentId}#` },
      ScanIndexForward: false,
      Limit: 1,
    }));
    if (prefixed.Items && prefixed.Items.length > 0) {
      return prefixed.Items[0] as Record<string, unknown>;
    }
  }

  // Fallback for older rows where sort key isn't agent-prefixed.
  let cursor: Record<string, unknown> | undefined;
  for (let page = 0; page < 20; page += 1) {
    const result = await getClient().send(new QueryCommand({
      TableName: TABLE,
      KeyConditionExpression: '#pk = :sid',
      ExpressionAttributeNames: { '#pk': partitionKey },
      ExpressionAttributeValues: { ':sid': sessionId },
      ScanIndexForward: false,
      Limit: 100,
      ExclusiveStartKey: cursor,
    }));

    const hit = (result.Items || []).find((i) => String((i as Record<string, unknown>).agent_id ?? '') === agentId);
    if (hit) return hit as Record<string, unknown>;
    if (!result.LastEvaluatedKey) break;
    cursor = result.LastEvaluatedKey as Record<string, unknown>;
  }

  return undefined;
}

// ─── Diagnostic endpoints (MUST come first, before parametrized routes) ──────

// GET /api/sessions/diagnostic/health
router.get('/diagnostic/health', async (req: Request, res: Response) => {
  const table = TABLE;
  const region = process.env.AWS_REGION || 'us-east-1';
  const hasAccessKey = !!process.env.AWS_ACCESS_KEY_ID;
  const hasSecretKey = !!process.env.AWS_SECRET_ACCESS_KEY;
  const keys = await resolveKeySchema();
  
  res.json({
    status: 'Server OK',
    config: {
      table,
      region,
      partitionKey: keys.partitionKey,
      sortKey: keys.sortKey,
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
  const table = TABLE;
  const region = process.env.AWS_REGION || 'us-east-1';
  
  try {
    const base = new DynamoDBClient({ region });
    const tableInfo = await base.send(new DescribeTableCommand({ TableName: table }));
    const schema = (tableInfo.Table?.KeySchema || []).map((k) => ({
      attributeName: k.AttributeName,
      keyType: k.KeyType,
    }));
    const keys = await resolveKeySchema();

    const result = await getClient().send(new ScanCommand({
      TableName: table,
      Limit: 1,
    }));
    
    res.json({
      status: 'DynamoDB Connected',
      table,
      region,
      configuredPartitionKey: keys.partitionKey,
      configuredSortKey: keys.sortKey,
      keySchema: schema,
      canRead: true,
      hasItems: !!(result.Items && result.Items.length > 0),
      sampleKeys: result.Items && result.Items.length > 0
        ? Object.keys(result.Items[0]).filter((k) => /id|session|agent|pk|sk/i.test(k))
        : [],
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

// GET /api/sessions/diagnostic/sample-item
router.get('/diagnostic/sample-item', async (_req: Request, res: Response) => {
  try {
    const keys = await resolveKeySchema();
    const result = await getClient().send(new ScanCommand({
      TableName: TABLE,
      Limit: 1,
    }));

    if (!result.Items || result.Items.length === 0) {
      res.json({ ok: true, table: TABLE, hasItems: false, sample: null });
      return;
    }

    const item = result.Items[0] as Record<string, unknown>;
    const messagesStr = typeof item.messages === 'string' ? item.messages : '';
    let messageCount = 0;
    try {
      const parsed = JSON.parse(messagesStr || '[]');
      messageCount = Array.isArray(parsed) ? parsed.length : 0;
    } catch {
      messageCount = 0;
    }

    res.json({
      ok: true,
      table: TABLE,
      hasItems: true,
      sample: {
        configuredPartitionKey: keys.partitionKey,
        configuredSortKey: keys.sortKey,
        partitionValue: item[keys.partitionKey],
        sortValue: item[keys.sortKey],
        session_id: item.session_id,
        agent_id: item.agent_id,
        updated_at: item.updated_at,
        ttl: item.ttl,
        messageCount,
      },
    });
  } catch (err: any) {
    res.json({
      ok: false,
      table: TABLE,
      error: err.message || String(err),
      code: err.code || 'UNKNOWN',
    });
  }
});

// POST /api/sessions/bulk
// Body: { records: Array<{session_id, agent_id, messages, updated_at?, ttl?}> }
router.post('/bulk', async (req: Request, res: Response) => {
  const rawRecords: SessionRecordInput[] = Array.isArray(req.body?.records) ? req.body.records : [];
  const validItems: SessionItem[] = rawRecords
    .map((record: SessionRecordInput) => toSessionItem(record))
    .filter((item: SessionItem | null): item is SessionItem => item !== null);

  if (rawRecords.length === 0) {
    res.status(400).json({ ok: false, error: 'records[] is required' });
    return;
  }

  try {
    const keys = await resolveKeySchema();
    let inserted = 0;
    const batches = chunk<SessionItem>(validItems, 25);

    for (const batch of batches) {
      const mapped = batch.map((item) => ({
        [keys.partitionKey]: item.session_id,
        [keys.sortKey]: getSortKeyValue(keys.sortKey, item.session_id, item.agent_id),
        session_id: item.session_id,
        agent_id: item.agent_id,
        messages: item.messages,
        updated_at: item.updated_at,
        ttl: item.ttl,
      }));
      await getClient().send(new BatchWriteCommand({
        RequestItems: {
          [TABLE]: mapped.map((item) => ({ PutRequest: { Item: item } })),
        },
      }));
      inserted += batch.length;
    }

    res.json({
      ok: true,
      table: TABLE,
      requested: rawRecords.length,
      inserted,
      skipped: rawRecords.length - validItems.length,
    });
  } catch (err: any) {
    res.status(500).json({
      ok: false,
      table: TABLE,
      error: err.message || String(err),
      code: err.code || 'UNKNOWN',
    });
  }
});

// ─── Session persistence routes ──────────────────────────────────────────────

// GET /api/sessions/:sessionId/:agentId
router.get('/:sessionId/:agentId', async (req: Request, res: Response) => {
  const { sessionId, agentId } = req.params;
  debugLog('GET', { sessionId, agentId });
  try {
    const keys = await resolveKeySchema();
    let item: Record<string, unknown> | undefined;

    if (keys.sortKey === 'agent_id') {
      const result = await getClient().send(new GetCommand({
        TableName: TABLE,
        Key: buildSessionKey(sessionId, agentId, keys.partitionKey, keys.sortKey),
      }));
      item = result.Item as Record<string, unknown> | undefined;
    } else {
      item = await findLatestAgentItem(sessionId, agentId, keys.partitionKey, keys.sortKey);
    }

    const messages = item ? JSON.parse((item.messages as string) || '[]') : [];
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
  let writeKeyMeta: { partitionKey: string; partitionValue: string; sortKey: string; sortValue: string } | null = null;
  try {
    const keys = await resolveKeySchema();
    const item = buildSessionItem(sessionId, agentId, messages, keys.partitionKey, keys.sortKey);
    writeKeyMeta = {
      partitionKey: keys.partitionKey,
      partitionValue: String(item[keys.partitionKey] ?? ''),
      sortKey: keys.sortKey,
      sortValue: String(item[keys.sortKey] ?? ''),
    };
    await getClient().send(new PutCommand({
      TableName: TABLE,
      Item: item,
    }));
    res.json({
      ok: true,
      persisted: true,
      table: TABLE,
      writeKey: writeKeyMeta,
    });
  } catch (err: any) {
    const errMsg = err.message || String(err);
    console.warn('[sessions] POST failed:', {
      message: errMsg,
      code: err.code,
      table: TABLE,
      region: process.env.AWS_REGION || 'us-east-1',
      hasAccessKey: !!process.env.AWS_ACCESS_KEY_ID,
      hasSecretKey: !!process.env.AWS_SECRET_ACCESS_KEY,
      writeKey: writeKeyMeta,
    });
    res.json({ ok: true, persisted: false, error: errMsg, table: TABLE, writeKey: writeKeyMeta });
  }
});

// DELETE /api/sessions/:sessionId/:agentId
router.delete('/:sessionId/:agentId', async (req: Request, res: Response) => {
  const { sessionId, agentId } = req.params;
  debugLog('DELETE', { sessionId, agentId });
  try {
    const keys = await resolveKeySchema();
    if (keys.sortKey === 'agent_id') {
      await getClient().send(new DeleteCommand({
        TableName: TABLE,
        Key: buildSessionKey(sessionId, agentId, keys.partitionKey, keys.sortKey),
      }));
    } else {
      const item = await findLatestAgentItem(sessionId, agentId, keys.partitionKey, keys.sortKey);
      if (item) {
        const sortValue = String(item[keys.sortKey] ?? '');
        if (sortValue) {
          await getClient().send(new DeleteCommand({
            TableName: TABLE,
            Key: buildSessionKey(sessionId, sortValue, keys.partitionKey, keys.sortKey),
          }));
        }
      }
    }
    res.json({ ok: true, persisted: true });
  } catch (err: any) {
    console.warn('[sessions] DELETE failed, skipping remote delete:', err.message);
    res.json({ ok: true, persisted: false });
  }
});

export default router;

