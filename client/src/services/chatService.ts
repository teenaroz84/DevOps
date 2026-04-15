/**
 * Chat Service — DataOps Assistant chat API.
 * Sends messages to /api/v1/chat and normalises the response
 * into { text, type, data, suggestedActions } for ChatPanel.
 */
import { config } from '../config'
import { SESSION_ID } from './session'

async function chatRequest<T>(path: string, body: unknown): Promise<T> {
  const url = `${config.chatApiBaseUrl}${path}`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`Chat API ${res.status}: ${res.statusText}`)
  return res.json()
}

interface ChatApiResponse {
  // Common external API response shapes — all optional, we pick whichever is present
  text?: string
  message?: string
  response?: string
  content?: string
  reply?: string
  answer?: string
  detail?: string
  type?: string
  data?: any
  suggestedActions?: Array<{ label: string; action: string; icon?: string }>
}

function normaliseResponse(raw: ChatApiResponse): { text: string; type?: string; data?: any; suggestedActions?: any } {
  const text =
    raw.answer ??
    raw.text ??
    raw.message ??
    raw.response ??
    raw.content ??
    raw.reply ??
    raw.detail ??
    ''
  return {
    text,
    type: raw.type,
    data: raw.data,
    suggestedActions: raw.suggestedActions,
  }
}

/** Stream a response from /chat/stream, calling onChunk for each text chunk received. */
async function streamRequest(
  path: string,
  body: unknown,
  onChunk: (chunk: string) => void,
  signal?: AbortSignal,
): Promise<void> {
  const url = `${config.chatApiBaseUrl}${path}`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  })
  if (!res.ok) throw new Error(`Chat API ${res.status}: ${res.statusText}`)
  if (!res.body) throw new Error('Streaming not supported by server')

  const reader = res.body.getReader()
  const decoder = new TextDecoder()

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    const raw = decoder.decode(value, { stream: true })
    // Handle both SSE ("data: {...}\n\n") and raw newline-delimited JSON/text
    for (const line of raw.split('\n')) {
      const trimmed = line.replace(/^data:\s*/, '').trim()
      if (!trimmed || trimmed === '[DONE]') continue
      try {
        const parsed = JSON.parse(trimmed)
        // Extract text from common streaming shapes
        const chunk =
          parsed.token ??
          parsed.text ??
          parsed.delta?.content ??       // OpenAI-style
          parsed.choices?.[0]?.delta?.content ??
          parsed.message ??
          parsed.content ??
          ''
        if (chunk) onChunk(chunk)
      } catch {
        // Plain text chunk — use as-is
        if (trimmed) onChunk(trimmed)
      }
    }
  }
}

export const chatService = {
  /**
   * Send a message to the given agent endpoint.
   * Defaults to the knowledge assistant when no endpoint is supplied.
   */
  sendMessage: async (message: string, endpoint = '/api/v1/chat') => {
    const raw = await chatRequest<ChatApiResponse>(endpoint, { session_id: SESSION_ID, message, conversation_history: [] })
    return normaliseResponse(raw)
  },

  /**
   * Load chat history for a session + agent from DynamoDB.
   * Returns an empty array if the session does not exist or the request fails.
   */
  loadSession: async (agentId: string): Promise<Array<{ role: 'user' | 'agent'; content: string; type?: string; data?: any; timestamp?: number; suggestedActions?: any }>> => {
    try {
      const url = `${config.apiBaseUrl}/api/sessions/${encodeURIComponent(SESSION_ID)}/${encodeURIComponent(agentId)}`
      const res = await fetch(url)
      if (!res.ok) return []
      const json = await res.json()
      return Array.isArray(json.messages) ? json.messages : []
    } catch {
      return []
    }
  },

  /**
   * Persist the current message list for a session + agent to DynamoDB.
   * Fire-and-forget — failures are silently swallowed so they never block the UI.
   */
  saveSession: (agentId: string, messages: unknown[]): void => {
    const url = `${config.apiBaseUrl}/api/sessions/${encodeURIComponent(SESSION_ID)}/${encodeURIComponent(agentId)}`
    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages }),
    }).then(res => res.json()).then(data => {
      if (data.error) {
        console.warn('[chatService] Session save failed:', { agentId, error: data.error, code: data.code })
      }
    }).catch(() => { /* silent */ })
  },

  /**
   * Delete the stored history for a session + agent from DynamoDB.
   */
  clearSession: (agentId: string): void => {
    const url = `${config.apiBaseUrl}/api/sessions/${encodeURIComponent(SESSION_ID)}/${encodeURIComponent(agentId)}`
    fetch(url, { method: 'DELETE' }).catch(() => { /* silent */ })
  },

  /**
   * Stream a response token-by-token.
   * Pass a custom streamEndpoint to target a specific dashboard agent.
   */
  streamMessage: (
    message: string,
    onChunk: (chunk: string) => void,
    signal?: AbortSignal,
    streamEndpoint = '/api/v1/chat/stream',
  ): Promise<void> => {
    return streamRequest(streamEndpoint, { session_id: SESSION_ID, message }, onChunk, signal)
  },

  /** Check health of the chat agent service. */
  checkHealth: async (): Promise<{ status: string; [key: string]: any }> => {
    const url = `${config.chatApiBaseUrl}/api/v1/health`
    const res = await fetch(url, { method: 'GET' })
    if (!res.ok) throw new Error(`Health check failed: ${res.status} ${res.statusText}`)
    return res.json()
  },
}
