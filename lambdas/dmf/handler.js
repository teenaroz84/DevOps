/**
 * DMF Lambda — handles all /api/dmf/* endpoints
 *
 * This single Lambda uses API Gateway proxy integration to route
 * to the correct handler based on the request path.
 *
 * Replace TODO sections with real database queries.
 *
 * Environment variables:
 *   DMF_DB_HOST, DMF_DB_PORT, DMF_DB_NAME, DMF_DB_USER, DMF_DB_PASSWORD
 */
const { success, notFound, serverError, corsPreFlight } = require('../shared/response');

// ── Uncomment when connecting to a real database ─────────────
// const { Client } = require('pg');
//
// async function query(sql, params = []) {
//   const client = new Client({
//     host:     process.env.DMF_DB_HOST,
//     port:     parseInt(process.env.DMF_DB_PORT || '5432', 10),
//     database: process.env.DMF_DB_NAME,
//     user:     process.env.DMF_DB_USER,
//     password: process.env.DMF_DB_PASSWORD,
//     ssl:      { rejectUnauthorized: false },
//   });
//   await client.connect();
//   const result = await client.query(sql, params);
//   await client.end();
//   return result.rows;
// }

// ── Mock data (matches server/src/mockData.ts) ───────────────

const mockDMFSummary = {
  totalRuns:      { value: 1245, trend: '+8%',   label: 'Last 7 Days' },
  failedRuns:     { value: 68,   trend: '-5%',   label: '+0 this week' },
  runsInProgress: { value: 74,   trend: '+3%',   label: '+0 this week' },
  successRate:    { value: 94.5, trend: '+0.5%', label: '+0.5% week' },
};

const mockDMFStages = [
  { stage: 'Ingestion',    success: 920, inProgress: 48,  failed: 32, rate: 92 },
  { stage: 'Enrichment',   success: 870, inProgress: 80,  failed: 50, rate: 87 },
  { stage: 'Distribution', success: 880, inProgress: 80,  failed: 40, rate: 88 },
  { stage: 'Integration',  success: 800, inProgress: 120, failed: 80, rate: 80 },
];

const mockDMFRunStatus = [
  { name: 'Success',     value: 1177, color: '#2e7d32' },
  { name: 'In Progress', value: 74,   color: '#f57c00' },
  { name: 'Failed',      value: 68,   color: '#d32f2f' },
];

const mockDMFFailedByStage = [
  { name: 'Ingestion',    value: 32, color: '#1565c0' },
  { name: 'Enrichment',   value: 50, color: '#f57c00' },
  { name: 'Distribution', value: 40, color: '#2e7d32' },
  { name: 'Integration',  value: 80, color: '#7b1fa2' },
];

const mockDMFRunsOverTime = [
  { date: 'Mar 10', total: 168, failed: 12, successRate: 92.9 },
  { date: 'Mar 11', total: 155, failed: 7,  successRate: 95.5 },
  { date: 'Mar 12', total: 172, failed: 9,  successRate: 94.8 },
  { date: 'Mar 13', total: 180, failed: 11, successRate: 93.9 },
  { date: 'Mar 14', total: 145, failed: 6,  successRate: 95.9 },
  { date: 'Mar 15', total: 134, failed: 8,  successRate: 94.0 },
  { date: 'Mar 16', total: 178, failed: 10, successRate: 94.4 },
  { date: 'Mar 17', total: 113, failed: 5,  successRate: 95.6 },
];

const mockDMFErrorReasons = [
  { reason: 'Duplicate Key Violation', ingestion: 12, enrichment: 24, distribution: 18, integration: 31 },
  { reason: 'Threshold Exceeded',      ingestion: 8,  enrichment: 15, distribution: 22, integration: 10 },
  { reason: 'Data Type Mismatch',      ingestion: 5,  enrichment: 18, distribution: 8,  integration: 14 },
  { reason: 'Timeout/Error 504',       ingestion: 7,  enrichment: 3,  distribution: 12, integration: 6  },
];

