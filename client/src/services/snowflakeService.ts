/**
 * Snowflake Service — Cost / usage API calls.
 */
import { apiClient } from './apiClient'

export const snowflakeService = {
  // Backward-compatible shape used by ExecutiveDashboard.
  getCost: async () => {
    const summary = await apiClient.get('/api/snowflake/cost-summary')
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
  getCostSummary:    () => apiClient.get('/api/snowflake/cost-summary'),
  getCostByPipeline: () => apiClient.get('/api/snowflake/cost-by-pipeline'),
  getCostScatter:    () => apiClient.get('/api/snowflake/cost-scatter'),
  getWarehouseCostEfficiency: () => apiClient.get('/api/snowflake/warehouse-cost-efficiency'),
  getCostByDuration: () => apiClient.get('/api/snowflake/cost-by-duration'),
  getTopCostlyJobs:  () => apiClient.get('/api/snowflake/top-costly-jobs'),
  getPlatformSummary:() => apiClient.get('/api/snowflake/platform-summary'),
  getWarehouseHeatmap:()=> apiClient.get('/api/snowflake/warehouse-heatmap'),
  getHourlyQueries:  () => apiClient.get('/api/snowflake/hourly-queries'),
  getTopSlowQueries: () => apiClient.get('/api/snowflake/top-slow-queries'),
  getQueryVolumeTrend:() => apiClient.get('/api/snowflake/query-volume-trend'),
  getTaskReliability: () => apiClient.get('/api/snowflake/task-reliability'),
  getLoginFailures:   () => apiClient.get('/api/snowflake/login-failures'),
  getStorageGrowth:   () => apiClient.get('/api/snowflake/storage-growth'),
}
