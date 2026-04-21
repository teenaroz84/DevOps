import React from 'react'
import { Box, Paper, Typography, CircularProgress, Chip } from '@mui/material'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import ScheduleIcon from '@mui/icons-material/Schedule'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'
import AppsIcon from '@mui/icons-material/Apps'
import AccountTreeIcon from '@mui/icons-material/AccountTree'
import TableChartIcon from '@mui/icons-material/TableChart'
import InsightsIcon from '@mui/icons-material/Insights'

import {
  WidgetShell,
  StatCardGrid,
  MetricBarList,
  DataTable,
  TrendLineChart,
  DonutChart,
  SimpleBarChart,
} from '../widgets'
import type { ColumnDef } from '../widgets'
import { espService } from '../../services'
import { APP_COLORS, TRUIST } from '../../theme/truistPalette'

interface SLASummaryMetricBlock {
  total_sla_missed_jobs_today: number
  open_missed_jobs_right_now: number
  distinct_applications_impacted: number
  distinct_business_units_impacted: number
  avg_delay_minutes: number | null
  longest_delay_minutes: number | null
}

interface SeriesPoint {
  day: string | null
  platform?: string
  sla_type?: string
  sla_misses: number
}

interface RepeatedJobPoint {
  job_name: string | null
  sla_miss_count: number
}

interface SlaDetailRow {
  platform: string | null
  batch_dt: string | null
  appl_lib: string | null
  application_desc: string | null
  job_name: string | null
  run_criteria: string | null
  sla_time: string | null
  sla_type: string | null
  sla_status: string | null
  job_start_time: string | null
  job_end_time: string | null
  time_diff: string | null
  cmd_detail: string | null
  bus_unit: string | null
  sub_bus_unit: string | null
  bus_summary: string | null
  last_updated: string | null
  duration_minutes: number | null
  running_minutes: number | null
}

interface SlaDashboardResponse {
  metrics: SLASummaryMetricBlock
  daily_misses: Array<{ day: string | null; sla_misses: number }>
  hourly_misses: Array<{ hour: number; sla_misses: number }>
  platform_trend: SeriesPoint[]
  sla_type_trend: SeriesPoint[]
  top_applications: Array<{ name: string; sla_misses: number }>
  top_business_units: Array<{ name: string; sla_misses: number }>
  misses_by_platform: Array<{ name: string; sla_misses: number }>
  misses_by_sla_type: Array<{ name: string; sla_misses: number }>
  misses_by_run_criteria: Array<{ name: string; sla_misses: number }>
  top_repeated_jobs: RepeatedJobPoint[]
  open_queue: SlaDetailRow[]
  longest_running: SlaDetailRow[]
  recently_updated: SlaDetailRow[]
  no_end_time: SlaDetailRow[]
  percent_by_platform: Array<{ name: string; sla_misses: number; pct_of_total: number }>
  percent_by_business_unit: Array<{ name: string; sla_misses: number; pct_of_total: number }>
  daily_open_closed: Array<{ day: string | null; open_jobs: number; closed_jobs: number }>
  avg_duration_by_application: Array<{ name: string; avg_duration_minutes: number }>
}

interface ESPSlaMissedJobsTabProps {
  selectedPlatform: string | null
  selectedApplib: string
  useMock: boolean
}

const CHART_COLORS = ['#0057B8', '#00A3AD', '#E36F1E', '#D64045', '#6F5BD3', '#3F7D20']
const DONUT_COLORS = ['#0057B8', '#00A3AD', '#E36F1E', '#D64045', '#6F5BD3', '#7DAA3B']

