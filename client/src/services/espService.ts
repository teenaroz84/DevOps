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
  getSlaMissedDashboard: (platformId = '', applName = '', interval: number | 'all' = 30) => {
    const params = new URLSearchParams({ interval: String(interval) })
    if (platformId) params.set('platformId', platformId)
    if (applName) params.set('applName', applName)
    return apiClient.get(`/api/esp/sla-missed-dashboard?${params}`)
  },

  /** Returns the 5 executive KPI cards (value + sparkline trend) for ESP */
  getOverviewKpis: (platformId = '', applName = '', interval: number | 'all' = 30) => {
    const params = new URLSearchParams({ interval: String(interval) })
    if (platformId) params.set('platformId', platformId)
    if (applName) params.set('applName', applName)
    return apiClient.get(`/api/esp/overview-kpis?${params}`)
  },

  /** Returns daily Runs / Fails / Avg-run merged by date for the Job Run Trend line chart */
  getOverviewJobRunTrend: (platformId = '', applName = '', interval: number | 'all' = 30) => {
    const params = new URLSearchParams({ interval: String(interval) })
    if (platformId) params.set('platformId', platformId)
    if (applName) params.set('applName', applName)
    return apiClient.get(`/api/esp/job-run-trend?${params}`)
  },

  /** Returns per-agent run counts for the Job Run Agents bar chart */
  getOverviewJobRunAgents: (platformId = '', applName = '', interval: number | 'all' = 30) => {
    const params = new URLSearchParams({ interval: String(interval) })
    if (platformId) params.set('platformId', platformId)
    if (applName) params.set('applName', applName)
    return apiClient.get(`/api/esp/job-run-agents?${params}`)
  },

  /** Returns job-type breakdown (count + pct) for the Job Type Distribution donut chart */
  getOverviewJobTypeDistribution: (platformId = '', applName = '', interval: number | 'all' = 30) => {
    const params = new URLSearchParams({ interval: String(interval) })
    if (platformId) params.set('platformId', platformId)
    if (applName) params.set('applName', applName)
    return apiClient.get(`/api/esp/job-type-distribution?${params}`)
  },

  /** Returns drilldown rows for one SLA-missed ESP job */
  getSlaMissedJobDetail: (platformId = '', jobName: string, applName = '', limit = 100) => {
    const params = new URLSearchParams({ jobName, limit: String(limit) })
    if (platformId) params.set('platformId', platformId)
    if (applName) params.set('applName', applName)
    return apiClient.get(`/api/esp/sla-missed-job-detail?${params}`)
  },

  /** Returns grouped widgets for Job Execution Status, SLA Status and Job Dependencies */
  getOverviewSlaGrouped: (platformId = '', applName = '', interval: number | 'all' = 30) => {
    const params = new URLSearchParams({ interval: String(interval) })
    if (platformId) params.set('platformId', platformId)
    if (applName) params.set('applName', applName)
    return apiClient.get(`/api/esp/overview-sla-grouped?${params}`)
  },

  /** Returns { applications: [{appl_name}] } — used to populate the dropdown */
  getApplications: () => apiClient.get('/api/esp/applications'),

  /** Returns all widget data for the given appl_name */
  getAppSummary: (applName: string, days = 2, platformId?: string) =>
    apiClient.get(`/api/esp/summary/${encodeURIComponent(applName)}?days=${days}${platformId ? `&platformId=${encodeURIComponent(platformId)}` : ''}`),

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
