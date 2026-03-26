/**
 * DMF Service — All DMF / Data Management Framework API calls.
 */
import { apiClient } from './apiClient'

export const dmfService = {
  // ── Overview tab ────────────────────────────────────────
  getSummary: () => apiClient.get('/api/dmf/summary'),
  getStages: () => apiClient.get('/api/dmf/stages'),
  getRunStatus: () => apiClient.get('/api/dmf/run-status'),
  getFailedByStage: () => apiClient.get('/api/dmf/failed-by-stage'),
  getRunsOverTime: () => apiClient.get('/api/dmf/runs-over-time'),
  getErrorReasons: () => apiClient.get('/api/dmf/error-reasons'),
  getRecentFailures: () => apiClient.get('/api/dmf/recent-failures'),

  // ── Lineage tab ─────────────────────────────────────────
  getLineageMeta: () => apiClient.get('/api/dmf/lineage/meta'),
  getLineageJobs: (filters: { src_cd?: string; dataset_nm?: string; src_nm?: string; tgt_nm?: string; proc_typ_cd?: string; run_status?: string } = {}) => {
    const params = new URLSearchParams()
    Object.entries(filters).forEach(([k, v]) => { if (v && v !== 'All') params.set(k, v) })
    const qs = params.toString()
    return apiClient.get(`/api/dmf/lineage/jobs${qs ? `?${qs}` : ''}`)
  },

  // ── Analytics tab ───────────────────────────────────────
  getAnalyticsMeta: () => apiClient.get('/api/dmf/analytics/meta'),
  getAnalytics: (filters: { src_typ?: string; tgt_typ?: string; step_nm?: string; tgt_nm?: string; run_status?: string } = {}) => {
    const params = new URLSearchParams()
    Object.entries(filters).forEach(([k, v]) => { if (v && v !== 'All') params.set(k, v) })
    const qs = params.toString()
    return apiClient.get(`/api/dmf/analytics${qs ? `?${qs}` : ''}`)
  },

  // ── Trends tab ──────────────────────────────────────────
  getStatusTrend: () => apiClient.get('/api/dmf/status-trend'),
  getRowsTrend: () => apiClient.get('/api/dmf/rows-trend'),
  getJobsTrend: () => apiClient.get('/api/dmf/jobs-trend'),
  getStepFailureTrend: () => apiClient.get('/api/dmf/step-failure-trend'),
}
