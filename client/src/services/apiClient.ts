/**
 * apiClient — Centralized HTTP client.
 *
 * All service files use this instead of raw fetch().
 * Reads VITE_API_BASE_URL so the same code hits local,
 * staging, or production depending on the active env.
 */
import { config } from '../config'

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${config.apiBaseUrl}${path}`
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  })
  if (!res.ok) {
    throw new Error(`API ${res.status}: ${res.statusText} — ${path}`)
  }
  return res.json()
}

export const apiClient = {
  get: <T = any>(path: string) => request<T>(path),

  post: <T = any>(path: string, body: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
}
