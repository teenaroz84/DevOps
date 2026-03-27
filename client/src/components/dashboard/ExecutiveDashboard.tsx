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
import {
  WidgetShell,
  StatCardGrid,
  StatCardItem,
  MetricBarList,
  ComposedBarLineChart,
  AlertBanner,
} from '../widgets'
import { DMFPipelineWidget } from './DMFWidgets'
import { TicketsWidget, IncidentsWidget } from './DataSourceWidgets'
import { ESPDashboardTab } from './ESPDashboardTab'
import { TalendDashboardTab } from './TalendDashboardTab'
import { dmfService, servicenowService, cloudwatchService, snowflakeService, postgresService } from '../../services'

// ─── Source definitions ────────────────────────────────────
type SourceKey = 'overview' | 'dmf' | 'servicenow' | 'logs' | 'pipeline'

const SOURCES: {
  key: SourceKey
  label: string
  icon: React.ReactElement
  accent: string
  sub: string
}[] = [
  { key: 'pipeline',   label: 'ESP',             icon: <CloudIcon />,        accent: '#2e7d32', sub: 'Enterprise Data Platform' },
  { key: 'dmf',        label: 'DMF',             icon: <StorageIcon />,      accent: '#1565c0', sub: 'PostgreSQL'              },
  { key: 'servicenow', label: 'ServiceNow',      icon: <SupportAgentIcon />, accent: '#c62828', sub: 'ITSM'                    },
  { key: 'logs',       label: 'Talend',          icon: <AccountTreeIcon />,  accent: '#e65100', sub: 'Data Integration'        },
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
}

const DEFAULT_PREFS: OverviewPrefs = {
  kpiStrip: true,
  operationalSnapshot: true,
  dmfTrend: true,
  snapDmf: true,
  snapServiceNow: true,
  snapLogs: true,
  snapPipeline: true,
}

const PREFS_STORAGE_KEY = 'executive-overview-prefs'

