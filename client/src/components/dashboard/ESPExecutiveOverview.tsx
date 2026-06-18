import React, { useMemo } from 'react'
import { Box, Chip, CircularProgress, Paper, Typography } from '@mui/material'
import { TrendLineChart, DonutChart, DataTable, type DonutSlice, type ColumnDef } from '../widgets'

export type EspOverviewIntervalOption = 30 | 60 | 90 | 'all'

export interface EspOverviewCard {
  key: string
  title: string
  description: string
  value: number
  accent: string
  background: string
  trend: Array<{ day: string; value: number }>
}

export interface EspJobRunTrendPoint {
  day: string
  runs: number
  avgRun: number
  fails: number
}

export interface EspJobRunAgent {
  agent: string
  runCount: number
}

export interface EspJobType {
  jobType: string
  jobCount: number
  pct: number
}

export interface EspSlaWidgets {
  job_execution_status?: Array<{
    appl_name: string | null
    jobname: string | null
    last_run: string | null
    avg_run_mins: number | null
    status: string | null
    job_type: string | null
  }>
  sla_status_bars?: Array<{
    platform: string | null
    total: number
    met_count: number
    pct_met: number
  }>
  sla_recent_events?: Array<{
    job_name: string | null
    applib: string | null
    sla_time: string | null
    end_time: string | null
    time_diff: string | null
    status: string | null
  }>
  job_dependencies?: Array<{
    appl_name: string | null
    jobname: string | null
    release: string | null
    external_ind: string | null
    predecessor_job: string | null
    predecessor_applib: string | null
  }>
  execution_forecast_metrics?: {
    avg_exec_mins: number
    avg_cpu_mins: number
    total_samples: number
    total_print_lines: number
  }
  forecast_exec_by_applib?: Array<{
    appl_name: string | null
    avg_exec_mins: number
    avg_cpu_mins: number
    job_count: number
  }>
  critical_jobs_pills?: Array<{
    appl_name: string | null
    critical_ind: string | null
    critical_job_count: number
  }>
  run_frequency_bars?: Array<{
    frequency: string | null
    job_count: number
  }>
  sla_config_by_lob?: Array<{
    appl_name: string | null
    sla_time: string | null
    lob: string | null
    sub_lob: string | null
    holiday_run_ind: string | null
    critical_ind: string | null
    job_count: number
    last_updated: string | null
  }>
}

export type EspOverviewGroupedWidgets = EspSlaWidgets

interface ESPExecutiveOverviewProps {
  cards: EspOverviewCard[]
  kpis?: EspOverviewCard[]
  widgets?: {
    jobRunTrend?: EspJobRunTrendPoint[]
    jobRunAgents?: EspJobRunAgent[]
    jobTypeDistribution?: EspJobType[]
  }
  groupedWidgets?: EspOverviewGroupedWidgets
  loading?: boolean
  error?: string | null
  widgetsLoading?: boolean
  widgetsError?: string | null
  slaLoading?: boolean
  slaError?: string | null
  slaSectionLoading?: {
    jobExecution?: boolean
    slaStatus?: boolean
    jobDependencies?: boolean
    executionForecast?: boolean
    jobConfigHealth?: boolean
  }
  slaSectionErrors?: {
    jobExecution?: string | null
    slaStatus?: string | null
    jobDependencies?: string | null
    executionForecast?: string | null
    jobConfigHealth?: string | null
  }
  interval: EspOverviewIntervalOption
  onIntervalChange: (interval: EspOverviewIntervalOption) => void
  scopeLabel: string
}

const INTERVAL_OPTIONS: EspOverviewIntervalOption[] = [30, 60, 90, 'all']

function formatMetric(value: number) {
  return value.toLocaleString('en-US')
}

function formatIntervalLabel(value: EspOverviewIntervalOption) {
  return value === 'all' ? 'All' : `${value}d`
}

function formatIntervalContext(value: EspOverviewIntervalOption) {
  return value === 'all' ? 'all time' : `last ${value} days`
}

