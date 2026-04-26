/**
 * ServiceNow mock data — mirrors live API response shapes.
 * Source table: edoops.service_now_inc joined with edoops.sla_glossary
 */

export const MOCK_SERVICENOW_TICKETS = [
  {
    id: 'INC0012345',
    title: 'BI Platform ETL pipeline failure impacting reporting',
    priority: 'P1',
    status: 'open',
    assignee: 'John Smith',
    affectedService: 'BI Reporting',
    sla: { breached: true },
  },
  {
    id: 'INC0012301',
    title: 'Data warehouse refresh delayed by 4+ hours',
    priority: 'P1',
    status: 'in_progress',
    assignee: 'Maria Garcia',
    affectedService: 'Data Warehouse',
    sla: { breached: true },
  },
  {
    id: 'INC0012289',
    title: 'Snowflake query timeout affecting dashboards',
    priority: 'P2',
    status: 'in_progress',
    assignee: 'David Lee',
    affectedService: 'Analytics Platform',
    sla: { breached: false },
  },
]

// Query 1: Open incident counts by priority (service_now_inc + sla_glossary)
export const MOCK_SERVICENOW_INCIDENTS = [
  { priority_field: 'P1', incident_count: 3 },
  { priority_field: 'P2', incident_count: 5 },
  { priority_field: 'P3', incident_count: 8 },
  { priority_field: 'P4', incident_count: 14 },
  { priority_field: 'P5', incident_count: 21 },
]

// Query 2: P3/P4 open ("missed") incident counts — bar chart
export const MOCK_SERVICENOW_MISSED_INCIDENTS = [
  { priority_field: 'P1', incident_count: 3, breached_count: 2, response_sla: '1 Hr',  resolution_sla: '4 Hrs', details_url: 'https://example.local/sla/p1' },
  { priority_field: 'P2', incident_count: 5, breached_count: 3, response_sla: '2 Hrs', resolution_sla: '8 Hrs', details_url: 'https://example.local/sla/p2' },
  { priority_field: 'P3', incident_count: 8, breached_count: 4, response_sla: '4 Hrs',  resolution_sla: '2 Days', details_url: 'https://example.local/sla/p3' },
  { priority_field: 'P4', incident_count: 14, breached_count: 6, response_sla: '8 Hrs',  resolution_sla: '5 Days', details_url: 'https://example.local/sla/p4' },
  { priority_field: 'P5', incident_count: 21, breached_count: 0, response_sla: '24 Hrs', resolution_sla: '10 Days', details_url: 'https://example.local/sla/p5' },
]

