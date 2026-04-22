/**
 * DMF mock data — mirrors the API response shapes returned by dmfDb.ts.
 * Keys on rows/jobs trends are aligned with the live endpoint output.
 */

export const MOCK_DMF_SUMMARY = {
  totalRuns:      { value: 1245, trend: '+8%',   label: 'Last 7 Days' },
  failedRuns:     { value: 68,   trend: '-5%',   label: '+0 this week' },
  runsInProgress: { value: 74,   trend: '+3%',   label: '+0 this week' },
  successRate:    { value: 94.5, trend: '+0.5%', label: '+0.5% week'  },
}

export const MOCK_DMF_STAGES = [
  { stage: 'Ingestion',    success: 920, inProgress: 48,  failed: 32, rate: 92 },
  { stage: 'Enrichment',   success: 870, inProgress: 80,  failed: 50, rate: 87 },
  { stage: 'Distribution', success: 880, inProgress: 80,  failed: 40, rate: 88 },
  { stage: 'Integration',  success: 800, inProgress: 120, failed: 80, rate: 80 },
]

export const MOCK_DMF_RUN_STATUS = [
  { name: 'Success',     value: 1177, color: '#2e7d32' },
  { name: 'In Progress', value: 74,   color: '#f57c00' },
  { name: 'Failed',      value: 68,   color: '#d32f2f' },
]

export const MOCK_DMF_FAILED_BY_STAGE = [
  { name: 'Ingestion',    value: 32, color: '#1565c0' },
  { name: 'Enrichment',   value: 50, color: '#f57c00' },
  { name: 'Distribution', value: 40, color: '#2e7d32' },
  { name: 'Integration',  value: 80, color: '#7b1fa2' },
]

export const MOCK_DMF_RUNS_OVER_TIME = [
  { date: 'Mar 10', total: 168, failed: 12, successRate: 92.9 },
  { date: 'Mar 11', total: 155, failed: 7,  successRate: 95.5 },
  { date: 'Mar 12', total: 172, failed: 9,  successRate: 94.8 },
  { date: 'Mar 13', total: 180, failed: 11, successRate: 93.9 },
  { date: 'Mar 14', total: 145, failed: 6,  successRate: 95.9 },
  { date: 'Mar 15', total: 134, failed: 8,  successRate: 94.0 },
  { date: 'Mar 16', total: 178, failed: 10, successRate: 94.4 },
  { date: 'Mar 17', total: 113, failed: 5,  successRate: 95.6 },
]

export const MOCK_DMF_ERROR_REASONS = [
  { reason: 'Duplicate Key Violation', ingestion: 12, enrichment: 24, distribution: 18, integration: 31 },
  { reason: 'Threshold Exceeded',      ingestion: 8,  enrichment: 15, distribution: 22, integration: 10 },
  { reason: 'Data Type Mismatch',      ingestion: 5,  enrichment: 18, distribution: 8,  integration: 14 },
  { reason: 'Timeout/Error 504',       ingestion: 7,  enrichment: 3,  distribution: 12, integration: 6  },
]

export const MOCK_DMF_RECENT_FAILURES = [
  { id: 'fail-001', etlProcess: 'CUSTOMER_LOAD_PIPELINE',    runId: 'RUN12345', batchId: 'BATCH20240417_01', startTime: '2026-03-17T08:00:00Z', endTime: '2026-03-17T08:42:00Z', failedStage: 'Integration',  errorDescription: 'Duplicate key violation in integration stage',       details: 'Primary key constraint violated on customer_id. 1,247 duplicate records detected in source feed. Add dedup step in pre-load transform before integration stage.' },
  { id: 'fail-002', etlProcess: 'ORDER_PROCESSING_PIPELINE', runId: 'RUN12650', batchId: '-',               startTime: '2026-03-17T09:15:00Z', endTime: '2026-03-17T09:30:00Z', failedStage: 'Ingestion',    errorDescription: 'Data type mismatch in ingestion stage',              details: 'Expected INT for order_value column, received VARCHAR. Source schema changed without notification.' },
  { id: 'fail-003', etlProcess: 'SALES_DATA_PIPELINE',       runId: 'RUN12340', batchId: 'BATCH20250418_01',startTime: '2026-03-17T09:00:00Z', endTime: '2026-03-17T09:18:00Z', failedStage: 'Enrichment',   errorDescription: 'Threshold exceeded for rejected records in enrichment', details: 'Rejection threshold of 5% exceeded (actual: 8.2%).' },
  { id: 'fail-004', etlProcess: 'FINANCE_PIPELINE',          runId: 'RUN11890', batchId: 'BATCH2023618_01', startTime: '2026-03-17T06:30:00Z', endTime: '2026-03-17T08:05:00Z', failedStage: 'Distribution', errorDescription: 'Timeout error during distribution',                   details: 'Target system timed out after 5400s. Scale up target or add retry with backoff.' },
]

