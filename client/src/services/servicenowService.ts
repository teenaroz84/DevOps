/**
 * ServiceNow Service — Ticket API calls.
 */
import { apiClient } from './apiClient'

export const servicenowService = {
  getTickets: () => apiClient.get('/api/servicenow/tickets'),
}
