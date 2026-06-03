import { Router, Request, Response } from 'express';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';

const router = Router();

const TABLE = process.env.HEALTH_CHECK_AUDIT_TABLE || process.env.SESSIONS_TABLE || 'aws3748-dt57-edoops-session-store';
const ACTION_AUDIT_TABLE = process.env.HEALTH_CHECK_ACTION_AUDIT_TABLE || 'health-check-action-audit';
const REGION = process.env.AWS_REGION || 'us-east-1';
const AUDIT_AGENT_ID = process.env.HEALTH_CHECK_AUDIT_AGENT_ID || 'health-check-audit';
const TTL_SECONDS = 30 * 24 * 60 * 60;
const ENV_USER = process.env.username || process.env.USERNAME || process.env.USER || 'unknown';

let ddb: DynamoDBDocumentClient | null = null;
const mockAuditStore = new Map<string, StoredAuditRecord>();
const mockActionAuditStore = new Map<string, HealthCheckActionAuditRecord>();

type WorkflowStage =
  | 'idle'
  | 'planning'
  | 'analysis'
  | 'approval'
  | 'execution'
  | 'l1-feedback'
  | 'review'
  | 'completed'
  | 'cancelled';

type WorkflowNodeId =
  | 'prompt'
  | 'planner'
  | 'knowledge'
  | 'analyzer'
  | 'approval'
  | 'infra'
  | 'logs'
  | 'pipeline'
  | 'reviewer'
  | 'audit';

type NodeState = 'pending' | 'active' | 'complete' | 'skipped';

type AuditEvent = {
  id: string;
  at: string;
  type: 'workflow_started' | 'analysis_completed' | 'approval_recorded' | 'l1_feedback_recorded' | 'review_completed';
  actor: 'user' | 'system' | 'l1';
  summary: string;
  details?: string;
};

type WorkflowMessage = {
  id: string;
  role: 'user' | 'agent' | 'system' | 'l1';
  content: string;
  timestamp: string;
};

type ApprovalPrompt = {
  question: string;
  description: string;
  options: Array<{ label: string; value: 'yes' | 'no'; variant: 'contained' | 'outlined' }>;
};

type WorkflowState = {
  stage: WorkflowStage;
  prompt: string;
  messages: WorkflowMessage[];
  auditEvents: AuditEvent[];
  workflowNodes: Array<{ id: WorkflowNodeId; label: string; state: NodeState }>;
  approvalPrompt?: ApprovalPrompt;
  analysisSummary?: string;
  l1Feedback?: string;
  recommendedActions: string[];
  persistedAt?: string;
};

type StoredAuditRecord = {
  session_id: string;
  agent_id: string;
  browser_session_id?: string;
  user_id?: string;
  workflow_state: WorkflowState;
  updated_at: string;
  ttl: number;
};

type AuditPlaceholder = {
  destination: 'dynamodb';
  mode: 'placeholder' | 'active';
  actionCount: number;
  lastPreparedAt?: string;
};

type MockScenario = {
  service: string;
  environment: string;
  severity: 'P1' | 'P2' | 'P3';
  symptom: string;
  likelyOwner: string;
  suspiciousSignals: string[];
  checks: string[];
  remediationHints: string[];
};

type HealthCheckActionAuditRecord = {
  audit_id: string;
  session_id: string;
  browser_session_id?: string;
  user_id?: string;
  agent_id: string;
  action_clicked: string;
  action_for?: string;
  action_source: 'button' | 'manual';
  clicked_at: string;
  updated_at: string;
  ttl: number;
};

function isCredentialProviderError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const candidate = [
    error.name,
    error.message,
    String((error as Error & { code?: string }).code ?? ''),
  ].join(' ');

  return /Could not load credentials from any providers|CredentialsProviderError|credential/i.test(candidate);
}

function buildStoredAuditRecord(
  sessionId: string,
  browserSessionId: string | undefined,
  userId: string | undefined,
  state: WorkflowState,
  persistedAt: string,
): StoredAuditRecord {
  return {
    session_id: sessionId,
    agent_id: AUDIT_AGENT_ID,
    ...(browserSessionId ? { browser_session_id: browserSessionId } : {}),
    ...(userId ? { user_id: userId } : {}),
    workflow_state: {
      ...state,
      persistedAt,
    },
    updated_at: persistedAt,
    ttl: Math.floor(Date.now() / 1000) + TTL_SECONDS,
  };
}

