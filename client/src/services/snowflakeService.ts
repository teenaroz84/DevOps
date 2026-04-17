/**
 * Snowflake Service — Cost / usage API calls.
 */
import { apiClient } from './apiClient'

type SnowflakeQueryParams = {
  days?: number
  asOf?: string
}

function buildQuery(params?: SnowflakeQueryParams): string {
  if (!params) return ''
  const qp = new URLSearchParams()
  if (Number.isFinite(params.days)) qp.set('days', String(params.days))
  if (params.asOf) qp.set('asOf', params.asOf)
  const qs = qp.toString()
  return qs ? `?${qs}` : ''
}

export const snowflakeService = {
  // Backward-compatible shape used by ExecutiveDashboard.
  getCost: async (params?: SnowflakeQueryParams) => {
    const summary = await apiClient.get(`/api/snowflake/cost-summary${buildQuery(params)}`)
    const total = Number(summary?.monthly_cost ?? summary?.cost_mtd ?? 0)
    const budget = Number(summary?.budget ?? 0)
    return {
      total,
      budget,
      overage: Math.max(0, total - budget),
      efficient_pct: Number(summary?.efficient_pct ?? 0),
      wasted_spend: Number(summary?.wasted_spend ?? 0),
      ...summary,
    }
  },
  getCostSummary:    (params?: SnowflakeQueryParams) => apiClient.get(`/api/snowflake/cost-summary${buildQuery(params)}`),
  getCostByPipeline: (params?: SnowflakeQueryParams) => apiClient.get(`/api/snowflake/cost-by-pipeline${buildQuery(params)}`),
  getCostScatter:    (params?: SnowflakeQueryParams) => apiClient.get(`/api/snowflake/cost-scatter${buildQuery(params)}`),
  getWarehouseCostEfficiency: (params?: SnowflakeQueryParams) => apiClient.get(`/api/snowflake/warehouse-cost-efficiency${buildQuery(params)}`),
  getCostByDuration: (params?: SnowflakeQueryParams) => apiClient.get(`/api/snowflake/cost-by-duration${buildQuery(params)}`),
  getTopCostlyJobs:  (params?: SnowflakeQueryParams) => apiClient.get(`/api/snowflake/top-costly-jobs${buildQuery(params)}`),
  getPlatformSummary:(params?: SnowflakeQueryParams) => apiClient.get(`/api/snowflake/platform-summary${buildQuery(params)}`),
  getWarehouseHeatmap:(params?: SnowflakeQueryParams)=> apiClient.get(`/api/snowflake/warehouse-heatmap${buildQuery(params)}`),
  getHourlyQueries:  (params?: SnowflakeQueryParams) => apiClient.get(`/api/snowflake/hourly-queries${buildQuery(params)}`),
  getTopSlowQueries: (params?: SnowflakeQueryParams) => apiClient.get(`/api/snowflake/top-slow-queries${buildQuery(params)}`),
  getQueryVolumeTrend:(params?: SnowflakeQueryParams) => apiClient.get(`/api/snowflake/query-volume-trend${buildQuery(params)}`),
  getTaskReliability: (params?: SnowflakeQueryParams) => apiClient.get(`/api/snowflake/task-reliability${buildQuery(params)}`),
  getLoginFailures:   (params?: SnowflakeQueryParams) => apiClient.get(`/api/snowflake/login-failures${buildQuery(params)}`),
  getStorageGrowth:   (params?: SnowflakeQueryParams) => apiClient.get(`/api/snowflake/storage-growth${buildQuery(params)}`),
}