// ─── Overview / Landing page ───────────────────────────────
const OverviewLanding: React.FC<{ onSourceSelect: (s: SourceKey) => void }> = ({ onSourceSelect }) => {
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

  const [dmfSummary,   setDmfSummary]   = useState<any>(null)
  const [tickets,      setTickets]      = useState<any[]>([])
  const [errors,       setErrors]       = useState<any[]>([])
  const [cost,         setCost]         = useState<any>(null)
  const [runsOverTime, setRunsOverTime] = useState<any[]>([])
  const [pipelines,    setPipelines]    = useState<any[]>([])
  const [loading,      setLoading]      = useState(true)

  useEffect(() => {
    Promise.all([
      dmfService.getSummary(),
      servicenowService.getTickets(),
      cloudwatchService.getErrors(),
      snowflakeService.getCost(),
      dmfService.getRunsOverTime(),
      postgresService.getPipelines(),
    ]).then(([dmf, tix, err, cst, rot, pls]) => {
      setDmfSummary(dmf)
      setTickets(Array.isArray(tix) ? tix : [])
      setErrors(Array.isArray(err) ? err : [])
      setCost(cst)
      setRunsOverTime(Array.isArray(rot) ? rot : [])
      setPipelines(Array.isArray(pls) ? pls : [])
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 300 }}>
        <CircularProgress />
      </Box>
    )
  }

  // ── Derived metrics ──────────────────────────────────────
  const openTickets       = tickets.filter(t => t.status === 'open' || t.status === 'in_progress').length
  const breachedSLAs      = tickets.filter(t => t.breached).length
  const p1Tickets         = tickets.filter(t => t.priority === 'P1').length
  const criticalErrors    = errors.filter(e => e.severity === 'critical').length
  const highErrors        = errors.filter(e => e.severity === 'high').length
  const budgetPct         = cost ? Math.round((cost.total / cost.budget) * 100) : 0
  const healthyPipelines  = pipelines.filter(p => p.status === 'healthy').length
  const atRiskPipelines   = pipelines.filter(p => p.status === 'at_risk').length
  const criticalPipelines = pipelines.filter(p => p.status === 'critical').length
  const slaPct = tickets.length > 0
    ? Math.round(((tickets.length - breachedSLAs) / tickets.length) * 100)
    : 100

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
      label: 'Open Tickets',
      value: openTickets,
      color: breachedSLAs > 0 ? '#c62828' : '#1565c0',
      bg: breachedSLAs > 0 ? '#fce4ec' : '#e3f2fd',
      trend: breachedSLAs > 0 ? `${breachedSLAs} SLA breached` : 'No breaches',
      trendPositiveIsGood: false,
      description: 'Open ServiceNow incident tickets',
    },
    {
      label: 'Active Errors',
      value: criticalErrors + highErrors,
      color: criticalErrors > 0 ? '#c62828' : '#f57c00',
      bg: criticalErrors > 0 ? '#fce4ec' : '#fff3e0',
      trend: `${criticalErrors} critical · ${highErrors} high`,
      trendPositiveIsGood: false,
      description: 'CloudWatch critical and high severity errors',
    },
    {
      label: 'Budget Usage',
      value: budgetPct,
      unit: '%',
      color: budgetPct > 110 ? '#c62828' : budgetPct > 100 ? '#f57c00' : '#2e7d32',
      bg: budgetPct > 110 ? '#fce4ec' : budgetPct > 100 ? '#fff3e0' : '#e8f5e9',
      trend: cost ? `$${(cost.overage / 1000).toFixed(0)}K over budget` : '',
      trendPositiveIsGood: false,
      description: 'Snowflake compute + infrastructure budget utilisation',
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
      key: 'dmf',
      prefKey: 'snapDmf',
      title: 'DMF',
      accent: '#1565c0',
      source: 'PostgreSQL',
      kpis: [
        { label: 'Total Runs',  value: dmfSummary?.totalRuns?.value?.toLocaleString() ?? '—',
          color: '#1565c0', bg: '#e3f2fd',
          description: 'Total DMF pipeline runs executed in the current period.',
          dialogStats: [{ label: 'Failed', value: dmfSummary?.failedRuns?.value ?? '—' }, { label: 'In Progress', value: dmfSummary?.runsInProgress?.value ?? '—' }] },
        { label: 'Failed',      value: dmfSummary?.failedRuns?.value ?? '—',
          color: '#c62828', bg: '#fce4ec',
          description: 'Total DMF pipeline runs that reached a failed state.',
          dialogStats: [{ label: 'Success Rate', value: `${dmfSummary?.successRate?.value ?? '—'}%` }, { label: 'Total Runs', value: dmfSummary?.totalRuns?.value ?? '—' }] },
        { label: 'In Progress', value: dmfSummary?.runsInProgress?.value ?? '—',
          color: '#e65100', bg: '#fff3e0',
          description: 'DMF pipeline runs currently executing.',
          dialogStats: [{ label: 'Total Runs', value: dmfSummary?.totalRuns?.value ?? '—' }, { label: 'Success Rate', value: `${dmfSummary?.successRate?.value ?? '—'}%` }] },
        { label: 'Success',     value: `${dmfSummary?.successRate?.value ?? '—'}%`,
          color: '#2e7d32', bg: '#e8f5e9',
          description: 'Percentage of DMF pipeline runs that completed successfully.',
          dialogStats: [{ label: 'Total Runs', value: dmfSummary?.totalRuns?.value ?? '—' }, { label: 'Failed', value: dmfSummary?.failedRuns?.value ?? '—' }] },
      ],
      alert: (dmfSummary?.failedRuns?.value ?? 0) > 50
        ? `⚠ ${dmfSummary.failedRuns.value} failed runs this week`
        : undefined,
    },
    {
      key: 'servicenow',
      prefKey: 'snapServiceNow',
      title: 'ServiceNow',
      accent: '#c62828',
      source: 'ITSM',
      kpis: [
        { label: 'Total Tickets', value: tickets.length, color: '#1565c0', bg: '#e3f2fd',
          description: 'Total number of ServiceNow incident tickets in the system.',
          dialogStats: [{ label: 'Open', value: openTickets }, { label: 'Resolved', value: tickets.length - openTickets }] },
        { label: 'Open',          value: openTickets,
          color: openTickets > 5 ? '#c62828' : '#2e7d32',  bg: openTickets > 5 ? '#fce4ec' : '#e8f5e9',
          description: 'Tickets currently open or in progress requiring action.',
          dialogStats: [{ label: 'P1', value: p1Tickets }, { label: 'SLA Breached', value: breachedSLAs }] },
        { label: 'SLA Breached',  value: breachedSLAs,
          color: breachedSLAs > 0 ? '#c62828' : '#2e7d32', bg: breachedSLAs > 0 ? '#fce4ec' : '#e8f5e9',
          description: 'Tickets that have exceeded their SLA target time.',
          dialogStats: [{ label: 'SLA Compliance', value: `${slaPct}%` }, { label: 'Open Tickets', value: openTickets }] },
        { label: 'P1 Incidents',  value: p1Tickets, color: '#c62828', bg: '#fce4ec',
          description: 'Critical Priority 1 incidents requiring immediate escalation.',
          dialogStats: [{ label: 'Total Open', value: openTickets }, { label: 'SLA Breached', value: breachedSLAs }] },
      ],
      alert: breachedSLAs > 0 ? `⚠ ${breachedSLAs} SLA breach${breachedSLAs > 1 ? 'es' : ''} need attention` : undefined,
    },
    {
      key: 'logs',
      prefKey: 'snapLogs',
      title: 'Talend',
      accent: '#e65100',
      source: 'Data Integration',
      kpis: [
        { label: 'Critical',    value: criticalErrors,
          color: criticalErrors > 0 ? '#c62828' : '#2e7d32', bg: criticalErrors > 0 ? '#fce4ec' : '#e8f5e9',
          description: 'CloudWatch critical severity errors active in the current window.',
          dialogStats: [{ label: 'High', value: highErrors }, { label: 'Total Errors', value: errors.length }] },
        { label: 'High Errors', value: highErrors,
          color: highErrors > 0 ? '#f57c00' : '#2e7d32',     bg: highErrors > 0 ? '#fff3e0' : '#e8f5e9',
          description: 'CloudWatch high severity errors that need investigation.',
          dialogStats: [{ label: 'Critical', value: criticalErrors }, { label: 'Total Errors', value: errors.length }] },
        { label: 'Budget Used', value: `${budgetPct}%`,
          color: budgetPct > 100 ? '#c62828' : '#2e7d32',  bg: budgetPct > 100 ? '#fce4ec' : '#e8f5e9',
          description: 'Snowflake and infrastructure cost as a percentage of budget.',
          dialogStats: [{ label: 'Total Spend', value: cost ? `$${(cost.total / 1000).toFixed(0)}K` : '—' }, { label: 'Budget', value: cost ? `$${(cost.budget / 1000).toFixed(0)}K` : '—' }] },
        { label: 'Total Spend', value: cost ? `$${(cost.total / 1000).toFixed(0)}K` : '—',
          color: '#1565c0', bg: '#e3f2fd',
          description: 'Total Snowflake compute and infrastructure spend this period.',
          dialogStats: [{ label: 'Budget', value: cost ? `$${(cost.budget / 1000).toFixed(0)}K` : '—' }, { label: 'Overage', value: cost ? `$${(cost.overage / 1000).toFixed(0)}K` : '—' }] },
      ],
      alert: criticalErrors > 0 ? `⚠ ${criticalErrors} critical error${criticalErrors > 1 ? 's' : ''} active` : undefined,
    },
    {
      key: 'pipeline',
      prefKey: 'snapPipeline',
      title: 'ESP',
      accent: '#2e7d32',
      source: 'Enterprise Data Platform',
      kpis: [
        { label: 'Total',    value: pipelines.length,  color: '#1565c0', bg: '#e3f2fd',
          description: 'Total number of data pipelines tracked in PostgreSQL.',
          dialogStats: [{ label: 'Healthy', value: healthyPipelines }, { label: 'At Risk', value: atRiskPipelines }] },
        { label: 'Healthy',  value: healthyPipelines,  color: '#2e7d32', bg: '#e8f5e9',
          description: 'Pipelines running within normal parameters with high success rates.',
          dialogStats: [{ label: 'Total', value: pipelines.length }, { label: 'At Risk', value: atRiskPipelines }] },
        { label: 'At Risk',  value: atRiskPipelines,   color: '#f57c00', bg: '#fff3e0',
          description: 'Pipelines showing degraded performance or elevated failure rates.',
          dialogStats: [{ label: 'Critical', value: criticalPipelines }, { label: 'Healthy', value: healthyPipelines }] },
        { label: 'Critical', value: criticalPipelines, color: '#c62828', bg: '#fce4ec',
          description: 'Pipelines in a critical state requiring immediate intervention.',
          dialogStats: [{ label: 'At Risk', value: atRiskPipelines }, { label: 'Total', value: pipelines.length }] },
      ],
      alert: criticalPipelines > 0 ? `⚠ ${criticalPipelines} pipeline${criticalPipelines > 1 ? 's' : ''} in critical state` : undefined,
    },
  ]

  // ── Pref toggle chip definitions ─────────────────────────
  const prefChips: { key: keyof OverviewPrefs; label: string }[] = [
    { key: 'kpiStrip',            label: 'KPI Strip'            },
    { key: 'operationalSnapshot', label: 'Operational Snapshot' },
    { key: 'dmfTrend',            label: 'DMF Trend'            },
    { key: 'snapDmf',             label: 'DMF'        },
    { key: 'snapServiceNow',      label: 'ServiceNow' },
    { key: 'snapLogs',            label: 'Talend'     },
    { key: 'snapPipeline',        label: 'ESP'        },
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
            <Typography sx={{ fontSize: '10px', color: '#bbb', ml: 'auto' }}>
              {prefChips.filter(c => prefs[c.key]).length}/{prefChips.length} widgets visible
            </Typography>
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
                        label: 'Pipeline Health',
                        value: healthyPipelines,
                        max: Math.max(pipelines.length, 1),
                        color: criticalPipelines > 0 ? '#c62828' : atRiskPipelines > 0 ? '#f57c00' : '#2e7d32',
                        sublabel: `${healthyPipelines} of ${pipelines.length} healthy`,
                      },
                      {
                        label: 'SLA Compliance',
                        value: slaPct,
                        suffix: '%',
                        color: slaPct < 90 ? '#c62828' : slaPct < 98 ? '#f57c00' : '#2e7d32',
                        max: 100,
                        sublabel: `ServiceNow · ${breachedSLAs} breach${breachedSLAs !== 1 ? 'es' : ''}`,
                      },
                      {
                        label: 'Error Pressure',
                        value: criticalErrors + highErrors,
                        max: Math.max(errors.length, 1),
                        color: criticalErrors > 0 ? '#c62828' : highErrors > 0 ? '#f57c00' : '#2e7d32',
                        sublabel: `CloudWatch · ${criticalErrors} critical, ${highErrors} high`,
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
                  {(criticalErrors > 0 || breachedSLAs > 0 || criticalPipelines > 0) && (
                    <AlertBanner
                      severity="warning"
                      title="Action required"
                      message={[
                        criticalErrors > 0    ? `${criticalErrors} critical CloudWatch error${criticalErrors > 1 ? 's' : ''}` : null,
                        breachedSLAs > 0      ? `${breachedSLAs} SLA breach${breachedSLAs > 1 ? 'es' : ''} in ServiceNow`    : null,
                        criticalPipelines > 0 ? `${criticalPipelines} pipeline${criticalPipelines > 1 ? 's' : ''} critical`   : null,
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

      {/* ── Empty state when all widgets hidden ── */}
      {!prefs.kpiStrip && !prefs.operationalSnapshot && !prefs.dmfTrend && visibleSnapshots.length === 0 && (
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
}

export const ExecutiveDashboard: React.FC<ExecutiveDashboardProps> = ({ onChatClick }) => {
  const [source, setSource] = useState<SourceKey>('pipeline')
  const active = SOURCES.find(s => s.key === source)!

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* ── Fixed header ── */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#1a2535', px: 3, py: 1.5, flexShrink: 0 }}>
        <Box>
          <Typography sx={{ color: '#fff', fontWeight: 700, fontSize: '18px', lineHeight: 1.2 }}>
            Executive DataOps Dashboard
          </Typography>
          <Typography sx={{ color: '#90a4ae', fontSize: '12px' }}>
            {active.label} — {active.sub}
          </Typography>
        </Box>
        <Button
          onClick={onChatClick}
          variant="contained"
          size="small"
          startIcon={<SmartToyIcon />}
          sx={{ backgroundColor: '#1976d2', textTransform: 'none', '&:hover': { backgroundColor: '#1565c0' } }}
        >
          Ask DataOps Agent
        </Button>
      </Box>

      {/* ── Source selector tabs ── */}
      <Box sx={{ display: 'flex', backgroundColor: '#263548', px: 2, flexShrink: 0, borderBottom: '1px solid #1a2535' }}>
        {SOURCES.map(src => {
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
        {source === 'dmf'        && <DMFPipelineWidget />}
        {source === 'servicenow' && (
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, p: 2, alignItems: 'start' }}>
            <TicketsWidget />
            <IncidentsWidget />
          </Box>
        )}
        {source === 'logs' && <TalendDashboardTab />}
        {source === 'pipeline' && <ESPDashboardTab />}
        </Box>

s
    </Box>  )
} 
