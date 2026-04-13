/**
 * Mock data for ESP Dashboard — matches the /api/esp/summary/:appl_name response schema.
 */

export interface NameCount { name: string; count: number }

export interface AppData {
  appl_name: string
  platform_id?: string
  platform_name?: string
  job_count: number
  idle_job_count: number
  spl_job_count: number
  agents: NameCount[]
  job_types: NameCount[]
  completion_codes: NameCount[]
  user_jobs: NameCount[]
  job_list: Array<{ jobname: string; last_run_date: string | null; job_type?: string | null; run_status?: string | null }>
  job_run_trend: Array<{ day: string; hour: number; job_count: number; job_fail_count: number }>
  successor_jobs: Array<{ jobname: string; successor_job: string }>
  predecessor_jobs: Array<{ jobname: string; predecessor_job: string }>
  metadata: Array<{ jobname: string; command: string | null; argument: string | null }>
  metadata_detail: Array<{ jobname: string; command: string | null; argument: string | null; agent: string | null; job_type: string | null; comp_code: string | null; runs: number | null; user_job: string | null }>
  job_run_table: Array<{ job_longname: string; command: string | null; argument: string | null; runs: number | null; start_date: string | null; start_time: string | null; end_date: string | null; end_time: string | null; exec_qtime: string | null; ccfail: string | null; comp_code: string | null }>
}

