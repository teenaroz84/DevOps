import React from 'react'
import { Box, Typography, CircularProgress, Paper, Chip, Autocomplete, TextField, Button, Checkbox, Select, MenuItem, FormControl, Tooltip, IconButton } from '@mui/material'
import WorkIcon from '@mui/icons-material/Work'
import ScheduleIcon from '@mui/icons-material/Schedule'
import AccountTreeIcon from '@mui/icons-material/AccountTree'
import StorageIcon from '@mui/icons-material/Storage'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'
import TableChartIcon from '@mui/icons-material/TableChart'
import PeopleIcon from '@mui/icons-material/People'
import AppsIcon from '@mui/icons-material/Apps'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'

import SmartToyIcon from '@mui/icons-material/SmartToy'
import {
  WidgetShell, StatCardGrid, MetricBarList, DataTable, TrendLineChart, DonutChart,
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
  user_jobs: NameCount[]
  job_list: Array<{ jobname: string; last_run_date: string | null; appl_name?: string }>
  job_run_trend: Array<{ day: string; hour: number; job_count: number; job_fail_count: number }>
  successor_jobs: Array<{ jobname: string; successor_job: string }>
  predecessor_jobs: Array<{ jobname: string; predecessor_job: string }>
  metadata: Array<{ jobname: string; command: string | null; argument: string | null }>
  metadata_detail: Array<{ jobname: string; command: string | null; argument: string | null; agent: string | null; job_type: string | null; comp_code: string | null; runs: number | null; user_job: string | null }>
  job_run_table: Array<{ job_longname: string; command: string | null; argument: string | null; runs: number | null; start_date: string | null; start_time: string | null; end_date: string | null; end_time: string | null; exec_qtime: string | null; ccfail: string | null; comp_code: string | null }>
}

const TREND_RUN_COLORS  = ['#1565c0', '#2e7d32', '#6a1b9a', '#00838f']
const TREND_FAIL_COLORS = ['#e53935', '#f57c00', '#d81b60', '#ff6f00']

// Full display names shown on hover of platform dropdown items
const PLATFORM_FULL_NAMES: Record<string, string> = {
  'PowerCenter':       'Informatica PowerCenter (SPO)',
  'Abinitio':          'Ab Initio — Data Processing Platform',
  'EDL':               'Enterprise Data Lake (EDL)',
  'IICS/SF':           'Informatica Intelligent Cloud Services / Salesforce',
  'Talend':            'Talend Data Integration Platform',
  'PPCM':              'Pipeline Process Control Management (PPCM)',
  'PDA':               'Predictive Data Analytics (PDA)',
  'Permissible Call':  'Permissible Call Jobs',
}

const BAR_COLORS = ['#1976d2', '#f57c00', '#c62828', '#2e7d32', '#6a1b9a', '#00838f']

