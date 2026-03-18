// ============================================================
// MOCK DATA — Replace each section with real adapter calls
// when connecting to ServiceNow, Snowflake, PostgreSQL, CloudWatch
// ============================================================

// ─── SNOWFLAKE — Aggregated KPIs & Cost ───────────────────
export const mockKPIs = {
  successRate: { value: 98.2, unit: '%', trend: '+1.2%', sparkline: [94, 95, 97, 96, 98, 97, 98.2] },
  slaBreaches: { value: 5, unit: '', trend: '-2 vs last week', sparkline: [9, 8, 7, 6, 7, 6, 5] },
  mttr: { value: 1.4, unit: 'hrs', trend: '-0.3hrs', sparkline: [2.1, 1.9, 1.8, 1.6, 1.5, 1.4, 1.4] },
  autoResolved: { value: 75, unit: '%', trend: '+5%', sparkline: [60, 63, 67, 70, 72, 74, 75] },
  costVsBudget: { value: 110, unit: '%', trend: '+10%', sparkline: [95, 98, 100, 103, 107, 109, 110] },
}

export const mockCostBreakdown = {
  total: 284000,
  budget: 258000,
  overage: 26000,
  byService: [
    { service: 'Snowflake Compute', cost: 92000, budget: 80000, change: '+15%' },
    { service: 'PostgreSQL RDS', cost: 48000, budget: 50000, change: '-4%' },
    { service: 'CloudWatch Logs', cost: 31000, budget: 28000, change: '+11%' },
    { service: 'Data Transfer', cost: 29000, budget: 30000, change: '-3%' },
    { service: 'S3 Storage', cost: 22000, budget: 20000, change: '+10%' },
    { service: 'Lambda Compute', cost: 18000, budget: 25000, change: '-28%' },
    { service: 'Other', cost: 44000, budget: 25000, change: '+76%' },
  ],
  history: [
    { month: 'Sep', actual: 241000, budget: 258000 },
    { month: 'Oct', actual: 255000, budget: 258000 },
    { month: 'Nov', actual: 261000, budget: 258000 },
    { month: 'Dec', actual: 248000, budget: 258000 },
    { month: 'Jan', actual: 271000, budget: 258000 },
    { month: 'Feb', actual: 278000, budget: 258000 },
    { month: 'Mar', actual: 284000, budget: 258000 },
  ]
}

// ─── POSTGRESQL — Pipelines ────────────────────────────────
export const mockPipelines = [
  {
    id: 'pl-001',
    name: 'Finance D+1 ETL',
    status: 'at_risk',
    successRate: 72,
    lastRun: '2026-03-17T06:30:00Z',
    avgDuration: '42 min',
    owner: 'Data Engineering',
    schedule: 'Daily 6AM',
    runs: [
      { runId: 'run-0091', status: 'failed', start: '2026-03-17T06:30:00Z', duration: '38 min', records: 0, error: 'Upstream Talend retry storm — source feed timeout after 30s' },
      { runId: 'run-0090', status: 'success', start: '2026-03-16T06:31:00Z', duration: '41 min', records: 1240000 },
      { runId: 'run-0089', status: 'success', start: '2026-03-15T06:29:00Z', duration: '39 min', records: 1198000 },
      { runId: 'run-0088', status: 'failed', start: '2026-03-14T06:30:00Z', duration: '12 min', records: 0, error: 'Schema validation error: unexpected null in column amount_usd' },
      { runId: 'run-0087', status: 'success', start: '2026-03-13T06:28:00Z', duration: '44 min', records: 1321000 },
    ]
  },
  {
    id: 'pl-002',
    name: 'Customer 360 Sync',
    status: 'healthy',
    successRate: 99,
    lastRun: '2026-03-17T07:00:00Z',
    avgDuration: '18 min',
    owner: 'CRM Team',
    schedule: 'Every 1hr',
    runs: [
      { runId: 'run-2201', status: 'success', start: '2026-03-17T07:00:00Z', duration: '17 min', records: 89000 },
      { runId: 'run-2200', status: 'success', start: '2026-03-17T06:00:00Z', duration: '19 min', records: 91000 },
      { runId: 'run-2199', status: 'success', start: '2026-03-17T05:00:00Z', duration: '18 min', records: 88500 },
    ]
  },
  {
    id: 'pl-003',
    name: 'Inventory Refresh',
    status: 'critical',
    successRate: 45,
    lastRun: '2026-03-17T03:00:00Z',
    avgDuration: '67 min',
    owner: 'Supply Chain',
    schedule: 'Every 6hrs',
    runs: [
      { runId: 'run-0441', status: 'failed', start: '2026-03-17T03:00:00Z', duration: '2 min', records: 0, error: 'Connection refused: PostgreSQL host inventory-db-03 unreachable' },
      { runId: 'run-0440', status: 'failed', start: '2026-03-16T21:00:00Z', duration: '2 min', records: 0, error: 'Connection refused: PostgreSQL host inventory-db-03 unreachable' },
      { runId: 'run-0439', status: 'success', start: '2026-03-16T15:00:00Z', duration: '71 min', records: 540000 },
    ]
  },
  {
    id: 'pl-004',
    name: 'Sales Feed Aggregation',
    status: 'healthy',
    successRate: 97,
    lastRun: '2026-03-17T08:00:00Z',
    avgDuration: '12 min',
    owner: 'Sales Analytics',
    schedule: 'Every 2hrs',
    runs: [
      { runId: 'run-1121', status: 'success', start: '2026-03-17T08:00:00Z', duration: '11 min', records: 34000 },
      { runId: 'run-1120', status: 'success', start: '2026-03-17T06:00:00Z', duration: '13 min', records: 38000 },
    ]
  },
  {
    id: 'pl-005',
    name: 'HR Data Warehouse Load',
    status: 'at_risk',
    successRate: 81,
    lastRun: '2026-03-17T05:00:00Z',
    avgDuration: '28 min',
    owner: 'HR Analytics',
    schedule: 'Daily 5AM',
    runs: [
      { runId: 'run-0771', status: 'success', start: '2026-03-17T05:00:00Z', duration: '35 min', records: 18000 },
      { runId: 'run-0770', status: 'failed', start: '2026-03-16T05:01:00Z', duration: '4 min', records: 0, error: 'Memory limit exceeded: job allocated 4GB but required 6.2GB' },
    ]
  },
]

