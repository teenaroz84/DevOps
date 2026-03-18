/**
 * Postgres Service — Pipeline API calls.
 */
import { apiClient } from './apiClient'

export const postgresService = {
  getPipelines: () => apiClient.get('/api/postgres/pipelines'),
}