const mockDMFRecentFailures = [
  { id: 'fail-001', etlProcess: 'CUSTOMER_LOAD_PIPELINE', runId: 'RUN12345', batchId: 'BATCH20240417_01', startTime: '2026-03-17T08:00:00Z', endTime: '2026-03-17T08:42:00Z', failedStage: 'Integration', errorDescription: 'Duplicate key violation in integration stage', details: 'Primary key constraint violated on customer_id.' },
  { id: 'fail-002', etlProcess: 'ORDER_PROCESSING_PIPELINE', runId: 'RUN12650', batchId: '-', startTime: '2026-03-17T09:15:00Z', endTime: '2026-03-17T09:30:00Z', failedStage: 'Ingestion', errorDescription: 'Data type mismatch in ingestion stage', details: 'Expected INT for order_value column, received VARCHAR.' },
  { id: 'fail-003', etlProcess: 'SALES_DATA_PIPELINE', runId: 'RUN12340', batchId: 'BATCH20250418_01', startTime: '2026-03-17T09:00:00Z', endTime: '2026-03-17T09:18:00Z', failedStage: 'Enrichment', errorDescription: 'Threshold exceeded for rejected records in enrichment', details: 'Rejection threshold of 5% exceeded (actual: 8.2%).' },
  { id: 'fail-004', etlProcess: 'FINANCE_PIPELINE', runId: 'RUN11890', batchId: 'BATCH2023618_01', startTime: '2026-03-17T06:30:00Z', endTime: '2026-03-17T08:05:00Z', failedStage: 'Distribution', errorDescription: 'Timeout error during distribution', details: 'Target system timed out after 5400s.' },
];

const mockDMFStatusTrend = [
  { month: 'Jan', success: 1980, failed: 480, inProgress: 310, partialLoad: 85 },
  { month: 'Feb', success: 2100, failed: 510, inProgress: 290, partialLoad: 72 },
  { month: 'Mar', success: 2280, failed: 550, inProgress: 265, partialLoad: 68 },
];

const mockDMFRowsTrend = [
  { month: 'Jan', ingestion: 34, enrichment: 22, distribution: 8, integration: 0.4 },
  { month: 'Feb', ingestion: 38, enrichment: 25, distribution: 10, integration: 0.5 },
  { month: 'Mar', ingestion: 42, enrichment: 28, distribution: 14, integration: 0.6 },
];

const mockDMFJobsTrend = [
  { month: 'Jan', customerLoad: 1580, orderProcessing: 1200, salesData: 820, finance: 420 },
  { month: 'Feb', customerLoad: 1620, orderProcessing: 1250, salesData: 870, finance: 440 },
  { month: 'Mar', customerLoad: 1510, orderProcessing: 1180, salesData: 750, finance: 390 },
];

const mockDMFStepFailureTrend = [
  { period: 'Feb 2023', count: 2 },
  { period: 'Aug 2023', count: 5 },
  { period: 'Feb 2024', count: 3 },
  { period: 'Aug 2024', count: 4 },
  { period: 'Feb 2025', count: 8 },
  { period: 'Aug 2025', count: 12 },
  { period: 'Feb 2026', count: 6 },
];