// ─── Trends — keys match the live API response ────────────────────────────

export const MOCK_DMF_STATUS_TREND = [
  { month: 'Jan', success: 1980, failed: 480, inProgress: 310, partialLoad: 85 },
  { month: 'Feb', success: 2100, failed: 510, inProgress: 290, partialLoad: 72 },
  { month: 'Mar', success: 2280, failed: 550, inProgress: 265, partialLoad: 68 },
]

// rowsLoaded / rowsParsed / rowsRjctd  ← matches /api/dmf/rows-trend response
export const MOCK_DMF_ROWS_TREND = [
  { month: 'Jan', rowsLoaded: 34000, rowsParsed: 34200, rowsRjctd: 200 },
  { month: 'Feb', rowsLoaded: 38000, rowsParsed: 38400, rowsRjctd: 400 },
  { month: 'Mar', rowsLoaded: 42000, rowsParsed: 42600, rowsRjctd: 600 },
]

// ING / ENR / DIS / INT  ← matches /api/dmf/jobs-trend response (proc_typ_cd pivot)
export const MOCK_DMF_JOBS_TREND = [
  { month: 'Jan', ING: 1580, ENR: 1200, DIS: 820, INT: 420 },
  { month: 'Feb', ING: 1620, ENR: 1250, DIS: 870, INT: 440 },
  { month: 'Mar', ING: 1510, ENR: 1180, DIS: 750, INT: 390 },
]

export const MOCK_DMF_STEP_FAILURE_TREND = [
  { period: 'Feb 2023', count: 2  },
  { period: 'Aug 2023', count: 5  },
  { period: 'Feb 2024', count: 3  },
  { period: 'Aug 2024', count: 4  },
  { period: 'Feb 2025', count: 8  },
  { period: 'Aug 2025', count: 12 },
  { period: 'Feb 2026', count: 6  },
]

// ─── Analytics ───────────────────────────────────────────────────────────────

export const MOCK_DMF_ANALYTICS = {
  statusSummary: [
    { status: 'success',      count: 5324 },
    { status: 'failed',       count: 1434 },
    { status: 'partial load', count: 87   },
    { status: 'started',      count: 1    },
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
    { source: 'ADV_T_CASE',              count: 64 },
    { source: 'ANALYTICS_PFID_SALES',    count: 44 },
    { source: 'ANA_SILVER_DEPOSIT_ACCT', count: 30 },
    { source: 'CUSTOMER_QUERY',          count: 22 },
    { source: 'TOL_TRANS_HISTORY',       count: 18 },
    { source: 'REL_OFFICER_RT',          count: 16 },
    { source: 'FIT_SF_CASE_CATEGORY',    count: 14 },
    { source: 'DRM_OFFER_INSTANCE',      count: 14 },
  ],
  datasetsByExecTime: [
    { dataset: 'TX_CVOC_app_offer_Retry',      avgMs: 4500 },
    { dataset: 'FCMS_TRANS_ACQUIRE_S',         avgMs: 3800 },
    { dataset: 'TX_TVOC_ang_ful_Send',         avgMs: 3200 },
    { dataset: 'CUSTOMER_ACCOUNT_PAR',         avgMs: 2900 },
    { dataset: 'ANL_FIN_STATEMENT_HISTORY_S',  avgMs: 2600 },
    { dataset: 'TX_CVOC_Ang_acc_MH',           avgMs: 2400 },
    { dataset: 'CUSTOMER_ACCOUNT_TRANSACTION', avgMs: 2000 },
    { dataset: 'FCMS_CUSTOMERS',               avgMs: 1800 },
  ],
}

// ─── Lineage ────────────────────────────────────────────────────────────────

