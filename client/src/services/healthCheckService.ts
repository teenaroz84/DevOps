import { config } from '../config'

export type HealthCheckWorkflowStage =
  | 'idle'
  | 'planning'
  | 'analysis'
  | 'approval'
  | 'execution'
  | 'l1-feedback'
  | 'review'
  | 'completed'
  | 'cancelled'

export type HealthCheckWorkflowNodeState = 'pending' | 'active' | 'complete' | 'skipped'

export interface HealthCheckWorkflowNode {
  id: string
  label: string
  state: HealthCheckWorkflowNodeState
}

export interface HealthCheckWorkflowMessage {
  id: string
  role: 'user' | 'agent' | 'system' | 'l1'
  content: string
  timestamp: string
}

export interface HealthCheckAuditEvent {
  id: string
  at: string
  type: string
  actor: 'user' | 'system' | 'l1'
  summary: string
  details?: string
}

export interface HealthCheckApprovalPrompt {
  question: string
  description: string
  options: Array<{ label: string; value: 'yes' | 'no'; variant: 'contained' | 'outlined' }>
}

export interface HealthCheckWorkflowState {
  stage: HealthCheckWorkflowStage
  prompt: string
  messages: HealthCheckWorkflowMessage[]
  auditEvents: HealthCheckAuditEvent[]
  workflowNodes: HealthCheckWorkflowNode[]
  approvalPrompt?: HealthCheckApprovalPrompt
  analysisSummary?: string
  l1Feedback?: string
  recommendedActions: string[]
  persistedAt?: string
}

export interface HealthCheckAuditPlaceholder {
  destination: 'dynamodb'
  mode: 'placeholder' | 'active'
  actionCount: number
  lastPreparedAt?: string
}

interface WorkflowResponse {
  ok: boolean
  state: HealthCheckWorkflowState | null
  persisted: boolean
  persistenceError?: string
  auditPlaceholder?: HealthCheckAuditPlaceholder
}

async function workflowRequest<T>(path: string, body?: unknown, method: 'GET' | 'POST' = 'POST'): Promise<T> {
  const url = `${config.apiBaseUrl}${path}`
  const res = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    ...(body ? { body: JSON.stringify(body) } : {}),
  })

  const json = await res.json().catch(() => null)
  if (!res.ok) {
    const errorMessage = json && typeof json.error === 'string' ? json.error : `Health Check API ${res.status}: ${res.statusText}`
    throw new Error(errorMessage)
  }

  return json as T
}

export const healthCheckService = {
  loadWorkflow: async (sessionId: string): Promise<WorkflowResponse> => {
    return workflowRequest<WorkflowResponse>(`/api/health-check/workflow/${encodeURIComponent(sessionId)}`, undefined, 'GET')
  },

  startWorkflow: async (payload: { sessionId: string; prompt: string; browserSessionId?: string; userId?: string }): Promise<WorkflowResponse> => {
    return workflowRequest<WorkflowResponse>('/api/health-check/workflow', {
      action: 'start',
      ...payload,
    })
  },

  restartWorkflow: async (payload: { sessionId: string; prompt: string; browserSessionId?: string; userId?: string }): Promise<WorkflowResponse> => {
    return workflowRequest<WorkflowResponse>('/api/health-check/workflow', {
      action: 'restart',
      ...payload,
    })
  },

  submitApproval: async (payload: { sessionId: string; approval: 'yes' | 'no'; browserSessionId?: string; userId?: string }): Promise<WorkflowResponse> => {
    return workflowRequest<WorkflowResponse>('/api/health-check/workflow', {
      action: 'approval',
      ...payload,
    })
  },

  submitL1Feedback: async (payload: { sessionId: string; feedback: string; browserSessionId?: string; userId?: string }): Promise<WorkflowResponse> => {
    return workflowRequest<WorkflowResponse>('/api/health-check/workflow', {
      action: 'l1_feedback',
      ...payload,
    })
  },
}