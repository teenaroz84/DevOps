/**
 * SnowflakeDashboardTab
 * Two sub-screens toggled by inner tabs:
 *   1. Cost & Efficiency Overview
 *   2. Snowflake Platform Intelligence
 *
 * Visible in MOCK mode only (enforced in ExecutiveDashboard).
 */
import React, { useState } from 'react'
import { Box, Typography, Paper, Chip, Tooltip, Button } from '@mui/material'
import AcUnitIcon from '@mui/icons-material/AcUnit'
import AttachMoneyIcon from '@mui/icons-material/AttachMoney'
import QueryStatsIcon from '@mui/icons-material/QueryStats'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import CancelIcon from '@mui/icons-material/Cancel'
import SmartToyIcon from '@mui/icons-material/SmartToy'
import {
  StatCardGrid,
  HeatmapGrid,
  ComposedBarLineChart,
  DataTable,
} from '../widgets'
import type { ColumnDef } from '../widgets'
import {
  MOCK_SF_COST_SUMMARY,
  MOCK_SF_COST_BY_PIPELINE,
  MOCK_SF_COST_BY_DURATION,
  MOCK_SF_TOP_COSTLY_JOBS,
  MOCK_SF_PLATFORM_SUMMARY,
  MOCK_SF_HEATMAP,
  MOCK_SF_HOURLY_QUERIES,
  MOCK_SF_TOP_SLOW_QUERIES,
  MOCK_SF_ALERT,
} from '../../services/snowflakeMockData'

// ── Helpers ────────────────────────────────────────────────

const fmtK = (n: number) => `$${(n / 1000).toFixed(1)}k`

const ERROR_COLOR: Record<string, string> = {
  TIMEOUT:    '#e53935',
  SPILL:      '#fb8c00',
  LOCK_WAIT:  '#fdd835',
  ROW_ACCESS: '#42a5f5',
}

// ── Treemap (simple CSS grid based) ───────────────────────

