/**
 * SnowflakeDashboardTab
 * Two sub-screens toggled by inner tabs:
 *   1. Platform Intelligence
 *   2. Cost & Efficiency Overview
 */
import React, { useState, useEffect } from 'react'
import { Box, Typography, Paper, Chip, Tooltip, Button } from '@mui/material'
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

const fmtK = (n: number) => `$${(n / 1000).toFixed(1)}k`
const fmtDollar = (n?: number) => n != null ? `$${n.toLocaleString()}` : '—'

const ERROR_COLOR: Record<string, string> = {
  TIMEOUT:    '#e53935',
  SPILL:      '#fb8c00',
  LOCK_WAIT:  '#fdd835',
  ROW_ACCESS: '#42a5f5',
  ERROR:      '#e53935',
  SLOW:       '#fb8c00',
}

// ── Treemap (simple CSS grid based) ───────────────────────

const Treemap: React.FC<{ items: typeof MOCK_SF_COST_BY_PIPELINE }> = ({ items }) => {
  const total = items.reduce((s, i) => s + i.cost, 0)
  if (total === 0) {
    return (
      <Box sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Typography sx={{ color: '#aaa', fontSize: '12px' }}>No data</Typography>
      </Box>
    )
  }
  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: '2px', height: '100%', alignContent: 'flex-start' }}>
      {items.map(item => {
        const pct = (item.cost / total) * 100
        return (
          <Tooltip key={item.name} title={`${item.name}: ${fmtK(item.cost)}`}>
            <Box sx={{
              width: `${Math.max(pct * 1.5, 8)}%`,
              minHeight: pct > 20 ? '48%' : '22%',
              backgroundColor: item.color,
              borderRadius: '2px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'default',
              flexGrow: pct > 15 ? 1 : 0,
              opacity: 0.9,
              '&:hover': { opacity: 1 },
            }}>
              {pct > 12 && (
                <Typography sx={{ fontSize: '10px', color: '#fff', fontWeight: 700, textAlign: 'center', px: 0.5 }}>
                  {item.name.split('_')[0]}
                </Typography>
              )}
            </Box>
          </Tooltip>
        )
      })}
    </Box>
  )
}

// ── Scatter plot (SVG) ────────────────────────────────────

const BUCKETS = ['<30m', '30–45m', '45–60m', '60–75m', '>120m']

const ScatterPlot: React.FC<{ items: typeof MOCK_SF_COST_SCATTER }> = ({ items }) => {
  const W = 260, H = 140, PL = 36, PR = 8, PT = 8, PB = 28
  const minCost = 11, maxCost = 25
  const xStep = (W - PL - PR) / (BUCKETS.length - 1)
  const yScale = (c: number) => PT + (H - PT - PB) * (1 - (c - minCost) / (maxCost - minCost))
  const DOT_COLORS = ['#e53935', '#f57c00', '#fdd835', '#43a047', '#1e88e5', '#8e24aa', '#00acc1', '#795548']

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: 'visible' }}>
      {[12, 13, 22, 23].map(v => (
        <line key={v} x1={PL} x2={W - PR} y1={yScale(v)} y2={yScale(v)} stroke="#e0e0e0" strokeWidth={0.5} />
      ))}
      {[12, 13, 22, 23].map(v => (
        <text key={`yl${v}`} x={PL - 3} y={yScale(v) + 3} textAnchor="end" fontSize={7} fill="#999">{v}s</text>
      ))}
      {BUCKETS.map((b, i) => (
        <text key={b} x={PL + i * xStep} y={H - PB + 12} textAnchor="middle" fontSize={7} fill="#999">{b}</text>
      ))}
      {items.map((d, i) => {
        const xi = BUCKETS.indexOf(d.bucket.replace('30-45m', '30–45m').replace('45-60m', '45–60m').replace('60-75m', '60–75m'))
        const x = PL + (xi < 0 ? 0 : xi) * xStep + (Math.sin(i * 2.3) * 6)
        const y = yScale(d.cost)
        const r = Math.max(3, Math.min(8, d.runs / 8))
        return <circle key={i} cx={x} cy={y} r={r} fill={DOT_COLORS[i % DOT_COLORS.length]} opacity={0.75} />
      })}
    </svg>
  )
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