// Query 3: Detailed P3/P4 incident list (used by IncidentListWidget)
export const MOCK_SERVICENOW_INCIDENT_LIST = [
  { sninc_inc_num: 'INC0089001', priority_field: 'P1', sninc_state: 'In Progress',  sninc_capability: 'BI Reporting',      sninc_short_desc: 'Critical ETL pipeline failure: BI reports stale for 6+ hours',      sninc_assignment_grp: 'DataOps Platform'   },
  { sninc_inc_num: 'INC0089002', priority_field: 'P1', sninc_state: 'In Progress',  sninc_capability: 'Data Warehouse',    sninc_short_desc: 'Snowflake cluster unavailable — all downstream queries failing',      sninc_assignment_grp: 'Cloud Analytics'    },
  { sninc_inc_num: 'INC0089003', priority_field: 'P1', sninc_state: 'New',          sninc_capability: 'Data Integration',  sninc_short_desc: 'Full data ingestion pipeline down — DMF run status: FAILED',          sninc_assignment_grp: 'DataOps Platform'   },
  { sninc_inc_num: 'INC0089021', priority_field: 'P2', sninc_state: 'In Progress',  sninc_capability: 'ESP Scheduler',     sninc_short_desc: 'ESP batch window overrun by 2h — 12 jobs pending execution',          sninc_assignment_grp: 'DataOps Platform'   },
  { sninc_inc_num: 'INC0089022', priority_field: 'P2', sninc_state: 'Resolved',     sninc_capability: 'BI Reporting',      sninc_short_desc: 'Dashboard refresh rate degraded — Snowflake query cache stale',        sninc_assignment_grp: 'Cloud Analytics'    },
  { sninc_inc_num: 'INC0089023', priority_field: 'P2', sninc_state: 'Closed',       sninc_capability: 'Data Integration',  sninc_short_desc: 'Talend remote engine disconnected — 4 jobs stuck in running state',    sninc_assignment_grp: 'DataOps Platform'   },
  { sninc_inc_num: 'INC0089024', priority_field: 'P2', sninc_state: 'In Progress',  sninc_capability: 'Database Layer',    sninc_short_desc: 'PostgreSQL connection pool at 95% capacity during peak hours',         sninc_assignment_grp: 'Database Team'      },
  { sninc_inc_num: 'INC0089025', priority_field: 'P2', sninc_state: 'Resolved',     sninc_capability: 'Monitoring',        sninc_short_desc: 'CloudWatch alert suppressed — missed batch latency spike overnight',    sninc_assignment_grp: 'Platform Ops'       },
  { sninc_inc_num: 'INC0089101', priority_field: 'P3', sninc_state: 'New',          sninc_capability: 'BI Reporting',      sninc_short_desc: 'DMF batch job step failure in nightly ingestion run',                  sninc_assignment_grp: 'DataOps Platform'   },
  { sninc_inc_num: 'INC0089102', priority_field: 'P3', sninc_state: 'In Progress',  sninc_capability: 'Data Integration',  sninc_short_desc: 'Talend job timeout on ESP scheduler queue — retry exhausted',          sninc_assignment_grp: 'DataOps Platform'   },
  { sninc_inc_num: 'INC0089103', priority_field: 'P3', sninc_state: 'Closed',       sninc_capability: 'ESP Scheduler',     sninc_short_desc: 'ESP scheduled jobs missed overnight window (3 jobs skipped)',          sninc_assignment_grp: 'DataOps Platform'   },
  { sninc_inc_num: 'INC0089104', priority_field: 'P3', sninc_state: 'Resolved',     sninc_capability: 'BI Reporting',      sninc_short_desc: 'Snowflake query latency above SLA threshold for BI reports',           sninc_assignment_grp: 'Cloud Analytics'    },
  { sninc_inc_num: 'INC0089105', priority_field: 'P3', sninc_state: 'In Progress',  sninc_capability: 'Data Integration',  sninc_short_desc: 'PostgreSQL connection pool exhausted during peak load',                 sninc_assignment_grp: 'Database Team'      },
  { sninc_inc_num: 'INC0089106', priority_field: 'P3', sninc_state: 'New',          sninc_capability: 'DMF Orchestration', sninc_short_desc: 'DMF enrichment step failed for BIUK source dataset',                   sninc_assignment_grp: 'DataOps Platform'   },
  { sninc_inc_num: 'INC0089107', priority_field: 'P3', sninc_state: 'Closed',       sninc_capability: 'Monitoring',        sninc_short_desc: 'CloudWatch alarm misconfigured — batch latency not alerting',          sninc_assignment_grp: 'Platform Ops'       },
  { sninc_inc_num: 'INC0089108', priority_field: 'P3', sninc_state: 'Resolved',     sninc_capability: 'BI Reporting',      sninc_short_desc: 'Report render timeout on Executive Dashboard for date range >90d',      sninc_assignment_grp: 'BI Dev Team'        },
  { sninc_inc_num: 'INC0089109', priority_field: 'P4', sninc_state: 'Closed',       sninc_capability: 'Data Integration',  sninc_short_desc: 'Talend log table growing beyond expected partition size',               sninc_assignment_grp: 'DataOps Platform'   },
  { sninc_inc_num: 'INC0089110', priority_field: 'P4', sninc_state: 'In Progress',  sninc_capability: 'ESP Scheduler',     sninc_short_desc: 'ESP calendar definition missing holiday exception for Q2',             sninc_assignment_grp: 'DataOps Platform'   },
  { sninc_inc_num: 'INC0089111', priority_field: 'P4', sninc_state: 'Resolved',     sninc_capability: 'BI Reporting',      sninc_short_desc: 'Minor discrepancy in weekly KPI rollup figures (< 0.1%)',               sninc_assignment_grp: 'BI Dev Team'        },
  { sninc_inc_num: 'INC0089112', priority_field: 'P4', sninc_state: 'Closed',       sninc_capability: 'Monitoring',        sninc_short_desc: 'Grafana dashboard stale after Prometheus scrape interval change',       sninc_assignment_grp: 'Platform Ops'       },
  { sninc_inc_num: 'INC0089113', priority_field: 'P4', sninc_state: 'New',          sninc_capability: 'DMF Orchestration', sninc_short_desc: 'DMF lineage metadata not refreshed after schema change',                sninc_assignment_grp: 'DataOps Platform'   },
  { sninc_inc_num: 'INC0089114', priority_field: 'P4', sninc_state: 'Resolved',     sninc_capability: 'Cloud Analytics',   sninc_short_desc: 'Snowflake credit usage 12% over forecast for the billing period',       sninc_assignment_grp: 'Cloud Analytics'    },
  { sninc_inc_num: 'INC0089115', priority_field: 'P5', sninc_state: 'Closed',       sninc_capability: 'Documentation',     sninc_short_desc: 'Wiki article for DMF lineage process is outdated',                     sninc_assignment_grp: 'DataOps Platform'   },
  { sninc_inc_num: 'INC0089116', priority_field: 'P5', sninc_state: 'Resolved',     sninc_capability: 'BI Reporting',      sninc_short_desc: 'Request to add new bookmark folder in BI portal',                      sninc_assignment_grp: 'BI Dev Team'        },
  { sninc_inc_num: 'INC0089117', priority_field: 'P5', sninc_state: 'Closed',       sninc_capability: 'Monitoring',        sninc_short_desc: 'Update Grafana panel title to match new naming convention',             sninc_assignment_grp: 'Platform Ops'       },
]