// ─── CLOUDWATCH — Errors & Logs ────────────────────────────
export const mockErrors = [
  {
    id: 'err-7821',
    severity: 'critical',
    service: 'inventory-db-03',
    message: 'Connection refused on port 5432',
    count: 47,
    firstSeen: '2026-03-16T21:02:00Z',
    lastSeen: '2026-03-17T08:14:00Z',
    affectedPipelines: ['Inventory Refresh'],
    stackTrace: `ERROR: Connection refused\n  at TCPConnectWrap.afterConnect [as oncomplete] (net.js:1141:16)\n  Host: inventory-db-03.internal\n  Port: 5432\n  Timeout: 30000ms`,
    resolution: 'Check PostgreSQL service on inventory-db-03, verify security groups, and confirm the host is reachable from the ETL cluster.',
  },
  {
    id: 'err-7819',
    severity: 'high',
    service: 'talend-job-runner',
    message: 'Source feed timeout: Finance upstream retry storm',
    count: 12,
    firstSeen: '2026-03-17T06:30:00Z',
    lastSeen: '2026-03-17T06:48:00Z',
    affectedPipelines: ['Finance D+1 ETL'],
    stackTrace: `ERROR: Read timeout after 30000ms\n  at FinanceSourceConnector.fetch(FinanceSourceConnector.java:142)\n  Caused by: java.net.SocketTimeoutException: Read timed out`,
    resolution: 'Increase source read timeout to 90s, check upstream Finance system load, and enable circuit breaker on retry policy.',
  },
  {
    id: 'err-7815',
    severity: 'high',
    service: 'snowflake-loader',
    message: 'Schema validation error: unexpected null in amount_usd',
    count: 3,
    firstSeen: '2026-03-14T06:30:00Z',
    lastSeen: '2026-03-14T06:42:00Z',
    affectedPipelines: ['Finance D+1 ETL'],
    stackTrace: `ValidationError: Column 'amount_usd' received null but NOT NULL constraint is defined\n  at SchemaValidator.validate(SchemaValidator.ts:88)\n  Row index: 14421, Source: finance_transactions_20260314`,
    resolution: 'Add null-handling transform step before Snowflake load. Coordinate with upstream Finance team on data quality SLA.',
  },
  {
    id: 'err-7810',
    severity: 'medium',
    service: 'hr-etl-worker',
    message: 'Memory limit exceeded: required 6.2GB, allocated 4GB',
    count: 2,
    firstSeen: '2026-03-16T05:01:00Z',
    lastSeen: '2026-03-16T05:05:00Z',
    affectedPipelines: ['HR Data Warehouse Load'],
    stackTrace: `FATAL: Container killed due to memory limit\n  Allocated: 4096MB\n  Peak usage: 6349MB\n  Job: hr-warehouse-load-20260316`,
    resolution: 'Scale up the HR ETL worker to 8GB RAM. Review data volume growth trend — consider chunked loading for large HR payroll datasets.',
  },
  {
    id: 'err-7801',
    severity: 'low',
    service: 'cloudwatch-agent',
    message: 'Log delivery delayed: agent buffer overflow',
    count: 8,
    firstSeen: '2026-03-17T04:00:00Z',
    lastSeen: '2026-03-17T04:22:00Z',
    affectedPipelines: [],
    stackTrace: `WARN: Buffer overflow detected — 1240 log lines dropped\n  Agent: cloudwatch-agent v1.247349.0\n  Buffer limit: 256KB`,
    resolution: 'Increase CloudWatch agent buffer to 512KB and enable async log delivery.',
  },
]

