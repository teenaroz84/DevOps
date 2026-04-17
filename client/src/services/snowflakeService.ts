/**
 * Snowflake Service — Cost / usage API calls.
 */
import { apiClient } from './apiClient'

const withDays = (path: string, days = 3) => `${path}?days=${days}`

export const snowflakeService = {
  // Backward-compatible shape used by ExecutiveDashboard.
  getCost: async (days = 3) => {
    const summary = await apiClient.get(withDays('/api/snowflake/cost-summary', days))
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
  getCostSummary:    (days = 3) => apiClient.get(withDays('/api/snowflake/cost-summary', days)),
  getCostByPipeline: (days = 3) => apiClient.get(withDays('/api/snowflake/cost-by-pipeline', days)),
  getCostScatter:    (days = 3) => apiClient.get(withDays('/api/snowflake/cost-scatter', days)),
  getWarehouseCostEfficiency: (days = 3) => apiClient.get(withDays('/api/snowflake/warehouse-cost-efficiency', days)),
  getCostByDuration: (days = 3) => apiClient.get(withDays('/api/snowflake/cost-by-duration', days)),
  getTopCostlyJobs:  (days = 3) => apiClient.get(withDays('/api/snowflake/top-costly-jobs', days)),
  getPlatformSummary:(days = 3) => apiClient.get(withDays('/api/snowflake/platform-summary', days)),
  getWarehouseHeatmap:(days = 3) => apiClient.get(withDays('/api/snowflake/warehouse-heatmap', days)),
  getHourlyQueries:  (days = 3) => apiClient.get(withDays('/api/snowflake/hourly-queries', days)),
  getTopSlowQueries: (days = 3) => apiClient.get(withDays('/api/snowflake/top-slow-queries', days)),
  getQueryVolumeTrend:(days = 3) => apiClient.get(withDays('/api/snowflake/query-volume-trend', days)),
  getTaskReliability: (days = 3) => apiClient.get(withDays('/api/snowflake/task-reliability', days)),
  getLoginFailures:   (days = 3) => apiClient.get(withDays('/api/snowflake/login-failures', days)),
  getStorageGrowth:   (days = 3) => apiClient.get(withDays('/api/snowflake/storage-growth', days)),
}
