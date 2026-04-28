/**
 * SnowflakeDashboardTab
 * Two sub-screens toggled by inner tabs:
 *   1. Platform Intelligence
 *   2. Cost & Efficiency Overview
 */
import React, { useState, useEffect } from 'react'
import { Box, Typography, Paper, Chip, Button, CircularProgress, Slider, Tooltip } from '@mui/material'
import AcUnitIcon from '@mui/icons-material/AcUnit'
import AttachMoneyIcon from '@mui/icons-material/AttachMoney'
import QueryStatsIcon from '@mui/icons-material/QueryStats'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import CancelIcon from '@mui/icons-material/Cancel'
import {
  StatCardGrid,
  HeatmapGrid,
  ComposedBarLineChart,
  TrendLineChart,
  DataTable,
  DonutChart,
} from '../widgets'
import type { ColumnDef } from '../widgets'
import {
  MOCK_SF_COST_SUMMARY,
  MOCK_SF_COST_BY_PIPELINE,
  MOCK_SF_COST_SCATTER,
  MOCK_SF_WAREHOUSE_COST_EFFICIENCY,
  MOCK_SF_COST_BY_DURATION,
  MOCK_SF_TOP_COSTLY_JOBS,
  MOCK_SF_PLATFORM_SUMMARY,
  MOCK_SF_HEATMAP,
  MOCK_SF_TOP_SLOW_QUERIES,
  MOCK_SF_ALERT,
  MOCK_SF_QUERY_VOLUME_TREND,
  MOCK_SF_TASK_RELIABILITY,
  MOCK_SF_LOGIN_FAILURES,
  MOCK_SF_STORAGE_GROWTH,
} from '../../services/snowflakeMockData'
import { snowflakeService } from '../../services/snowflakeService'
import { useMockData } from '../../context/MockDataContext'
import { AGENTS } from '../../config/agentConfig'

// ── Helpers ────────────────────────────────────────────────

const TRUIST = {
  purple: '#2E1A47',
  white: '#FFFFFF',
  dusk: '#7C6992',
  sky: '#B0E0E2',
  darkGray: '#787878',
  charcoal: '#34343B',
  dawn: '#AFABC9',
  lightGray: '#C9C9C9',
  midGray: '#A8A8A8',
  shell: '#F6F4F8',
  mist: '#EEF7F8',
} as const

const SAMPLE_AS_OF_DATE = '2026-03-12'

const toIsoDate = (date: Date) => {
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const shiftIsoDate = (isoDate: string, daysBack: number) => {
  const shifted = new Date(`${isoDate}T00:00:00Z`)
  shifted.setUTCDate(shifted.getUTCDate() - daysBack)
  return toIsoDate(shifted)
}

const formatDisplayDate = (isoDate: string) => new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
}).format(new Date(`${isoDate}T00:00:00Z`))

const fmtK = (n: number) => `$${(n / 1000).toFixed(1)}k`
const fmtKpiDollar = (n?: number) => n != null ? `$${Math.round(n).toLocaleString('en-US')}` : '—'
const fmtCompactUsd = (n?: number) => {
  if (n == null) return '—'
  const abs = Math.abs(n)
  if (abs < 1_000_000) return fmtKpiDollar(n)

  const units = [
    { value: 1_000_000_000, suffix: 'B' },
    { value: 1_000_000, suffix: 'M' },
  ]
  const unit = units.find((item) => abs >= item.value) ?? units[units.length - 1]
  const scaled = n / unit.value
  const formatted = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(scaled)
  return `$${formatted} ${unit.suffix}`
}

const ERROR_COLOR: Record<string, string> = {
  TIMEOUT:    '#e53935',
  SPILL:      '#fb8c00',
  LOCK_WAIT:  '#fdd835',
  ROW_ACCESS: '#42a5f5',
  ERROR:      '#e53935',
  SLOW:       '#fb8c00',
}

// ── Types ──────────────────────────────────────────────────

type CostSummaryShape = {
  monthly_cost: number
  warehouse_spend: number
  efficient_pct: number
  wasted_spend: number
  budget: number
  cost_today?: number
  cost_mtd?: number
  avg_daily_burn_30d?: number
  remaining_balance?: number
  days_remaining?: number
  optimization_opportunity_currency_7d?: number
}

type PlatformSummaryShape = {
  long_queries: number
  task_failures: number
  warehouse_util_pct: number
  query_errors: number
  queries_today?: number
  query_success_pct?: number
  avg_query_time_ms?: number
  warehouse_credits_used?: number
  failed_logins?: number
}

interface CostData {
  summary: CostSummaryShape
  byPipeline: typeof MOCK_SF_COST_BY_PIPELINE
  scatter: typeof MOCK_SF_COST_SCATTER
  warehouseCostEfficiency: Array<{
    warehouse_name: string
    total_credits: number
    query_count: number
    avg_runtime_ms: number
    credits_per_query: number
    efficiency: 'good' | 'warn' | 'bad'
  }>
  byDuration: typeof MOCK_SF_COST_BY_DURATION
  topCostlyJobs: typeof MOCK_SF_TOP_COSTLY_JOBS
  storageGrowth: Array<{ date: string; storage_tb: number }>
}

interface PlatformData {
  summary: PlatformSummaryShape
  heatmap: typeof MOCK_SF_HEATMAP
  queryVolumeTrend: Array<{ date: string; queries: number; avg_time_ms: number }>
  topSlowQueries: typeof MOCK_SF_TOP_SLOW_QUERIES
  taskReliability: Array<{ date: string; total: number; succeeded: number; failed: number }>
  loginFailures: Array<{ date: string; failed_logins: number }>
  storageGrowth: Array<{ date: string; storage_tb: number }>
  alert: string
}

// ── Empty / default constants ─────────────────────────────

const EMPTY_COST_SUMMARY: CostSummaryShape = {
  monthly_cost: 0, warehouse_spend: 0, efficient_pct: 0, wasted_spend: 0, budget: 0,
  cost_today: 0, cost_mtd: 0, avg_daily_burn_30d: 0, remaining_balance: 0, days_remaining: 0,
  optimization_opportunity_currency_7d: 0,
}

