import { apiClient } from './apiClient'

export const servicenowService = {
  getTickets:           () => apiClient.get('/api/servicenow/tickets'),
  getPlatforms:         () => apiClient.get('/api/servicenow/platforms'),
  getIncidents:         (platform?: string) =>
    apiClient.get(`/api/servicenow/incidents${platform ? `?platform=${encodeURIComponent(platform)}` : ''}`),
  getMissedIncidents:   (platform?: string) =>
    apiClient.get(`/api/servicenow/missed-incidents${platform ? `?platform=${encodeURIComponent(platform)}` : ''}`),
  getIncidentList:      (platform?: string) =>
    apiClient.get(`/api/servicenow/incident-list${platform ? `?platform=${encodeURIComponent(platform)}` : ''}`),
  getIncidentDetail:    (priority?: string, platform?: string) => {
    const params = new URLSearchParams()
    if (priority) params.set('priority', priority)
    if (platform) params.set('platform', platform)
    const qs = params.toString()
    return apiClient.get(`/api/servicenow/incident-detail${qs ? `?${qs}` : ''}`)
  },
  getEmergencyChanges:  (platform?: string) =>
    apiClient.get(`/api/servicenow/emergency-changes${platform ? `?platform=${encodeURIComponent(platform)}` : ''}`),
}
