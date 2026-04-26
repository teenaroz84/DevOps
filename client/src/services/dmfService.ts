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
  getLineageMeta: (date_range?: string) => apiClient.get(`/api/dmf/lineage/meta${date_range ? `?date_range=${date_range}` : ''}`),
  getLineageCounts: (filters: { src_cd?: string; date_range?: string; proc_typ_cd?: string[]; run_status?: string[]; dataset_nm?: string[] } = {}) => {
    const params = new URLSearchParams()
    if (filters.src_cd && filters.src_cd !== 'All') params.set('src_cd', filters.src_cd)
    if (filters.date_range) params.set('date_range', filters.date_range)
    if (filters.proc_typ_cd?.length) params.set('proc_typ_cd', filters.proc_typ_cd.join(','))
    if (filters.run_status?.length) params.set('run_status', filters.run_status.join(','))
    if (filters.dataset_nm?.length) params.set('dataset_nm', filters.dataset_nm.join(','))
    const qs = params.toString()
    return apiClient.get(`/api/dmf/lineage/counts${qs ? `?${qs}` : ''}`)
  },
  getLineageJobs: (filters: { src_cd?: string; date_range?: string; proc_typ_cd?: string[]; run_status?: string[]; dataset_nm?: string[]; page?: number; pageSize?: number } = {}) => {
    const params = new URLSearchParams()
    if (filters.src_cd && filters.src_cd !== 'All') params.set('src_cd', filters.src_cd)
    if (filters.date_range) params.set('date_range', filters.date_range)
    if (filters.proc_typ_cd?.length) params.set('proc_typ_cd', filters.proc_typ_cd.join(','))
    if (filters.run_status?.length) params.set('run_status', filters.run_status.join(','))
    if (filters.dataset_nm?.length) params.set('dataset_nm', filters.dataset_nm.join(','))
    if (filters.page !== undefined) params.set('page', String(filters.page))
    if (filters.pageSize !== undefined) params.set('pageSize', String(filters.pageSize))
    const qs = params.toString()
    return apiClient.get(`/api/dmf/lineage/jobs${qs ? `?${qs}` : ''}`)
  },

  // ── Analytics tab ───────────────────────────────────────
  getAnalyticsMeta: (date_range?: string) => apiClient.get(`/api/dmf/analytics/meta${date_range ? `?date_range=${date_range}` : ''}`),
  getAnalytics: (filters: { src_typ?: string; tgt_typ?: string; step_nm?: string; tgt_nm?: string; run_status?: string; date_range?: string } = {}) => {
    const params = new URLSearchParams()
    Object.entries(filters).forEach(([k, v]) => { if (v && v !== 'All') params.set(k, v) })
    const qs = params.toString()
    return apiClient.get(`/api/dmf/analytics${qs ? `?${qs}` : ''}`)
  },

  // ── Trends tab ──────────────────────────────────────────
  getStatusTrend: (date_range?: string) => apiClient.get(`/api/dmf/status-trend${date_range ? `?date_range=${date_range}` : ''}`),
  getRowsTrend: (date_range?: string) => apiClient.get(`/api/dmf/rows-trend${date_range ? `?date_range=${date_range}` : ''}`),
  getJobsTrend: (date_range?: string) => apiClient.get(`/api/dmf/jobs-trend${date_range ? `?date_range=${date_range}` : ''}`),
  getStepFailureTrend: (date_range?: string) => apiClient.get(`/api/dmf/step-failure-trend${date_range ? `?date_range=${date_range}` : ''}`),
}