const EMPTY_PLATFORM_SUMMARY: PlatformSummaryShape = {
  long_queries: 0, task_failures: 0, warehouse_util_pct: 0, query_errors: 0,
  queries_today: 0, query_success_pct: 0, avg_query_time_ms: 0, warehouse_credits_used: 0,
  failed_logins: 0,
}

// ── Sub-screen 1: Cost & Efficiency ──────────────────────

const CostEfficiencyScreen: React.FC<{ data: CostData; costDayLabel: string }> = ({ data, costDayLabel }) => {
  const s = data.summary
  const rowPanelHeight = 430

  const runtimeMin = (ms: number) => `${Math.round(ms / 60000)}m`
  const efficiencyLabel = (v: 'good' | 'warn' | 'bad') => {
    if (v === 'good') return 'Efficient'
    if (v === 'warn') return 'Needs Review'
    return 'Inefficient'
  }
  const efficiencyDescription = (v: 'good' | 'warn' | 'bad') => {
    if (v === 'good') return 'Low credits per query and healthy runtime'
    if (v === 'warn') return 'Moderate cost or runtime, watch for drift'
    return 'High cost per query or consistently long runtime'
  }
  const efficiencyIcon = (v: 'good' | 'warn' | 'bad') => {
    if (v === 'good') return 'v'
    if (v === 'warn') return '!'
    return 'x'
  }
  const efficiencyColor = (v: 'good' | 'warn' | 'bad') => {
    if (v === 'good') return '#2e7d32'
    if (v === 'warn') return '#f57c00'
    return '#c62828'
  }
  const topCostlyTrend = data.topCostlyJobs.map((item: any, index: number) => ({
    name: item.pipeline || `Job ${index + 1}`,
    credits_used: Number(item.run_spend ?? 0),
    avg_runtime_ms: Number(item.run_cost ?? 0),
  }))
  const warehouseEfficiencyBars = data.warehouseCostEfficiency.map((item) => ({
    warehouse: item.warehouse_name,
    total_credits: Number(item.total_credits ?? 0),
    query_count: Number(item.query_count ?? 0),
    credits_per_query: Number(item.credits_per_query ?? 0),
    avg_runtime_min: Math.round((Number(item.avg_runtime_ms ?? 0) / 60000) * 10) / 10,
  }))

  const warehouseEffCols: ColumnDef[] = [
    { key: 'warehouse_name', header: 'Query / Job', width: 170 },
    {
      key: 'total_credits',
      header: 'Credits',
      width: 90,
      render: (row) => <Typography sx={{ fontSize: '12px', fontWeight: 600 }}>{Number(row.total_credits ?? 0).toLocaleString()}</Typography>,
    },
    {
      key: 'query_count',
      header: 'Query Count',
      width: 110,
      render: (row) => <Typography sx={{ fontSize: '12px' }}>{Number(row.query_count ?? 0).toLocaleString()}</Typography>,
    },
    {
      key: 'avg_runtime_ms',
      header: 'Avg Runtime',
      width: 95,
      render: (row) => <Typography sx={{ fontSize: '12px' }}>{runtimeMin(row.avg_runtime_ms)}</Typography>,
    },
    {
      key: 'efficiency',
      header: 'Efficiency',
      width: 90,
      render: (row) => (
        <Tooltip
          title={`${efficiencyLabel(row.efficiency)}: ${efficiencyDescription(row.efficiency)}`}
          arrow
          placement="top"
        >
          <Typography sx={{ fontSize: '12px', fontWeight: 700, color: efficiencyColor(row.efficiency), cursor: 'help' }}>
            {efficiencyIcon(row.efficiency)}
          </Typography>
        </Tooltip>
      ),
    },
  ]

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>

      {/* Alert */}
      {/* <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, backgroundColor: '#fff8e1', border: '1px solid #fdd835', borderRadius: 2, px: 2, py: 1 }}>
        <WarningAmberIcon sx={{ fontSize: 16, color: '#f57c00' }} />
        <Typography sx={{ fontSize: '12px', color: '#795548' }}>
          Warehouse with highest cost per query detected — consider resizing or tuning.
        </Typography>
      </Box> */}

      {/* 6 KPIs matching screenshot */}
      <StatCardGrid items={[
        { label: costDayLabel,           value: fmtKpiDollar(s.cost_today),                           color: '#1565c0', bg: '#e3f2fd' },
        { label: costDayLabel === 'Cost Today' ? 'Cost MTD' : 'Cost', value: fmtKpiDollar(s.cost_mtd), color: '#37474f', bg: '#f5f5f5' },
        { label: costDayLabel === 'Cost Today' ? 'Avg Daily Burn (30d)' : 'Daily Burn', value: fmtKpiDollar(s.avg_daily_burn_30d), color: '#6a1b9a', bg: '#f3e5f5' },
        { label: 'Remaining Balance',    value: fmtCompactUsd(s.remaining_balance),                   color: '#2e7d32', bg: '#e8f5e9' },
        { label: 'Days Remaining',       value: s.days_remaining != null ? String(s.days_remaining) : '—', color: '#e65100', bg: '#fff3e0' },
        { label: costDayLabel === 'Cost Today' ? 'Savings Opp (7d)' : 'Savings Opp', value: fmtKpiDollar(s.optimization_opportunity_currency_7d), color: '#c62828', bg: '#fce4ec' },
      ]} />

      {/* Row 1: Cost by Service Type + Daily Cost Trend */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, gap: 2, alignItems: 'stretch', '& > *': { minWidth: 0 } }}>
        <Paper elevation={0} sx={{ p: 2, minWidth: 0, overflow: 'hidden', border: '1px solid #e8ecf1', borderTop: `3px solid ${TRUIST.purple}`, borderRadius: 2 }}>
          <Typography sx={{ fontSize: '12px', fontWeight: 600, mb: 1, color: '#1a2535' }}>Cost by Service Type</Typography>
          <Box sx={{ minHeight: 180, minWidth: 0, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <DonutChart
              data={data.byPipeline.map(item => ({
                name: item.name,
                value: item.cost,
                color: item.color,
              }))}
              size={190}
              innerRadius={34}
              outerRadius={62}
              centerLabel={fmtK(data.byPipeline.reduce((sum, item) => sum + item.cost, 0))}
              showLegend
              valueFormatter={fmtK}
              tooltipTitleFormatter={(item) => `Service: ${item.name}`}
            />
          </Box>
        </Paper>

        <Paper elevation={0} sx={{ p: 2, minWidth: 0, overflow: 'hidden', border: '1px solid #e8ecf1', borderTop: `3px solid ${TRUIST.dusk}`, borderRadius: 2 }}>
          <Typography sx={{ fontSize: '12px', fontWeight: 600, mb: 1, color: '#1a2535' }}>Daily Cost Trend</Typography>
          <Box sx={{ height: 206, width: '100%', minWidth: 0, overflow: 'visible', pb: 1 }}>
            <ComposedBarLineChart
              data={data.byDuration}
              xKey="bucket"
              bars={[{ key: 'cost', color: '#1976d2', label: 'Cost ($)' }]}
              lines={[{ key: 'cost', color: '#6a1b9a', label: 'Cost Trend', yAxisId: 'right' }]}
            />
          </Box>
        </Paper>
      </Box>

      {/* Row 2: Warehouse Cost Efficiency + Top Costly Queries/Jobs */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, gap: 2, alignItems: 'stretch', '& > *': { minWidth: 0 } }}>
        <Paper elevation={0} sx={{ p: 2, minWidth: 0, overflow: 'clip', border: '1px solid #e8ecf1', borderTop: `3px solid ${TRUIST.sky}`, borderRadius: 2, height: rowPanelHeight, display: 'flex', flexDirection: 'column' }}>
          <Typography sx={{ fontSize: '12px', fontWeight: 600, mb: 1, color: '#1a2535' }}>Warehouse Cost Efficiency</Typography>
          <Box sx={{ height: 180, minWidth: 0, overflow: 'hidden', flexShrink: 0 }}>
            <ComposedBarLineChart
              data={warehouseEfficiencyBars}
              xKey="warehouse"
              bars={[
                { key: 'total_credits', label: 'Credits', color: '#1976d2' },
                { key: 'query_count', label: 'Query Count', color: '#43a047' },
              ]}
              lines={[{ key: 'credits_per_query', label: 'Credits / Query', color: '#e65100', yAxisId: 'right' }]}
              height={180}
              margin={{ top: 5, right: 35, left: 0, bottom: 20 }}
            />
          </Box>
          <Box sx={{ mt: 1, width: '100%', minWidth: 0, flex: 1, minHeight: 0, pb: 1 }}>
            <DataTable columns={warehouseEffCols} rows={data.warehouseCostEfficiency} maxHeight={120} tableMinWidth={760} compact />
          </Box>
          <Box sx={{ mt: 0.75, borderTop: '1px solid #e8ecf1', pt: 0.75, display: 'flex', flexWrap: 'wrap', gap: 1.25, flexShrink: 0 }}>
            {([
              { key: 'good', icon: 'v', label: 'Efficient', color: '#2e7d32' },
              { key: 'warn', icon: '!', label: 'Needs Review', color: '#f57c00' },
              { key: 'bad', icon: 'x', label: 'Inefficient', color: '#c62828' },
            ] as const).map(item => (
              <Box key={item.key} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Typography sx={{ fontSize: '11px', fontWeight: 700, color: item.color }}>{item.icon}</Typography>
                <Typography sx={{ fontSize: '10px', color: '#607d8b' }}>{item.label}</Typography>
              </Box>
            ))}
          </Box>
        </Paper>

        <Paper elevation={0} sx={{ minWidth: 0, border: '1px solid #e8ecf1', borderTop: `3px solid ${TRUIST.charcoal}`, borderRadius: 2, overflow: 'hidden', height: rowPanelHeight, display: 'flex', flexDirection: 'column' }}>
          <Box sx={{ px: 2, py: 1.5, backgroundColor: '#fafafa', borderBottom: '1px solid #e8ecf1' }}>
            <Typography sx={{ fontSize: '13px', fontWeight: 700, color: '#1a2535' }}>Top Costly Queries / Jobs</Typography>
          </Box>
          <Box sx={{ width: '100%', minWidth: 0, minHeight: 0, flex: 1, overflow: 'hidden', p: 2, pt: 1.5 }}>
            {topCostlyTrend.length > 0 ? (
              <TrendLineChart
                data={topCostlyTrend}
                xKey="name"
                lines={[
                  { key: 'credits_used', label: 'Credits Used', color: '#1976d2' },
                  { key: 'avg_runtime_ms', label: 'Avg Runtime (ms)', color: '#f57c00' },
                ]}
                height={320}
              />
            ) : (
              <Box sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Typography sx={{ color: '#9aa5b1', fontSize: '12px' }}>No top costly query/job trend data</Typography>
              </Box>
            )}
          </Box>
        </Paper>
      </Box>

      {/* Row 3: Stage Storage Trend */}
      <Paper elevation={0} sx={{ p: 2, minWidth: 0, overflow: 'hidden', border: '1px solid #e8ecf1', borderTop: `3px solid ${TRUIST.darkGray}`, borderRadius: 2 }}>
        <Typography sx={{ fontSize: '12px', fontWeight: 600, mb: 1, color: '#1a2535' }}>Stage Storage Trend</Typography>
        <Box sx={{ height: 160, width: '100%', minWidth: 0, overflow: 'hidden' }}>
          {data.storageGrowth.length > 0 ? (
            <TrendLineChart
              data={data.storageGrowth}
              xKey="date"
              lines={[{ key: 'storage_tb', label: 'Storage (TB)', color: '#00838f' }]}
            />
          ) : (
            <Box sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Typography sx={{ color: '#9aa5b1', fontSize: '12px' }}>No stage storage trend data</Typography>
            </Box>
          )}
        </Box>
      </Paper>
    </Box>
  )
}