export const mockLogs = [
  { id: 'log-001', ts: '2026-03-17T08:15:34Z', level: 'ERROR', service: 'inventory-db-03', message: 'Connection refused on port 5432', pipeline: 'Inventory Refresh' },
  { id: 'log-002', ts: '2026-03-17T08:13:21Z', level: 'WARN', service: 'snowflake-loader', message: 'Retry attempt 3/5 for batch ID sf-batch-9921', pipeline: 'Finance D+1 ETL' },
  { id: 'log-003', ts: '2026-03-17T08:12:00Z', level: 'INFO', service: 'customer-360-sync', message: 'Batch completed: 89,421 records upserted in 17.2s', pipeline: 'Customer 360 Sync' },
  { id: 'log-004', ts: '2026-03-17T08:10:45Z', level: 'ERROR', service: 'inventory-db-03', message: 'FATAL: max_connections (200) exceeded, rejecting new connections', pipeline: 'Inventory Refresh' },
  { id: 'log-005', ts: '2026-03-17T08:09:18Z', level: 'INFO', service: 'sales-feed-agg', message: 'Pipeline run-1121 started: Sales Feed Aggregation', pipeline: 'Sales Feed Aggregation' },
  { id: 'log-006', ts: '2026-03-17T08:07:02Z', level: 'WARN', service: 'hr-etl-worker', message: 'Memory usage at 87% — approaching container limit', pipeline: 'HR Data Warehouse Load' },
  { id: 'log-007', ts: '2026-03-17T08:05:55Z', level: 'INFO', service: 'snowflake-loader', message: 'Micro-batch commit: 12,000 rows → FINANCE.TRANSACTIONS_STAGING', pipeline: 'Finance D+1 ETL' },
  { id: 'log-008', ts: '2026-03-17T08:04:30Z', level: 'ERROR', service: 'talend-job-runner', message: 'Read timeout after 30000ms from Finance upstream source', pipeline: 'Finance D+1 ETL' },
  { id: 'log-009', ts: '2026-03-17T08:02:10Z', level: 'INFO', service: 'cloudwatch-agent', message: 'Health check passed: all 12 monitored endpoints responding', pipeline: null },
  { id: 'log-010', ts: '2026-03-17T08:01:00Z', level: 'INFO', service: 'customer-360-sync', message: 'Incremental sync: 1,241 changed records detected since last run', pipeline: 'Customer 360 Sync' },
  { id: 'log-011', ts: '2026-03-17T07:59:44Z', level: 'WARN', service: 'inventory-db-03', message: 'Slow query detected: 12.4s for inventory_snapshot_v2 (threshold: 5s)', pipeline: 'Inventory Refresh' },
  { id: 'log-012', ts: '2026-03-17T07:58:22Z', level: 'INFO', service: 'sales-feed-agg', message: 'Schema drift check passed — no changes detected', pipeline: 'Sales Feed Aggregation' },
]

