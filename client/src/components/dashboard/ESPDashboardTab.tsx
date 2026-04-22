import React from 'react'
import { Box, Typography, CircularProgress, Paper, Chip, Autocomplete, TextField, Button, Checkbox, Select, MenuItem, FormControl, Tooltip, IconButton, Slider } from '@mui/material'
import WorkIcon from '@mui/icons-material/Work'
import AccountTreeIcon from '@mui/icons-material/AccountTree'
import StorageIcon from '@mui/icons-material/Storage'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'
import TableChartIcon from '@mui/icons-material/TableChart'
import PeopleIcon from '@mui/icons-material/People'
import AppsIcon from '@mui/icons-material/Apps'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'

import {
  WidgetShell, StatCardGrid, MetricBarList, DataTable, TrendLineChart, DonutChart,
} from '../widgets'
import type { ColumnDef } from '../widgets'
import { espService } from '../../services'
import { useMockData } from '../../context/MockDataContext'
import { MOCK_ESP_PLATFORM_SUMMARY, getMockAppData } from '../../services/espMockData'
import { AGENTS } from '../../config/agentConfig'
import { APP_COLORS, TRUIST } from '../../theme/truistPalette'
import { ESPSlaMissedJobsTab } from './ESPSlaMissedJobsTab'

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
  job_list: Array<{ jobname: string; last_run_date: string | null; job_type?: string | null; appl_name?: string; run_status?: string | null }>
  job_run_trend: Array<{ day: string; hour: number; job_count: number; job_fail_count: number }>
  successor_jobs: Array<{ jobname: string; successor_job: string; appl_name?: string | null }>
  predecessor_jobs: Array<{ jobname: string; predecessor_job: string; appl_name?: string | null }>
  metadata: Array<{ jobname: string; command: string | null; argument: string | null }>
  metadata_detail: Array<{ jobname: string; command: string | null; argument: string | null; agent: string | null; job_type: string | null; comp_code: string | null; runs: number | null; user_job: string | null }>
  job_run_table: Array<{ job_longname: string; command: string | null; argument: string | null; runs: number | null; start_date: string | null; start_time: string | null; end_date: string | null; end_time: string | null; exec_qtime: string | null; ccfail: string | null; comp_code: string | null }>
}

const TREND_RUN_COLORS  = ['#1565c0', '#2e7d32', '#6a1b9a', '#00838f']
const TREND_FAIL_COLORS = ['#e53935', '#f57c00', '#d81b60', '#ff6f00']


const BAR_COLORS = ['#1976d2', '#f57c00', '#c62828', '#2e7d32', '#6a1b9a', '#00838f']
const ESP_PLATFORM_RECENT_JOB_LIMIT = 500
const ESP_WIDGET_PANEL_HEIGHT = 260
const isSpecialEspJob = (jobname: string) => /JSDELAY|RETRIG/i.test(jobname)
const normalizeJobTypeLabel = (value?: string | null) => {
  const trimmed = typeof value === 'string' ? value.trim() : ''
  return trimmed || 'Misc'
}
const JOB_STATUS_COLOR: Record<string, { color: string; bg: string; border: string }> = {
  SUCCESS: { color: '#2e7d32', bg: '#e8f5e9', border: '#a5d6a7' },
  FAILED: { color: '#c62828', bg: '#fce4ec', border: '#ef9a9a' },
  'NEVER RUN': { color: '#b45309', bg: '#fffbeb', border: '#fde68a' },
  UNKNOWN: { color: '#546e7a', bg: '#eceff1', border: '#cfd8dc' },
}
const getEspRunStatus = (row: { run_status?: string | null; last_run_date?: string | null }) => {
  const normalized = String(row.run_status ?? '').trim().toUpperCase()
  if (normalized) return normalized
  if (!row.last_run_date) return 'NEVER RUN'
  return 'SUCCESS'
}