function buildHealthCheckActionAuditRecord(
  sessionId: string,
  browserSessionId: string | undefined,
  userId: string | undefined,
  actionClicked: string,
  actionFor: string | undefined,
  actionSource: 'button' | 'manual',
  clickedAt: string,
): HealthCheckActionAuditRecord {
  return {
    audit_id: createId('health-check-action'),
    session_id: sessionId,
    ...(browserSessionId ? { browser_session_id: browserSessionId } : {}),
    ...(userId ? { user_id: userId } : {}),
    agent_id: 'health-check',
    action_clicked: actionClicked,
    ...(actionFor ? { action_for: actionFor } : {}),
    action_source: actionSource,
    clicked_at: clickedAt,
    updated_at: clickedAt,
    ttl: Math.floor(Date.now() / 1000) + TTL_SECONDS,
  };
}

function getClient(): DynamoDBDocumentClient {
  if (!ddb) {
    ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }));
  }
  return ddb;
}

function createId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.round(Math.random() * 1_000_000)}`;
}

function appendMessage(
  messages: WorkflowMessage[],
  role: WorkflowMessage['role'],
  content: string,
): WorkflowMessage[] {
  return [
    ...messages,
    {
      id: createId(role),
      role,
      content,
      timestamp: new Date().toISOString(),
    },
  ];
}

function getEffectiveUserId(userId: unknown): string | undefined {
  if (typeof userId !== 'string' || userId.trim().length === 0) return undefined;
  return `${userId.trim()}:${ENV_USER}`;
}

function workflowNodesForStage(stage: WorkflowStage): WorkflowState['workflowNodes'] {
  const activeByStage: Partial<Record<WorkflowStage, WorkflowNodeId>> = {
    planning: 'planner',
    analysis: 'analyzer',
    approval: 'approval',
    execution: 'infra',
    'l1-feedback': 'logs',
    review: 'reviewer',
    completed: 'audit',
  };

  const completeByStage: Partial<Record<WorkflowStage, WorkflowNodeId[]>> = {
    idle: [],
    planning: ['prompt'],
    analysis: ['prompt', 'planner', 'knowledge'],
    approval: ['prompt', 'planner', 'knowledge', 'analyzer'],
    execution: ['prompt', 'planner', 'knowledge', 'analyzer', 'approval'],
    'l1-feedback': ['prompt', 'planner', 'knowledge', 'analyzer', 'approval', 'infra', 'pipeline'],
    review: ['prompt', 'planner', 'knowledge', 'analyzer', 'approval', 'infra', 'pipeline', 'logs'],
    completed: ['prompt', 'planner', 'knowledge', 'analyzer', 'approval', 'infra', 'pipeline', 'logs', 'reviewer'],
    cancelled: ['prompt', 'planner', 'knowledge', 'analyzer'],
  };

  const skippedByStage: Partial<Record<WorkflowStage, WorkflowNodeId[]>> = {
    cancelled: ['approval', 'infra', 'logs', 'pipeline', 'reviewer', 'audit'],
  };

  const labels: Array<{ id: WorkflowNodeId; label: string }> = [
    { id: 'prompt', label: 'User Prompt' },
    { id: 'planner', label: 'Planner Agent' },
    { id: 'knowledge', label: 'Knowledge Agent' },
    { id: 'analyzer', label: 'Analyzer Agent' },
    { id: 'approval', label: 'Approval Gate' },
    { id: 'infra', label: 'Infra Agent' },
    { id: 'logs', label: 'Log Agent' },
    { id: 'pipeline', label: 'Pipeline Agent' },
    { id: 'reviewer', label: 'Reviewer Agent' },
    { id: 'audit', label: 'Dynamo Audit' },
  ];

  const activeNode = activeByStage[stage];
  const completedNodes = new Set(completeByStage[stage] || []);
  const skippedNodes = new Set(skippedByStage[stage] || []);

  return labels.map((node) => ({
    ...node,
    state: skippedNodes.has(node.id)
      ? 'skipped'
      : completedNodes.has(node.id)
        ? 'complete'
        : activeNode === node.id
          ? 'active'
          : 'pending',
  }));
}

function buildAnalysisSummary(prompt: string): string {
  return `Planner classified the request as an operational health check. Analyzer prepared a triage path for infra, logs, and pipeline review based on: "${prompt.trim()}".`;
}

function buildMockScenario(prompt: string): MockScenario {
  const normalized = prompt.toLowerCase();

  const environment = normalized.includes('prod') || normalized.includes('production')
    ? 'production'
    : normalized.includes('uat')
      ? 'uat'
      : normalized.includes('dev')
        ? 'development'
        : 'production';

  if (normalized.includes('pipeline') || normalized.includes('ingestion') || normalized.includes('batch')) {
    return {
      service: 'Data pipeline orchestration',
      environment,
      severity: normalized.includes('stuck') || normalized.includes('failed') ? 'P1' : 'P2',
      symptom: 'Delayed or stalled pipeline execution',
      likelyOwner: 'Pipeline operations',
      suspiciousSignals: [
        'Scheduler heartbeat lag increased from 30s to 180s.',
        'Latest pipeline run is blocked at dependency resolution.',
        'Retry count spiked on the downstream ingestion worker.',
      ],
      checks: [
        'Validate scheduler health and worker queue depth.',
        'Inspect dependency lock and most recent failed step output.',
        'Confirm whether downstream consumers are applying backpressure.',
      ],
      remediationHints: [
        'Clear the blocked dependency token after verifying the prior batch state.',
        'Restart the affected worker pool if queue depth remains elevated.',
        'Trigger a controlled replay only after L1 confirms no duplicate risk.',
      ],
    };
  }

  if (normalized.includes('db') || normalized.includes('database') || normalized.includes('postgres') || normalized.includes('snowflake')) {
    return {
      service: 'Database connectivity and query path',
      environment,
      severity: normalized.includes('timeout') || normalized.includes('down') ? 'P1' : 'P2',
      symptom: 'Connection saturation or slow query response',
      likelyOwner: 'Database operations',
      suspiciousSignals: [
        'Connection pool utilization is trending above 85%.',
        'Two long-running queries are holding locks beyond the baseline window.',
        'Recent failover or warehouse resize event is visible in telemetry.',
      ],
      checks: [
        'Review active sessions and lock contention.',
        'Compare current query latency against the 24h baseline.',
        'Verify whether a maintenance window or failover event is still active.',
      ],
      remediationHints: [
        'Release non-critical long-running sessions before scaling the pool.',
        'Throttle noisy consumers until latency returns to baseline.',
        'Coordinate with L1 before forcing query cancellation or failover.',
      ],
    };
  }

  if (normalized.includes('login') || normalized.includes('auth') || normalized.includes('access')) {
    return {
      service: 'Authentication and access gateway',
      environment,
      severity: 'P2',
      symptom: 'User authentication degradation',
      likelyOwner: 'Identity platform',
      suspiciousSignals: [
        'Token issuance latency is above the normal threshold.',
        'An upstream identity dependency is returning intermittent 5xx responses.',
        'Session refresh failures increased in the last 15 minutes.',
      ],
      checks: [
        'Validate identity provider reachability and cert freshness.',
        'Inspect recent auth gateway error rates.',
        'Check whether session refresh traffic is concentrated on one node.',
      ],
      remediationHints: [
        'Recycle the unhealthy auth node if traffic imbalance persists.',
        'Temporarily route traffic to the standby identity pool if available.',
        'Ask L1 to confirm whether the issue is user-specific or system-wide.',
      ],
    };
  }

  return {
    service: 'Application and infrastructure health',
    environment,
    severity: normalized.includes('critical') || normalized.includes('down') ? 'P1' : 'P2',
    symptom: 'General service degradation',
    likelyOwner: 'Platform operations',
    suspiciousSignals: [
      'CPU saturation rose sharply on one application node.',
      'Error volume increased across infra and service logs.',
      'Recent deployment drift is visible between active nodes.',
    ],
    checks: [
      'Compare host health, deployment version, and process heartbeat.',
      'Review correlated infra and application errors in the incident window.',
      'Verify whether any downstream dependency is also degraded.',
    ],
    remediationHints: [
      'Drain and recycle the unhealthy node if the version drift is confirmed.',
      'Rollback the latest config change if error correlation matches deployment time.',
      'Confirm impact radius with L1 before broad restart actions.',
    ],
  };
}

function appendMessages(messages: WorkflowMessage[], entries: Array<{ role: WorkflowMessage['role']; content: string }>): WorkflowMessage[] {
  return entries.reduce((next, entry) => appendMessage(next, entry.role, entry.content), messages);
}

function buildAuditPlaceholder(state: WorkflowState, mode: 'placeholder' | 'active'): AuditPlaceholder {
  return {
    destination: 'dynamodb',
    mode,
    actionCount: state.recommendedActions.length,
    lastPreparedAt: state.persistedAt,
  };
}

function extractRecommendedActions(source: string): string[] {
  return source
    .split(/\n|\.|;/)
    .map((entry) => entry.replace(/^[-*\s]+/, '').trim())
    .filter((entry) => entry.length > 0)
    .slice(0, 6);
}

function buildInitialState(prompt: string): WorkflowState {
  const scenario = buildMockScenario(prompt);
  const analysisSummary = buildAnalysisSummary(prompt);
  const recommendedActions = [
    ...scenario.checks,
    `Route follow-up to ${scenario.likelyOwner} after L1 validation if the issue persists.`,
  ];

  let messages: WorkflowMessage[] = [];
  messages = appendMessage(messages, 'user', prompt);
  messages = appendMessages(messages, [
    {
      role: 'agent',
      content: `Planner Agent\nSeverity: ${scenario.severity}\nService: ${scenario.service}\nEnvironment: ${scenario.environment}\nSymptom: ${scenario.symptom}`,
    },
    {
      role: 'agent',
      content: `Knowledge Agent\nMatched mock runbook: ${scenario.service}. Likely owner is ${scenario.likelyOwner}. The request will branch through infra, logs, and pipeline validation before review.`,
    },
    {
      role: 'agent',
      content: `Analyzer Agent\n${analysisSummary}\n\nMock observations\n- ${scenario.suspiciousSignals.join('\n- ')}`,
    },
    {
      role: 'agent',
      content: `Prepared checks\n1. ${recommendedActions[0]}\n2. ${recommendedActions[1]}\n3. ${recommendedActions[2]}`,
    },
    {
      role: 'agent',
      content: 'Approval required: proceed with infra, log, and pipeline checks?',
    },
  ]);

  return {
    stage: 'approval',
    prompt,
    messages,
    auditEvents: [
      {
        id: createId('audit'),
        at: new Date().toISOString(),
        type: 'workflow_started',
        actor: 'user',
        summary: 'Health check workflow started.',
        details: prompt,
      },
      {
        id: createId('audit'),
        at: new Date().toISOString(),
        type: 'analysis_completed',
        actor: 'system',
        summary: 'Planner and analyzer completed initial triage.',
        details: analysisSummary,
      },
    ],
    workflowNodes: workflowNodesForStage('approval'),
    approvalPrompt: {
      question: 'Proceed with automated health checks?',
      description: 'The workflow will continue through infra, log, and pipeline analysis before asking for L1 validation.',
      options: [
        { label: 'Yes', value: 'yes', variant: 'contained' },
        { label: 'No', value: 'no', variant: 'outlined' },
      ],
    },
    analysisSummary,
    recommendedActions,
  };
}

function applyApproval(state: WorkflowState, approval: 'yes' | 'no'): WorkflowState {
  const approved = approval === 'yes';
  const nextStage: WorkflowStage = approved ? 'l1-feedback' : 'cancelled';
  const scenario = buildMockScenario(state.prompt);
  const approvalText = approved
    ? 'Approval granted. Running the mocked infra, log, and pipeline checks now.'
    : 'Approval declined. Workflow paused before running the mocked checks.';

  const extraActions = approved
    ? scenario.remediationHints
    : [];

  const nextMessages = approved
    ? appendMessages(appendMessage(state.messages, 'system', approvalText), [
        {
          role: 'agent',
          content: `Infra Agent\nMock result: host health is degraded in ${scenario.environment}. One node is showing elevated resource usage, but the service is still responding.`,
        },
        {
          role: 'agent',
          content: `Log Agent\nMock result: correlated errors were found around the incident window. Top signals\n- ${scenario.suspiciousSignals.slice(0, 2).join('\n- ')}`,
        },
        {
          role: 'agent',
          content: `Pipeline Agent\nMock result: downstream processing is partially blocked. Recommended next actions\n1. ${scenario.remediationHints[0]}\n2. ${scenario.remediationHints[1]}`,
        },
        {
          role: 'agent',
          content: 'Mock triage complete. Please provide L1 feedback or the actions your team wants recorded next.',
        },
      ])
    : appendMessages(appendMessage(state.messages, 'system', approvalText), [
        {
          role: 'agent',
          content: 'No checks were executed. You can revise the incident context and send again whenever you want to restart the conversation.',
        },
      ]);

  return {
    ...state,
    stage: nextStage,
    messages: nextMessages,
    auditEvents: [
      ...state.auditEvents,
      {
        id: createId('audit'),
        at: new Date().toISOString(),
        type: 'approval_recorded',
        actor: 'user',
        summary: approved ? 'User approved workflow continuation.' : 'User rejected workflow continuation.',
        details: approvalText,
      },
    ],
    workflowNodes: workflowNodesForStage(nextStage),
    approvalPrompt: undefined,
    recommendedActions: approved ? [...state.recommendedActions, ...extraActions] : state.recommendedActions,
  };
}

function applyL1Feedback(state: WorkflowState, feedback: string): WorkflowState {
  const extracted = extractRecommendedActions(feedback);
  const scenario = buildMockScenario(state.prompt);
  const reviewSummary = extracted.length > 0
    ? `Reviewer captured ${extracted.length} recommended action${extracted.length === 1 ? '' : 's'} from L1 and prepared them for audit storage.`
    : 'Reviewer captured L1 validation and prepared the workflow summary for audit storage.';

  let messages = appendMessage(state.messages, 'l1', feedback);
  messages = appendMessages(messages, [
    {
      role: 'agent',
      content: `Reviewer Agent\nMock disposition: ${scenario.service} remains under observation in ${scenario.environment}. Follow-up will remain with ${scenario.likelyOwner} until the recorded actions are complete.`,
    },
    {
      role: 'agent',
      content: reviewSummary,
    },
  ]);

  return {
    ...state,
    stage: 'completed',
    l1Feedback: feedback,
    messages,
    auditEvents: [
      ...state.auditEvents,
      {
        id: createId('audit'),
        at: new Date().toISOString(),
        type: 'l1_feedback_recorded',
        actor: 'l1',
        summary: 'L1 feedback received.',
        details: feedback,
      },
      {
        id: createId('audit'),
        at: new Date().toISOString(),
        type: 'review_completed',
        actor: 'system',
        summary: 'Reviewer completed the health check workflow.',
        details: reviewSummary,
      },
    ],
    workflowNodes: workflowNodesForStage('completed'),
    recommendedActions: extracted.length > 0 ? extracted : state.recommendedActions,
  };
}

async function loadAuditRecord(sessionId: string): Promise<StoredAuditRecord | null> {
  try {
    const result = await getClient().send(new GetCommand({
      TableName: TABLE,
      Key: {
        session_id: sessionId,
        agent_id: AUDIT_AGENT_ID,
      },
    }));

    const item = (result.Item as StoredAuditRecord | undefined) ?? null;
    if (item) {
      mockAuditStore.set(sessionId, item);
    }
    return item;
  } catch (error) {
    if (!isCredentialProviderError(error)) {
      throw error;
    }

    return mockAuditStore.get(sessionId) ?? null;
  }
}

async function persistAuditRecord(
  sessionId: string,
  browserSessionId: string | undefined,
  userId: string | undefined,
  state: WorkflowState,
): Promise<{ persisted: boolean; persistedAt: string; error?: string }> {
  const persistedAt = new Date().toISOString();
  const item = buildStoredAuditRecord(sessionId, browserSessionId, userId, state, persistedAt);
  mockAuditStore.set(sessionId, item);

  try {
    await getClient().send(new PutCommand({
      TableName: TABLE,
      Item: item,
    }));
    return { persisted: true, persistedAt };
  } catch (error) {
    if (isCredentialProviderError(error)) {
      return { persisted: false, persistedAt };
    }

    return {
      persisted: false,
      persistedAt,
      error: error instanceof Error ? error.message : 'Failed to persist audit record',
    };
  }
}

async function persistHealthCheckActionAuditRecord(
  sessionId: string,
  browserSessionId: string | undefined,
  userId: string | undefined,
  actionClicked: string,
  actionFor: string | undefined,
  actionSource: 'button' | 'manual',
  clickedAt: string,
): Promise<{ persisted: boolean; persistedAt: string; record: HealthCheckActionAuditRecord; error?: string }> {
  const persistedAt = clickedAt;
  const item = buildHealthCheckActionAuditRecord(
    sessionId,
    browserSessionId,
    userId,
    actionClicked,
    actionFor,
    actionSource,
    clickedAt,
  );
  mockActionAuditStore.set(item.audit_id, item);

  try {
    await getClient().send(new PutCommand({
      TableName: ACTION_AUDIT_TABLE,
      Item: item,
    }));
    return { persisted: true, persistedAt, record: item };
  } catch (error) {
    if (isCredentialProviderError(error)) {
      return { persisted: false, persistedAt, record: item };
    }

    return {
      persisted: false,
      persistedAt,
      record: item,
      error: error instanceof Error ? error.message : 'Failed to persist health check action audit record',
    };
  }
}

router.get('/workflow/:sessionId', async (req: Request, res: Response) => {
  const { sessionId } = req.params;

  try {
    const record = await loadAuditRecord(sessionId);
    const state = record?.workflow_state ?? null;
    res.json({
      ok: true,
      state,
      persisted: !!record,
      table: TABLE,
      auditPlaceholder: state ? buildAuditPlaceholder(state, 'placeholder') : undefined,
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : 'Failed to load health check workflow',
      state: null,
    });
  }
});

router.post('/workflow', async (req: Request, res: Response) => {
  const sessionId = typeof req.body?.sessionId === 'string' ? req.body.sessionId.trim() : '';
  const browserSessionId = typeof req.body?.browserSessionId === 'string' ? req.body.browserSessionId : undefined;
  const userId = getEffectiveUserId(req.body?.userId);
  const action = typeof req.body?.action === 'string' ? req.body.action : '';

  if (!sessionId) {
    res.status(400).json({ ok: false, error: 'sessionId is required' });
    return;
  }

  try {
    const existing = await loadAuditRecord(sessionId);
    const existingState = existing?.workflow_state;
    let nextState: WorkflowState;

    if (action === 'start' || action === 'restart') {
      const prompt = typeof req.body?.prompt === 'string' ? req.body.prompt.trim() : '';
      if (!prompt) {
        res.status(400).json({ ok: false, error: 'prompt is required for start' });
        return;
      }
      nextState = buildInitialState(prompt);
    } else if (action === 'approval') {
      if (!existingState) {
        res.status(400).json({ ok: false, error: 'No active workflow found for approval' });
        return;
      }
      const approval = req.body?.approval === 'yes' ? 'yes' : req.body?.approval === 'no' ? 'no' : null;
      if (!approval) {
        res.status(400).json({ ok: false, error: 'approval must be yes or no' });
        return;
      }
      nextState = applyApproval(existingState, approval);
    } else if (action === 'l1_feedback') {
      if (!existingState) {
        res.status(400).json({ ok: false, error: 'No active workflow found for feedback' });
        return;
      }
      const feedback = typeof req.body?.feedback === 'string' ? req.body.feedback.trim() : '';
      if (!feedback) {
        res.status(400).json({ ok: false, error: 'feedback is required' });
        return;
      }
      nextState = applyL1Feedback(existingState, feedback);
    } else {
      res.status(400).json({ ok: false, error: 'Unsupported action' });
      return;
    }

    const persistResult = await persistAuditRecord(sessionId, browserSessionId, userId, nextState);
    res.json({
      ok: true,
      state: {
        ...nextState,
        persistedAt: persistResult.persistedAt,
      },
      persisted: persistResult.persisted,
      table: TABLE,
      auditPlaceholder: buildAuditPlaceholder({ ...nextState, persistedAt: persistResult.persistedAt }, persistResult.persisted ? 'active' : 'placeholder'),
      ...(persistResult.error ? { persistenceError: persistResult.error } : {}),
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : 'Failed to advance health check workflow',
    });
  }
});

router.post('/action-audit', async (req: Request, res: Response) => {
  const sessionId = typeof req.body?.sessionId === 'string' ? req.body.sessionId.trim() : '';
  const browserSessionId = typeof req.body?.browserSessionId === 'string' ? req.body.browserSessionId.trim() : undefined;
  const userId = getEffectiveUserId(req.body?.userId);
  const actionClicked = typeof req.body?.actionClicked === 'string' ? req.body.actionClicked.trim() : '';
  const actionFor = typeof req.body?.actionFor === 'string' ? req.body.actionFor.trim() : undefined;
  const actionSource = req.body?.actionSource === 'button' ? 'button' : 'manual';
  const clickedAt = typeof req.body?.clickedAt === 'string' && req.body.clickedAt.trim().length > 0
    ? req.body.clickedAt
    : new Date().toISOString();

  if (!sessionId || !actionClicked) {
    res.status(400).json({ ok: false, error: 'sessionId and actionClicked are required' });
    return;
  }

  try {
    const persistResult = await persistHealthCheckActionAuditRecord(
      sessionId,
      browserSessionId,
      userId,
      actionClicked,
      actionFor,
      actionSource,
      clickedAt,
    );

    res.json({
      ok: true,
      persisted: persistResult.persisted,
      table: ACTION_AUDIT_TABLE,
      record: persistResult.record,
      ...(persistResult.error ? { error: persistResult.error } : {}),
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : 'Failed to write health check action audit record',
    });
  }
});

export default router;