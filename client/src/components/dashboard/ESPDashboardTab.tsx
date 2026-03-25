import React from 'react'
import { Box, Typography, Select, MenuItem, CircularProgress, Paper, Chip } from '@mui/material'
import WorkIcon from '@mui/icons-material/Work'
import ScheduleIcon from '@mui/icons-material/Schedule'
import AccountTreeIcon from '@mui/icons-material/AccountTree'
import StorageIcon from '@mui/icons-material/Storage'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'
import TableChartIcon from '@mui/icons-material/TableChart'
import PeopleIcon from '@mui/icons-material/People'
import AppsIcon from '@mui/icons-material/Apps'
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown'
import {
  WidgetShell, StatCardGrid, MetricBarList, DataTable, TrendLineChart,
} from '../widgets'
import type { ColumnDef } from '../widgets'
import { espService } from '../../services'
import { useMockData } from '../../context/MockDataContext'
import { MOCK_ESP_APPLICATIONS, getMockAppData } from '../../services/espMockData'

// ─── Types ────────────────────────────────────────────────
interface NameCount { name: string; count: number }

interface AppData {
  appl_name: string
  job_count: number
  idle_job_count: number
  spl_job_count: number
  agents: NameCount[]
  job_types: NameCount[]
  completion_codes: NameCount[]
  accounts: NameCount[]
  job_list: Array<{ jobname: string; last_run_date: string | null }>
  job_run_trend: Array<{ day: string; hour: number; count: number }>
  successor_jobs: Array<{ jobname: string; successor_job: string }>
  predecessor_jobs: Array<{ jobname: string; predecessor_job: string }>
  metadata: Array<{ jobname: string; command: string | null; argument: string | null }>
}

const TREND_LINE_COLORS = ['#1565c0', '#2e7d32', '#c62828', '#f57c00']

// Helper: turn NameCount[] → MetricBarItem[] with alternating bar colors
const BAR_COLORS = ['#1976d2', '#f57c00', '#c62828', '#2e7d32', '#6a1b9a', '#00838f']
const toBarItems = (items: NameCount[]) => {
  const max = Math.max(...items.map(i => i.count), 1)
  return items.map((item, idx) => ({
    label: item.name,
    value: item.count,
    max,
    color: BAR_COLORS[idx % BAR_COLORS.length],
  }))
}