const CostEfficiencyScreen: React.FC<{ data: CostData }> = ({ data }) => {
  const s = data.summary

  const runtimeMin = (ms: number) => `${Math.round(ms / 60000)}m`
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

  const warehouseEffCols: ColumnDef[] = [
    { key: 'warehouse_name', header: 'Query / Job', width: 170 },
    {
      key: 'total_credits',
      header: 'Cost',
      width: 90,
      render: (row) => <Typography sx={{ fontSize: '12px', fontWeight: 600 }}>{fmtK(row.total_credits * 1000)}</Typography>,
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
        <Typography sx={{ fontSize: '12px', fontWeight: 700, color: efficiencyColor(row.efficiency) }}>
          {efficiencyIcon(row.efficiency)}
        </Typography>
      ),
    },
  ]

  const costCols: ColumnDef[] = [
    { key: 'pipeline',    header: 'Pipeline',  width: 180 },
    { key: 'run_cost',    header: 'Run Cost',  width: 90,
      render: (row) => <Typography sx={{ fontSize: '12px', fontWeight: 600 }}>{fmtK(row.run_cost)}</Typography> },
    { key: 'run_spend',   header: 'Run Spend', width: 90,
      render: (row) => <Typography sx={{ fontSize: '12px' }}>{fmtK(row.run_spend)}</Typography> },
    { key: 'success_pct', header: 'Success %', width: 140,
      render: (row) => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box sx={{ flex: 1, height: 8, backgroundColor: '#e0e0e0', borderRadius: 4, overflow: 'hidden' }}>
            <Box sx={{ width: `${row.success_pct}%`, height: '100%', backgroundColor: row.success_pct > 70 ? '#1976d2' : row.success_pct > 40 ? '#fb8c00' : '#e53935', borderRadius: 4 }} />
          </Box>
          <Typography sx={{ fontSize: '11px', minWidth: 28 }}>{row.success_pct}%</Typography>
        </Box>
      ) },
  ]

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>

      {/* Alert */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, backgroundColor: '#fff8e1', border: '1px solid #fdd835', borderRadius: 2, px: 2, py: 1 }}>
        <WarningAmberIcon sx={{ fontSize: 16, color: '#f57c00' }} />
        <Typography sx={{ fontSize: '12px', color: '#795548' }}>
          Warehouse with highest cost per query detected — consider resizing or tuning.
        </Typography>
      </Box>

      {/* 6 KPIs matching screenshot */}
      <StatCardGrid items={[
        { label: 'Cost Today',           value: fmtDollar(s.cost_today),                              color: '#1565c0', bg: '#e3f2fd' },
        { label: 'Cost MTD',             value: fmtDollar(s.cost_mtd),                                color: '#37474f', bg: '#f5f5f5' },
        { label: 'Avg Daily Burn (30d)', value: fmtDollar(s.avg_daily_burn_30d),                      color: '#6a1b9a', bg: '#f3e5f5' },
        { label: 'Remaining Balance',    value: fmtDollar(s.remaining_balance),                       color: '#2e7d32', bg: '#e8f5e9' },
        { label: 'Days Remaining',       value: s.days_remaining != null ? String(s.days_remaining) : '—', color: '#e65100', bg: '#fff3e0' },
        { label: 'Savings Opp (7d)',     value: fmtDollar(s.optimization_opportunity_currency_7d),    color: '#c62828', bg: '#fce4ec' },
      ]} />

      {/* Row 1: Cost by Service Type + Daily Cost Trend */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, gap: 2, alignItems: 'stretch', '& > *': { minWidth: 0 } }}>
        <Paper elevation={0} sx={{ p: 2, minWidth: 0, overflow: 'hidden', border: '1px solid #e8ecf1', borderTop: '3px solid #1976d2', borderRadius: 2 }}>
          <Typography sx={{ fontSize: '12px', fontWeight: 600, mb: 1, color: '#1a2535' }}>Cost by Service Type</Typography>
          <Box sx={{ height: 180, minWidth: 0, overflow: 'hidden' }}>
            <Treemap items={data.byPipeline} />
          </Box>
        </Paper>

        <Paper elevation={0} sx={{ p: 2, minWidth: 0, overflow: 'hidden', border: '1px solid #e8ecf1', borderTop: '3px solid #6a1b9a', borderRadius: 2 }}>
          <Typography sx={{ fontSize: '12px', fontWeight: 600, mb: 1, color: '#1a2535' }}>Daily Cost Trend</Typography>
          <Box sx={{ height: 180, width: '100%', minWidth: 0, overflow: 'hidden' }}>
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
        <Paper elevation={0} sx={{ p: 2, minWidth: 0, overflow: 'hidden', border: '1px solid #e8ecf1', borderTop: '3px solid #f57c00', borderRadius: 2 }}>
          <Typography sx={{ fontSize: '12px', fontWeight: 600, mb: 1, color: '#1a2535' }}>Warehouse Cost Efficiency</Typography>
          <Box sx={{ height: 180, minWidth: 0, overflow: 'hidden' }}>
            <ScatterPlot items={data.scatter} />
          </Box>
          <Box sx={{ mt: 1, width: '100%', minWidth: 0, overflowX: 'auto', border: '1px solid #e8ecf1', borderRadius: 1 }}>
            <DataTable columns={warehouseEffCols} rows={data.warehouseCostEfficiency} />
          </Box>
        </Paper>

        <Paper elevation={0} sx={{ minWidth: 0, border: '1px solid #e8ecf1', borderTop: '3px solid #c62828', borderRadius: 2, overflow: 'hidden' }}>
          <Box sx={{ px: 2, py: 1.5, backgroundColor: '#fafafa', borderBottom: '1px solid #e8ecf1' }}>
            <Typography sx={{ fontSize: '13px', fontWeight: 700, color: '#1a2535' }}>Top Costly Queries / Jobs</Typography>
          </Box>
          <Box sx={{ width: '100%', minWidth: 0, overflowX: 'auto' }}>
            <DataTable columns={costCols} rows={data.topCostlyJobs} />
          </Box>
        </Paper>
      </Box>

      {/* Row 3: Stage Storage Trend */}
      <Paper elevation={0} sx={{ p: 2, minWidth: 0, overflow: 'hidden', border: '1px solid #e8ecf1', borderTop: '3px solid #00838f', borderRadius: 2 }}>
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

