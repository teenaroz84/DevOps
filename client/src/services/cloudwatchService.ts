/**
 * CloudWatch Service — CloudWatch errors and log API calls.
 */
import { apiClient } from './apiClient'

export const cloudwatchService = {
  getErrors: () => apiClient.get('/api/cloudwatch/errors'),
  getLogs: () => apiClient.get('/api/cloudwatch/logs'),
}