const Treemap: React.FC<{ items: typeof MOCK_SF_COST_BY_PIPELINE }> = ({ items }) => {
  const total = items.reduce((s, i) => s + i.cost, 0)
  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: '2px', height: '100%', alignContent: 'flex-start' }}>
      {items.map(item => {
        const pct = (item.cost / total) * 100
        return (
          <Tooltip key={item.name} title={`${item.name}: ${fmtK(item.cost)}`}>
            <Box
              sx={{
                width: `${Math.max(pct * 1.5, 8)}%`,
                minHeight: pct > 20 ? '48%' : '22%',
                backgroundColor: item.color,
                borderRadius: '2px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'default',
                flexGrow: pct > 15 ? 1 : 0,
                opacity: 0.9,
                '&:hover': { opacity: 1 },
              }}
            >
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
import { MOCK_SF_COST_SCATTER } from '../../services/snowflakeMockData'

const ScatterPlot: React.FC = () => {
  const W = 260, H = 140, PL = 36, PR = 8, PT = 8, PB = 28
  const minCost = 11, maxCost = 25
  const xStep = (W - PL - PR) / (BUCKETS.length - 1)
  const yScale = (c: number) => PT + (H - PT - PB) * (1 - (c - minCost) / (maxCost - minCost))
  const DOT_COLORS = ['#e53935', '#f57c00', '#fdd835', '#43a047', '#1e88e5', '#8e24aa', '#00acc1', '#795548']

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: 'visible' }}>
      {/* Y axis lines */}
      {[12, 13, 22, 23].map(v => (
        <line key={v} x1={PL} x2={W - PR} y1={yScale(v)} y2={yScale(v)}
          stroke="#e0e0e0" strokeWidth={0.5} />
      ))}
      {/* Y labels */}
      {[12, 13, 22, 23].map(v => (
        <text key={`yl${v}`} x={PL - 3} y={yScale(v) + 3} textAnchor="end"
          fontSize={7} fill="#999">{v}s</text>
      ))}
      {/* X labels */}
      {BUCKETS.map((b, i) => (
        <text key={b} x={PL + i * xStep} y={H - PB + 12} textAnchor="middle"
          fontSize={7} fill="#999">{b}</text>
      ))}
      {/* Dots */}
      {MOCK_SF_COST_SCATTER.map((d, i) => {
        const xi = BUCKETS.indexOf(d.bucket.replace('>', '>').replace('30-45m', '30–45m').replace('45-60m', '45–60m').replace('60-75m', '60–75m').replace('>120m', '>120m'))
        const x = PL + (xi < 0 ? 0 : xi) * xStep + (Math.sin(i * 2.3) * 6)
        const y = yScale(d.cost)
        const r = Math.max(3, Math.min(8, d.runs / 8))
        return (
          <circle key={i} cx={x} cy={y} r={r}
            fill={DOT_COLORS[i % DOT_COLORS.length]}
            opacity={0.75} />
        )
      })}
    </svg>
  )
}

// ── Sub-screen 1: Cost & Efficiency ──────────────────────

const CostEfficiencyScreen: React.FC = () => {
  const s = MOCK_SF_COST_SUMMARY

  const costCols: ColumnDef[] = [
    { key: 'pipeline',   header: 'Pipeline',   width: 180 },
    { key: 'run_cost',   header: 'Run Cost',   width: 90,
      render: (row) => <Typography sx={{ fontSize: '12px', fontWeight: 600 }}>{fmtK(row.run_cost)}</Typography> },
    { key: 'run_spend',  header: 'Run Spend',  width: 90,
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
      {/* KPI strip */}
      <StatCardGrid items={[
        { label: 'Monthly Cost',     value: fmtK(s.monthly_cost),    color: '#1565c0', bg: '#e3f2fd' },
        { label: 'Warehouse Spend',  value: fmtK(s.warehouse_spend), color: '#37474f', bg: '#f5f5f5' },
        { label: 'Efficient Runs',   value: `${s.efficient_pct}%`,   color: '#2e7d32', bg: '#e8f5e9' },
        { label: 'Wasted Spend',     value: fmtK(s.wasted_spend),   color: '#c62828', bg: '#fce4ec' },
        { label: 'Budget Remaining', value: fmtK(s.budget - s.monthly_cost), color: '#f57c00', bg: '#fff3e0' },
      ]} />

      {/* Charts row */}
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 2 }}>
        <Paper elevation={0} sx={{ p: 2, border: '1px solid #e8ecf1', borderTop: '3px solid #1976d2', borderRadius: 2 }}>
          <Typography sx={{ fontSize: '12px', fontWeight: 600, mb: 1, color: '#1a2535' }}>Cost by Pipeline</Typography>
          <Box sx={{ height: 160 }}>
            <Treemap items={MOCK_SF_COST_BY_PIPELINE} />
          </Box>
        </Paper>

        <Paper elevation={0} sx={{ p: 2, border: '1px solid #e8ecf1', borderTop: '3px solid #f57c00', borderRadius: 2 }}>
          <Typography sx={{ fontSize: '12px', fontWeight: 600, mb: 1, color: '#1a2535' }}>Cost vs Duration</Typography>
          <Box sx={{ height: 160 }}>
            <ScatterPlot />
          </Box>
        </Paper>

        <Paper elevation={0} sx={{ p: 2, border: '1px solid #e8ecf1', borderTop: '3px solid #43a047', borderRadius: 2 }}>
          <Typography sx={{ fontSize: '12px', fontWeight: 600, mb: 1, color: '#1a2535' }}>Cost by Duration Bucket</Typography>
          <Box sx={{ height: 160 }}>
            <ComposedBarLineChart
              data={MOCK_SF_COST_BY_DURATION}
              xKey="bucket"
              bars={[{ key: 'cost', color: '#1976d2', label: 'Cost ($)' }]}
              lines={[]}
            />
          </Box>
        </Paper>
      </Box>

      {/* Top Costly Jobs table */}
      <Paper elevation={0} sx={{ border: '1px solid #e8ecf1', borderTop: '3px solid #c62828', borderRadius: 2, overflow: 'hidden' }}>
        <Box sx={{ px: 2, py: 1.5, backgroundColor: '#fafafa', borderBottom: '1px solid #e8ecf1' }}>
          <Typography sx={{ fontSize: '13px', fontWeight: 700, color: '#1a2535' }}>Top Costly Jobs</Typography>
        </Box>
        <DataTable columns={costCols} rows={MOCK_SF_TOP_COSTLY_JOBS} />
      </Paper>
    </Box>
  )
}

// ── Sub-screen 2: Platform Intelligence ──────────────────

