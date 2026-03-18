import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock config before importing apiClient
vi.mock('../../config', () => ({
  config: { apiBaseUrl: 'http://test-api.example.com' },
}))

import { apiClient } from '../apiClient'

describe('apiClient', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  describe('get', () => {
    it('calls fetch with the correct URL and headers', async () => {
      const mockData = { status: 'ok' }
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockData),
      }))

      await apiClient.get('/api/dmf/summary')

      expect(fetch).toHaveBeenCalledWith(
        'http://test-api.example.com/api/dmf/summary',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
        }),
      )
    })

    it('returns parsed JSON on success', async () => {
      const mockData = { totalRuns: 42 }
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockData),
      }))

      const result = await apiClient.get('/api/dmf/summary')
      expect(result).toEqual({ totalRuns: 42 })
    })

    it('throws on non-OK response', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      }))

      await expect(apiClient.get('/api/missing')).rejects.toThrow(
        'API 404: Not Found — /api/missing',
      )
    })

    it('throws on network error', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network failure')))

      await expect(apiClient.get('/api/dmf/summary')).rejects.toThrow('Network failure')
    })
  })

  describe('post', () => {
    it('sends POST with JSON body', async () => {
      const mockResponse = { text: 'Hello' }
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      }))

      const result = await apiClient.post('/api/chat', { message: 'hi' })

      expect(fetch).toHaveBeenCalledWith(
        'http://test-api.example.com/api/chat',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ message: 'hi' }),
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
        }),
      )
      expect(result).toEqual({ text: 'Hello' })
    })

    it('throws on server error', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      }))

      await expect(apiClient.post('/api/chat', {})).rejects.toThrow(
        'API 500: Internal Server Error — /api/chat',
      )
    })
  })
})