const mockDMFAnalytics = {
  statusSummary: [
    { status: 'SUCCESS', count: 5324 },
    { status: 'FAILED', count: 1434 },
    { status: 'PARTIAL LOAD', count: 87 },
    { status: 'STARTED', count: 1 },
  ],
  sourceTypeCounts: [
    { type: 'RELATIONAL', count: 11763 },
    { type: 'FILE', count: 10697 },
    { type: 'StoredProc', count: 1252 },
    { type: 'TABLE', count: 827 },
    { type: 'NOT DEFINED', count: 594 },
    { type: 'AZURE', count: 231 },
    { type: 'ENTRY_FILE', count: 184 },
  ],
  targetTypeCounts: [
    { type: 'RELATIONAL', count: 7040 },
    { type: 'TABLE', count: 5312 },
    { type: 'FILE', count: 2040 },
    { type: 'Snowflake', count: 596 },
    { type: 'NOT DEFINED', count: 396 },
    { type: 'GOLD', count: 231 },
    { type: 'ARC_FILE', count: 105 },
    { type: 'ELASTIC', count: 89 },
  ],
  stepFailureCounts: [
    { step: 'DBWRITER', count: 547 },
    { step: 'EXTRACTOR', count: 400 },
    { step: 'ENRICHMENT', count: 209 },
    { step: 'UGD', count: 106 },
    { step: 'DATA', count: 98 },
    { step: 'DISTRIBUTOR', count: 35 },
    { step: 'SCHEDULER', count: 28 },
    { step: 'INTEGRATION', count: 25 },
  ],
  failuresBySource: [
    { source: 'ADV_T_CASE', count: 64 },
    { source: 'ANALYTICS_PFID_SALES', count: 44 },
    { source: 'ANA_SILVER_DEPOSIT_ACCT', count: 30 },
    { source: 'CUSTOMER_QUERY', count: 22 },
    { source: 'TOL_TRANS_HISTORY', count: 18 },
    { source: 'REL_OFFICER_RT', count: 16 },
    { source: 'FIT_SF_CASE_CATEGORY', count: 14 },
    { source: 'DRM_OFFER_INSTANCE', count: 14 },
    { source: 'SCH_ALL_REP_DELIST', count: 13 },
    { source: 'ADR_OFFERS_HISTORY', count: 13 },
    { source: 'TEST_TBL_RESULT', count: 12 },
    { source: 'ACC_INCR_SF_ACCOUNT', count: 12 },
    { source: 'SNC_MARAKOD_OPTS', count: 11 },
    { source: 'VMC_INTERVALS', count: 11 },
    { source: 'INDI_PLUNFIT_CARDS_TA_ADD', count: 10 },
    { source: 'T_AGENT', count: 8 },
    { source: 'CUSTOMER_ACCOUNT_CA', count: 7 },
    { source: 'CUSTOMER_ACCOUNT_D', count: 6 },
  ],
  datasetsByExecTime: [
    { dataset: 'TX_CVOC_app_offer_Retry', avgMs: 4500 },
    { dataset: 'FCMS_TRANS_ACQUIRE_S', avgMs: 3800 },
    { dataset: 'TX_TVOC_ang_ful_Send', avgMs: 3200 },
    { dataset: 'CUSTOMER_ACCOUNT_PAR', avgMs: 2900 },
    { dataset: 'ANL_FIN_STATEMENT_HISTORY_S', avgMs: 2600 },
    { dataset: 'TX_CVOC_Ang_acc_MH', avgMs: 2400 },
    { dataset: 'ANL_FIN_STATEMENT_UPCLOUD_Q', avgMs: 2200 },
    { dataset: 'CUSTOMER_ACCOUNT_TRANSACTION', avgMs: 2000 },
    { dataset: 'FCMS_CUSTOMERS', avgMs: 1800 },
    { dataset: 'LKGE_E_TRNF_LI_HISTR', avgMs: 1600 },
    { dataset: 'LMI_S_ACCOUNT', avgMs: 1400 },
    { dataset: 'ANL_FNC_STATEMENT_RETURN_2', avgMs: 1200 },
    { dataset: 'SN_FINANCNALACCOUNTMANCE', avgMs: 1000 },
    { dataset: 'FNC_ACCT_APILR_DYI_FUNC', avgMs: 800 },
    { dataset: 'FACT_SF_OPPORTUNITY_TAZ', avgMs: 600 },
  ],
};

const mockDMFLineageMeta = {
  sourceCodes: ['DTA','ACO','ADV','AEC','ARF','ATC','ATM','AWS_CONNECT','AWS_CONNECT_CORP','AWS_CONNECT_RT','AWS_CONNECT_RTL'],
  datasetNames: ['ACCT_MSTR_VW','ACCT_MSTR_VW_TRIAL','acct_trial','ACH_IAT_TRAN_ENTRY_CD_ACTRD','ACH_IAT_TRAN_RECV_DFI_INFO','ACO_DCFM_CAMPAIGNBUSINESSFLDS','ACO_DCFM_CAMPAIGNFILTERGROUPS','ACT_TRIAL','ADR_ADR_EMPLOYEE','ADR_EMPLOYEE','ADV_IRM_T_LEAD','ADV_IRM_T_OPPORTUNITY','ADV_T_LEAD','ADV_T_OPPORTUNITY','ADV_T_PWM_TRUIST_BUSINESS_PROCESS_C'],
  sourceNames: ['ACH_IAT_TRAN_ENTRY_CD_ACTRD','ACH_IAT_TRAN_RECV_DFI_INFO','ACQ_DCFM_CAMPAIGNBUSINESSFLDS','ACQ_DCFM_CAMPAIGNFILTERGROUPS','ADR_EMPLOYEE','ADV_IRM_T_LEAD','ADV_T_ACCOUNT','ADV_T_CONTACT','ADV_T_LEAD','ADV_T_OPPORTUNITY','ADV_T_PWM_CLIENT_DETAILS_C','ADV_T_PWM_TRUIST_BUSINESS_PROCESS_C','ADV_T_SITE_TEAMMATE_CENTER_C'],
  targetNames: ['DPKE_REWARD_RULE_PROGRESS','S_D_S_Transactions_Monetary_CW_02092026_084190.txt','S_D_S_Transactions_Monetary_CW_02522026_050506.txt','S_D_S_Transactions_Monetary_CW_02082026_096380.txt','S_D_S_Transactions_Monetary_CW_03222026_100486.txt','S_D_S_Transactions_Monetary_CW_02252026_082826.txt'],
};

