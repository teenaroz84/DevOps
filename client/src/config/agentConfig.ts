/**
 * agentConfig.ts
 *
 * Central registry of all AI agents in the DataOps platform.
 * Each entry defines the agent's identity, target API endpoint,
 * accent colour, and context-relevant quick-action prompts.
 *
 * Endpoint conventions
 * ────────────────────
 *   Global knowledge agent : /api/v1/chat
 *   Dashboard-specific     : /api/v1/agents/<id>/chat
 *   Streaming variants     : same path + /stream
 */

export interface AgentConfig {
  id: string
  /** Display name shown in the chat panel header */
  name: string
  /** One-liner shown beneath the name */
  subtitle: string
  /** MUI-compatible hex colour used for the panel accent */
  color: string
  /** POST endpoint for non-streaming requests */
  endpoint: string
  /** POST endpoint for SSE streaming */
  streamEndpoint: string
  /** Input placeholder text */
  placeholder: string
  /** Chips shown when the conversation is empty */
  quickActions: Array<{ label: string; query: string }>
}

// ─── Per-agent definitions ────────────────────────────────

export const AGENTS: Record<string, AgentConfig> = {
  knowledge: {
    id: 'knowledge',
    name: 'DataOps Knowledge Assistant',
    subtitle: 'Cross-platform · Documentation & Standards',
    color: '#1976d2',
    endpoint: '/api/v1/chat',
    streamEndpoint: '/api/v1/chat/stream',
    placeholder: 'Ask about DMF, ESP, Talend, ingestion standards…',
    quickActions: [
      { label: '📁 DMF Ingestion Directory',  query: 'What is the DMF ingestion directory structure?' },
      { label: '🔧 DMF Enrichment Standards', query: 'What are the DMF enrichment standards?' },
      { label: '⏱  ESP Scheduling Standards', query: 'What are the DMF ESP scheduling standards?' },
      { label: '📘 Talend Dev Guide',          query: 'Provide the Talend development guide and best practices.' },
    ],
  },

  esp: {
    id: 'esp',
    name: 'ESP Scheduling Agent',
    subtitle: 'Enterprise Scheduler Platform · Job Intelligence',
    color: '#2e7d32',
    endpoint: '/api/v1/agents/esp/chat',
    streamEndpoint: '/api/v1/agents/esp/chat/stream',
    placeholder: 'Ask about ESP jobs, schedules, failures…',
    quickActions: [
      { label: '🔴 Failing jobs',       query: 'Which jobs have recent completion-code failures?' },
      { label: '⏳ Stale jobs',          query: 'Which jobs have not run in the last 3 days?' },
      { label: '📋 Job dependencies',   query: 'Show me the job dependency chain for this application.' },
      { label: '📊 Run trend summary',  query: 'Summarise the recent job run trend and highlight any anomalies.' },
    ],
  },

  dmf: {
    id: 'dmf',
    name: 'DMF Pipeline Agent',
    subtitle: 'Data Management Framework · Pipeline Intelligence',
    color: '#1565c0',
    endpoint: '/api/v1/agents/dmf/chat',
    streamEndpoint: '/api/v1/agents/dmf/chat/stream',
    placeholder: 'Ask about DMF pipelines, run status, failures…',
    quickActions: [
      { label: '❌ Failed pipelines',   query: 'Which DMF pipelines are currently failing?' },
      { label: '📈 Run history',        query: 'Show me recent DMF pipeline run trends.' },
      { label: '🗂  Source counts',      query: 'How many active sources are there per domain?' },
      { label: '⚙️  Enrichment errors', query: "Are there any enrichment errors in today's runs?" },
    ],
  },

  servicenow: {
    id: 'servicenow',
    name: 'ServiceNow Incident Agent',
    subtitle: 'ITSM · Incidents & Problem Management',
    color: '#5c6bc0',
    endpoint: '/api/v1/agents/servicenow/chat',
    streamEndpoint: '/api/v1/agents/servicenow/chat/stream',
    placeholder: 'Ask about incidents, tickets, problems…',
    quickActions: [
      { label: '🚨 Open P1/P2 incidents', query: 'What are the current open P1 and P2 incidents?' },
      { label: '📋 Ageing problems',       query: 'Show me problems open longer than 30 days.' },
      { label: '🔧 Emergency changes',     query: 'Are there any emergency changes pending?' },
      { label: '📉 Incident trend',        query: 'How has the incident count trended this week?' },
    ],
  },

  talend: {
    id: 'talend',
    name: 'Talend Integration Agent',
    subtitle: 'Data Integration · Job Monitoring',
    color: '#e65100',
    endpoint: '/api/v1/agents/talend/chat',
    streamEndpoint: '/api/v1/agents/talend/chat/stream',
    placeholder: 'Ask about Talend jobs, errors, pipelines…',
    quickActions: [
      { label: '❌ Failed jobs today',  query: 'Which Talend jobs failed today?' },
      { label: '⏱  Long-running jobs', query: 'Which jobs are running longer than expected?' },
      { label: '📊 Success rate',       query: 'What is the overall job success rate this week?' },
      { label: '🔁 Retry patterns',     query: 'Which jobs have the most retries?' },
    ],
  },

  snowflake: {
    id: 'snowflake',
    name: 'Snowflake Analytics Agent',
    subtitle: 'Cloud Data Platform · Cost & Query Intelligence',
    color: '#0277bd',
    endpoint: '/api/v1/agents/snowflake/chat',
    streamEndpoint: '/api/v1/agents/snowflake/chat/stream',
    placeholder: 'Ask about Snowflake costs, queries, usage…',
    quickActions: [
      { label: '💰 Cost by warehouse', query: 'Show me current costs by warehouse.' },
      { label: '🐌 Slow queries',       query: 'Which queries are taking the longest to run?' },
      { label: '📊 Storage usage',      query: 'What is the current storage consumption?' },
      { label: '👥 Top users',          query: 'Who are the highest credit-consuming users this week?' },
    ],
  },
}

/**
 * Maps each ExecutiveDashboard source key to an agent ID.
 * Used by the tab bar to surface the right "Ask Agent" button.
 */
export const SOURCE_AGENT_MAP: Record<string, string> = {
  pipeline:   'esp',
  dmf:        'dmf',
  servicenow: 'servicenow',
  logs:       'talend',
  snowflake:  'snowflake',
  overview:   'knowledge',
}