function formatTrendDayLabel(day: string) {
  const normalized = day.length >= 10 ? day.slice(0, 10) : day
  const match = normalized.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return normalized
  const [, , month, date] = match
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${monthNames[Number(month) - 1]} ${Number(date)}`
}

function formatDateTime(value?: string | null) {
  if (!value) return '—'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return String(value)
  return parsed.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function getSparkPoints(values: number[], width = 116, height = 24, padding = 2) {
  if (!values.length) return ''
  const min = Math.min(...values)
  const max = Math.max(...values)
  const spread = max - min || 1

  return values
    .map((point, index) => {
      const x = padding + (index * (width - padding * 2)) / Math.max(values.length - 1, 1)
      const y = height - padding - ((point - min) / spread) * (height - padding * 2)
      return `${x},${y}`
    })
    .join(' ')
}

function getDeltaLabel(card: EspOverviewCard, interval: EspOverviewIntervalOption) {
  const intervalContext = formatIntervalContext(interval)
  if (card.trend.length < 2) return interval === 'all' ? 'All time view' : `No prior data for ${intervalContext}`

  const latest = Number(card.trend[card.trend.length - 1]?.value ?? 0)
  const previous = Number(card.trend[card.trend.length - 2]?.value ?? 0)
  const delta = latest - previous
  if (delta === 0) return `No change in ${intervalContext}`
  return `${delta > 0 ? '▲' : '▼'} ${Math.abs(delta).toLocaleString('en-US')} in ${intervalContext}`
}

export const ESPExecutiveOverview: React.FC<ESPExecutiveOverviewProps> = ({
  cards,
  kpis = [],
  widgets,
  groupedWidgets,
  loading = false,
  error,
  widgetsLoading = false,
  widgetsError,
  slaLoading = false,
  slaError,
  slaSectionLoading,
  slaSectionErrors,
  interval,
  onIntervalChange,
  scopeLabel,
}) => {
  const sectionLoading = {
    jobExecution: slaSectionLoading?.jobExecution ?? slaLoading,
    slaStatus: slaSectionLoading?.slaStatus ?? slaLoading,
    jobDependencies: slaSectionLoading?.jobDependencies ?? slaLoading,
    executionForecast: slaSectionLoading?.executionForecast ?? slaLoading,
    jobConfigHealth: slaSectionLoading?.jobConfigHealth ?? slaLoading,
  }

  const sectionError = {
    jobExecution: slaSectionErrors?.jobExecution ?? slaError ?? null,
    slaStatus: slaSectionErrors?.slaStatus ?? slaError ?? null,
    jobDependencies: slaSectionErrors?.jobDependencies ?? slaError ?? null,
    executionForecast: slaSectionErrors?.executionForecast ?? slaError ?? null,
    jobConfigHealth: slaSectionErrors?.jobConfigHealth ?? slaError ?? null,
  }

  const renderedCards = useMemo(() => cards, [cards])
  const renderedKpis = useMemo(() => kpis, [kpis])
  const jobRunTrendChartData = useMemo(
    () => (widgets?.jobRunTrend ?? []).map((point) => ({
      day: formatTrendDayLabel(point.day),
      runs: Number(point.runs ?? 0),
      avgRun: Number(point.avgRun ?? 0),
      fails: Number(point.fails ?? 0),
    })),
    [widgets?.jobRunTrend],
  )

  const jobTypeDonutData = useMemo<DonutSlice[]>(
    () => (widgets?.jobTypeDistribution ?? []).map((row, idx) => ({
      name: row.jobType,
      value: Number(row.jobCount ?? 0),
      color: ['#1e5bb8', '#2f9e44', '#f08c00', '#d9480f', '#5f3dc4', '#0c8599'][idx % 6],
    })),
    [widgets?.jobTypeDistribution],
  )

  const jobExecutionRows = useMemo(() => groupedWidgets?.job_execution_status ?? [], [groupedWidgets?.job_execution_status])
  const slaBars = useMemo(() => groupedWidgets?.sla_status_bars ?? [], [groupedWidgets?.sla_status_bars])
  const slaRecentEvents = useMemo(() => groupedWidgets?.sla_recent_events ?? [], [groupedWidgets?.sla_recent_events])
  const jobDependencies = useMemo(() => groupedWidgets?.job_dependencies ?? [], [groupedWidgets?.job_dependencies])
  const executionForecastMetrics = useMemo(
    () => groupedWidgets?.execution_forecast_metrics ?? { avg_exec_mins: 0, avg_cpu_mins: 0, total_samples: 0, total_print_lines: 0 },
    [groupedWidgets?.execution_forecast_metrics],
  )
  const forecastExecByApplib = useMemo(() => groupedWidgets?.forecast_exec_by_applib ?? [], [groupedWidgets?.forecast_exec_by_applib])
  const criticalJobsPills = useMemo(() => groupedWidgets?.critical_jobs_pills ?? [], [groupedWidgets?.critical_jobs_pills])
  const runFrequencyBars = useMemo(() => groupedWidgets?.run_frequency_bars ?? [], [groupedWidgets?.run_frequency_bars])
  const slaConfigByLob = useMemo(() => groupedWidgets?.sla_config_by_lob ?? [], [groupedWidgets?.sla_config_by_lob])
  const [executionStatusFilter, setExecutionStatusFilter] = React.useState<string>('All')

  const executionStatusCounts = useMemo(() => {
    const counts = new Map<string, number>()
    jobExecutionRows.forEach((row) => {
      const key = String(row.status ?? 'UNKNOWN').toUpperCase()
      counts.set(key, (counts.get(key) ?? 0) + 1)
    })
    return counts
  }, [jobExecutionRows])

  const filteredExecutionRows = useMemo(() => {
    if (executionStatusFilter === 'All') return jobExecutionRows
    return jobExecutionRows.filter((row) => String(row.status ?? 'UNKNOWN').toUpperCase() === executionStatusFilter)
  }, [executionStatusFilter, jobExecutionRows])

  const jobExecutionColumns = useMemo<ColumnDef[]>(() => [
    {
      key: 'jobname_application',
      header: 'Applib | Job Name',
      width: 270,
      noWrap: true,
      render: (row: any) => `${row.appl_name ?? '—'} | ${row.jobname ?? '—'}`,
    },
    {
      key: 'last_run',
      header: 'Last Run',
      width: 180,
      noWrap: true,
      render: (row: any) => formatDateTime(row.last_run),
    },
    {
      key: 'avg_run_mins',
      header: 'Avg',
      width: 80,
      noWrap: true,
      render: (row: any) => (row.avg_run_mins != null ? `${row.avg_run_mins}m` : '—'),
    },
    {
      key: 'status',
      header: 'Status',
      width: 110,
      noWrap: true,
      render: (row: any) => row.status ?? 'UNKNOWN',
    },
    {
      key: 'job_type',
      header: 'Type',
      width: 90,
      noWrap: true,
      render: (row: any) => row.job_type ?? '—',
    },
  ], [])

  const slaRecentEventColumns = useMemo<ColumnDef[]>(() => [
    {
      key: 'job_name',
      header: 'Job',
      width: 220,
      noWrap: true,
      render: (row: any) => row.job_name ?? '—',
    },
    {
      key: 'sla_time',
      header: 'SLA Time',
      width: 95,
      noWrap: true,
      render: (row: any) => row.sla_time ?? '—',
    },
    {
      key: 'end_time',
      header: 'End Time',
      width: 110,
      noWrap: true,
      render: (row: any) => row.end_time ?? '—',
    },
    {
      key: 'time_diff',
      header: 'Diff',
      width: 80,
      noWrap: true,
      render: (row: any) => row.time_diff ?? '—',
    },
    {
      key: 'status',
      header: 'Status',
      width: 95,
      noWrap: true,
      render: (row: any) => row.status ?? '—',
    },
  ], [])

  const jobDependencyColumns = useMemo<ColumnDef[]>(() => [
    {
      key: 'appl_name',
      header: 'Applib',
      width: 120,
      noWrap: true,
      render: (row: any) => row.appl_name ?? '—',
    },
    {
      key: 'jobname',
      header: 'Job Name',
      width: 170,
      noWrap: true,
      render: (row: any) => row.jobname ?? '—',
    },
    {
      key: 'release',
      header: 'Release',
      width: 120,
      noWrap: true,
      render: (row: any) => row.release ?? '—',
    },
    {
      key: 'external_ind',
      header: 'Ext',
      width: 70,
      noWrap: true,
      render: (row: any) => row.external_ind ?? '—',
    },
    {
      key: 'predecessor_job',
      header: 'Predecessor Job',
      width: 170,
      noWrap: true,
      render: (row: any) => row.predecessor_job ?? '—',
    },
    {
      key: 'predecessor_applib',
      header: 'Predecessor Applib',
      width: 170,
      noWrap: true,
      render: (row: any) => row.predecessor_applib ?? '—',
    },
  ], [])

  const slaConfigByLobColumns = useMemo<ColumnDef[]>(() => [
    { key: 'appl_name', header: 'Applib', width: 120, noWrap: true, render: (row: any) => row.appl_name ?? '—' },
    { key: 'sla_time', header: 'SLA Time', width: 95, noWrap: true, render: (row: any) => row.sla_time ?? '—' },
    { key: 'lob', header: 'LOB', width: 95, noWrap: true, render: (row: any) => row.lob ?? '—' },
    { key: 'sub_lob', header: 'Sub LOB', width: 95, noWrap: true, render: (row: any) => row.sub_lob ?? '—' },
    { key: 'holiday_run_ind', header: 'Holiday', width: 85, noWrap: true, render: (row: any) => row.holiday_run_ind ?? '—' },
    { key: 'critical_ind', header: 'Critical', width: 90, noWrap: true, render: (row: any) => row.critical_ind ?? '—' },
    { key: 'job_count', header: 'Jobs', width: 70, noWrap: true, render: (row: any) => row.job_count ?? 0 },
    { key: 'last_updated', header: 'Last Updated', width: 150, noWrap: true, render: (row: any) => formatDateTime(row.last_updated) },
  ], [])

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {/* KPI Cards Section */}
      <Paper elevation={0} sx={{ borderRadius: 2.5, overflow: 'hidden', border: '1px solid #e8ecf1', boxShadow: '0 10px 24px rgba(15, 23, 42, 0.05)' }}>
        <Box sx={{ px: 2, py: 1.35, borderBottom: '1px solid #eef2f6', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1.5, flexWrap: 'wrap' }}>
          <Box>
            <Typography sx={{ fontSize: '12px', fontWeight: 800, color: '#102a43', textTransform: 'uppercase', letterSpacing: '0.45px' }}>
              ESP Executive Overview
            </Typography>
            <Typography sx={{ mt: 0.35, fontSize: '11px', color: '#607080' }}>
              {scopeLabel}
            </Typography>
          </Box>

          <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.6, flexWrap: 'wrap' }}>
            {INTERVAL_OPTIONS.map((option) => {
              const active = option === interval
              return (
                <Chip
                  key={String(option)}
                  label={formatIntervalLabel(option)}
                  size="small"
                  onClick={() => onIntervalChange(option)}
                  sx={{
                    height: 24,
                    fontSize: '10px',
                    fontWeight: active ? 800 : 600,
                    cursor: 'pointer',
                  color: active ? '#0f6cbd' : '#64748b',
                  backgroundColor: active ? '#e3f2fd' : '#f8fafc',
                  border: `1px solid ${active ? '#90caf9' : '#d9e2ec'}`,
                  '& .MuiChip-label': { px: 1.1 },
                }}
              />
            )
          })}
        </Box>
      </Box>

      {loading ? (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 116 }}>
          <CircularProgress size={24} sx={{ color: '#1565c0' }} />
        </Box>
      ) : error ? (
        <Box sx={{ px: 2, py: 2.5 }}>
          <Typography sx={{ fontSize: '12px', color: '#c62828' }}>{error}</Typography>
        </Box>
      ) : (
        <Box>
          {/* All KPI Cards in single responsive grid */}
          <Box sx={{ p: 1.5, display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(5, 1fr)' }, gap: 1.25 }}>
            {[...renderedCards, ...renderedKpis].map((card) => {
              const sparkValues = card.trend.map((point) => Number(point.value ?? 0))
              const sparkPoints = getSparkPoints(sparkValues)
              return (
                <Paper
                  key={card.key}
                  elevation={0}
                  sx={{
                    borderRadius: 2.5,
                    border: '1px solid #e6ebf2',
                    borderTop: `3px solid ${card.accent}`,
                    backgroundColor: card.background,
                    px: 1.35,
                    py: 1.15,
                    minHeight: 108,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    boxShadow: '0 8px 18px rgba(15, 23, 42, 0.04)',
                  }}
                >
                  <Box>
                    <Typography sx={{ fontSize: '11px', fontWeight: 700, color: '#3d4b5a', textTransform: 'uppercase', letterSpacing: '0.35px', lineHeight: 1.3 }}>
                      {card.title}
                    </Typography>
                    <Typography sx={{ mt: 0.7, fontSize: '24px', fontWeight: 800, color: '#102a43', letterSpacing: '-0.4px', lineHeight: 1.05 }}>
                      {formatMetric(card.value)}
                    </Typography>
                    <Box sx={{ mt: 0.55, display: 'inline-flex', alignItems: 'center', px: 0.75, py: 0.3, borderRadius: 99, backgroundColor: '#f8fafc' }}>
                      <Typography sx={{ fontSize: '10px', fontWeight: 800, color: '#53657a' }}>{getDeltaLabel(card, interval)}</Typography>
                    </Box>
                    <Typography sx={{ mt: 0.5, fontSize: '10px', color: '#607080', lineHeight: 1.4 }}>
                      {card.description}
                    </Typography>
                  </Box>

                  <Box sx={{ mt: 0.6 }}>
                    {sparkPoints ? (
                      <svg width="116" height="24" viewBox="0 0 116 24">
                        <polyline
                          fill="none"
                          stroke={card.accent}
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          points={sparkPoints}
                        />
                      </svg>
                    ) : (
                      <Box sx={{ height: 24, display: 'flex', alignItems: 'center' }}>
                        <Typography sx={{ fontSize: '10px', color: '#94a3b8' }}>No trend data</Typography>
                      </Box>
                    )}
                    <Typography sx={{ mt: 0.35, fontSize: '9px', fontWeight: 700, color: card.accent, textTransform: 'uppercase', letterSpacing: '0.3px' }}>
                      {interval === 'all' ? 'Full history view' : `Last ${interval} days`}
                    </Typography>
                  </Box>
                </Paper>
              )
            })}
          </Box>
        </Box>
      )}
    </Paper>

    {/* Widget Sections Below KPI Cards */}
    {!loading && !error && (
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'repeat(3, 1fr)' }, gap: 2 }}>
        {/* Job Run Trend Chart */}
        <Paper elevation={0} sx={{ borderRadius: 2.5, border: '1px solid #e8ecf1', p: 1.5, boxShadow: '0 10px 24px rgba(15, 23, 42, 0.05)' }}>
          <Typography sx={{ fontSize: '12px', fontWeight: 800, color: '#102a43', textTransform: 'uppercase', letterSpacing: '0.45px', mb: 1 }}>
            Job Run Trend
          </Typography>
          {widgetsLoading ? (
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 220 }}><CircularProgress size={20} sx={{ color: '#1565c0' }} /></Box>
          ) : widgetsError ? (
            <Typography sx={{ fontSize: '11px', color: '#c62828', py: 2 }}>{widgetsError}</Typography>
          ) : jobRunTrendChartData.length > 0 ? (
            <TrendLineChart
              data={jobRunTrendChartData}
              xKey="day"
              height={220}
              lines={[
                { key: 'runs',   label: 'Runs',    color: '#1e5bb8', strokeWidth: 2.4 },
                { key: 'avgRun', label: 'Avg run', color: '#2f9e44', strokeWidth: 2.4, dashed: true },
                { key: 'fails',  label: 'Fails',   color: '#d9480f', strokeWidth: 2.2, dashed: true },
              ]}
              xAxisInterval="preserveStartEnd"
              yDomain={['auto', 'auto']}
            />
          ) : (
            <Typography sx={{ fontSize: '11px', color: '#94a3b8', py: 2 }}>No trend data</Typography>
          )}
        </Paper>

        {/* Job Run Agents Bar Chart */}
        <Paper elevation={0} sx={{ borderRadius: 2.5, border: '1px solid #e8ecf1', p: 1.5, boxShadow: '0 10px 24px rgba(15, 23, 42, 0.05)' }}>
          <Typography sx={{ fontSize: '12px', fontWeight: 800, color: '#102a43', textTransform: 'uppercase', letterSpacing: '0.45px', mb: 1 }}>
            Job Run Agents
          </Typography>
          {widgetsLoading ? (
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 120 }}><CircularProgress size={20} sx={{ color: '#1565c0' }} /></Box>
          ) : widgetsError ? (
            <Typography sx={{ fontSize: '11px', color: '#c62828', py: 2 }}>{widgetsError}</Typography>
          ) : widgets?.jobRunAgents && widgets.jobRunAgents.length > 0 ? (
            <Box>
              {widgets.jobRunAgents.slice(0, 7).map((agent) => {
                const maxRuns = Math.max(...(widgets.jobRunAgents?.map((a) => a.runCount) ?? []), 1)
                const barWidth = (agent.runCount / maxRuns) * 100
                return (
                  <Box key={agent.agent} sx={{ mb: 0.75 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.3 }}>
                      <Typography sx={{ fontSize: '9px', color: '#3d4b5a', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '70%' }}>
                        {agent.agent}
                      </Typography>
                      <Typography sx={{ fontSize: '9px', color: '#607080', fontWeight: 700 }}>{agent.runCount}</Typography>
                    </Box>
                    <Box sx={{ height: 6, backgroundColor: '#e6ebf2', borderRadius: 1, overflow: 'hidden' }}>
                      <Box sx={{ height: '100%', width: `${barWidth}%`, backgroundColor: '#2563eb', transition: 'width 0.3s ease' }} />
                    </Box>
                  </Box>
                )
              })}
            </Box>
          ) : (
            <Typography sx={{ fontSize: '11px', color: '#94a3b8', py: 2 }}>No agent data</Typography>
          )}
        </Paper>

        {/* Job Type Distribution Donut */}
        <Paper elevation={0} sx={{ borderRadius: 2.5, border: '1px solid #e8ecf1', p: 1.5, boxShadow: '0 10px 24px rgba(15, 23, 42, 0.05)' }}>
          <Typography sx={{ fontSize: '12px', fontWeight: 800, color: '#102a43', textTransform: 'uppercase', letterSpacing: '0.45px', mb: 1 }}>
            Job Type Distribution
          </Typography>
          {widgetsLoading ? (
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 180 }}><CircularProgress size={20} sx={{ color: '#1565c0' }} /></Box>
          ) : widgetsError ? (
            <Typography sx={{ fontSize: '11px', color: '#c62828', py: 2 }}>{widgetsError}</Typography>
          ) : jobTypeDonutData.length > 0 ? (
            <DonutChart
              data={jobTypeDonutData}
              size={180}
              innerRadius={46}
              outerRadius={70}
              showLegend
              centerLabel={jobTypeDonutData.reduce((sum, row) => sum + row.value, 0)}
              valueFormatter={(value) => value.toLocaleString('en-US')}
            />
          ) : (
            <Typography sx={{ fontSize: '11px', color: '#94a3b8', py: 2 }}>No distribution data</Typography>
          )}
        </Paper>
      </Box>
    )}

    {/* Grouped SLA section (as screenshot layout) */}
    {!loading && !error && (
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' }, gap: 2 }}>
        <Paper elevation={0} sx={{ minWidth: 0, borderRadius: 2.5, border: '1px solid #e8ecf1', boxShadow: '0 10px 24px rgba(15, 23, 42, 0.05)' }}>
          <Box sx={{ px: 1.5, pt: 1.35, pb: 1, borderBottom: '1px solid #eef2f6' }}>
            <Typography sx={{ fontSize: '12px', fontWeight: 800, color: '#102a43', textTransform: 'uppercase', letterSpacing: '0.45px' }}>
              Job Execution Status
            </Typography>
            <Box sx={{ mt: 0.9, display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
              {['All', 'SUCCESS', 'FAILED', 'NEVER RUN', 'UNKNOWN'].map((status) => {
                const count = status === 'All'
                  ? jobExecutionRows.length
                  : (executionStatusCounts.get(status) ?? 0)
                const active = executionStatusFilter === status
                return (
                  <Chip
                    key={status}
                    size="small"
                    label={`${status} (${count})`}
                    onClick={() => setExecutionStatusFilter(status)}
                    sx={{
                      height: 22,
                      fontSize: '10px',
                      cursor: 'pointer',
                      fontWeight: active ? 700 : 500,
                      color: active ? '#0f6cbd' : '#64748b',
                      backgroundColor: active ? '#e3f2fd' : '#f8fafc',
                      border: `1px solid ${active ? '#90caf9' : '#d9e2ec'}`,
                      '& .MuiChip-label': { px: 1 },
                    }}
                  />
                )
              })}
            </Box>
          </Box>
          {sectionLoading.jobExecution ? (
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 260 }}><CircularProgress size={20} sx={{ color: '#1565c0' }} /></Box>
          ) : sectionError.jobExecution ? (
            <Typography sx={{ fontSize: '11px', color: '#c62828', p: 1.5 }}>{sectionError.jobExecution}</Typography>
          ) : (
            <Box sx={{ p: 1.25 }}>
              <DataTable
                columns={jobExecutionColumns}
                rows={filteredExecutionRows}
                rowKey={(row: any) => `${row.appl_name ?? ''}|${row.jobname ?? ''}|${row.last_run ?? ''}`}
                compact
                maxHeight={260}
                tableMinWidth={640}
                pageSize={200}
                accentColor="#1f5cb8"
                headerBg="#1f5cb8"
                headerTextColor="#ffffff"
                emptyMessage="No job execution status rows"
              />
            </Box>
          )}
        </Paper>

        <Paper elevation={0} sx={{ minWidth: 0, borderRadius: 2.5, border: '1px solid #e8ecf1', boxShadow: '0 10px 24px rgba(15, 23, 42, 0.05)' }}>
          <Box sx={{ px: 1.5, pt: 1.35, pb: 1, borderBottom: '1px solid #eef2f6' }}>
            <Typography sx={{ fontSize: '12px', fontWeight: 800, color: '#102a43', textTransform: 'uppercase', letterSpacing: '0.45px' }}>
              SLA Status
            </Typography>
          </Box>
          {sectionLoading.slaStatus ? (
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 260 }}><CircularProgress size={20} sx={{ color: '#1565c0' }} /></Box>
          ) : sectionError.slaStatus ? (
            <Typography sx={{ fontSize: '11px', color: '#c62828', p: 1.5 }}>{sectionError.slaStatus}</Typography>
          ) : (
            <Box sx={{ p: 1.25 }}>
              <Typography sx={{ fontSize: '10px', fontWeight: 700, color: '#486581', textTransform: 'uppercase', mb: 0.6 }}>
                SLA Performance by Platform
              </Typography>
              <Box sx={{ mb: 1.2 }}>
                {slaBars.slice(0, 4).map((row) => {
                  const pct = Math.max(0, Math.min(100, Number(row.pct_met ?? 0)))
                  return (
                    <Box key={String(row.platform ?? 'Unknown')} sx={{ mb: 0.6 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.2 }}>
                        <Typography sx={{ fontSize: '10px', color: '#334e68', fontWeight: 700 }}>{row.platform ?? 'Unknown'}</Typography>
                        <Typography sx={{ fontSize: '10px', color: '#334e68', fontWeight: 700 }}>{pct.toFixed(1)}%</Typography>
                      </Box>
                      <Box sx={{ height: 7, backgroundColor: '#edf2f7', borderRadius: 1, overflow: 'hidden' }}>
                        <Box sx={{ height: '100%', width: `${pct}%`, backgroundColor: pct >= 90 ? '#2f9e44' : pct >= 80 ? '#82c91e' : '#d9480f' }} />
                      </Box>
                    </Box>
                  )
                })}
                {!slaBars.length && <Typography sx={{ fontSize: '11px', color: '#94a3b8' }}>No SLA status bars</Typography>}
              </Box>

              <Typography sx={{ fontSize: '10px', fontWeight: 700, color: '#486581', textTransform: 'uppercase', mb: 0.6 }}>
                Recent SLA Events
              </Typography>
              <DataTable
                columns={slaRecentEventColumns}
                rows={slaRecentEvents}
                rowKey={(row: any) => `${row.job_name ?? ''}|${row.end_time ?? ''}|${row.sla_time ?? ''}`}
                compact
                maxHeight={190}
                tableMinWidth={560}
                pageSize={200}
                accentColor="#1f5cb8"
                headerBg="#1f5cb8"
                headerTextColor="#ffffff"
                emptyMessage="No SLA events"
              />
            </Box>
          )}
        </Paper>

        <Paper elevation={0} sx={{ minWidth: 0, borderRadius: 2.5, border: '1px solid #e8ecf1', boxShadow: '0 10px 24px rgba(15, 23, 42, 0.05)', gridColumn: { xs: 'auto', md: '1 / span 2' } }}>
          <Box sx={{ px: 1.5, pt: 1.35, pb: 1, borderBottom: '1px solid #eef2f6' }}>
            <Typography sx={{ fontSize: '12px', fontWeight: 800, color: '#102a43', textTransform: 'uppercase', letterSpacing: '0.45px' }}>
              Job Dependencies
            </Typography>
          </Box>
          {sectionLoading.jobDependencies ? (
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 170 }}><CircularProgress size={20} sx={{ color: '#1565c0' }} /></Box>
          ) : sectionError.jobDependencies ? (
            <Typography sx={{ fontSize: '11px', color: '#c62828', p: 1.5 }}>{sectionError.jobDependencies}</Typography>
          ) : (
            <Box sx={{ p: 1.25 }}>
              <DataTable
                columns={jobDependencyColumns}
                rows={jobDependencies}
                rowKey={(row: any) => `${row.appl_name ?? ''}|${row.jobname ?? ''}|${row.release ?? ''}|${row.predecessor_job ?? ''}`}
                compact
                maxHeight={220}
                tableMinWidth={860}
                pageSize={200}
                accentColor="#1f5cb8"
                headerBg="#1f5cb8"
                headerTextColor="#ffffff"
                emptyMessage="No dependency rows"
              />
            </Box>
          )}
        </Paper>

        <Paper elevation={0} sx={{ minWidth: 0, borderRadius: 2.5, border: '1px solid #e8ecf1', boxShadow: '0 10px 24px rgba(15, 23, 42, 0.05)' }}>
          <Box sx={{ px: 1.5, pt: 1.35, pb: 1, borderBottom: '1px solid #eef2f6' }}>
            <Typography sx={{ fontSize: '12px', fontWeight: 800, color: '#102a43', textTransform: 'uppercase', letterSpacing: '0.45px' }}>
              Execution Forecast
            </Typography>
          </Box>
          {sectionLoading.executionForecast ? (
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 220 }}><CircularProgress size={20} sx={{ color: '#1565c0' }} /></Box>
          ) : sectionError.executionForecast ? (
            <Typography sx={{ fontSize: '11px', color: '#c62828', p: 1.5 }}>{sectionError.executionForecast}</Typography>
          ) : (
            <Box sx={{ p: 1.25 }}>
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0.75, mb: 1.2 }}>
                {[
                  { label: 'Avg Exec Mins', value: `${Number(executionForecastMetrics.avg_exec_mins ?? 0).toFixed(1)} min` },
                  { label: 'Avg CPU Mins', value: `${Number(executionForecastMetrics.avg_cpu_mins ?? 0).toFixed(1)} min` },
                  { label: 'Samples Used', value: Number(executionForecastMetrics.total_samples ?? 0).toLocaleString('en-US') },
                  { label: 'Print Lines', value: Number(executionForecastMetrics.total_print_lines ?? 0).toLocaleString('en-US') },
                ].map((item) => (
                  <Paper key={item.label} elevation={0} sx={{ border: '1px solid #e7edf3', borderRadius: 1.5, p: 0.85, backgroundColor: '#f8fbff' }}>
                    <Typography sx={{ fontSize: '9px', color: '#607080', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.3px' }}>{item.label}</Typography>
                    <Typography sx={{ mt: 0.35, fontSize: '17px', fontWeight: 800, color: '#102a43' }}>{item.value}</Typography>
                  </Paper>
                ))}
              </Box>

              <Typography sx={{ fontSize: '10px', fontWeight: 700, color: '#486581', textTransform: 'uppercase', mb: 0.6 }}>
                Exec vs CPU by Applib
              </Typography>
              <Box>
                {forecastExecByApplib.slice(0, 5).map((row) => {
                  const maxVal = Math.max(...forecastExecByApplib.flatMap((r) => [Number(r.avg_exec_mins ?? 0), Number(r.avg_cpu_mins ?? 0)]), 1)
                  const execPct = (Number(row.avg_exec_mins ?? 0) / maxVal) * 100
                  const cpuPct = (Number(row.avg_cpu_mins ?? 0) / maxVal) * 100
                  return (
                    <Box key={String(row.appl_name ?? 'Unknown')} sx={{ mb: 0.75 }}>
                      <Typography sx={{ fontSize: '10px', fontWeight: 700, color: '#334e68', mb: 0.25, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {row.appl_name ?? 'Unknown'}
                      </Typography>
                      <Box sx={{ display: 'grid', gridTemplateColumns: '44px 1fr 42px', alignItems: 'center', gap: 0.5, mb: 0.25 }}>
                        <Typography sx={{ fontSize: '9px', color: '#1e5bb8' }}>Exec</Typography>
                        <Box sx={{ height: 6, backgroundColor: '#e6ebf2', borderRadius: 1, overflow: 'hidden' }}><Box sx={{ height: '100%', width: `${execPct}%`, backgroundColor: '#1e5bb8' }} /></Box>
                        <Typography sx={{ fontSize: '9px', color: '#486581', textAlign: 'right' }}>{Number(row.avg_exec_mins ?? 0).toFixed(1)}</Typography>
                      </Box>
                      <Box sx={{ display: 'grid', gridTemplateColumns: '44px 1fr 42px', alignItems: 'center', gap: 0.5 }}>
                        <Typography sx={{ fontSize: '9px', color: '#2f9e44' }}>CPU</Typography>
                        <Box sx={{ height: 6, backgroundColor: '#e6ebf2', borderRadius: 1, overflow: 'hidden' }}><Box sx={{ height: '100%', width: `${cpuPct}%`, backgroundColor: '#2f9e44' }} /></Box>
                        <Typography sx={{ fontSize: '9px', color: '#486581', textAlign: 'right' }}>{Number(row.avg_cpu_mins ?? 0).toFixed(1)}</Typography>
                      </Box>
                    </Box>
                  )
                })}
                {!forecastExecByApplib.length && <Typography sx={{ fontSize: '11px', color: '#94a3b8' }}>No forecast rows</Typography>}
              </Box>
            </Box>
          )}
        </Paper>

        <Paper elevation={0} sx={{ minWidth: 0, borderRadius: 2.5, border: '1px solid #e8ecf1', boxShadow: '0 10px 24px rgba(15, 23, 42, 0.05)' }}>
          <Box sx={{ px: 1.5, pt: 1.35, pb: 1, borderBottom: '1px solid #eef2f6' }}>
            <Typography sx={{ fontSize: '12px', fontWeight: 800, color: '#102a43', textTransform: 'uppercase', letterSpacing: '0.45px' }}>
              Job Config Health
            </Typography>
          </Box>
          {sectionLoading.jobConfigHealth ? (
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 220 }}><CircularProgress size={20} sx={{ color: '#1565c0' }} /></Box>
          ) : sectionError.jobConfigHealth ? (
            <Typography sx={{ fontSize: '11px', color: '#c62828', p: 1.5 }}>{sectionError.jobConfigHealth}</Typography>
          ) : (
            <Box sx={{ p: 1.25 }}>
              <Typography sx={{ fontSize: '10px', fontWeight: 700, color: '#486581', textTransform: 'uppercase', mb: 0.5 }}>
                Critical Jobs
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.45, mb: 1.0 }}>
                {criticalJobsPills.slice(0, 8).map((row) => (
                  <Chip
                    key={`${row.appl_name ?? 'Unknown'}-${row.critical_job_count}`}
                    label={`${row.appl_name ?? 'Unknown'} (${row.critical_job_count})`}
                    size="small"
                    sx={{
                      height: 20,
                      fontSize: '9px',
                      fontWeight: 700,
                      color: '#8a2d3b',
                      backgroundColor: '#fff1f3',
                      border: '1px solid #ffc9d2',
                    }}
                  />
                ))}
                {!criticalJobsPills.length && <Typography sx={{ fontSize: '11px', color: '#94a3b8' }}>No critical jobs</Typography>}
              </Box>

              <Typography sx={{ fontSize: '10px', fontWeight: 700, color: '#486581', textTransform: 'uppercase', mb: 0.5 }}>
                Run Frequency
              </Typography>
              <Box sx={{ mb: 1.0 }}>
                {runFrequencyBars.map((row) => {
                  const maxVal = Math.max(...runFrequencyBars.map((r) => Number(r.job_count ?? 0)), 1)
                  const pct = (Number(row.job_count ?? 0) / maxVal) * 100
                  return (
                    <Box key={String(row.frequency ?? 'UNKNOWN')} sx={{ mb: 0.45 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.15 }}>
                        <Typography sx={{ fontSize: '9px', color: '#334e68', fontWeight: 700 }}>{row.frequency ?? 'UNKNOWN'}</Typography>
                        <Typography sx={{ fontSize: '9px', color: '#334e68' }}>{row.job_count ?? 0}</Typography>
                      </Box>
                      <Box sx={{ height: 6, backgroundColor: '#e6ebf2', borderRadius: 1, overflow: 'hidden' }}><Box sx={{ height: '100%', width: `${pct}%`, backgroundColor: '#2f9e44' }} /></Box>
                    </Box>
                  )
                })}
                {!runFrequencyBars.length && <Typography sx={{ fontSize: '11px', color: '#94a3b8' }}>No run frequencies</Typography>}
              </Box>

              <Typography sx={{ fontSize: '10px', fontWeight: 700, color: '#486581', textTransform: 'uppercase', mb: 0.55 }}>
                SLA Config by LOB
              </Typography>
              <DataTable
                columns={slaConfigByLobColumns}
                rows={slaConfigByLob}
                rowKey={(row: any) => `${row.appl_name ?? ''}|${row.sla_time ?? ''}|${row.last_updated ?? ''}`}
                compact
                maxHeight={180}
                tableMinWidth={760}
                pageSize={200}
                accentColor="#1f5cb8"
                headerBg="#1f5cb8"
                headerTextColor="#ffffff"
                emptyMessage="No SLA config rows"
              />
            </Box>
          )}
        </Paper>
      </Box>
    )}
    </Box>
  )
}

export default ESPExecutiveOverview