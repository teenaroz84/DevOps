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
  WidgetShell, MetricBarList, DataTable, TrendLineChart, DonutChart,
} from '../widgets'
import type { ColumnDef } from '../widgets'
import { espService } from '../../services'
import { useMockData } from '../../context/MockDataContext'
import { MOCK_ESP_PLATFORM_SUMMARY, getMockAppData, getMockPlatformData, getMockPlatformApplications } from '../../services/espMockData'
import { ESPSlaMissedJobsTab } from './ESPSlaMissedJobsTab'
import ESPExecutiveOverview, { 
  type EspOverviewCard, 
  type EspOverviewIntervalOption,
  type EspJobRunTrendPoint,
  type EspJobRunAgent,
  type EspJobType,
  type EspOverviewGroupedWidgets,
} from './ESPExecutiveOverview'

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

interface EspKpiResponse {
  platform: string | null
  applName: string | null
  interval: number | 'all'
  cards: EspOverviewCard[]
  kpis?: EspOverviewCard[]
}

interface EspGroupedWidgetsResponse {
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

type EspGroupedSectionKey = 'jobExecution' | 'slaStatus' | 'jobDependencies' | 'executionForecast' | 'jobConfigHealth'

type EspGroupedSectionLoading = Record<EspGroupedSectionKey, boolean>
type EspGroupedSectionErrors = Record<EspGroupedSectionKey, string | null>

const INITIAL_GROUPED_SECTION_LOADING: EspGroupedSectionLoading = {
  jobExecution: false,
  slaStatus: false,
  jobDependencies: false,
  executionForecast: false,
  jobConfigHealth: false,
}

const INITIAL_GROUPED_SECTION_ERRORS: EspGroupedSectionErrors = {
  jobExecution: null,
  slaStatus: null,
  jobDependencies: null,
  executionForecast: null,
  jobConfigHealth: null,
}

const TREND_RUN_COLORS  = ['#1565c0', '#2e7d32', '#6a1b9a', '#00838f']
const TREND_FAIL_COLORS = ['#e53935', '#f57c00', '#d81b60', '#ff6f00']


const BAR_COLORS = ['#1976d2', '#f57c00', '#c62828', '#2e7d32', '#6a1b9a', '#00838f']
const ESP_DAY_PRESETS = [30, 60, 90]
const ESP_PLATFORM_RECENT_JOB_LIMIT = 500
const ESP_WIDGET_PANEL_HEIGHT = 260
const isSpecialEspJob = (jobname: string) => /JSDELAY|RETRIG/i.test(jobname)
const RUN_STATUS_ORDER = ['SUCCESS', 'FAILED', 'NEVER RUN', 'UNKNOWN'] as const
const normalizeRunStatusLabel = (value?: string | null) => {
  const trimmed = typeof value === 'string' ? value.trim() : ''
  return trimmed || 'UNKNOWN'
}
const formatTrendDayLabel = (day: string) => {
  const normalized = day.length >= 10 ? day.slice(0, 10) : day
  const match = normalized.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return normalized
  const [, , month, date] = match
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${monthNames[Number(month) - 1]} ${Number(date)}`
}
const normalizeJobTypeLabel = (value?: string | null) => {
  const trimmed = typeof value === 'string' ? value.trim() : ''
  return trimmed || 'Misc'
}


// ─── Main Component ───────────────────────────────────────
export const ESPDashboardTab: React.FC<{ onOpenAgent?: (agentId: string) => void }> = () => {
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
  const [statusFilter, setStatusFilter] = React.useState<string>('All')


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

  const [days, setDays] = React.useState(30)
  const [overviewInterval, setOverviewInterval] = React.useState<EspOverviewIntervalOption>(30)
  const [overviewCards, setOverviewCards] = React.useState<EspOverviewCard[]>([])
  const [overviewKpis, setOverviewKpis] = React.useState<EspOverviewCard[]>([])
  const [overviewWidgets, setOverviewWidgets] = React.useState<{
    jobRunTrend?: EspJobRunTrendPoint[]
    jobRunAgents?: EspJobRunAgent[]
    jobTypeDistribution?: EspJobType[]
  }>({})
  const [overviewScopeLabel, setOverviewScopeLabel] = React.useState('All platforms')
  const [overviewLoading, setOverviewLoading] = React.useState(false)
  const [overviewError, setOverviewError] = React.useState<string | null>(null)
  const [widgetsLoading, setWidgetsLoading] = React.useState(false)
  const [widgetsError, setWidgetsError] = React.useState<string | null>(null)
  const [groupedWidgets, setGroupedWidgets] = React.useState<EspOverviewGroupedWidgets>({})
  const [slaSectionLoading, setSlaSectionLoading] = React.useState<EspGroupedSectionLoading>(INITIAL_GROUPED_SECTION_LOADING)
  const [slaSectionErrors, setSlaSectionErrors] = React.useState<EspGroupedSectionErrors>(INITIAL_GROUPED_SECTION_ERRORS)
  const slaLoading = React.useMemo(
    () => Object.values(slaSectionLoading).some(Boolean),
    [slaSectionLoading],
  )
  const slaError = React.useMemo(
    () => Object.values(slaSectionErrors).find((value) => Boolean(value)) ?? null,
    [slaSectionErrors],
  )

  // Reset job filter + drill-down when application or platform changes
  React.useEffect(() => { setSelectedJobs([]); setDrillJob(null); setWidgetFilter(null); setStatusFilter('All') }, [selected, selectedPlatform])

  const buildMockOverviewData = React.useCallback(() => {
    const selectedSummary = selectedPlatform
      ? platformSummary.find((platform) => platform.platform === selectedPlatform) ?? null
      : null
    const totalJobs = selected
      ? data?.job_count ?? 0
      : selectedSummary
        ? selectedSummary.total
        : platformSummary.reduce((sum, row) => sum + row.total, 0)
    const idleJobs = selected
      ? data?.idle_job_count ?? 0
      : selectedSummary
        ? selectedSummary.idle
        : platformSummary.reduce((sum, row) => sum + row.idle, 0)
    const failedJobs = (data?.job_list ?? []).filter((job) => normalizeRunStatusLabel(job.run_status) === 'FAILED').length

    const makeSparkline = (seed: number) => Array.from({ length: 8 }, (_, index) => ({
      day: `P${index + 1}`,
      value: Math.max(0, Math.round(seed * (0.88 + ((index % 4) * 0.05) - (index % 3 === 0 ? 0.03 : 0)))),
    }))

    const cards = [
      {
        key: 'totalJobs',
        title: 'Total Jobs',
        description: '',
        value: totalJobs,
        accent: '#2563eb',
        background: '#f7fbff',
        trend: makeSparkline(totalJobs || 1),
      },
      {
        key: 'idleJobs',
        title: 'Idle Jobs',
        description: '',
        value: idleJobs,
        accent: '#d97706',
        background: '#fff8f1',
        trend: makeSparkline(idleJobs || 1),
      },
      {
        key: 'failedJobs',
        title: 'Failed Jobs',
        description: '',
        value: failedJobs,
        accent: '#dc2626',
        background: '#fff7f7',
        trend: makeSparkline(failedJobs || 1),
      },
    ]

    const kpis = [
      {
        key: 'slaBreaches',
        title: 'SLA Breaches',
        description: '',
        value: Math.floor(Math.random() * 10),
        accent: '#d97706',
        background: '#fffbf0',
        trend: makeSparkline(3),
      },
      {
        key: 'activeAgents',
        title: 'Active Agents',
        description: '',
        value: Math.floor(Math.random() * 20) + 5,
        accent: '#059669',
        background: '#f0fdf4',
        trend: makeSparkline(12),
      },
    ]

    const jobRunTrend = Array.from({ length: 7 }, (_, i) => ({
      day: `Day ${i + 1}`,
      runs: Math.floor(Math.random() * 100) + 50,
      avgRun: Math.floor(Math.random() * 45) + 15,
      fails: Math.floor(Math.random() * 20),
    }))

    const jobRunAgents = [
      { agent: 'AGENT-01', runCount: Math.floor(Math.random() * 100) + 50 },
      { agent: 'AGENT-02', runCount: Math.floor(Math.random() * 100) + 40 },
      { agent: 'AGENT-03', runCount: Math.floor(Math.random() * 100) + 30 },
      { agent: 'AGENT-04', runCount: Math.floor(Math.random() * 100) + 20 },
      { agent: 'AGENT-05', runCount: Math.floor(Math.random() * 100) + 10 },
    ]

    const jobTypeDistribution = [
      { jobType: 'UNIX', jobCount: 45, pct: 45.5 },
      { jobType: 'FILE_TRIGGER', jobCount: 30, pct: 30.3 },
      { jobType: 'MAINFRAME', jobCount: 15, pct: 15.2 },
      { jobType: 'NT', jobCount: 9, pct: 9.0 },
    ]

    const groupedWidgets = {
      job_execution_status: [
        { appl_name: 'SFDPD2', jobname: 'SFDPDWSH1UE-CALLOT-PROD', last_run: '2026-05-28T20:00:00', avg_run_mins: 12, status: 'SUCCESS', job_type: 'UNIX' },
        { appl_name: 'SFDPCVCLY', jobname: 'SFDPCVCLYSPFDEVCCNWRQ_PROD', last_run: '2026-05-28T20:00:00', avg_run_mins: 8, status: 'SUCCESS', job_type: 'UNIX' },
        { appl_name: 'SFDPEGVCJ', jobname: 'SFDPEGVCJSPFDEVQCPCQST_PROD', last_run: '2026-05-28T20:00:00', avg_run_mins: 5, status: 'SUCCESS', job_type: 'UNIX' },
      ],
      sla_status_bars: [
        { platform: 'TALED', total: 120, met_count: 94, pct_met: 78.3 },
        { platform: 'UNIX', total: 132, met_count: 121, pct_met: 91.7 },
        { platform: 'NT', total: 88, met_count: 79, pct_met: 89.8 },
      ],
      sla_recent_events: [
        { job_name: 'SFDPACCTD2M_PROD', applib: 'SFDPD2', sla_time: '08:00 PM', end_time: '08:34 PM', time_diff: '+34m', status: 'MISSED' },
        { job_name: 'SFDPACCTURBAL_PROD', applib: 'SFDPD2', sla_time: '10:00 PM', end_time: '10:12 PM', time_diff: '+12m', status: 'AT RISK' },
        { job_name: 'SFDFGSACCODEC_PROD', applib: 'SFDPEGEM', sla_time: '11:00 PM', end_time: '10:48 PM', time_diff: '-12m', status: 'MET' },
      ],
      job_dependencies: [
        { appl_name: 'CCDSFD201FT', jobname: 'CCDSFD2012FT', release: 'PROC', external_ind: 'INT', predecessor_job: 'CCDSFD0202FT', predecessor_applib: 'SFDPD2' },
        { appl_name: 'SFDPACCT2REP_PROD', jobname: 'SFDPACCT2REP_PROD', release: 'PROC', external_ind: 'EXT', predecessor_job: 'SFDPACCTOURBAL_PROD', predecessor_applib: 'SFDPD2' },
      ],
      execution_forecast_metrics: {
        avg_exec_mins: 18.4,
        avg_cpu_mins: 6.2,
        total_samples: 145,
        total_print_lines: 2100,
      },
      forecast_exec_by_applib: [
        { appl_name: 'SFDPD2', avg_exec_mins: 22.1, avg_cpu_mins: 7.1, job_count: 64 },
        { appl_name: 'SFDPEGEM', avg_exec_mins: 17.8, avg_cpu_mins: 5.2, job_count: 48 },
        { appl_name: 'SFDPEVCJ', avg_exec_mins: 12.4, avg_cpu_mins: 4.1, job_count: 35 },
      ],
      critical_jobs_pills: [
        { appl_name: 'SFDPEMCO', critical_ind: 'Y', critical_job_count: 8 },
        { appl_name: 'SFDPEGEM', critical_ind: 'Y', critical_job_count: 7 },
        { appl_name: 'SFDPD2', critical_ind: 'Y', critical_job_count: 6 },
      ],
      run_frequency_bars: [
        { frequency: 'DAILY', job_count: 312 },
        { frequency: 'WEEKLY', job_count: 148 },
        { frequency: 'MONTHLY', job_count: 56 },
        { frequency: 'ON DEMAND', job_count: 25 },
      ],
      sla_config_by_lob: [
        { appl_name: 'SFDPMCD', sla_time: '08:00 PM', lob: 'Retail', sub_lob: 'Core', holiday_run_ind: 'N', critical_ind: 'CRIT', job_count: 12, last_updated: '2026-06-17T21:10:00' },
        { appl_name: 'SFDPEGEM', sla_time: '10:00 PM', lob: 'Ops', sub_lob: 'Batch', holiday_run_ind: 'Y', critical_ind: 'CRIT', job_count: 9, last_updated: '2026-06-17T20:45:00' },
      ],
    }

    return { cards, kpis, jobRunTrend, jobRunAgents, jobTypeDistribution, groupedWidgets }
  }, [data, platformSummary, selected, selectedPlatform])

  // ── Mock overview state effect (no network) ──────────────────────
  React.useEffect(() => {
    if (dashboardView !== 'operations' || !useMock) return

    const mockData = buildMockOverviewData()
    setOverviewCards(mockData.cards)
    setOverviewKpis(mockData.kpis)
    setOverviewWidgets({
      jobRunTrend: mockData.jobRunTrend,
      jobRunAgents: mockData.jobRunAgents,
      jobTypeDistribution: mockData.jobTypeDistribution,
    })
    setGroupedWidgets(mockData.groupedWidgets)
    setOverviewScopeLabel(selected ? `${selected}${selectedPlatform ? ` · ${selectedPlatform}` : ''}` : selectedPlatform ?? 'All platforms')
    setOverviewError(null)
    setWidgetsError(null)
    setSlaSectionErrors(INITIAL_GROUPED_SECTION_ERRORS)
    setOverviewLoading(false)
    setWidgetsLoading(false)
    setSlaSectionLoading(INITIAL_GROUPED_SECTION_LOADING)
  }, [buildMockOverviewData, dashboardView, selected, selectedPlatform, useMock])

  // ── KPI cards effect (overview-kpis) ──────────────────────
  React.useEffect(() => {
    if (dashboardView !== 'operations') return
    if (useMock) return
    if (platformLoading) return

    let cancelled = false
    setOverviewLoading(true)
    setOverviewError(null)

    espService.getOverviewKpis(selectedPlatform ?? '', selected, overviewInterval)
      .then((response: EspKpiResponse) => {
        if (cancelled) return
        setOverviewCards(Array.isArray(response?.cards) ? response.cards : [])
        setOverviewKpis(Array.isArray(response?.kpis) ? response.kpis : [])
        setOverviewScopeLabel(
          response?.applName
            ? `${response.applName}${response.platform ? ` · ${response.platform}` : ''}`
            : response?.platform ?? 'All platforms',
        )
      })
      .catch((error: Error) => {
        if (cancelled) return
        setOverviewCards([])
        setOverviewKpis([])
        setOverviewError(error.message || 'Failed to load ESP overview KPIs')
      })
      .finally(() => {
        if (!cancelled) setOverviewLoading(false)
      })

    return () => { cancelled = true }
  }, [dashboardView, overviewInterval, platformLoading, selected, selectedPlatform, useMock])

  // ── Grouped widgets progressive effect (independent section fetches) ──
  React.useEffect(() => {
    if (dashboardView !== 'operations') return
    if (useMock) return
    if (platformLoading) return

    let cancelled = false

    setGroupedWidgets({})
    setSlaSectionLoading({
      jobExecution: true,
      slaStatus: true,
      jobDependencies: true,
      executionForecast: true,
      jobConfigHealth: true,
    })
    setSlaSectionErrors(INITIAL_GROUPED_SECTION_ERRORS)

    const finishSection = (section: EspGroupedSectionKey) => {
      if (cancelled) return
      setSlaSectionLoading((prev) => ({ ...prev, [section]: false }))
    }

    const failSection = (section: EspGroupedSectionKey, message: string) => {
      if (cancelled) return
      setSlaSectionErrors((prev) => ({ ...prev, [section]: message }))
    }

    espService.getOverviewJobExecutionStatus(selectedPlatform ?? '', selected, overviewInterval)
      .then((response: EspGroupedWidgetsResponse) => {
        if (cancelled) return
        setGroupedWidgets((prev) => ({
          ...prev,
          job_execution_status: Array.isArray(response?.job_execution_status) ? response.job_execution_status : [],
        }))
      })
      .catch((error: Error) => failSection('jobExecution', error.message || 'Failed to load Job Execution Status'))
      .finally(() => finishSection('jobExecution'))

    espService.getOverviewSlaStatus(selectedPlatform ?? '', selected, overviewInterval)
      .then((response: EspGroupedWidgetsResponse) => {
        if (cancelled) return
        setGroupedWidgets((prev) => ({
          ...prev,
          sla_status_bars: Array.isArray(response?.sla_status_bars) ? response.sla_status_bars : [],
          sla_recent_events: Array.isArray(response?.sla_recent_events) ? response.sla_recent_events : [],
        }))
      })
      .catch((error: Error) => failSection('slaStatus', error.message || 'Failed to load SLA Status'))
      .finally(() => finishSection('slaStatus'))

    espService.getOverviewJobDependencies(selectedPlatform ?? '', selected, overviewInterval)
      .then((response: EspGroupedWidgetsResponse) => {
        if (cancelled) return
        setGroupedWidgets((prev) => ({
          ...prev,
          job_dependencies: Array.isArray(response?.job_dependencies) ? response.job_dependencies : [],
        }))
      })
      .catch((error: Error) => failSection('jobDependencies', error.message || 'Failed to load Job Dependencies'))
      .finally(() => finishSection('jobDependencies'))

    espService.getOverviewExecutionForecast(selectedPlatform ?? '', selected, overviewInterval)
      .then((response: EspGroupedWidgetsResponse) => {
        if (cancelled) return
        setGroupedWidgets((prev) => ({
          ...prev,
          execution_forecast_metrics: response?.execution_forecast_metrics ?? {
            avg_exec_mins: 0,
            avg_cpu_mins: 0,
            total_samples: 0,
            total_print_lines: 0,
          },
          forecast_exec_by_applib: Array.isArray(response?.forecast_exec_by_applib) ? response.forecast_exec_by_applib : [],
        }))
      })
      .catch((error: Error) => failSection('executionForecast', error.message || 'Failed to load Execution Forecast'))
      .finally(() => finishSection('executionForecast'))

    espService.getOverviewJobConfigHealth(selectedPlatform ?? '', selected, overviewInterval)
      .then((response: EspGroupedWidgetsResponse) => {
        if (cancelled) return
        setGroupedWidgets((prev) => ({
          ...prev,
          critical_jobs_pills: Array.isArray(response?.critical_jobs_pills) ? response.critical_jobs_pills : [],
          run_frequency_bars: Array.isArray(response?.run_frequency_bars) ? response.run_frequency_bars : [],
          sla_config_by_lob: Array.isArray(response?.sla_config_by_lob) ? response.sla_config_by_lob : [],
        }))
      })
      .catch((error: Error) => failSection('jobConfigHealth', error.message || 'Failed to load Job Config Health'))
      .finally(() => finishSection('jobConfigHealth'))

    return () => { cancelled = true }
  }, [dashboardView, overviewInterval, platformLoading, selected, selectedPlatform, useMock])

  // ── Widget charts effect (job-run-trend, job-run-agents, job-type-distribution) ──
  React.useEffect(() => {
    if (dashboardView !== 'operations') return
    if (useMock) return
    if (platformLoading) return

    let cancelled = false
    setWidgetsLoading(true)
    setWidgetsError(null)

    Promise.all([
      espService.getOverviewJobRunTrend(selectedPlatform ?? '', selected, overviewInterval),
      espService.getOverviewJobRunAgents(selectedPlatform ?? '', selected, overviewInterval),
      espService.getOverviewJobTypeDistribution(selectedPlatform ?? '', selected, overviewInterval),
    ])
      .then(([jobRunTrend, jobRunAgents, jobTypeDistribution]) => {
        if (cancelled) return
        setOverviewWidgets({
          jobRunTrend: Array.isArray(jobRunTrend) ? jobRunTrend : [],
          jobRunAgents: Array.isArray(jobRunAgents) ? jobRunAgents : [],
          jobTypeDistribution: Array.isArray(jobTypeDistribution) ? jobTypeDistribution : [],
        })
      })
      .catch((error: Error) => {
        if (cancelled) return
        setOverviewWidgets({})
        setWidgetsError(error.message || 'Failed to load ESP widgets')
      })
      .finally(() => {
        if (!cancelled) setWidgetsLoading(false)
      })

    return () => { cancelled = true }
  }, [dashboardView, overviewInterval, platformLoading, selected, selectedPlatform, useMock])

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

  // When platform selected in mock mode, load mock platform data.
  React.useEffect(() => {
    if (!useMock || !selectedPlatform || selected) return
    const mockData = getMockPlatformData(selectedPlatform)
    setData(mockData)
    setLoading(false)
    const apps = getMockPlatformApplications(selectedPlatform)
    setPlatformApplications(apps)
    setApplibTotal(apps.length)
    setApplibHasMore(false)
  }, [useMock, selectedPlatform, selected])

  // When application selected in mock mode, load mock app data.
  React.useEffect(() => {
    if (!useMock || !selected) return
    const mockData = getMockAppData(selected)
    setData(mockData)
    setLoading(false)
  }, [useMock, selected])

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
      espService.getAppSummary(selected, days, selectedPlatform ?? undefined),
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
      const mockTrendSource = selected
        ? getMockAppData(selected)
        : selectedPlatform
          ? getMockPlatformData(selectedPlatform)
          : null
      setTrendData((mockTrendSource?.job_run_trend as any) ?? [])
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

  // Transform trend data for recharts: normalize 'day' to 'YYYY-MM-DD' for chart keys
  const normalizeDay = (day: string) => {
    // Handles 'YYYY-MM-DD 00:00:00' or ISO strings
    if (!day) return '';
    if (day.length >= 10) return day.slice(0, 10);
    return day;
  };

  const buildTrendChart = (rows: Array<{ day: string; hour: number; job_count: number; job_fail_count: number }>) => {
    if (!rows.length) return { rows: [], days: [] as string[] };
    const days = [...new Set(rows.map(t => normalizeDay(t.day)))].sort();
    const byHour: Record<number, Record<string, number>> = {};
    rows.forEach(({ day, hour, job_count, job_fail_count }) => {
      const normDay = normalizeDay(day);
      if (!byHour[hour]) byHour[hour] = {};
      byHour[hour][`${normDay}_count`] = job_count;
      byHour[hour][`${normDay}_fail`] = job_fail_count;
    });
    const chartRows = Object.entries(byHour)
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([hour, vals]) => ({ hour: `${hour}:00`, ...vals }));
    return { rows: chartRows, days };
  };
  const buildDailyTrendSummary = (rows: Array<{ day: string; hour: number; job_count: number; job_fail_count: number }>) => {
    if (!rows.length) return { rows: [], tickInterval: 0 }
    const byDay = new Map<string, { day: string; runs: number; fails: number }>()
    rows.forEach(({ day, job_count, job_fail_count }) => {
      const normalized = normalizeDay(day)
      const existing = byDay.get(normalized)
      if (existing) {
        existing.runs += job_count
        existing.fails += job_fail_count
      } else {
        byDay.set(normalized, {
          day: normalized,
          runs: job_count,
          fails: job_fail_count,
        })
      }
    })
    const summaryRows = Array.from(byDay.values())
      .sort((left, right) => left.day.localeCompare(right.day))
      .map(row => ({ ...row, dayLabel: formatTrendDayLabel(row.day) }))
    return {
      rows: summaryRows,
      tickInterval: Math.max(Math.ceil(summaryRows.length / 10) - 1, 0),
    }
  }
  const trendChart     = React.useMemo(() => buildTrendChart(trendData), [trendData])
  const drillJobChart  = React.useMemo(() => buildTrendChart(drillJobTrend), [drillJobTrend])
  const dailyPlatformTrendChart = React.useMemo(() => buildDailyTrendSummary(trendData), [trendData])
  const useDailyPlatformTrend = days > 7

  // Available job options for the job selector dropdown
  const jobOptions = React.useMemo(() => (data?.job_list ?? []).map(j => j.jobname), [data])
  const statusOptions = React.useMemo(() => {
    const statuses = new Set((data?.job_list ?? []).map(j => normalizeRunStatusLabel(j.run_status)))
    return ['All', ...RUN_STATUS_ORDER.filter(status => statuses.has(status))]
  }, [data])

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
    .filter(r => statusFilter === 'All' || normalizeRunStatusLabel(r.run_status) === statusFilter)
    .filter(r => !widgetFilteredJobnames || widgetFilteredJobnames.has(r.jobname))
    .sort((left, right) => {
      if (!left.last_run_date && !right.last_run_date) return left.jobname.localeCompare(right.jobname)
      if (!left.last_run_date) return 1
      if (!right.last_run_date) return -1
      const tsDiff = new Date(right.last_run_date).getTime() - new Date(left.last_run_date).getTime()
      return tsDiff !== 0 ? tsDiff : left.jobname.localeCompare(right.jobname)
    }),        [data, selectedJobs, statusFilter, widgetFilteredJobnames])
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
    const baseCols: ColumnDef[] = [
      {
        key: 'jobname_application',
        header: 'Application|JOB NAME',
        flex: 1,
        noWrap: true,
        render: r => {
          const applicationName = r.appl_name ?? data?.appl_name ?? '—'
          return (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, minWidth: 0 }}>
            <Tooltip title={`${applicationName}|${r.jobname}`} placement="top" arrow>
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
                {`${applicationName}|${r.jobname}`}
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
          )
        },
      },
      {
        key: 'last_run_date',
        header: 'Last Run',
        width: 140,
        render: r => {
          if (!r.last_run_date) {
            return (
              <Tooltip title="Never run" placement="top" arrow>
                <Typography component="span" sx={{ fontSize: '11px', color: '#9e9e9e' }}>—</Typography>
              </Tooltip>
            )
          }
          const daysSince = Math.floor((Date.now() - new Date(r.last_run_date).getTime()) / 86_400_000)
          const hoverText = daysSince === 0 ? 'Today' : daysSince === 1 ? '1 day ago' : `${daysSince} days ago`
          return (
            <Tooltip title={hoverText} placement="top" arrow>
              <Typography component="span" sx={{ fontSize: '11px', color: 'inherit' }}>
                {new Date(r.last_run_date).toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </Typography>
            </Tooltip>
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
      {
        key: 'run_status',
        header: 'Status',
        width: 110,
        noWrap: true,
        render: r => {
          const status = normalizeRunStatusLabel(r.run_status)
          const statusStyle = status === 'SUCCESS'
            ? { color: '#2e7d32', bgcolor: '#e8f5e9', borderColor: '#a5d6a7' }
            : status === 'FAILED'
              ? { color: '#c62828', bgcolor: '#ffebee', borderColor: '#ef9a9a' }
              : status === 'NEVER RUN'
                ? { color: '#ef6c00', bgcolor: '#fff3e0', borderColor: '#ffcc80' }
                : { color: '#616161', bgcolor: '#f5f5f5', borderColor: '#e0e0e0' }
          return (
            <Chip
              label={status}
              size="small"
              sx={{
                height: 20,
                fontSize: '10px',
                fontWeight: 700,
                color: statusStyle.color,
                bgcolor: statusStyle.bgcolor,
                border: `1px solid ${statusStyle.borderColor}`,
              }}
            />
          )
        },
      },
    ]
    return [baseCols[0], baseCols[1], baseCols[3], baseCols[2]]
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.appl_name, drillJob])

  const depCols: ColumnDef[] = [
    { key: 'jobname', header: 'Job Name', flex: 1, noWrap: true },
    { key: 'appl_name', header: 'Applib Name', width: 140, noWrap: true,
      render: (r: any) => r.appl_name ?? data?.appl_name ?? '—' },
    { key: 'col2',    header: 'Link',     width: 120, noWrap: true,
      render: (r: any) => r.successor_job ?? r.predecessor_job ?? '—' },
  ]

  // Legacy sections are intentionally disabled in JSX below; keep these symbols referenced
  // so strict unused checks do not fail while we keep old logic in place for quick rollback.
  void [
    Checkbox,
    IconButton,
    Slider,
    WorkIcon,
    AccountTreeIcon,
    StorageIcon,
    TrendingUpIcon,
    TableChartIcon,
    PeopleIcon,
    ArrowBackIcon,
    WidgetShell,
    MetricBarList,
    DataTable,
    TrendLineChart,
    DonutChart,
    ESPSlaMissedJobsTab,
    TREND_RUN_COLORS,
    TREND_FAIL_COLORS,
    BAR_COLORS,
    ESP_DAY_PRESETS,
    ESP_PLATFORM_RECENT_JOB_LIMIT,
    ESP_WIDGET_PANEL_HEIGHT,
    loading,
    trendLoading,
    drillJobTrendLoading,
    jobListLimited,
    setDays,
    loadMoreJobs,
    trendChart,
    drillJobChart,
    dailyPlatformTrendChart,
    useDailyPlatformTrend,
    jobOptions,
    statusOptions,
    filteredJobList,
    filteredMeta,
    filteredPred,
    filteredSucc,
    jobListCols,
    depCols,
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
            {/* {dashboardView === 'operations' && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 220 }}>
                <Typography sx={{ fontSize: '11px', color: '#777', whiteSpace: 'nowrap' }}>Run Trend: Last {days}d</Typography>
                <Slider
                  value={days}
                  min={1}
                  max={90}
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
                <Typography sx={{ fontSize: '10px', color: '#bbb', whiteSpace: 'nowrap' }}>90d</Typography>
              </Box>
            )}  */}
            {/* {dashboardView === 'operations' && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
                {ESP_DAY_PRESETS.map((presetDays) => {
                  const isActive = days === presetDays
                  return (
                    <Chip
                      key={presetDays}
                      label={`${presetDays}d`}
                      size="small"
                      onClick={() => setDays(presetDays)}
                      sx={{
                        height: 22,
                        fontSize: '10px',
                        fontWeight: isActive ? 700 : 500,
                        cursor: 'pointer',
                        backgroundColor: isActive ? '#e8f5e9' : '#f5f5f5',
                        color: isActive ? '#2e7d32' : '#78909c',
                        border: isActive ? '1px solid #2e7d3240' : '1px solid transparent',
                        '& .MuiChip-label': { px: 1 },
                      }}
                    />
                  )
                })}
              </Box>
            )} */}
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
                    <MenuItem value="" sx={{ fontSize: '12px' }}>
                      All Platforms
                    </MenuItem>
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
          {/* {dashboardView === 'operations' && (
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
          )} */}

          {/* Clear Filters */}
          {((dashboardView === 'operations' && (selectedJobs.length > 0 || statusFilter !== 'All')) || selected || (selectedPlatform && platformSummary.length > 0 && selectedPlatform !== platformSummary[0].platform)) && (
            <Button
              size="small"
              onClick={() => {
                const first = platformSummary[0]?.platform ?? null
                const targetPlatform = first ?? selectedPlatform
                if (applibSearchRef.current) {
                  clearTimeout(applibSearchRef.current)
                  applibSearchRef.current = null
                }
                if (dashboardView === 'operations') setSelectedJobs([])
                setStatusFilter('All')
                setSelected('')
                setApplibSearch('')
                setPlatformApplications([])
                setApplibTotal(0)
                setApplibHasMore(false)
                setSelectedPlatform(first)
                if (!useMock && targetPlatform && targetPlatform === selectedPlatform) {
                  fetchApplibs(targetPlatform, '')
                }
              }}
              sx={{ fontSize: '10px', color: '#d32f2f', textTransform: 'none', height: 26, whiteSpace: 'nowrap', px: 1.25, border: '1px solid #ef9a9a', borderRadius: 1, ml: { xs: 0, lg: 'auto' }, '&:hover': { bgcolor: '#fce4ec' } }}
            >
              Clear Filters
            </Button>
          )}
        </Box>
      </Paper>

      {dashboardView === 'operations' && (
        <ESPExecutiveOverview
          cards={overviewCards}
          kpis={overviewKpis}
          widgets={overviewWidgets}
          groupedWidgets={groupedWidgets}
          loading={overviewLoading}
          error={overviewError}
          widgetsLoading={widgetsLoading}
          widgetsError={widgetsError}
          slaLoading={slaLoading}
          slaError={slaError}
          slaSectionLoading={slaSectionLoading}
          slaSectionErrors={slaSectionErrors}
          interval={overviewInterval}
          onIntervalChange={setOverviewInterval}
          scopeLabel={overviewScopeLabel}
        />
      )}

      {/* Legacy sections below the new executive overview are intentionally commented out.
         Keep only ESPExecutiveOverview (widgets through Job Dependencies) for this dashboard. */}
      {false && (
        <>
          {/* Loading, no-data, platform trend, SLA tab, and old operations blocks retained for reference. */}
        </>
      )}
    </Box>
  )
}