// ── Sub-screen 2: Platform Intelligence ──────────────────

const PlatformIntelligenceScreen: React.FC<{ data: PlatformData; queriesDayLabel: string; analyticsLoading: boolean }> = ({ data, queriesDayLabel, analyticsLoading }) => {
  const s = data.summary
  const rowPanelHeight = 430
  const avgQuerySeconds = Math.round(((s.avg_query_time_ms ?? 0) / 1000) * 10) / 10

  const heatRows   = data.heatmap.map(r => r.row)
  const heatCols   = data.heatmap[0]?.cells.map(c => c.col) ?? []
  const heatValues = data.heatmap.map(r => r.cells.map(c => c.value))
  const queryVolumeTrendSeconds = data.queryVolumeTrend.map((point) => ({
    ...point,
    avg_time_seconds: Math.round(((point.avg_time_ms ?? 0) / 1000) * 10) / 10,
  }))

  const utilColor = (v: number) => {
    if (v >= 95) return '#4a3763'
    if (v >= 85) return '#67517e'
    if (v >= 75) return '#7f6a95'
    if (v >= 65) return '#9787ad'
    if (v >= 55) return '#5fa9bc'
    if (v >= 45) return '#6e7af4'
    if (v >= 35) return '#507ce3'
    if (v >= 25) return '#0a576c'
    if (v >= 15) return '#a4aaf0'
    if (v >= 5) return '#4c7db9'
    return '#9ad5f4'
  }

  const heatLegend = [
    { label: '95-100%', color: '#4a3763' },
    { label: '85-94%', color: '#67517e' },
    { label: '75-84%', color: '#7f6a95' },
    { label: '65-74%', color: '#9787ad' },
    { label: '55-64%', color: '#5fa9bc' },
    { label: '45-54%', color: '#79bdd0' },
    { label: '35-44%', color: '#92cddd' },
    { label: '25-34%', color: '#abd9e6' },
    { label: '15-24%', color: '#c2e2ec' },
    { label: '5-14%', color: '#d6e9f1' },
    { label: '0-4%', color: '#e7f0f5' },
  ]

  const formatQueryDuration = (durationMs?: number) => {
    const totalMinutes = Math.max(0, (Number(durationMs) || 0) / 60000)
    if (totalMinutes >= 10) return `${Math.round(totalMinutes)} min`
    return `${totalMinutes.toFixed(1)} min`
  }

  const queryCols: ColumnDef[] = [
    { key: 'pipeline',   header: 'Pipeline',      width: 180 },
    { key: 'start_date', header: 'Start Date',    width: 105 },
    { key: 'error_type', header: 'Error Type',     width: 110,
      render: (row) => {
        const errorType = row.error_type || 'UNKNOWN'
        const errorDescriptions: Record<string, string> = {
          'TIMEOUT': 'Query exceeded time limit',
          'SPILL': 'Query memory spilled to disk',
          'LOCK_WAIT': 'Query waiting for lock',
          'ROW_ACCESS': 'Row-level access issue',
          'ERROR': 'Query execution error',
          'SLOW': 'Query slower than expected',
        }
        return (
          <Tooltip title={errorDescriptions[errorType] || errorType} arrow placement="top">
            <Box sx={{ width: 64, height: 14, backgroundColor: ERROR_COLOR[errorType] ?? '#bbb', borderRadius: 2, cursor: 'help' }} />
          </Tooltip>
        )
      } },
    { key: 'last_run',   header: 'Last Run',       width: 80 },
    { key: 'sla_ok',     header: 'SLA Status',    width: 90,
      render: (row) => {
        const slaStatus = row.sla_ok 
          ? 'SLA Compliance: Within service level agreement'
          : 'SLA Violation: Exceeded service level agreement'
        return (
          <Tooltip title={slaStatus} arrow placement="top">
            <Box sx={{ cursor: 'help' }}>
              {row.sla_ok
                ? <CheckCircleIcon sx={{ fontSize: 16, color: '#2e7d32' }} />
                : <CancelIcon sx={{ fontSize: 16, color: '#c62828' }} />
              }
            </Box>
          </Tooltip>
        )
      } },
    { key: 'fix',        header: 'Suggested Fix', width: 160 },
    {
      key: 'duration_ms',
      header: 'Duration',
      width: 100,
      render: (row) => <Typography sx={{ fontSize: '12px' }}>{formatQueryDuration(row.duration_ms)}</Typography>,
    },
  ]

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>

      {/* Alert */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, backgroundColor: '#fff8e1', border: '1px solid #fdd835', borderRadius: 2, px: 2, py: 1 }}>
        <WarningAmberIcon sx={{ fontSize: 16, color: '#f57c00' }} />
        <Typography sx={{ fontSize: '12px', color: '#795548' }}>{data.alert}</Typography>
      </Box>

      {/* 6 KPIs matching screenshot */}
      <StatCardGrid items={[
        { label: queriesDayLabel,   value: (s.queries_today ?? 0).toLocaleString(),            color: '#1565c0', bg: '#e3f2fd' },
        { label: 'Query Success %', value: `${s.query_success_pct ?? 0}%`,                     color: '#2e7d32', bg: '#e8f5e9' },
        { label: 'Avg Query Time',  value: `${avgQuerySeconds.toLocaleString()} sec`,          color: '#37474f', bg: '#f5f5f5' },
        { label: 'Credits Used',    value: (s.warehouse_credits_used ?? 0).toLocaleString(),   color: '#6a1b9a', bg: '#f3e5f5' },
        { label: 'Failed Tasks',    value: s.task_failures,                                    color: '#e65100', bg: '#fff3e0' },
        { label: 'Failed Logins',   value: s.failed_logins ?? 0,                               color: '#c62828', bg: '#fce4ec' },
      ]} />

      {/* Row 1: Warehouse Heatmap + Query Volume & Performance */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '2fr 1fr' }, gap: 2, alignItems: 'stretch', '& > *': { minWidth: 0 } }}>
        <Paper elevation={0} sx={{ p: 2, minWidth: 0, overflow: 'hidden', border: '1px solid #e8ecf1', borderTop: `3px solid ${TRUIST.purple}`, borderRadius: 2, height: 270, display: 'flex', flexDirection: 'column' }}>
          <Typography sx={{ fontSize: '12px', fontWeight: 600, mb: 1, color: '#1a2535' }}>Warehouse Usage Heatmap</Typography>
          <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden', pr: 0.5 }}>
            <HeatmapGrid
              rows={heatRows}
              cols={heatCols}
              values={heatValues}
              colorScale={utilColor}
              showRowLabels
              rowLabels={heatRows}
              showLegend={false}
            />
          </Box>
          <Box sx={{ mt: 1.25, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {heatLegend.map((item) => (
              <Box key={item.label} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Box sx={{ width: 11, height: 11, borderRadius: '3px', backgroundColor: item.color }} />
                <Typography sx={{ fontSize: '10px', color: '#607d8b', fontWeight: 600 }}>
                  {item.label}
                </Typography>
              </Box>
            ))}
          </Box>
        </Paper>

        <Paper elevation={0} sx={{ p: 2, minWidth: 0, overflow: 'hidden', border: '1px solid #e8ecf1', borderTop: `3px solid ${TRUIST.sky}`, borderRadius: 2 }}>
          <Typography sx={{ fontSize: '12px', fontWeight: 600, mb: 1, color: '#1a2535' }}>Query Volume & Performance</Typography>
          <Box sx={{ height: 196, width: '100%', minWidth: 0, overflow: 'visible', pb: 1 }}>
            {analyticsLoading && data.queryVolumeTrend.length === 0 ? (
              <Box sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
                <CircularProgress size={18} sx={{ color: '#1976d2' }} />
                <Typography sx={{ fontSize: '12px', color: '#607d8b' }}>Loading query analytics...</Typography>
              </Box>
            ) : (
              <ComposedBarLineChart
                data={queryVolumeTrendSeconds}
                xKey="date"
                bars={[{ key: 'queries', color: '#1976d2', label: 'Queries' }]}
                lines={[{ key: 'avg_time_seconds', color: '#e53935', label: 'Avg Query Time (sec)', yAxisId: 'right', unit: ' sec' }]}
                height={188}
                margin={{ top: 5, right: 35, left: 0, bottom: 24 }}
              />
            )}
          </Box>
        </Paper>
      </Box>

      {/* Row 2: Top Slow Queries + Task Reliability */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1.5fr 1fr' }, gap: 2, alignItems: 'stretch', '& > *': { minWidth: 0 } }}>
        <Paper elevation={0} sx={{ minWidth: 0, border: '1px solid #e8ecf1', borderTop: `3px solid ${TRUIST.charcoal}`, borderRadius: 2, overflow: 'clip', height: rowPanelHeight, display: 'flex', flexDirection: 'column' }}>
          <Box sx={{ px: 2, py: 1.5, backgroundColor: '#fafafa', borderBottom: '1px solid #e8ecf1' }}>
            <Typography sx={{ fontSize: '13px', fontWeight: 700, color: '#1a2535' }}>Top Slow Queries</Typography>
          </Box>
          <Box sx={{ width: '100%', minWidth: 0, minHeight: 0, flex: 1, p: 2, pt: 1.5, pb: 1, display: 'flex', flexDirection: 'column' }}>
            {analyticsLoading && data.topSlowQueries.length === 0 ? (
              <Box sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
                <CircularProgress size={18} sx={{ color: TRUIST.charcoal }} />
                <Typography sx={{ fontSize: '12px', color: '#607d8b' }}>Loading slow query patterns...</Typography>
              </Box>
            ) : (
              <>
                <Box sx={{ flex: 1, minHeight: 0, mb: 1 }}>
                  <DataTable columns={queryCols} rows={data.topSlowQueries} maxHeight={220} tableMinWidth={1040} compact />
                </Box>
                <Box sx={{ borderTop: '1px solid #e8ecf1', pt: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5, fontSize: '11px', color: '#666' }}>
                  <Box>
                    <Typography sx={{ fontSize: '10px', fontWeight: 700, color: '#1a2535', mb: 0.5, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Error Type Legend</Typography>
                    {[
                      { type: 'TIMEOUT', desc: 'Query timed out', color: '#e53935' },
                      { type: 'SPILL', desc: 'Memory spilled to disk', color: '#fb8c00' },
                      { type: 'LOCK_WAIT', desc: 'Waiting for lock', color: '#fdd835' },
                    ].map(item => (
                      <Box key={item.type} sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.5 }}>
                        <Box sx={{ width: 12, height: 8, backgroundColor: item.color, borderRadius: 1 }} />
                        <Typography sx={{ fontSize: '10px', color: '#666' }}>{item.type}: {item.desc}</Typography>
                      </Box>
                    ))}
                  </Box>
                  <Box>
                    <Typography sx={{ fontSize: '10px', fontWeight: 700, color: '#1a2535', mb: 0.5, textTransform: 'uppercase', letterSpacing: '0.5px' }}>SLA Status Indicator</Typography>
                    {[
                      { icon: '✓', desc: 'SLA Compliant - Within agreement', color: '#2e7d32' },
                      { icon: '✕', desc: 'SLA Violated - Exceeded limit', color: '#c62828' },
                    ].map((item, i) => (
                      <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.5 }}>
                        <Typography sx={{ fontSize: '12px', fontWeight: 700, color: item.color }}>{item.icon}</Typography>
                        <Typography sx={{ fontSize: '10px', color: '#666' }}>{item.desc}</Typography>
                      </Box>
                    ))}
                  </Box>
                </Box>
              </>
            )}
          </Box>
        </Paper>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0, height: '100%' }}>
          <Paper elevation={0} sx={{ p: 2, minWidth: 0, overflow: 'hidden', border: '1px solid #e8ecf1', borderTop: `3px solid ${TRUIST.dusk}`, borderRadius: 2, height: rowPanelHeight, display: 'flex', flexDirection: 'column' }}>
            <Typography sx={{ fontSize: '12px', fontWeight: 600, mb: 1, color: '#1a2535' }}>Task Reliability</Typography>
            <Box sx={{ flex: 1, minHeight: 220, width: '100%', minWidth: 0, overflow: 'hidden' }}>
              <ComposedBarLineChart
                data={data.taskReliability}
                xKey="date"
                bars={[
                  { key: 'succeeded', color: '#43a047', label: 'Succeeded', stackId: 'taskReliability' },
                  { key: 'failed',    color: '#e53935', label: 'Failed', stackId: 'taskReliability' },
                ]}
                lines={[]}
              />
            </Box>
          </Paper>
        </Box>
      </Box>

      {/* Row 3: Login Failures + Storage Growth */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, gap: 2, alignItems: 'stretch', '& > *': { minWidth: 0 } }}>
        <Paper elevation={0} sx={{ p: 2, minWidth: 0, overflow: 'hidden', border: '1px solid #e8ecf1', borderTop: `3px solid ${TRUIST.sky}`, borderRadius: 2 }}>
          <Typography sx={{ fontSize: '12px', fontWeight: 600, mb: 1, color: '#1a2535' }}>Login Failures Trend</Typography>
          <Box sx={{ height: 160, width: '100%', minWidth: 0, overflow: 'hidden' }}>
            {data.loginFailures.length > 0 ? (
              <TrendLineChart
                data={data.loginFailures}
                xKey="date"
                lines={[{ key: 'failed_logins', label: 'Failed Logins', color: '#f57c00' }]}
              />
            ) : (
              <Box sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Typography sx={{ color: '#9aa5b1', fontSize: '12px' }}>No login failure trend data</Typography>
              </Box>
            )}
          </Box>
        </Paper>

        <Paper elevation={0} sx={{ p: 2, minWidth: 0, overflow: 'hidden', border: '1px solid #e8ecf1', borderTop: `3px solid ${TRUIST.darkGray}`, borderRadius: 2 }}>
          <Typography sx={{ fontSize: '12px', fontWeight: 600, mb: 1, color: '#1a2535' }}>Storage Growth Trend</Typography>
          <Box sx={{ height: 160, width: '100%', minWidth: 0, overflow: 'hidden' }}>
            {data.storageGrowth.length > 0 ? (
              <TrendLineChart
                data={data.storageGrowth}
                xKey="date"
                lines={[{ key: 'storage_tb', label: 'Storage (TB)', color: '#00838f' }]}
              />
            ) : (
              <Box sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Typography sx={{ color: '#9aa5b1', fontSize: '12px' }}>No storage growth trend data</Typography>
              </Box>
            )}
          </Box>
        </Paper>
      </Box>
    </Box>
  )
}

