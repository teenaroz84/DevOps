import { apiClient } from './apiClient'

export type ServiceNowDaysFilter = number | 'all'

const withDays = (basePath: string, days: ServiceNowDaysFilter = 7, platform?: string) => {
  const params = new URLSearchParams()
  if (platform) params.set('platform', platform)
  params.set('days', String(days))
  return `${basePath}?${params.toString()}`
}

export const servicenowService = {
  getTickets:           () => apiClient.get('/api/servicenow/tickets'),
  getPlatforms:         (days: ServiceNowDaysFilter = 7) => apiClient.get(withDays('/api/servicenow/platforms', days)),
  getIncidentSummary:   (platform?: string) =>
    apiClient.get(`/api/servicenow/incidents-summary${platform ? `?platform=${encodeURIComponent(platform)}` : ''}`),
  getIncidents:         (platform?: string) =>
    apiClient.get(`/api/servicenow/incidents${platform ? `?platform=${encodeURIComponent(platform)}` : ''}`),
  getClosedIncidents:   (platform?: string) =>
    apiClient.get(`/api/servicenow/closed-incidents${platform ? `?platform=${encodeURIComponent(platform)}` : ''}`),
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
  getEmergencyChanges:  (platform?: string) =>
    apiClient.get(`/api/servicenow/emergency-changes${platform ? `?platform=${encodeURIComponent(platform)}` : ''}`),
  getByCapability:      (platform?: string, days: ServiceNowDaysFilter = 7) =>
    apiClient.get(withDays('/api/servicenow/by-capability', days, platform)),
  getByAssignmentGroup: (platform?: string, days: ServiceNowDaysFilter = 7) =>
    apiClient.get(withDays('/api/servicenow/by-assignment-group', days, platform)),
  getIncidentTrend: (platform?: string, days: ServiceNowDaysFilter = 7) =>
    apiClient.get(withDays('/api/servicenow/incident-trend', days, platform)),
}
