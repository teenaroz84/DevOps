import { apiClient } from './apiClient'

export const servicenowService = {
  getTickets:          () => apiClient.get('/api/servicenow/tickets'),
  getIncidents:        () => apiClient.get('/api/servicenow/incidents'),
  getAgeingProblems:   () => apiClient.get('/api/servicenow/ageing-problems'),
  getEmergencyChanges: () => apiClient.get('/api/servicenow/emergency-changes'),
}