const PlatformIntelligenceScreen: React.FC<{ data: PlatformData }> = ({ data }) => {
  const s = data.summary

  const heatRows   = data.heatmap.map(r => r.row)
  const heatCols   = data.heatmap[0]?.cells.map(c => c.col) ?? []
  const heatValues = data.heatmap.map(r => r.cells.map(c => c.value))

  const utilColor = (v: number) => {
    if (v > 85) return '#e53935'
    if (v > 70) return '#fb8c00'
    if (v > 55) return '#fdd835'
    if (v > 35) return '#9ccc65'
    return '#42a5f5'
  }

  const queryCols: ColumnDef[] = [
    { key: 'pipeline',   header: 'Pipeline',      width: 180 },
    { key: 'last_run',   header: 'Last Run',       width: 80 },
    { key: 'error_type', header: 'Error Type',     width: 110,
      render: (row) => (
        <Box sx={{ width: 64, height: 14, backgroundColor: ERROR_COLOR[row.error_type] ?? '#bbb', borderRadius: 2 }} />
      ) },
    { key: 'sla_ok',     header: 'SLA Status',    width: 90,
      render: (row) => row.sla_ok
        ? <CheckCircleIcon sx={{ fontSize: 16, color: '#2e7d32' }} />
        : <CancelIcon sx={{ fontSize: 16, color: '#c62828' }} /> },
    { key: 'fix',        header: 'Suggested Fix', width: 160 },
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
        { label: 'Queries Today',   value: (s.queries_today ?? 0).toLocaleString(),            color: '#1565c0', bg: '#e3f2fd' },
        { label: 'Query Success %', value: `${s.query_success_pct ?? 0}%`,                     color: '#2e7d32', bg: '#e8f5e9' },
        { label: 'Avg Query Time',  value: `${(s.avg_query_time_ms ?? 0).toLocaleString()} ms`, color: '#37474f', bg: '#f5f5f5' },
        { label: 'Credits Used',    value: (s.warehouse_credits_used ?? 0).toLocaleString(),   color: '#6a1b9a', bg: '#f3e5f5' },
        { label: 'Failed Tasks',    value: s.task_failures,                                    color: '#e65100', bg: '#fff3e0' },
        { label: 'Failed Logins',   value: s.failed_logins ?? 0,                               color: '#c62828', bg: '#fce4ec' },
      ]} />

      {/* Row 1: Warehouse Heatmap + Query Volume & Performance */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '2fr 1fr' }, gap: 2, alignItems: 'stretch', '& > *': { minWidth: 0 } }}>
        <Paper elevation={0} sx={{ p: 2, minWidth: 0, overflow: 'hidden', border: '1px solid #e8ecf1', borderTop: '3px solid #1976d2', borderRadius: 2 }}>
          <Typography sx={{ fontSize: '12px', fontWeight: 600, mb: 1, color: '#1a2535' }}>Warehouse Usage Heatmap</Typography>
          <HeatmapGrid
            rows={heatRows}
            cols={heatCols}
            values={heatValues}
            colorScale={utilColor}
            showRowLabels
            rowLabels={heatRows}
            showLegend={false}
          />
        </Paper>

        <Paper elevation={0} sx={{ p: 2, minWidth: 0, overflow: 'hidden', border: '1px solid #e8ecf1', borderTop: '3px solid #42a5f5', borderRadius: 2 }}>
          <Typography sx={{ fontSize: '12px', fontWeight: 600, mb: 1, color: '#1a2535' }}>Query Volume & Performance</Typography>
          <Box sx={{ height: 180, width: '100%', minWidth: 0, overflow: 'hidden' }}>
            <ComposedBarLineChart
              data={data.queryVolumeTrend}
              xKey="date"
              bars={[{ key: 'queries', color: '#1976d2', label: 'Queries' }]}
              lines={[{ key: 'avg_time_ms', color: '#e53935', label: 'Avg Query Time (ms)', yAxisId: 'right' }]}
            />
          </Box>
        </Paper>
      </Box>

      {/* Row 2: Top Slow Queries + Task Reliability */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1.5fr 1fr' }, gap: 2, alignItems: 'stretch', '& > *': { minWidth: 0 } }}>
        <Paper elevation={0} sx={{ minWidth: 0, border: '1px solid #e8ecf1', borderTop: '3px solid #e53935', borderRadius: 2, overflow: 'hidden' }}>
          <Box sx={{ px: 2, py: 1.5, backgroundColor: '#fafafa', borderBottom: '1px solid #e8ecf1' }}>
            <Typography sx={{ fontSize: '13px', fontWeight: 700, color: '#1a2535' }}>Top Slow Queries</Typography>
          </Box>
          <Box sx={{ width: '100%', minWidth: 0, overflowX: 'auto' }}>
            <DataTable columns={queryCols} rows={data.topSlowQueries} />
          </Box>
        </Paper>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0, height: '100%' }}>
          <Paper elevation={0} sx={{ p: 2, minWidth: 0, overflow: 'hidden', border: '1px solid #e8ecf1', borderTop: '3px solid #43a047', borderRadius: 2, height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Typography sx={{ fontSize: '12px', fontWeight: 600, mb: 1, color: '#1a2535' }}>Task Reliability</Typography>
            <Box sx={{ flex: 1, minHeight: 220, width: '100%', minWidth: 0, overflow: 'hidden' }}>
              <ComposedBarLineChart
                data={data.taskReliability}
                xKey="date"
                bars={[
                  { key: 'succeeded', color: '#43a047', label: 'Succeeded' },
                  { key: 'failed',    color: '#e53935', label: 'Failed' },
                ]}
                lines={[]}
              />
            </Box>
          </Paper>
        </Box>
      </Box>

      {/* Row 3: Login Failures + Storage Growth */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, gap: 2, alignItems: 'stretch', '& > *': { minWidth: 0 } }}>
        <Paper elevation={0} sx={{ p: 2, minWidth: 0, overflow: 'hidden', border: '1px solid #e8ecf1', borderTop: '3px solid #f57c00', borderRadius: 2 }}>
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

        <Paper elevation={0} sx={{ p: 2, minWidth: 0, overflow: 'hidden', border: '1px solid #e8ecf1', borderTop: '3px solid #00838f', borderRadius: 2 }}>
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
  const [isLive, setIsLive] = useState(false)

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
    let alive = true
    setIsLive(false)

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

    Promise.allSettled([
      snowflakeService.getCostSummary(),       // 0
      snowflakeService.getCostByPipeline(),    // 1
      snowflakeService.getCostScatter(),       // 2
      snowflakeService.getWarehouseCostEfficiency(), // 3
      snowflakeService.getCostByDuration(),    // 4
      snowflakeService.getTopCostlyJobs(),     // 5
      snowflakeService.getPlatformSummary(),   // 6
      snowflakeService.getWarehouseHeatmap(),  // 7
      snowflakeService.getTopSlowQueries(),    // 8
      snowflakeService.getQueryVolumeTrend(),  // 9
      snowflakeService.getTaskReliability(),   // 10
      snowflakeService.getLoginFailures(),     // 11
      snowflakeService.getStorageGrowth(),     // 12
    ]).then((results) => {
      if (!alive) return

      const [summary, byPipeline, scatter, warehouseCostEfficiency, byDuration, topCostlyJobs,
             platformSummary, heatmap, topSlowQueries,
             queryVolumeTrend, taskReliability, loginFailures, storageGrowth] = results

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
      setPlatformData({
        summary:          valueOr(platformSummary,  EMPTY_PLATFORM_SUMMARY),
        heatmap:          valueOr(heatmap,          []),
        queryVolumeTrend: valueOr(queryVolumeTrend, []),
        topSlowQueries:   valueOr(topSlowQueries,   []),
        taskReliability:  valueOr(taskReliability,  []),
        loginFailures:    valueOr(loginFailures,    []),
        storageGrowth:    valueOr(storageGrowth,    []),
        alert: successCount > 0
          ? 'Live Snowflake metrics loaded from database queries.'
          : 'Unable to load live Snowflake data. Check server query errors.',
      })
      setIsLive(successCount > 0)
    })
    return () => { alive = false }
  }, [useMock])

  const SUB_TABS: { key: SubTab; label: string; icon: React.ReactElement; accent: string }[] = [
    { key: 'platform', label: 'Platform Intelligence', icon: <QueryStatsIcon />,  accent: '#6a1b9a' },
    { key: 'cost',     label: 'Cost & Efficiency',     icon: <AttachMoneyIcon />, accent: '#1976d2' },
  ]

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {/* Header bar */}
      <Paper
        elevation={0}
        sx={{ borderRadius: 0, borderBottom: '1px solid #e8ecf1', px: 2, pt: 1.5, pb: 0, backgroundColor: '#fff', position: 'sticky', top: 0, zIndex: 10, boxShadow: '0 2px 8px rgba(0,0,0,0.07)' }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <AcUnitIcon sx={{ color: '#29b6f6', fontSize: 20 }} />
            <Typography sx={{ fontWeight: 700, fontSize: '14px', color: '#1a2535' }}>
              Snowflake Analytics
            </Typography>
            {useMock
              ? <Chip label="MOCK DATA" size="small" sx={{ fontSize: '9px', height: 16, backgroundColor: '#fff3e0', color: '#e65100', fontWeight: 700 }} />
              : isLive
              ? <Chip label="LIVE" size="small" sx={{ fontSize: '9px', height: 16, backgroundColor: '#e8f5e9', color: '#2e7d32', fontWeight: 700 }} />
              : <Chip label="LIVE (NO DATA)" size="small" sx={{ fontSize: '9px', height: 16, backgroundColor: '#ffebee', color: '#c62828', fontWeight: 700 }} />
            }
          </Box>
          {onOpenAgent && (
            <Button
              size="small"
              variant="contained"
              startIcon={<Box component="img" src={AGENTS.snowflake.icon} alt="Snowflake agent icon" sx={{ width: 14, height: 14, borderRadius: '50%' }} />}
              onClick={() => onOpenAgent('snowflake')}
              sx={{
                backgroundColor: '#0277bd',
                textTransform: 'none',
                fontSize: '11px',
                fontWeight: 700,
                height: 26,
                px: 1.5,
                '&:hover': { backgroundColor: '#0277bd', filter: 'brightness(0.9)' },
              }}
            >
              Ask Snowflake Agent
            </Button>
          )}
        </Box>

        {/* Sub-tabs */}
        <Box sx={{ display: 'flex', gap: 0 }}>
          {SUB_TABS.map(t => (
            <Box
              key={t.key}
              onClick={() => setSubTab(t.key)}
              sx={{
                display: 'flex', alignItems: 'center', gap: 0.75,
                px: 2, py: 1,
                cursor: 'pointer',
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
      </Paper>

      {/* Content */}
      <Box sx={{ p: 2, minWidth: 0, overflowX: 'hidden' }}>
        {subTab === 'platform' && <PlatformIntelligenceScreen data={platformData} />}
        {subTab === 'cost'     && <CostEfficiencyScreen data={costData} />}
      </Box>
    </Box>
  )
}