function formatShortDate(value?: string | null): string {
  if (!value) return 'Unknown'
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function formatDateTime(value?: string | null): string {
  if (!value) return '—'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return String(value).replace('T', ' ').slice(0, 19)
  return parsed.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatMinutes(minutes?: number | null): string {
  if (minutes == null || Number.isNaN(minutes)) return '—'
  const rounded = Math.round(minutes)
  const hours = Math.floor(rounded / 60)
  const remainingMinutes = rounded % 60
  if (hours <= 0) return `${rounded} min`
  if (remainingMinutes === 0) return `${hours} hr`
  return `${hours} hr ${remainingMinutes} min`
}

function buildSeriesChartRows<T extends SeriesPoint>(rows: T[], seriesKey: 'platform' | 'sla_type') {
  const days = [...new Set(rows.map(row => row.day).filter(Boolean) as string[])].sort()
  const totals = new Map<string, number>()

  rows.forEach(row => {
    const key = row[seriesKey] ?? 'Unknown'
    totals.set(key, (totals.get(key) ?? 0) + row.sla_misses)
  })

  const seriesNames = [...totals.entries()]
    .sort((left, right) => right[1] - left[1])
    .map(([name]) => name)

  const byDay = new Map<string, Record<string, number>>()
  rows.forEach(row => {
    if (!row.day) return
    const entry = byDay.get(row.day) ?? {}
    entry[row[seriesKey] ?? 'Unknown'] = row.sla_misses
    byDay.set(row.day, entry)
  })

  return {
    seriesNames,
    rows: days.map(day => ({
      day: formatShortDate(day),
      ...byDay.get(day),
    })),
  }
}

function buildHourlyRows(rows: Array<{ hour: number; sla_misses: number }>) {
  return rows.map(row => ({
    hour: `${row.hour}:00`,
    sla_misses: row.sla_misses,
  }))
}

function buildDailyRows(rows: Array<{ day: string | null; sla_misses: number }>) {
  return rows.map(row => ({
    day: formatShortDate(row.day),
    sla_misses: row.sla_misses,
  }))
}

export const ESPSlaMissedJobsTab: React.FC<ESPSlaMissedJobsTabProps> = ({
  selectedPlatform,
  selectedApplib,
  useMock,
}) => {
  const [dashboard, setDashboard] = React.useState<SlaDashboardResponse | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [selectedJobName, setSelectedJobName] = React.useState<string | null>(null)
  const [jobDetailRows, setJobDetailRows] = React.useState<SlaDetailRow[]>([])
  const [jobDetailLoading, setJobDetailLoading] = React.useState(false)

  React.useEffect(() => {
    setSelectedJobName(null)
    setJobDetailRows([])

    if (useMock) {
      setDashboard(null)
      setLoading(false)
      setError(null)
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)

    espService.getSlaMissedDashboard(selectedPlatform ?? '', selectedApplib || '')
      .then((result: any) => {
        if (cancelled) return
        setDashboard(result as SlaDashboardResponse)
      })
      .catch((err: any) => {
        if (cancelled) return
        setDashboard(null)
        setError(err instanceof Error ? err.message : 'Failed to load SLA missed jobs dashboard')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [selectedApplib, selectedPlatform, useMock])

  React.useEffect(() => {
    if (!selectedJobName || useMock) {
      setJobDetailRows([])
      setJobDetailLoading(false)
      return
    }

    let cancelled = false
    setJobDetailLoading(true)
    espService.getSlaMissedJobDetail(selectedPlatform ?? '', selectedJobName, selectedApplib || '')
      .then((rows: any) => {
        if (cancelled) return
        setJobDetailRows(Array.isArray(rows) ? rows : [])
      })
      .catch(() => {
        if (!cancelled) setJobDetailRows([])
      })
      .finally(() => {
        if (!cancelled) setJobDetailLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [selectedApplib, selectedJobName, selectedPlatform, useMock])

  const platformTrendChart = React.useMemo(
    () => buildSeriesChartRows(dashboard?.platform_trend ?? [], 'platform'),
    [dashboard?.platform_trend],
  )
  const slaTypeTrendChart = React.useMemo(
    () => buildSeriesChartRows(dashboard?.sla_type_trend ?? [], 'sla_type'),
    [dashboard?.sla_type_trend],
  )
  const dailyMissChart = React.useMemo(
    () => buildDailyRows(dashboard?.daily_misses ?? []),
    [dashboard?.daily_misses],
  )
  const hourlyMissChart = React.useMemo(
    () => buildHourlyRows(dashboard?.hourly_misses ?? []),
    [dashboard?.hourly_misses],
  )
  const dailyOpenClosedChart = React.useMemo(
    () => (dashboard?.daily_open_closed ?? []).map(row => ({
      day: formatShortDate(row.day),
      open_jobs: row.open_jobs,
      closed_jobs: row.closed_jobs,
    })),
    [dashboard?.daily_open_closed],
  )

  const topApplications = dashboard?.top_applications ?? []
  const topBusinessUnits = dashboard?.top_business_units ?? []
  const missesByPlatform = dashboard?.misses_by_platform ?? []
  const missesBySlaType = dashboard?.misses_by_sla_type ?? []
  const missesByRunCriteria = dashboard?.misses_by_run_criteria ?? []
  const topRepeatedJobs = dashboard?.top_repeated_jobs ?? []
  const pctByPlatform = dashboard?.percent_by_platform ?? []
  const pctByBusinessUnit = dashboard?.percent_by_business_unit ?? []
  const avgDurationByApplication = dashboard?.avg_duration_by_application ?? []

  const queueColumns: ColumnDef<SlaDetailRow>[] = [
    { key: 'platform', header: 'Platform', width: 84, render: row => row.platform ?? '—' },
    { key: 'batch_dt', header: 'Batch Date', width: 92, render: row => row.batch_dt ?? '—' },
    { key: 'appl_lib', header: 'Applib', width: 110, noWrap: true, render: row => row.appl_lib ?? '—' },
    { key: 'job_name', header: 'Job Name', flex: 1, noWrap: true, render: row => row.job_name ?? '—' },
    { key: 'sla_type', header: 'SLA Type', width: 90, render: row => row.sla_type ?? '—' },
    {
      key: 'running_minutes',
      header: 'Running',
      width: 96,
      render: row => formatMinutes(row.running_minutes),
    },
  ]

  const longestRunningColumns: ColumnDef<SlaDetailRow>[] = [
    { key: 'platform', header: 'Platform', width: 84, render: row => row.platform ?? '—' },
    { key: 'batch_dt', header: 'Batch Date', width: 92, render: row => row.batch_dt ?? '—' },
    { key: 'job_name', header: 'Job Name', flex: 1, noWrap: true, render: row => row.job_name ?? '—' },
    { key: 'sla_type', header: 'SLA Type', width: 90, render: row => row.sla_type ?? '—' },
    {
      key: 'duration_minutes',
      header: 'Duration',
      width: 98,
      render: row => formatMinutes(row.duration_minutes),
    },
  ]

  const recentUpdateColumns: ColumnDef<SlaDetailRow>[] = [
    { key: 'platform', header: 'Platform', width: 84, render: row => row.platform ?? '—' },
    { key: 'batch_dt', header: 'Batch Date', width: 92, render: row => row.batch_dt ?? '—' },
    { key: 'job_name', header: 'Job Name', flex: 1, noWrap: true, render: row => row.job_name ?? '—' },
    { key: 'sla_status', header: 'Status', width: 110, render: row => row.sla_status ?? '—' },
    { key: 'last_updated', header: 'Last Updated', width: 138, render: row => formatDateTime(row.last_updated) },
  ]

  const noEndTimeColumns: ColumnDef<SlaDetailRow>[] = [
    { key: 'platform', header: 'Platform', width: 84, render: row => row.platform ?? '—' },
    { key: 'batch_dt', header: 'Batch Date', width: 92, render: row => row.batch_dt ?? '—' },
    { key: 'appl_lib', header: 'Applib', width: 110, noWrap: true, render: row => row.appl_lib ?? '—' },
    { key: 'application_desc', header: 'Application', width: 140, render: row => row.application_desc ?? '—' },
    { key: 'job_name', header: 'Job Name', flex: 1, noWrap: true, render: row => row.job_name ?? '—' },
    { key: 'job_start_time', header: 'Job Start', width: 128, render: row => formatDateTime(row.job_start_time) },
    { key: 'sla_status', header: 'Status', width: 110, render: row => row.sla_status ?? '—' },
  ]

  const commandDetailColumns: ColumnDef<SlaDetailRow>[] = [
    { key: 'platform', header: 'Platform', width: 84, render: row => row.platform ?? '—' },
    { key: 'batch_dt', header: 'Batch Date', width: 92, render: row => row.batch_dt ?? '—' },
    { key: 'appl_lib', header: 'Applib', width: 110, noWrap: true, render: row => row.appl_lib ?? '—' },
    { key: 'application_desc', header: 'Application', width: 150, render: row => row.application_desc ?? '—' },
    { key: 'job_name', header: 'Job Name', width: 160, noWrap: true, render: row => row.job_name ?? '—' },
    { key: 'run_criteria', header: 'Run Criteria', width: 110, render: row => row.run_criteria ?? '—' },
    { key: 'sla_time', header: 'SLA Time', width: 92, render: row => row.sla_time ?? '—' },
    { key: 'sla_type', header: 'SLA Type', width: 92, render: row => row.sla_type ?? '—' },
    { key: 'sla_status', header: 'SLA Status', width: 110, render: row => row.sla_status ?? '—' },
    { key: 'job_start_time', header: 'Job Start', width: 132, render: row => formatDateTime(row.job_start_time) },
    { key: 'job_end_time', header: 'Job End', width: 132, render: row => formatDateTime(row.job_end_time) },
    { key: 'cmd_detail', header: 'Command Detail', flex: 1.2, render: row => row.cmd_detail ?? '—' },
    { key: 'bus_unit', header: 'Business Unit', width: 120, render: row => row.bus_unit ?? '—' },
    { key: 'sub_bus_unit', header: 'Sub Business Unit', width: 140, render: row => row.sub_bus_unit ?? '—' },
    { key: 'bus_summary', header: 'Business Summary', flex: 1, render: row => row.bus_summary ?? '—' },
    { key: 'last_updated', header: 'Last Updated', width: 140, render: row => formatDateTime(row.last_updated) },
  ]

  if (useMock) {
    return (
      <Paper elevation={0} sx={{ borderRadius: 2, p: 3, border: '1px solid #e8ecf1', backgroundColor: '#fff' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
          <WarningAmberIcon sx={{ color: '#E36F1E' }} />
          <Typography sx={{ fontSize: '13px', color: TRUIST.charcoal }}>
            The ESP SLA Missed Jobs dashboard uses PostgreSQL only and is not available in mock mode.
          </Typography>
        </Box>
      </Paper>
    )
  }

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress sx={{ color: APP_COLORS.primary }} />
      </Box>
    )
  }

  if (error || !dashboard) {
    return (
      <Paper elevation={0} sx={{ borderRadius: 2, p: 3, border: '1px solid #e8ecf1', backgroundColor: '#fff' }}>
        <Typography sx={{ fontSize: '13px', color: '#c62828' }}>
          {error ?? 'Failed to load the ESP SLA missed jobs dashboard.'}
        </Typography>
      </Paper>
    )
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Paper elevation={0} sx={{ borderRadius: 2, overflow: 'hidden', border: '1px solid #e8ecf1', borderTop: '3px solid #c62828', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
        <WidgetShell
          title="ESP SLA Missed Jobs Dashboard"
          source={selectedApplib ? `${selectedApplib} · PostgreSQL job_sla_missed` : selectedPlatform ? 'Filtered platform scope · PostgreSQL job_sla_missed' : 'All platforms · PostgreSQL job_sla_missed'}
          titleIcon={<WarningAmberIcon sx={{ color: '#c62828', fontSize: 18 }} />}
        >
          <Box sx={{ p: 1.5 }}>
            <StatCardGrid
              items={[
                { label: 'Total SLA Missed Jobs Today', value: dashboard.metrics.total_sla_missed_jobs_today, color: '#c62828', bg: '#fce4ec' },
                { label: 'Open Missed Jobs Right Now', value: dashboard.metrics.open_missed_jobs_right_now, color: '#ef6c00', bg: '#fff3e0' },
                { label: 'Distinct Applications Impacted', value: dashboard.metrics.distinct_applications_impacted, color: '#1565c0', bg: '#e3f2fd' },
                { label: 'Distinct Business Units Impacted', value: dashboard.metrics.distinct_business_units_impacted, color: '#6a1b9a', bg: '#f3e5f5' },
                { label: 'Avg Delay Duration', value: formatMinutes(dashboard.metrics.avg_delay_minutes), color: '#2e7d32', bg: '#e8f5e9' },
                { label: 'Longest Delay Duration', value: formatMinutes(dashboard.metrics.longest_delay_minutes), color: '#37474f', bg: '#eceff1' },
              ]}
              columns={6}
            />
          </Box>
        </WidgetShell>
      </Paper>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', xl: '1fr 1fr 1.2fr' }, gap: 2 }}>
        <Paper elevation={0} sx={{ borderRadius: 2, overflow: 'hidden', border: '1px solid #e8ecf1', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <WidgetShell title="SLA Misses by Day" source="Last 14 days" titleIcon={<TrendingUpIcon sx={{ color: '#0057B8', fontSize: 18 }} />}>
            <Box sx={{ p: 1.5 }}>
              <TrendLineChart
                data={dailyMissChart}
                xKey="day"
                lines={[{ key: 'sla_misses', label: 'SLA Misses', color: '#0057B8' }]}
                height={250}
                margin={{ top: 8, right: 12, left: -8, bottom: 4 }}
              />
            </Box>
          </WidgetShell>
        </Paper>

        <Paper elevation={0} sx={{ borderRadius: 2, overflow: 'hidden', border: '1px solid #e8ecf1', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <WidgetShell title="SLA Misses by Hour of Day" source="Last 7 days" titleIcon={<ScheduleIcon sx={{ color: '#E36F1E', fontSize: 18 }} />}>
            <Box sx={{ p: 1.5 }}>
              <SimpleBarChart
                data={hourlyMissChart}
                xKey="hour"
                bars={[{ key: 'sla_misses', label: 'SLA Misses', color: '#E36F1E' }]}
                height={250}
                margin={{ top: 8, right: 12, left: -8, bottom: 4 }}
              />
            </Box>
          </WidgetShell>
        </Paper>

        <Paper elevation={0} sx={{ borderRadius: 2, overflow: 'hidden', border: '1px solid #e8ecf1', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <WidgetShell title="7-Day Trend by Platform" source="Daily trend" titleIcon={<InsightsIcon sx={{ color: '#00A3AD', fontSize: 18 }} />}>
            <Box sx={{ p: 1.5 }}>
              <TrendLineChart
                data={platformTrendChart.rows}
                xKey="day"
                lines={platformTrendChart.seriesNames.map((name, index) => ({
                  key: name,
                  label: name,
                  color: CHART_COLORS[index % CHART_COLORS.length],
                }))}
                height={250}
                margin={{ top: 8, right: 12, left: -8, bottom: 4 }}
              />
            </Box>
          </WidgetShell>
        </Paper>
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', xl: '1.15fr 1fr 1fr' }, gap: 2 }}>
        <Paper elevation={0} sx={{ borderRadius: 2, overflow: 'hidden', border: '1px solid #e8ecf1', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <WidgetShell title="7-Day Trend by SLA Type" source="Daily trend" titleIcon={<ScheduleIcon sx={{ color: '#6F5BD3', fontSize: 18 }} />}>
            <Box sx={{ p: 1.5 }}>
              <TrendLineChart
                data={slaTypeTrendChart.rows}
                xKey="day"
                lines={slaTypeTrendChart.seriesNames.map((name, index) => ({
                  key: name,
                  label: name,
                  color: CHART_COLORS[index % CHART_COLORS.length],
                }))}
                height={250}
                margin={{ top: 8, right: 12, left: -8, bottom: 4 }}
              />
            </Box>
          </WidgetShell>
        </Paper>

        <Paper elevation={0} sx={{ borderRadius: 2, overflow: 'hidden', border: '1px solid #e8ecf1', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', display: 'flex' }}>
          <WidgetShell title="Top Applications with Most SLA Misses" source="Last 7 days" titleIcon={<AppsIcon sx={{ color: '#0057B8', fontSize: 18 }} />}>
            <Box sx={{ px: 1.5, py: 1.25, overflowY: 'auto' }}>
              <MetricBarList
                items={topApplications.map((item, index) => ({
                  label: item.name,
                  value: item.sla_misses,
                  max: Math.max(...topApplications.map(entry => entry.sla_misses), 1),
                  color: CHART_COLORS[index % CHART_COLORS.length],
                }))}
                compact
              />
            </Box>
          </WidgetShell>
        </Paper>

        <Paper elevation={0} sx={{ borderRadius: 2, overflow: 'hidden', border: '1px solid #e8ecf1', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', display: 'flex' }}>
          <WidgetShell title="Top Business Units with Most SLA Misses" source="Last 7 days" titleIcon={<AccountTreeIcon sx={{ color: '#2E7D32', fontSize: 18 }} />}>
            <Box sx={{ px: 1.5, py: 1.25, overflowY: 'auto' }}>
              <MetricBarList
                items={topBusinessUnits.map((item, index) => ({
                  label: item.name,
                  value: item.sla_misses,
                  max: Math.max(...topBusinessUnits.map(entry => entry.sla_misses), 1),
                  color: CHART_COLORS[index % CHART_COLORS.length],
                }))}
                compact
              />
            </Box>
          </WidgetShell>
        </Paper>
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', xl: 'repeat(4, 1fr)' }, gap: 2 }}>
        <Paper elevation={0} sx={{ borderRadius: 2, overflow: 'hidden', border: '1px solid #e8ecf1', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <WidgetShell title="Misses by Platform" source="Last 7 days" titleIcon={<InsightsIcon sx={{ color: '#0057B8', fontSize: 18 }} />}>
            <Box sx={{ p: 1.5, display: 'flex', justifyContent: 'center' }}>
              <DonutChart
                data={missesByPlatform.map((item, index) => ({
                  name: item.name,
                  value: item.sla_misses,
                  color: DONUT_COLORS[index % DONUT_COLORS.length],
                }))}
                size={170}
                centerLabel={missesByPlatform.reduce((sum, item) => sum + item.sla_misses, 0)}
                showLegend
              />
            </Box>
          </WidgetShell>
        </Paper>

        <Paper elevation={0} sx={{ borderRadius: 2, overflow: 'hidden', border: '1px solid #e8ecf1', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <WidgetShell title="Misses by SLA Type" source="Last 7 days" titleIcon={<ScheduleIcon sx={{ color: '#D64045', fontSize: 18 }} />}>
            <Box sx={{ p: 1.5, display: 'flex', justifyContent: 'center' }}>
              <DonutChart
                data={missesBySlaType.map((item, index) => ({
                  name: item.name,
                  value: item.sla_misses,
                  color: DONUT_COLORS[index % DONUT_COLORS.length],
                }))}
                size={170}
                centerLabel={missesBySlaType.reduce((sum, item) => sum + item.sla_misses, 0)}
                showLegend
              />
            </Box>
          </WidgetShell>
        </Paper>

        <Paper elevation={0} sx={{ borderRadius: 2, overflow: 'hidden', border: '1px solid #e8ecf1', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', display: 'flex' }}>
          <WidgetShell title="Misses by Run Criteria" source="Last 7 days" titleIcon={<InsightsIcon sx={{ color: '#6F5BD3', fontSize: 18 }} />}>
            <Box sx={{ px: 1.5, py: 1.25, overflowY: 'auto' }}>
              <MetricBarList
                items={missesByRunCriteria.map((item, index) => ({
                  label: item.name,
                  value: item.sla_misses,
                  max: Math.max(...missesByRunCriteria.map(entry => entry.sla_misses), 1),
                  color: CHART_COLORS[index % CHART_COLORS.length],
                }))}
                compact
              />
            </Box>
          </WidgetShell>
        </Paper>

        <Paper elevation={0} sx={{ borderRadius: 2, overflow: 'hidden', border: '1px solid #e8ecf1', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', display: 'flex' }}>
          <WidgetShell title="Top Jobs Repeatedly Missing SLA" source="Last 30 days" titleIcon={<WarningAmberIcon sx={{ color: '#c62828', fontSize: 18 }} />}>
            <Box sx={{ px: 1.5, py: 1.25, overflowY: 'auto' }}>
              <MetricBarList
                items={topRepeatedJobs.map((item, index) => ({
                  label: item.job_name ?? 'Unknown',
                  value: item.sla_miss_count,
                  max: Math.max(...topRepeatedJobs.map(entry => entry.sla_miss_count), 1),
                  color: selectedJobName === item.job_name ? TRUIST.dusk : CHART_COLORS[index % CHART_COLORS.length],
                  onClick: item.job_name ? () => setSelectedJobName(item.job_name) : undefined,
                }))}
                compact
              />
            </Box>
          </WidgetShell>
        </Paper>
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', xl: 'repeat(2, 1fr)' }, gap: 2 }}>
        <Paper elevation={0} sx={{ borderRadius: 2, overflow: 'hidden', border: '1px solid #e8ecf1', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <WidgetShell title="Current Open Missed Jobs Queue" source="Open queue" titleIcon={<TableChartIcon sx={{ color: '#0057B8', fontSize: 18 }} />}>
            <Box sx={{ px: 1.25, pb: 1.25 }}>
              <DataTable
                columns={queueColumns}
                rows={dashboard.open_queue}
                rowKey={(row) => `${row.job_name}-${row.batch_dt}-${row.job_start_time}`}
                compact
                maxHeight={245}
                pageSize={25}
                onRowClick={(row) => row.job_name && setSelectedJobName(row.job_name)}
                accentColor="#0057B8"
                emptyMessage="No open missed jobs found"
              />
            </Box>
          </WidgetShell>
        </Paper>

        <Paper elevation={0} sx={{ borderRadius: 2, overflow: 'hidden', border: '1px solid #e8ecf1', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <WidgetShell title="Longest Running Missed Jobs" source="Top 10 by duration" titleIcon={<TrendingUpIcon sx={{ color: '#D64045', fontSize: 18 }} />}>
            <Box sx={{ px: 1.25, pb: 1.25 }}>
              <DataTable
                columns={longestRunningColumns}
                rows={dashboard.longest_running}
                rowKey={(row) => `${row.job_name}-${row.batch_dt}-${row.duration_minutes}`}
                compact
                maxHeight={245}
                onRowClick={(row) => row.job_name && setSelectedJobName(row.job_name)}
                accentColor="#D64045"
                emptyMessage="No duration data found"
              />
            </Box>
          </WidgetShell>
        </Paper>

        <Paper elevation={0} sx={{ borderRadius: 2, overflow: 'hidden', border: '1px solid #e8ecf1', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <WidgetShell title="Recently Updated Missed Jobs" source="Latest 10 rows" titleIcon={<ScheduleIcon sx={{ color: '#00A3AD', fontSize: 18 }} />}>
            <Box sx={{ px: 1.25, pb: 1.25 }}>
              <DataTable
                columns={recentUpdateColumns}
                rows={dashboard.recently_updated}
                rowKey={(row) => `${row.job_name}-${row.last_updated}`}
                compact
                maxHeight={245}
                onRowClick={(row) => row.job_name && setSelectedJobName(row.job_name)}
                accentColor="#00A3AD"
                emptyMessage="No recent updates found"
              />
            </Box>
          </WidgetShell>
        </Paper>

        <Paper elevation={0} sx={{ borderRadius: 2, overflow: 'hidden', border: '1px solid #e8ecf1', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <WidgetShell title="Jobs Missing SLA with No End Time" source="Open jobs" titleIcon={<WarningAmberIcon sx={{ color: '#E36F1E', fontSize: 18 }} />}>
            <Box sx={{ px: 1.25, pb: 1.25 }}>
              <DataTable
                columns={noEndTimeColumns}
                rows={dashboard.no_end_time}
                rowKey={(row) => `${row.job_name}-${row.batch_dt}-${row.job_start_time}`}
                compact
                maxHeight={245}
                pageSize={50}
                onRowClick={(row) => row.job_name && setSelectedJobName(row.job_name)}
                accentColor="#E36F1E"
                emptyMessage="No jobs without end time found"
              />
            </Box>
          </WidgetShell>
        </Paper>
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', xl: 'repeat(2, 1fr)' }, gap: 2 }}>
        <Paper elevation={0} sx={{ borderRadius: 2, overflow: 'hidden', border: '1px solid #e8ecf1', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', display: 'flex' }}>
          <WidgetShell title="SLA Miss Percent by Platform" source="Last 7 days" titleIcon={<InsightsIcon sx={{ color: '#0057B8', fontSize: 18 }} />}>
            <Box sx={{ px: 1.5, py: 1.25, overflowY: 'auto' }}>
              <MetricBarList
                items={pctByPlatform.map((item, index) => ({
                  label: item.name,
                  value: item.pct_of_total,
                  max: 100,
                  suffix: '%',
                  color: CHART_COLORS[index % CHART_COLORS.length],
                  sublabel: `${item.sla_misses.toLocaleString()} misses`,
                }))}
                compact
              />
            </Box>
          </WidgetShell>
        </Paper>

        <Paper elevation={0} sx={{ borderRadius: 2, overflow: 'hidden', border: '1px solid #e8ecf1', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', display: 'flex' }}>
          <WidgetShell title="SLA Miss Percent by Business Unit" source="Last 7 days" titleIcon={<AccountTreeIcon sx={{ color: '#2E7D32', fontSize: 18 }} />}>
            <Box sx={{ px: 1.5, py: 1.25, overflowY: 'auto' }}>
              <MetricBarList
                items={pctByBusinessUnit.map((item, index) => ({
                  label: item.name,
                  value: item.pct_of_total,
                  max: 100,
                  suffix: '%',
                  color: CHART_COLORS[index % CHART_COLORS.length],
                  sublabel: `${item.sla_misses.toLocaleString()} misses`,
                }))}
                compact
              />
            </Box>
          </WidgetShell>
        </Paper>
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', xl: '1.2fr 1fr' }, gap: 2 }}>
        <Paper elevation={0} sx={{ borderRadius: 2, overflow: 'hidden', border: '1px solid #e8ecf1', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <WidgetShell title="Daily Open vs Closed Missed Jobs" source="Last 14 days" titleIcon={<TrendingUpIcon sx={{ color: '#6F5BD3', fontSize: 18 }} />}>
            <Box sx={{ p: 1.5 }}>
              <TrendLineChart
                data={dailyOpenClosedChart}
                xKey="day"
                lines={[
                  { key: 'open_jobs', label: 'Open', color: '#D64045' },
                  { key: 'closed_jobs', label: 'Closed', color: '#2E7D32' },
                ]}
                height={255}
                margin={{ top: 8, right: 12, left: -8, bottom: 4 }}
              />
            </Box>
          </WidgetShell>
        </Paper>

        <Paper elevation={0} sx={{ borderRadius: 2, overflow: 'hidden', border: '1px solid #e8ecf1', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', display: 'flex' }}>
          <WidgetShell title="Average Duration by Application" source="Last 7 days" titleIcon={<AppsIcon sx={{ color: '#E36F1E', fontSize: 18 }} />}>
            <Box sx={{ px: 1.5, py: 1.25, overflowY: 'auto' }}>
              <MetricBarList
                items={avgDurationByApplication.map((item, index) => ({
                  label: item.name,
                  value: Math.round(item.avg_duration_minutes),
                  max: Math.max(...avgDurationByApplication.map(entry => entry.avg_duration_minutes), 1),
                  suffix: ' min',
                  color: CHART_COLORS[index % CHART_COLORS.length],
                }))}
                compact
              />
            </Box>
          </WidgetShell>
        </Paper>
      </Box>

      <Paper elevation={0} sx={{ borderRadius: 2, overflow: 'hidden', border: '1px solid #e8ecf1', borderTop: '3px solid #37474f', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
        <WidgetShell
          title="Command Detail / Job Drilldown"
          source={selectedJobName ? `Selected job: ${selectedJobName}` : 'Select a job from the SLA widgets above'}
          titleIcon={<TableChartIcon sx={{ color: '#37474f', fontSize: 18 }} />}
          actions={selectedJobName ? (
            <Chip
              label="Clear Job"
              size="small"
              onDelete={() => setSelectedJobName(null)}
              sx={{ fontSize: '10px', height: 22, color: '#37474f', backgroundColor: '#eceff1' }}
            />
          ) : undefined}
        >
          {!selectedJobName ? (
            <Box sx={{ px: 2, py: 3 }}>
              <Typography sx={{ fontSize: '12px', color: '#666' }}>
                Click any job in the open queue, longest-running list, recently updated list, no-end-time list, or top repeated jobs widget to load the command detail drilldown.
              </Typography>
            </Box>
          ) : jobDetailLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress size={22} sx={{ color: '#37474f' }} />
            </Box>
          ) : (
            <Box sx={{ px: 1.25, pb: 1.25 }}>
              <DataTable
                columns={commandDetailColumns}
                rows={jobDetailRows}
                rowKey={(row) => `${row.job_name}-${row.batch_dt}-${row.last_updated}`}
                compact
                maxHeight={320}
                pageSize={100}
                accentColor="#37474f"
                tableMinWidth={1800}
                emptyMessage="No command detail rows found for the selected job"
              />
            </Box>
          )}
        </WidgetShell>
      </Paper>
    </Box>
  )
}