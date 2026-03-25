/**
 * Mock data for ESP Dashboard — matches the /api/esp/summary/:appl_name response schema.
 */

export interface NameCount { name: string; count: number }

export interface AppData {
  appl_name: string
  job_count: number
  idle_job_count: number
  spl_job_count: number
  agents: NameCount[]
  job_types: NameCount[]
  completion_codes: NameCount[]
  accounts: NameCount[]
  job_list: Array<{ jobname: string; last_run_date: string | null }>
  job_run_trend: Array<{ day: string; hour: number; count: number }>
  successor_jobs: Array<{ jobname: string; successor_job: string }>
  predecessor_jobs: Array<{ jobname: string; predecessor_job: string }>
  metadata: Array<{ jobname: string; command: string | null; argument: string | null }>
}

const MOCK_APPS: AppData[] = [
  {
    appl_name: 'DTDPLMET',
    job_count: 107,
    idle_job_count: 107,
    spl_job_count: 16,
    agents: [
      { name: 'PRDEOLSPARKLB_V', count: 45 },
      { name: 'PRD_EDLCDDLBVIP', count: 37 },
      { name: 'Null', count: 25 },
    ],
    job_types: [
      { name: 'UNIX', count: 82 },
      { name: 'MAINFRAME', count: 25 },
    ],
    completion_codes: [
      { name: '1', count: 72 },
      { name: '2', count: 35 },
    ],
    accounts: [
      { name: 'sv-edlprd1_metrics', count: 79 },
      { name: 'Null', count: 28 },
    ],
    job_list: [
      { jobname: 'CD332400', last_run_date: '2026-03-24T10:12:00Z' },
      { jobname: 'CD332402', last_run_date: '2026-03-24T10:15:00Z' },
      { jobname: 'COMPRT_DTDOPSD57_PRD', last_run_date: '2026-03-24T11:00:00Z' },
      { jobname: 'COMPRT_DTDOPSD63_PRD', last_run_date: '2026-03-24T11:05:00Z' },
      { jobname: 'COMPRT_DTDOPSD64_PRD', last_run_date: '2026-03-24T11:10:00Z' },
      { jobname: 'COMPRT_DTDOPSD67_PRD', last_run_date: '2026-03-24T11:15:00Z' },
      { jobname: 'COMPRT_DTDOPSD70_PRD', last_run_date: '2026-03-24T12:00:00Z' },
      { jobname: 'COMPRT_DTDOPSD71_PRD', last_run_date: '2026-03-24T12:05:00Z' },
      { jobname: 'COMPRT_DTDOPSH89_PRD', last_run_date: '2026-03-24T12:10:00Z' },
      { jobname: 'DTOPSA04_PRD', last_run_date: '2026-03-24T12:15:00Z' },
      { jobname: 'DTOPSA05_PRD', last_run_date: '2026-03-24T13:00:00Z' },
      { jobname: 'DTOPSA06_PRD', last_run_date: '2026-03-24T13:05:00Z' },
      { jobname: 'JSDELAY_DTDPLMET_001', last_run_date: null },
      { jobname: 'RETRIG_DTDPLMET_001', last_run_date: null },
      { jobname: 'FINMETRICS_LOAD_PRD', last_run_date: '2026-03-24T14:00:00Z' },
      { jobname: 'FINMETRICS_XFORM_PRD', last_run_date: '2026-03-24T14:10:00Z' },
    ],
    job_run_trend: [
      { day: '2026-03-24', hour: 8,  count: 6  },
      { day: '2026-03-24', hour: 9,  count: 12 },
      { day: '2026-03-24', hour: 10, count: 21 },
      { day: '2026-03-24', hour: 11, count: 30 },
      { day: '2026-03-24', hour: 12, count: 25 },
      { day: '2026-03-24', hour: 13, count: 18 },
      { day: '2026-03-24', hour: 14, count: 14 },
      { day: '2026-03-24', hour: 15, count: 16 },
      { day: '2026-03-24', hour: 16, count: 11 },
      { day: '2026-03-24', hour: 17, count: 8  },
      { day: '2026-03-25', hour: 8,  count: 4  },
      { day: '2026-03-25', hour: 9,  count: 10 },
      { day: '2026-03-25', hour: 10, count: 19 },
      { day: '2026-03-25', hour: 11, count: 27 },
      { day: '2026-03-25', hour: 12, count: 22 },
      { day: '2026-03-25', hour: 13, count: 15 },
      { day: '2026-03-25', hour: 14, count: 12 },
      { day: '2026-03-25', hour: 15, count: 14 },
    ],
    successor_jobs: [
      { jobname: 'CD332400',          successor_job: 'CD_DOWNSTREAM_01' },
      { jobname: 'COMPRT_DTDOPSD57_PRD', successor_job: 'FINMETRICS_LOAD_PRD' },
      { jobname: 'FINMETRICS_LOAD_PRD',  successor_job: 'FINMETRICS_XFORM_PRD' },
    ],
    predecessor_jobs: [
      { jobname: 'CD332400',          predecessor_job: 'UPSTREAM_FEED_01' },
      { jobname: 'COMPRT_DTDOPSD63_PRD', predecessor_job: 'SRC_EXTRACT_PRD' },
    ],
    metadata: [
      { jobname: 'CD332400',          command: '/opt/etl/run.sh',       argument: '--env prod --app DTDPLMET' },
      { jobname: 'CD332402',          command: '/opt/etl/run.sh',       argument: '--env prod --step 2' },
      { jobname: 'COMPRT_DTDOPSD57_PRD', command: 'spark-submit',      argument: '--class com.company.Metrics --master yarn' },
      { jobname: 'COMPRT_DTDOPSD63_PRD', command: 'spark-submit',      argument: '--class com.company.Transform --master yarn' },
      { jobname: 'COMPRT_DTDOPSD64_PRD', command: 'spark-submit',      argument: '--class com.company.Load --master yarn' },
      { jobname: 'COMPRT_DTDOPSD67_PRD', command: 'spark-submit',      argument: '--class com.company.Validate --master yarn' },
      { jobname: 'JSDELAY_DTDPLMET_001', command: 'jsddelay',          argument: '300' },
      { jobname: 'RETRIG_DTDPLMET_001',  command: 'retrig',            argument: '--job COMPRT_DTDOPSD57_PRD' },
      { jobname: 'FINMETRICS_LOAD_PRD',  command: '/opt/etl/load.sh', argument: '--env prod' },
    ],
  },
  {
    appl_name: 'CUSTOMER_360',
    job_count: 88,
    idle_job_count: 12,
    spl_job_count: 3,
    agents: [
      { name: 'PRD_CUST360_AGENT', count: 55 },
      { name: 'Null', count: 33 },
    ],
    job_types: [
      { name: 'UNIX', count: 63 },
      { name: 'MAINFRAME', count: 25 },
    ],
    completion_codes: [
      { name: '1', count: 60 },
      { name: '2', count: 28 },
    ],
    accounts: [
      { name: 'sv-cust360_metrics', count: 70 },
      { name: 'Null', count: 18 },
    ],
    job_list: [
      { jobname: 'CUST360_EXTRACT_01', last_run_date: '2026-03-24T09:00:00Z' },
      { jobname: 'CUST360_EXTRACT_02', last_run_date: '2026-03-24T09:10:00Z' },
      { jobname: 'CUST360_TRANSFORM_01', last_run_date: '2026-03-24T10:00:00Z' },
      { jobname: 'CUST360_LOAD_DW', last_run_date: '2026-03-24T11:30:00Z' },
      { jobname: 'CUST360_VALIDATE', last_run_date: '2026-03-24T12:00:00Z' },
      { jobname: 'JSDELAY_CUST360_001', last_run_date: null },
      { jobname: 'RETRIG_CUST360_001', last_run_date: null },
    ],
    job_run_trend: [
      { day: '2026-03-24', hour: 9,  count: 7  },
      { day: '2026-03-24', hour: 10, count: 12 },
      { day: '2026-03-24', hour: 11, count: 15 },
      { day: '2026-03-24', hour: 12, count: 14 },
      { day: '2026-03-24', hour: 13, count: 13 },
      { day: '2026-03-24', hour: 14, count: 11 },
      { day: '2026-03-24', hour: 15, count: 9  },
      { day: '2026-03-25', hour: 9,  count: 6  },
      { day: '2026-03-25', hour: 10, count: 11 },
      { day: '2026-03-25', hour: 11, count: 13 },
      { day: '2026-03-25', hour: 12, count: 10 },
    ],
    successor_jobs: [
      { jobname: 'CUST360_LOAD_DW', successor_job: 'RPT_CUST360_DAILY' },
    ],
    predecessor_jobs: [
      { jobname: 'CUST360_EXTRACT_01', predecessor_job: 'SRC_CRM_FEED' },
    ],
    metadata: [
      { jobname: 'CUST360_EXTRACT_01',  command: '/opt/cust/extract.sh',   argument: '--src crm --env prod' },
      { jobname: 'CUST360_TRANSFORM_01', command: 'spark-submit',          argument: '--class com.cust.Transform' },
      { jobname: 'CUST360_LOAD_DW',     command: '/opt/cust/load.sh',      argument: '--target dw --env prod' },
      { jobname: 'JSDELAY_CUST360_001', command: 'jsddelay',               argument: '600' },
    ],
  },
  {
    appl_name: 'FINANCE_ETL',
    job_count: 63,
    idle_job_count: 8,
    spl_job_count: 6,
    agents: [
      { name: 'PRD_FIN_AGENT_01', count: 40 },
      { name: 'PRD_FIN_AGENT_02', count: 15 },
      { name: 'Null', count: 8 },
    ],
    job_types: [
      { name: 'UNIX', count: 45 },
      { name: 'MAINFRAME', count: 18 },
    ],
    completion_codes: [
      { name: '1', count: 50 },
      { name: '2', count: 13 },
    ],
    accounts: [
      { name: 'sv-finance_prod', count: 60 },
      { name: 'Null', count: 3 },
    ],
    job_list: [
      { jobname: 'FIN_GL_EXTRACT', last_run_date: '2026-03-24T06:00:00Z' },
      { jobname: 'FIN_AP_EXTRACT', last_run_date: '2026-03-24T06:10:00Z' },
      { jobname: 'FIN_AR_EXTRACT', last_run_date: '2026-03-24T06:20:00Z' },
      { jobname: 'FIN_GL_LOAD_DW', last_run_date: '2026-03-24T08:00:00Z' },
      { jobname: 'FIN_RECONCILE',  last_run_date: '2026-03-24T09:00:00Z' },
      { jobname: 'JSDELAY_FIN_001', last_run_date: null },
    ],
    job_run_trend: [
      { day: '2026-03-24', hour: 6,  count: 10 },
      { day: '2026-03-24', hour: 7,  count: 15 },
      { day: '2026-03-24', hour: 8,  count: 18 },
      { day: '2026-03-24', hour: 9,  count: 12 },
      { day: '2026-03-24', hour: 10, count: 8  },
      { day: '2026-03-25', hour: 6,  count: 9  },
      { day: '2026-03-25', hour: 7,  count: 14 },
      { day: '2026-03-25', hour: 8,  count: 17 },
    ],
    successor_jobs: [
      { jobname: 'FIN_GL_LOAD_DW', successor_job: 'FIN_RECONCILE' },
      { jobname: 'FIN_RECONCILE',  successor_job: 'FIN_RPT_DAILY' },
    ],
    predecessor_jobs: [
      { jobname: 'FIN_GL_EXTRACT', predecessor_job: 'SAP_EXPORT_DAILY' },
    ],
    metadata: [
      { jobname: 'FIN_GL_EXTRACT',  command: '/opt/fin/extract.sh', argument: '--ledger GL --date today' },
      { jobname: 'FIN_AP_EXTRACT',  command: '/opt/fin/extract.sh', argument: '--ledger AP --date today' },
      { jobname: 'FIN_GL_LOAD_DW',  command: '/opt/fin/load.sh',   argument: '--target finance_dw' },
      { jobname: 'JSDELAY_FIN_001', command: 'jsddelay',           argument: '120' },
    ],
  },
]

export const MOCK_ESP_APPLICATIONS = MOCK_APPS.map(a => ({ appl_name: a.appl_name }))

export function getMockAppData(applName: string): AppData | null {
  return MOCK_APPS.find(a => a.appl_name === applName) ?? null
}