// ─── Main Component ───────────────────────────────────────
export const ESPDashboardTab: React.FC<{ onOpenAgent?: (agentId: string) => void }> = ({ onOpenAgent }) => {
  const { useMock } = useMockData()
  const [applications, setApplications] = React.useState<string[]>([])
  const [selected, setSelected] = React.useState<string>('')
  const [data, setData] = React.useState<AppData | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [appsLoading, setAppsLoading] = React.useState(true)
  const [trendDays, setTrendDays] = React.useState<number>(2)
  const [trendData, setTrendData] = React.useState<Array<{ day: string; hour: number; job_count: number; job_fail_count: number }>>([])
  const [trendLoading, setTrendLoading] = React.useState(false)
  const [metadataDetail, setMetadataDetail] = React.useState<AppData['metadata_detail']>([])
  const [jobRunTable, setJobRunTable] = React.useState<AppData['job_run_table']>([])
  const [tableLoading, setTableLoading] = React.useState(false)
  const [selectedJobs, setSelectedJobs] = React.useState<string[]>([])

  // ── Drill-down state ─────────────────────────────────────
  // drillJob: jobname clicked in job list → shows per-job trend
  const [drillJob, setDrillJob] = React.useState<string | null>(null)
  const [drillJobTrend, setDrillJobTrend] = React.useState<Array<{ day: string; hour: number; job_count: number; job_fail_count: number }>>([])
  const [drillJobTrendLoading, setDrillJobTrendLoading] = React.useState(false)
  // widgetFilter: agent/job_type/user_job clicked in widget → filters tables
  const [widgetFilter, setWidgetFilter] = React.useState<{ field: 'agent' | 'job_type' | 'user_job'; value: string } | null>(null)

  // ── Platform state ───────────────────────────────────────
  const [platformSummary, setPlatformSummary] = React.useState<{ platform: string; total: number; idle: number; special: number; app_count: number }[]>([])
  const [selectedPlatform, setSelectedPlatform] = React.useState<string | null>(null)
  const [platformApplications, setPlatformApplications] = React.useState<string[]>([])

  // Reset job filter + drill-down when application or platform changes
  React.useEffect(() => { setSelectedJobs([]); setDrillJob(null); setWidgetFilter(null) }, [selected, selectedPlatform])

  // Load platform summary once on mount (and when mock changes)
  // Auto-selects the first platform so the dashboard is populated on load
  React.useEffect(() => {
    if (useMock) return  // no mock data for platforms
    espService.getPlatformSummary()
      .then((res: any) => {
        const list = Array.isArray(res) ? res : []
        setPlatformSummary(list)
        if (list.length > 0) setSelectedPlatform(list[0].platform)
      })
      .catch(() => {})
  }, [useMock])

  // When platform selected, load its detail + metadata + run table
  React.useEffect(() => {
    if (!selectedPlatform || useMock) return
    setLoading(true)
    setData(null)
    espService.getPlatformDetail(selectedPlatform)
      .then((res: any) => {
        if (!res || res.error) { setData(null); return }
        setData({
          ...res,
          agents:           Array.isArray(res.agents)           ? res.agents           : [],
          job_types:        Array.isArray(res.job_types)        ? res.job_types        : [],
          completion_codes: Array.isArray(res.completion_codes) ? res.completion_codes : [],
          user_jobs:        Array.isArray(res.user_jobs)        ? res.user_jobs        : [],
          job_list:         Array.isArray(res.job_list)         ? res.job_list         : [],
          job_run_trend:    [],
          successor_jobs:   Array.isArray(res.successor_jobs)   ? res.successor_jobs   : [],
          predecessor_jobs: Array.isArray(res.predecessor_jobs) ? res.predecessor_jobs : [],
          metadata:         Array.isArray(res.metadata)         ? res.metadata         : [],
        })
      })
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [selectedPlatform, useMock])

  React.useEffect(() => {
    if (!selectedPlatform || useMock) return
    setTableLoading(true)
    setMetadataDetail([])
    setJobRunTable([])
    Promise.all([
      espService.getPlatformMetadata(selectedPlatform).catch(() => []),
      espService.getPlatformJobRunTable(selectedPlatform).catch(() => []),
    ]).then(([meta, runs]: any) => {
      setMetadataDetail(Array.isArray(meta) ? meta : [])
      setJobRunTable(Array.isArray(runs) ? runs : [])
    }).finally(() => setTableLoading(false))
  }, [selectedPlatform, useMock])

  // Load application names for the selected platform (shown as qualifiers)
  React.useEffect(() => {
    if (!selectedPlatform || useMock) { setPlatformApplications([]); return }
    espService.getPlatformApplications(selectedPlatform)
      .then((res: any) => setPlatformApplications(Array.isArray(res) ? res : []))
      .catch(() => setPlatformApplications([]))
  }, [selectedPlatform, useMock])

  // Load application list on mount or when mock mode changes
  React.useEffect(() => {
    setAppsLoading(true)
    setApplications([])
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
        // do NOT auto-select apps[0] — platform selection drives default load
      })
      .catch(() => {})
      .finally(() => setAppsLoading(false))
  }, [useMock])

  // Load detail whenever selection or mock mode changes (skipped when platform is active)
  React.useEffect(() => {
    if (!selected || selectedPlatform) return
    setLoading(true)
    setData(null)
    if (useMock) {
      setData(getMockAppData(selected))
      setLoading(false)
      return
    }
    espService.getAppSummary(selected)
      .then((res: any) => {
        if (!res || res.error) { setData(null); return }
        setData({
          ...res,
          agents:           Array.isArray(res.agents)           ? res.agents           : [],
          job_types:        Array.isArray(res.job_types)        ? res.job_types        : [],
          completion_codes: Array.isArray(res.completion_codes) ? res.completion_codes : [],
          user_jobs:        Array.isArray(res.user_jobs)        ? res.user_jobs        : [],
          job_list:         Array.isArray(res.job_list)         ? res.job_list         : [],
          job_run_trend:    Array.isArray(res.job_run_trend)    ? res.job_run_trend    : [],
          successor_jobs:   Array.isArray(res.successor_jobs)   ? res.successor_jobs   : [],
          predecessor_jobs: Array.isArray(res.predecessor_jobs) ? res.predecessor_jobs : [],
          metadata:         Array.isArray(res.metadata)         ? res.metadata         : [],
        })
      })
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [selected, selectedPlatform, useMock])

  // Load metadata detail + job run table whenever selection or mock mode changes
  React.useEffect(() => {
    if (!selected || selectedPlatform) return
    setTableLoading(true)
    setMetadataDetail([])
    setJobRunTable([])
    if (useMock) {
      const mockApp = getMockAppData(selected)
      setMetadataDetail(mockApp?.metadata_detail ?? [])
      setJobRunTable(mockApp?.job_run_table ?? [])
      setTableLoading(false)
      return
    }
    Promise.all([
      espService.getMetadata(selected).catch(() => []),
      espService.getJobRunTable(selected).catch(() => []),
    ]).then(([meta, runs]: any) => {
      setMetadataDetail(Array.isArray(meta) ? meta : [])
      setJobRunTable(Array.isArray(runs) ? runs : [])
    }).finally(() => setTableLoading(false))
  }, [selected, selectedPlatform, useMock])

  // Load trend data independently — uses platform or app selection
  React.useEffect(() => {
    const activeKey = selectedPlatform ?? selected
    if (!activeKey) return
    setTrendLoading(true)
    setTrendData([])
    if (useMock) {
      const mockApp = getMockAppData(selected)
      setTrendData((mockApp?.job_run_trend as any) ?? [])
      setTrendLoading(false)
      return
    }
    const req = selectedPlatform
      ? espService.getPlatformRunTrend(selectedPlatform, trendDays)
      : espService.getJobRunTrend(selected, trendDays)
    req
      .then((res: any) => setTrendData(Array.isArray(res) ? res : []))
      .catch(() => setTrendData([]))
      .finally(() => setTrendLoading(false))
  }, [selected, selectedPlatform, trendDays, useMock])

  // Load per-job trend when drillJob or trendDays changes
  React.useEffect(() => {
    if (!drillJob) { setDrillJobTrend([]); return }
    setDrillJobTrendLoading(true)
    espService.getJobRunTrendByJob(drillJob, trendDays)
      .then((res: any) => setDrillJobTrend(Array.isArray(res) ? res : []))
      .catch(() => setDrillJobTrend([]))
      .finally(() => setDrillJobTrendLoading(false))
  }, [drillJob, trendDays])

  // Transform trend data for recharts: keys ${day}_count and ${day}_fail per hour
  const buildTrendChart = (rows: Array<{ day: string; hour: number; job_count: number; job_fail_count: number }>) => {
    if (!rows.length) return { rows: [], days: [] as string[] }
    const days = [...new Set(rows.map(t => t.day))].sort()
    const byHour: Record<number, Record<string, number>> = {}
    rows.forEach(({ day, hour, job_count, job_fail_count }) => {
      if (!byHour[hour]) byHour[hour] = {}
      byHour[hour][`${day}_count`] = job_count
      byHour[hour][`${day}_fail`] = job_fail_count
    })
    const chartRows = Object.entries(byHour)
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([hour, vals]) => ({ hour: `${hour}:00`, ...vals }))
    return { rows: chartRows, days }
  }
  const trendChart     = React.useMemo(() => buildTrendChart(trendData),    [trendData])
  const drillJobChart  = React.useMemo(() => buildTrendChart(drillJobTrend), [drillJobTrend])

  // Available job options for the job selector dropdown
  const jobOptions = React.useMemo(() => (data?.job_list ?? []).map(j => j.jobname), [data])

  // Jobnames matching widgetFilter (derived from metadataDetail)
  const widgetFilteredJobnames = React.useMemo(() => {
    if (!widgetFilter) return null
    const matching = new Set(
      metadataDetail
        .filter(r => {
          const val: string | null = widgetFilter.field === 'agent'    ? r.agent
            : widgetFilter.field === 'job_type' ? r.job_type
            : widgetFilter.field === 'user_job' ? r.user_job
            : null
          return (val ?? 'Null') === widgetFilter.value
        })
        .map(r => r.jobname)
    )
    return matching
  }, [widgetFilter, metadataDetail])

  // Filtered rows — driven by selectedJobs + widgetFilter (empty = all jobs)
  const filteredJobList     = React.useMemo(() => (data?.job_list ?? [])
    .filter(r => !selectedJobs.length || selectedJobs.includes(r.jobname))
    .filter(r => !widgetFilteredJobnames || widgetFilteredJobnames.has(r.jobname)),        [data, selectedJobs, widgetFilteredJobnames])
  const filteredMeta        = React.useMemo(() => (data?.metadata ?? [])
    .filter(r => !selectedJobs.length || selectedJobs.includes(r.jobname))
    .filter(r => !widgetFilteredJobnames || widgetFilteredJobnames.has(r.jobname)),        [data, selectedJobs, widgetFilteredJobnames])
  const filteredPred        = React.useMemo(() => (data?.predecessor_jobs ?? [])
    .filter(r => !selectedJobs.length || selectedJobs.includes(r.jobname))
    .filter(r => !widgetFilteredJobnames || widgetFilteredJobnames.has(r.jobname)),        [data, selectedJobs, widgetFilteredJobnames])
  const filteredSucc        = React.useMemo(() => (data?.successor_jobs ?? [])
    .filter(r => !selectedJobs.length || selectedJobs.includes(r.jobname))
    .filter(r => !widgetFilteredJobnames || widgetFilteredJobnames.has(r.jobname)),        [data, selectedJobs, widgetFilteredJobnames])
  const filteredMetaDetail  = React.useMemo(() => metadataDetail
    .filter(r => !selectedJobs.length || selectedJobs.includes(r.jobname))
    .filter(r => !widgetFilteredJobnames || widgetFilteredJobnames.has(r.jobname)),        [metadataDetail, selectedJobs, widgetFilteredJobnames])
  const filteredJobRunTable = React.useMemo(() => jobRunTable
    .filter(r => !selectedJobs.length || selectedJobs.includes(r.job_longname))
    .filter(r => !widgetFilteredJobnames || widgetFilteredJobnames.has(r.job_longname)),   [jobRunTable, selectedJobs, widgetFilteredJobnames])

  // Metadata detail columns (full esp_job_cmnd data)
  const metaCols: ColumnDef[] = [
    { key: 'jobname',   header: 'Job Name',       flex: 1,   noWrap: true },
    { key: 'command',   header: 'Command',         flex: 1,   render: r => r.command   ?? '—' },
    { key: 'argument',  header: 'Argument',        flex: 1.5, render: r => r.argument  ?? '—' },
    { key: 'agent',     header: 'Agent',           flex: 1,   render: r => r.agent     ?? '—' },
    { key: 'job_type',  header: 'Job Type',        width: 90, render: r => r.job_type  ?? '—' },
    { key: 'comp_code', header: 'Cmpl Code',       width: 80, render: r => r.comp_code ?? '—' },
    { key: 'runs',      header: 'Runs',            width: 60, render: r => r.runs != null ? r.runs : '—' },
    { key: 'user_job',  header: 'User Job',        width: 100, render: r => r.user_job ?? '—' },
  ]

  // Job run table columns (esp_job_cmnd JOIN esp_job_stats_recent)
  const jobRunTableCols: ColumnDef[] = [
    { key: 'job_longname', header: 'Job Name',    flex: 1,   noWrap: true },
    { key: 'start_date',   header: 'Start Date',  width: 90, render: r => r.start_date ?? '—' },
    { key: 'start_time',   header: 'Start Time',  width: 80, render: r => r.start_time ? String(r.start_time).slice(0, 8) : '—' },
    { key: 'end_date',     header: 'End Date',    width: 90, render: r => r.end_date   ?? '—' },
    { key: 'end_time',     header: 'End Time',    width: 80, render: r => r.end_time   ? String(r.end_time).slice(0, 8) : '—' },
    { key: 'exec_qtime',   header: 'Exec Time',   width: 80, render: r => r.exec_qtime ? String(r.exec_qtime).slice(0, 8) : '—' },
    { key: 'runs',         header: 'Runs',        width: 55, render: r => r.runs != null ? r.runs : '—' },
    { key: 'ccfail',       header: 'CC Fail',     width: 70, render: r => {
      const v = r.ccfail
      if (!v) return '—'
      return <Typography component="span" sx={{ fontSize: '10px', fontWeight: 700, color: v === 'YES' ? '#c62828' : '#2e7d32' }}>{v}</Typography>
    }},
    { key: 'comp_code',    header: 'Comp Code',  width: 80, render: r => r.comp_code ?? '—' },
    { key: 'command',      header: 'Command',     flex: 1,   render: r => r.command   ?? '—' },
    { key: 'argument',     header: 'Argument',    flex: 1.5, render: r => r.argument  ?? '—' },
  ]

  const jobListCols: ColumnDef[] = React.useMemo(() => {
    const applCol: ColumnDef = selectedPlatform ? {
      key: 'appl_name',
      header: 'Application',
      width: 120,
      noWrap: true,
      render: r => r.appl_name ? (
        <Typography
          component="span"
          onClick={(e: React.MouseEvent) => { e.stopPropagation(); setSelected(r.appl_name); setSelectedPlatform(null) }}
          sx={{ fontSize: '11px', color: '#1976d2', cursor: 'pointer', '&:hover': { textDecoration: 'underline' }, fontWeight: 600 }}
        >
          {r.appl_name}
        </Typography>
      ) : '—',
    } : null as unknown as ColumnDef
    const baseCols: ColumnDef[] = [
      {
        key: 'jobname',
        header: 'Job Name',
        flex: 1,
        noWrap: true,
        render: r => (
          <Typography
            component="span"
            sx={{
              fontSize: '11px',
              fontWeight: drillJob === r.jobname ? 700 : 400,
              color: drillJob === r.jobname ? '#1565c0' : 'inherit',
            }}
          >
            {r.jobname}
          </Typography>
        ),
      },
      {
        key: 'last_run_date',
        header: 'Last Run',
        width: 130,
        render: r => {
          if (!r.last_run_date) {
            return (
              <Chip label="Never run" size="small" sx={{ height: 18, fontSize: '10px', fontWeight: 600, bgcolor: '#fffbeb', color: '#b45309', border: '1px solid #fde68a' }} />
            )
          }
          const daysSince = (Date.now() - new Date(r.last_run_date).getTime()) / 86_400_000
          const stale = daysSince > 3
          return (
            <Chip
              label={new Date(r.last_run_date).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              size="small"
              sx={{
                height: 18, fontSize: '10px', fontWeight: 600,
                bgcolor: stale ? '#fce4ec' : '#e8f5e9',
                color:   stale ? '#c62828' : '#2e7d32',
                border:  stale ? '1px solid #ef9a9a' : '1px solid #a5d6a7',
              }}
            />
          )
        },
      },
    ]
    return selectedPlatform ? [applCol, ...baseCols] : baseCols
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPlatform, drillJob])

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
        sx={{ borderRadius: 2, border: '1px solid #e8ecf1', bgcolor: '#f8f9fb', overflow: 'hidden', position: 'sticky', top: 0, zIndex: 10, boxShadow: '0 2px 8px rgba(0,0,0,0.07)' }}
      >
        {/* ── Row 1: Title ── */}
        <Box sx={{ px: 2, py: 1, display: 'flex', alignItems: 'center', gap: 1.5, borderBottom: '1px solid #e8ecf1' }}>
          <AppsIcon sx={{ fontSize: 15, color: '#2e7d32' }} />
          <Typography sx={{ fontWeight: 700, fontSize: '11px', color: '#555', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
            ESP — Enterprise Scheduler Platform
          </Typography>
          {useMock && (
            <Chip label="MOCK DATA" size="small" sx={{ fontSize: '9px', height: 18, bgcolor: '#fff3e0', color: '#f57c00', fontWeight: 700, border: '1px solid #f57c0040' }} />
          )}
          <Box sx={{ ml: 'auto' }}>
            {onOpenAgent && (
              <Button
                size="small"
                variant="contained"
                startIcon={<SmartToyIcon sx={{ fontSize: 14 }} />}
                onClick={() => onOpenAgent('esp')}
                sx={{
                  backgroundColor: '#2e7d32',
                  textTransform: 'none',
                  fontSize: '11px',
                  fontWeight: 700,
                  height: 26,
                  px: 1.5,
                  '&:hover': { backgroundColor: '#2e7d32', filter: 'brightness(0.9)' },
                }}
              >
                Ask ESP Agent
              </Button>
            )}
          </Box>
        </Box>

        {/* ── Row 2: Filters ── */}
        <Box sx={{ px: 2, py: 1, display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>

          {/* Platform */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
            <Typography sx={{ fontSize: '11px', color: '#555', fontWeight: 600, whiteSpace: 'nowrap' }}>Platform:</Typography>
            <FormControl size="small">
              <Select
                value={selectedPlatform ?? ''}
                onChange={(e) => {
                  const val = (e.target.value as string) || null
                  setSelectedPlatform(val)
                  if (!val) setData(null)
                }}
                displayEmpty
                renderValue={(val) => val ? String(val) : <em style={{ color: '#888' }}>All</em>}
                sx={{
                  fontSize: '12px', fontWeight: 600, minWidth: 150, bgcolor: '#fff',
                  '& .MuiOutlinedInput-notchedOutline': { borderColor: '#2e7d3240' },
                  '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#2e7d32' },
                  '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#2e7d32' },
                }}
              >
                <MenuItem value="" sx={{ fontSize: '12px', color: '#888' }}><em>All</em></MenuItem>
                {platformSummary.map(p => (
                  <MenuItem key={p.platform} value={p.platform} sx={{ fontSize: '12px', p: 0 }}>
                    <Tooltip title={PLATFORM_FULL_NAMES[p.platform] ?? p.platform} placement="right" arrow>
                      <Box sx={{ width: '100%', px: 2, py: 0.75, display: 'flex', alignItems: 'center' }}>
                        {p.platform}&ensp;<span style={{ fontSize: '10px', color: '#999' }}>({p.app_count} apps)</span>
                      </Box>
                    </Tooltip>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>

          {/* Application */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
            <Typography sx={{ fontSize: '11px', color: '#666', fontWeight: 500, whiteSpace: 'nowrap' }}>Application:</Typography>
            {selectedPlatform ? (
              platformApplications.length === 0 ? (
                <CircularProgress size={12} sx={{ color: '#2e7d32' }} />
              ) : (
                <Autocomplete
                  options={platformApplications}
                  value={null}
                  onChange={(_, val) => {
                    if (val) {
                      setSelected(val)
                      setSelectedPlatform(null)
                    }
                  }}
                  size="small"
                  sx={{ minWidth: 240 }}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      placeholder={`${platformApplications.length} app(s)`}
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          fontSize: '12px', fontWeight: 600, borderRadius: 1, bgcolor: '#fff',
                          '& .MuiOutlinedInput-notchedOutline': { borderColor: '#2e7d3240' },
                          '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#2e7d32' },
                          '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#2e7d32' },
                        },
                      }}
                    />
                  )}
                />
              )
            ) : appsLoading ? (
              <CircularProgress size={14} sx={{ color: '#2e7d32' }} />
            ) : (
              <Autocomplete
                options={applications}
                value={selected}
                onChange={(_, val) => setSelected(val ?? '')}
                disableClearable={false}
                size="small"
                sx={{ minWidth: 240 }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    placeholder="Search application…"
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        fontSize: '12px', fontWeight: 600, borderRadius: 1, bgcolor: '#fff',
                        '& .MuiOutlinedInput-notchedOutline': { borderColor: '#2e7d3240' },
                        '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#2e7d32' },
                        '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#2e7d32' },
                      },
                    }}
                  />
                )}
              />
            )}
          </Box>

          {/* Job selector */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
              <Typography sx={{ fontSize: '11px', color: '#666', fontWeight: 500, whiteSpace: 'nowrap' }}>Job:</Typography>
              <Autocomplete
                multiple
                options={['__SELECT_ALL__', ...jobOptions]}
                value={selectedJobs}
                disableCloseOnSelect
                clearOnEscape
                disabled={loading || !data}
                size="small"
                sx={{ minWidth: 220, maxWidth: 340 }}
                getOptionLabel={(option) => option === '__SELECT_ALL__' ? 'Select All' : option}
                onChange={(_, val) => {
                  if (val.includes('__SELECT_ALL__')) {
                    setSelectedJobs(selectedJobs.length === jobOptions.length ? [] : [...jobOptions])
                  } else {
                    setSelectedJobs(val)
                  }
                }}
                renderOption={(props, option, { selected }) => {
                  const { key, ...rest } = props as any
                  if (option === '__SELECT_ALL__') {
                    const allSelected = selectedJobs.length === jobOptions.length
                    return (
                      <li key="__SELECT_ALL__" {...rest} style={{ borderBottom: '1px solid #e8ecf1', fontWeight: 700 }}>
                        <Checkbox size="small" checked={allSelected} indeterminate={selectedJobs.length > 0 && !allSelected}
                          sx={{ mr: 1, p: 0.5, color: '#1976d2', '&.Mui-checked': { color: '#1976d2' }, '&.MuiCheckbox-indeterminate': { color: '#1976d2' } }} />
                        <Typography sx={{ fontSize: '12px', fontWeight: 700, color: '#1976d2' }}>Select All</Typography>
                      </li>
                    )
                  }
                  return (
                    <li key={option} {...rest}>
                      <Checkbox size="small" checked={selected}
                        sx={{ mr: 1, p: 0.5, color: '#1976d2', '&.Mui-checked': { color: '#1976d2' } }} />
                      <Typography sx={{ fontSize: '12px' }}>{option}</Typography>
                    </li>
                  )
                }}
                renderTags={(value) =>
                  value.length === 1 ? (
                    <Chip label={value[0]} size="small" onDelete={() => setSelectedJobs([])}
                      sx={{ fontSize: '10px', height: 18, color: '#1976d2', backgroundColor: '#e3f2fd', border: '1px solid #1976d240' }} />
                  ) : (
                    <Chip
                      label={`${value.length} jobs`}
                      size="small"
                      onDelete={() => setSelectedJobs([])}
                      sx={{ fontSize: '10px', height: 18, fontWeight: 700, color: '#1565c0', backgroundColor: '#e3f2fd', border: '1px solid #1976d240' }}
                    />
                  )
                }
                renderInput={(params) => (
                  <TextField
                    {...params}
                    placeholder={loading ? 'Loading…' : selectedJobs.length ? '' : 'All jobs'}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        fontSize: '12px', fontWeight: 600, borderRadius: 1, bgcolor: '#fff',
                        '& .MuiOutlinedInput-notchedOutline': { borderColor: '#1976d240' },
                        '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#1976d2' },
                        '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#1976d2' },
                      },
                    }}
                  />
                )}
              />
            </Box>

          {/* Clear Filters */}
          {(selectedJobs.length > 0 || (selected && !selectedPlatform) || (selectedPlatform && platformSummary.length > 0 && selectedPlatform !== platformSummary[0].platform)) && (
            <Button
              size="small"
              onClick={() => {
                const first = platformSummary[0]?.platform ?? null
                setSelectedJobs([])
                setSelected('')
                setSelectedPlatform(first)
              }}
              sx={{ fontSize: '10px', color: '#d32f2f', textTransform: 'none', height: 26, whiteSpace: 'nowrap', px: 1.25, border: '1px solid #ef9a9a', borderRadius: 1, '&:hover': { bgcolor: '#fce4ec' } }}
            >
              Clear Filters
            </Button>
          )}
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
                    { label: 'Total Jobs',     value: data.job_count,        color: '#1976d2', bg: '#e3f2fd' },
                    { label: 'Idle Jobs',      value: data.idle_job_count,   color: '#f57c00', bg: '#fff3e0' },
                    { label: 'Special Jobs',   value: data.spl_job_count,    color: '#c62828', bg: '#fce4ec' },
                    { label: 'Agents',         value: data.agents.length,    color: '#2e7d32', bg: '#e8f5e9' },
                    { label: 'Job Types',      value: data.job_types.length, color: '#6a1b9a', bg: '#f3e5f5' },
                    { label: 'User Jobs',      value: data.user_jobs.length, color: '#00838f', bg: '#e0f7fa' },
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
                source={`${filteredJobList.length}${filteredJobList.length !== data.job_list.length ? ` / ${data.job_list.length}` : ''} jobs · click a job to view its trend`}
                titleIcon={<WorkIcon sx={{ color: '#1976d2', fontSize: 18 }} />}
              >
                <Box sx={{ flex: 1, overflowY: 'auto', px: 1.5, pb: 1 }}>
                  <DataTable
                    columns={jobListCols}
                    rows={filteredJobList}
                    rowKey="jobname"
                    compact
                    maxHeight={280}
                    accentColor="#2e7d32"
                    emptyMessage="No jobs found"
                    onRowClick={row => setDrillJob(prev => prev === row.jobname ? null : row.jobname)}
                  />
                </Box>
              </WidgetShell>
            </Paper>

            <Paper elevation={0} sx={{ borderRadius: 2, overflow: 'hidden', border: '1px solid #e8ecf1', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
              <WidgetShell
                title={drillJob
                  ? `Job Trend — ${drillJob}`
                  : `Job Run Trend — Last ${trendDays} Day${trendDays > 1 ? 's' : ''}`}
                source={drillJob ? 'esp_job_stats_recent · click job again or × to reset' : 'ESP · esp_job_stats_recent'}
                titleIcon={<TrendingUpIcon sx={{ color: '#1565c0', fontSize: 18 }} />}
                actions={
                  <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
                    {drillJob && (
                      <IconButton
                        size="small"
                        onClick={() => setDrillJob(null)}
                        sx={{ p: 0.25, color: '#888', '&:hover': { color: '#333' } }}
                        title="Back to platform / app trend"
                      >
                        <ArrowBackIcon sx={{ fontSize: 14 }} />
                      </IconButton>
                    )}
                    {[1, 2, 3, 5, 7].map(d => (
                      <Chip
                        key={d}
                        label={`${d}d`}
                        size="small"
                        onClick={() => setTrendDays(d)}
                        sx={{
                          fontSize: '10px', height: 20, cursor: 'pointer',
                          bgcolor: trendDays === d ? '#1565c0' : '#e3f2fd',
                          color: trendDays === d ? '#fff' : '#1565c0',
                          fontWeight: trendDays === d ? 700 : 400,
                          '&:hover': { bgcolor: trendDays === d ? '#1565c0' : '#bbdefb' },
                        }}
                      />
                    ))}
                  </Box>
                }
              >
                <Box sx={{ px: 2, pb: 2, pt: 0.5 }}>
                  {drillJob ? (
                    drillJobTrendLoading ? (
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 260 }}>
                        <CircularProgress size={24} sx={{ color: '#1565c0' }} />
                      </Box>
                    ) : drillJobChart.rows.length > 0 ? (
                      <TrendLineChart
                        data={drillJobChart.rows}
                        xKey="hour"
                        lines={drillJobChart.days.flatMap((day, i) => [
                          { key: `${day}_count`, label: `${day} Runs`, color: TREND_RUN_COLORS[i % TREND_RUN_COLORS.length], strokeWidth: 2 },
                          { key: `${day}_fail`,  label: `${day} Fail`, color: TREND_FAIL_COLORS[i % TREND_FAIL_COLORS.length], dashed: true, strokeWidth: 1.5 },
                        ])}
                        height={260}
                        margin={{ top: 8, right: 16, left: -10, bottom: 4 }}
                      />
                    ) : (
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 260 }}>
                        <Typography sx={{ fontSize: '12px', color: '#bbb' }}>No run history for <strong>{drillJob}</strong></Typography>
                      </Box>
                    )
                  ) : trendLoading ? (
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 260 }}>
                      <CircularProgress size={24} sx={{ color: '#1565c0' }} />
                    </Box>
                  ) : trendChart.rows.length > 0 ? (
                    <TrendLineChart
                      data={trendChart.rows}
                      xKey="hour"
                      lines={trendChart.days.flatMap((day, i) => [
                        { key: `${day}_count`, label: `${day} Runs`, color: TREND_RUN_COLORS[i % TREND_RUN_COLORS.length], strokeWidth: 2 },
                        { key: `${day}_fail`,  label: `${day} Fail`, color: TREND_FAIL_COLORS[i % TREND_FAIL_COLORS.length], dashed: true, strokeWidth: 1.5 },
                      ])}
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

          {/* ── Widget filter active indicator ── */}
          {widgetFilter && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 0.5 }}>
              <Typography sx={{ fontSize: '11px', color: '#555' }}>Filtered by:</Typography>
              <Chip
                label={`${widgetFilter.field.replace('_', ' ')}: ${widgetFilter.value}`}
                size="small"
                onDelete={() => setWidgetFilter(null)}
                sx={{ fontSize: '11px', height: 22, fontWeight: 700, bgcolor: '#e3f2fd', color: '#1565c0', border: '1px solid #1976d240' }}
              />
              <Typography sx={{ fontSize: '11px', color: '#888' }}>
                ({filteredJobList.length} jobs shown)
              </Typography>
            </Box>
          )}

          {/* ── Row 3: Agent | Job Type (donut) | Completion Code (donut) | User Job ── */}
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 2 }}>

            {/* Agent — clickable bar list */}
            <Paper elevation={0} sx={{ borderRadius: 2, overflow: 'hidden', border: '1px solid #1976d222', borderTop: '3px solid #1976d2', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
              <WidgetShell title="Agent" source={`${data.agents.length} entries · click to filter`} titleIcon={<PeopleIcon sx={{ color: '#1976d2', fontSize: 18 }} />}>
                <Box sx={{ px: 1.5, pb: 1.5, pt: 0.5 }}>
                  {data.agents.length === 0 ? (
                    <Typography sx={{ fontSize: '11px', color: '#bbb', textAlign: 'center', py: 2 }}>No data</Typography>
                  ) : (
                    <MetricBarList
                      items={data.agents.map((a, idx) => ({
                        label: a.name,
                        value: a.count,
                        max: Math.max(...data.agents.map(x => x.count), 1),
                        color: widgetFilter?.field === 'agent' && widgetFilter.value === a.name ? '#1565c0' : BAR_COLORS[idx % BAR_COLORS.length],
                        onClick: () => setWidgetFilter(prev =>
                          prev?.field === 'agent' && prev.value === a.name ? null : { field: 'agent', value: a.name }
                        ),
                      }))}
                      barHeight={8}
                      compact
                    />
                  )}
                </Box>
              </WidgetShell>
            </Paper>

            {/* Job Type — donut */}
            <Paper elevation={0} sx={{ borderRadius: 2, overflow: 'hidden', border: '1px solid #6a1b9a22', borderTop: '3px solid #6a1b9a', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
              <WidgetShell title="Job Type" source={`${data.job_types.length} types · click to filter`} titleIcon={<StorageIcon sx={{ color: '#6a1b9a', fontSize: 18 }} />}>
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 1 }}>
                  {data.job_types.length === 0 ? (
                    <Typography sx={{ fontSize: '11px', color: '#bbb', py: 2 }}>No data</Typography>
                  ) : (
                    <DonutChart
                      data={data.job_types.map((t, i) => ({
                        name: t.name,
                        value: t.count,
                        color: ['#6a1b9a', '#1976d2', '#2e7d32', '#f57c00', '#c62828', '#00838f'][i % 6],
                      }))}
                      size={140}
                      centerLabel={data.job_types.reduce((s, t) => s + t.count, 0)}
                      showLegend
                      onSliceClick={name => setWidgetFilter(prev =>
                        prev?.field === 'job_type' && prev.value === name ? null : { field: 'job_type', value: name }
                      )}
                      activeSlice={widgetFilter?.field === 'job_type' ? widgetFilter.value : null}
                    />
                  )}
                </Box>
              </WidgetShell>
            </Paper>

            {/* Completion Code — donut */}
            <Paper elevation={0} sx={{ borderRadius: 2, overflow: 'hidden', border: '1px solid #2e7d3222', borderTop: '3px solid #2e7d32', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
              <WidgetShell title="Completion Code" source={`${data.completion_codes.length} codes · click to filter`} titleIcon={<ScheduleIcon sx={{ color: '#2e7d32', fontSize: 18 }} />}>
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 1 }}>
                  {data.completion_codes.length === 0 ? (
                    <Typography sx={{ fontSize: '11px', color: '#bbb', py: 2 }}>No data</Typography>
                  ) : (
                    <DonutChart
                      data={data.completion_codes.map((c, i) => ({
                        name: c.name,
                        value: c.count,
                        color: ['#2e7d32', '#c62828', '#f57c00', '#1976d2', '#6a1b9a', '#00838f'][i % 6],
                      }))}
                      size={140}
                      centerLabel={data.completion_codes.reduce((s, c) => s + c.count, 0)}
                      showLegend
                      onSliceClick={name => setWidgetFilter(prev =>
                        prev?.field === 'user_job' && prev.value === name ? null : { field: 'user_job', value: name }
                      )}
                      activeSlice={widgetFilter?.field === 'user_job' ? widgetFilter.value : null}
                    />
                  )}
                </Box>
              </WidgetShell>
            </Paper>

            {/* User Job — clickable bar list */}
            <Paper elevation={0} sx={{ borderRadius: 2, overflow: 'hidden', border: '1px solid #f57c0022', borderTop: '3px solid #f57c00', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
              <WidgetShell title="User Job" source={`${data.user_jobs.length} entries · click to filter`} titleIcon={<PeopleIcon sx={{ color: '#f57c00', fontSize: 18 }} />}>
                <Box sx={{ p: 1.5 }}>
                  {data.user_jobs.length === 0 ? (
                    <Typography sx={{ fontSize: '11px', color: '#bbb', textAlign: 'center', py: 2 }}>No data</Typography>
                  ) : (
                    <MetricBarList
                      items={data.user_jobs.map((u, idx) => ({
                        label: u.name,
                        value: u.count,
                        max: Math.max(...data.user_jobs.map(x => x.count), 1),
                        color: widgetFilter?.field === 'user_job' && widgetFilter.value === u.name ? '#e65100' : BAR_COLORS[idx % BAR_COLORS.length],
                        onClick: () => setWidgetFilter(prev =>
                          prev?.field === 'user_job' && prev.value === u.name ? null : { field: 'user_job', value: u.name }
                        ),
                      }))}
                      barHeight={8}
                      compact
                    />
                  )}
                </Box>
              </WidgetShell>
            </Paper>
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
                    rows={filteredPred}
                    rowKey="jobname"
                    compact
                    maxHeight={220}
                    accentColor="#1565c0"
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
                    rows={filteredSucc}
                    rowKey="jobname"
                    compact
                    maxHeight={220}
                    accentColor="#2e7d32"
                    emptyMessage="No successor jobs"
                  />
                </Box>
              </WidgetShell>
            </Paper>

            <Paper elevation={0} sx={{ borderRadius: 2, overflow: 'hidden', border: '1px solid #e8ecf1', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
              <WidgetShell
                title="Job Commands (esp_job_cmnd)"
                source={`${data.metadata.length} records`}
                titleIcon={<TableChartIcon sx={{ color: '#37474f', fontSize: 18 }} />}
              >
                <Box sx={{ flex: 1, overflowY: 'auto', px: 1.5, pb: 1 }}>
                  <DataTable
                    columns={[
                      { key: 'jobname',  header: 'Job Name',  flex: 1, noWrap: true },
                      { key: 'command',  header: 'Command',   flex: 1, render: r => r.command  ?? '—' },
                      { key: 'argument', header: 'Argument', flex: 1.5, render: r => r.argument ?? '—' },
                    ]}
                    rows={filteredMeta}
                    rowKey="jobname"
                    compact
                    maxHeight={220}
                    accentColor="#37474f"
                    emptyMessage="No records"
                  />
                </Box>
              </WidgetShell>
            </Paper>
          </Box>

          {/* ── Row 5: Metadata Detail ── */}
          <Paper elevation={0} sx={{ borderRadius: 2, overflow: 'hidden', border: '1px solid #e8ecf1', borderTop: '3px solid #37474f', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <WidgetShell
              title="Metadata Table (esp_job_cmnd)"
              source={`${metadataDetail.length} records · SELECT * FROM esp_job_cmnd`}
              titleIcon={<TableChartIcon sx={{ color: '#37474f', fontSize: 18 }} />}
            >
              {tableLoading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress size={22} sx={{ color: '#37474f' }} /></Box>
              ) : (
                <Box sx={{ px: 1.5, pb: 1 }}>
                  <DataTable
                    columns={metaCols}
                    rows={filteredMetaDetail}
                    rowKey="jobname"
                    compact
                    maxHeight={280}
                    accentColor="#37474f"
                    emptyMessage="No metadata records"
                  />
                </Box>
              )}
            </WidgetShell>
          </Paper>

          {/* ── Row 6: Job Run Table ── */}
          <Paper elevation={0} sx={{ borderRadius: 2, overflow: 'hidden', border: '1px solid #e8ecf1', borderTop: '3px solid #1565c0', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <WidgetShell
              title="Job Run Table (esp_job_cmnd ⋈ esp_job_stats_recent)"
              source={`${jobRunTable.length} records · JOIN on jobname = job_longname`}
              titleIcon={<ScheduleIcon sx={{ color: '#1565c0', fontSize: 18 }} />}
            >
              {tableLoading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress size={22} sx={{ color: '#1565c0' }} /></Box>
              ) : (
                <Box sx={{ px: 1.5, pb: 1 }}>
                  <DataTable
                    columns={jobRunTableCols}
                    rows={filteredJobRunTable}
                    rowKey={(r) => `${r.job_longname}-${r.start_date}-${r.start_time}`}
                    compact
                    maxHeight={320}
                    accentColor="#1565c0"
                    emptyMessage="No run records found"
                  />
                </Box>
              )}
            </WidgetShell>
          </Paper>
        </>
      )}
    </Box>
  )
}

