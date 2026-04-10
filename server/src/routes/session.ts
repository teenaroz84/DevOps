/**
 * Session routes — DynamoDB-backed chat history persistence (local dev server).
 *
 * GET    /api/sessions/:sessionId/:agentId  → { messages: [...] }
 * POST   /api/sessions/:sessionId/:agentId  → { ok: true }
 * DELETE /api/sessions/:sessionId/:agentId  → { ok: true }
 *
 * Requires AWS credentials in the environment (AWS_REGION, AWS_ACCESS_KEY_ID,
 * AWS_SECRET_ACCESS_KEY) or the default credential chain (SSO, instance role…).
 * Falls back gracefully to an empty history when DynamoDB is unreachable.
 */
import { Router, Request, Response } from 'express';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { BatchWriteCommand, DeleteCommand, DynamoDBDocumentClient, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';

const router = Router();

const TABLE = process.env.SESSIONS_TABLE || 'ChatSessions';
const DEBUG_SESSIONS = process.env.DEBUG_SESSIONS === '1';

let ddb: DynamoDBDocumentClient | null = null;

type StoredMessage = {
  role: 'user' | 'agent';
  content: string;
  timestamp?: number;
};

type SessionTurn = {
  session_id: string;
  session_id_timestamp: string;
  'User ID'?: string;
  Query: string;
  Response: string;
};

function debugSessionLog(event: string, details?: Record<string, unknown>): void {
  if (!DEBUG_SESSIONS) return;
  if (details) {
    console.log(`[sessions] ${event}`, details);
    return;
  }
  console.log(`[sessions] ${event}`);
}

function getClient(): DynamoDBDocumentClient {
  if (!ddb) {
    const base = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
    ddb = DynamoDBDocumentClient.from(base);
  }
  return ddb;
}

function getStorageSessionId(sessionId: string, agentId: string): string {
  return `${sessionId}:${agentId}`;
}

function buildTurns(storageSessionId: string, messages: StoredMessage[], userId?: string): SessionTurn[] {
  const turns: SessionTurn[] = [];
  let pendingUser: StoredMessage | null = null;
  let sequence = 0;

  for (const message of messages) {
    if (!message || typeof message.content !== 'string' || !message.content.trim()) continue;

    if (message.role === 'user') {
      pendingUser = message;
      continue;
    }

    if (message.role === 'agent' && pendingUser) {
      const baseTimestamp = pendingUser.timestamp ?? message.timestamp ?? Date.now();
      const sortKey = `${String(baseTimestamp).padStart(13, '0')}_${String(sequence).padStart(4, '0')}`;
      turns.push({
        session_id: storageSessionId,
        session_id_timestamp: sortKey,
        ...(userId ? { 'User ID': userId } : {}),
        Query: pendingUser.content,
        Response: message.content,
      });
      pendingUser = null;
      sequence += 1;
    }
  }

  return turns;
}

async function listTurns(sessionId: string, agentId: string): Promise<SessionTurn[]> {
  const storageSessionId = getStorageSessionId(sessionId, agentId);
  const result = await getClient().send(new QueryCommand({
    TableName: TABLE,
    KeyConditionExpression: 'session_id = :sessionId',
    ExpressionAttributeValues: {
      ':sessionId': storageSessionId,
    },
    ScanIndexForward: true,
  }));

  return Array.isArray(result.Items) ? result.Items as SessionTurn[] : [];
}

async function deleteTurns(sessionId: string, agentId: string): Promise<void> {
  const turns = await listTurns(sessionId, agentId);
  if (turns.length === 0) return;

  for (let index = 0; index < turns.length; index += 25) {
    const chunk = turns.slice(index, index + 25);
    await getClient().send(new BatchWriteCommand({
      RequestItems: {
        [TABLE]: chunk.map((turn) => ({
          DeleteRequest: {
            Key: {
              session_id: turn.session_id,
              session_id_timestamp: turn.session_id_timestamp,
            },
          },
        })),
      },
    }));
  }
}

function toMessages(turns: SessionTurn[]): Array<{ role: 'user' | 'agent'; content: string; timestamp: number }> {
  return turns.flatMap((turn, index) => {
    const parsedTimestamp = Number.parseInt(String(turn.session_id_timestamp).split('_')[0] ?? '', 10);
    const baseTimestamp = Number.isFinite(parsedTimestamp) ? parsedTimestamp : index;
    return [
      { role: 'user' as const, content: turn.Query ?? '', timestamp: baseTimestamp },
      { role: 'agent' as const, content: turn.Response ?? '', timestamp: baseTimestamp + 1 },
    ];
  });
}

// GET /api/sessions/:sessionId/:agentId
router.get('/:sessionId/:agentId', async (req: Request, res: Response) => {
  const { sessionId, agentId } = req.params;
  debugSessionLog('GET request', {
    route: req.originalUrl,
    sessionId,
    agentId,
    storageSessionId: getStorageSessionId(sessionId, agentId),
  });
  try {
    const turns = await listTurns(sessionId, agentId);
    const messages = toMessages(turns);
    debugSessionLog('GET response', {
      sessionId,
      agentId,
      turnCount: turns.length,
      messageCount: messages.length,
      messages,
    });
    res.json({ messages });
  } catch (err: any) {
    console.warn('[sessions] GET failed, returning empty history:', err.message);
    res.json({ messages: [] });
  }
});

// POST /api/sessions/:sessionId/:agentId
router.post('/:sessionId/:agentId', async (req: Request, res: Response) => {
  const { sessionId, agentId } = req.params;
  const messages = Array.isArray(req.body.messages) ? req.body.messages as StoredMessage[] : [];
  const userId = typeof req.body.userId === 'string' && req.body.userId.trim() ? req.body.userId.trim() : undefined;
  debugSessionLog('POST request', {
    route: req.originalUrl,
    sessionId,
    agentId,
    storageSessionId: getStorageSessionId(sessionId, agentId),
    body: req.body,
  });
  try {
    const turns = buildTurns(getStorageSessionId(sessionId, agentId), messages, userId);
    debugSessionLog('POST translated turns', {
      sessionId,
      agentId,
      turnCount: turns.length,
      turns,
    });
    await deleteTurns(sessionId, agentId);

    for (const turn of turns) {
      await getClient().send(new PutCommand({
        TableName: TABLE,
        Item: turn,
      }));
    }

    debugSessionLog('POST persisted', {
      sessionId,
      agentId,
      persisted: true,
      turnCount: turns.length,
      table: TABLE,
    });
    res.json({ ok: true, persisted: true });
  } catch (err: any) {
    console.warn('[sessions] POST failed, skipping remote persistence:', err.message);
    debugSessionLog('POST persisted', {
      sessionId,
      agentId,
      persisted: false,
      error: err.message,
      table: TABLE,
    });
    res.json({ ok: true, persisted: false });
  }
});

// DELETE /api/sessions/:sessionId/:agentId
router.delete('/:sessionId/:agentId', async (req: Request, res: Response) => {
  const { sessionId, agentId } = req.params;
  debugSessionLog('DELETE request', {
    route: req.originalUrl,
    sessionId,
    agentId,
    storageSessionId: getStorageSessionId(sessionId, agentId),
  });
  try {
    const turns = await listTurns(sessionId, agentId);
    if (turns.length === 1) {
      await getClient().send(new DeleteCommand({
        TableName: TABLE,
        Key: {
          session_id: turns[0].session_id,
          session_id_timestamp: turns[0].session_id_timestamp,
        },
      }));
    } else {
      await deleteTurns(sessionId, agentId);
    }
    debugSessionLog('DELETE persisted', {
      sessionId,
      agentId,
      persisted: true,
      deletedTurnCount: turns.length,
      table: TABLE,
    });
    res.json({ ok: true, persisted: true });
  } catch (err: any) {
    console.warn('[sessions] DELETE failed, skipping remote delete:', err.message);
    debugSessionLog('DELETE persisted', {
      sessionId,
      agentId,
      persisted: false,
      error: err.message,
      table: TABLE,
    });
    res.json({ ok: true, persisted: false });
  }
});

export default router;
