/**
 * ESP Service — job scheduling data from SQL Server.
 */
import { apiClient } from './apiClient'

export const espService = {
  /** Returns per-platform KPI stats for platform cards */
  getPlatformSummary: () => apiClient.get('/api/esp/platform-summary'),

  /** Returns full widget data aggregated for a platform group */
  getPlatformDetail: (platform: string) =>
    apiClient.get(`/api/esp/platform-detail/${encodeURIComponent(platform)}`),

  /** Returns job run trend for a platform group */
  getPlatformRunTrend: (platform: string) =>
    apiClient.get(`/api/esp/platform-run-trend/${encodeURIComponent(platform)}`),

  /** Returns metadata rows for a platform group */
  getPlatformMetadata: (platform: string) =>
    apiClient.get(`/api/esp/platform-metadata/${encodeURIComponent(platform)}`),

  /** Returns job run table rows for a platform group */
  getPlatformJobRunTable: (platform: string) =>
    apiClient.get(`/api/esp/platform-job-run-table/${encodeURIComponent(platform)}`),

  /** Returns distinct appl_name values for a platform group (for qualifiers display) */
  getPlatformApplications: (platform: string) =>
    apiClient.get(`/api/esp/platform-applications/${encodeURIComponent(platform)}`),

  /** Returns { applications: [{appl_name}] } — used to populate the dropdown */
  getApplications: () => apiClient.get('/api/esp/applications'),

  /** Returns all widget data for the given appl_name */
  getAppSummary: (applName: string) =>
    apiClient.get(`/api/esp/summary/${encodeURIComponent(applName)}`),

  /**
   * Returns job run trend from esp_job_stats_recent.
   * days: 1–7 (default 2). Response: [{ day, hour, job_count, job_fail_count }]
   */
  getJobRunTrend: (applName: string) =>
    apiClient.get(`/api/esp/job-run-trend/${encodeURIComponent(applName)}`),

  /** Returns rich metadata from esp_job_cmnd: jobname, command, argument, agent, job_type, comp_code, runs, user_job */
  getMetadata: (applName: string) =>
    apiClient.get(`/api/esp/metadata/${encodeURIComponent(applName)}`),

  /** Returns joined run records from esp_job_cmnd + esp_job_stats_recent: job_longname, command, argument, runs, start/end datetime, exec_qtime, ccfail, comp_code */
  getJobRunTable: (applName: string) =>
    apiClient.get(`/api/esp/job-run-table/${encodeURIComponent(applName)}`),

  /**
   * Returns hourly run/fail trend for a single job.
   * days: 1–7 (default 2). Response: [{ day, hour, job_count, job_fail_count }]
   */
  getJobRunTrendByJob: (jobname: string) =>
    apiClient.get(`/api/esp/run-trend-by-job/${encodeURIComponent(jobname)}`),

  // Legacy individual endpoints kept for backwards compatibility
  getJobCounts: () => apiClient.get('/api/esp/job-counts'),
  getJobList: () => apiClient.get('/api/esp/job-list'),
  getSpecialJobs: () => apiClient.get('/api/esp/special-jobs'),
}
