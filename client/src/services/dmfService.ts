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
  getLineageJobs: () => apiClient.get('/api/dmf/lineage/jobs'),

  // ── Analytics tab ───────────────────────────────────────
  getAnalytics: () => apiClient.get('/api/dmf/analytics'),

  // ── Trends tab ──────────────────────────────────────────
  getStatusTrend: () => apiClient.get('/api/dmf/status-trend'),
  getRowsTrend: () => apiClient.get('/api/dmf/rows-trend'),
  getJobsTrend: () => apiClient.get('/api/dmf/jobs-trend'),
  getStepFailureTrend: () => apiClient.get('/api/dmf/step-failure-trend'),
}