const mockDMFLineageJobs = [
  { id: 'lj1', processDate: '1/30/2026', sourceCode: 'SPLUNK_LINE', datasetName: 'SPLUNK_DIGITAL_OLB_MOBILE', processTypeCode: 'ING', sourceName: 'SPLUNK_DIGITAL_OLB_MOBILE', targetName: 'SPLUNK_DIGITAL_OLB_MOBILE', runStartTime: '1/30/2026 9:51 AM', runEndTime: '1/30/2026 10:02 AM', status: 'success' },
  { id: 'lj2', processDate: '6/5/2026', sourceCode: 'DAILY', datasetName: 'TX_GOLD_DEP_RetailAcctsOpened', processTypeCode: 'ENR', sourceName: 'EDA_SILVER_DEP_DEP_ACCT_MASTER', targetName: 'PDM_MET_T_DEP_RETAIL_ACCTS_OPENED_F', runStartTime: '5/4/2026 9:03 AM', runEndTime: '5/4/2026 10:28 AM', status: 'success' },
  { id: 'lj3', processDate: '3/31/2026', sourceCode: 'CPE_SCF', datasetName: 'CPE_SCF_DATA', processTypeCode: 'ING', sourceName: 'CPE_SCF_M', targetName: 'PSS_COURSE_CATALOG', runStartTime: '3/8/2026 9:28 AM', runEndTime: '3/8/2026 10:28 AM', status: 'success' },
  { id: 'lj4', processDate: '3/21/2026', sourceCode: 'PSS', datasetName: 'PSS_COURSE_CATALOG', processTypeCode: 'ING', sourceName: 'PSS_COURSE_CATALOG', targetName: 'PSS_COURSE_CATALOG', runStartTime: '3/17/2026 10:02 AM', runEndTime: '3/17/2026 6:08 PM', status: 'success' },
  { id: 'lj5', processDate: '3/18/2026', sourceCode: 'FCMS', datasetName: 'FCMS_ALERT_DETAILS_FRAUD', processTypeCode: 'ING', sourceName: 'FCMS_ALERT_DETAILS_FRAUD', targetName: 'FCMS_ALERT_DETAILS_FRAUD', runStartTime: '3/17/2026 10:27 AM', runEndTime: '3/17/2026 6:14 PM', status: 'success' },
  { id: 'lj6', processDate: '3/18/2026', sourceCode: 'SASVIYA', datasetName: 'TEST_TRANSACTION_SAS_CRU_R', processTypeCode: 'ING', sourceName: 'TEST_TRANSACTION_SAS_CRU_RESULT', targetName: 'TEST_TRANSACTION_SAS_CRU_RESULT', runStartTime: '3/17/2026 10:20 AM', runEndTime: '3/17/2026 5:32 PM', status: 'failed' },
  { id: 'lj7', processDate: '3/18/2026', sourceCode: 'SASVIYA', datasetName: 'TEST_TRANSACTION_SAS_CRU_R', processTypeCode: 'ING', sourceName: 'TEST_TRANSACTION_SAS_CRU_RESULT', targetName: 'TEST_TRANSACTION_SAS_CRU_RESULT', runStartTime: '3/16/2026 3:16 AM', runEndTime: '3/17/2026 3:32 AM', status: 'success' },
  { id: 'lj8', processDate: '3/18/2026', sourceCode: 'GLD', datasetName: 'NCO_SF_LLC_BI_LOAN', processTypeCode: 'ENR', sourceName: 'NCO_SF_LLC_BI_LOAN_SOURCE', targetName: 'NCO_SF_LLC_BI_LOAN_TARGET', runStartTime: '3/16/2026 5:14 PM', runEndTime: '3/16/2026 5:32 PM', status: 'success' },
  { id: 'lj9', processDate: '3/17/2026', sourceCode: 'SASVIYA', datasetName: 'TEST_TRANSACTION_SAS_CRU_R', processTypeCode: 'ING', sourceName: 'TEST_TRANSACTION_SAS_CRU_RESULT', targetName: 'TEST_TRANSACTION_SAS_CRU_RESULT', runStartTime: '3/17/2026 3:33 AM', runEndTime: '3/17/2026 6:39 AM', status: 'success' },
  { id: 'lj10', processDate: '3/17/2026', sourceCode: 'DTA', datasetName: 'OLD_ONLINE_BANK_EXTRACT', processTypeCode: 'ING', sourceName: 'OLD_ONLINE_BANK_EXTRACT', targetName: 'OLD_ONLINE_BANK_EXTRACT', runStartTime: '3/17/2026 3:55 AM', runEndTime: '3/17/2026 4:15 AM', status: 'success' },
  { id: 'lj11', processDate: '3/17/2026', sourceCode: 'SASVIYA', datasetName: 'TEST_TRANSACTION_SAS_CRU_R', processTypeCode: 'ING', sourceName: 'TEST_TRANSACTION_SAS_CRU_RESULT', targetName: 'TEST_TRANSACTION_SAS_CRU_RESULT', runStartTime: '3/17/2026 4:10 AM', runEndTime: '3/17/2026 4:25 AM', status: 'failed' },
  { id: 'lj12', processDate: '3/17/2026', sourceCode: 'ENC', datasetName: 'ENC_CST_OF_FUND', processTypeCode: 'ING', sourceName: 'ENC_CST_OF_FUND', targetName: 'ENC_CST_OF_FUND', runStartTime: '3/17/2026 3:28 AM', runEndTime: '3/17/2026 3:31 AM', status: 'success' },
  { id: 'lj13', processDate: '3/17/2026', sourceCode: 'SASVIYA', datasetName: 'TEST_TRANSACTION_SAS_CRU_R', processTypeCode: 'ING', sourceName: 'TEST_TRANSACTION_SAS_CRU_RESULT', targetName: 'TEST_TRANSACTION_SAS_CRU_RESULT', runStartTime: '3/17/2026 4:03 AM', runEndTime: '3/17/2026 6:04 AM', status: 'success' },
];

