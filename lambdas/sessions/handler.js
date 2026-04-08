/**
 * Sessions Lambda — persists chat agent history in DynamoDB.
 *
 * GET  /api/sessions/{sessionId}/{agentId}  → { messages: [...] }
 * POST /api/sessions/{sessionId}/{agentId}  → { ok: true }
 *
 * DynamoDB schema
 * ───────────────
 *   PK  session_id  String  — browser session UUID
 *   SK  agent_id    String  — agent identifier (knowledge | esp | dmf …)
 *       messages    String  — JSON-serialised Message[]
 *       updated_at  String  — ISO timestamp
 *       ttl         Number  — Unix epoch; DynamoDB TTL (30 days)
 */
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, PutCommand, DeleteCommand } = require('@aws-sdk/lib-dynamodb');
const { success, badRequest, serverError, corsPreFlight } = require('../shared/response');

const TABLE = process.env.SESSIONS_TABLE || 'ChatSessions';
const TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return corsPreFlight();

  const { sessionId, agentId } = event.pathParameters || {};
  if (!sessionId || !agentId) return badRequest('sessionId and agentId path parameters are required');

  try {
    // ── GET — load history ──────────────────────────────────────────────────
    if (event.httpMethod === 'GET') {
      const result = await ddb.send(new GetCommand({
        TableName: TABLE,
        Key: { session_id: sessionId, agent_id: agentId },
      }));

      const messages = result.Item ? JSON.parse(result.Item.messages || '[]') : [];
      return success({ messages });
    }

    // ── POST — save / replace history ──────────────────────────────────────
    if (event.httpMethod === 'POST') {
      const body = JSON.parse(event.body || '{}');
      const messages = Array.isArray(body.messages) ? body.messages : [];

      await ddb.send(new PutCommand({
        TableName: TABLE,
        Item: {
          session_id: sessionId,
          agent_id: agentId,
          messages: JSON.stringify(messages),
          updated_at: new Date().toISOString(),
          ttl: Math.floor(Date.now() / 1000) + TTL_SECONDS,
        },
      }));

      return success({ ok: true });
    }

    // ── DELETE — clear history ──────────────────────────────────────────────
    if (event.httpMethod === 'DELETE') {
      await ddb.send(new DeleteCommand({
        TableName: TABLE,
        Key: { session_id: sessionId, agent_id: agentId },
      }));
      return success({ ok: true });
    }

    return badRequest('Method not allowed');
  } catch (err) {
    console.error('[sessions] error:', err);
    return serverError(err instanceof Error ? err.message : String(err));
  }
};
