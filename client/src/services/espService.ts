/**
 * ESP Service — job scheduling data from SQL Server.
 */
import { apiClient } from './apiClient'

export const espService = {
  /** Returns { applications: [{appl_name}] } — used to populate the dropdown */
  getApplications: () => apiClient.get('/api/esp/applications'),

  /** Returns all widget data for the given appl_name */
  getAppSummary: (applName: string) =>
    apiClient.get(`/api/esp/summary/${encodeURIComponent(applName)}`),

  // Legacy individual endpoints kept for backwards compatibility
  getJobCounts: () => apiClient.get('/api/esp/job-counts'),
  getJobList: () => apiClient.get('/api/esp/job-list'),
  getSpecialJobs: () => apiClient.get('/api/esp/special-jobs'),
}
