/**
 * Snowflake Service — Cost / usage API calls.
 */
import { apiClient } from './apiClient'

export const snowflakeService = {
  getCost: () => apiClient.get('/api/snowflake/cost'),
}
