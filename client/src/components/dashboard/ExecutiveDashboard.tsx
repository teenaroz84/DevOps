import React, { useState, useEffect } from 'react'
import { Box, Typography, Chip, CircularProgress, Button, Paper, Tooltip } from '@mui/material'
import StorageIcon from '@mui/icons-material/Storage'
import SupportAgentIcon from '@mui/icons-material/SupportAgent'
import CloudIcon from '@mui/icons-material/Cloud'
import AccountTreeIcon from '@mui/icons-material/AccountTree'
import DashboardIcon from '@mui/icons-material/Dashboard'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'
import SmartToyIcon from '@mui/icons-material/SmartToy'
import TuneIcon from '@mui/icons-material/Tune'
import AcUnitIcon from '@mui/icons-material/AcUnit'
import {
  WidgetShell,
  StatCardGrid,
  StatCardItem,
  MetricBarList,
  ComposedBarLineChart,
  AlertBanner,
} from '../widgets'
import { DMFPipelineWidget } from './DMFWidgets'
import { ServiceNowDashboard } from './DataSourceWidgets'
import { ESPDashboardTab } from './ESPDashboardTab'
import { TalendDashboardTab } from './TalendDashboardTab'
import { SnowflakeDashboardTab } from './SnowflakeDashboardTab'
import { dmfService, snowflakeService, talendService, servicenowService, espService } from '../../services'
import { MOCK_DMF_SUMMARY, MOCK_DMF_RUNS_OVER_TIME } from '../../services/dmfMockData'
import { MOCK_TALEND_SUMMARY } from '../../services/talendMockData'
import { MOCK_SERVICENOW_INCIDENTS, MOCK_SERVICENOW_TICKETS } from '../../services/servicenowMockData'
import { MOCK_ESP_JOB_COUNTS } from '../../services/espMockData'
import { useMockData } from '../../context/MockDataContext'
import { SESSION_ID } from '../../services/session'
import { AGENTS } from '../../config/agentConfig'

// ─── Source definitions ────────────────────────────────────
export type SourceKey = 'overview' | 'dmf' | 'servicenow' | 'logs' | 'pipeline' | 'snowflake'

const SOURCES: {
  key: SourceKey
  label: string
  icon: React.ReactElement
  accent: string
  sub: string
}[] = [
  { key: 'overview',   label: 'Overview',        icon: <DashboardIcon />,    accent: '#1976d2', sub: 'Executive Summary'       },
  { key: 'servicenow', label: 'ServiceNow',      icon: <SupportAgentIcon />, accent: '#c62828', sub: ''                    },
  { key: 'pipeline',   label: 'ESP',             icon: <CloudIcon />,        accent: '#2e7d32', sub: '' },
  { key: 'dmf',        label: 'DMF',             icon: <StorageIcon />,      accent: '#1565c0', sub: ''              },
  { key: 'logs',       label: 'Talend',          icon: <AccountTreeIcon />,  accent: '#e65100', sub: ''        },
  { key: 'snowflake',  label: 'Snowflake',       icon: <AcUnitIcon />,       accent: '#29b6f6', sub: '' },
]

// ─── Overview widget preferences ─────────────────────────────
type OverviewPrefs = {
  kpiStrip: boolean
  operationalSnapshot: boolean
  dmfTrend: boolean
  snapDmf: boolean
  snapServiceNow: boolean
  snapLogs: boolean
  snapPipeline: boolean
  snapInsights: boolean
}

const DEFAULT_PREFS: OverviewPrefs = {
  kpiStrip: true,
  operationalSnapshot: true,
  dmfTrend: true,
  snapDmf: true,
  snapServiceNow: true,
  snapLogs: true,
  snapPipeline: true,
  snapInsights: true,
}

const PREFS_STORAGE_KEY = `executive-overview-prefs:${SESSION_ID}`

