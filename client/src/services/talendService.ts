import { apiClient } from './apiClient'

export const talendService = {
  getSummary:     () => apiClient.get('/api/talend/summary'),
  getLevelCounts: () => apiClient.get('/api/talend/level-counts'),
  getRecentTasks: () => apiClient.get('/api/talend/recent-tasks'),
  getRecentErrors:() => apiClient.get('/api/talend/recent-errors'),
}