// ─── SERVICENOW — Support Tickets ──────────────────────────
export const mockTickets = [
  {
    id: 'INC0021891',
    title: 'Finance D+1 pipeline failing — data not available for morning reports',
    priority: 'P1',
    status: 'in_progress',
    assignee: 'Priya Nair',
    team: 'Data Engineering',
    createdAt: '2026-03-17T06:45:00Z',
    updatedAt: '2026-03-17T08:10:00Z',
    sla: { target: '4hrs', remaining: '2hr 35min', breached: false },
    affectedService: 'Finance D+1 ETL',
    description: 'Finance team reports that the D+1 feed has not landed as of 08:00 AM. Morning risk reports cannot be generated. Downstream impact: 14 analysts blocked.',
    comments: [
      { author: 'Priya Nair', time: '2026-03-17T07:10:00Z', text: 'Identified root cause: Talend retry storm due to upstream Finance system slowdown. Increasing timeout to 90s.' },
      { author: 'Rohan Mehta', time: '2026-03-17T07:45:00Z', text: 'Upstream Finance team notified. ETA for resolution: 09:30 AM.' },
      { author: 'System', time: '2026-03-17T08:10:00Z', text: 'Auto-retry triggered. Monitoring for success.' },
    ]
  },
  {
    id: 'INC0021885',
    title: 'Inventory Refresh pipeline down — PostgreSQL host unreachable',
    priority: 'P1',
    status: 'open',
    assignee: 'Unassigned',
    team: 'Platform Ops',
    createdAt: '2026-03-16T21:10:00Z',
    updatedAt: '2026-03-17T08:00:00Z',
    sla: { target: '4hrs', remaining: '0hr', breached: true },
    affectedService: 'Inventory Refresh',
    description: 'inventory-db-03 host is not responding on port 5432. Pipeline has failed 2 consecutive times. Supply chain team cannot process stock level updates.',
    comments: [
      { author: 'System', time: '2026-03-16T21:15:00Z', text: 'Auto-escalated to P1 after 2 consecutive failures.' },
      { author: 'On-call Bot', time: '2026-03-16T21:16:00Z', text: 'PagerDuty alert sent to platform-ops-oncall.' },
    ]
  },
  {
    id: 'INC0021872',
    title: 'HR ETL memory crash — payroll data missing from Snowflake',
    priority: 'P2',
    status: 'resolved',
    assignee: 'Sanjay Iyer',
    team: 'Data Engineering',
    createdAt: '2026-03-16T05:15:00Z',
    updatedAt: '2026-03-16T09:30:00Z',
    sla: { target: '8hrs', remaining: 'Resolved in 4hr 15min', breached: false },
    affectedService: 'HR Data Warehouse Load',
    description: 'HR ETL container killed due to memory limit. Payroll data for 16-Mar missing from Snowflake warehouse.',
    comments: [
      { author: 'Sanjay Iyer', time: '2026-03-16T06:00:00Z', text: 'Increased worker memory to 8GB. Re-running pipeline manually.' },
      { author: 'Sanjay Iyer', time: '2026-03-16T09:30:00Z', text: 'Pipeline re-run successful. 18,421 HR records loaded. Closing ticket.' },
    ]
  },
  {
    id: 'INC0021860',
    title: 'CloudWatch agent dropping logs — buffer overflow',
    priority: 'P3',
    status: 'resolved',
    assignee: 'Dev Kapoor',
    team: 'Platform Ops',
    createdAt: '2026-03-17T04:05:00Z',
    updatedAt: '2026-03-17T05:00:00Z',
    sla: { target: '24hrs', remaining: 'Resolved in 55min', breached: false },
    affectedService: 'CloudWatch',
    description: '1240 log lines dropped due to buffer overflow in CloudWatch agent.',
    comments: [
      { author: 'Dev Kapoor', time: '2026-03-17T04:30:00Z', text: 'Increased agent buffer to 512KB and enabled async delivery. Monitoring.' },
    ]
  },
  {
    id: 'INC0021848',
    title: '[Request] Increase Snowflake warehouse size for Q1 close',
    priority: 'P3',
    status: 'open',
    assignee: 'Priya Nair',
    team: 'Data Engineering',
    createdAt: '2026-03-16T14:00:00Z',
    updatedAt: '2026-03-16T14:00:00Z',
    sla: { target: '72hrs', remaining: '53hrs', breached: false },
    affectedService: 'Snowflake',
    description: 'Finance team requests temporary Snowflake warehouse upgrade from LARGE to X-LARGE for Q1 close period (Mar 28 – Apr 4). Expected 3x query volume.',
    comments: []
  },
]

// ─── DMF PIPELINE ──────────────────────────────────────────
export const mockDMFSummary = {
  totalRuns:      { value: 1245, trend: '+8%',   label: 'Last 7 Days' },
  failedRuns:     { value: 68,   trend: '-5%',   label: '+0 this week' },
  runsInProgress: { value: 74,   trend: '+3%',   label: '+0 this week' },
  successRate:    { value: 94.5, trend: '+0.5%', label: '+0.5% week' },
}

export const mockDMFStages = [
  { stage: 'Ingestion',    success: 920, inProgress: 48,  failed: 32, rate: 92 },
  { stage: 'Enrichment',   success: 870, inProgress: 80,  failed: 50, rate: 87 },
  { stage: 'Distribution', success: 880, inProgress: 80,  failed: 40, rate: 88 },
  { stage: 'Integration',  success: 800, inProgress: 120, failed: 80, rate: 80 },
]