export const MOCK_DMF_LINEAGE_META = {
  sourceCodes:  ['DTA','ACO','ADV','AEC','ARF','ATC','ATM','AWS_CONNECT','FCMS','GLD','PSS','SASVIYA','SPLUNK_LINE'],
  datasetNames: ['ACCT_MSTR_VW','ACH_IAT_TRAN_ENTRY_CD_ACTRD','ACO_DCFM_CAMPAIGNBUSINESSFLDS','ADR_ADR_EMPLOYEE','ADV_IRM_T_LEAD','ADV_T_LEAD','CPE_SCF_DATA','FCMS_ALERT_DETAILS_FRAUD','NCO_SF_LLC_BI_LOAN','OLD_ONLINE_BANK_EXTRACT','PSS_COURSE_CATALOG','SPLUNK_DIGITAL_OLB_MOBILE','TEST_TRANSACTION_SAS_CRU_R','TX_GOLD_DEP_RetailAcctsOpened'],
  sourceNames:  ['CPE_SCF_M','EDA_SILVER_DEP_DEP_ACCT_MASTER','FCMS_ALERT_DETAILS_FRAUD','NCO_SF_LLC_BI_LOAN_SOURCE','OLD_ONLINE_BANK_EXTRACT','PSS_COURSE_CATALOG','SPLUNK_DIGITAL_OLB_MOBILE','TEST_TRANSACTION_SAS_CRU_RESULT'],
  targetNames:  ['DPKE_REWARD_RULE_PROGRESS','FCMS_ALERT_DETAILS_FRAUD','NCO_SF_LLC_BI_LOAN_TARGET','OLD_ONLINE_BANK_EXTRACT','PDM_MET_T_DEP_RETAIL_ACCTS_OPENED_F','PSS_COURSE_CATALOG','SPLUNK_DIGITAL_OLB_MOBILE','TEST_TRANSACTION_SAS_CRU_RESULT'],
}

export const MOCK_DMF_LINEAGE_JOBS = [
  { id:'lj1',  processDate:'1/30/2026', sourceCode:'SPLUNK_LINE', datasetName:'SPLUNK_DIGITAL_OLB_MOBILE',     processTypeCode:'ING', sourceName:'SPLUNK_DIGITAL_OLB_MOBILE',       targetName:'SPLUNK_DIGITAL_OLB_MOBILE',           runStartTime:'1/30/2026 9:51 AM',  runEndTime:'1/30/2026 10:02 AM', status:'success' },
  { id:'lj2',  processDate:'6/5/2026',  sourceCode:'DAILY',       datasetName:'TX_GOLD_DEP_RetailAcctsOpened', processTypeCode:'ENR', sourceName:'EDA_SILVER_DEP_DEP_ACCT_MASTER',  targetName:'PDM_MET_T_DEP_RETAIL_ACCTS_OPENED_F', runStartTime:'5/4/2026 9:03 AM',   runEndTime:'5/4/2026 10:28 AM',  status:'success' },
  { id:'lj3',  processDate:'3/31/2026', sourceCode:'CPE_SCF',     datasetName:'CPE_SCF_DATA',                  processTypeCode:'ING', sourceName:'CPE_SCF_M',                       targetName:'PSS_COURSE_CATALOG',                  runStartTime:'3/8/2026 9:28 AM',   runEndTime:'3/8/2026 10:28 AM',  status:'success' },
  { id:'lj4',  processDate:'3/21/2026', sourceCode:'PSS',         datasetName:'PSS_COURSE_CATALOG',            processTypeCode:'ING', sourceName:'PSS_COURSE_CATALOG',              targetName:'PSS_COURSE_CATALOG',                  runStartTime:'3/17/2026 10:02 AM', runEndTime:'3/17/2026 6:08 PM',  status:'success' },
  { id:'lj5',  processDate:'3/18/2026', sourceCode:'FCMS',        datasetName:'FCMS_ALERT_DETAILS_FRAUD',      processTypeCode:'ING', sourceName:'FCMS_ALERT_DETAILS_FRAUD',        targetName:'FCMS_ALERT_DETAILS_FRAUD',            runStartTime:'3/17/2026 10:27 AM', runEndTime:'3/17/2026 6:14 PM',  status:'success' },
  { id:'lj6',  processDate:'3/18/2026', sourceCode:'SASVIYA',     datasetName:'TEST_TRANSACTION_SAS_CRU_R',    processTypeCode:'ING', sourceName:'TEST_TRANSACTION_SAS_CRU_RESULT', targetName:'TEST_TRANSACTION_SAS_CRU_RESULT',     runStartTime:'3/17/2026 10:20 AM', runEndTime:'3/17/2026 5:32 PM',  status:'failed'  },
  { id:'lj7',  processDate:'3/18/2026', sourceCode:'SASVIYA',     datasetName:'TEST_TRANSACTION_SAS_CRU_R',    processTypeCode:'ING', sourceName:'TEST_TRANSACTION_SAS_CRU_RESULT', targetName:'TEST_TRANSACTION_SAS_CRU_RESULT',     runStartTime:'3/16/2026 3:16 AM',  runEndTime:'3/17/2026 3:32 AM',  status:'success' },
  { id:'lj8',  processDate:'3/18/2026', sourceCode:'GLD',         datasetName:'NCO_SF_LLC_BI_LOAN',            processTypeCode:'ENR', sourceName:'NCO_SF_LLC_BI_LOAN_SOURCE',       targetName:'NCO_SF_LLC_BI_LOAN_TARGET',           runStartTime:'3/16/2026 5:14 PM',  runEndTime:'3/16/2026 5:32 PM',  status:'success' },
  { id:'lj9',  processDate:'3/17/2026', sourceCode:'SASVIYA',     datasetName:'TEST_TRANSACTION_SAS_CRU_R',    processTypeCode:'ING', sourceName:'TEST_TRANSACTION_SAS_CRU_RESULT', targetName:'TEST_TRANSACTION_SAS_CRU_RESULT',     runStartTime:'3/17/2026 3:33 AM',  runEndTime:'3/17/2026 6:39 AM',  status:'success' },
  { id:'lj10', processDate:'3/17/2026', sourceCode:'DTA',         datasetName:'OLD_ONLINE_BANK_EXTRACT',       processTypeCode:'ING', sourceName:'OLD_ONLINE_BANK_EXTRACT',         targetName:'OLD_ONLINE_BANK_EXTRACT',             runStartTime:'3/17/2026 3:55 AM',  runEndTime:'3/17/2026 4:15 AM',  status:'success' },
  { id:'lj11', processDate:'3/17/2026', sourceCode:'SASVIYA',     datasetName:'TEST_TRANSACTION_SAS_CRU_R',    processTypeCode:'ING', sourceName:'TEST_TRANSACTION_SAS_CRU_RESULT', targetName:'TEST_TRANSACTION_SAS_CRU_RESULT',     runStartTime:'3/17/2026 4:10 AM',  runEndTime:'3/17/2026 4:25 AM',  status:'failed'  },
  { id:'lj12', processDate:'3/17/2026', sourceCode:'GLD',         datasetName:'NCO_SF_LLC_BI_LOAN',            processTypeCode:'ENR', sourceName:'NCO_SF_LLC_BI_LOAN_SOURCE',       targetName:'NCO_SF_LLC_BI_LOAN_TARGET',           runStartTime:'3/17/2026 3:28 AM',  runEndTime:'3/17/2026 3:31 AM',  status:'success' },
  { id:'lj13', processDate:'3/17/2026', sourceCode:'SASVIYA',     datasetName:'TEST_TRANSACTION_SAS_CRU_R',    processTypeCode:'ING', sourceName:'TEST_TRANSACTION_SAS_CRU_RESULT', targetName:'TEST_TRANSACTION_SAS_CRU_RESULT',     runStartTime:'3/17/2026 4:03 AM',  runEndTime:'3/17/2026 6:04 AM',  status:'success' },
]