// Incident trend mock — daily open vs closed counts for the last 7 days
export const MOCK_SERVICENOW_INCIDENT_TREND = (() => {
  const today = new Date()
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today)
    d.setDate(d.getDate() - (6 - i))
    const day = d.toISOString().split('T')[0]
    const open   = Math.floor(Math.random() * 8) + 3
    const closed = Math.floor(Math.random() * 10) + 2
    const total = open + closed
    const p1p2 = Math.min(total, Math.floor(total * (0.12 + Math.random() * 0.18)))
    return { day, open, closed, p1p2, total }
  })
})()

// Incident detail records covering all priorities P1–P5 (used by drill-down modal)
export const MOCK_SN_INCIDENT_DETAIL = [
  // P1
  { sninc_inc_num: 'INC0089001', priority_field: 'P1', sninc_capability: 'BI Reporting',      sninc_short_desc: 'Critical ETL pipeline failure: BI reports stale for 6+ hours',      sninc_assignment_grp: 'DataOps Platform',  response_sla: '1 Hr',  resolution_sla: '4 Hrs', sninc_opened_at: new Date(Date.now() - 5 * 3600000).toISOString(), sninc_last_updt_dttm: new Date(Date.now() - 1 * 3600000).toISOString(), elapsed_hours: 5, sla_breached: true },
  { sninc_inc_num: 'INC0089002', priority_field: 'P1', sninc_capability: 'Data Warehouse',    sninc_short_desc: 'Snowflake cluster unavailable — all downstream queries failing',     sninc_assignment_grp: 'Cloud Analytics',   response_sla: '1 Hr',  resolution_sla: '4 Hrs', sninc_opened_at: new Date(Date.now() - 3 * 3600000).toISOString(), sninc_last_updt_dttm: new Date(Date.now() - 0.5 * 3600000).toISOString(), elapsed_hours: 3, sla_breached: false },
  { sninc_inc_num: 'INC0089003', priority_field: 'P1', sninc_capability: 'Data Integration',  sninc_short_desc: 'Full data ingestion pipeline down — DMF run status: FAILED',         sninc_assignment_grp: 'DataOps Platform',  response_sla: '1 Hr',  resolution_sla: '4 Hrs', sninc_opened_at: new Date(Date.now() - 6 * 3600000).toISOString(), sninc_last_updt_dttm: new Date(Date.now() - 2 * 3600000).toISOString(), elapsed_hours: 6, sla_breached: true },
  // P2
  { sninc_inc_num: 'INC0089021', priority_field: 'P2', sninc_capability: 'ESP Scheduler',     sninc_short_desc: 'ESP batch window overrun by 2h — 12 jobs pending execution',         sninc_assignment_grp: 'DataOps Platform',  response_sla: '2 Hrs', resolution_sla: '8 Hrs', sninc_opened_at: new Date(Date.now() - 9 * 3600000).toISOString(), sninc_last_updt_dttm: new Date(Date.now() - 3 * 3600000).toISOString(), elapsed_hours: 9, sla_breached: true },
  { sninc_inc_num: 'INC0089022', priority_field: 'P2', sninc_capability: 'BI Reporting',      sninc_short_desc: 'Dashboard refresh rate degraded — Snowflake query cache stale',      sninc_assignment_grp: 'Cloud Analytics',   response_sla: '2 Hrs', resolution_sla: '8 Hrs', sninc_opened_at: new Date(Date.now() - 6 * 3600000).toISOString(), sninc_last_updt_dttm: new Date(Date.now() - 1 * 3600000).toISOString(), elapsed_hours: 6, sla_breached: false },
  { sninc_inc_num: 'INC0089023', priority_field: 'P2', sninc_capability: 'Data Integration',  sninc_short_desc: 'Talend remote engine disconnected — 4 jobs stuck in running state',  sninc_assignment_grp: 'DataOps Platform',  response_sla: '2 Hrs', resolution_sla: '8 Hrs', sninc_opened_at: new Date(Date.now() - 7 * 3600000).toISOString(), sninc_last_updt_dttm: new Date(Date.now() - 2 * 3600000).toISOString(), elapsed_hours: 7, sla_breached: false },
  { sninc_inc_num: 'INC0089024', priority_field: 'P2', sninc_capability: 'Database Layer',    sninc_short_desc: 'PostgreSQL connection pool at 95% capacity during peak hours',       sninc_assignment_grp: 'Database Team',     response_sla: '2 Hrs', resolution_sla: '8 Hrs', sninc_opened_at: new Date(Date.now() - 10 * 3600000).toISOString(), sninc_last_updt_dttm: new Date(Date.now() - 4 * 3600000).toISOString(), elapsed_hours: 10, sla_breached: true },
  { sninc_inc_num: 'INC0089025', priority_field: 'P2', sninc_capability: 'Monitoring',        sninc_short_desc: 'CloudWatch alert suppressed — missed batch latency spike overnight', sninc_assignment_grp: 'Platform Ops',      response_sla: '2 Hrs', resolution_sla: '8 Hrs', sninc_opened_at: new Date(Date.now() - 4 * 3600000).toISOString(), sninc_last_updt_dttm: new Date(Date.now() - 0.5 * 3600000).toISOString(), elapsed_hours: 4, sla_breached: false },
  // P3
  { sninc_inc_num: 'INC0089101', priority_field: 'P3', sninc_capability: 'BI Reporting',      sninc_short_desc: 'DMF batch job step failure in nightly ingestion run',                sninc_assignment_grp: 'DataOps Platform',  response_sla: '4 Hrs', resolution_sla: '2 Days', sninc_opened_at: new Date(Date.now() - 12 * 3600000).toISOString(), sninc_last_updt_dttm: new Date(Date.now() - 5 * 3600000).toISOString(), elapsed_hours: 12, sla_breached: false },
  { sninc_inc_num: 'INC0089102', priority_field: 'P3', sninc_capability: 'Data Integration',  sninc_short_desc: 'Talend job timeout on ESP scheduler queue — retry exhausted',        sninc_assignment_grp: 'DataOps Platform',  response_sla: '4 Hrs', resolution_sla: '2 Days', sninc_opened_at: new Date(Date.now() - 30 * 3600000).toISOString(), sninc_last_updt_dttm: new Date(Date.now() - 10 * 3600000).toISOString(), elapsed_hours: 30, sla_breached: true },
  { sninc_inc_num: 'INC0089103', priority_field: 'P3', sninc_capability: 'ESP Scheduler',     sninc_short_desc: 'ESP scheduled jobs missed overnight window (3 jobs skipped)',        sninc_assignment_grp: 'DataOps Platform',  response_sla: '4 Hrs', resolution_sla: '2 Days', sninc_opened_at: new Date(Date.now() - 18 * 3600000).toISOString(), sninc_last_updt_dttm: new Date(Date.now() - 8 * 3600000).toISOString(), elapsed_hours: 18, sla_breached: false },
  { sninc_inc_num: 'INC0089104', priority_field: 'P3', sninc_capability: 'BI Reporting',      sninc_short_desc: 'Snowflake query latency above SLA threshold for BI reports',         sninc_assignment_grp: 'Cloud Analytics',   response_sla: '4 Hrs', resolution_sla: '2 Days', sninc_opened_at: new Date(Date.now() - 25 * 3600000).toISOString(), sninc_last_updt_dttm: new Date(Date.now() - 12 * 3600000).toISOString(), elapsed_hours: 25, sla_breached: true },
  { sninc_inc_num: 'INC0089105', priority_field: 'P3', sninc_capability: 'Data Integration',  sninc_short_desc: 'PostgreSQL connection pool exhausted during peak load',               sninc_assignment_grp: 'Database Team',     response_sla: '4 Hrs', resolution_sla: '2 Days', sninc_opened_at: new Date(Date.now() - 8 * 3600000).toISOString(), sninc_last_updt_dttm: new Date(Date.now() - 2 * 3600000).toISOString(), elapsed_hours: 8, sla_breached: false },
  { sninc_inc_num: 'INC0089106', priority_field: 'P3', sninc_capability: 'DMF Orchestration', sninc_short_desc: 'DMF enrichment step failed for BIUK source dataset',                 sninc_assignment_grp: 'DataOps Platform',  response_sla: '4 Hrs', resolution_sla: '2 Days', sninc_opened_at: new Date(Date.now() - 40 * 3600000).toISOString(), sninc_last_updt_dttm: new Date(Date.now() - 15 * 3600000).toISOString(), elapsed_hours: 40, sla_breached: true },
  { sninc_inc_num: 'INC0089107', priority_field: 'P3', sninc_capability: 'Monitoring',        sninc_short_desc: 'CloudWatch alarm misconfigured — batch latency not alerting',        sninc_assignment_grp: 'Platform Ops',      response_sla: '4 Hrs', resolution_sla: '2 Days', sninc_opened_at: new Date(Date.now() - 6 * 3600000).toISOString(), sninc_last_updt_dttm: new Date(Date.now() - 1 * 3600000).toISOString(), elapsed_hours: 6, sla_breached: false },
  { sninc_inc_num: 'INC0089108', priority_field: 'P3', sninc_capability: 'BI Reporting',      sninc_short_desc: 'Report render timeout on Executive Dashboard for date range >90d',   sninc_assignment_grp: 'BI Dev Team',       response_sla: '4 Hrs', resolution_sla: '2 Days', sninc_opened_at: new Date(Date.now() - 35 * 3600000).toISOString(), sninc_last_updt_dttm: new Date(Date.now() - 14 * 3600000).toISOString(), elapsed_hours: 35, sla_breached: true },
  // P4
  { sninc_inc_num: 'INC0089109', priority_field: 'P4', sninc_capability: 'Data Integration',  sninc_short_desc: 'Talend log table growing beyond expected partition size',              sninc_assignment_grp: 'DataOps Platform',  response_sla: '8 Hrs', resolution_sla: '5 Days', sninc_opened_at: new Date(Date.now() - 48 * 3600000).toISOString(), sninc_last_updt_dttm: new Date(Date.now() - 20 * 3600000).toISOString(), elapsed_hours: 48, sla_breached: false },
  { sninc_inc_num: 'INC0089110', priority_field: 'P4', sninc_capability: 'ESP Scheduler',     sninc_short_desc: 'ESP calendar definition missing holiday exception for Q2',            sninc_assignment_grp: 'DataOps Platform',  response_sla: '8 Hrs', resolution_sla: '5 Days', sninc_opened_at: new Date(Date.now() - 72 * 3600000).toISOString(), sninc_last_updt_dttm: new Date(Date.now() - 30 * 3600000).toISOString(), elapsed_hours: 72, sla_breached: false },
  { sninc_inc_num: 'INC0089111', priority_field: 'P4', sninc_capability: 'BI Reporting',      sninc_short_desc: 'Minor discrepancy in weekly KPI rollup figures (< 0.1%)',             sninc_assignment_grp: 'BI Dev Team',       response_sla: '8 Hrs', resolution_sla: '5 Days', sninc_opened_at: new Date(Date.now() - 36 * 3600000).toISOString(), sninc_last_updt_dttm: new Date(Date.now() - 14 * 3600000).toISOString(), elapsed_hours: 36, sla_breached: false },
  { sninc_inc_num: 'INC0089112', priority_field: 'P4', sninc_capability: 'Monitoring',        sninc_short_desc: 'Grafana dashboard stale after Prometheus scrape interval change',     sninc_assignment_grp: 'Platform Ops',      response_sla: '8 Hrs', resolution_sla: '5 Days', sninc_opened_at: new Date(Date.now() - 24 * 3600000).toISOString(), sninc_last_updt_dttm: new Date(Date.now() - 8 * 3600000).toISOString(), elapsed_hours: 24, sla_breached: false },
  { sninc_inc_num: 'INC0089113', priority_field: 'P4', sninc_capability: 'DMF Orchestration', sninc_short_desc: 'DMF lineage metadata not refreshed after schema change',              sninc_assignment_grp: 'DataOps Platform',  response_sla: '8 Hrs', resolution_sla: '5 Days', sninc_opened_at: new Date(Date.now() - 60 * 3600000).toISOString(), sninc_last_updt_dttm: new Date(Date.now() - 22 * 3600000).toISOString(), elapsed_hours: 60, sla_breached: false },
  { sninc_inc_num: 'INC0089114', priority_field: 'P4', sninc_capability: 'Cloud Analytics',   sninc_short_desc: 'Snowflake credit usage 12% over forecast for the billing period',     sninc_assignment_grp: 'Cloud Analytics',   response_sla: '8 Hrs', resolution_sla: '5 Days', sninc_opened_at: new Date(Date.now() - 84 * 3600000).toISOString(), sninc_last_updt_dttm: new Date(Date.now() - 36 * 3600000).toISOString(), elapsed_hours: 84, sla_breached: false },
  // P5
  { sninc_inc_num: 'INC0089115', priority_field: 'P5', sninc_capability: 'Documentation',     sninc_short_desc: 'Wiki article for DMF lineage process is outdated',                        sninc_assignment_grp: 'DataOps Platform',  response_sla: '24 Hrs', resolution_sla: '10 Days', sninc_opened_at: new Date(Date.now() - 96 * 3600000).toISOString(), sninc_last_updt_dttm: new Date(Date.now() - 48 * 3600000).toISOString(), elapsed_hours: 96, sla_breached: false },
  { sninc_inc_num: 'INC0089116', priority_field: 'P5', sninc_capability: 'BI Reporting',      sninc_short_desc: 'Request to add new bookmark folder in BI portal',                         sninc_assignment_grp: 'BI Dev Team',       response_sla: '24 Hrs', resolution_sla: '10 Days', sninc_opened_at: new Date(Date.now() - 120 * 3600000).toISOString(), sninc_last_updt_dttm: new Date(Date.now() - 60 * 3600000).toISOString(), elapsed_hours: 120, sla_breached: false },
  { sninc_inc_num: 'INC0089117', priority_field: 'P5', sninc_capability: 'Monitoring',        sninc_short_desc: 'Update Grafana panel title to match new naming convention',                sninc_assignment_grp: 'Platform Ops',      response_sla: '24 Hrs', resolution_sla: '10 Days', sninc_opened_at: new Date(Date.now() - 72 * 3600000).toISOString(), sninc_last_updt_dttm: new Date(Date.now() - 30 * 3600000).toISOString(), elapsed_hours: 72, sla_breached: false },
]

