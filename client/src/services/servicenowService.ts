import { apiClient } from './apiClient'

export type ServiceNowDaysFilter = number | 'all'

export interface ServiceNowIncidentDashboardSummary {
  days: ServiceNowDaysFilter
  platform: string | null
  total_incidents: number
  current_90d: number
  prev_90d: number
  new_current: number
  open_current: number
  closed_current: number
  reopened_current: number
  new_prev: number
  open_prev: number
  closed_prev: number
  reopened_prev: number
}

export interface ServiceNowAssignmentGroupTop10Row {
  assignment_group: string
  incident_count: number
  max_count: number
  pct_of_total: number
}

export interface ServiceNowPlatformApplicationTop10Row {
  platform_app: string
  total_count: number
  open_count: number
  pct_of_open: number
}

export interface ServiceNowPriorityDonutRow {
  priority: string
  incident_count: number
  pct_of_total: number
}

export interface ServiceNowSlaPerformancePanel {
  within_sla: number
  breaching_soon: number
  breached: number
  total_open: number
  within_sla_pct: number
}

export interface ServiceNowSlaBreachRiskTicket {
  sninc_inc_num: string
  sninc_short_desc: string
  sninc_assignment_grp: string | null
  sninc_priority: string | null
  sninc_expiry_dttm: string | null
  minutes_to_breach: number | null
  sninc_mon_sla: string | null
  sninc_last_updt_dttm: string | null
}

export interface ServiceNowOpenIncidentAgeingRow {
  age_bucket: string
  incident_count: number
  pct_of_open: number
}

export interface ServiceNowTopIncidentCategoryRow {
  category: string
  incident_count: number
  pct_of_open: number
}

export interface ServiceNowTopIncidentUpdateRow {
  sninc_inc_num: string
  update_count: number
  sninc_state: string | null
  sninc_priority: string | null
  sninc_short_desc: string | null
  sninc_assignment_grp: string | null
  sninc_last_updt_dttm: string | null
}

export interface ServiceNowOperationalKpis {
  avg_resolve_days_current: number | null
  avg_resolve_days_prev: number | null
  avg_first_response_hrs_current: number | null
  avg_first_response_hrs_prev: number | null
  backlog_now: number
  backlog_90d_ago: number
  reopen_rate_pct_current: number | null
  reopen_rate_pct_prev: number | null
  unique_articles_current: number
  unique_articles_prev: number
}

const withDays = (basePath: string, days: ServiceNowDaysFilter = 7, platform?: string) => {
  const params = new URLSearchParams()
  if (platform) params.set('platform', platform)
  params.set('days', String(days))
  return `${basePath}?${params.toString()}`
}