const MOCK_APPS: AppData[] = [
  {
    appl_name: 'DTDPLMET',
    platform_id: 'talend',
    platform_name: 'Talend',
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
    user_jobs: [
      { name: 'edlprd1', count: 79 },
      { name: 'Null', count: 28 },
    ],
    job_list: [
      { jobname: 'CD332400', last_run_date: '2026-03-24T10:12:00Z', job_type: 'UNIX', run_status: 'SUCCESS' },
      { jobname: 'CD332402', last_run_date: '2026-03-24T10:15:00Z', job_type: 'UNIX', run_status: 'SUCCESS' },
      { jobname: 'COMPRT_DTDOPSD57_PRD', last_run_date: '2026-03-24T11:00:00Z', job_type: 'UNIX' },
      { jobname: 'COMPRT_DTDOPSD63_PRD', last_run_date: '2026-03-24T11:05:00Z', job_type: 'UNIX', run_status: 'FAILED' },
      { jobname: 'COMPRT_DTDOPSD64_PRD', last_run_date: '2026-03-24T11:10:00Z', job_type: 'UNIX' },
      { jobname: 'COMPRT_DTDOPSD67_PRD', last_run_date: '2026-03-24T11:15:00Z', job_type: 'UNIX' },
      { jobname: 'COMPRT_DTDOPSD70_PRD', last_run_date: '2026-03-24T12:00:00Z', job_type: 'UNIX' },
      { jobname: 'COMPRT_DTDOPSD71_PRD', last_run_date: '2026-03-24T12:05:00Z', job_type: 'UNIX' },
      { jobname: 'COMPRT_DTDOPSH89_PRD', last_run_date: '2026-03-24T12:10:00Z', job_type: 'UNIX' },
      { jobname: 'DTOPSA04_PRD', last_run_date: '2026-03-24T12:15:00Z', job_type: 'UNIX' },
      { jobname: 'DTOPSA05_PRD', last_run_date: '2026-03-24T13:00:00Z', job_type: 'UNIX' },
      { jobname: 'DTOPSA06_PRD', last_run_date: '2026-03-24T13:05:00Z', job_type: 'UNIX' },
      { jobname: 'JSDELAY_DTDPLMET_001', last_run_date: null, job_type: 'MAINFRAME', run_status: 'NEVER RUN' },
      { jobname: 'RETRIG_DTDPLMET_001', last_run_date: null, job_type: 'MAINFRAME', run_status: 'NEVER RUN' },
      { jobname: 'FINMETRICS_LOAD_PRD', last_run_date: '2026-03-24T14:00:00Z', job_type: 'UNIX' },
      { jobname: 'FINMETRICS_XFORM_PRD', last_run_date: '2026-03-24T14:10:00Z', job_type: 'UNIX' },
    ],
    job_run_trend: [
      { day: '2026-03-24', hour: 8,  job_count: 6,  job_fail_count: 0 },
      { day: '2026-03-24', hour: 9,  job_count: 12, job_fail_count: 1 },
      { day: '2026-03-24', hour: 10, job_count: 21, job_fail_count: 2 },
      { day: '2026-03-24', hour: 11, job_count: 30, job_fail_count: 3 },
      { day: '2026-03-24', hour: 12, job_count: 25, job_fail_count: 1 },
      { day: '2026-03-24', hour: 13, job_count: 18, job_fail_count: 2 },
      { day: '2026-03-24', hour: 14, job_count: 14, job_fail_count: 1 },
      { day: '2026-03-24', hour: 15, job_count: 16, job_fail_count: 0 },
      { day: '2026-03-24', hour: 16, job_count: 11, job_fail_count: 1 },
      { day: '2026-03-24', hour: 17, job_count: 8,  job_fail_count: 0 },
      { day: '2026-03-25', hour: 8,  job_count: 4,  job_fail_count: 0 },
      { day: '2026-03-25', hour: 9,  job_count: 10, job_fail_count: 1 },
      { day: '2026-03-25', hour: 10, job_count: 19, job_fail_count: 2 },
      { day: '2026-03-25', hour: 11, job_count: 27, job_fail_count: 2 },
      { day: '2026-03-25', hour: 12, job_count: 22, job_fail_count: 1 },
      { day: '2026-03-25', hour: 13, job_count: 15, job_fail_count: 0 },
      { day: '2026-03-25', hour: 14, job_count: 12, job_fail_count: 1 },
      { day: '2026-03-25', hour: 15, job_count: 14, job_fail_count: 0 },
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
    metadata_detail: [
      { jobname: 'CD332400',          command: '/opt/etl/run.sh',  argument: '--env prod --app DTDPLMET',            agent: 'PRDEOLSPARKLB_V',  job_type: 'UNIX',      comp_code: '1', runs: 42,  user_job: 'edlprd1' },
      { jobname: 'CD332402',          command: '/opt/etl/run.sh',  argument: '--env prod --step 2',                  agent: 'PRDEOLSPARKLB_V',  job_type: 'UNIX',      comp_code: '1', runs: 40,  user_job: 'edlprd1' },
      { jobname: 'COMPRT_DTDOPSD57_PRD', command: 'spark-submit', argument: '--class com.company.Metrics --master yarn', agent: 'PRD_EDLCDDLBVIP', job_type: 'UNIX',   comp_code: '1', runs: 38,  user_job: 'edlprd1' },
      { jobname: 'COMPRT_DTDOPSD63_PRD', command: 'spark-submit', argument: '--class com.company.Transform --master yarn', agent: 'PRD_EDLCDDLBVIP', job_type: 'UNIX', comp_code: '1', runs: 35,  user_job: 'edlprd1' },
      { jobname: 'COMPRT_DTDOPSD64_PRD', command: 'spark-submit', argument: '--class com.company.Load --master yarn',    agent: 'PRD_EDLCDDLBVIP', job_type: 'UNIX',   comp_code: '2', runs: 35,  user_job: 'edlprd1' },
      { jobname: 'JSDELAY_DTDPLMET_001', command: 'jsddelay',     argument: '300',                                  agent: null,               job_type: 'MAINFRAME', comp_code: '1', runs: 100, user_job: null },
      { jobname: 'RETRIG_DTDPLMET_001',  command: 'retrig',       argument: '--job COMPRT_DTDOPSD57_PRD',           agent: null,               job_type: 'MAINFRAME', comp_code: '1', runs: 5,   user_job: null },
      { jobname: 'FINMETRICS_LOAD_PRD',  command: '/opt/etl/load.sh', argument: '--env prod',                      agent: 'PRDEOLSPARKLB_V',  job_type: 'UNIX',      comp_code: '1', runs: 28,  user_job: 'edlprd1' },
    ],
    job_run_table: [
      { job_longname: 'CD332400',          command: '/opt/etl/run.sh',  argument: '--env prod --app DTDPLMET',            runs: 42, start_date: '2026-03-25', start_time: '08:01:00', end_date: '2026-03-25', end_time: '08:12:00', exec_qtime: '00:11:00', ccfail: 'NO',  comp_code: '1' },
      { job_longname: 'CD332402',          command: '/opt/etl/run.sh',  argument: '--env prod --step 2',                  runs: 40, start_date: '2026-03-25', start_time: '08:13:00', end_date: '2026-03-25', end_time: '08:22:00', exec_qtime: '00:09:00', ccfail: 'NO',  comp_code: '1' },
      { job_longname: 'COMPRT_DTDOPSD57_PRD', command: 'spark-submit', argument: '--class com.company.Metrics',          runs: 38, start_date: '2026-03-25', start_time: '09:00:00', end_date: '2026-03-25', end_time: '09:45:00', exec_qtime: '00:45:00', ccfail: 'NO',  comp_code: '1' },
      { job_longname: 'COMPRT_DTDOPSD63_PRD', command: 'spark-submit', argument: '--class com.company.Transform',        runs: 35, start_date: '2026-03-25', start_time: '10:00:00', end_date: '2026-03-25', end_time: '10:50:00', exec_qtime: '00:50:00', ccfail: 'YES', comp_code: '2' },
      { job_longname: 'FINMETRICS_LOAD_PRD',  command: '/opt/etl/load.sh', argument: '--env prod',                      runs: 28, start_date: '2026-03-25', start_time: '14:00:00', end_date: '2026-03-25', end_time: '14:30:00', exec_qtime: '00:30:00', ccfail: 'NO',  comp_code: '1' },
      { job_longname: 'FINMETRICS_XFORM_PRD', command: '/opt/etl/load.sh', argument: '--env prod --xform',              runs: 27, start_date: '2026-03-25', start_time: '14:31:00', end_date: '2026-03-25', end_time: '15:00:00', exec_qtime: '00:29:00', ccfail: 'NO',  comp_code: '1' },
    ],
  },
  {
    appl_name: 'CUSTOMER_360',
    platform_id: 'talend',
    platform_name: 'Talend',
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
    user_jobs: [
      { name: 'cust360', count: 70 },
      { name: 'Null', count: 18 },
    ],
    job_list: [
      { jobname: 'CUST360_EXTRACT_01', last_run_date: '2026-03-24T09:00:00Z', job_type: 'UNIX', run_status: 'SUCCESS' },
      { jobname: 'CUST360_EXTRACT_02', last_run_date: '2026-03-24T09:10:00Z', job_type: 'UNIX' },
      { jobname: 'CUST360_TRANSFORM_01', last_run_date: '2026-03-24T10:00:00Z', job_type: 'UNIX' },
      { jobname: 'CUST360_LOAD_DW', last_run_date: '2026-03-24T11:30:00Z', job_type: 'UNIX', run_status: 'FAILED' },
      { jobname: 'CUST360_VALIDATE', last_run_date: '2026-03-24T12:00:00Z', job_type: 'MAINFRAME' },
      { jobname: 'JSDELAY_CUST360_001', last_run_date: null, job_type: 'MAINFRAME', run_status: 'NEVER RUN' },
      { jobname: 'RETRIG_CUST360_001', last_run_date: null, job_type: 'MAINFRAME', run_status: 'NEVER RUN' },
    ],
    job_run_trend: [
      { day: '2026-03-24', hour: 9,  job_count: 7,  job_fail_count: 0 },
      { day: '2026-03-24', hour: 10, job_count: 12, job_fail_count: 1 },
      { day: '2026-03-24', hour: 11, job_count: 15, job_fail_count: 2 },
      { day: '2026-03-24', hour: 12, job_count: 14, job_fail_count: 1 },
      { day: '2026-03-24', hour: 13, job_count: 13, job_fail_count: 0 },
      { day: '2026-03-24', hour: 14, job_count: 11, job_fail_count: 1 },
      { day: '2026-03-24', hour: 15, job_count: 9,  job_fail_count: 0 },
      { day: '2026-03-25', hour: 9,  job_count: 6,  job_fail_count: 0 },
      { day: '2026-03-25', hour: 10, job_count: 11, job_fail_count: 1 },
      { day: '2026-03-25', hour: 11, job_count: 13, job_fail_count: 0 },
      { day: '2026-03-25', hour: 12, job_count: 10, job_fail_count: 1 },
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
    metadata_detail: [
      { jobname: 'CUST360_EXTRACT_01',   command: '/opt/cust/extract.sh',  argument: '--src crm --env prod',      agent: 'PRD_CUST360_AGENT', job_type: 'UNIX',      comp_code: '1', runs: 30, user_job: 'cust360' },
      { jobname: 'CUST360_EXTRACT_02',   command: '/opt/cust/extract.sh',  argument: '--src web --env prod',      agent: 'PRD_CUST360_AGENT', job_type: 'UNIX',      comp_code: '1', runs: 28, user_job: 'cust360' },
      { jobname: 'CUST360_TRANSFORM_01', command: 'spark-submit',          argument: '--class com.cust.Transform', agent: 'PRD_CUST360_AGENT', job_type: 'UNIX',      comp_code: '1', runs: 25, user_job: 'cust360' },
      { jobname: 'CUST360_LOAD_DW',      command: '/opt/cust/load.sh',     argument: '--target dw --env prod',    agent: 'PRD_CUST360_AGENT', job_type: 'UNIX',      comp_code: '2', runs: 22, user_job: 'cust360' },
      { jobname: 'CUST360_VALIDATE',     command: '/opt/cust/validate.sh', argument: '--env prod',                agent: null,                job_type: 'MAINFRAME', comp_code: '1', runs: 20, user_job: null },
      { jobname: 'JSDELAY_CUST360_001',  command: 'jsddelay',              argument: '600',                       agent: null,                job_type: 'MAINFRAME', comp_code: '1', runs: 88, user_job: null },
    ],
    job_run_table: [
      { job_longname: 'CUST360_EXTRACT_01',   command: '/opt/cust/extract.sh',  argument: '--src crm --env prod',      runs: 30, start_date: '2026-03-25', start_time: '09:00:00', end_date: '2026-03-25', end_time: '09:15:00', exec_qtime: '00:15:00', ccfail: 'NO',  comp_code: '1' },
      { job_longname: 'CUST360_EXTRACT_02',   command: '/opt/cust/extract.sh',  argument: '--src web --env prod',      runs: 28, start_date: '2026-03-25', start_time: '09:16:00', end_date: '2026-03-25', end_time: '09:28:00', exec_qtime: '00:12:00', ccfail: 'NO',  comp_code: '1' },
      { job_longname: 'CUST360_TRANSFORM_01', command: 'spark-submit',          argument: '--class com.cust.Transform', runs: 25, start_date: '2026-03-25', start_time: '10:00:00', end_date: '2026-03-25', end_time: '10:40:00', exec_qtime: '00:40:00', ccfail: 'YES', comp_code: '2' },
      { job_longname: 'CUST360_LOAD_DW',      command: '/opt/cust/load.sh',     argument: '--target dw --env prod',    runs: 22, start_date: '2026-03-25', start_time: '11:00:00', end_date: '2026-03-25', end_time: '11:30:00', exec_qtime: '00:30:00', ccfail: 'NO',  comp_code: '1' },
      { job_longname: 'CUST360_VALIDATE',     command: '/opt/cust/validate.sh', argument: '--env prod',                runs: 20, start_date: '2026-03-25', start_time: '11:31:00', end_date: '2026-03-25', end_time: '11:45:00', exec_qtime: '00:14:00', ccfail: 'NO',  comp_code: '1' },
    ],
  },
  {
    appl_name: 'FINANCE_ETL',
    platform_id: 'ppcm',
    platform_name: 'PPCM',
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
    user_jobs: [
      { name: 'finprd', count: 60 },
      { name: 'Null', count: 3 },
    ],
    job_list: [
      { jobname: 'FIN_GL_EXTRACT', last_run_date: '2026-03-24T06:00:00Z', job_type: 'UNIX', run_status: 'SUCCESS' },
      { jobname: 'FIN_AP_EXTRACT', last_run_date: '2026-03-24T06:10:00Z', job_type: 'UNIX' },
      { jobname: 'FIN_AR_EXTRACT', last_run_date: '2026-03-24T06:20:00Z', job_type: 'UNIX', run_status: 'FAILED' },
      { jobname: 'FIN_GL_LOAD_DW', last_run_date: '2026-03-24T08:00:00Z', job_type: 'UNIX' },
      { jobname: 'FIN_RECONCILE',  last_run_date: '2026-03-24T09:00:00Z', job_type: 'MAINFRAME' },
      { jobname: 'JSDELAY_FIN_001', last_run_date: null, job_type: 'MAINFRAME', run_status: 'NEVER RUN' },
    ],
    job_run_trend: [
      { day: '2026-03-24', hour: 6,  job_count: 10, job_fail_count: 1 },
      { day: '2026-03-24', hour: 7,  job_count: 15, job_fail_count: 2 },
      { day: '2026-03-24', hour: 8,  job_count: 18, job_fail_count: 1 },
      { day: '2026-03-24', hour: 9,  job_count: 12, job_fail_count: 0 },
      { day: '2026-03-24', hour: 10, job_count: 8,  job_fail_count: 1 },
      { day: '2026-03-25', hour: 6,  job_count: 9,  job_fail_count: 0 },
      { day: '2026-03-25', hour: 7,  job_count: 14, job_fail_count: 1 },
      { day: '2026-03-25', hour: 8,  job_count: 17, job_fail_count: 2 },
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
    metadata_detail: [
      { jobname: 'FIN_GL_EXTRACT',  command: '/opt/fin/extract.sh', argument: '--ledger GL --date today', agent: 'PRD_FIN_AGENT_01', job_type: 'UNIX',      comp_code: '1', runs: 55, user_job: 'finprd' },
      { jobname: 'FIN_AP_EXTRACT',  command: '/opt/fin/extract.sh', argument: '--ledger AP --date today', agent: 'PRD_FIN_AGENT_01', job_type: 'UNIX',      comp_code: '1', runs: 52, user_job: 'finprd' },
      { jobname: 'FIN_AR_EXTRACT',  command: '/opt/fin/extract.sh', argument: '--ledger AR --date today', agent: 'PRD_FIN_AGENT_02', job_type: 'UNIX',      comp_code: '2', runs: 48, user_job: 'finprd' },
      { jobname: 'FIN_GL_LOAD_DW',  command: '/opt/fin/load.sh',   argument: '--target finance_dw',      agent: 'PRD_FIN_AGENT_02', job_type: 'UNIX',      comp_code: '1', runs: 45, user_job: 'finprd' },
      { jobname: 'FIN_RECONCILE',   command: '/opt/fin/recon.sh',  argument: '--env prod',               agent: null,               job_type: 'MAINFRAME', comp_code: '1', runs: 40, user_job: null },
      { jobname: 'JSDELAY_FIN_001', command: 'jsddelay',           argument: '120',                      agent: null,               job_type: 'MAINFRAME', comp_code: '1', runs: 63, user_job: null },
    ],
    job_run_table: [
      { job_longname: 'FIN_GL_EXTRACT', command: '/opt/fin/extract.sh', argument: '--ledger GL --date today', runs: 55, start_date: '2026-03-25', start_time: '06:00:00', end_date: '2026-03-25', end_time: '06:20:00', exec_qtime: '00:20:00', ccfail: 'NO',  comp_code: '1' },
      { job_longname: 'FIN_AP_EXTRACT', command: '/opt/fin/extract.sh', argument: '--ledger AP --date today', runs: 52, start_date: '2026-03-25', start_time: '06:21:00', end_date: '2026-03-25', end_time: '06:38:00', exec_qtime: '00:17:00', ccfail: 'NO',  comp_code: '1' },
      { job_longname: 'FIN_AR_EXTRACT', command: '/opt/fin/extract.sh', argument: '--ledger AR --date today', runs: 48, start_date: '2026-03-25', start_time: '06:39:00', end_date: '2026-03-25', end_time: '06:55:00', exec_qtime: '00:16:00', ccfail: 'YES', comp_code: '2' },
      { job_longname: 'FIN_GL_LOAD_DW', command: '/opt/fin/load.sh',   argument: '--target finance_dw',      runs: 45, start_date: '2026-03-25', start_time: '08:00:00', end_date: '2026-03-25', end_time: '08:35:00', exec_qtime: '00:35:00', ccfail: 'NO',  comp_code: '1' },
      { job_longname: 'FIN_RECONCILE',  command: '/opt/fin/recon.sh',  argument: '--env prod',               runs: 40, start_date: '2026-03-25', start_time: '09:00:00', end_date: '2026-03-25', end_time: '09:20:00', exec_qtime: '00:20:00', ccfail: 'NO',  comp_code: '1' },
    ],
  },
]

export const MOCK_ESP_APPLICATIONS = MOCK_APPS.map(a => ({
  appl_name: a.appl_name,
  platform_id: a.platform_id ?? null,
  platform_name: a.platform_name ?? null,
}))

export const MOCK_ESP_PLATFORMS = Array.from(
  new Map(
    MOCK_APPS
      .filter((app) => app.platform_id && app.platform_name)
      .map((app) => [app.platform_id, { platform_id: app.platform_id!, platform_name: app.platform_name! }]),
  ).values(),
)

// platform-summary response shape — `platform` is now platform_id (keys column),
// `platform_name` is the human-readable name shown on hover
export const MOCK_ESP_PLATFORM_SUMMARY = MOCK_ESP_PLATFORMS.map((platform) => {
  const apps = MOCK_APPS.filter((app) => app.platform_id === platform.platform_id)
  return {
    platform: platform.platform_id,
    platform_name: platform.platform_name,
    total: apps.reduce((sum, app) => sum + app.job_count, 0),
    idle: apps.reduce((sum, app) => sum + app.idle_job_count, 0),
    special: apps.reduce((sum, app) => sum + app.spl_job_count, 0),
    app_count: apps.length,
  }
})

/** Mirrors the /api/esp/job-counts response shape: [{appl_name, total_jobs}] */
export const MOCK_ESP_JOB_COUNTS = MOCK_APPS.map(a => ({ appl_name: a.appl_name, total_jobs: a.job_count }))

export function getMockAppData(applName: string): AppData | null {
  return MOCK_APPS.find(a => a.appl_name === applName) ?? null
}

export function getMockPlatformApplications(platformId: string): string[] {
  return MOCK_APPS
    .filter((app) => app.platform_id === platformId)
    .map((app) => app.appl_name)
    .sort((left, right) => left.localeCompare(right))
}

export function getMockPlatformData(platformId: string): AppData | null {
  const apps = MOCK_APPS.filter((app) => app.platform_id === platformId)
  if (apps.length === 0) return null

  const [firstApp] = apps

  const aggregateCounts = (pick: (app: AppData) => NameCount[]) => {
    const counts = new Map<string, number>()
    apps.forEach((app) => {
      pick(app).forEach((item) => {
        counts.set(item.name, (counts.get(item.name) ?? 0) + item.count)
      })
    })
    return Array.from(counts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((left, right) => right.count - left.count)
  }

  const trendCounts = new Map<string, { day: string; hour: number; job_count: number; job_fail_count: number }>()
  apps.forEach((app) => {
    app.job_run_trend.forEach((row) => {
      const key = `${row.day}_${row.hour}`
      const existing = trendCounts.get(key)
      if (existing) {
        existing.job_count += row.job_count
        existing.job_fail_count += row.job_fail_count
      } else {
        trendCounts.set(key, { ...row })
      }
    })
  })

  return {
    appl_name: firstApp.platform_name ?? firstApp.appl_name,
    platform_id: firstApp.platform_id,
    platform_name: firstApp.platform_name,
    job_count: apps.reduce((sum, app) => sum + app.job_count, 0),
    idle_job_count: apps.reduce((sum, app) => sum + app.idle_job_count, 0),
    spl_job_count: apps.reduce((sum, app) => sum + app.spl_job_count, 0),
    agents: aggregateCounts((app) => app.agents),
    job_types: aggregateCounts((app) => app.job_types),
    completion_codes: aggregateCounts((app) => app.completion_codes),
    user_jobs: aggregateCounts((app) => app.user_jobs),
    job_list: apps.flatMap((app) => app.job_list.map((job) => ({ ...job, appl_name: app.appl_name }))),
    job_run_trend: Array.from(trendCounts.values()).sort((left, right) => {
      const dayCompare = left.day.localeCompare(right.day)
      return dayCompare !== 0 ? dayCompare : left.hour - right.hour
    }),
    successor_jobs: apps.flatMap((app) => app.successor_jobs),
    predecessor_jobs: apps.flatMap((app) => app.predecessor_jobs),
    metadata: apps.flatMap((app) => app.metadata),
    metadata_detail: apps.flatMap((app) => app.metadata_detail),
    job_run_table: apps.flatMap((app) => app.job_run_table),
  }
}
