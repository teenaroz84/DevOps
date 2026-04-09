import { apiClient } from './apiClient'

export const talendService = {
  getSummary:     (days = 7) => apiClient.get(`/api/talend/summary?days=${days}`),
  getLevelCounts: (days = 7) => apiClient.get(`/api/talend/level-counts?days=${days}`),
  getRecentTasks: (days = 7) => apiClient.get(`/api/talend/recent-tasks?days=${days}`),
  getRecentErrors:(days = 7) => apiClient.get(`/api/talend/recent-errors?days=${days}`),
}
