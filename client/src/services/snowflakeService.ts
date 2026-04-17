/**
 * Snowflake Service — Cost / usage API calls.
 */
import { apiClient } from './apiClient'

const withDays = (path: string, days?: number) =>
  typeof days === 'number' ? `${path}?days=${days}` : path

export const snowflakeService = {
  // Backward-compatible shape used by ExecutiveDashboard.
  getCost: async (days?: number) => {
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
  getCostSummary:    (days?: number) => apiClient.get(withDays('/api/snowflake/cost-summary', days)),
  getCostByPipeline: (days?: number) => apiClient.get(withDays('/api/snowflake/cost-by-pipeline', days)),
  getCostScatter:    (days?: number) => apiClient.get(withDays('/api/snowflake/cost-scatter', days)),
  getWarehouseCostEfficiency: (days?: number) => apiClient.get(withDays('/api/snowflake/warehouse-cost-efficiency', days)),
  getCostByDuration: (days?: number) => apiClient.get(withDays('/api/snowflake/cost-by-duration', days)),
  getTopCostlyJobs:  (days?: number) => apiClient.get(withDays('/api/snowflake/top-costly-jobs', days)),
  getPlatformSummary:(days?: number) => apiClient.get(withDays('/api/snowflake/platform-summary', days)),
  getWarehouseHeatmap:(days?: number) => apiClient.get(withDays('/api/snowflake/warehouse-heatmap', days)),
  getHourlyQueries:  (days?: number) => apiClient.get(withDays('/api/snowflake/hourly-queries', days)),
  getTopSlowQueries: (days?: number) => apiClient.get(withDays('/api/snowflake/top-slow-queries', days)),
  getQueryVolumeTrend:(days?: number) => apiClient.get(withDays('/api/snowflake/query-volume-trend', days)),
  getTaskReliability: (days?: number) => apiClient.get(withDays('/api/snowflake/task-reliability', days)),
  getLoginFailures:   (days?: number) => apiClient.get(withDays('/api/snowflake/login-failures', days)),
  getStorageGrowth:   (days?: number) => apiClient.get(withDays('/api/snowflake/storage-growth', days)),
}
