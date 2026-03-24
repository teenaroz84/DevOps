/**
 * ESP Service — job scheduling data from SQL Server.
 */
import { apiClient } from './apiClient'

export const espService = {
  getJobCounts: () => apiClient.get('/api/esp/job-counts'),
}