// Derived counts for mock mode — mirrors what the /lineage/counts endpoint returns.
// These are aggregate totals so the UI never has to iterate over millions of real rows.
export const MOCK_DMF_LINEAGE_COUNTS = (() => {
  const jobs = MOCK_DMF_LINEAGE_JOBS
  const total = jobs.length
  const byStatus = [
    { status: 'success' as const, count: jobs.filter(j => j.status === 'success').length },
    { status: 'failed'  as const, count: jobs.filter(j => j.status === 'failed').length },
  ].filter(x => x.count > 0)
  const byProcType = ['ING','ENR','DIS','INT'].map(t => ({
    procTypeCode: t,
    count: jobs.filter(j => j.processTypeCode === t).length,
  })).filter(x => x.count > 0)
  const bySrcCdMap: Record<string, number> = {}
  const byTgtNmMap: Record<string, number> = {}
  jobs.forEach(j => {
    bySrcCdMap[j.sourceCode]  = (bySrcCdMap[j.sourceCode]  ?? 0) + 1
    byTgtNmMap[j.targetName]  = (byTgtNmMap[j.targetName]  ?? 0) + 1
  })
  const bySrcCd = Object.entries(bySrcCdMap).sort((a, b) => b[1] - a[1]).map(([sourceCode, count]) => ({ sourceCode, count }))
  const byTgtNm = Object.entries(byTgtNmMap).sort((a, b) => b[1] - a[1]).map(([targetName, count]) => ({ targetName, count }))
  return { total, byStatus, byProcType, bySrcCd, byTgtNm }
})()