// ─── Main Component ───────────────────────────────────────
export const ESPDashboardTab: React.FC = () => {
  const { useMock } = useMockData()
  const [applications, setApplications] = React.useState<string[]>([])
  const [selected, setSelected] = React.useState<string>('')
  const [data, setData] = React.useState<AppData | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [appsLoading, setAppsLoading] = React.useState(true)

  // Load application list on mount or when mock mode changes
  React.useEffect(() => {
    setAppsLoading(true)
    setApplications([])
    setData(null)
    if (useMock) {
      const apps = MOCK_ESP_APPLICATIONS.map(a => a.appl_name)
      setApplications(apps)
      setSelected(apps[0] ?? '')
      setAppsLoading(false)
      return
    }
    espService.getApplications()
      .then((res: any) => {
        const apps: string[] = (res.applications || []).map((a: any) => a.appl_name)
        setApplications(apps)
        if (apps.length > 0) setSelected(apps[0])
      })
      .catch(() => {})
      .finally(() => setAppsLoading(false))
  }, [useMock])

  // Load detail whenever selection or mock mode changes
  React.useEffect(() => {
    if (!selected) return
    setLoading(true)
    setData(null)
    if (useMock) {
      setData(getMockAppData(selected))
      setLoading(false)
      return
    }
    espService.getAppSummary(selected)
      .then((res: any) => setData(res))
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [selected, useMock])

  // Transform trend data for recharts: one key per day, indexed by hour
  const trendChart = React.useMemo(() => {
    if (!data?.job_run_trend?.length) return { rows: [], days: [] }
    const days = [...new Set(data.job_run_trend.map(t => t.day))].sort()
    const byHour: Record<number, Record<string, number>> = {}
    data.job_run_trend.forEach(({ day, hour, count }) => {
      if (!byHour[hour]) byHour[hour] = {}
      byHour[hour][day] = count
    })
    const rows = Object.entries(byHour)
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([hour, vals]) => ({ hour: Number(hour), ...vals }))
    return { rows, days }
  }, [data])

  // Metadata table column defs
  const metaCols: ColumnDef[] = [
    { key: 'jobname',  header: 'Jobname (EJC)',   flex: 1,  noWrap: true },
    { key: 'command',  header: 'Command (EJC)',    flex: 1,  render: r => r.command ?? '—' },
    { key: 'argument', header: 'Argument (EJC)',   flex: 1.5, render: r => r.argument ?? '—' },
  ]

  const jobListCols: ColumnDef[] = [
    { key: 'jobname',       header: 'Job Name',      flex: 1, noWrap: true },
    { key: 'last_run_date', header: 'Last Run',       width: 120,
      render: r => r.last_run_date
        ? new Date(r.last_run_date).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
        : <Typography component="span" sx={{ fontSize: '10px', color: '#bbb' }}>Never run</Typography> },
  ]

  const depCols: ColumnDef[] = [
    { key: 'jobname', header: 'Job Name', flex: 1, noWrap: true },
    { key: 'col2',    header: 'Link',     width: 120, noWrap: true,
      render: (r: any) => r.successor_job ?? r.predecessor_job ?? '—' },
  ]

  return (
    <Box sx={{ bgcolor: '#f5f6f8', minHeight: '100%', p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>

      {/* ── App selector bar ── */}
      <Paper
        elevation={0}
        sx={{ borderRadius: 2, border: '1px solid #e8ecf1', bgcolor: '#f8f9fb', overflow: 'hidden' }}
      >
        <Box sx={{ px: 2, py: 1.25, display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
          <AppsIcon sx={{ fontSize: 16, color: '#2e7d32' }} />
          <Typography sx={{ fontWeight: 700, fontSize: '11px', color: '#555', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
            ESP — Enterprise Scheduler Platform
          </Typography>
          {useMock && (
            <Chip label="MOCK DATA" size="small" sx={{ fontSize: '9px', height: 18, bgcolor: '#fff3e0', color: '#f57c00', fontWeight: 700, border: '1px solid #f57c0040' }} />
          )}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, ml: 'auto' }}>
            <Typography sx={{ fontSize: '12px', color: '#666', fontWeight: 500 }}>Application:</Typography>
            {appsLoading ? (
              <CircularProgress size={14} sx={{ color: '#2e7d32' }} />
            ) : (
              <Select
                value={selected}
                onChange={e => setSelected(e.target.value)}
                size="small"
                IconComponent={KeyboardArrowDownIcon}
                disabled={applications.length === 0}
                sx={{
                  fontSize: '12px',
                  minWidth: 180,
                  bgcolor: '#fff',
                  borderRadius: 1,
                  fontWeight: 600,
                  '& .MuiSelect-select': { py: '5px', px: '10px' },
                  '& .MuiOutlinedInput-notchedOutline': { borderColor: '#2e7d3240' },
                  '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#2e7d32' },
                  '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#2e7d32' },
                }}
              >
                {applications.map(app => (
                  <MenuItem key={app} value={app} sx={{ fontSize: '12px' }}>{app}</MenuItem>
                ))}
              </Select>
            )}
          </Box>
        </Box>
      </Paper>

      {/* ── Loading ── */}
      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress sx={{ color: '#2e7d32' }} />
        </Box>
      )}

      {/* ── No data ── */}
      {!loading && !data && selected && (
        <Paper elevation={0} sx={{ borderRadius: 2, p: 4, textAlign: 'center', border: '1px solid #e8ecf1' }}>
          <Typography sx={{ fontSize: '13px', color: '#aaa' }}>
            No data available for <strong>{selected}</strong>
          </Typography>
        </Paper>
      )}

      {/* ── Dashboard ── */}
      {!loading && data && (
        <>
          {/* ── Row 1: KPI stat cards ── */}
          <Paper elevation={0} sx={{ borderRadius: 2, overflow: 'hidden', border: '1px solid #e8ecf1', borderTop: '3px solid #2e7d32', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <WidgetShell
              title={data.appl_name}
              source="ESP · Enterprise Scheduler"
              titleIcon={<AppsIcon sx={{ color: '#2e7d32', fontSize: 18 }} />}
            >
              <Box sx={{ p: 1.5 }}>
                <StatCardGrid
                  items={[
                    { label: 'Total Jobs',     value: data.job_count,       color: '#1976d2', bg: '#e3f2fd' },
                    { label: 'Idle Jobs',      value: data.idle_job_count,  color: '#f57c00', bg: '#fff3e0' },
                    { label: 'Special Jobs',   value: data.spl_job_count,   color: '#c62828', bg: '#fce4ec' },
                    { label: 'Agents',         value: data.agents.length,   color: '#2e7d32', bg: '#e8f5e9' },
                    { label: 'Job Types',      value: data.job_types.length, color: '#6a1b9a', bg: '#f3e5f5' },
                    { label: 'Accounts',       value: data.accounts.length, color: '#00838f', bg: '#e0f7fa' },
                  ]}
                  columns={6}
                />
              </Box>
            </WidgetShell>
          </Paper>

          {/* ── Row 2: Job List + Trend ── */}
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 2 }}>

            <Paper elevation={0} sx={{ borderRadius: 2, overflow: 'hidden', border: '1px solid #e8ecf1', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
              <WidgetShell
                title="Job List"
                source={`${data.job_list.length} jobs`}
                titleIcon={<WorkIcon sx={{ color: '#1976d2', fontSize: 18 }} />}
              >
                <Box sx={{ flex: 1, overflowY: 'auto', px: 1.5, pb: 1 }}>
                  <DataTable
                    columns={jobListCols}
                    rows={data.job_list}
                    rowKey="jobname"
                    compact
                    maxHeight={280}
                    emptyMessage="No jobs found"
                  />
                </Box>
              </WidgetShell>
            </Paper>

            <Paper elevation={0} sx={{ borderRadius: 2, overflow: 'hidden', border: '1px solid #e8ecf1', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
              <WidgetShell
                title="Job Run Trend — Last 2 Days"
                source="ESP"
                titleIcon={<TrendingUpIcon sx={{ color: '#1565c0', fontSize: 18 }} />}
              >
                <Box sx={{ px: 2, pb: 2, pt: 0.5 }}>
                  {trendChart.rows.length > 0 ? (
                    <TrendLineChart
                      data={trendChart.rows}
                      xKey="hour"
                      lines={trendChart.days.map((day, i) => ({
                        key: day,
                        label: day,
                        color: TREND_LINE_COLORS[i % TREND_LINE_COLORS.length],
                        strokeWidth: 2,
                      }))}
                      height={260}
                      margin={{ top: 8, right: 16, left: -10, bottom: 4 }}
                    />
                  ) : (
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 260 }}>
                      <Typography sx={{ fontSize: '12px', color: '#bbb' }}>No trend data available</Typography>
                    </Box>
                  )}
                </Box>
              </WidgetShell>
            </Paper>
          </Box>

          {/* ── Row 3: Agent | Job Type | Completion Code | Account ── */}
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 2 }}>
            {[
              { title: 'Agent',           icon: <PeopleIcon sx={{ color: '#1976d2', fontSize: 18 }} />,    items: data.agents,           accent: '#1976d2' },
              { title: 'Job Type',        icon: <StorageIcon sx={{ color: '#6a1b9a', fontSize: 18 }} />,    items: data.job_types,        accent: '#6a1b9a' },
              { title: 'Completion Code', icon: <ScheduleIcon sx={{ color: '#2e7d32', fontSize: 18 }} />,   items: data.completion_codes, accent: '#2e7d32' },
              { title: 'Account',         icon: <AccountTreeIcon sx={{ color: '#f57c00', fontSize: 18 }} />, items: data.accounts,         accent: '#f57c00' },
            ].map(({ title, icon, items, accent }) => (
              <Paper key={title} elevation={0} sx={{ borderRadius: 2, overflow: 'hidden', border: `1px solid ${accent}22`, borderTop: `3px solid ${accent}`, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                <WidgetShell title={title} source={`${items.length} entries`} titleIcon={icon}>
                  <Box sx={{ p: 1.5 }}>
                    {items.length === 0 ? (
                      <Typography sx={{ fontSize: '11px', color: '#bbb', textAlign: 'center', py: 2 }}>No data</Typography>
                    ) : (
                      <MetricBarList
                        items={toBarItems(items)}
                        barHeight={8}
                        compact
                      />
                    )}
                  </Box>
                </WidgetShell>
              </Paper>
            ))}
          </Box>

          {/* ── Row 4: Predecessor Jobs | Successor Jobs | Metadata Table ── */}
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 2fr', gap: 2 }}>

            <Paper elevation={0} sx={{ borderRadius: 2, overflow: 'hidden', border: '1px solid #e8ecf1', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
              <WidgetShell
                title="Predecessor Jobs"
                source={`${data.predecessor_jobs.length}`}
                titleIcon={<AccountTreeIcon sx={{ color: '#1565c0', fontSize: 18 }} />}
              >
                <Box sx={{ flex: 1, overflowY: 'auto', px: 1.5, pb: 1 }}>
                  <DataTable
                    columns={[depCols[0], { ...depCols[1], header: 'Predecessor' }]}
                    rows={data.predecessor_jobs}
                    rowKey="jobname"
                    compact
                    maxHeight={220}
                    emptyMessage="No predecessor jobs"
                  />
                </Box>
              </WidgetShell>
            </Paper>

            <Paper elevation={0} sx={{ borderRadius: 2, overflow: 'hidden', border: '1px solid #e8ecf1', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
              <WidgetShell
                title="Successor Jobs"
                source={`${data.successor_jobs.length}`}
                titleIcon={<AccountTreeIcon sx={{ color: '#2e7d32', fontSize: 18 }} />}
              >
                <Box sx={{ flex: 1, overflowY: 'auto', px: 1.5, pb: 1 }}>
                  <DataTable
                    columns={[depCols[0], { ...depCols[1], header: 'Successor' }]}
                    rows={data.successor_jobs}
                    rowKey="jobname"
                    compact
                    maxHeight={220}
                    emptyMessage="No successor jobs"
                  />
                </Box>
              </WidgetShell>
            </Paper>

            <Paper elevation={0} sx={{ borderRadius: 2, overflow: 'hidden', border: '1px solid #e8ecf1', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
              <WidgetShell
                title="Metadata Table"
                source={`${data.metadata.length} records`}
                titleIcon={<TableChartIcon sx={{ color: '#37474f', fontSize: 18 }} />}
              >
                <Box sx={{ flex: 1, overflowY: 'auto', px: 1.5, pb: 1 }}>
                  <DataTable
                    columns={metaCols}
                    rows={data.metadata}
                    rowKey="jobname"
                    compact
                    maxHeight={220}
                    emptyMessage="No metadata records"
                  />
                </Box>
              </WidgetShell>
            </Paper>
          </Box>
        </>
      )}
    </Box>
  )
}

