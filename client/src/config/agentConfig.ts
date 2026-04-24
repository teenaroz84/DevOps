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

import { AGENT_BRAND } from '../theme/truistPalette'

export interface AgentConfig {
  id: string
  /** Display name shown in the chat panel header */
  name: string
  /** One-liner shown beneath the name */
  subtitle: string
  /** MUI-compatible hex colour used for the panel accent */
  color: string
  /** Path to the agent icon asset */
  icon: string
  /** POST endpoint for non-streaming requests */
  endpoint: string
  /** POST endpoint for SSE streaming */
  streamEndpoint: string
  /** Input placeholder text */
  placeholder: string
  /** Welcome message shown at the top of a fresh conversation */
  welcomeMessage: string
  /** Chips shown when the conversation is empty */
  quickActions: Array<{ label: string; query: string }>
}

export type FullscreenAgentMenuId =
  | 'chat'
  | 'esp-chat'
  | 'dmf-chat'
  | 'servicenow-chat'
  | 'talend-chat'
  | 'snowflake-chat'

// ─── Per-agent definitions ────────────────────────────────

export const AGENTS: Record<string, AgentConfig> = {
  knowledge: {
    id: 'knowledge',
    name: 'TDT DataOps Knowledge Assistant',
    subtitle: 'Cross-platform · Documentation & Standards',
    color: AGENT_BRAND.knowledge,
    icon: '/agent-icons/KnowledgeAssist.png',
    endpoint: '/api/v1/chat',
    streamEndpoint: '/api/v1/chat/stream',
    placeholder: 'Ask about DMF, ESP, Talend, ingestion standards…',
    welcomeMessage: `Hi - Welcome! I am your Truist Digital Teammate: AI & Data Knowledge assist`,
    quickActions: [
      { label: '📁 DMF Ingestion Directory',  query: 'What is the DMF ingestion directory structure?' },
      { label: '🔧 DMF Enrichment Standards', query: 'What are the DMF enrichment standards?' },
      { label: '⏱  ESP Scheduling Standards', query: 'What are the DMF ESP scheduling standards?' },
      { label: '📘 Talend Dev Guide',          query: 'Provide the Talend development guide and best practices.' },
    ],
  },

  esp: {
    id: 'esp',
    name: 'TDT ESP Scheduling Agent',
    subtitle: 'Enterprise Scheduler Platform · Job Intelligence',
    color: AGENT_BRAND.esp,
    icon: '/agent-icons/ESPAgent.png',
    endpoint: '/api/esp/chat',
    streamEndpoint: '/api/esp/chat/stream',
    placeholder: 'Ask about ESP jobs, schedules, failures…',
    welcomeMessage: `Hi - Welcome! I am your ESP Scheduling Agent.`,
    quickActions: [
      { label: '🔴 Failing jobs',       query: 'Which jobs have recent completion-code failures?' },
      { label: '⏳ Stale jobs',          query: 'Which jobs have not run in the last 3 days?' },
      { label: '📋 Job dependencies',   query: 'Show me the job dependency chain for this application.' },
      { label: '📊 Run trend summary',  query: 'Summarise the recent job run trend and highlight any anomalies.' },
    ],
  },

  dmf: {
    id: 'dmf',
    name: 'TDT DMF Pipeline Agent',
    subtitle: 'Data Management Framework · Pipeline Intelligence',
    color: AGENT_BRAND.dmf,
    icon: '/agent-icons/DMFAgent.png',
    endpoint: '/api/dmf/chat',
    streamEndpoint: '/api/dmf/chat/stream',
    placeholder: 'Ask about DMF pipelines, run status, failures…',
    welcomeMessage: `Hi - Welcome! I am your DMF Pipeline Agent.`,
    quickActions: [
      { label: '❌ Failed pipelines',   query: 'Which DMF pipelines are currently failing?' },
      { label: '📈 Run history',        query: 'Show me recent DMF pipeline run trends.' },
      { label: '🗂  Source counts',      query: 'How many active sources are there per domain?' },
      { label: '⚙️  Enrichment errors', query: "Are there any enrichment errors in today's runs?" },
    ],
  },

  servicenow: {
    id: 'servicenow',
    name: 'TDT ServiceNow Incident Agent',
    subtitle: 'ITSM · Incidents & Problem Management',
    color: AGENT_BRAND.servicenow,
    icon: '/agent-icons/ServiceNowAgent.png',
    endpoint: '/api/snow/chat',
    streamEndpoint: '/api/snow/chat/stream',
    placeholder: 'Ask about incidents, tickets, problems…',
    welcomeMessage: `Hi - Welcome! I am your Incident Resolution Agent`,
    quickActions: [
      { label: '🚨 Open P1/P2 incidents', query: 'What are the current open P1 and P2 incidents?' },
      { label: '📋 Ageing problems',       query: 'Show me problems open longer than 30 days.' },
      { label: '🔧 Emergency changes',     query: 'Are there any emergency changes pending?' },
      { label: '📉 Incident trend',        query: 'How has the incident count trended this week?' },
    ],
  },

  talend: {
    id: 'talend',
    name: 'TDT Talend Integration Agent',
    subtitle: 'Data Integration · Job Monitoring',
    color: AGENT_BRAND.talend,
    icon: '/agent-icons/TalendLogAgent.png',
    endpoint: '/api/talend/chat',
    streamEndpoint: '/api/talend/chat/stream',
    placeholder: 'Ask about Talend jobs, errors, pipelines…',
    welcomeMessage: `Hi - Welcome! I am your Talend Integration Agent.`,
    quickActions: [
      { label: '❌ Failed jobs today',  query: 'Which Talend jobs failed today?' },
      { label: '⏱  Long-running jobs', query: 'Which jobs are running longer than expected?' },
      { label: '📊 Success rate',       query: 'What is the overall job success rate this week?' },
      { label: '🔁 Retry patterns',     query: 'Which jobs have the most retries?' },
    ],
  },

  snowflake: {
    id: 'snowflake',
    name: 'TDT Snowflake Analytics Agent',
    subtitle: 'Cloud Data Platform · Cost & Query Intelligence',
    color: AGENT_BRAND.snowflake,
    icon: '/agent-icons/SnowflakeAgent.png',
    endpoint: '/api/snow/chat',
    streamEndpoint: '/api/snow/chat/stream',
    placeholder: 'Ask about Snowflake costs, queries, usage…',
    welcomeMessage: `Hi - Welcome! I am your Snowflake Analytics Agent.`,
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

export const FULLSCREEN_AGENT_MENUS: Array<{
  menuId: FullscreenAgentMenuId
  agentId: keyof typeof AGENTS
  label: string
  mockOnly?: boolean
}> = [
  { menuId: 'chat',            agentId: 'knowledge',  label: 'TDT Knowledge Assist' },
  { menuId: 'talend-chat',     agentId: 'talend',     label: 'TDT Talend Agent' },
  { menuId: 'dmf-chat',        agentId: 'dmf',        label: 'TDT DMF Agent' },
  { menuId: 'esp-chat',        agentId: 'esp',        label: 'TDT ESP Agent' },
  { menuId: 'servicenow-chat', agentId: 'servicenow', label: 'TDT ServiceNow Agent' },
  { menuId: 'snowflake-chat',  agentId: 'snowflake',  label: 'TDT Snowflake Agent', mockOnly: true },
]