// ── Main exported component ───────────────────────────────

type SubTab = 'cost' | 'platform'

export const SnowflakeDashboardTab: React.FC<{ onOpenAgent?: (agentId: string) => void }> = ({ onOpenAgent }) => {
  const { useMock } = useMockData()
  const [subTab, setSubTab] = useState<SubTab>('platform')
  const [days, setDays] = useState(30)
  const [sliderDays, setSliderDays] = useState(30)
  const [asOfOption, setAsOfOption] = useState<'sample' | 'current'>('sample')
  const [isLive, setIsLive] = useState(false)
  const [platformLoading, setPlatformLoading] = useState(true)
  const [platformAnalyticsLoading, setPlatformAnalyticsLoading] = useState(false)
  const [costLoading, setCostLoading] = useState(false)
  const todayIsoDate = toIsoDate(new Date())
  const selectedAsOfDate = asOfOption === 'sample' ? SAMPLE_AS_OF_DATE : shiftIsoDate(todayIsoDate, days)
  const queryParams = { asOf: selectedAsOfDate }
  const [costData, setCostData] = useState<CostData>({
    summary: EMPTY_COST_SUMMARY,
    byPipeline: [],
    scatter: [],
    warehouseCostEfficiency: [],
    byDuration: [],
    topCostlyJobs: [],
    storageGrowth: [],
  })

  const [platformData, setPlatformData] = useState<PlatformData>({
    summary: EMPTY_PLATFORM_SUMMARY,
    heatmap: [],
    queryVolumeTrend: [],
    topSlowQueries: [],
    taskReliability: [],
    loginFailures: [],
    storageGrowth: [],
    alert: 'Loading live Snowflake data...',
  })

  useEffect(() => {
    setSliderDays(days)
  }, [days])

  useEffect(() => {
    let alive = true
    setIsLive(false)
    setPlatformLoading(true)
    setPlatformAnalyticsLoading(false)
    setCostLoading(false)

    if (useMock) {
      setCostData({
        summary:       MOCK_SF_COST_SUMMARY as CostSummaryShape,
        byPipeline:    MOCK_SF_COST_BY_PIPELINE,
        scatter:       MOCK_SF_COST_SCATTER,
        warehouseCostEfficiency: MOCK_SF_WAREHOUSE_COST_EFFICIENCY,
        byDuration:    MOCK_SF_COST_BY_DURATION,
        topCostlyJobs: MOCK_SF_TOP_COSTLY_JOBS,
        storageGrowth: MOCK_SF_STORAGE_GROWTH,
      })
      setPlatformData({
        summary:          MOCK_SF_PLATFORM_SUMMARY as PlatformSummaryShape,
        heatmap:          MOCK_SF_HEATMAP,
        queryVolumeTrend: MOCK_SF_QUERY_VOLUME_TREND,
        topSlowQueries:   MOCK_SF_TOP_SLOW_QUERIES,
        taskReliability:  MOCK_SF_TASK_RELIABILITY,
        loginFailures:    MOCK_SF_LOGIN_FAILURES,
        storageGrowth:    MOCK_SF_STORAGE_GROWTH,
        alert:            MOCK_SF_ALERT,
      })
      setPlatformLoading(false)
      return () => { alive = false }
    }

    // Live mode: reset to avoid stale data
    setCostData({
      summary: EMPTY_COST_SUMMARY,
      byPipeline: [], scatter: [], warehouseCostEfficiency: [], byDuration: [], topCostlyJobs: [], storageGrowth: [],
    })
    setPlatformData({
      summary: EMPTY_PLATFORM_SUMMARY,
      heatmap: [], queryVolumeTrend: [], topSlowQueries: [],
      taskReliability: [], loginFailures: [], storageGrowth: [],
      alert: 'Loading live Snowflake data...',
    })

    const valueOr = <T,>(result: PromiseSettledResult<T>, fallback: T): T =>
      result.status === 'fulfilled' ? result.value : fallback

    setPlatformAnalyticsLoading(true)

    Promise.allSettled([
      snowflakeService.getPlatformSummary(queryParams),   // 0
      snowflakeService.getWarehouseHeatmap(queryParams),  // 1
      snowflakeService.getTaskReliability(queryParams),   // 2
      snowflakeService.getLoginFailures(queryParams),     // 3
      snowflakeService.getStorageGrowth(queryParams),     // 4
    ]).then((results) => {
      if (!alive) return

      const [platformSummary, heatmap, taskReliability, loginFailures, storageGrowth] = results

      const successCount = results.filter(r => r.status === 'fulfilled').length
      setPlatformData(prev => ({
        ...prev,
        summary:         valueOr(platformSummary, EMPTY_PLATFORM_SUMMARY),
        heatmap:         valueOr(heatmap, []),
        taskReliability: valueOr(taskReliability, []),
        loginFailures:   valueOr(loginFailures, []),
        storageGrowth:   valueOr(storageGrowth, []),
        alert: successCount > 0
          ? 'Core Snowflake metrics loaded. Query analytics are still loading.'
          : 'Unable to load live Snowflake data. Check server query errors.',
      }))
      setPlatformLoading(false)
      if (successCount > 0) setIsLive(true)
    })

    Promise.allSettled([
      snowflakeService.getTopSlowQueries(queryParams),
      snowflakeService.getQueryVolumeTrend(queryParams),
    ]).then((results) => {
      if (!alive) return

      const [topSlowQueries, queryVolumeTrend] = results
      const successCount = results.filter(r => r.status === 'fulfilled').length

      setPlatformData(prev => ({
        ...prev,
        queryVolumeTrend: valueOr(queryVolumeTrend, prev.queryVolumeTrend),
        topSlowQueries: valueOr(topSlowQueries, prev.topSlowQueries),
        alert: successCount > 0 ? 'Live Snowflake metrics loaded from database queries.' : prev.alert,
      }))
      setPlatformAnalyticsLoading(false)
      if (successCount > 0) setIsLive(true)
    })
    return () => { alive = false }
  }, [useMock, selectedAsOfDate])

  useEffect(() => {
    if (useMock) return

    let alive = true
    setCostLoading(true)

    Promise.allSettled([
      snowflakeService.getCostSummary(queryParams),       // 0
      snowflakeService.getCostByPipeline(queryParams),    // 1
      snowflakeService.getCostScatter(queryParams),       // 2
      snowflakeService.getWarehouseCostEfficiency(queryParams), // 3
      snowflakeService.getCostByDuration(queryParams),    // 4
      snowflakeService.getTopCostlyJobs(queryParams),     // 5
      snowflakeService.getStorageGrowth(queryParams),     // 6
    ]).then((results) => {
      if (!alive) return

      try {
        const [summary, byPipeline, scatter, warehouseCostEfficiency, byDuration, topCostlyJobs, storageGrowth] = results

        const valueOr = <T,>(result: PromiseSettledResult<T>, fallback: T): T =>
          result.status === 'fulfilled' ? result.value : fallback

        setCostData({
          summary:       valueOr(summary,       EMPTY_COST_SUMMARY),
          byPipeline:    valueOr(byPipeline,    []),
          scatter:       valueOr(scatter,       []),
          warehouseCostEfficiency: valueOr(warehouseCostEfficiency, []),
          byDuration:    valueOr(byDuration,    []),
          topCostlyJobs: valueOr(topCostlyJobs, []),
          storageGrowth: valueOr(storageGrowth, []),
        })

        const successCount = results.filter(r => r.status === 'fulfilled').length
        if (successCount > 0) setIsLive(true)
      } finally {
        if (alive) setCostLoading(false)
      }
    })

    return () => {
      alive = false
    }
  }, [useMock, selectedAsOfDate])

  const SUB_TABS: { key: SubTab; label: string; icon: React.ReactElement; accent: string }[] = [
    { key: 'platform', label: 'Platform Intelligence', icon: <QueryStatsIcon />,  accent: TRUIST.purple },
    { key: 'cost',     label: 'FinOps',                icon: <AttachMoneyIcon />, accent: TRUIST.dusk },
  ]

  const loading = subTab === 'platform' ? platformLoading : costLoading
  const previewAsOfDate = asOfOption === 'sample' ? SAMPLE_AS_OF_DATE : shiftIsoDate(todayIsoDate, sliderDays)
  const sliderValue = asOfOption === 'sample' ? 0 : sliderDays
  const sliderLabel = asOfOption === 'sample' ? 'Sample Date' : formatDisplayDate(previewAsOfDate)
  const isCurrentDateOnly = asOfOption === 'current' && days === 0
  const costDayLabel = isCurrentDateOnly ? 'Cost' : 'Cost Today'
  const queriesDayLabel =  'Queries Today' 

  const handleLookbackChange = (_: Event, value: number | number[]) => {
    const nextDays = Number(Array.isArray(value) ? value[0] : value)
    setSliderDays(nextDays)
    setAsOfOption('current')
  }

  const handleLookbackCommit = (_: Event | React.SyntheticEvent, value: number | number[]) => {
    const nextDays = Number(Array.isArray(value) ? value[0] : value)
    setSliderDays(nextDays)
    setDays(nextDays)
    setAsOfOption('current')
  }

  const handleSelectSampleDate = () => {
    setSliderDays(0)
    setAsOfOption('sample')
  }

  const handleSelectCurrentDate = () => {
    setSliderDays(0)
    setDays(0)
    setAsOfOption('current')
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {/* Header bar */}
      <Paper
        elevation={0}
        sx={{ borderRadius: 0, borderBottom: '1px solid #e8ecf1', px: 2, pt: 1.5, pb: 0, backgroundColor: '#fff', position: 'sticky', top: 0, zIndex: 10, boxShadow: '0 2px 8px rgba(0,0,0,0.07)' }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, mb: 1, flexWrap: 'wrap' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <AcUnitIcon sx={{ color: TRUIST.purple, fontSize: 20 }} />
            <Typography sx={{ fontWeight: 700, fontSize: '14px', color: '#1a2535' }}>
              Snowflake Analytics
            </Typography>
            {useMock
              ? <Chip label="MOCK DATA" size="small" sx={{ fontSize: '9px', height: 16, backgroundColor: TRUIST.shell, color: TRUIST.dusk, fontWeight: 700, border: `1px solid ${TRUIST.dawn}` }} />
              : isLive
              ? <Chip label="LIVE" size="small" sx={{ fontSize: '9px', height: 16, backgroundColor: TRUIST.mist, color: TRUIST.purple, fontWeight: 700, border: `1px solid ${TRUIST.sky}` }} />
              : <Chip label="LIVE (NO DATA)" size="small" sx={{ fontSize: '9px', height: 16, backgroundColor: '#efedf4', color: TRUIST.charcoal, fontWeight: 700, border: `1px solid ${TRUIST.lightGray}` }} />
            }
          </Box>
          {useMock && onOpenAgent && (
            <Button
              size="small"
              variant="contained"
              startIcon={<Box component="img" src={AGENTS.snowflake.icon} alt="Snowflake agent icon" sx={{ width: 14, height: 14, borderRadius: '50%', objectFit: 'contain', display: 'block' }} />}
              onClick={() => onOpenAgent('snowflake')}
              sx={{
                backgroundColor: TRUIST.purple,
                textTransform: 'none',
                fontSize: '11px',
                fontWeight: 700,
                height: 26,
                px: 1.5,
                color: TRUIST.white,
                '&:hover': { backgroundColor: TRUIST.dusk },
              }}
            >
              Ask Snowflake Agent
            </Button>
          )}
        </Box>

        {/* Sub-tabs and controls */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, flexWrap: { xs: 'wrap', md: 'nowrap' } }}>
          <Box sx={{ display: 'flex', gap: 0, flex: 1, minWidth: 0, overflowX: 'auto', overflowY: 'hidden', scrollbarWidth: 'none', '&::-webkit-scrollbar': { display: 'none' } }}>
            {SUB_TABS.map(t => (
              <Box
                key={t.key}
                onClick={() => setSubTab(t.key)}
                sx={{
                  display: 'flex', alignItems: 'center', gap: 0.75,
                  px: 2, py: 1,
                  cursor: 'pointer',
                  flexShrink: 0,
                  whiteSpace: 'nowrap',
                  borderBottom: subTab === t.key ? `3px solid ${t.accent}` : '3px solid transparent',
                  color: subTab === t.key ? t.accent : '#78909c',
                  '&:hover': { color: t.accent },
                  transition: 'all 0.15s',
                }}
              >
                {React.cloneElement(t.icon, { sx: { fontSize: 15 } })}
                <Typography sx={{ fontSize: '12px', fontWeight: subTab === t.key ? 700 : 400 }}>
                  {t.label}
                </Typography>
              </Box>
            ))}
          </Box>

          {!useMock && (
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 1.5, flexWrap: 'nowrap', py: 0.5, flexShrink: 0, minWidth: { xs: '100%', md: 'auto' } }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0, minWidth: { xs: 0, md: 220 } }}>
                <Typography sx={{ fontSize: '11px', color: asOfOption === 'sample' ? '#90a4ae' : '#777', whiteSpace: 'nowrap', flexShrink: 0 }}>{sliderLabel}</Typography>
                <Slider
                  min={0}
                  max={30}
                  step={1}
                  value={sliderValue}
                  onChange={handleLookbackChange}
                  onChangeCommitted={handleLookbackCommit}
                  valueLabelDisplay="auto"
                  sx={{
                    color: TRUIST.purple,
                    width: { xs: 120, md: 140, lg: 170 },
                    flexShrink: 0,
                    '& .MuiSlider-thumb': { width: 12, height: 12 },
                    '& .MuiSlider-rail': { opacity: 0.3 },
                  }}
                />
                <Typography sx={{ fontSize: '10px', color: '#bbb', whiteSpace: 'nowrap', flexShrink: 0 }}>30d</Typography>
              </Box>

              {onOpenAgent && (
                <Button
                  size="small"
                  variant="contained"
                  startIcon={<Box component="img" src={AGENTS.snowflake.icon} alt="Snowflake agent icon" sx={{ width: 14, height: 14, borderRadius: '50%', objectFit: 'contain', display: 'block' }} />}
                  onClick={() => onOpenAgent('snowflake')}
                  sx={{
                    backgroundColor: TRUIST.purple,
                    textTransform: 'none',
                    fontSize: '11px',
                    fontWeight: 700,
                    height: 26,
                    px: 1.5,
                    color: TRUIST.white,
                    flexShrink: 0,
                    whiteSpace: 'nowrap',
                    alignSelf: 'center',
                    '&:hover': { backgroundColor: TRUIST.dusk },
                  }}
                >
                  Ask Snowflake Agent
                </Button>
              )}
            </Box>
          )}
        </Box>

        {!useMock && (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 1, flexWrap: 'wrap', py: 0.5 }}>
            <Typography sx={{ fontSize: '10px', color: '#607d8b', fontWeight: 700, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
              Reference Date
            </Typography>
            <Chip
              size="small"
              label={formatDisplayDate(SAMPLE_AS_OF_DATE)}
              onClick={handleSelectSampleDate}
              sx={{
                fontSize: '10px',
                height: 22,
                fontWeight: 700,
                backgroundColor: asOfOption === 'sample' ? '#e3f2fd' : '#f4f7fb',
                color: asOfOption === 'sample' ? TRUIST.purple : TRUIST.dusk,
                border: asOfOption === 'sample' ? `1px solid ${TRUIST.dawn}` : `1px solid ${TRUIST.lightGray}`,
              }}
            />
            <Chip
              size="small"
              label="Current Date"
              onClick={handleSelectCurrentDate}
              sx={{
                fontSize: '10px',
                height: 22,
                fontWeight: 700,
                backgroundColor: asOfOption === 'current' ? TRUIST.mist : '#f4f7fb',
                color: asOfOption === 'current' ? TRUIST.charcoal : TRUIST.dusk,
                border: asOfOption === 'current' ? `1px solid ${TRUIST.sky}` : `1px solid ${TRUIST.lightGray}`,
              }}
            />
          </Box>
        )}

      </Paper>

      {/* Content */}
      <Box sx={{ p: 2, minWidth: 0, overflowX: 'hidden' }}>
        {loading ? (
          <Box sx={{ minHeight: 420, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.5, color: '#78909c' }}>
              <CircularProgress size={26} sx={{ color: TRUIST.purple }} />
              <Typography sx={{ fontSize: '12px', fontWeight: 600 }}>
                {subTab === 'platform' ? 'Loading Platform Intelligence...' : 'Loading FinOps...'}
              </Typography>
            </Box>
          </Box>
        ) : (
          <>
        {subTab === 'platform' && <PlatformIntelligenceScreen data={platformData} queriesDayLabel={queriesDayLabel} analyticsLoading={platformAnalyticsLoading} />}
        {subTab === 'cost'     && <CostEfficiencyScreen data={costData} costDayLabel={costDayLabel} />}
          </>
        )}
      </Box>
    </Box>
  )
}
