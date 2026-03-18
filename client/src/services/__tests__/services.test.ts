import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock apiClient before importing services
vi.mock('../apiClient', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
  },
}))

import { apiClient } from '../apiClient'
import { dmfService } from '../dmfService'
import { cloudwatchService } from '../cloudwatchService'
import { servicenowService } from '../servicenowService'
import { snowflakeService } from '../snowflakeService'
import { postgresService } from '../postgresService'
import { chatService } from '../chatService'

const mockGet = apiClient.get as ReturnType<typeof vi.fn>
const mockPost = apiClient.post as ReturnType<typeof vi.fn>

beforeEach(() => {
  vi.clearAllMocks()
})

// ─── DMF Service ─────────────────────────────────────────────

describe('dmfService', () => {
  const endpoints: [string, keyof typeof dmfService][] = [
    ['/api/dmf/summary', 'getSummary'],
    ['/api/dmf/stages', 'getStages'],
    ['/api/dmf/run-status', 'getRunStatus'],
    ['/api/dmf/failed-by-stage', 'getFailedByStage'],
    ['/api/dmf/runs-over-time', 'getRunsOverTime'],
    ['/api/dmf/error-reasons', 'getErrorReasons'],
    ['/api/dmf/recent-failures', 'getRecentFailures'],
    ['/api/dmf/lineage/meta', 'getLineageMeta'],
    ['/api/dmf/lineage/jobs', 'getLineageJobs'],
    ['/api/dmf/analytics', 'getAnalytics'],
    ['/api/dmf/status-trend', 'getStatusTrend'],
    ['/api/dmf/rows-trend', 'getRowsTrend'],
    ['/api/dmf/jobs-trend', 'getJobsTrend'],
    ['/api/dmf/step-failure-trend', 'getStepFailureTrend'],
  ]

  it.each(endpoints)(
    '%s → dmfService.%s calls apiClient.get with correct path',
    async (path, method) => {
      mockGet.mockResolvedValue({ data: 'mock' })

      const result = await dmfService[method]()

      expect(mockGet).toHaveBeenCalledWith(path)
      expect(result).toEqual({ data: 'mock' })
    },
  )
})

// ─── CloudWatch Service ──────────────────────────────────────

describe('cloudwatchService', () => {
  it('getErrors calls /api/cloudwatch/errors', async () => {
    mockGet.mockResolvedValue([{ id: 1, severity: 'critical' }])
    const result = await cloudwatchService.getErrors()
    expect(mockGet).toHaveBeenCalledWith('/api/cloudwatch/errors')
    expect(result).toEqual([{ id: 1, severity: 'critical' }])
  })

  it('getLogs calls /api/cloudwatch/logs', async () => {
    mockGet.mockResolvedValue([{ message: 'log entry' }])
    const result = await cloudwatchService.getLogs()
    expect(mockGet).toHaveBeenCalledWith('/api/cloudwatch/logs')
    expect(result).toEqual([{ message: 'log entry' }])
  })
})

// ─── ServiceNow Service ─────────────────────────────────────

describe('servicenowService', () => {
  it('getTickets calls /api/servicenow/tickets', async () => {
    mockGet.mockResolvedValue([{ id: 'INC001' }])
    const result = await servicenowService.getTickets()
    expect(mockGet).toHaveBeenCalledWith('/api/servicenow/tickets')
    expect(result).toEqual([{ id: 'INC001' }])
  })
})

// ─── Snowflake Service ──────────────────────────────────────

describe('snowflakeService', () => {
  it('getCost calls /api/snowflake/cost', async () => {
    mockGet.mockResolvedValue({ total: 12500, budget: 10000 })
    const result = await snowflakeService.getCost()
    expect(mockGet).toHaveBeenCalledWith('/api/snowflake/cost')
    expect(result).toEqual({ total: 12500, budget: 10000 })
  })
})

// ─── Postgres Service ───────────────────────────────────────

describe('postgresService', () => {
  it('getPipelines calls /api/postgres/pipelines', async () => {
    mockGet.mockResolvedValue([{ name: 'Pipeline A' }])
    const result = await postgresService.getPipelines()
    expect(mockGet).toHaveBeenCalledWith('/api/postgres/pipelines')
    expect(result).toEqual([{ name: 'Pipeline A' }])
  })
})

// ─── Chat Service ───────────────────────────────────────────

describe('chatService', () => {
  it('sendMessage POSTs to /api/chat with message payload', async () => {
    mockPost.mockResolvedValue({ text: 'Hello!', type: 'info' })
    const result = await chatService.sendMessage('hi there')
    expect(mockPost).toHaveBeenCalledWith('/api/chat', { message: 'hi there' })
    expect(result).toEqual({ text: 'Hello!', type: 'info' })
  })

  it('propagates errors from apiClient', async () => {
    mockPost.mockRejectedValue(new Error('API 500: Internal Server Error — /api/chat'))
    await expect(chatService.sendMessage('test')).rejects.toThrow('API 500')
  })
})