// ─── Main Component ───────────────────────────────────────
export const ESPDashboardTab: React.FC<{ onOpenAgent?: (agentId: string) => void }> = ({ onOpenAgent }) => {
  const { useMock } = useMockData()
  const SHOW_SLA_MISSED_JOBS_TAB = false
  const didAutoSelectPlatform = React.useRef(false)
  const [dashboardView, setDashboardView] = React.useState<'operations' | 'sla'>('operations')
  const [selected, setSelected] = React.useState<string>('')
  const [data, setData] = React.useState<AppData | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [trendData, setTrendData] = React.useState<Array<{ day: string; hour: number; job_count: number; job_fail_count: number }>>([])
  const [trendLoading, setTrendLoading] = React.useState(false)
  const [metadataDetail, setMetadataDetail] = React.useState<AppData['metadata_detail']>([])
  const [selectedJobs, setSelectedJobs] = React.useState<string[]>([])
  const [jobStatusFilter, setJobStatusFilter] = React.useState('All')

  // ── Drill-down state ─────────────────────────────────────
  // drillJob: jobname clicked in job list → shows per-job trend
  const [drillJob, setDrillJob] = React.useState<string | null>(null)
  const [drillJobTrend, setDrillJobTrend] = React.useState<Array<{ day: string; hour: number; job_count: number; job_fail_count: number }>>([])
  const [drillJobTrendLoading, setDrillJobTrendLoading] = React.useState(false)
  // widgetFilter: agent/job_type/user_job clicked in widget → filters tables
  const [widgetFilter, setWidgetFilter] = React.useState<{ field: 'agent' | 'job_type' | 'user_job'; value: string } | null>(null)

  // ── Platform state ───────────────────────────────────────
  // platform_id is the `keys` column from edoops.esp_plt_mapping; platform_name is plt_name
  const [platformSummary, setPlatformSummary] = React.useState<{ platform: string; platform_name?: string; total: number; idle: number; special: number }[]>([])
  const [platformLoading, setPlatformLoading] = React.useState(true)
  const [selectedPlatform, setSelectedPlatform] = React.useState<string | null>(null)
  const [platformApplications, setPlatformApplications] = React.useState<string[]>([])
  const [applibTotal, setApplibTotal] = React.useState(0)
  const [applibHasMore, setApplibHasMore] = React.useState(false)
  const [applibLoading, setApplibLoading] = React.useState(false)
  const [applibSearch, setApplibSearch] = React.useState('')
  const applibSearchRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const selectedApplibPlatform = selectedPlatform
  const [jobListLoading, setJobListLoading] = React.useState(false)
  const [jobListLimited, setJobListLimited] = React.useState<{ showing: number; total: number } | null>(null)
  const [jobListHasMore, setJobListHasMore] = React.useState(false)

  const [days, setDays] = React.useState(2)

  // Reset job filter + drill-down when application or platform changes
  React.useEffect(() => { setSelectedJobs([]); setDrillJob(null); setWidgetFilter(null); setJobStatusFilter('All') }, [selected, selectedPlatform])

  // Load platform summary once on mount (and when mock changes).
  // Only auto-select the first platform on initial load so applib picks are not overridden.
  React.useEffect(() => {
    if (useMock) {
      setPlatformSummary(MOCK_ESP_PLATFORM_SUMMARY)
      setPlatformLoading(false)
      if (!didAutoSelectPlatform.current && MOCK_ESP_PLATFORM_SUMMARY.length > 0) {
        didAutoSelectPlatform.current = true
        setSelectedPlatform(MOCK_ESP_PLATFORM_SUMMARY[0].platform)
      }
      return
    }
    setPlatformLoading(true)
    setPlatformSummary([])
    const ctrl = espService.streamPlatformSummary(
      (row) => {
        setPlatformSummary(prev => {
          const isTalend = (p: { platform_name?: string }) =>
            (p.platform_name ?? '').toLowerCase().includes('talend')
          const updated = [...prev, row].sort((a, b) => {
            const at = isTalend(a), bt = isTalend(b)
            if (at && !bt) return -1
            if (!at && bt) return 1
            return (a.platform_name ?? '').localeCompare(b.platform_name ?? '')
          })
          if (!didAutoSelectPlatform.current && !selectedPlatform && updated.length > 0) {
            // Prefer a Talend platform; fall back to first in sorted list
            const talendRow = updated.find(p => (p.platform_name ?? '').toLowerCase().includes('talend'))
            const pick = talendRow ?? updated[0]
            didAutoSelectPlatform.current = true
            setSelectedPlatform(pick.platform)
          }
          return updated
        })
        setPlatformLoading(false)
      },
      () => setPlatformLoading(false),
      () => setPlatformLoading(false),
    )
    return () => ctrl.abort()
  }, [useMock])

  // When platform selected (and no applib), load platform-wide data.
  // Aggregates load first so widgets appear immediately; job list is fetched separately.
  React.useEffect(() => {
    if (!selectedPlatform || selected || useMock) return
    let cancelled = false

    setLoading(true)
    setData(null)
    setJobListLoading(false)
    setJobListLimited(null)
    setJobListHasMore(false)
    espService.getPlatformDetail(selectedPlatform)
      .then((res: any) => {
        if (cancelled) return
        if (!res || res.error) { setData(null); setLoading(false); return }
        setData({
          ...res,
          agents:           Array.isArray(res.agents)           ? res.agents           : [],
          job_types:        Array.isArray(res.job_types)        ? res.job_types        : [],
          completion_codes: Array.isArray(res.completion_codes) ? res.completion_codes : [],
          user_jobs:        Array.isArray(res.user_jobs)        ? res.user_jobs        : [],
          job_list:         [],   // populated by the separate job-list request below
          job_run_trend:    [],
          successor_jobs:   Array.isArray(res.successor_jobs)   ? res.successor_jobs   : [],
          predecessor_jobs: Array.isArray(res.predecessor_jobs) ? res.predecessor_jobs : [],
          metadata:         Array.isArray(res.metadata)         ? res.metadata         : [],
        })
        setLoading(false)
        // Fire job list as a second, non-blocking request
        setJobListLoading(true)
        espService.getPlatformJobList(selectedPlatform)
          .then((jobRes: any) => {
            if (cancelled || !jobRes) return
            setData(prev => prev ? { ...prev, job_list: Array.isArray(jobRes.jobs) ? jobRes.jobs : [] } : prev)
            if (jobRes.limited) setJobListLimited({ showing: jobRes.limit, total: jobRes.total })
            setJobListHasMore(!!jobRes.hasMore)
          })
          .catch(() => {})
          .finally(() => { if (!cancelled) setJobListLoading(false) })
      })
      .catch(() => {
        if (!cancelled) {
          setData(null)
          setLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [selectedPlatform, selected, useMock])

  // Load first 200 application names when platform changes; supports search-as-you-type
  const fetchApplibs = React.useCallback((platform: string, search: string, append = false) => {
    const offset = append ? platformApplications.length : 0
    setApplibLoading(true)
    espService.getPlatformApplications(platform, 200, offset, search)
      .then((res: any) => {
        const items: string[] = Array.isArray(res?.items) ? res.items : []
        setPlatformApplications(prev => append ? [...prev, ...items] : items)
        setApplibTotal(res?.total ?? 0)
        setApplibHasMore(!!res?.hasMore)
      })
      .catch(() => {})
      .finally(() => setApplibLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPlatform, platformApplications.length])

  React.useEffect(() => {
    if (!selectedPlatform || useMock) {
      setPlatformApplications([])
      setApplibTotal(0)
      setApplibHasMore(false)
      setSelected('')
      setApplibSearch('')
      return
    }
    setSelected('')
    setApplibSearch('')
    setPlatformApplications([])
    setApplibTotal(0)
    setApplibHasMore(false)
    fetchApplibs(selectedPlatform, '')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPlatform, useMock])

  // Append the next page of jobs to the existing job list
  const loadMoreJobs = React.useCallback(() => {
    if (!selectedPlatform || jobListLoading || !jobListHasMore) return
    const currentCount = data?.job_list?.length ?? 0
    setJobListLoading(true)
    espService.getPlatformJobList(selectedPlatform, 2000, currentCount, selected || '')
      .then((jobRes: any) => {
        if (!jobRes) return
        const newJobs = Array.isArray(jobRes.jobs) ? jobRes.jobs : []
        setData(prev => prev ? { ...prev, job_list: [...(prev.job_list ?? []), ...newJobs] } : prev)
        const loaded = currentCount + newJobs.length
        setJobListLimited({ showing: loaded, total: jobRes.total })
        setJobListHasMore(!!jobRes.hasMore)
      })
      .catch(() => {})
      .finally(() => setJobListLoading(false))
  }, [selectedPlatform, selected, jobListLoading, jobListHasMore, data?.job_list?.length])

  // Application list is no longer eagerly loaded — applibs are fetched per-platform
  // via getPlatformApplications when a platform is selected, avoiding a heavy
  // full-table scan on mount that froze the UI.

  // Load detail whenever an applib is selected
  React.useEffect(() => {
    if (!selected) return
    let cancelled = false
    setLoading(true)
    setJobListLoading(true)
    setJobListLimited(null)
    setJobListHasMore(false)
    setData(null)
    if (useMock) {
      setData(getMockAppData(selected))
      setLoading(false)
      setJobListLoading(false)
      return
    }
    Promise.all([
      espService.getAppSummary(selected, days),
      selectedPlatform ? espService.getPlatformJobList(selectedPlatform, 2000, 0, selected) : Promise.resolve(null),
    ])
      .then(([res, jobRes]: any) => {
        if (cancelled) return
        if (!res || res.error) { setData(null); return }
        setData({
          ...res,
          agents:           Array.isArray(res.agents)           ? res.agents           : [],
          job_types:        Array.isArray(res.job_types)        ? res.job_types        : [],
          completion_codes: Array.isArray(res.completion_codes) ? res.completion_codes : [],
          user_jobs:        Array.isArray(res.user_jobs)        ? res.user_jobs        : [],
          job_list:         Array.isArray(jobRes?.jobs)         ? jobRes.jobs          : Array.isArray(res.job_list) ? res.job_list : [],
          job_run_trend:    Array.isArray(res.job_run_trend)    ? res.job_run_trend    : [],
          successor_jobs:   Array.isArray(res.successor_jobs)   ? res.successor_jobs   : [],
          predecessor_jobs: Array.isArray(res.predecessor_jobs) ? res.predecessor_jobs : [],
          metadata:         Array.isArray(res.metadata)         ? res.metadata         : [],
        })
        if (jobRes?.limited) setJobListLimited({ showing: jobRes.offset + (Array.isArray(jobRes.jobs) ? jobRes.jobs.length : 0), total: jobRes.total })
        setJobListHasMore(!!jobRes?.hasMore)
      })
      .catch(() => {
        if (!cancelled) setData(null)
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false)
          setJobListLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [selected, selectedPlatform, useMock, days])

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
      ? espService.getPlatformRunTrend(selectedPlatform, days)
      : espService.getJobRunTrend(selected, days)
    req
      .then((res: any) => setTrendData(Array.isArray(res) ? res : []))
      .catch(() => setTrendData([]))
      .finally(() => setTrendLoading(false))
  }, [selected, selectedPlatform, useMock, days])

  // Load per-job trend when drillJob or trendDays changes
  React.useEffect(() => {
    if (!drillJob) { setDrillJobTrend([]); return }
    setDrillJobTrendLoading(true)
    espService.getJobRunTrendByJob(drillJob, days)
      .then((res: any) => setDrillJobTrend(Array.isArray(res) ? res : []))
      .catch(() => setDrillJobTrend([]))
      .finally(() => setDrillJobTrendLoading(false))
  }, [drillJob, days])

  // Keep metadata detail for widget-filter mapping (agent/job_type/user_job), even though detail table is hidden.
  React.useEffect(() => {
    if (!selected) {
      setMetadataDetail([])
      return
    }
    if (useMock) {
      const mockApp = getMockAppData(selected)
      setMetadataDetail(mockApp?.metadata_detail ?? [])
      return
    }
    espService.getMetadata(selected)
      .then((meta: any) => setMetadataDetail(Array.isArray(meta) ? meta : []))
      .catch(() => setMetadataDetail([]))
  }, [selected, useMock])

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
            : widgetFilter.field === 'job_type' ? normalizeJobTypeLabel(r.job_type)
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
    .filter(r => !widgetFilteredJobnames || widgetFilteredJobnames.has(r.jobname))
    .filter(r => jobStatusFilter === 'All' || getEspRunStatus(r) === jobStatusFilter)
    .sort((left, right) => {
      if (!left.last_run_date && !right.last_run_date) return left.jobname.localeCompare(right.jobname)
      if (!left.last_run_date) return 1
      if (!right.last_run_date) return -1
      const tsDiff = new Date(right.last_run_date).getTime() - new Date(left.last_run_date).getTime()
      return tsDiff !== 0 ? tsDiff : left.jobname.localeCompare(right.jobname)
    }),        [data, selectedJobs, widgetFilteredJobnames, jobStatusFilter])
  const filteredMeta        = React.useMemo(() => (data?.metadata ?? [])
    .filter(r => !selectedJobs.length || selectedJobs.includes(r.jobname))
    .filter(r => !widgetFilteredJobnames || widgetFilteredJobnames.has(r.jobname)),        [data, selectedJobs, widgetFilteredJobnames])
  const filteredPred        = React.useMemo(() => (data?.predecessor_jobs ?? [])
    .filter(r => !selectedJobs.length || selectedJobs.includes(r.jobname))
    .filter(r => !widgetFilteredJobnames || widgetFilteredJobnames.has(r.jobname)),        [data, selectedJobs, widgetFilteredJobnames])
  const filteredSucc        = React.useMemo(() => (data?.successor_jobs ?? [])
    .filter(r => !selectedJobs.length || selectedJobs.includes(r.jobname))
    .filter(r => !widgetFilteredJobnames || widgetFilteredJobnames.has(r.jobname)),        [data, selectedJobs, widgetFilteredJobnames])

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
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, minWidth: 0 }}>
            <Tooltip title={r.jobname} placement="top" arrow>
              <Typography
                component="span"
                sx={{
                  fontSize: '11px',
                  fontWeight: drillJob === r.jobname ? 700 : 400,
                  color: isSpecialEspJob(r.jobname) ? '#2e7d32' : drillJob === r.jobname ? '#1565c0' : 'inherit',
                  minWidth: 0,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {r.jobname}
              </Typography>
            </Tooltip>
            {isSpecialEspJob(r.jobname) && (
              <Chip
                label="Special"
                size="small"
                sx={{
                  height: 18,
                  fontSize: '10px',
                  fontWeight: 700,
                  bgcolor: '#e8f5e9',
                  color: '#2e7d32',
                  border: '1px solid #a5d6a7',
                }}
              />
            )}
          </Box>
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
      {
        key: 'run_status',
        header: 'Status',
        width: 110,
        render: r => {
          const status = getEspRunStatus(r)
          const cfg = JOB_STATUS_COLOR[status] ?? JOB_STATUS_COLOR.UNKNOWN
          return (
            <Chip
              label={status}
              size="small"
              sx={{
                height: 18,
                fontSize: '10px',
                fontWeight: 700,
                color: cfg.color,
                bgcolor: cfg.bg,
                border: `1px solid ${cfg.border}`,
              }}
            />
          )
        },
      },
      {
        key: 'job_type',
        header: 'Job Type',
        width: 90,
        noWrap: true,
        render: r => r.job_type ?? '—',
      },
    ]
    return selectedPlatform ? [...baseCols, applCol] : baseCols
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPlatform, drillJob])

  const depCols: ColumnDef[] = [
    { key: 'jobname', header: 'Job Name', flex: 1, noWrap: true },
    { key: 'appl_name', header: 'Applib Name', width: 140, noWrap: true,
      render: (r: any) => r.appl_name ?? data?.appl_name ?? '—' },
    { key: 'col2',    header: 'Link',     width: 120, noWrap: true,
      render: (r: any) => r.successor_job ?? r.predecessor_job ?? '—' },
  ]

  React.useEffect(() => {
    if (!SHOW_SLA_MISSED_JOBS_TAB && dashboardView === 'sla') {
      setDashboardView('operations')
    }
  }, [SHOW_SLA_MISSED_JOBS_TAB, dashboardView])

  return (
    <Box sx={{ bgcolor: '#f5f6f8', minHeight: '100%', p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>

      {/* ── App selector bar ── */}
      <Paper
        elevation={0}
        sx={{ borderRadius: 2, border: '1px solid #e8ecf1', bgcolor: '#f8f9fb', overflow: 'hidden', position: 'sticky', top: 0, zIndex: 10, boxShadow: '0 2px 8px rgba(0,0,0,0.07)' }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', backgroundColor: '#1a2535', px: 2, flexShrink: 0 }}>
          {[
            { key: 'operations' as const, label: 'ESP', accent: '#1976d2', visible: true },
            { key: 'sla' as const, label: 'SLA Missed Jobs', accent: '#c62828', visible: SHOW_SLA_MISSED_JOBS_TAB },
          ].filter(tab => tab.visible).map(tab => {
            const isActive = dashboardView === tab.key
            return (
              <Box
                key={tab.key}
                onClick={() => setDashboardView(tab.key)}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.75,
                  px: 2.5,
                  py: 1.2,
                  cursor: 'pointer',
                  borderBottom: isActive ? `3px solid ${tab.accent}` : '3px solid transparent',
                  color: isActive ? '#fff' : '#78909c',
                  transition: 'all 0.15s',
                  '&:hover': { color: '#fff', backgroundColor: 'rgba(255,255,255,0.05)' },
                }}
              >
                <Typography sx={{ fontSize: '12px', fontWeight: isActive ? 700 : 400 }}>
                  {tab.label}
                </Typography>
              </Box>
            )
          })}
        </Box>

        {/* ── Row 1: Title ── */}
        <Box sx={{ px: 2, py: 1, display: 'flex', alignItems: 'center', gap: 1.5, borderBottom: '1px solid #e8ecf1' }}>
          <AppsIcon sx={{ fontSize: 15, color: '#2e7d32' }} />
          <Typography sx={{ fontWeight: 700, fontSize: '11px', color: '#555', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
            ESP — Enterprise Scheduler Platform
          </Typography>
          {useMock && (
            <Chip label="MOCK DATA" size="small" sx={{ fontSize: '9px', height: 18, bgcolor: '#fff3e0', color: '#f57c00', fontWeight: 700, border: '1px solid #f57c0040' }} />
          )}
          <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center', gap: 1.5 }}>
            {/* ── Date range slider ── */}
            {dashboardView === 'operations' && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 200 }}>
                <Typography sx={{ fontSize: '11px', color: '#777', whiteSpace: 'nowrap' }}>Last {days}d</Typography>
                <Slider
                  value={days}
                  min={1}
                  max={5}
                  step={1}
                  onChange={(_e, v) => setDays(v as number)}
                  size="small"
                  sx={{
                    color: '#2e7d32',
                    width: 120,
                    '& .MuiSlider-thumb': { width: 12, height: 12 },
                    '& .MuiSlider-rail': { opacity: 0.3 },
                  }}
                />
                <Typography sx={{ fontSize: '10px', color: '#bbb', whiteSpace: 'nowrap' }}>5d</Typography>
              </Box>
            )}
            {onOpenAgent && (
              <Button
                size="small"
                variant="contained"
                startIcon={<Box component="img" src={AGENTS.esp.icon} alt="ESP agent icon" sx={{ width: 14, height: 14, borderRadius: '50%', objectFit: 'contain', display: 'block' }} />}
                onClick={() => onOpenAgent('esp')}
                sx={{
                  backgroundColor: APP_COLORS.primary,
                  textTransform: 'none',
                  fontSize: '11px',
                  fontWeight: 700,
                  height: 26,
                  px: 1.5,
                  color: TRUIST.white,
                  '&:hover': { backgroundColor: TRUIST.dusk },
                }}
              >
                Ask ESP Agent
              </Button>
            )}
          </Box>
        </Box>

        {/* ── Row 2: Filters ── */}
        <Box sx={{ px: 2, py: 1, display: 'flex', alignItems: 'flex-start', gap: 1.5, flexWrap: 'wrap' }}>

          {/* Platform */}
          {dashboardView === 'operations' && (
            <>
              <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, alignItems: { xs: 'stretch', sm: 'center' }, gap: 0.75, flex: '1 1 180px', minWidth: { xs: '100%', sm: 180 } }}>
                <Typography sx={{ fontSize: '11px', color: '#555', fontWeight: 600, whiteSpace: 'nowrap' }}>Platform:</Typography>
                <FormControl size="small" sx={{ width: '100%', minWidth: 0 }}>
                  <Select
                    value={selectedPlatform ?? selectedApplibPlatform ?? ''}
                    onChange={(e) => {
                      const val = (e.target.value as string) || null
                      if (!val) return
                      setSelected('')
                      setApplibSearch('')
                      setPlatformApplications([])
                      setApplibTotal(0)
                      setApplibHasMore(false)
                      setSelectedPlatform(val)
                    }}
                    displayEmpty
                    disabled={platformLoading}
                    renderValue={(val) => {
                      if (platformLoading) {
                        return (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <CircularProgress size={11} sx={{ color: '#2e7d32' }} />
                            <em style={{ color: '#888', fontSize: '12px' }}>Loading…</em>
                          </Box>
                        )
                      }
                      return val ? String(val) : <em style={{ color: '#888' }}>All</em>
                    }}
                    sx={{
                      fontSize: '12px', fontWeight: 600, width: '100%', minWidth: 0, bgcolor: '#fff',
                      '& .MuiOutlinedInput-notchedOutline': { borderColor: '#2e7d3240' },
                      '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#2e7d32' },
                      '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#2e7d32' },
                    }}
                  >
                    {platformSummary.filter(p => p.platform).map(p => (
                      <MenuItem key={p.platform} value={p.platform} sx={{ fontSize: '12px', p: 0 }}>
                        <Tooltip title={p.platform_name ?? p.platform} placement="right" arrow>
                          <Box sx={{ width: '100%', px: 2, py: 0.75, display: 'flex', alignItems: 'center' }}>
                            {p.platform_name ?? p.platform}
                          </Box>
                        </Tooltip>
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Box>

              <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, alignItems: { xs: 'stretch', sm: 'center' }, gap: 0.75, flex: '1 1 260px', minWidth: { xs: '100%', md: 260 } }}>
                <Typography sx={{ fontSize: '11px', color: '#666', fontWeight: 500, whiteSpace: 'nowrap' }}>Applib:</Typography>
                {!selectedPlatform ? (
                  <TextField
                    disabled
                    size="small"
                    placeholder="Select a platform first"
                    sx={{
                      width: '100%', minWidth: 0,
                      '& .MuiOutlinedInput-root': {
                        fontSize: '12px', borderRadius: 1, bgcolor: '#f5f5f5',
                      },
                    }}
                  />
                ) : (
                  <Autocomplete
                    options={applibHasMore ? [...platformApplications, '__LOAD_MORE__'] : platformApplications}
                    value={selected || null}
                    inputValue={applibSearch}
                    onInputChange={(_, val, reason) => {
                      if (reason === 'reset') return
                      setApplibSearch(val)
                      if (!selectedPlatform) return
                      if (applibSearchRef.current) clearTimeout(applibSearchRef.current)
                      applibSearchRef.current = setTimeout(() => {
                        fetchApplibs(selectedPlatform, val)
                      }, 300)
                    }}
                    onChange={(_, val) => {
                      if (val === '__LOAD_MORE__' || !val) { setSelected(''); return }
                      setSelected(val)
                      setApplibSearch(val)
                    }}
                    filterOptions={(opts) => opts}
                    loading={applibLoading}
                    size="small"
                    sx={{ width: '100%', minWidth: 0 }}
                    componentsProps={{ paper: { sx: { fontSize: '12px' } } }}
                    getOptionLabel={(opt) => opt === '__LOAD_MORE__' ? '' : opt}
                    isOptionEqualToValue={(opt, val) => opt === val}
                    renderOption={(props, option) => {
                      if (option === '__LOAD_MORE__') {
                        const { key, ...rest } = props as any
                        return (
                          <li key="__LOAD_MORE__" {...rest}
                            onClick={(e) => { e.stopPropagation(); if (selectedPlatform) fetchApplibs(selectedPlatform, applibSearch, true) }}
                            style={{ justifyContent: 'center', borderTop: '1px solid #e8ecf1', padding: '6px' }}
                          >
                            <Typography sx={{ fontSize: '11px', color: '#1976d2', fontWeight: 700, cursor: 'pointer' }}>
                              {applibLoading ? 'Loading…' : `Load more (${(applibTotal - platformApplications.length).toLocaleString()} remaining)`}
                            </Typography>
                          </li>
                        )
                      }
                      const { key, ...rest } = props as any
                      return <li key={option} {...rest} style={{ fontSize: '12px', padding: '4px 12px' }}>{option}</li>
                    }}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        placeholder={applibTotal > 0 ? `${applibTotal.toLocaleString()} applib(s)` : `${platformApplications.length} applib(s)`}
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
            </>
          )}

          {/* Future SLA filters retained for later enablement.
          {dashboardView === 'sla' && selectedPlatform && selected && (
            <Box>Platform / Applib filter controls will be re-enabled here later.</Box>
          )}
          */}

          {/* Job selector */}
          {dashboardView === 'operations' && (
            <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, alignItems: { xs: 'stretch', sm: 'center' }, gap: 0.75, flex: '1 1 320px', minWidth: { xs: '100%', lg: 320 } }}>
              <Typography sx={{ fontSize: '11px', color: '#666', fontWeight: 500, whiteSpace: 'nowrap' }}>Job:</Typography>
              <Autocomplete
                multiple
                options={['__SELECT_ALL__', ...jobOptions]}
                value={selectedJobs}
                disableCloseOnSelect
                clearOnEscape
                disabled={loading || !data}
                size="small"
                sx={{ width: '100%', minWidth: 0, maxWidth: { xs: '100%', lg: 340 } }}
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
          )}

          {/* Clear Filters */}
          {((dashboardView === 'operations' && selectedJobs.length > 0) || selected || (selectedPlatform && platformSummary.length > 0 && selectedPlatform !== platformSummary[0].platform)) && (
            <Button
              size="small"
              onClick={() => {
                const first = platformSummary[0]?.platform ?? null
                if (dashboardView === 'operations') setSelectedJobs([])
                setSelected('')
                setSelectedPlatform(first)
              }}
              sx={{ fontSize: '10px', color: '#d32f2f', textTransform: 'none', height: 26, whiteSpace: 'nowrap', px: 1.25, border: '1px solid #ef9a9a', borderRadius: 1, ml: { xs: 0, lg: 'auto' }, '&:hover': { bgcolor: '#fce4ec' } }}
            >
              Clear Filters
            </Button>
          )}
        </Box>
      </Paper>

      {/* ── Loading ── */}
      {dashboardView === 'operations' && loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress sx={{ color: '#2e7d32' }} />
        </Box>
      )}

      {/* ── No data ── */}
      {dashboardView === 'operations' && !loading && !data && selected && (
        <Paper elevation={0} sx={{ borderRadius: 2, p: 4, textAlign: 'center', border: '1px solid #e8ecf1' }}>
          <Typography sx={{ fontSize: '13px', color: '#aaa' }}>
            No data available for <strong>{selected}</strong>
          </Typography>
        </Paper>
      )}

      {/* ── Dashboard ── */}
      {dashboardView === 'sla' && (
        <ESPSlaMissedJobsTab
          selectedPlatform={null}
          selectedApplib=""
          useMock={useMock}
        />
      )}

      {dashboardView === 'operations' && !loading && data && (
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
                    // { label: 'User Jobs',      value: data.user_jobs.length, color: '#00838f', bg: '#e0f7fa' },
                  ]}
                  columns={5}
                />
              </Box>
            </WidgetShell>
          </Paper>



          {/* ── Row 2: Job Execution Status (single row) ── */}
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr', gap: 2 }}>

            <Paper elevation={0} sx={{ borderRadius: 2, overflow: 'hidden', border: '1px solid #e8ecf1', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
              <WidgetShell
                title="Job Execution Status"
                source={jobListLoading
                  ? 'Loading jobs…'
                  : jobListLimited
                    ? `Showing ${jobListLimited.showing.toLocaleString()} of ${jobListLimited.total.toLocaleString()} jobs`
                    : selectedPlatform
                      ? `${filteredJobList.length}${filteredJobList.length >= ESP_PLATFORM_RECENT_JOB_LIMIT ? '+' : ''} recent jobs ·`
                      : `${filteredJobList.length}${filteredJobList.length !== data.job_list.length ? ` / ${data.job_list.length}` : ''} jobs`}
                titleIcon={<WorkIcon sx={{ color: '#1976d2', fontSize: 18 }} />}
              >
                <Box sx={{ px: 1.5, pt: 1, pb: 0, display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
                  {['All', 'SUCCESS', 'FAILED', 'NEVER RUN'].map((status) => {
                    const cfg = JOB_STATUS_COLOR[status] ?? JOB_STATUS_COLOR.UNKNOWN
                    const active = jobStatusFilter === status
                    return (
                      <Chip
                        key={status}
                        label={status}
                        size="small"
                        onClick={() => setJobStatusFilter(status)}
                        sx={{
                          fontSize: '10px',
                          height: 22,
                          cursor: 'pointer',
                          fontWeight: active ? 700 : 400,
                          backgroundColor: active ? cfg.bg : '#f5f5f5',
                          color: active ? cfg.color : '#aaa',
                          border: active ? `1px solid ${cfg.color}40` : '1px solid transparent',
                          '& .MuiChip-label': { px: 1 },
                        }}
                      />
                    )
                  })}
                  <Typography sx={{ fontSize: '10px', color: '#aaa', ml: 'auto' }}>{filteredJobList.length} jobs</Typography>
                </Box>
                <Box sx={{ flex: 1, overflowY: 'auto', px: 1.5, pb: 1 }}>
                  <DataTable
                    columns={jobListCols}
                    rows={filteredJobList}
                    rowKey="jobname"
                    compact
                    maxHeight={280}
                    pageSize={200}
                    accentColor="#2e7d32"
                    emptyMessage={jobListLoading ? 'Loading jobs…' : 'No jobs found'}
                  />
                  {jobListHasMore && (
                    <Box sx={{ display: 'flex', justifyContent: 'center', pt: 1 }}>
                      <Button
                        size="small"
                        variant="outlined"
                        disabled={jobListLoading}
                        onClick={loadMoreJobs}
                        sx={{
                          fontSize: '11px', textTransform: 'none', borderColor: '#2e7d3240',
                          color: '#2e7d32', '&:hover': { borderColor: '#2e7d32', bgcolor: '#e8f5e9' },
                        }}
                      >
                        {jobListLoading
                          ? 'Loading…'
                          : `Load more (${((jobListLimited?.total ?? 0) - (data?.job_list?.length ?? 0)).toLocaleString()} remaining)`}
                      </Button>
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

          {/* ── Row 3: Job Run Trend | Agent | Job Type ── */}
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' }, gap: 2 }}>

            <Paper elevation={0} sx={{ borderRadius: 2, overflow: 'hidden', border: '1px solid #e8ecf1', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', display: 'flex', height: ESP_WIDGET_PANEL_HEIGHT, '& > *': { flex: 1, width: '100%' } }}>
              <WidgetShell
                title={drillJob
                  ? `Job Trend — ${drillJob}`
                  : `Job Run Trend — ${days} Day${days !== 1 ? 's' : ''}`}
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
                    <Chip
                      label={`${days} Day${days !== 1 ? 's' : ''}`}
                      size="small"
                      sx={{
                        fontSize: '10px', height: 20,
                        bgcolor: '#1565c0',
                        color: '#fff',
                        fontWeight: 700,
                        cursor: 'default',
                      }}
                    />
                  </Box>
                }
              >
                <Box sx={{ px: 1.5, pb: 1.5, pt: 0.5, flex: 1, width: '100%', minHeight: 0 }}>
                  {drillJob ? (
                    drillJobTrendLoading ? (
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 190 }}>
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
                        height={190}
                        margin={{ top: 8, right: 16, left: -10, bottom: 4 }}
                      />
                    ) : (
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 190 }}>
                        <Typography sx={{ fontSize: '12px', color: '#bbb' }}>No run history for <strong>{drillJob}</strong></Typography>
                      </Box>
                    )
                  ) : trendLoading ? (
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 190 }}>
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
                      height={190}
                      margin={{ top: 8, right: 16, left: -10, bottom: 4 }}
                    />
                  ) : (
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 190 }}>
                      <Typography sx={{ fontSize: '12px', color: '#bbb' }}>No trend data available</Typography>
                    </Box>
                  )}
                </Box>
              </WidgetShell>
            </Paper>

            {/* Agent — clickable bar list */}
            <Paper elevation={0} sx={{ borderRadius: 2, overflow: 'hidden', border: '1px solid #1976d222', borderTop: '3px solid #1976d2', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', display: 'flex', height: ESP_WIDGET_PANEL_HEIGHT, '& > *': { flex: 1, width: '100%' } }}>
              <WidgetShell title="ESP job run Agent" source={`${data.agents.length} entries·`} titleIcon={<PeopleIcon sx={{ color: '#1976d2', fontSize: 18 }} />}>
                <Box sx={{ px: 1.5, pb: 1.5, pt: 0.5, flex: 1, width: '100%', overflowY: 'auto' }}>
                  {data.agents.length === 0 ? (
                    <Box sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Typography sx={{ fontSize: '11px', color: '#bbb', textAlign: 'center' }}>No data</Typography>
                    </Box>
                  ) : (
                    <Box sx={{ width: '100%' }}>
                      <MetricBarList
                        items={data.agents.map((a, idx) => ({
                          label: a.name,
                          value: a.count,
                          max: Math.max(...data.agents.map(x => x.count), 1),
                          color: widgetFilter?.field === 'agent' && widgetFilter.value === a.name ? '#1565c0' : BAR_COLORS[idx % BAR_COLORS.length],
                          /* onClick: () => setWidgetFilter(prev =>
                            prev?.field === 'agent' && prev.value === a.name ? null : { field: 'agent', value: a.name }
                          ), */
                        }))}
                        barHeight={8}
                        compact
                      />
                    </Box>
                  )}
                </Box>
              </WidgetShell>
            </Paper>

            {/* Job Type — donut */}
            <Paper elevation={0} sx={{ borderRadius: 2, overflow: 'hidden', border: '1px solid #6a1b9a22', borderTop: '3px solid #6a1b9a', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', display: 'flex', height: ESP_WIDGET_PANEL_HEIGHT, '& > *': { flex: 1, width: '100%' } }}>
              <WidgetShell title="Job Type" source={`${data.job_types.length} types · click to filter`} titleIcon={<StorageIcon sx={{ color: '#6a1b9a', fontSize: 18 }} />}>
                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 1, flex: 1, width: '100%', height: '100%' }}>
                  {data.job_types.length === 0 ? (
                    <Typography sx={{ fontSize: '11px', color: '#bbb' }}>No data</Typography>
                  ) : (
                    <DonutChart
                      data={data.job_types.map((t, i) => ({
                        name: normalizeJobTypeLabel(t.name),
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

            {/* Completion Code and User Job widgets are intentionally hidden for now.
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
            */}
          </Box>

          {/* ── Row 4: Predecessor Jobs | Successor Jobs ── */}
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>

            <Paper elevation={0} sx={{ borderRadius: 2, overflow: 'hidden', border: '1px solid #e8ecf1', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
              <WidgetShell
                title="Predecessor Jobs"
                source={`${data.predecessor_jobs.length}`}
                titleIcon={<AccountTreeIcon sx={{ color: '#1565c0', fontSize: 18 }} />}
              >
                <Box sx={{ flex: 1, overflowY: 'auto', px: 1.5, pb: 1 }}>
                  <DataTable
                    columns={[depCols[0], depCols[1], { ...depCols[2], header: 'Predecessor' }]}
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
                    columns={[depCols[0], depCols[1], { ...depCols[2], header: 'Successor' }]}
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
          </Box>

          {/* ── Row 5: Job Commands ── */}
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
        </>
      )}
    </Box>
  )
}