export const mockDMFRunStatus = [
  { name: 'Success',     value: 1177, color: '#2e7d32' },
  { name: 'In Progress', value: 74,   color: '#f57c00' },
  { name: 'Failed',      value: 68,   color: '#d32f2f' },
]

export const mockDMFFailedByStage = [
  { name: 'Ingestion',    value: 32, color: '#1565c0' },
  { name: 'Enrichment',   value: 50, color: '#f57c00' },
  { name: 'Distribution', value: 40, color: '#2e7d32' },
  { name: 'Integration',  value: 80, color: '#7b1fa2' },
]

export const mockDMFRunsOverTime = [
  { date: 'Mar 10', total: 168, failed: 12, successRate: 92.9 },
  { date: 'Mar 11', total: 155, failed: 7,  successRate: 95.5 },
  { date: 'Mar 12', total: 172, failed: 9,  successRate: 94.8 },
  { date: 'Mar 13', total: 180, failed: 11, successRate: 93.9 },
  { date: 'Mar 14', total: 145, failed: 6,  successRate: 95.9 },
  { date: 'Mar 15', total: 134, failed: 8,  successRate: 94.0 },
  { date: 'Mar 16', total: 178, failed: 10, successRate: 94.4 },
  { date: 'Mar 17', total: 113, failed: 5,  successRate: 95.6 },
]

export const mockDMFErrorReasons = [
  { reason: 'Duplicate Key Violation', ingestion: 12, enrichment: 24, distribution: 18, integration: 31 },
  { reason: 'Threshold Exceeded',      ingestion: 8,  enrichment: 15, distribution: 22, integration: 10 },
  { reason: 'Data Type Mismatch',      ingestion: 5,  enrichment: 18, distribution: 8,  integration: 14 },
  { reason: 'Timeout/Error 504',       ingestion: 7,  enrichment: 3,  distribution: 12, integration: 6  },
]

// ─── DMF TRENDS ──────────────────────────────────────────
export const mockDMFStatusTrend = [
  { month: 'Jan', success: 1980, failed: 480, inProgress: 310, partialLoad: 85 },
  { month: 'Feb', success: 2100, failed: 510, inProgress: 290, partialLoad: 72 },
  { month: 'Mar', success: 2280, failed: 550, inProgress: 265, partialLoad: 68 },
]

export const mockDMFRowsTrend = [
  { month: 'Jan', ingestion: 34, enrichment: 22, distribution: 8, integration: 0.4 },
  { month: 'Feb', ingestion: 38, enrichment: 25, distribution: 10, integration: 0.5 },
  { month: 'Mar', ingestion: 42, enrichment: 28, distribution: 14, integration: 0.6 },
]

export const mockDMFJobsTrend = [
  { month: 'Jan', customerLoad: 1580, orderProcessing: 1200, salesData: 820, finance: 420 },
  { month: 'Feb', customerLoad: 1620, orderProcessing: 1250, salesData: 870, finance: 440 },
  { month: 'Mar', customerLoad: 1510, orderProcessing: 1180, salesData: 750, finance: 390 },
]

export const mockDMFStepFailureTrend = [
  { period: 'Feb 2023', count: 2 },
  { period: 'Aug 2023', count: 5 },
  { period: 'Feb 2024', count: 3 },
  { period: 'Aug 2024', count: 4 },
  { period: 'Feb 2025', count: 8 },
  { period: 'Aug 2025', count: 12 },
  { period: 'Feb 2026', count: 6 },
]

