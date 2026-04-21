/**
 * ESP Service — job scheduling data from SQL Server.
 */
import { apiClient } from './apiClient'
import { config } from '../config'

export const espService = {
  /**
   * Streams platform summary rows via NDJSON as each platform's query completes.
   * onRow is called for each platform that arrives; onDone when the stream ends.
   * Returns an AbortController so the caller can cancel the request.
   */
  streamPlatformSummary: (
    onRow: (row: any) => void,
    onDone: () => void,
    onError: (err: Error) => void,
  ): AbortController => {
    const controller = new AbortController()
    const url = `${config.apiBaseUrl}/api/esp/platform-summary`
    fetch(url, { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error(`API ${res.status}: ${res.statusText}`)
        const reader = res.body!.getReader()
        const decoder = new TextDecoder()
        let buffer = ''
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop()!
          for (const line of lines) {
            if (line.trim()) {
              try { onRow(JSON.parse(line)) } catch { /* skip malformed */ }
            }
          }
        }
        if (buffer.trim()) {
          try { onRow(JSON.parse(buffer)) } catch { /* skip malformed */ }
        }
        onDone()
      })
      .catch((err: Error) => {
        if (err.name !== 'AbortError') onError(err)
      })
    return controller
  },

  /** @deprecated use streamPlatformSummary instead */
  getPlatformSummary: () => apiClient.get('/api/esp/platform-summary'),

  /** Returns full widget data aggregated for a platform group */
  getPlatformDetail: (platform: string) =>
    apiClient.get(`/api/esp/platform-detail/${encodeURIComponent(platform)}`),

  /** Returns paginated job list for a platform group, optionally narrowed to one applib */
  getPlatformJobList: (platform: string, limit = 2000, offset = 0, applName = '') => {
    const params = new URLSearchParams({ limit: String(limit), offset: String(offset) })
    if (applName) params.set('applName', applName)
    return apiClient.get(`/api/esp/platform-job-list/${encodeURIComponent(platform)}?${params}`)
  },

  /** Returns job run trend for a platform group */
  getPlatformRunTrend: (platform: string, days = 2) =>
    apiClient.get(`/api/esp/platform-run-trend/${encodeURIComponent(platform)}?days=${days}`),

  /** Returns metadata rows for a platform group */
  getPlatformMetadata: (platform: string) =>
    apiClient.get(`/api/esp/platform-metadata/${encodeURIComponent(platform)}`),

  /** Returns job run table rows for a platform group */
  getPlatformJobRunTable: (platform: string, days = 2) =>
    apiClient.get(`/api/esp/platform-job-run-table/${encodeURIComponent(platform)}?days=${days}`),

  /** Returns paginated/filtered appl_name values for a platform group */
  getPlatformApplications: (platform: string, limit = 200, offset = 0, search = '') => {
    const params = new URLSearchParams({ limit: String(limit), offset: String(offset) })
    if (search) params.set('search', search)
    return apiClient.get(`/api/esp/platform-applications/${encodeURIComponent(platform)}?${params}`)
  },

  /** Returns latest SLA violation rows narrowed by platform and optional applib */
  getSlaViolations: (platformId: string, applName = '', limit = 250) => {
    const params = new URLSearchParams({ platformId, limit: String(limit) })
    if (applName) params.set('applName', applName)
    return apiClient.get(`/api/esp/sla-violations?${params}`)
  },

  /** Returns the ESP SLA missed jobs dashboard aggregates from PostgreSQL only */
  getSlaMissedDashboard: (platformId = '', applName = '') => {
    const params = new URLSearchParams()
    if (platformId) params.set('platformId', platformId)
    if (applName) params.set('applName', applName)
    return apiClient.get(`/api/esp/sla-missed-dashboard?${params}`)
  },

  /** Returns drilldown rows for one SLA-missed ESP job */
  getSlaMissedJobDetail: (platformId = '', jobName: string, applName = '', limit = 100) => {
    const params = new URLSearchParams({ jobName, limit: String(limit) })
    if (platformId) params.set('platformId', platformId)
    if (applName) params.set('applName', applName)
    return apiClient.get(`/api/esp/sla-missed-job-detail?${params}`)
  },

  /** Returns { applications: [{appl_name}] } — used to populate the dropdown */
  getApplications: () => apiClient.get('/api/esp/applications'),

  /** Returns all widget data for the given appl_name */
  getAppSummary: (applName: string, days = 2) =>
    apiClient.get(`/api/esp/summary/${encodeURIComponent(applName)}?days=${days}`),

  /**
   * Returns job run trend from esp_job_stats_recent.
   * days: 1–5 (default 2). Response: [{ day, hour, job_count, job_fail_count }]
   */
  getJobRunTrend: (applName: string, days = 2) =>
    apiClient.get(`/api/esp/job-run-trend/${encodeURIComponent(applName)}?days=${days}`),

  /** Returns rich metadata from esp_job_cmnd: jobname, command, argument, agent, job_type, comp_code, runs, user_job */
  getMetadata: (applName: string) =>
    apiClient.get(`/api/esp/metadata/${encodeURIComponent(applName)}`),

  /** Returns joined run records from esp_job_cmnd + esp_job_stats_recent: job_longname, command, argument, runs, start/end datetime, exec_qtime, ccfail, comp_code */
  getJobRunTable: (applName: string, days = 2) =>
    apiClient.get(`/api/esp/job-run-table/${encodeURIComponent(applName)}?days=${days}`),

  /**
   * Returns hourly run/fail trend for a single job.
   * days: 1–5 (default 2). Response: [{ day, hour, job_count, job_fail_count }]
   */
  getJobRunTrendByJob: (jobname: string, days = 2) =>
    apiClient.get(`/api/esp/run-trend-by-job/${encodeURIComponent(jobname)}?days=${days}`),

  // Legacy individual endpoints kept for backwards compatibility
  getJobCounts: () => apiClient.get('/api/esp/job-counts'),
  getJobList: () => apiClient.get('/api/esp/job-list'),
  getSpecialJobs: () => apiClient.get('/api/esp/special-jobs'),
}