export const servicenowService = {
  getTickets:           () => apiClient.get('/api/servicenow/tickets'),
  getPlatforms:         (days: ServiceNowDaysFilter = 7) => apiClient.get(withDays('/api/servicenow/platforms', days)),
  getIncidentDashboardSummary: (platform?: string, days: ServiceNowDaysFilter = 90) =>
    apiClient.get<ServiceNowIncidentDashboardSummary>(withDays('/api/servicenow/incidents-dashboard-summary', days, platform)),
  getIncidentSummary:   (platform?: string) =>
    apiClient.get(`/api/servicenow/incidents-summary${platform ? `?platform=${encodeURIComponent(platform)}` : ''}`),
  getIncidents:         (platform?: string) =>
    apiClient.get(`/api/servicenow/incidents${platform ? `?platform=${encodeURIComponent(platform)}` : ''}`),
  getClosedIncidents:   (platform?: string, days: ServiceNowDaysFilter = 7) =>
    apiClient.get(withDays('/api/servicenow/closed-incidents', days, platform)),
  getMissedIncidents:   (platform?: string, days: ServiceNowDaysFilter = 7) =>
    apiClient.get(withDays('/api/servicenow/missed-incidents', days, platform)),
  getIncidentList:      (platform?: string, days: ServiceNowDaysFilter = 7) =>
    apiClient.get(withDays('/api/servicenow/incident-list', days, platform)),
  getIncidentDetail:    (priority?: string, platform?: string, days: ServiceNowDaysFilter = 7) => {
    const params = new URLSearchParams()
    if (priority) params.set('priority', priority)
    if (platform) params.set('platform', platform)
    params.set('days', String(days))
    const qs = params.toString()
    return apiClient.get(`/api/servicenow/incident-detail${qs ? `?${qs}` : ''}`)
  },
  getEmergencyChanges:  (platform?: string, days: ServiceNowDaysFilter = 7) =>
    apiClient.get(withDays('/api/servicenow/emergency-changes', days, platform)),
  getOpenedChanges:     (platform?: string, days: ServiceNowDaysFilter = 7) =>
    apiClient.get(withDays('/api/servicenow/changes-opened', days, platform)),
  getClosedChanges:     (platform?: string, days: ServiceNowDaysFilter = 7) =>
    apiClient.get(withDays('/api/servicenow/changes-closed', days, platform)),
  getChangesByPlatform: (platform?: string, days: ServiceNowDaysFilter = 7) =>
    apiClient.get(withDays('/api/servicenow/changes-by-platform', days, platform)),
  getByCapability:      (platform?: string, days: ServiceNowDaysFilter = 7) =>
    apiClient.get(withDays('/api/servicenow/by-capability', days, platform)),
  getByAssignmentGroup: (platform?: string, days: ServiceNowDaysFilter = 7) =>
    apiClient.get(withDays('/api/servicenow/by-assignment-group', days, platform)),
  getByPlatform:        (platform?: string, days: ServiceNowDaysFilter = 7) =>
    apiClient.get(withDays('/api/servicenow/by-platform', days, platform)),
  getIncidentStateDaily:(platform?: string, days: ServiceNowDaysFilter = 7) =>
    apiClient.get(withDays('/api/servicenow/incident-state-daily', days, platform)),
  getTopIncidentUpdates:(platform?: string) =>
    apiClient.get(`/api/servicenow/top-incident-updates${platform ? `?platform=${encodeURIComponent(platform)}` : ''}`),
  getIncidentTrend: (platform?: string, days: ServiceNowDaysFilter = 7) =>
    apiClient.get(withDays('/api/servicenow/incident-trend', days, platform)),
  getIncidentsAssignmentGroupTop10: () =>
    apiClient.get<ServiceNowAssignmentGroupTop10Row[]>('/api/servicenow/incidents-assignment-group-top10'),
  getIncidentsPlatformApplicationTop10: () =>
    apiClient.get<ServiceNowPlatformApplicationTop10Row[]>('/api/servicenow/incidents-platform-application-top10'),
  getIncidentsPriorityDonut: () =>
    apiClient.get<ServiceNowPriorityDonutRow[]>('/api/servicenow/incidents-priority-donut'),
  getSlaPerformancePanel: () =>
    apiClient.get<ServiceNowSlaPerformancePanel>('/api/servicenow/sla-performance-panel'),
  getSlaBreachRiskAlertTickets: () =>
    apiClient.get<ServiceNowSlaBreachRiskTicket[]>('/api/servicenow/sla-breach-risk-alert-tickets'),
  getOpenIncidentAgeing: () =>
    apiClient.get<ServiceNowOpenIncidentAgeingRow[]>('/api/servicenow/open-incident-ageing'),
  getTopIncidentCategories: () =>
    apiClient.get<ServiceNowTopIncidentCategoryRow[]>('/api/servicenow/top-incident-categories'),
  getTopIncidentsByUpdateCount: () =>
    apiClient.get<ServiceNowTopIncidentUpdateRow[]>('/api/servicenow/top-incidents-by-update-count'),
  getOperationalKpis: (platform?: string, days: ServiceNowDaysFilter = 90) =>
    apiClient.get<ServiceNowOperationalKpis>(withDays('/api/servicenow/operational-kpis', days, platform)),
}
