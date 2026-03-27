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

  /**
   * Returns job run trend from esp_job_stats_recent.
   * days: 1–7 (default 2). Response: [{ day, hour, job_count, job_fail_count }]
   */
  getJobRunTrend: (applName: string, days: number = 2) =>
    apiClient.get(`/api/esp/job-run-trend/${encodeURIComponent(applName)}?days=${days}`),

  /** Returns rich metadata from esp_job_cmnd: jobname, command, argument, agent, job_type, comp_code, runs, user_job */
  getMetadata: (applName: string) =>
    apiClient.get(`/api/esp/metadata/${encodeURIComponent(applName)}`),

  /** Returns joined run records from esp_job_cmnd + esp_job_stats_recent: job_longname, command, argument, runs, start/end datetime, exec_qtime, ccfail, comp_code */
  getJobRunTable: (applName: string) =>
    apiClient.get(`/api/esp/job-run-table/${encodeURIComponent(applName)}`),

  // Legacy individual endpoints kept for backwards compatibility
  getJobCounts: () => apiClient.get('/api/esp/job-counts'),
  getJobList: () => apiClient.get('/api/esp/job-list'),
  getSpecialJobs: () => apiClient.get('/api/esp/special-jobs'),
}