export const MOCK_SERVICENOW_EMERGENCY_CHANGES = [
  { priority_field: 'P1', incident_count: 1 },
  { priority_field: 'P2', incident_count: 4 },
  { priority_field: 'P3', incident_count: 2 },
]

export const MOCK_SERVICENOW_BY_CAPABILITY = [
  { capability: 'BI Reporting',      incident_count: 12 },
  { capability: 'Data Integration',  incident_count: 9  },
  { capability: 'ESP Scheduler',     incident_count: 7  },
  { capability: 'DMF Orchestration', incident_count: 6  },
  { capability: 'Monitoring',        incident_count: 4  },
  { capability: 'Cloud Analytics',   incident_count: 3  },
  { capability: 'Database Layer',    incident_count: 2  },
]

export const MOCK_SERVICENOW_BY_ASSIGNMENT_GROUP = [
  { assignment_group: 'DataOps Platform', incident_count: 18 },
  { assignment_group: 'Cloud Analytics',  incident_count: 8  },
  { assignment_group: 'BI Dev Team',      incident_count: 6  },
  { assignment_group: 'Database Team',    incident_count: 5  },
  { assignment_group: 'Platform Ops',     incident_count: 4  },
]

export const MOCK_SERVICENOW_PLATFORMS = [
  { platform: 'BI Analytics',      hasCritical: true  },
  { platform: 'BI Reporting',      hasCritical: true  },
  { platform: 'Data Integration',  hasCritical: false },
  { platform: 'Data Warehouse',    hasCritical: true  },
  { platform: 'DMF Orchestration', hasCritical: false },
  { platform: 'ESP Scheduler',     hasCritical: false },
]

// Kept for backwards compat (no longer used on main dashboard)
export const MOCK_SERVICENOW_AGEING_PROBLEMS: never[] = []