// ─── DMF ANALYTICS ───────────────────────────────────────
export const mockDMFAnalytics = {
  statusSummary: [
    { status: 'SUCCESS',      count: 5324 },
    { status: 'FAILED',       count: 1434 },
    { status: 'PARTIAL LOAD', count: 87   },
    { status: 'STARTED',      count: 1    },
  ],
  sourceTypeCounts: [
    { type: 'RELATIONAL',  count: 11763 },
    { type: 'FILE',        count: 10697 },
    { type: 'StoredProc',  count: 1252  },
    { type: 'TABLE',       count: 827   },
    { type: 'NOT DEFINED', count: 594   },
    { type: 'AZURE',       count: 231   },
    { type: 'ENTRY_FILE',  count: 184   },
  ],
  targetTypeCounts: [
    { type: 'RELATIONAL',  count: 7040 },
    { type: 'TABLE',       count: 5312 },
    { type: 'FILE',        count: 2040 },
    { type: 'Snowflake',   count: 596  },
    { type: 'NOT DEFINED', count: 396  },
    { type: 'GOLD',        count: 231  },
    { type: 'ARC_FILE',    count: 105  },
    { type: 'ELASTIC',     count: 89   },
  ],
  stepFailureCounts: [
    { step: 'DBWRITER',    count: 547 },
    { step: 'EXTRACTOR',   count: 400 },
    { step: 'ENRICHMENT',  count: 209 },
    { step: 'UGD',         count: 106 },
    { step: 'DATA',        count: 98  },
    { step: 'DISTRIBUTOR', count: 35  },
    { step: 'SCHEDULER',   count: 28  },
    { step: 'INTEGRATION', count: 25  },
  ],
  failuresBySource: [
    { source: 'ADV_T_CASE',                  count: 64 },
    { source: 'ANALYTICS_PFID_SALES',        count: 44 },
    { source: 'ANA_SILVER_DEPOSIT_ACCT',     count: 30 },
    { source: 'CUSTOMER_QUERY',              count: 22 },
    { source: 'TOL_TRANS_HISTORY',           count: 18 },
    { source: 'REL_OFFICER_RT',              count: 16 },
    { source: 'FIT_SF_CASE_CATEGORY',        count: 14 },
    { source: 'DRM_OFFER_INSTANCE',          count: 14 },
    { source: 'SCH_ALL_REP_DELIST',          count: 13 },
    { source: 'ADR_OFFERS_HISTORY',          count: 13 },
    { source: 'TEST_TBL_RESULT',             count: 12 },
    { source: 'ACC_INCR_SF_ACCOUNT',         count: 12 },
    { source: 'SNC_MARAKOD_OPTS',            count: 11 },
    { source: 'VMC_INTERVALS',               count: 11 },
    { source: 'INDI_PLUNFIT_CARDS_TA_ADD',   count: 10 },
    { source: 'T_AGENT',                     count: 8  },
    { source: 'CUSTOMER_ACCOUNT_CA',         count: 7  },
    { source: 'CUSTOMER_ACCOUNT_D',          count: 6  },
  ],
  datasetsByExecTime: [
    { dataset: 'TX_CVOC_app_offer_Retry',       avgMs: 4500 },
    { dataset: 'FCMS_TRANS_ACQUIRE_S',          avgMs: 3800 },
    { dataset: 'TX_TVOC_ang_ful_Send',          avgMs: 3200 },
    { dataset: 'CUSTOMER_ACCOUNT_PAR',          avgMs: 2900 },
    { dataset: 'ANL_FIN_STATEMENT_HISTORY_S',   avgMs: 2600 },
    { dataset: 'TX_CVOC_Ang_acc_MH',            avgMs: 2400 },
    { dataset: 'ANL_FIN_STATEMENT_UPCLOUD_Q',   avgMs: 2200 },
    { dataset: 'CUSTOMER_ACCOUNT_TRANSACTION',  avgMs: 2000 },
    { dataset: 'FCMS_CUSTOMERS',                avgMs: 1800 },
    { dataset: 'LKGE_E_TRNF_LI_HISTR',         avgMs: 1600 },
    { dataset: 'LMI_S_ACCOUNT',                 avgMs: 1400 },
    { dataset: 'ANL_FNC_STATEMENT_RETURN_2',    avgMs: 1200 },
    { dataset: 'SN_FINANCNALACCOUNTMANCE',      avgMs: 1000 },
    { dataset: 'FNC_ACCT_APILR_DYI_FUNC',       avgMs: 800  },
    { dataset: 'FACT_SF_OPPORTUNITY_TAZ',        avgMs: 600  },
  ],
}

// ─── DMF LINEAGE ─────────────────────────────────────────
export const mockDMFLineageMeta = {
  sourceCodes:  ['DTA','ACO','ADV','AEC','ARF','ATC','ATM','AWS_CONNECT','AWS_CONNECT_CORP','AWS_CONNECT_RT','AWS_CONNECT_RTL'],
  datasetNames: ['ACCT_MSTR_VW','ACCT_MSTR_VW_TRIAL','acct_trial','ACH_IAT_TRAN_ENTRY_CD_ACTRD','ACH_IAT_TRAN_RECV_DFI_INFO','ACO_DCFM_CAMPAIGNBUSINESSFLDS','ACO_DCFM_CAMPAIGNFILTERGROUPS','ACT_TRIAL','ADR_ADR_EMPLOYEE','ADR_EMPLOYEE','ADV_IRM_T_LEAD','ADV_IRM_T_OPPORTUNITY','ADV_T_LEAD','ADV_T_OPPORTUNITY','ADV_T_PWM_TRUIST_BUSINESS_PROCESS_C'],
  sourceNames:  ['ACH_IAT_TRAN_ENTRY_CD_ACTRD','ACH_IAT_TRAN_RECV_DFI_INFO','ACQ_DCFM_CAMPAIGNBUSINESSFLDS','ACQ_DCFM_CAMPAIGNFILTERGROUPS','ADR_EMPLOYEE','ADV_IRM_T_LEAD','ADV_T_ACCOUNT','ADV_T_CONTACT','ADV_T_LEAD','ADV_T_OPPORTUNITY','ADV_T_PWM_CLIENT_DETAILS_C','ADV_T_PWM_TRUIST_BUSINESS_PROCESS_C','ADV_T_SITE_TEAMMATE_CENTER_C'],
  targetNames:  ['DPKE_REWARD_RULE_PROGRESS','S_D_S_Transactions_Monetary_CW_02092026_084190.txt','S_D_S_Transactions_Monetary_CW_02522026_050506.txt','S_D_S_Transactions_Monetary_CW_02082026_096380.txt','S_D_S_Transactions_Monetary_CW_03222026_100486.txt','S_D_S_Transactions_Monetary_CW_02252026_082826.txt'],
}