// ── Route map ────────────────────────────────────────────────

const ROUTES = {
  '/api/dmf/summary':            () => success(mockDMFSummary),
  '/api/dmf/stages':             () => success(mockDMFStages),
  '/api/dmf/run-status':         () => success(mockDMFRunStatus),
  '/api/dmf/failed-by-stage':    () => success(mockDMFFailedByStage),
  '/api/dmf/runs-over-time':     () => success(mockDMFRunsOverTime),
  '/api/dmf/error-reasons':      () => success(mockDMFErrorReasons),
  '/api/dmf/status-trend':       () => success(mockDMFStatusTrend),
  '/api/dmf/rows-trend':         () => success(mockDMFRowsTrend),
  '/api/dmf/jobs-trend':         () => success(mockDMFJobsTrend),
  '/api/dmf/step-failure-trend': () => success(mockDMFStepFailureTrend),
  '/api/dmf/analytics':          () => success(mockDMFAnalytics),
  '/api/dmf/lineage/meta':       () => success(mockDMFLineageMeta),
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return corsPreFlight();

  const path = event.path || event.rawPath || '';
  const qs = event.queryStringParameters || {};

  try {
    // Static routes
    const routeHandler = ROUTES[path];
    if (routeHandler) return routeHandler();

    // GET /api/dmf/recent-failures?stage=...&etlProcess=...
    if (path.endsWith('/recent-failures')) {
      let data = [...mockDMFRecentFailures];
      if (qs.stage) data = data.filter((f) => f.failedStage === qs.stage);
      if (qs.etlProcess) data = data.filter((f) => f.etlProcess === qs.etlProcess);
      return success(data);
    }

    // GET /api/dmf/lineage/jobs?sourceCode=...&datasetName=...&processTypeCode=...&status=...
    if (path.endsWith('/lineage/jobs')) {
      let data = [...mockDMFLineageJobs];
      if (qs.sourceCode && qs.sourceCode !== 'All') data = data.filter((j) => j.sourceCode === qs.sourceCode);
      if (qs.datasetName && qs.datasetName !== 'All') data = data.filter((j) => j.datasetName === qs.datasetName);
      if (qs.processTypeCode && qs.processTypeCode !== 'All') data = data.filter((j) => j.processTypeCode === qs.processTypeCode);
      if (qs.status && qs.status !== 'All') data = data.filter((j) => j.status === qs.status);
      return success(data);
    }

    return notFound('Unknown DMF endpoint');
  } catch (err) {
    console.error('DMF Lambda error:', err);
    return serverError(err.message);
  }
};
