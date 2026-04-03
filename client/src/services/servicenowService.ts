import { apiClient } from './apiClient'

export const servicenowService = {
  getTickets:           () => apiClient.get('/api/servicenow/tickets'),
  getIncidents:         () => apiClient.get('/api/servicenow/incidents'),
  getMissedIncidents:   () => apiClient.get('/api/servicenow/missed-incidents'),
  getIncidentList:      () => apiClient.get('/api/servicenow/incident-list'),
  getIncidentDetail:    (priority?: string) =>
    apiClient.get(`/api/servicenow/incident-detail${priority ? `?priority=${encodeURIComponent(priority)}` : ''}`),
  getEmergencyChanges:  () => apiClient.get('/api/servicenow/emergency-changes'),
}
