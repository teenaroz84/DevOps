/**
 * Session routes — DynamoDB-backed chat history persistence (local dev server).
 *
 * GET    /api/sessions/:sessionId/:agentId  → { messages: [...] }
 * POST   /api/sessions/:sessionId/:agentId  → { ok: true }
 * DELETE /api/sessions/:sessionId/:agentId  → { ok: true }
 *
 * Schema matches the deployed Lambda + CloudFormation table exactly:
 *   PK  session_id  String  — chat session UUID
 *   SK  agent_id    String  — agent identifier (knowledge | esp | dmf …)
 *       user_id     String  — authenticated user id (admin | developer)
 *       browser_session_id String — persistent browser session UUID
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
let keySchemaCache: { partitionKey: string; sortKey: string | null } | null = null;

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

async function resolveKeySchema(): Promise<{ partitionKey: string; sortKey: string | null }> {
  if (keySchemaCache) return keySchemaCache;

  const region = process.env.AWS_REGION || 'us-east-1';
  const base = new DynamoDBClient({ region });
  const tableInfo = await base.send(new DescribeTableCommand({ TableName: TABLE }));
  const schema = tableInfo.Table?.KeySchema || [];
  const hash = schema.find((k) => k.KeyType === 'HASH')?.AttributeName;
  const range = schema.find((k) => k.KeyType === 'RANGE')?.AttributeName;

  keySchemaCache = {
    partitionKey: hash || PARTITION_KEY,
    sortKey: range || null,
  };
  return keySchemaCache;
}

function getSortKeyValue(sortKey: string, sessionId: string, agentId: string): string {
  if (sortKey === 'agent_id') return agentId;
  if (sortKey === 'session_id_timestamp') return `${agentId}#${Date.now()}`;
  return agentId;
}

function getPartitionKeyValue(sessionId: string, agentId: string, hasSortKey: boolean): string {
  // For PK-only tables, fold agent into PK to avoid overwriting other agents.
  return hasSortKey ? sessionId : `${sessionId}#${agentId}`;
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
  browser_session_id?: string;
  browserSessionId?: string;
  user_id?: string;
  userId?: string;
  ttl?: number;
};

type SessionItem = {
  session_id: string;
  agent_id: string;
  browser_session_id?: string;
  user_id?: string;
  messages: string;
  updated_at: string;
  ttl: number;
};

type SessionSummary = {
  sessionId: string;
  title: string;
  preview: string;
  updatedAt: number;
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
    browser_session_id: typeof (record as any).browser_session_id === 'string'
      ? (record as any).browser_session_id
      : typeof (record as any).browserSessionId === 'string'
        ? (record as any).browserSessionId
        : undefined,
    user_id: typeof (record as any).user_id === 'string'
      ? (record as any).user_id
      : typeof (record as any).userId === 'string'
        ? (record as any).userId
        : undefined,
    messages: JSON.stringify(rawMessages),
    updated_at: record.updated_at ?? record.updatedAt ?? new Date().toISOString(),
    ttl: Number.isFinite(record.ttl) ? Number(record.ttl) : Math.floor(Date.now() / 1000) + TTL_SECONDS,
  };
}

function buildSessionKey(
  sessionId: string,
  agentId: string,
  partitionKey: string,
  sortKey?: string | null,
  sortValue?: string,
): Record<string, string> {
  const key: Record<string, string> = {
    [partitionKey]: getPartitionKeyValue(sessionId, agentId, !!sortKey),
  };
  if (sortKey && sortValue) key[sortKey] = sortValue;
  return key;
}

function buildSessionItem(
  sessionId: string,
  agentId: string,
  messages: unknown[],
  browserSessionId: string | undefined,
  userId: string | undefined,
  partitionKey: string,
  sortKey?: string | null,
): Record<string, unknown> {
  const item: Record<string, unknown> = {
    [partitionKey]: getPartitionKeyValue(sessionId, agentId, !!sortKey),
    // Keep canonical fields for backward compatibility and easy querying.
    session_id: sessionId,
    chat_session_id: sessionId,
    agent_id: agentId,
    messages: JSON.stringify(messages),
    updated_at: new Date().toISOString(),
    ttl: Math.floor(Date.now() / 1000) + TTL_SECONDS,
  };
  if (browserSessionId) {
    item.browser_session_id = browserSessionId;
  }
  if (userId) {
    item.user_id = userId;
  }
  if (sortKey) {
    item[sortKey] = getSortKeyValue(sortKey, sessionId, agentId);
  }
  return item;
}

function getRequestUserId(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function getStoredUserId(item: Record<string, unknown> | undefined): string | undefined {
  if (!item) return undefined;
  return typeof item.user_id === 'string'
    ? item.user_id
    : typeof item.userId === 'string'
      ? item.userId
      : undefined;
}

function buildSessionSummary(sessionId: string, messages: unknown[], updatedAt: string | undefined): SessionSummary {
  const typed = Array.isArray(messages) ? messages as Array<Record<string, unknown>> : [];
  const meaningfulMessages = typed.filter((message) => String(message.content ?? '').trim().length > 0);
  const firstUser = meaningfulMessages.find((message) => message.role === 'user');
  const lastMessage = meaningfulMessages[meaningfulMessages.length - 1];
  const title = String(firstUser?.content ?? '').trim().slice(0, 48) || 'New Chat';
  const preview = String(lastMessage?.content ?? '').trim().slice(0, 90) || 'No messages yet';

  return {
    sessionId,
    title,
    preview,
    updatedAt: updatedAt ? Date.parse(updatedAt) || Date.now() : Date.now(),
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
        sortValue: keys.sortKey ? item[keys.sortKey] : null,
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
        [keys.partitionKey]: getPartitionKeyValue(item.session_id, item.agent_id, !!keys.sortKey),
        ...(keys.sortKey ? { [keys.sortKey]: getSortKeyValue(keys.sortKey, item.session_id, item.agent_id) } : {}),
        session_id: item.session_id,
        agent_id: item.agent_id,
        ...(item.browser_session_id ? { browser_session_id: item.browser_session_id } : {}),
        ...(item.user_id ? { user_id: item.user_id } : {}),
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

// GET /api/sessions/agent/:agentId?browserSessionId=<id>
router.get('/agent/:agentId', async (req: Request, res: Response) => {
  const { agentId } = req.params;
  const browserSessionId = typeof req.query.browserSessionId === 'string'
    ? req.query.browserSessionId
    : '';
  const userId = getRequestUserId(req.query.userId);

  debugLog('LIST', { agentId, browserSessionId, userId });

  if (!browserSessionId || !userId) {
    res.json({ sessions: [] });
    return;
  }

  try {
    let cursor: Record<string, unknown> | undefined;
    const sessionsById = new Map<string, SessionSummary>();

    for (let page = 0; page < 25; page += 1) {
      const result = await getClient().send(new ScanCommand({
        TableName: TABLE,
        FilterExpression: 'agent_id = :agentId AND browser_session_id = :browserSessionId AND user_id = :userId',
        ExpressionAttributeValues: {
          ':agentId': agentId,
          ':browserSessionId': browserSessionId,
          ':userId': userId,
        },
        ExclusiveStartKey: cursor,
      }));

      for (const raw of (result.Items || []) as Array<Record<string, unknown>>) {
        const sessionId = String(raw.chat_session_id ?? raw.session_id ?? '');
        if (!sessionId) continue;

        let parsedMessages: unknown[] = [];
        try {
          parsedMessages = JSON.parse(String(raw.messages ?? '[]'));
        } catch {
          parsedMessages = [];
        }

        const summary = buildSessionSummary(sessionId, parsedMessages, String(raw.updated_at ?? ''));
        const existing = sessionsById.get(sessionId);
        if (!existing || summary.updatedAt > existing.updatedAt) {
          sessionsById.set(sessionId, summary);
        }
      }

      if (!result.LastEvaluatedKey) break;
      cursor = result.LastEvaluatedKey as Record<string, unknown>;
    }

    const sessions = Array.from(sessionsById.values()).sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 3);
    res.json({ sessions });
  } catch (err: any) {
    console.warn('[sessions] LIST failed, returning empty session list:', err.message);
    res.json({ sessions: [] });
  }
});

// GET /api/sessions/:sessionId/:agentId
router.get('/:sessionId/:agentId', async (req: Request, res: Response) => {
  const { sessionId, agentId } = req.params;
  const userId = getRequestUserId(req.query.userId);
  debugLog('GET', { sessionId, agentId, userId });
  try {
    const keys = await resolveKeySchema();
    let item: Record<string, unknown> | undefined;

    if (keys.sortKey === 'agent_id') {
      const result = await getClient().send(new GetCommand({
        TableName: TABLE,
        Key: buildSessionKey(sessionId, agentId, keys.partitionKey, keys.sortKey, agentId),
      }));
      item = result.Item as Record<string, unknown> | undefined;
    } else if (keys.sortKey) {
      item = await findLatestAgentItem(sessionId, agentId, keys.partitionKey, keys.sortKey);
    } else {
      // PK-only table: primary key is sessionId#agentId.
      const result = await getClient().send(new GetCommand({
        TableName: TABLE,
        Key: buildSessionKey(sessionId, agentId, keys.partitionKey, null),
      }));
      item = result.Item as Record<string, unknown> | undefined;

      // Backward compatibility: older data keyed only by sessionId.
      if (!item) {
        const legacy = await getClient().send(new GetCommand({
          TableName: TABLE,
          Key: { [keys.partitionKey]: sessionId },
        }));
        const legacyItem = legacy.Item as Record<string, unknown> | undefined;
        if (legacyItem && String(legacyItem.agent_id ?? '') === agentId) {
          item = legacyItem;
        }
      }
    }

    const storedUserId = getStoredUserId(item);
    if (userId && storedUserId && storedUserId !== userId) {
      item = undefined;
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
  const browserSessionId = typeof req.body.browserSessionId === 'string'
    ? req.body.browserSessionId
    : typeof req.body.browser_session_id === 'string'
      ? req.body.browser_session_id
      : undefined;
  const userId = getRequestUserId(req.body.userId) ?? getRequestUserId(req.body.user_id);
  debugLog('POST', { sessionId, agentId, messageCount: messages.length, userId });
  let writeKeyMeta: { partitionKey: string; partitionValue: string; sortKey: string | null; sortValue: string | null } | null = null;
  try {
    const keys = await resolveKeySchema();
    const item = buildSessionItem(sessionId, agentId, messages, browserSessionId, userId, keys.partitionKey, keys.sortKey);
    writeKeyMeta = {
      partitionKey: keys.partitionKey,
      partitionValue: String(item[keys.partitionKey] ?? ''),
      sortKey: keys.sortKey,
      sortValue: keys.sortKey ? String(item[keys.sortKey] ?? '') : null,
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
        Key: buildSessionKey(sessionId, agentId, keys.partitionKey, keys.sortKey, agentId),
      }));
    } else if (keys.sortKey) {
      const item = await findLatestAgentItem(sessionId, agentId, keys.partitionKey, keys.sortKey);
      if (item) {
        const sortValue = String(item[keys.sortKey] ?? '');
        if (sortValue) {
          await getClient().send(new DeleteCommand({
            TableName: TABLE,
            Key: buildSessionKey(sessionId, agentId, keys.partitionKey, keys.sortKey, sortValue),
          }));
        }
      }
    } else {
      await getClient().send(new DeleteCommand({
        TableName: TABLE,
        Key: buildSessionKey(sessionId, agentId, keys.partitionKey, null),
      }));
    }
    res.json({ ok: true, persisted: true });
  } catch (err: any) {
    console.warn('[sessions] DELETE failed, skipping remote delete:', err.message);
    res.json({ ok: true, persisted: false });
  }
});

export default router;