const PlatformIntelligenceScreen: React.FC = () => {
  const s = MOCK_SF_PLATFORM_SUMMARY

  // Build HeatmapGrid input
  const heatRows = MOCK_SF_HEATMAP.map(r => r.row)
  const heatCols = MOCK_SF_HEATMAP[0]?.cells.map(c => c.col) ?? []
  const heatValues = MOCK_SF_HEATMAP.map(r => r.cells.map(c => c.value))

  // Heatmap color: red=high util (bad), blue=low
  const utilColor = (v: number) => {
    if (v > 85) return '#e53935'
    if (v > 70) return '#fb8c00'
    if (v > 55) return '#fdd835'
    if (v > 35) return '#9ccc65'
    return '#42a5f5'
  }

  const queryCols: ColumnDef[] = [
    { key: 'pipeline',   header: 'Pipeline',  width: 180 },
    { key: 'last_run',   header: 'Last Run',  width: 80 },
    { key: 'error_type', header: 'Error Type', width: 110,
      render: (row) => (
        <Box sx={{ width: 64, height: 14, backgroundColor: ERROR_COLOR[row.error_type] ?? '#bbb', borderRadius: 2 }} />
      ) },
    { key: 'sla_ok',     header: 'SLA Status', width: 90,
      render: (row) => row.sla_ok
        ? <CheckCircleIcon sx={{ fontSize: 16, color: '#2e7d32' }} />
        : <CancelIcon sx={{ fontSize: 16, color: '#c62828' }} /> },
    { key: 'fix',        header: 'Suggested Fix', width: 160 },
  ]

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {/* Alert banner */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, backgroundColor: '#fff8e1', border: '1px solid #fdd835', borderRadius: 2, px: 2, py: 1 }}>
        <WarningAmberIcon sx={{ fontSize: 16, color: '#f57c00' }} />
        <Typography sx={{ fontSize: '12px', color: '#795548' }}>{MOCK_SF_ALERT}</Typography>
      </Box>

      {/* KPI strip */}
      <StatCardGrid items={[
        { label: 'Long Queries',       value: s.long_queries,         color: '#1565c0', bg: '#e3f2fd' },
        { label: 'Task Failures',      value: s.task_failures,        color: '#f57c00', bg: '#fff3e0' },
        { label: 'Warehouse Util',     value: `${s.warehouse_util_pct}%`, color: '#2e7d32', bg: '#e8f5e9' },
        { label: 'Query Errors',       value: s.query_errors,         color: '#c62828', bg: '#fce4ec' },
      ]} />

      {/* Heatmap + hourly bar chart */}
      <Box sx={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 2 }}>
        <Paper elevation={0} sx={{ p: 2, border: '1px solid #e8ecf1', borderTop: '3px solid #1976d2', borderRadius: 2 }}>
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

        <Paper elevation={0} sx={{ p: 2, border: '1px solid #e8ecf1', borderTop: '3px solid #42a5f5', borderRadius: 2 }}>
          <Typography sx={{ fontSize: '12px', fontWeight: 600, mb: 1, color: '#1a2535' }}>Hourly Query Volume</Typography>
          <Box sx={{ height: 180 }}>
            <ComposedBarLineChart
              data={MOCK_SF_HOURLY_QUERIES.filter((_, i) => i % 2 === 0)}
              xKey="hour"
              bars={[{ key: 'queries', color: '#1976d2', label: 'Queries' }]}
              lines={[]}
            />
          </Box>
        </Paper>
      </Box>

      {/* Top Slow Queries */}
      <Paper elevation={0} sx={{ border: '1px solid #e8ecf1', borderTop: '3px solid #e53935', borderRadius: 2, overflow: 'hidden' }}>
        <Box sx={{ px: 2, py: 1.5, backgroundColor: '#fafafa', borderBottom: '1px solid #e8ecf1' }}>
          <Typography sx={{ fontSize: '13px', fontWeight: 700, color: '#1a2535' }}>Top Slow Queries</Typography>
        </Box>
        <DataTable columns={queryCols} rows={MOCK_SF_TOP_SLOW_QUERIES} />
      </Paper>
    </Box>
  )
}

// ── Main exported component ───────────────────────────────

type SubTab = 'cost' | 'platform'

export const SnowflakeDashboardTab: React.FC<{ onOpenAgent?: (agentId: string) => void }> = ({ onOpenAgent }) => {
  const [subTab, setSubTab] = useState<SubTab>('cost')

  const SUB_TABS: { key: SubTab; label: string; icon: React.ReactElement; accent: string }[] = [
    { key: 'cost',     label: 'Cost & Efficiency',       icon: <AttachMoneyIcon />, accent: '#1976d2' },
    { key: 'platform', label: 'Platform Intelligence',   icon: <QueryStatsIcon />,  accent: '#6a1b9a' },
  ]

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {/* Header bar */}
      <Paper
        elevation={0}
        sx={{ borderRadius: 0, borderBottom: '1px solid #e8ecf1', px: 2, pt: 1.5, pb: 0, backgroundColor: '#fff' }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <AcUnitIcon sx={{ color: '#29b6f6', fontSize: 20 }} />
            <Typography sx={{ fontWeight: 700, fontSize: '14px', color: '#1a2535' }}>
              Snowflake Analytics
            </Typography>
            <Chip label="MOCK DATA" size="small" sx={{ fontSize: '9px', height: 16, backgroundColor: '#fff3e0', color: '#e65100', fontWeight: 700 }} />
          </Box>
          {onOpenAgent && (
            <Button
              size="small"
              variant="contained"
              startIcon={<SmartToyIcon sx={{ fontSize: 13 }} />}
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
      <Box sx={{ p: 2 }}>
        {subTab === 'cost'     && <CostEfficiencyScreen />}
        {subTab === 'platform' && <PlatformIntelligenceScreen />}
      </Box>
    </Box>
  )
}