export const mockDMFLineageJobs = [
  { id:'lj1',  processDate:'1/30/2026', sourceCode:'SPLUNK_LINE', datasetName:'SPLUNK_DIGITAL_OLB_MOBILE',       processTypeCode:'ING', sourceName:'SPLUNK_DIGITAL_OLB_MOBILE',        targetName:'SPLUNK_DIGITAL_OLB_MOBILE',         runStartTime:'1/30/2026 9:51 AM',  runEndTime:'1/30/2026 10:02 AM', status:'success' },
  { id:'lj2',  processDate:'6/5/2026',  sourceCode:'DAILY',       datasetName:'TX_GOLD_DEP_RetailAcctsOpened', processTypeCode:'ENR', sourceName:'EDA_SILVER_DEP_DEP_ACCT_MASTER',   targetName:'PDM_MET_T_DEP_RETAIL_ACCTS_OPENED_F', runStartTime:'5/4/2026 9:03 AM',   runEndTime:'5/4/2026 10:28 AM',  status:'success' },
  { id:'lj3',  processDate:'3/31/2026', sourceCode:'CPE_SCF',     datasetName:'CPE_SCF_DATA',                  processTypeCode:'ING', sourceName:'CPE_SCF_M',                        targetName:'PSS_COURSE_CATALOG',                runStartTime:'3/8/2026 9:28 AM',   runEndTime:'3/8/2026 10:28 AM',  status:'success' },
  { id:'lj4',  processDate:'3/21/2026', sourceCode:'PSS',         datasetName:'PSS_COURSE_CATALOG',            processTypeCode:'ING', sourceName:'PSS_COURSE_CATALOG',               targetName:'PSS_COURSE_CATALOG',                runStartTime:'3/17/2026 10:02 AM', runEndTime:'3/17/2026 6:08 PM',  status:'success' },
  { id:'lj5',  processDate:'3/18/2026', sourceCode:'FCMS',        datasetName:'FCMS_ALERT_DETAILS_FRAUD',      processTypeCode:'ING', sourceName:'FCMS_ALERT_DETAILS_FRAUD',         targetName:'FCMS_ALERT_DETAILS_FRAUD',          runStartTime:'3/17/2026 10:27 AM', runEndTime:'3/17/2026 6:14 PM',  status:'success' },
  { id:'lj6',  processDate:'3/18/2026', sourceCode:'SASVIYA',     datasetName:'TEST_TRANSACTION_SAS_CRU_R',   processTypeCode:'ING', sourceName:'TEST_TRANSACTION_SAS_CRU_RESULT',  targetName:'TEST_TRANSACTION_SAS_CRU_RESULT',   runStartTime:'3/17/2026 10:20 AM', runEndTime:'3/17/2026 5:32 PM',  status:'failed'  },
  { id:'lj7',  processDate:'3/18/2026', sourceCode:'SASVIYA',     datasetName:'TEST_TRANSACTION_SAS_CRU_R',   processTypeCode:'ING', sourceName:'TEST_TRANSACTION_SAS_CRU_RESULT',  targetName:'TEST_TRANSACTION_SAS_CRU_RESULT',   runStartTime:'3/16/2026 3:16 AM',  runEndTime:'3/17/2026 3:32 AM',  status:'success' },
  { id:'lj8',  processDate:'3/18/2026', sourceCode:'GLD',         datasetName:'NCO_SF_LLC_BI_LOAN',            processTypeCode:'ENR', sourceName:'NCO_SF_LLC_BI_LOAN_SOURCE',        targetName:'NCO_SF_LLC_BI_LOAN_TARGET',         runStartTime:'3/16/2026 5:14 PM',  runEndTime:'3/16/2026 5:32 PM',  status:'success' },
  { id:'lj9',  processDate:'3/17/2026', sourceCode:'SASVIYA',     datasetName:'TEST_TRANSACTION_SAS_CRU_R',   processTypeCode:'ING', sourceName:'TEST_TRANSACTION_SAS_CRU_RESULT',  targetName:'TEST_TRANSACTION_SAS_CRU_RESULT',   runStartTime:'3/17/2026 3:33 AM',  runEndTime:'3/17/2026 6:39 AM',  status:'success' },
  { id:'lj10', processDate:'3/17/2026', sourceCode:'DTA',         datasetName:'OLD_ONLINE_BANK_EXTRACT',       processTypeCode:'ING', sourceName:'OLD_ONLINE_BANK_EXTRACT',          targetName:'OLD_ONLINE_BANK_EXTRACT',           runStartTime:'3/17/2026 3:55 AM',  runEndTime:'3/17/2026 4:15 AM',  status:'success' },
  { id:'lj11', processDate:'3/17/2026', sourceCode:'SASVIYA',     datasetName:'TEST_TRANSACTION_SAS_CRU_R',   processTypeCode:'ING', sourceName:'TEST_TRANSACTION_SAS_CRU_RESULT',  targetName:'TEST_TRANSACTION_SAS_CRU_RESULT',   runStartTime:'3/17/2026 4:10 AM',  runEndTime:'3/17/2026 4:25 AM',  status:'failed'  },
  { id:'lj12', processDate:'3/17/2026', sourceCode:'ENC',         datasetName:'ENC_CST_OF_FUND',               processTypeCode:'ING', sourceName:'ENC_CST_OF_FUND',                  targetName:'ENC_CST_OF_FUND',                   runStartTime:'3/17/2026 3:28 AM',  runEndTime:'3/17/2026 3:31 AM',  status:'success' },
  { id:'lj13', processDate:'3/17/2026', sourceCode:'SASVIYA',     datasetName:'TEST_TRANSACTION_SAS_CRU_R',   processTypeCode:'ING', sourceName:'TEST_TRANSACTION_SAS_CRU_RESULT',  targetName:'TEST_TRANSACTION_SAS_CRU_RESULT',   runStartTime:'3/17/2026 4:03 AM',  runEndTime:'3/17/2026 6:04 AM',  status:'success' },
]