// ─── Overview / Landing page ───────────────────────────────
const OverviewLanding: React.FC<{ onSourceSelect: (s: SourceKey) => void }> = ({ onSourceSelect }) => {
  const { useMock, toggleMock } = useMockData()
  // ── Widget visibility preferences ──────────────────────
  const [prefs, setPrefs] = useState<OverviewPrefs>(() => {
    try {
      const stored = localStorage.getItem(PREFS_STORAGE_KEY)
      return stored ? { ...DEFAULT_PREFS, ...JSON.parse(stored) } : DEFAULT_PREFS
    } catch { return DEFAULT_PREFS }
  })
  const [showPrefs, setShowPrefs] = useState(false)

  useEffect(() => {
    localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(prefs))
  }, [prefs])

  const togglePref = (key: keyof OverviewPrefs) =>
    setPrefs(p => ({ ...p, [key]: !p[key] }))
  const resetPrefs = () => setPrefs(DEFAULT_PREFS)

  const [dmfSummary,    setDmfSummary]    = useState<any>(null)
  const [cost,          setCost]          = useState<any>(null)
  const [runsOverTime,  setRunsOverTime]  = useState<any[]>([])
  const [talendSummary, setTalendSummary] = useState<any>(null)
  const [incidents,     setIncidents]     = useState<any[]>([])
  const [tickets,       setTickets]       = useState<any[]>([])
  const [espJobCounts,     setEspJobCounts]     = useState<any[]>([])
  const [snowflakePlatform, setSnowflakePlatform] = useState<any>(null)
  const [loadingCore,       setLoadingCore]       = useState(true)
  const [loadingSnowflake,  setLoadingSnowflake]  = useState(true)

  useEffect(() => {
    setLoadingSnowflake(true)
    snowflakeService.getCost()
      .then(setCost)
      .catch(() => setCost(null))
      .finally(() => setLoadingSnowflake(false))

    snowflakeService.getPlatformSummary()
      .then(setSnowflakePlatform)
      .catch(() => setSnowflakePlatform(null))
  }, [])

  useEffect(() => {
    setLoadingCore(true)
    // Clear stale data immediately so mock values don't persist into live view
    setDmfSummary(null)
    setRunsOverTime([])
    setTalendSummary(null)
    setIncidents([])
    setTickets([])
    setEspJobCounts([])

    if (useMock) {
      setDmfSummary(MOCK_DMF_SUMMARY)
      setRunsOverTime(MOCK_DMF_RUNS_OVER_TIME)
      setTalendSummary(MOCK_TALEND_SUMMARY)
      setIncidents(MOCK_SERVICENOW_INCIDENTS)
      setTickets(MOCK_SERVICENOW_TICKETS)
      setEspJobCounts(MOCK_ESP_JOB_COUNTS)
      setLoadingCore(false)
      return
    }

    Promise.all([
      dmfService.getSummary(),
      dmfService.getRunsOverTime(),
      talendService.getSummary(),
      servicenowService.getIncidents(),
      servicenowService.getTickets(),
      espService.getJobCounts(),
    ]).then(([dmf, rot, tln, inc, tkt, esp]) => {
      setDmfSummary(dmf)
      setRunsOverTime(Array.isArray(rot) ? rot : [])
      setTalendSummary(tln)
      setIncidents(Array.isArray(inc) ? inc : [])
      setTickets(Array.isArray(tkt) ? tkt : [])
      setEspJobCounts(Array.isArray(esp) ? esp : Array.isArray(esp?.jobs_summary) ? esp.jobs_summary : [])
      setLoadingCore(false)
    }).catch(() => setLoadingCore(false))
  }, [useMock])

  if (loadingCore || loadingSnowflake) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 300 }}>
        <CircularProgress />
      </Box>
    )
  }

  // ── Derived metrics ──────────────────────────────────────
  const budgetPct = cost ? Math.round((cost.total / cost.budget) * 100) : 0

  // Talend derived
  const talendBreakdown: any[] = talendSummary?.statusBreakdown ?? []
  const talendTotal   = talendBreakdown.reduce((s: number, r: any) => s + r.count, 0)
  const talendSuccess = talendBreakdown.find((r: any) => r.status?.includes('SUCCESS'))?.count ?? 0
  const talendFailed  = talendBreakdown.find((r: any) => r.status?.includes('FAILED'))?.count  ?? 0
  const talendRunning = talendBreakdown.find((r: any) => r.status?.includes('RUNNING'))?.count ?? 0
  const talendFailPct = talendTotal > 0 ? Math.round((talendFailed / talendTotal) * 100) : 0

  // ServiceNow derived
  const p1Incidents = incidents.find((i: any) => i.priority_field === 'P1')?.incident_count ?? 0
  const p2Incidents = incidents.find((i: any) => i.priority_field === 'P2')?.incident_count ?? 0
  const p3Incidents = incidents.find((i: any) => i.priority_field === 'P3')?.incident_count ?? 0
  const slaBreached = tickets.filter((t: any) => t.sla?.breached).length
  const openTickets = tickets.filter((t: any) => t.status !== 'resolved' && t.status !== 'closed').length

  // ESP derived
  const totalEspApps = espJobCounts.length
  const totalEspJobs = espJobCounts.reduce((s: number, a: any) => s + (parseInt(a.total_jobs, 10) || 0), 0)
  const topEspApp    = espJobCounts.reduce((top: any, a: any) => (!top || a.total_jobs > top.total_jobs ? a : top), null as any)
  const avgJobsPerApp = totalEspApps > 0 ? Math.round(totalEspJobs / totalEspApps) : 0

  const CAP = 200_000
  const capCount = (n: number): string | number =>
    !isFinite(n) || isNaN(n) ? '—' : n > CAP ? '200,000+' : n.toLocaleString()

  // ── Cross-system correlation data ─────────────────────────
  // Map ServiceNow ticket affectedService → source system
  const TICKET_SOURCE_MAP: Record<string, string> = {
    'BI Reporting':       'DMF',
    'Data Warehouse':     'DMF',
    'Analytics Platform': 'Snowflake',
    'CMDB Sync':          'ServiceNow',
    'Database Layer':     'Database',
    'DMF Orchestration':  'DMF',
    'ESP Scheduler':      'ESP',
    'Monitoring':         'CloudWatch',
  }
  const ticketsBySource = tickets.reduce((acc: Record<string, number>, t: any) => {
    const src = TICKET_SOURCE_MAP[t.affectedService] ?? 'Other'
    acc[src] = (acc[src] ?? 0) + 1
    return acc
  }, {})
  const SOURCE_COLORS: Record<string, string> = {
    'DMF': '#1565c0', 'ESP': '#2e7d32', 'Snowflake': '#0277bd',
    'ServiceNow': '#c62828', 'Database': '#546e7a', 'CloudWatch': '#e65100', 'Other': '#9e9e9e',
  }
  const incidentAttributionItems = Object.entries(ticketsBySource)
    .sort(([, a], [, b]) => (b as number) - (a as number))
    .map(([label, value]) => ({
      label,
      value: value as number,
      max:   tickets.length || 1,
      color: SOURCE_COLORS[label] ?? '#9e9e9e',
      sublabel: `${value} ticket${(value as number) > 1 ? 's' : ''}`,
    }))

  // Platform health bars (normalised %)
  const talendSuccessPct = talendTotal > 0 ? Math.round(talendSuccess / talendTotal * 100) : 0
  const snSlaCompliancePct = tickets.length > 0 ? Math.round((tickets.length - slaBreached) / tickets.length * 100) : 100
  const sfEfficiencyPct = cost?.efficient_pct ?? 0
  const platformHealthItems = [
    { label: 'DMF',         value: dmfSummary?.successRate?.value ?? 0, suffix: '%', max: 100, sublabel: `${dmfSummary?.failedRuns?.value ?? '—'} failed / ${dmfSummary?.totalRuns?.value ?? '—'} runs` },
    { label: 'Talend',      value: talendSuccessPct,                    suffix: '%', max: 100, sublabel: `${talendFailed} failed · ${talendRunning} running` },
    { label: 'Snowflake',   value: sfEfficiencyPct,                     suffix: '%', max: 100, sublabel: `$${cost ? (cost.wasted_spend / 1000).toFixed(1) : '—'}K wasted spend` },
    { label: 'ServiceNow',  value: snSlaCompliancePct,                  suffix: '%', max: 100, sublabel: `${slaBreached} SLA breached / ${tickets.length} tickets` },
  ]

  // Failure volume comparison
  const sfTaskFailures = snowflakePlatform?.task_failures ?? 0
  const sfQueryErrors  = snowflakePlatform?.query_errors  ?? 0
  const combinedFailures = (dmfSummary?.failedRuns?.value ?? 0) + talendFailed + sfTaskFailures
  const dmfTicketCount   = ticketsBySource['DMF'] ?? 0
  // ── Global KPI strip (one number from each source) ────────
  const globalKpis: StatCardItem[] = [
    {
      label: 'DMF Success Rate',
      value: dmfSummary?.successRate?.value ?? '—',
      unit: '%',
      color: '#2e7d32',
      bg: '#e8f5e9',
      trend: dmfSummary?.successRate?.trend,
      trendPositiveIsGood: true,
      description: 'DMF pipeline execution success rate across all stages',
    },
    {
      label: 'P1 Incidents',
      value: p1Incidents,
      color: p1Incidents > 0 ? '#c62828' : '#2e7d32',
      bg: p1Incidents > 0 ? '#fce4ec' : '#e8f5e9',
      trend: `${openTickets} open · ${slaBreached} SLA breached`,
      trendPositiveIsGood: false,
      description: 'ServiceNow critical P1 incidents currently active',
    },
    {
      label: 'Talend Failed',
      value: talendFailed,
      color: talendFailed > 0 ? '#c62828' : '#2e7d32',
      bg: talendFailed > 0 ? '#fce4ec' : '#e8f5e9',
      trend: `${talendFailPct}% fail rate · ${talendRunning} running`,
      trendPositiveIsGood: false,
      description: 'Talend task executions that reached a failed state. Last 7 days.',
    },
    {
      label: 'Budget Usage',
      value: budgetPct || '—',
      unit: budgetPct ? '%' : '',
      color: budgetPct > 110 ? '#c62828' : budgetPct > 100 ? '#f57c00' : '#2e7d32',
      bg: budgetPct > 110 ? '#fce4ec' : budgetPct > 100 ? '#fff3e0' : '#e8f5e9',
      trend: cost
        ? `$${(cost.total / 1000).toFixed(0)}K of $${(cost.budget / 1000).toFixed(0)}K`
        : 'Snowflake',
      trendPositiveIsGood: false,
      description: 'Snowflake compute + infrastructure budget utilisation.',
    },
  ]

  // ── Source snapshot definitions ───────────────────────────
  type SnapshotDef = {
    key: SourceKey
    prefKey: keyof OverviewPrefs
    title: string
    accent: string
    source: string
    kpis: StatCardItem[]
    alert?: string
  }

  const snapshots: SnapshotDef[] = [
    {
      key: 'servicenow',
      prefKey: 'snapServiceNow',
      title: 'ServiceNow',
      accent: '#c62828',
      source: 'ITSM · open incidents · last 7 days',
      kpis: [
        { label: 'P1 Incidents', value: p1Incidents,
          color: p1Incidents > 0 ? '#c62828' : '#2e7d32', bg: p1Incidents > 0 ? '#fce4ec' : '#e8f5e9',
          description: 'Critical P1 incidents currently open (last 7 days).',
          dialogStats: [{ label: 'P2', value: p2Incidents }, { label: 'P3', value: p3Incidents }] },
        { label: 'P2 Incidents', value: p2Incidents,
          color: p2Incidents > 0 ? '#f57c00' : '#2e7d32', bg: p2Incidents > 0 ? '#fff3e0' : '#e8f5e9',
          description: 'High priority P2 incidents open in the last 7 days.',
          dialogStats: [{ label: 'P1', value: p1Incidents }, { label: 'P3', value: p3Incidents }] },
        { label: 'Open Tickets', value: openTickets,
          color: '#1565c0', bg: '#e3f2fd',
          description: 'Total unresolved tickets across all priorities (last 7 days).',
          dialogStats: [{ label: 'SLA Breached', value: slaBreached }] },
        { label: 'SLA Breached', value: slaBreached,
          color: slaBreached > 0 ? '#c62828' : '#2e7d32', bg: slaBreached > 0 ? '#fce4ec' : '#e8f5e9',
          description: 'Tickets that have violated their SLA commitment (last 7 days).',
          dialogStats: [{ label: 'Open', value: openTickets }, { label: 'P1', value: p1Incidents }] },
      ],
      alert: p1Incidents > 0 ? `⚠ ${p1Incidents} P1 incident${p1Incidents > 1 ? 's' : ''} active` : undefined,
    },
    {
      key: 'pipeline',
      prefKey: 'snapPipeline',
      title: 'ESP',
      accent: '#2e7d32',
      source: 'Enterprise Data Platform · job catalog (current)',
      kpis: [
        { label: 'Applications', value: totalEspApps,
          color: '#2e7d32', bg: '#e8f5e9',
          description: 'Number of distinct ESP scheduler applications.',
          dialogStats: [{ label: 'Total Jobs', value: capCount(totalEspJobs) }] },
        { label: 'Total Jobs',   value: capCount(totalEspJobs),
          color: '#1565c0', bg: '#e3f2fd',
          description: 'Total job definitions across all ESP applications.',
          dialogStats: [{ label: 'Applications', value: totalEspApps }, { label: 'Avg / App', value: capCount(avgJobsPerApp) }] },
        { label: 'Largest App',  value: capCount(parseInt(topEspApp?.total_jobs, 10) || 0),
          color: '#546e7a', bg: '#eceff1',
          description: `Application with the most job definitions${topEspApp ? ` (${topEspApp.appl_name})` : ''}.`,
          dialogStats: topEspApp ? [{ label: 'App', value: topEspApp.appl_name }] : [] },
        { label: 'Avg Jobs / App', value: totalEspApps > 0 ? capCount(avgJobsPerApp) : '—',
          color: '#7b1fa2', bg: '#f3e5f5',
          description: 'Average number of job definitions per ESP application.',
          dialogStats: [{ label: 'Applications', value: totalEspApps }, { label: 'Total Jobs', value: capCount(totalEspJobs) }] },
      ],
      alert: undefined,
    },
    {
      key: 'dmf',
      prefKey: 'snapDmf',
      title: 'DMF',
      accent: '#1565c0',
      source: 'PostgreSQL · edoops.DMF_RUN_MASTER · all-time',
      kpis: [
        { label: 'Total Runs',  value: dmfSummary?.totalRuns?.value?.toLocaleString() ?? '—',
          color: '#1565c0', bg: '#e3f2fd',
          description: 'Total DMF pipeline runs recorded (all-time).',
          dialogStats: [{ label: 'Failed', value: dmfSummary?.failedRuns?.value ?? '—' }, { label: 'In Progress', value: dmfSummary?.runsInProgress?.value ?? '—' }] },
        { label: 'Failed',      value: dmfSummary?.failedRuns?.value ?? '—',
          color: '#c62828', bg: '#fce4ec',
          description: 'Total DMF pipeline runs that reached a failed state (all-time).',
          dialogStats: [{ label: 'Success Rate', value: `${dmfSummary?.successRate?.value ?? '—'}%` }, { label: 'Total Runs', value: dmfSummary?.totalRuns?.value ?? '—' }] },
        { label: 'In Progress', value: dmfSummary?.runsInProgress?.value ?? '—',
          color: '#e65100', bg: '#fff3e0',
          description: 'DMF pipeline runs currently executing.',
          dialogStats: [{ label: 'Total Runs', value: dmfSummary?.totalRuns?.value ?? '—' }, { label: 'Success Rate', value: `${dmfSummary?.successRate?.value ?? '—'}%` }] },
        { label: 'Success',     value: `${dmfSummary?.successRate?.value ?? '—'}%`,
          color: '#2e7d32', bg: '#e8f5e9',
          description: 'Percentage of DMF pipeline runs that completed successfully (all-time).',
          dialogStats: [{ label: 'Total Runs', value: dmfSummary?.totalRuns?.value ?? '—' }, { label: 'Failed', value: dmfSummary?.failedRuns?.value ?? '—' }] },
      ],
      alert: (dmfSummary?.failedRuns?.value ?? 0) > 50
        ? `⚠ ${dmfSummary.failedRuns.value} failed runs recorded`
        : undefined,
    },
    {
      key: 'logs',
      prefKey: 'snapLogs',
      title: 'Talend',
      accent: '#e65100',
      source: 'PostgreSQL · edoops.talend_logs_dashboard · last 7 days',
      kpis: [
        { label: 'Total Runs',  value: talendTotal,
          color: '#1565c0', bg: '#e3f2fd',
          description: 'Total Talend task executions in the last 7 days.',
          dialogStats: [{ label: 'Success', value: talendSuccess }, { label: 'Failed', value: talendFailed }] },
        { label: 'Successful',  value: talendSuccess,
          color: '#2e7d32', bg: '#e8f5e9',
          description: 'Tasks that completed successfully in the last 7 days.',
          dialogStats: [{ label: 'Total', value: talendTotal }, { label: 'Failed', value: talendFailed }] },
        { label: 'Failed',      value: talendFailed,
          color: talendFailed > 0 ? '#c62828' : '#2e7d32', bg: talendFailed > 0 ? '#fce4ec' : '#e8f5e9',
          description: 'Tasks that reached a failed state in the last 7 days.',
          dialogStats: [{ label: 'Fail Rate', value: `${talendFailPct}%` }, { label: 'Total', value: talendTotal }] },
        { label: 'Running',     value: talendRunning,
          color: '#f57c00', bg: '#fff3e0',
          description: 'Tasks currently executing.',
          dialogStats: [{ label: 'Total', value: talendTotal }, { label: 'Success', value: talendSuccess }] },
      ],
      alert: talendFailed > 10 ? `⚠ ${talendFailed} failed execution${talendFailed > 1 ? 's' : ''} this period` : undefined,
    },
  ]

  // ── Pref toggle chip definitions ─────────────────────────
  const prefChips: { key: keyof OverviewPrefs; label: string }[] = [
    { key: 'kpiStrip',            label: 'KPI Strip'            },
    { key: 'operationalSnapshot', label: 'Operational Snapshot' },
    { key: 'dmfTrend',            label: 'DMF Trend'            },
    { key: 'snapDmf',             label: 'DMF'          },
    { key: 'snapServiceNow',      label: 'ServiceNow'   },
    { key: 'snapLogs',            label: 'Talend'       },
    { key: 'snapPipeline',        label: 'ESP'          },
    { key: 'snapInsights',        label: 'Correlations' },
  ]

  const visibleSnapshots = snapshots.filter(s => prefs[s.prefKey])

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, p: 2 }}>

      {/* ── Widget preference toolbar ── */}
      <Paper
        elevation={0}
        sx={{
          borderRadius: 2,
          border: '1px solid #e8ecf1',
          backgroundColor: '#f8f9fb',
          overflow: 'hidden',
        }}
      >
        <Box
          sx={{
            px: 2,
            py: 1,
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            flexWrap: 'wrap',
            cursor: 'pointer',
          }}
          onClick={() => setShowPrefs(p => !p)}
        >
          <TuneIcon sx={{ fontSize: 15, color: '#78909c' }} />
          <Typography sx={{ fontSize: '11px', fontWeight: 700, color: '#78909c', textTransform: 'uppercase', letterSpacing: '0.6px', userSelect: 'none' }}>
            Customize View
          </Typography>
          <Typography sx={{ fontSize: '10px', color: '#aaa', ml: 0.5 }}>
            {showPrefs ? '▲ hide' : '▼ expand'}
          </Typography>
          {!showPrefs && (
            <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography sx={{ fontSize: '10px', color: '#bbb' }}>
                {prefChips.filter(c => prefs[c.key]).length}/{prefChips.length} widgets visible
              </Typography>
              <Chip
                label={useMock ? 'Mock Data' : 'Live Data'}
                size="small"
                onClick={e => { e.stopPropagation(); toggleMock(); }}
                sx={{
                  height: 20,
                  fontSize: '10px',
                  fontWeight: 700,
                  backgroundColor: useMock ? '#fff3e0' : '#e8f5e9',
                  color: useMock ? '#e65100' : '#2e7d32',
                  border: `1px solid ${useMock ? '#ffcc80' : '#a5d6a7'}`,
                  cursor: 'pointer',
                  '& .MuiChip-label': { px: 1 },
                }}
              />
            </Box>
          )}
        </Box>

        {showPrefs && (
          <Box
            sx={{
              px: 2,
              pb: 1.5,
              pt: 0.5,
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              flexWrap: 'wrap',
              borderTop: '1px solid #edf0f3',
            }}
          >
            {prefChips.map(({ key, label }) => (
              <Tooltip key={key} title={prefs[key] ? `Hide "${label}"` : `Show "${label}"`} placement="top">
                <Chip
                  label={label}
                  size="small"
                  onClick={e => { e.stopPropagation(); togglePref(key) }}
                  sx={{
                    fontSize: '11px',
                    height: 26,
                    fontWeight: prefs[key] ? 700 : 400,
                    backgroundColor: prefs[key] ? '#1976d218' : '#efefef',
                    color: prefs[key] ? '#1565c0' : '#aaa',
                    border: prefs[key] ? '1px solid #1976d240' : '1px solid transparent',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                    '& .MuiChip-label': { px: 1.2 },
                    '&:hover': {
                      backgroundColor: prefs[key] ? '#1976d230' : '#e0e0e0',
                    },
                  }}
                />
              </Tooltip>
            ))}
            <Button
              size="small"
              onClick={e => { e.stopPropagation(); resetPrefs() }}
              sx={{
                ml: 'auto',
                fontSize: '11px',
                color: '#f57c00',
                textTransform: 'none',
                minWidth: 'auto',
                px: 1.5,
                border: '1px solid #f57c0040',
                borderRadius: 1,
                '&:hover': { backgroundColor: '#fff3e0', borderColor: '#f57c00' },
              }}
            >
              Reset Preferences
            </Button>
          </Box>
        )}
      </Paper>

      {/* ── Cross-source KPI strip ── */}
      {prefs.kpiStrip && (
        <Paper sx={{ borderRadius: 2, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
          <WidgetShell
            title="Live DataOps Health"
            source="All Sources"
            titleIcon={<DashboardIcon sx={{ color: '#1976d2', fontSize: 18 }} />}
          >
            <Box sx={{ p: 1.5 }}>
              <StatCardGrid items={globalKpis} columns={4} withDialog />
            </Box>
          </WidgetShell>
        </Paper>
      )}

      {/* ── Two hero widgets ── */}
      {(prefs.operationalSnapshot || prefs.dmfTrend) && (
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1.7fr', gap: 2 }}>

          {/* Hero 1: Operational snapshot — one bar per source */}
          {prefs.operationalSnapshot && (
            <Paper sx={{ borderRadius: 2, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
              <WidgetShell
                title="Operational Snapshot"
                source="Cross-source"
                titleIcon={<DashboardIcon sx={{ color: '#1976d2', fontSize: 18 }} />}
              >
                <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                  <MetricBarList
                    items={[
                      {
                        label: 'DMF Success Rate',
                        value: dmfSummary?.successRate?.value ?? 0,
                        suffix: '%',
                        color: '#2e7d32',
                        max: 100,
                        sublabel: 'PostgreSQL · DMF Pipeline',
                      },
                      {
                        label: 'Talend Success Rate',
                        value: talendTotal > 0 ? Math.round((talendSuccess / talendTotal) * 100) : 0,
                        suffix: '%',
                        max: 100,
                        color: talendFailed > 10 ? '#c62828' : talendFailed > 0 ? '#f57c00' : '#2e7d32',
                        sublabel: `${talendSuccess} success · ${talendFailed} failed · ${talendRunning} running`,
                      },
                      {
                        label: 'ServiceNow P1 Incidents',
                        value: p1Incidents,
                        max: Math.max(p1Incidents + p2Incidents + p3Incidents, 1),
                        color: p1Incidents > 0 ? '#c62828' : '#2e7d32',
                        sublabel: `${openTickets} open tickets · ${slaBreached} SLA breached`,
                      },
                      {
                        label: 'Budget Usage',
                        value: Math.min(budgetPct, 120),
                        suffix: '%',
                        color: budgetPct > 110 ? '#c62828' : budgetPct > 100 ? '#f57c00' : '#2e7d32',
                        max: 120,
                        sublabel: cost ? `Snowflake · $${(cost.total / 1000).toFixed(0)}K / $${(cost.budget / 1000).toFixed(0)}K` : 'Snowflake',
                      },
                    ]}
                    barHeight={10}
                  />
                  {(p1Incidents > 0 || talendFailed > 10) && (
                    <AlertBanner
                      severity="warning"
                      title="Action required"
                      message={[
                        p1Incidents > 0    ? `${p1Incidents} P1 incident${p1Incidents > 1 ? 's' : ''} active` : null,
                        talendFailed > 10  ? `${talendFailed} Talend task${talendFailed > 1 ? 's' : ''} failed`  : null,
                      ].filter(Boolean).join(' · ')}
                    />
                  )}
                </Box>
              </WidgetShell>
            </Paper>
          )}

          {/* Hero 2: DMF 7-day pipeline trend */}
          {prefs.dmfTrend && (
            <Paper sx={{ borderRadius: 2, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
              <WidgetShell
                title="DMF Pipeline Runs — Last 7 Days"
                source="PostgreSQL"
                titleIcon={<StorageIcon sx={{ color: '#1565c0', fontSize: 18 }} />}
              >
                <Box sx={{ px: 2, pb: 2, pt: 1 }}>
                  <ComposedBarLineChart
                    data={runsOverTime}
                    xKey="date"
                    bars={[
                      { key: 'total',  label: 'Total Runs', color: '#1976d2' },
                      { key: 'failed', label: 'Failed',     color: '#d32f2f' },
                    ]}
                    lines={[
                      { key: 'successRate', label: 'Success Rate', color: '#2e7d32', unit: '%', yAxisId: 'right' },
                    ]}
                    rightYDomain={[85, 100]}
                    height={220}
                  />
                </Box>
              </WidgetShell>
            </Paper>
          )}
        </Box>
      )}

      {/* ── Source-of-truth snapshot cards ── */}
      {visibleSnapshots.length > 0 && (
        <Box>
          <Typography sx={{ fontSize: '11px', fontWeight: 700, color: '#999', textTransform: 'uppercase', letterSpacing: '0.8px', mb: 1 }}>
            System Snapshots
          </Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(visibleSnapshots.length, 4)}, 1fr)`, gap: 2 }}>
            {visibleSnapshots.map(snap => (
              <Paper
                key={snap.key}
                sx={{
                  borderRadius: 2,
                  border: `1px solid ${snap.accent}33`,
                  borderTop: `3px solid ${snap.accent}`,
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                  transition: 'box-shadow 0.2s',
                  '&:hover': { boxShadow: `0 4px 16px ${snap.accent}33` },
                }}
              >
                <Box sx={{ px: 2, pt: 1.5, pb: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #f5f5f5' }}>
                  <Box>
                    <Typography sx={{ fontWeight: 700, fontSize: '13px', color: snap.accent }}>{snap.title}</Typography>
                    <Typography sx={{ fontSize: '10px', color: '#aaa' }}>{snap.source}</Typography>
                  </Box>
                  <Chip
                    label="Live"
                    size="small"
                    sx={{ fontSize: '9px', height: 18, backgroundColor: `${snap.accent}18`, color: snap.accent, fontWeight: 700 }}
                  />
                </Box>

                <Box sx={{ px: 1.5, py: 1, flex: 1 }}>
                  <StatCardGrid items={snap.kpis} columns={2} compact withDialog />
                </Box>

                <Box sx={{ px: 1.5, pb: 1.5, mt: 'auto' }}>
                  {snap.alert && (
                    <Typography sx={{ fontSize: '10px', color: '#c62828', mb: 0.75, fontWeight: 600 }}>
                      {snap.alert}
                    </Typography>
                  )}
                  <Button
                    fullWidth
                    size="small"
                    endIcon={<ArrowForwardIcon sx={{ fontSize: '13px !important' }} />}
                    onClick={() => onSourceSelect(snap.key)}
                    sx={{
                      textTransform: 'none',
                      fontSize: '11px',
                      color: snap.accent,
                      border: `1px solid ${snap.accent}55`,
                      borderRadius: 1,
                      py: 0.5,
                      '&:hover': { backgroundColor: `${snap.accent}11`, borderColor: snap.accent },
                    }}
                  >
                    View {snap.title}
                  </Button>
                </Box>
              </Paper>
            ))}
          </Box>
        </Box>
      )}

      {/* ── Cross-System Intelligence ── */}
      {false && prefs.snapInsights && (
        <Box>
          <Typography sx={{ fontSize: '11px', fontWeight: 700, color: '#999', textTransform: 'uppercase', letterSpacing: '0.8px', mb: 1 }}>
            Cross-System Intelligence
          </Typography>

          {/* Pipeline cascade flow */}
          <Paper elevation={0} sx={{ borderRadius: 2, border: '1px solid #e8ecf1', overflow: 'hidden', mb: 2, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <Box sx={{ px: 2, py: 1.25, borderBottom: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography sx={{ fontWeight: 700, fontSize: '12px', color: '#37474f' }}>Data Pipeline Cascade</Typography>
              <Typography sx={{ fontSize: '10px', color: '#aaa' }}>· end-to-end system health</Typography>
            </Box>
            <Box sx={{ px: 2, py: 1.5, display: 'flex', alignItems: 'stretch', gap: 0 }}>
              {[
                {
                  key: 'ESP', color: '#2e7d32', bg: '#f1f8f1',
                  lines: [`${totalEspApps} applications`, `${totalEspJobs} jobs scheduled`],
                  health: 'ok' as const,
                },
                {
                  key: 'DMF', color: '#1565c0', bg: '#f0f4ff',
                  lines: [`${dmfSummary?.totalRuns?.value ?? '—'} runs`, `${dmfSummary?.failedRuns?.value ?? 0} failed`],
                  health: ((dmfSummary?.failedRuns?.value ?? 0) > 50 ? 'warn' : 'ok') as 'ok' | 'warn' | 'alert',
                },
                {
                  key: 'Talend', color: '#e65100', bg: '#fff8f5',
                  lines: [`${talendTotal} executions`, `${talendFailed} failed`],
                  health: (talendFailed > 10 ? 'warn' : 'ok') as 'ok' | 'warn' | 'alert',
                },
                {
                  key: 'Snowflake', color: '#0277bd', bg: '#f0f8ff',
                  lines: [`${sfEfficiencyPct}% efficient`, `$${cost ? (cost.total / 1000).toFixed(0) : '—'}K spend`],
                  health: (sfEfficiencyPct > 0 && sfEfficiencyPct < 80 ? 'warn' : 'ok') as 'ok' | 'warn' | 'alert',
                },
                {
                  key: 'ServiceNow', color: '#c62828', bg: '#fff5f5',
                  lines: [`P1: ${p1Incidents} · P2: ${p2Incidents}`, `${slaBreached} SLA breached`],
                  health: (p1Incidents > 0 ? 'alert' : slaBreached > 0 ? 'warn' : 'ok') as 'ok' | 'warn' | 'alert',
                },
              ].map((stage, i, arr) => (
                <React.Fragment key={stage.key}>
                  <Box sx={{
                    flex: 1, bgcolor: stage.bg, textAlign: 'center', py: 1.25, px: 1,
                    border: `1px solid ${stage.health === 'alert' ? '#ef9a9a' : stage.health === 'warn' ? '#ffcc80' : '#e0e0e0'}`,
                    borderRadius: i === 0 ? '8px 0 0 8px' : i === arr.length - 1 ? '0 8px 8px 0' : 0,
                    borderLeft: i > 0 ? 'none' : undefined,
                  }}>
                    <Box sx={{ width: 8, height: 8, borderRadius: '50%', mx: 'auto', mb: 0.5,
                      bgcolor: stage.health === 'alert' ? '#c62828' : stage.health === 'warn' ? '#f57c00' : '#43a047' }} />
                    <Typography sx={{ fontSize: '11px', fontWeight: 700, color: stage.color, lineHeight: 1.3 }}>{stage.key}</Typography>
                    {stage.lines.map((l, li) => (
                      <Typography key={li} sx={{ fontSize: '10px', color: '#777', mt: 0.25, lineHeight: 1.4 }}>{l}</Typography>
                    ))}
                  </Box>
                  {i < arr.length - 1 && (
                    <Box sx={{ display: 'flex', alignItems: 'center', flexShrink: 0, color: '#bdbdbd', fontSize: '18px', zIndex: 1 }}>›</Box>
                  )}
                </React.Fragment>
              ))}
            </Box>
          </Paper>

          {/* Attribution + Health + Failure volume */}
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 2 }}>

            {/* Platform health bars */}
            <Paper elevation={0} sx={{ borderRadius: 2, border: '1px solid #e8ecf1', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
              <WidgetShell
                title="Platform Health Scores"
                source="Cross-system · success / efficiency rates"
                titleIcon={<DashboardIcon sx={{ color: '#1976d2', fontSize: 18 }} />}
              >
                <Box sx={{ px: 2, pb: 2, pt: 0.5 }}>
                  <MetricBarList
                    items={platformHealthItems}
                    barHeight={8}
                    colorByValue={(v) => v >= 90 ? '#2e7d32' : v >= 75 ? '#f57c00' : '#c62828'}
                  />
                </Box>
              </WidgetShell>
            </Paper>

            {/* Incident attribution */}
            <Paper elevation={0} sx={{ borderRadius: 2, border: '1px solid #e8ecf1', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
              <WidgetShell
                title="Incident Attribution by System"
                source="ServiceNow tickets → source system"
                titleIcon={<SupportAgentIcon sx={{ color: '#c62828', fontSize: 18 }} />}
              >
                <Box sx={{ px: 2, pb: 2, pt: 0.5 }}>
                  {incidentAttributionItems.length > 0
                    ? <MetricBarList items={incidentAttributionItems} barHeight={8} />
                    : <Typography sx={{ fontSize: '12px', color: '#aaa', py: 2, textAlign: 'center' }}>No ticket data available</Typography>
                  }
                  {dmfTicketCount > 0 && (
                    <Typography sx={{ fontSize: '10px', color: '#1565c0', mt: 0.5, fontStyle: 'italic' }}>
                      DMF accounts for {Math.round(dmfTicketCount / tickets.length * 100)}% of open tickets
                    </Typography>
                  )}
                </Box>
              </WidgetShell>
            </Paper>

            {/* Failure volume comparison */}
            <Paper elevation={0} sx={{ borderRadius: 2, border: '1px solid #e8ecf1', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
              <WidgetShell
                title="Failure Volume by System"
                source="DMF · Talend · Snowflake · combined"
                titleIcon={<StorageIcon sx={{ color: '#1565c0', fontSize: 18 }} />}
              >
                <Box sx={{ p: 1.5 }}>
                  <StatCardGrid
                    items={[
                      { label: 'DMF Failures',    value: dmfSummary?.failedRuns?.value ?? '—', color: '#1565c0', bg: '#e3f2fd',
                        description: 'DMF pipeline runs that failed this period.' },
                      { label: 'Talend Failures',  value: talendFailed,   color: '#e65100', bg: '#fff3e0',
                        description: 'Talend task executions that reached a failed state.' },
                      { label: 'SF Task Failures', value: sfTaskFailures || '—', color: '#0277bd', bg: '#e1f5fe',
                        description: 'Snowflake scheduled task failures (mock only).' },
                      { label: 'SF Query Errors',  value: sfQueryErrors  || '—', color: '#0277bd', bg: '#e1f5fe',
                        description: 'Snowflake query errors in the current window (mock only).' },
                      { label: 'Combined ETL',     value: combinedFailures, color: '#c62828', bg: '#fce4ec',
                        description: 'Total failures across DMF + Talend + Snowflake tasks.' },
                    ]}
                    columns={2}
                    compact
                    withDialog
                  />
                </Box>
              </WidgetShell>
            </Paper>

          </Box>
        </Box>
      )}

      {/* ── Empty state when all widgets hidden ── */}
      {!prefs.kpiStrip && !prefs.operationalSnapshot && !prefs.dmfTrend && visibleSnapshots.length === 0 && !prefs.snapInsights && (
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', py: 8, gap: 2 }}>
          <TuneIcon sx={{ fontSize: 40, color: '#ccc' }} />
          <Typography sx={{ color: '#aaa', fontSize: '14px' }}>All widgets are hidden.</Typography>
          <Button
            variant="outlined"
            size="small"
            onClick={resetPrefs}
            sx={{ textTransform: 'none', color: '#1976d2', borderColor: '#1976d2', fontSize: '12px' }}
          >
            Restore Default View
          </Button>
        </Box>
      )}
    </Box>
  )
}

// ─── Executive Dashboard shell ─────────────────────────────
interface ExecutiveDashboardProps {
  onChatClick: () => void
  /** Opens a dashboard-specific agent panel by agent ID */
  onOpenAgent?: (agentId: string) => void
  source?: SourceKey
  onSourceChange?: (source: SourceKey) => void
}

export const ExecutiveDashboard: React.FC<ExecutiveDashboardProps> = ({ onChatClick, onOpenAgent, source: controlledSource, onSourceChange }) => {
  const [internalSource, setInternalSource] = useState<SourceKey>('overview')
  const source = controlledSource ?? internalSource
  const setSource = onSourceChange ?? setInternalSource
  const [lastUpdatedMap, setLastUpdatedMap] = useState<Partial<Record<SourceKey, Date>>>({ overview: new Date() })
  const visibleSources = SOURCES
  const active = visibleSources.find(s => s.key === source) ?? visibleSources[0]!

  useEffect(() => {
    setLastUpdatedMap(prev => ({ ...prev, [source]: new Date() }))
  }, [source])
 
  // The agent relevant to the current tab (falls back to 'knowledge')
  // contextAgentId kept for potential future per-tab agent buttons on individual dashboard components

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* ── Fixed header ── */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#1a2535', px: 3, py: 1.5, flexShrink: 0 }}>
        <Box>
          <Typography sx={{ color: '#fff', fontWeight: 700, fontSize: '18px', lineHeight: 1.2 }}>
            Executive DataOps Dashboard
          </Typography>
          <Typography sx={{ color: '#90a4ae', fontSize: '12px' }}>
            {active.label}  {active.sub}
          </Typography>
          <Typography sx={{ color: '#607d8b', fontSize: '11px', mt: 0.25 }}>
            Updated {(lastUpdatedMap[source] ?? new Date()).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })}
          </Typography>
        </Box>
        <Button
          onClick={onChatClick}
          variant="contained"
          size="small"
          startIcon={<SmartToyIcon />}
          sx={{
            backgroundColor: AGENTS.knowledge.color,
            textTransform: 'none',
            fontSize: '12px',
            fontWeight: 700,
            '&:hover': { backgroundColor: AGENTS.knowledge.color, filter: 'brightness(0.9)' },
          }}
        >
          Ask DataOps Knowledge Assist
        </Button>
      </Box>

      {/* ── Source selector tabs ── */}
      <Box sx={{ display: 'flex', backgroundColor: '#263548', px: 2, flexShrink: 0, borderBottom: '1px solid #1a2535' }}>
        {visibleSources.map(src => {
          const isActive = source === src.key
          return (
            <Box
              key={src.key}
              onClick={() => setSource(src.key)}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 0.75,
                px: 2,
                py: 1.2,
                cursor: 'pointer',
                borderBottom: isActive ? `3px solid ${src.accent}` : '3px solid transparent',
                color: isActive ? '#fff' : '#78909c',
                transition: 'all 0.15s',
                '&:hover': { color: '#fff', backgroundColor: 'rgba(255,255,255,0.05)' },
              }}
            >
              {React.cloneElement(src.icon, {
                sx: { fontSize: 15, color: isActive ? src.accent : 'inherit' },
              })}
              <Typography sx={{ fontSize: '12px', fontWeight: isActive ? 700 : 400 }}>
                {src.label}
              </Typography>
            </Box>
          )
        })}
      </Box>

      {/* ── Scrollable content ── */}
      <Box sx={{ flex: 1, overflow: 'auto', backgroundColor: '#f5f6f8' }}>
        {source === 'overview'   && <OverviewLanding onSourceSelect={setSource} />}
        {source === 'dmf'        && <DMFPipelineWidget onOpenAgent={onOpenAgent} />}
        {source === 'servicenow' && <ServiceNowDashboard onOpenAgent={onOpenAgent} />}
        {source === 'logs'       && <TalendDashboardTab onOpenAgent={onOpenAgent} />}
        {source === 'pipeline'   && <ESPDashboardTab onOpenAgent={onOpenAgent} />}
        {source === 'snowflake'  && <SnowflakeDashboardTab onOpenAgent={onOpenAgent} />}
        </Box>

    </Box>  )
} 
