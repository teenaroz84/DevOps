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
}