export const mockDMFRecentFailures = [
  {
    id: 'fail-001',
    etlProcess: 'CUSTOMER_LOAD_PIPELINE',
    runId: 'RUN12345',
    batchId: 'BATCH20240417_01',
    startTime: '2026-03-17T08:00:00Z',
    endTime: '2026-03-17T08:42:00Z',
    failedStage: 'Integration',
    errorDescription: 'Duplicate key violation in integration stage',
    details: 'Primary key constraint violated on customer_id. 1,247 duplicate records detected in source feed. Add dedup step in pre-load transform before integration stage.',
  },
  {
    id: 'fail-002',
    etlProcess: 'ORDER_PROCESSING_PIPELINE',
    runId: 'RUN12650',
    batchId: '-',
    startTime: '2026-03-17T09:15:00Z',
    endTime: '2026-03-17T09:30:00Z',
    failedStage: 'Ingestion',
    errorDescription: 'Data type mismatch in ingestion stage',
    details: 'Expected INT for order_value column, received VARCHAR. Source schema changed without notification. Coordinate with source team on schema contract enforcement.',
  },
  {
    id: 'fail-003',
    etlProcess: 'SALES_DATA_PIPELINE',
    runId: 'RUN12340',
    batchId: 'BATCH20250418_01',
    startTime: '2026-03-17T09:00:00Z',
    endTime: '2026-03-17T09:18:00Z',
    failedStage: 'Enrichment',
    errorDescription: 'Threshold exceeded for rejected records in enrichment',
    details: 'Rejection threshold of 5% exceeded (actual: 8.2%). Review lookup table freshness and enrichment rule coverage for SALES_DATA_PIPELINE.',
  },
  {
    id: 'fail-004',
    etlProcess: 'FINANCE_PIPELINE',
    runId: 'RUN11890',
    batchId: 'BATCH2023618_01',
    startTime: '2026-03-17T06:30:00Z',
    endTime: '2026-03-17T08:05:00Z',
    failedStage: 'Distribution',
    errorDescription: 'Timeout error during distribution',
    details: 'Target system timed out after 5400s. Distribution job exceeded SLA window due to target DB high load. Scale up target or add retry with backoff.',
  },
]
