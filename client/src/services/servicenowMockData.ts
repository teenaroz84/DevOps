/**
 * ServiceNow mock data — mirrors live API response shapes.
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
  {
    id: 'INC0012277',
    title: 'ServiceNow CMDB sync job stalled overnight',
    priority: 'P2',
    status: 'open',
    assignee: 'Priya Patel',
    affectedService: 'CMDB Sync',
    sla: { breached: true },
  },
  {
    id: 'INC0012265',
    title: 'PostgreSQL connection pool exhaustion on prod',
    priority: 'P2',
    status: 'in_progress',
    assignee: 'Carlos Ruiz',
    affectedService: 'Database Layer',
    sla: { breached: false },
  },
  {
    id: 'INC0012250',
    title: 'DMF job step failures in nightly batch run',
    priority: 'P3',
    status: 'open',
    assignee: 'Sarah Kim',
    affectedService: 'DMF Orchestration',
    sla: { breached: false },
  },
  {
    id: 'INC0012238',
    title: 'ESP scheduler missing jobs from overnight run',
    priority: 'P3',
    status: 'resolved',
    assignee: 'Tom Wilson',
    affectedService: 'ESP Scheduler',
    sla: { breached: false },
  },
  {
    id: 'INC0012220',
    title: 'CloudWatch alarm misconfigured for batch latency',
    priority: 'P3',
    status: 'open',
    assignee: 'Anna Brown',
    affectedService: 'Monitoring',
    sla: { breached: false },
  },
]

export const MOCK_SERVICENOW_INCIDENTS = [
  { priority_field: 'P1', incident_count: 2 },
  { priority_field: 'P2', incident_count: 3 },
  { priority_field: 'P3', incident_count: 4 },
]
