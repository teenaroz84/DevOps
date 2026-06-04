import React, { useState, useEffect, useMemo } from 'react'
import { Box, Typography, Chip, Paper, TextField, InputAdornment, Autocomplete, CircularProgress, TablePagination, Slider, Tooltip } from '@mui/material'
import BugReportIcon from '@mui/icons-material/BugReport'
import SearchIcon from '@mui/icons-material/Search'
import ConfirmationNumberIcon from '@mui/icons-material/ConfirmationNumber'
import StreamIcon from '@mui/icons-material/Stream'
import AttachMoneyIcon from '@mui/icons-material/AttachMoney'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import PipelineIcon from '@mui/icons-material/AccountTree'
import BuildCircleIcon from '@mui/icons-material/BuildCircle'
import { DrillDownModal, DrillDownData } from './DrillDownModal'
import { WidgetShell, StatCardGrid, MetricBarList, DataTable, ColumnDef } from '../widgets'
import { cloudwatchService, servicenowService, snowflakeService, postgresService, espService } from '../../services'
import type { ServiceNowDaysFilter } from '../../services/servicenowService'
import { DonutChart, ComposedBarLineChart } from '../widgets'
import { useMockData } from '../../context/MockDataContext'
import { APP_COLORS, CHART_PALETTE, TRUIST } from '../../theme/truistPalette'
import {
  MOCK_SERVICENOW_TICKETS,
  MOCK_SERVICENOW_INCIDENTS,
  MOCK_SERVICENOW_CLOSED_INCIDENTS,
  MOCK_SERVICENOW_MISSED_INCIDENTS,
  MOCK_SERVICENOW_INCIDENT_LIST,
  MOCK_SERVICENOW_EMERGENCY_CHANGES,
  MOCK_SERVICENOW_OPENED_CHANGES,
  MOCK_SERVICENOW_CLOSED_CHANGES,
  MOCK_SERVICENOW_CHANGES_BY_PLATFORM,
  MOCK_SERVICENOW_PLATFORMS,
  MOCK_SERVICENOW_BY_CAPABILITY,
  MOCK_SERVICENOW_BY_ASSIGNMENT_GROUP,
  MOCK_SERVICENOW_BY_PLATFORM,
  MOCK_SERVICENOW_INCIDENT_STATE_DAILY,
  MOCK_SERVICENOW_INCIDENT_TREND,
} from '../../services/servicenowMockData'
import { ServiceNowIncidentsOverview } from './ServiceNowIncidentsOverview'

/** Small clickable info icon for widget headers — shows a tooltip explaining the widget's data scope */
const WidgetInfo: React.FC<{ text: string }> = ({ text }) => (
  <Tooltip
    title={<Typography sx={{ fontSize: '11px', lineHeight: 1.5, maxWidth: 280 }}>{text}</Typography>}
    arrow
    placement="left"
    enterTouchDelay={0}
  >
    <InfoOutlinedIcon sx={{ fontSize: 14, color: '#90a4ae', cursor: 'help', '&:hover': { color: '#1976d2' } }} />
  </Tooltip>
)

const SEV_CONFIG: Record<string, { color: string; bg: string; dot: string }> = {
  critical: { color: '#c62828', bg: '#fce4ec', dot: '#e53935' },
  high:     { color: '#e65100', bg: '#fff3e0', dot: '#fb8c00' },
  medium:   { color: '#f57c00', bg: '#fff8e1', dot: '#fdd835' },
  low:      { color: '#2e7d32', bg: '#e8f5e9', dot: '#66bb6a' },
}

const fmt = (iso: string) =>
  new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })

// ─── Errors Widget ─────────────────────────────────────────

export const ErrorsWidget: React.FC = () => {
  const [errors, setErrors] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [drillDown, setDrillDown] = useState<DrillDownData | null>(null)

  useEffect(() => {
    cloudwatchService.getErrors()
      .then(d => { setErrors(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const summary = {
    critical: errors.filter(e => e.severity === 'critical').length,
    high:     errors.filter(e => e.severity === 'high').length,
    medium:   errors.filter(e => e.severity === 'medium').length,
    low:      errors.filter(e => e.severity === 'low').length,
  }

  const columns: ColumnDef[] = [
    {
      key: 'id', header: 'ID / Count', width: 100,
      render: row => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Typography sx={{ fontSize: '11px', fontWeight: 700, color: '#555' }}>{row.id}</Typography>
          <Chip label={`×${row.count}`} size="small" sx={{ height: 14, fontSize: '10px', backgroundColor: '#f5f5f5' }} />
        </Box>
      ),
    },
    {
      key: 'message', header: 'Message', flex: 1,
      render: row => (
        <Box>
          <Typography sx={{ fontSize: '12px', color: '#222', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.message}</Typography>
          <Typography sx={{ fontSize: '10px', color: '#aaa' }}>{row.service} · {fmt(row.lastSeen)}</Typography>
        </Box>
      ),
    },
    {
      key: 'severity', header: 'Sev', width: 72, align: 'right',
      render: row => (
        <Chip label={row.severity} size="small"
          sx={{ fontSize: '10px', height: 20, ...SEV_CONFIG[row.severity] }} />
      ),
    },
  ]

  return (
    <>
      <WidgetShell
        title="Error Monitor"
        titleIcon={<BugReportIcon sx={{ color: TRUIST.charcoal, fontSize: 18 }} />}
        source="CloudWatch"
        loading={loading}
        subheader={
          !loading ? (
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 0.5, px: 1.5, py: 1 }}>
              {Object.entries(summary).map(([sev, count]) => (
                <Box key={sev} sx={{ textAlign: 'center', backgroundColor: SEV_CONFIG[sev].bg, borderRadius: 1, py: 0.6 }}>
                  <Typography sx={{ fontSize: '18px', fontWeight: 700, color: SEV_CONFIG[sev].color }}>{count}</Typography>
                  <Typography sx={{ fontSize: '10px', color: SEV_CONFIG[sev].color, textTransform: 'capitalize' }}>{sev}</Typography>
                </Box>
              ))}
            </Box>
          ) : undefined
        }
      >
        <Box sx={{ flex: 1, overflowY: 'auto', px: 1.5, pb: 1 }}>
          <DataTable
            columns={columns}
            rows={errors}
            onRowClick={row => setDrillDown({ type: 'error', data: row })}
            rowKey="id"
            compact
            accentColor={TRUIST.charcoal}
            rowTooltip="Click to view stack trace & resolution"
          />
        </Box>
      </WidgetShell>
      <DrillDownModal open={!!drillDown} onClose={() => setDrillDown(null)} drillDown={drillDown} />
    </>
  )
}

// ─── Tickets Widget ────────────────────────────────────────

const PRIORITY_CONFIG: Record<string, { color: string; bg: string }> = {
  P1: { color: '#c62828', bg: '#fce4ec' },
  P2: { color: '#e65100', bg: '#fff3e0' },
  P3: { color: '#2e7d32', bg: '#e8f5e9' },
  P4: { color: '#1565c0', bg: '#e3f2fd' },
  P5: { color: '#757575', bg: '#f5f5f5' },
}
const STATUS_CONFIG: Record<string, { color: string; bg: string }> = {
  open:        { color: '#f57c00', bg: '#fff8e1' },
  in_progress: { color: '#1565c0', bg: '#e3f2fd' },
  resolved:    { color: '#2e7d32', bg: '#e8f5e9' },
}

export const TicketsWidget: React.FC = () => {
  const [tickets, setTickets] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [drillDown, setDrillDown] = useState<DrillDownData | null>(null)
  const { useMock } = useMockData()

  useEffect(() => {
    setLoading(true)
    setTickets([])
    if (useMock) {
      setTickets(MOCK_SERVICENOW_TICKETS)
      setLoading(false)
      return
    }
    servicenowService.getTickets()
      .then(d => { setTickets(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [useMock])

  const open = tickets.filter(t => t.status !== 'resolved').length
  const breached = tickets.filter(t => t.sla?.breached).length

  const summaryCards = [
    { label: 'Open',     value: open,           color: '#f57c00', bg: '#fff8e1' },
    { label: 'Breached', value: breached,        color: '#c62828', bg: '#fce4ec' },
    { label: 'Total',    value: tickets.length,  color: '#1565c0', bg: '#e3f2fd' },
  ]

  const columns: ColumnDef[] = [
    {
      key: 'badges', header: 'Priority / Status', width: 160,
      render: row => (
        <Box sx={{ display: 'flex', gap: 0.4, flexWrap: 'wrap' }}>
          <Chip label={row.priority} size="small" sx={{ height: 18, fontSize: '10px', fontWeight: 700, ...PRIORITY_CONFIG[row.priority] }} />
          <Chip label={row.status.replace('_', ' ')} size="small" sx={{ height: 18, fontSize: '10px', ...STATUS_CONFIG[row.status] }} />
          {row.sla?.breached && <Chip label="SLA ⚠" size="small" sx={{ height: 18, fontSize: '10px', backgroundColor: '#fce4ec', color: '#c62828' }} />}
        </Box>
      ),
    },
    {
      key: 'title', header: 'Ticket', flex: 1,
      render: row => (
        <Box>
          <Typography sx={{ fontSize: '12px', color: '#222', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.title}</Typography>
          <Typography sx={{ fontSize: '10px', color: '#999' }}>{row.assignee} · {row.affectedService}</Typography>
        </Box>
      ),
    },
    { key: 'id', header: 'ID', width: 65, render: row => <Typography sx={{ fontSize: '10px', color: '#aaa' }}>{row.id}</Typography> },
  ]

  return (
    <>
      <WidgetShell
        title="Support Tickets"
        titleIcon={<ConfirmationNumberIcon sx={{ color: TRUIST.purple, fontSize: 18 }} />}
        source="ServiceNow"
        loading={loading}
        subheader={
          !loading ? (
            <Box sx={{ px: 1.5, py: 1 }}>
              <StatCardGrid items={summaryCards} columns={3} compact />
            </Box>
          ) : undefined
        }
      >
        <Box sx={{ flex: 1, overflowY: 'auto', px: 1.5, pb: 1 }}>
          <DataTable
            columns={columns}
            rows={tickets}
            onRowClick={row => setDrillDown({ type: 'ticket', data: row })}
            rowKey="id"
            compact
            accentColor={TRUIST.purple}
            rowTooltip="Click to view ticket details & activity"
          />
        </Box>
      </WidgetShell>
      <DrillDownModal open={!!drillDown} onClose={() => setDrillDown(null)} drillDown={drillDown} />
    </>
  )
}

// ─── Log Stream Widget ─────────────────────────────────────

const LOG_COLORS: Record<string, string> = {
  ERROR: '#e53935', WARN: '#fb8c00', INFO: '#43a047',
}

export const LogStreamWidget: React.FC = () => {
  const [logs, setLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('ALL')

  useEffect(() => {
    cloudwatchService.getLogs()
      .then(d => { setLogs(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const displayed = filter === 'ALL' ? logs : logs.filter(l => l.level === filter)

  return (
    <WidgetShell
      title="Live Logs"
      titleIcon={<StreamIcon sx={{ color: APP_COLORS.primary, fontSize: 18 }} />}
      source="CloudWatch"
      loading={loading}
      subheader={
        <Box sx={{ display: 'flex', gap: 0.5, px: 1.5, py: 0.8 }}>
          {['ALL', 'ERROR', 'WARN', 'INFO'].map(f => (
            <Chip key={f} label={f} size="small" onClick={() => setFilter(f)}
              sx={{
                fontSize: '10px', height: 20, cursor: 'pointer',
                backgroundColor: filter === f ? (LOG_COLORS[f] || APP_COLORS.primary) : '#f0f0f0',
                color: filter === f ? '#fff' : '#555',
                fontWeight: filter === f ? 700 : 400,
              }} />
          ))}
        </Box>
      }
    >
      <Box sx={{ flex: 1, overflowY: 'auto', backgroundColor: '#0d1117', borderRadius: '0 0 4px 4px', p: 1 }}>
        {displayed.map(log => (
          <Box key={log.id} sx={{ display: 'flex', gap: 1, py: 0.3, borderBottom: '1px solid rgba(255,255,255,0.04)', alignItems: 'flex-start' }}>
            <Typography sx={{ fontSize: '10px', color: '#555', flexShrink: 0, mt: 0.1, minWidth: 90 }}>
              {new Date(log.ts).toLocaleTimeString()}
            </Typography>
            <Typography sx={{ fontSize: '10px', fontWeight: 700, color: LOG_COLORS[log.level] || '#aaa', flexShrink: 0, minWidth: 38 }}>
              {log.level}
            </Typography>
            <Typography sx={{ fontSize: '10px', color: '#4fc3f7', flexShrink: 0, minWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {log.service}
            </Typography>
            <Typography sx={{ fontSize: '10px', color: '#ccc', lineHeight: 1.4 }}>
              {log.message}
            </Typography>
          </Box>
        ))}
      </Box>
    </WidgetShell>
  )
}

// ─── Cost Widget ───────────────────────────────────────────

export const CostWidget: React.FC = () => {
  const [cost, setCost] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    snowflakeService.getCost()
      .then(d => { setCost(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const overPercent = cost ? Math.round((cost.total / cost.budget) * 100) : 0

  const summaryCards = cost ? [
    { label: 'Actual',  value: `$${(cost.total / 1000).toFixed(0)}K`,   color: '#c62828', bg: '#fce4ec' },
    { label: 'Budget',  value: `$${(cost.budget / 1000).toFixed(0)}K`,  color: '#1565c0', bg: '#e3f2fd' },
    { label: 'Overage', value: `$${(cost.overage / 1000).toFixed(0)}K`, color: '#e65100', bg: '#fff3e0' },
  ] : []

  const serviceItems = cost
    ? (expanded ? cost.byService : cost.byService.slice(0, 4)).map((s: any) => ({
        label: s.service,
        value: Math.round(s.cost / 1000),
        max: Math.round(cost.budget / 1000 / 2),
        suffix: 'K',
        color: '#1976d2',
        right: (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.3 }}>
            <TrendingUpIcon sx={{ fontSize: 12, color: s.change.startsWith('+') ? '#e53935' : '#43a047' }} />
            <Typography sx={{ fontSize: '11px', color: s.change.startsWith('+') ? '#e53935' : '#43a047', fontWeight: 600 }}>
              {s.change}
            </Typography>
          </Box>
        ),
      }))
    : []

  return (
    <WidgetShell
      title="Cost vs Budget"
      titleIcon={<AttachMoneyIcon sx={{ color: TRUIST.purple, fontSize: 18 }} />}
      source="Snowflake"
      loading={loading}
    >
      {cost && (
        <>
          <Box sx={{ px: 1.5, pt: 1 }}>
            <StatCardGrid items={summaryCards} columns={3} compact />
          </Box>

          {/* Budget utilization bar */}
          <Box sx={{ px: 1.5, py: 1 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.3 }}>
              <Typography sx={{ fontSize: '11px', color: '#666' }}>Budget utilization</Typography>
              <Typography sx={{ fontSize: '11px', fontWeight: 700, color: overPercent > 100 ? '#c62828' : '#2e7d32' }}>
                {overPercent}%
              </Typography>
            </Box>
            <Box sx={{ height: 8, backgroundColor: '#e0e0e0', borderRadius: 4, overflow: 'hidden' }}>
              <Box sx={{
                height: '100%', width: `${Math.min(overPercent, 100)}%`,
                background: overPercent > 110 ? 'linear-gradient(90deg, #f44336, #e91e63)'
                          : overPercent > 100 ? 'linear-gradient(90deg, #ff9800, #f44336)'
                          : 'linear-gradient(90deg, #4caf50, #66bb6a)',
                transition: 'width 0.5s ease', borderRadius: 4,
              }} />
            </Box>
          </Box>

          {/* Top services */}
          <Box sx={{ flex: 1, overflowY: 'auto', px: 1.5, pb: 1 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
              <Typography sx={{ fontSize: '11px', fontWeight: 700, color: '#666' }}>Top Services</Typography>
              <Typography onClick={() => setExpanded(!expanded)}
                sx={{ fontSize: '11px', color: '#1976d2', cursor: 'pointer' }}>
                {expanded ? 'Show less' : 'Show all'}
              </Typography>
            </Box>
            <MetricBarList items={serviceItems} barHeight={5} compact />
          </Box>
        </>
      )}
    </WidgetShell>
  )
}

// ─── ESP Jobs Widget ───────────────────────────────────────

import WorkIcon from '@mui/icons-material/Work'

export const ESPJobsWidget: React.FC = () => {
  const [jobsSummary, setJobsSummary] = useState<any[]>([])
  const [applications, setApplications] = useState<any[]>([])
  const [specialJobs, setSpecialJobs] = useState<any[]>([])
  const [pipelines, setPipelines] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([
      espService.getJobCounts(),
      espService.getApplications(),
      espService.getSpecialJobs(),
      postgresService.getPipelines(),
    ])
      .then(([jobCounts, apps, splJobs, pgData]) => {
        setJobsSummary(jobCounts?.jobs_summary || [])
        setApplications(apps?.applications || [])
        setSpecialJobs(splJobs?.spl_jobs || [])
        setPipelines(Array.isArray(pgData) ? pgData : [])
        setLoading(false)
      })
      .catch(err => { setError(err.message || 'Failed to fetch data'); setLoading(false) })
  }, [])

  const totalJobs = jobsSummary.reduce((sum, j) => sum + (j.total_jobs || 0), 0)
  const healthyPipelines = pipelines.filter(p => p.status === 'healthy').length
  const atRiskPipelines = pipelines.filter(p => p.status === 'at_risk').length
  const criticalPipelines = pipelines.filter(p => p.status === 'critical').length

  return (
    <WidgetShell
      title="ESP Jobs & Pipelines"
      titleIcon={<WorkIcon sx={{ color: TRUIST.dusk, fontSize: 18 }} />}
      source="PostgreSQL · esp_job_cmnd | pipelines"
      loading={loading}
      error={error ?? undefined}
    >
      {!error && (
        <>
          <Box sx={{ px: 1.5, py: 1 }}>
            <StatCardGrid
              items={[
                { label: 'Applications', value: applications.length, color: '#1565c0', bg: '#e3f2fd' },
                { label: 'Total Jobs', value: totalJobs.toLocaleString(), color: '#2e7d32', bg: '#e8f5e9' },
                { label: 'Special Jobs', value: specialJobs.reduce((sum, j) => sum + (j.spl_jobs || 0), 0), color: '#f57c00', bg: '#fff8e1' },
                { label: 'Pipelines', value: pipelines.length, color: '#6a1b9a', bg: '#f3e5f5' },
                { label: 'Healthy', value: healthyPipelines, color: '#2e7d32', bg: '#e8f5e9' },
                { label: 'At Risk', value: atRiskPipelines, color: '#f57c00', bg: '#fff8e1' },
                { label: 'Critical', value: criticalPipelines, color: '#c62828', bg: '#fce4ec' },
              ]}
              columns={3}
              compact
            />
          </Box>
          <Box sx={{ flex: 1, overflowY: 'auto', px: 1.5, pb: 1 }}>
            <MetricBarList
              items={jobsSummary.slice(0, 15).map(j => ({
                label: j.appl_name || 'Unknown',
                value: j.total_jobs || 0,
                max: Math.max(jobsSummary[0]?.total_jobs || 1, 1),
                color: '#2e7d32',
                suffix: ' jobs',
              }))}
              barHeight={6}
              compact
            />
          </Box>
        </>
      )}
    </WidgetShell>
  )
}

// ─── ESP Job List Widget ────────────────────────────────
export const JobListWidget: React.FC = () => {
  const [jobList, setJobList] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    espService.getJobList()
      .then(res => {
        setJobList(res?.job_lists || [])
        setLoading(false)
      })
      .catch(err => { setError(err.message || 'Failed to fetch job list'); setLoading(false) })
  }, [])

  const columns: ColumnDef[] = [
    { key: 'appl_name', header: 'Application', flex: 1 },
    { key: 'last_run_date', header: 'Last Run Date', flex: 1, render: row => row.last_run_date ? fmt(row.last_run_date) : '—' },
  ]

  return (
    <WidgetShell
      title="ESP Job List"
      titleIcon={<WorkIcon sx={{ color: '#1976d2', fontSize: 18 }} />}
      source="PostgreSQL · esp_job_cmnd"
      loading={loading}
      error={error ?? undefined}
    >
      <Box sx={{ flex: 1, overflowY: 'auto', px: 1.5, pb: 1 }}>
        <DataTable
          columns={columns}
          rows={jobList}
          rowKey="appl_name"
          compact
          accentColor="#1976d2"
          rowTooltip="Application job last run date"
        />
      </Box>
    </WidgetShell>
  )
}

// ─── Incidents Widget (DB-backed) ──────────────────────────

import WarningAmberIcon from '@mui/icons-material/WarningAmber'

const INCIDENT_COLORS: Record<string, string> = {
  P1: '#c62828',
  P2: '#e65100',
  P3: '#2e7d32',
  P4: '#1565c0',
  P5: '#757575',
}

export const IncidentsWidget: React.FC<{ platform?: string | null }> = ({ platform }) => {
  const [incidents, setIncidents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { useMock } = useMockData()

  useEffect(() => {
    setLoading(true)
    setIncidents([])
    setError(null)
    if (useMock) {
      setIncidents(MOCK_SERVICENOW_INCIDENTS)
      setLoading(false)
      return
    }
    servicenowService.getIncidents(platform ?? undefined)
      .then(d => { setIncidents(Array.isArray(d) ? d : []); setLoading(false) })
      .catch(err => { setError(err.message || 'Failed to fetch incidents'); setLoading(false) })
  }, [useMock, platform])

  const totalIncidents = incidents.reduce((sum, i) => sum + (i.incident_count || 0), 0)

  const donutData = incidents.map(i => ({
    name: i.priority_field || 'Unknown',
    value: i.incident_count || 0,
    color: INCIDENT_COLORS[i.priority_field] || '#757575',
  }))

  return (
    <>
      <WidgetShell
        title="Current Open Incidents"
        titleIcon={<WarningAmberIcon sx={{ color: '#c62828', fontSize: 18 }} />}
        source="edoops.service_now_inc . All Open . All time"
        actions={<WidgetInfo text="Shows the count of currently open incidents grouped by priority (P1–P5). Filters only active incidents using state — closed, resolved, and cancelled are excluded. The days slider does not affect this widget. Count always reflects the live open state." />}
        loading={loading}
        error={error ?? undefined}
      >
        {!error && (
          <>
            <Box sx={{ px: 1.5, py: 1 }}>
              <StatCardGrid
                items={[
                  ...incidents.map(i => ({
                    label: i.priority_field || 'Unknown',
                    value: i.incident_count || 0,
                    color: INCIDENT_COLORS[i.priority_field] || '#757575',
                    bg: PRIORITY_CONFIG[i.priority_field]?.bg || '#f5f5f5',
                  })),
                  { label: 'Total', value: totalIncidents, color: '#1565c0', bg: '#e3f2fd' },
                ]}
                columns={Math.min(incidents.length + 1, 6)}
                compact
              />
            </Box>
            {donutData.length > 0 && (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 1 }}>
                <DonutChart
                  data={donutData}
                  centerLabel={totalIncidents}
                  showLegend
                  size={140}
                />
              </Box>
            )}
          </>
        )}
      </WidgetShell>
      {/* DrillDownModal disabled — incident data under review */}
    </>
  )
}

export const IncidentKpiWidget: React.FC<{ platform?: string | null; days?: ServiceNowDaysFilter }> = ({ platform, days = 7 }) => {
  const [openIncidents, setOpenIncidents] = useState<any[]>([])
  const [closedIncidents, setClosedIncidents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { useMock } = useMockData()

  useEffect(() => {
    setLoading(true)
    setOpenIncidents([])
    setClosedIncidents([])
    setError(null)
    if (useMock) {
      setOpenIncidents(MOCK_SERVICENOW_INCIDENTS)
      setClosedIncidents(MOCK_SERVICENOW_CLOSED_INCIDENTS)
      setLoading(false)
      return
    }
    Promise.all([
      servicenowService.getIncidents(platform ?? undefined),
      servicenowService.getClosedIncidents(platform ?? undefined, days),
    ])
      .then(([openData, closedData]) => {
        setOpenIncidents(Array.isArray(openData) ? openData : [])
        setClosedIncidents(Array.isArray(closedData) ? closedData : [])
        setLoading(false)
      })
      .catch(err => { setError(err.message || 'Failed to fetch incident KPIs'); setLoading(false) })
  }, [days, useMock, platform])

  const orderedPriorities = ['P1', 'P2', 'P3', 'P4', 'P5']
  const openByPriority = new Map(openIncidents.map((row) => [row.priority_field, row]))
  const closedByPriority = new Map(closedIncidents.map((row) => [row.priority_field, row]))

  const openItems = orderedPriorities.map((priority) => {
    const row = openByPriority.get(priority)
    return {
      label: priority,
      value: row?.incident_count || 0,
      color: INCIDENT_COLORS[priority] || '#757575',
      bg: PRIORITY_CONFIG[priority]?.bg || '#f5f5f5',
    }
  })

  const closedItems = orderedPriorities.map((priority) => {
    const row = closedByPriority.get(priority)
    return {
      label: priority,
      value: row?.incident_count || 0,
      color: INCIDENT_COLORS[priority] || '#757575',
      bg: PRIORITY_CONFIG[priority]?.bg || '#f5f5f5',
    }
  })

  const openTotal = openItems.reduce((sum, item) => sum + Number(item.value || 0), 0)
  const closedTotal = closedItems.reduce((sum, item) => sum + Number(item.value || 0), 0)

  return (
    <WidgetShell
      title="Incident KPIs"
      titleIcon={<WarningAmberIcon sx={{ color: '#c62828', fontSize: 18 }} />}
      source={`edoops.service_now_inc . open = latest current state . closed = ${days === 'all' ? 'all time' : `last ${days}d`}`}
      actions={<WidgetInfo text={`Shows one record per incident using the latest updated state. Open incidents on the left always reflect the current open population. Closed incidents on the right are filtered to ${days === 'all' ? 'all available time' : `the last ${days} days`} based on closed/resolved/latest update time.`} />}
      loading={loading}
      error={error ?? undefined}
    >
      {!error && (
        <Box sx={{ px: 1.5, py: 1.25, display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
          <Box sx={{ border: '1px solid #fde0dc', borderRadius: 2, backgroundColor: '#fff8f7', p: 1.25 }}>
            <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', mb: 1 }}>
              <Typography sx={{ fontSize: '13px', fontWeight: 700, color: '#b71c1c', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                Open Incidents
              </Typography>
              <Typography sx={{ fontSize: '22px', fontWeight: 800, color: '#c62828' }}>{openTotal}</Typography>
            </Box>
            <StatCardGrid
              items={openItems}
              columns={5}
              compact
            />
          </Box>
          <Box sx={{ border: '1px solid #dcedc8', borderRadius: 2, backgroundColor: '#f7fbf1', p: 1.25 }}>
            <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', mb: 1 }}>
              <Typography sx={{ fontSize: '13px', fontWeight: 700, color: '#2e7d32', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                Closed Incidents
              </Typography>
              <Typography sx={{ fontSize: '22px', fontWeight: 800, color: '#2e7d32' }}>{closedTotal}</Typography>
            </Box>
            <StatCardGrid
              items={closedItems}
              columns={5}
              compact
            />
          </Box>
        </Box>
      )}
    </WidgetShell>
  )
}

// ─── Top Incident SLA Widget (bar chart) ──────────────────

export const MissedIncidentsWidget: React.FC<{ platform?: string | null; days?: ServiceNowDaysFilter }> = ({ platform, days = 7 }) => {
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { useMock } = useMockData()

  useEffect(() => {
    setLoading(true); setData([]); setError(null)
    if (useMock) {
      setData(MOCK_SERVICENOW_MISSED_INCIDENTS)
      setLoading(false)
      return
    }
    servicenowService.getMissedIncidents(platform ?? undefined, days)
      .then(d => { setData(Array.isArray(d) ? d : []); setLoading(false) })
      .catch(err => { setError(err.message || 'Failed to fetch'); setLoading(false) })
  }, [useMock, platform, days])

  const total = data.reduce((s, r) => s + (r.incident_count || 0), 0)
  const maxCount = Math.max(...data.map(r => r.incident_count || 0), 1)

  return (
    <>
      <WidgetShell
        title="Top Incidents by SLA"
        titleIcon={<WarningAmberIcon sx={{ color: TRUIST.darkGray, fontSize: 18 }} />}
        source={`edoops.service_now_inc · ${days === 'all' ? 'opened across all time' : `opened in last ${days}d`}`}
        actions={<WidgetInfo text={`Shows all incidents ${days === 'all' ? 'opened across all available time' : `opened in the last ${days} days`}, grouped by priority with SLA breach status. The SLA breach is calculated from the incident's opened date vs. the resolution SLA target for that priority. Use the preset controls to change the opened date window.`} />}
        loading={loading}
        error={error ?? undefined}
      >
        {!error && (
          <>
            <Box sx={{ px: 1.5, py: 1 }}>
              <StatCardGrid
                items={[
                  ...data.map(r => ({
                    label: r.priority_field || 'Unknown',
                    value: r.incident_count || 0,
                    color: INCIDENT_COLORS[r.priority_field] || '#757575',
                    bg: PRIORITY_CONFIG[r.priority_field]?.bg || '#f5f5f5',
                  })),
                  { label: 'Total', value: total, color: '#1565c0', bg: '#e3f2fd' },
                ]}
                columns={3}
                compact
              />
            </Box>
            <Box sx={{ px: 2, pb: 1.5, display: 'flex', flexDirection: 'column', gap: 1 }}>
              {data.map(r => {
                const pct = Math.round(((r.incident_count || 0) / maxCount) * 100)
                const color = INCIDENT_COLORS[r.priority_field] || '#757575'
                return (
                  <Box key={r.priority_field}
                    sx={{ borderRadius: 1, p: 0.5 }}
                  >
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.4 }}>
                      <Typography sx={{ fontSize: '12px', fontWeight: 600, color: '#333' }}>{r.priority_field}</Typography>
                      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                        {(r.breached_count || 0) > 0 && (
                          <Chip label={`⚠ ${r.breached_count} Breach`} size="small" sx={{ fontSize: '9px', height: 18, bgcolor: '#ffebee', color: '#c62828', fontWeight: 700 }} />
                        )}
                        <Typography sx={{ fontSize: '12px', color: '#666' }}>{r.incident_count}</Typography>
                      </Box>
                    </Box>
                    <Typography sx={{ fontSize: '10px', color: '#78909c', mb: 0.4 }}>
                      Response SLA: {r.response_sla || '—'} | Resolution SLA: {r.resolution_sla || '—'}
                    </Typography>
                    <Box sx={{ height: 8, backgroundColor: '#f0f0f0', borderRadius: 4, overflow: 'hidden' }}>
                      <Box sx={{ height: '100%', width: `${pct}%`, backgroundColor: color, borderRadius: 4, transition: 'width 0.4s ease' }} />
                    </Box>
                  </Box>
                )
              })}
            </Box>
          </>
        )}
      </WidgetShell>
      {/* DrillDownModal disabled — incident data under review */}
    </>
  )
}

// ─── Incident List Widget (P3/P4 detailed records) ────────

export const IncidentListWidget: React.FC<{ platform?: string | null; days?: ServiceNowDaysFilter; tableMaxHeight?: number }> = ({ platform, days = 7, tableMaxHeight = 360 }) => {
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [priorityFilter, setPriorityFilter] = useState('All')
  const [statusFilter, setStatusFilter] = useState('All')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const rowsPerPage = 100
  const { useMock } = useMockData()

  const normalizeIncidentState = (state?: string | null) => (state || '').trim().toLowerCase().replace(/\s+/g, ' ')
  const getIncidentStatusGroup = (state?: string | null) => {
    const normalized = normalizeIncidentState(state)
     if (['new', 'open'].includes(normalized)) return 'New'
    if (normalized === 'in progress') return 'In Progress'
    if (['on hold', 'onhold'].includes(normalized)) return 'On Hold'
    if (['closed', 'resolved', 'canceled', 'cancelled'].includes(normalized)) return 'Resolved/Closed/Canceled'
    return 'Open'
  }
  const getIncidentStatusRank = (state?: string | null) => {
    const statusGroup = getIncidentStatusGroup(state)
    if (statusGroup === 'New') return 0
    if (statusGroup === 'In Progress') return 1
    if (statusGroup === 'On Hold') return 3
    return 2
  }
  const getIncidentStateRank = (state?: string | null) => {
    const normalized = normalizeIncidentState(state)
    if (normalized === 'new') return 0
    if (normalized === 'in progress') return 1
    if (normalized === 'on hold' || normalized === 'onhold') return 3
    if (['resolved', 'closed', 'canceled', 'cancelled'].includes(normalized)) return 2
    return 4
  }
  const statusFilterOptions = ['All', 'New', 'In Progress', 'Resolved/Closed/Canceled', 'On Hold']
  const formatOpenedAt = (value?: string | null) => {
    if (!value) return '—'
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return value
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(date)
  }
  const getOpenedAtTime = (value?: string | null) => {
    if (!value) return 0
    const time = new Date(value).getTime()
    return Number.isNaN(time) ? 0 : time
  }

  useEffect(() => {
    setLoading(true); setData([]); setError(null)
    if (useMock) {
      setData(MOCK_SERVICENOW_INCIDENT_LIST)
      setLoading(false)
      return
    }
    servicenowService.getIncidentList(platform ?? undefined, days)
      .then(d => { setData(Array.isArray(d) ? d : []); setLoading(false) })
      .catch(err => { setError(err.message || 'Failed to fetch'); setLoading(false) })
  }, [useMock, platform, days])

  const filtered = useMemo(() =>
    data
      .filter(r => priorityFilter === 'All' || r.priority_field === priorityFilter)
      .filter(r => statusFilter === 'All' || getIncidentStatusGroup(r.sninc_state) === statusFilter)
      .filter(r => !search || [
        r.sninc_inc_num, r.sninc_capability, r.sninc_short_desc, r.sninc_assignment_grp, r.sninc_opened_at
      ].some(v => String(v || '').toLowerCase().includes(search.toLowerCase())))
      .sort((a, b) => {
        const rankDifference = getIncidentStatusRank(a.sninc_state) - getIncidentStatusRank(b.sninc_state)
        if (rankDifference !== 0) return rankDifference

        const stateDifference = getIncidentStateRank(a.sninc_state) - getIncidentStateRank(b.sninc_state)
        if (stateDifference !== 0) return stateDifference

        const stateLabelDifference = normalizeIncidentState(a.sninc_state).localeCompare(normalizeIncidentState(b.sninc_state))
        if (stateLabelDifference !== 0) return stateLabelDifference

        return getOpenedAtTime(b.sninc_opened_at) - getOpenedAtTime(a.sninc_opened_at)
      }),
  [data, priorityFilter, statusFilter, search])

  // Reset to first page whenever filters change
  const handlePriorityChange = (p: string) => { setPriorityFilter(p); setPage(0) }
  const handleStatusChange = (status: string) => { setStatusFilter(status); setPage(0) }
  const handleSearchChange = (val: string) => { setSearch(val); setPage(0) }

  const paginated = filtered.slice(page * rowsPerPage, (page + 1) * rowsPerPage)

  const incidentColumns: ColumnDef[] = [
    {
      key: 'sninc_inc_num', header: 'Incident #', width: 100,
      render: row => <Typography sx={{ fontSize: '11px', fontWeight: 700, color: '#1976d2', fontFamily: 'monospace' }}>{row.sninc_inc_num || '—'}</Typography>,
    },
    {
      key: 'priority_field', header: 'Priority', width: 75,
      render: row => (
        <Chip label={row.priority_field} size="small"
          sx={{ height: 20, fontSize: '10px', fontWeight: 700,
            color: INCIDENT_COLORS[row.priority_field] || '#555',
            backgroundColor: PRIORITY_CONFIG[row.priority_field]?.bg || '#eee' }} />
      ),
    },
    {
      key: 'sninc_state', header: 'Status', width: 110,
      render: row => {
        const statusGroup = getIncidentStatusGroup(row.sninc_state)
        const isOpen = statusGroup !== 'Resolved/Closed/Canceled'
        return (
          <Chip label={row.sninc_state || '—'} size="small"
            sx={{ height: 20, fontSize: '10px', fontWeight: 700,
              color: isOpen ? '#c62828' : '#2e7d32',
              backgroundColor: isOpen ? '#ffebee' : '#e8f5e9' }} />
        )
      },
    },
    {
      key: 'sninc_opened_at', header: 'Opened At', width: 150,
      render: row => <Typography sx={{ fontSize: '11px', color: '#555' }}>{formatOpenedAt(row.sninc_opened_at)}</Typography>,
    },
    { key: 'sninc_capability',     header: 'Capability',        width: 140, render: row => <Typography sx={{ fontSize: '11px', color: '#555' }}>{row.sninc_capability || '—'}</Typography> },
    { key: 'sninc_short_desc',     header: 'Description',       flex: 1,    render: row => <Typography sx={{ fontSize: '11px', color: '#333' }}>{row.sninc_short_desc || '—'}</Typography> },
    { key: 'sninc_assignment_grp', header: 'Assignment Group',  width: 150, render: row => <Typography sx={{ fontSize: '11px', color: '#666' }}>{row.sninc_assignment_grp || '—'}</Typography> },
  ]

  return (
    <WidgetShell
      title="All Incidents"
      titleIcon={<WarningAmberIcon sx={{ color: '#1565c0', fontSize: 18 }} />}
      source={`PostgreSQL · edoops.service_now_inc · ${days === 'all' ? 'all incidents with most recent status' : `active during last ${days}d`} · most recent status per incident`}
      actions={<WidgetInfo text={`${days === 'all' ? 'All incidents across all available time' : `All incidents active in the last ${days} days`} — open (any age) + closed or resolved within the selected window. One row per incident, most recent status. Adjust with the preset controls.`} />}
      loading={loading}
      error={error ?? undefined}
    >
      {!error && (
        <>
          <Box sx={{ px: 1.5, pt: 0.5, pb: 0.5, display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap', borderBottom: '1px solid #f0f0f0' }}>
            <TextField
              size="small"
              placeholder="Search incidents…"
              value={search}
              onChange={e => handleSearchChange(e.target.value)}
              InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon sx={{ fontSize: 14, color: '#aaa' }} /></InputAdornment> }}
              sx={{ minWidth: 200, '& .MuiOutlinedInput-root': { fontSize: '11px', borderRadius: 2, height: 28 } }}
            />
            {['All', 'P1', 'P2', 'P3', 'P4', 'P5'].map(p => (
              <Chip key={p} label={p} size="small" onClick={() => handlePriorityChange(p)}
                sx={{
                  fontSize: '10px', height: 22, cursor: 'pointer',
                  fontWeight: priorityFilter === p ? 700 : 400,
                  backgroundColor: priorityFilter === p ? (PRIORITY_CONFIG[p]?.bg ?? '#f5f5f5') : '#f5f5f5',
                  color: priorityFilter === p ? (INCIDENT_COLORS[p] ?? '#1565c0') : '#aaa',
                  border: priorityFilter === p ? `1px solid ${INCIDENT_COLORS[p] ?? '#1565c0'}40` : '1px solid transparent',
                  '& .MuiChip-label': { px: 1 },
                }}
              />
            ))}
            {statusFilterOptions.map(status => {
              const isActive = statusFilter === status
              const colors = status === 'New'
                ? { color: '#c62828', bg: '#ffebee' }
                : status === 'In Progress'
                  ? { color: '#1565c0', bg: '#e3f2fd' }
                : status === 'Resolved/Closed/Canceled'
                  ? { color: '#2e7d32', bg: '#e8f5e9' }
                  : status === 'On Hold'
                    ? { color: '#ef6c00', bg: '#fff3e0' }
                    : { color: '#1565c0', bg: '#e3f2fd' }
              return (
                <Chip
                  key={status}
                  label={status}
                  size="small"
                  onClick={() => handleStatusChange(status)}
                  sx={{
                    fontSize: '10px', height: 22, cursor: 'pointer',
                    fontWeight: isActive ? 700 : 400,
                    backgroundColor: isActive ? colors.bg : '#f5f5f5',
                    color: isActive ? colors.color : '#aaa',
                    border: isActive ? `1px solid ${colors.color}40` : '1px solid transparent',
                    '& .MuiChip-label': { px: 1 },
                  }}
                />
              )
            })}
            <Typography sx={{ fontSize: '10px', color: '#aaa', ml: 'auto' }}>{filtered.length} records</Typography>
          </Box>
          <Box sx={{ flex: 1, overflowY: 'auto', px: 1.5, pb: 1 }}>
            <DataTable columns={incidentColumns} rows={paginated} rowKey="sninc_inc_num" compact accentColor="#1565c0" maxHeight={tableMaxHeight} />
          </Box>
          {filtered.length > rowsPerPage && (
            <TablePagination
              component="div"
              count={filtered.length}
              page={page}
              onPageChange={(_e, newPage) => setPage(newPage)}
              rowsPerPage={rowsPerPage}
              rowsPerPageOptions={[rowsPerPage]}
              sx={{ borderTop: '1px solid #f0f0f0', '& .MuiTablePagination-toolbar': { minHeight: 36, fontSize: '11px' }, '& .MuiTablePagination-displayedRows': { fontSize: '11px' } }}
            />
          )}
        </>
      )}
    </WidgetShell>
  )
}

// ─── By Capability Widget ──────────────────────────────────

const CAPABILITY_COLORS = CHART_PALETTE
const SERVICENOW_DAY_PRESETS: ServiceNowDaysFilter[] = [30, 60, 90, 'all']
const SERVICENOW_TABS = [
  { key: 'incidents', label: 'Incidents', icon: <WarningAmberIcon sx={{ fontSize: 14 }} /> },
  { key: 'changes', label: 'Changes', icon: <BuildCircleIcon sx={{ fontSize: 14 }} /> },
] as const

function getServiceNowDaysLabel(days: ServiceNowDaysFilter): string {
  return days === 'all' ? 'All time' : `Last ${days}d`
}

function formatServiceNowDayLabel(value: string | number) {
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  if (typeof value !== 'string' || !value) return String(value ?? '')

  const isoMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (isoMatch) {
    const [, year, month, day] = isoMatch
    const monthLabel = monthNames[Number(month) - 1]
    if (monthLabel) return `${monthLabel} ${Number(day)} ${year}`
  }

  const parsed = new Date(value)
  if (!Number.isNaN(parsed.getTime())) {
    return `${monthNames[parsed.getMonth()]} ${parsed.getDate()} ${parsed.getFullYear()}`
  }

  return value
}

function formatServiceNowShortDayLabel(value: string | number) {
  const formatted = formatServiceNowDayLabel(value)
  const shortMatch = formatted.match(/^([A-Z][a-z]{2})\s+(\d{1,2})(?:\s+\d{4})?$/)
  if (shortMatch) {
    const [, month, day] = shortMatch
    return `${month} ${day}`
  }

  return formatted
}

function getServiceNowXAxisInterval(length: number) {
  if (length <= 8) return 0
  return Math.max(Math.ceil(length / 6) - 1, 0)
}

export const CapabilityWidget: React.FC<{ platform?: string | null; days?: ServiceNowDaysFilter }> = ({ platform, days = 7 }) => {
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { useMock } = useMockData()

  useEffect(() => {
    setLoading(true); setData([]); setError(null)
    if (useMock) { setData(MOCK_SERVICENOW_BY_CAPABILITY); setLoading(false); return }
    servicenowService.getByCapability(platform ?? undefined, days)
      .then(d => { setData(Array.isArray(d) ? d : []); setLoading(false) })
      .catch(err => { setError(err.message || 'Failed to fetch'); setLoading(false) })
  }, [useMock, platform, days])

  const max = Math.max(...data.map(r => r.incident_count || 0), 1)

  return (
    <WidgetShell
      title="Incidents by Capability"
      titleIcon={<BugReportIcon sx={{ color: '#1565c0', fontSize: 18 }} />}
      source={`PostgreSQL · edoops.service_now_inc · ${days === 'all' ? 'opened across all time' : `opened in last ${days}d`}`}
      actions={<WidgetInfo text={`Shows the top 10 capabilities by incident count for incidents ${days === 'all' ? 'opened across all available time' : `opened in the last ${days} days`}. All statuses are included. Use the preset controls to change the opened date window.`} />}
      loading={loading}
      error={error ?? undefined}
    >
      {!error && (
        <Box sx={{ px: 2, py: 1, display: 'flex', flexDirection: 'column', gap: 0.75 }}>
          {data.map((r, i) => {
            const pct = Math.round(((r.incident_count || 0) / max) * 100)
            const color = CAPABILITY_COLORS[i % CAPABILITY_COLORS.length]
            return (
              <Box key={r.capability}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.3 }}>
                  <Typography sx={{ fontSize: '11px', fontWeight: 500, color: '#333' }}>{r.capability}</Typography>
                  <Typography sx={{ fontSize: '11px', color: '#888', fontWeight: 600 }}>{r.incident_count}</Typography>
                </Box>
                <Box sx={{ height: 7, backgroundColor: '#f0f0f0', borderRadius: 4, overflow: 'hidden' }}>
                  <Box sx={{ height: '100%', width: `${pct}%`, backgroundColor: color, borderRadius: 4, transition: 'width 0.4s ease' }} />
                </Box>
              </Box>
            )
          })}
        </Box>
      )}
    </WidgetShell>
  )
}

// ─── By Assignment Group Widget ────────────────────────────

export const AssignmentGroupWidget: React.FC<{ platform?: string | null; days?: ServiceNowDaysFilter }> = ({ platform, days = 7 }) => {
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { useMock } = useMockData()

  useEffect(() => {
    setLoading(true); setData([]); setError(null)
    if (useMock) { setData(MOCK_SERVICENOW_BY_ASSIGNMENT_GROUP); setLoading(false); return }
    servicenowService.getByAssignmentGroup(platform ?? undefined, days)
      .then(d => { setData(Array.isArray(d) ? d : []); setLoading(false) })
      .catch(err => { setError(err.message || 'Failed to fetch'); setLoading(false) })
  }, [useMock, platform, days])

  const total = data.reduce((s, r) => s + (r.incident_count || 0), 0)
  const donutData = data.map((r, i) => ({
    name: r.assignment_group,
    value: r.incident_count || 0,
    color: CAPABILITY_COLORS[i % CAPABILITY_COLORS.length],
  }))

  return (
    <WidgetShell
      title="Incidents by Assignment Group"
      titleIcon={<ConfirmationNumberIcon sx={{ color: TRUIST.dusk, fontSize: 18 }} />}
      source={` ${days === 'all' ? 'opened across all time' : `opened in last ${days}d`}`}
      actions={<WidgetInfo text={`Shows the top 10 assignment groups by incident count for incidents ${days === 'all' ? 'opened across all available time' : `opened in the last ${days} days`}. All statuses are included. Use the preset controls to change the opened date window.`} />}
      loading={loading}
      error={error ?? undefined}
    >
      {!error && (
        <>
          {donutData.length > 0 && (
            <Box sx={{ display: 'flex', justifyContent: 'center', pt: 1 }}>
              <DonutChart data={donutData} centerLabel={total} showLegend size={130} />
            </Box>
          )}
        </>
      )}
    </WidgetShell>
  )
}

export const ChangeKpiWidget: React.FC<{ platform?: string | null; days?: ServiceNowDaysFilter }> = ({ platform, days = 7 }) => {
  const [openedChanges, setOpenedChanges] = useState<any[]>([])
  const [closedChanges, setClosedChanges] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { useMock } = useMockData()

  useEffect(() => {
    setLoading(true)
    setOpenedChanges([])
    setClosedChanges([])
    setError(null)
    if (useMock) {
      setOpenedChanges(MOCK_SERVICENOW_OPENED_CHANGES)
      setClosedChanges(MOCK_SERVICENOW_CLOSED_CHANGES)
      setLoading(false)
      return
    }
    Promise.all([
      servicenowService.getOpenedChanges(platform ?? undefined, days),
      servicenowService.getClosedChanges(platform ?? undefined, days),
    ])
      .then(([openedData, closedData]) => {
        setOpenedChanges(Array.isArray(openedData) ? openedData : [])
        setClosedChanges(Array.isArray(closedData) ? closedData : [])
        setLoading(false)
      })
      .catch(err => { setError(err.message || 'Failed to fetch change KPIs'); setLoading(false) })
  }, [days, useMock, platform])

  const orderedPriorities = ['P1', 'P2', 'P3', 'P4', 'P5']
  const openedByPriority = new Map(openedChanges.map((row) => [row.priority_field, row]))
  const closedByPriority = new Map(closedChanges.map((row) => [row.priority_field, row]))

  const openedItems = orderedPriorities.map((priority) => ({
    label: priority,
    value: openedByPriority.get(priority)?.incident_count || 0,
    color: INCIDENT_COLORS[priority] || '#757575',
    bg: PRIORITY_CONFIG[priority]?.bg || '#f5f5f5',
  }))
  const closedItems = orderedPriorities.map((priority) => ({
    label: priority,
    value: closedByPriority.get(priority)?.incident_count || 0,
    color: INCIDENT_COLORS[priority] || '#757575',
    bg: PRIORITY_CONFIG[priority]?.bg || '#f5f5f5',
  }))

  const openedTotal = openedItems.reduce((sum, item) => sum + Number(item.value || 0), 0)
  const closedTotal = closedItems.reduce((sum, item) => sum + Number(item.value || 0), 0)

  return (
    <WidgetShell
      title="Change KPIs"
      titleIcon={<BuildCircleIcon sx={{ color: '#7b1fa2', fontSize: 18 }} />}
      source={`edoops.service_now_chg . opened = ${days === 'all' ? 'all time' : `last ${days}d`} . closed = ${days === 'all' ? 'all time' : `last ${days}d`}`}
      actions={<WidgetInfo text={`Counts changes by priority from edoops.service_now_chg joined with sla_glossary. Opened changes use snchg_opened_at_dttm, falling back to snchg_plnd_start_dttm and snchg_last_updt_dttm. Closed changes use snchg_closed_at_dttm, falling back to snchg_plnd_end_dttm and snchg_last_updt_dttm. Platform and selected day window apply to both sides.`} />}
      loading={loading}
      error={error ?? undefined}
    >
      {!error && (
        <Box sx={{ px: 1.5, py: 1.25, display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
          <Box sx={{ border: '1px solid #ede7f6', borderRadius: 2, backgroundColor: '#faf7ff', p: 1.25 }}>
            <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', mb: 1 }}>
              <Typography sx={{ fontSize: '13px', fontWeight: 700, color: '#6a1b9a', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                Opened Changes
              </Typography>
              <Typography sx={{ fontSize: '22px', fontWeight: 800, color: '#7b1fa2' }}>{openedTotal}</Typography>
            </Box>
            <StatCardGrid items={openedItems} columns={5} compact />
          </Box>
          <Box sx={{ border: '1px solid #dcedc8', borderRadius: 2, backgroundColor: '#f7fbf1', p: 1.25 }}>
            <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', mb: 1 }}>
              <Typography sx={{ fontSize: '13px', fontWeight: 700, color: '#2e7d32', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                Closed Changes
              </Typography>
              <Typography sx={{ fontSize: '22px', fontWeight: 800, color: '#2e7d32' }}>{closedTotal}</Typography>
            </Box>
            <StatCardGrid items={closedItems} columns={5} compact />
          </Box>
        </Box>
      )}
    </WidgetShell>
  )
}

// ─── Emergency Changes Widget ──────────────────────────────

export const EmergencyChangesWidget: React.FC<{ platform?: string | null; days?: ServiceNowDaysFilter }> = ({ platform, days = 7 }) => {
  const [changes, setChanges] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { useMock } = useMockData()

  useEffect(() => {
    setLoading(true)
    setChanges([])
    setError(null)
    if (useMock) {
      setChanges(MOCK_SERVICENOW_EMERGENCY_CHANGES)
      setLoading(false)
      return
    }
    servicenowService.getEmergencyChanges(platform ?? undefined, days)
      .then(d => { setChanges(Array.isArray(d) ? d : []); setLoading(false) })
      .catch(err => { setError(err.message || 'Failed to fetch emergency changes'); setLoading(false) })
  }, [useMock, platform, days])

  const total = changes.reduce((s, r) => s + (r.incident_count || 0), 0)
  const donutData = changes.map(r => ({
    name: r.priority_field || 'Unknown',
    value: r.incident_count || 0,
    color: PRIORITY_CONFIG[r.priority_field]?.color || '#757575',
  }))

  return (
    <WidgetShell
      title="Open Emergency Changes by Priority"
      titleIcon={<BuildCircleIcon sx={{ color: '#7b1fa2', fontSize: 18 }} />}
      source={`PostgreSQL · edoops.service_now_chg · ${days === 'all' ? 'all time' : `last ${days}d`}`}
      actions={<WidgetInfo text={`Emergency change counts by priority from edoops.service_now_chg for ${days === 'all' ? 'all available time' : `the last ${days} days`}. Filters use opened/planned-start timestamps and also respect the selected platform.`} />}
      loading={loading}
      error={error ?? undefined}
    >
      {!error && (
        <>
          <Box sx={{ px: 1.5, py: 1 }}>
            <StatCardGrid
              items={[
                ...changes.map(r => ({
                  label: r.priority_field || 'Unknown',
                  value: r.incident_count || 0,
                  color: PRIORITY_CONFIG[r.priority_field]?.color || '#757575',
                  bg: PRIORITY_CONFIG[r.priority_field]?.bg || '#f5f5f5',
                })),
                { label: 'Total', value: total, color: '#7b1fa2', bg: '#f3e5f5' },
              ]}
              columns={Math.min(changes.length + 1, 4)}
              compact
            />
          </Box>
          {donutData.length > 0 && (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 1 }}>
              <DonutChart
                data={donutData}
                centerLabel={total}
                showLegend
                size={140}
              />
            </Box>
          )}
        </>
      )}
    </WidgetShell>
  )
}

export const ChangesByPlatformWidget: React.FC<{ platform?: string | null; days?: ServiceNowDaysFilter }> = ({ platform, days = 7 }) => {
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { useMock } = useMockData()

  useEffect(() => {
    setLoading(true)
    setData([])
    setError(null)
    if (useMock) {
      setData(MOCK_SERVICENOW_CHANGES_BY_PLATFORM)
      setLoading(false)
      return
    }
    servicenowService.getChangesByPlatform(platform ?? undefined, days)
      .then(d => { setData(Array.isArray(d) ? d : []); setLoading(false) })
      .catch(err => { setError(err.message || 'Failed to fetch changes by platform'); setLoading(false) })
  }, [useMock, platform, days])

  const max = Math.max(...data.map(r => r.incident_count || 0), 1)

  return (
    <WidgetShell
      title="Changes by Platform"
      titleIcon={<BuildCircleIcon sx={{ color: '#7b1fa2', fontSize: 18 }} />}
      source={`PostgreSQL · edoops.service_now_chg · ${days === 'all' ? 'all time' : `last ${days}d`} · grouped by snchg_pltf_nm`}
      actions={<WidgetInfo text={`Top platforms by change count from edoops.service_now_chg grouped by snchg_pltf_nm. The selected day window uses snchg_opened_at_dttm with fallback to snchg_plnd_start_dttm and snchg_last_updt_dttm. The platform filter also applies here.`} />}
      loading={loading}
      error={error ?? undefined}
    >
      {!error && (
        <Box sx={{ px: 2, py: 1, display: 'flex', flexDirection: 'column', gap: 0.75 }}>
          {data.map((row, index) => {
            const pct = Math.round(((row.incident_count || 0) / max) * 100)
            const color = CAPABILITY_COLORS[index % CAPABILITY_COLORS.length]
            return (
              <Box key={row.platform}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.3 }}>
                  <Typography sx={{ fontSize: '11px', fontWeight: 500, color: '#333' }}>{row.platform}</Typography>
                  <Typography sx={{ fontSize: '11px', color: '#888', fontWeight: 600 }}>{row.incident_count}</Typography>
                </Box>
                <Box sx={{ height: 7, backgroundColor: '#f0f0f0', borderRadius: 4, overflow: 'hidden' }}>
                  <Box sx={{ height: '100%', width: `${pct}%`, backgroundColor: color, borderRadius: 4, transition: 'width 0.4s ease' }} />
                </Box>
              </Box>
            )
          })}
        </Box>
      )}
    </WidgetShell>
  )
}

// ─── Pipelines Widget ──────────────────────────────────────

const PIPELINE_HEALTH_CONFIG: Record<string, { color: string; bg: string; dot: string }> = {
  healthy:  { color: '#2e7d32', bg: '#e8f5e9', dot: '#4caf50' },
  at_risk:  { color: '#f57c00', bg: '#fff8e1', dot: '#fb8c00' },
  critical: { color: '#c62828', bg: '#fce4ec', dot: '#e53935' },
}

export const PipelinesWidget: React.FC = () => {
  const [pipelines, setPipelines] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [drillDown, setDrillDown] = useState<DrillDownData | null>(null)

  useEffect(() => {
    postgresService.getPipelines()
      .then(d => { setPipelines(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const columns: ColumnDef[] = [
    {
      key: 'name', header: 'Pipeline', flex: 1,
      render: row => (
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.3 }}>
            <Typography sx={{ fontSize: '13px', fontWeight: 600, color: '#1a1a1a' }}>{row.name}</Typography>
            <Chip label={row.status.replace('_', ' ')} size="small"
              sx={{ height: 18, fontSize: '10px', fontWeight: 700, ...PIPELINE_HEALTH_CONFIG[row.status] }} />
          </Box>
          <Box sx={{ display: 'flex', gap: 2, mb: 0.4 }}>
            <Typography sx={{ fontSize: '11px', color: '#777' }}>Success: <b>{row.successRate}%</b></Typography>
            <Typography sx={{ fontSize: '11px', color: '#777' }}>Avg: <b>{row.avgDuration}</b></Typography>
            <Typography sx={{ fontSize: '11px', color: '#777' }}>{row.schedule}</Typography>
          </Box>
          <Box sx={{ height: 4, backgroundColor: '#e0e0e0', borderRadius: 2, overflow: 'hidden' }}>
            <Box sx={{ height: '100%', width: `${row.successRate}%`, backgroundColor: PIPELINE_HEALTH_CONFIG[row.status]?.dot || '#aaa', borderRadius: 2 }} />
          </Box>
        </Box>
      ),
    },
  ]

  return (
    <>
      <WidgetShell
        title="Pipeline Status"
        titleIcon={<PipelineIcon sx={{ color: '#1976d2', fontSize: 18 }} />}
        source="PostgreSQL"
        loading={loading}
      >
        <Box sx={{ flex: 1, overflowY: 'auto', px: 1.5, py: 1 }}>
          <DataTable
            columns={columns}
            rows={pipelines}
            onRowClick={row => setDrillDown({ type: 'pipeline', data: row })}
            rowKey="id"
            compact
            rowTooltip="Click to view run history & details"
          />
        </Box>
      </WidgetShell>
      <DrillDownModal open={!!drillDown} onClose={() => setDrillDown(null)} drillDown={drillDown} />
    </>
  )
}

// ─── Incident Trend Widget ────────────────────────────────

export const IncidentTrendWidget: React.FC<{ platform?: string | null; days?: ServiceNowDaysFilter }> = ({ platform, days = 7 }) => {
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { useMock } = useMockData()

  useEffect(() => {
    setLoading(true); setData([]); setError(null)
    if (useMock) { setData(MOCK_SERVICENOW_INCIDENT_TREND); setLoading(false); return }
    servicenowService.getIncidentTrend(platform ?? undefined, days)
      .then(d => { setData(Array.isArray(d) ? d : []); setLoading(false) })
      .catch(err => { setError(err.message || 'Failed to fetch'); setLoading(false) })
  }, [useMock, platform, days])

  return (
    <WidgetShell
      title="Incident Volume by Day"
      titleIcon={<TrendingUpIcon sx={{ color: '#c62828', fontSize: 18 }} />}
      source={`PostgreSQL · edoops.service_now_inc · ${days === 'all' ? 'all time' : `last ${days}d`} · most recent per incident per day`}
      actions={<WidgetInfo text={`Daily breakdown of incidents over ${days === 'all' ? 'all available time' : `the last ${days} days`} — bars show open vs closed count per day, lines show total volume and P1/P2 critical incidents when present. Filtered by last-updated date (not opened date) to capture day-by-day state transitions. Use the preset controls to widen or narrow the trend window.`} />}
      loading={loading}
      error={error ?? undefined}
    >
      {!error && (
        <Box sx={{ flex: 1, px: 1, py: 1, minHeight: 0 }}>
          <ComposedBarLineChart
            data={data}
            xKey="day"
            bars={[
              { key: 'open',   label: 'Open',   color: '#c62828' },
              { key: 'closed', label: 'Closed', color: '#2e7d32' },
            ]}
            lines={[
              { key: 'total', label: 'Total', color: '#1565c0' },
              { key: 'p1p2', label: 'P1/P2', color: '#6a1b9a', yAxisId: 'right', strokeWidth: 2.25 },
            ]}
            height={220}
            showBarLabels
            rightYDomain={[0, 'auto']}
            xAxisTickFormatter={formatServiceNowShortDayLabel}
            xAxisInterval={getServiceNowXAxisInterval(data.length)}
            xAxisAngle={0}
            xAxisHeight={36}
          />
        </Box>
      )}
    </WidgetShell>
  )
}

export const IncidentStateDailyWidget: React.FC<{ platform?: string | null; days?: ServiceNowDaysFilter }> = ({ platform, days = 7 }) => {
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { useMock } = useMockData()

  useEffect(() => {
    setLoading(true); setData([]); setError(null)
    if (useMock) { setData(MOCK_SERVICENOW_INCIDENT_STATE_DAILY); setLoading(false); return }
    servicenowService.getIncidentStateDaily(platform ?? undefined, days)
      .then(d => { setData(Array.isArray(d) ? d : []); setLoading(false) })
      .catch(err => { setError(err.message || 'Failed to fetch'); setLoading(false) })
  }, [useMock, platform, days])

  return (
    <WidgetShell
      title="Incidents by State Over Time (Daily)"
      titleIcon={<TrendingUpIcon sx={{ color: '#1565c0', fontSize: 18 }} />}
      source={`${days === 'all' ? 'all time' : `last ${days}d`} ·`}
      actions={<WidgetInfo text={`Daily incident state mix over ${days === 'all' ? 'all available time' : `the last ${days} days`} using the latest incident row for each incident on each day. Bars show New, Open/In Progress/On Hold, and Closed/Resolved/Canceled counts.`} />}
      loading={loading}
      error={error ?? undefined}
    >
      {!error && (
        <Box sx={{ flex: 1, px: 1, py: 1, minHeight: 0 }}>
          <ComposedBarLineChart
            data={data}
            xKey="day"
            bars={[
              { key: 'new', label: 'New', color: '#1565c0' },
              { key: 'open', label: 'Open', color: '#fb8c00' },
              { key: 'closed', label: 'Closed', color: '#43a047' },
            ]}
            lines={[]}
            height={220}
            showBarLabels={false}
            xAxisTickFormatter={formatServiceNowShortDayLabel}
            xAxisInterval={getServiceNowXAxisInterval(data.length)}
            xAxisAngle={0}
            xAxisHeight={36}
          />
        </Box>
      )}
    </WidgetShell>
  )
}

export const PlatformWidget: React.FC<{ platform?: string | null; days?: ServiceNowDaysFilter }> = ({ platform, days = 7 }) => {
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { useMock } = useMockData()

  useEffect(() => {
    setLoading(true); setData([]); setError(null)
    if (useMock) { setData(MOCK_SERVICENOW_BY_PLATFORM); setLoading(false); return }
    servicenowService.getByPlatform(platform ?? undefined, days)
      .then(d => { setData(Array.isArray(d) ? d : []); setLoading(false) })
      .catch(err => { setError(err.message || 'Failed to fetch'); setLoading(false) })
  }, [useMock, platform, days])

  const max = Math.max(...data.map(r => r.incident_count || 0), 1)

  return (
    <WidgetShell
      title="Incidents by Platform"
      titleIcon={<BugReportIcon sx={{ color: '#6a1b9a', fontSize: 18 }} />}
      source={`${days === 'all' ? 'opened across all time' : `opened in last ${days}d`} · `}
      actions={<WidgetInfo text={`Top 10 platforms by incident count for incidents ${days === 'all' ? 'opened across all available time' : `opened in the last ${days} days`}. Uses the latest row per incident and counts all statuses.`} />}
      loading={loading}
      error={error ?? undefined}
    >
      {!error && (
        <Box sx={{ px: 2, py: 1, display: 'flex', flexDirection: 'column', gap: 0.75 }}>
          {data.map((row, index) => {
            const pct = Math.round(((row.incident_count || 0) / max) * 100)
            const color = CAPABILITY_COLORS[index % CAPABILITY_COLORS.length]
            return (
              <Box key={row.platform}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.3 }}>
                  <Typography sx={{ fontSize: '11px', fontWeight: 500, color: '#333' }}>{row.platform}</Typography>
                  <Typography sx={{ fontSize: '11px', color: '#888', fontWeight: 600 }}>{row.incident_count}</Typography>
                </Box>
                <Box sx={{ height: 7, backgroundColor: '#f0f0f0', borderRadius: 4, overflow: 'hidden' }}>
                  <Box sx={{ height: '100%', width: `${pct}%`, backgroundColor: color, borderRadius: 4, transition: 'width 0.4s ease' }} />
                </Box>
              </Box>
            )
          })}
        </Box>
      )}
    </WidgetShell>
  )
}

// ─── ServiceNow Dashboard (full-page layout) ───────────────

import SupportAgentIcon from '@mui/icons-material/SupportAgent'

export const ServiceNowDashboard: React.FC<{ onOpenAgent?: (agentId: string) => void }> = () => {
  const { useMock } = useMockData()
  const [platforms,        setPlatforms]        = useState<{ platform: string; hasCritical: boolean }[]>([])
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null)
  const [platformsLoading, setPlatformsLoading] = useState(false)
  const [days, setDays] = useState<ServiceNowDaysFilter>(7)
  const [activeTab, setActiveTab] = useState<'incidents' | 'changes'>('incidents')

  useEffect(() => {
    if (activeTab !== 'changes') return
    setPlatformsLoading(true)
    if (useMock) {
      setPlatforms(MOCK_SERVICENOW_PLATFORMS)
      setPlatformsLoading(false)
      return
    }
    servicenowService.getPlatforms(days)
      .then(d => { setPlatforms(Array.isArray(d) ? d : []); setPlatformsLoading(false) })
      .catch(() => setPlatformsLoading(false))
  }, [activeTab, useMock, days])

  return (
    <Box sx={{ bgcolor: '#f5f6f8', minHeight: '100%', p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>

      {/* ── Header bar ── */}
      <Paper elevation={0} sx={{ borderRadius: 2, border: '1px solid #e8ecf1', bgcolor: '#f8f9fb', overflow: 'hidden', position: 'sticky', top: 0, zIndex: 10, boxShadow: '0 2px 8px rgba(0,0,0,0.07)' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', backgroundColor: '#1a2535', px: 2, flexShrink: 0, overflowX: 'auto' }}>
          <SupportAgentIcon sx={{ fontSize: 16, color: '#90caf9', mr: 1.25, flexShrink: 0 }} />
          <Typography sx={{ fontWeight: 700, fontSize: '11px', color: '#e2e8f0', textTransform: 'uppercase', letterSpacing: '0.6px', mr: 1.25, flexShrink: 0 }}>
            ServiceNow
          </Typography>
          {SERVICENOW_TABS.map((tab) => {
            const isActive = activeTab === tab.key
            return (
              <Box
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                sx={{
                  display: 'flex', alignItems: 'center', gap: 0.75, px: 2.5, py: 1.2,
                  cursor: 'pointer',
                  borderBottom: isActive ? '3px solid #1976d2' : '3px solid transparent',
                  color: isActive ? '#fff' : '#78909c',
                  transition: 'all 0.15s',
                  flexShrink: 0,
                  '&:hover': { color: '#fff', backgroundColor: 'rgba(255,255,255,0.05)' },
                }}
              >
                {React.cloneElement(tab.icon, { sx: { fontSize: 14, color: isActive ? '#64b5f6' : 'inherit' } })}
                <Typography sx={{ fontSize: '12px', fontWeight: isActive ? 700 : 400 }}>{tab.label}</Typography>
              </Box>
            )
          })}
          {useMock && (
            <Chip label="MOCK DATA" size="small" sx={{ ml: 1, fontSize: '9px', height: 18, bgcolor: 'rgba(255,255,255,0.12)', color: '#dbeafe', fontWeight: 700, border: '1px solid rgba(255,255,255,0.16)', flexShrink: 0 }} />
          )}
        </Box>
        {activeTab === 'changes' && (
        <Box sx={{ px: 2, py: 1.25, display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'nowrap', overflowX: 'auto' }}>
          <Autocomplete
              options={platforms}
              getOptionLabel={(opt) => opt.platform}
              value={platforms.find(p => p.platform === selectedPlatform) ?? null}
              onChange={(_, v) => setSelectedPlatform(v?.platform ?? null)}
              isOptionEqualToValue={(opt, val) => opt.platform === val.platform}
              loading={platformsLoading}
              size="small"
              sx={{ width: 180, flexShrink: 0, '& .MuiInputBase-root': { fontSize: '11px' }, '& .MuiInputLabel-root': { fontSize: '11px' } }}
              renderOption={({ key, ...props }, option) => (
                <li key={key} {...props}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, width: '100%' }}>
                    {option.hasCritical && (
                      <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: '#c62828', flexShrink: 0 }} />
                    )}
                    <Typography sx={{ fontSize: '12px', flex: 1 }}>{option.platform}</Typography>
                    {option.hasCritical && (
                      <Chip label="P1/P2" size="small" sx={{ fontSize: '9px', height: 16, bgcolor: '#fce4ec', color: '#c62828', fontWeight: 700 }} />
                    )}
                  </Box>
                </li>
              )}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Platform"
                  placeholder="All Platforms"
                  size="small"
                  InputLabelProps={{ shrink: true }}
                  InputProps={{
                    ...params.InputProps,
                    endAdornment: (
                      <>
                        {platformsLoading && <CircularProgress size={12} />}
                        {params.InputProps.endAdornment}
                      </>
                    ),
                  }}
                />
              )}
              ListboxProps={{ sx: { fontSize: '12px' } }}
            />
          <Box sx={{ width: 160, display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', minWidth: 48 }}>
              <Typography sx={{ fontSize: '10px', color: '#666', lineHeight: 1.2 }}>{getServiceNowDaysLabel(days)}</Typography>
              <Typography sx={{ fontSize: '9px', color: '#90a4ae', lineHeight: 1.2, whiteSpace: 'nowrap' }}>{days === 'all' ? 'all changes' : 'by opened date'}</Typography>
            </Box>
            <Slider
              size="small"
              value={typeof days === 'number' ? Math.min(days, 15) : 15}
              onChange={(_, v) => setDays(Array.isArray(v) ? v[0] : v)}
              valueLabelDisplay="auto"
              min={1}
              max={15}
              step={1}
              sx={{
                color: '#1976d2',
                '& .MuiSlider-markLabel': { fontSize: '9px' },
                '& .MuiSlider-valueLabel': { fontSize: '10px' },
              }}
            />
            <Typography sx={{ fontSize: '9px', color: '#bbb', whiteSpace: 'nowrap' }}>15d</Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
            {SERVICENOW_DAY_PRESETS.map((presetDays) => {
              const isActive = days === presetDays
              return (
                <Chip
                  key={presetDays}
                  label={presetDays === 'all' ? 'All' : `${presetDays}d`}
                  size="small"
                  onClick={() => setDays(presetDays)}
                  sx={{
                    height: 22,
                    fontSize: '10px',
                    fontWeight: isActive ? 700 : 500,
                    cursor: 'pointer',
                    backgroundColor: isActive ? '#e3f2fd' : '#f5f5f5',
                    color: isActive ? '#1565c0' : '#78909c',
                    border: isActive ? '1px solid #1565c040' : '1px solid transparent',
                    '& .MuiChip-label': { px: 1 },
                  }}
                />
              )
            })}
          </Box>
          <Chip
            label="Change View"
            size="small"
            sx={{
              height: 22,
              fontSize: '10px',
              fontWeight: 700,
              color: '#6a1b9a',
              bgcolor: '#f3e5f5',
              border: '1px solid #d1c4e9',
            }}
          />
          <Typography sx={{ fontSize: '10px', color: '#aaa', ml: 'auto', flexShrink: 0, whiteSpace: 'nowrap' }}>
            PostgreSQL · edoops.service_now_chg
          </Typography>
        </Box>
        )}
      </Paper>
      {activeTab === 'incidents' ? (
        <ServiceNowIncidentsOverview />
      ) : (
        <>
          <Paper elevation={0} sx={{ borderRadius: 2, overflow: 'hidden', border: '1px solid #e8ecf1', borderTop: '3px solid #6a1b9a', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', display: 'flex', flexDirection: 'column' }}>
            <ChangeKpiWidget platform={selectedPlatform} days={days} />
          </Paper>

          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, alignItems: 'stretch', '@media (max-width: 1100px)': { gridTemplateColumns: '1fr' } }}>
            <Paper elevation={0} sx={{ borderRadius: 2, overflow: 'hidden', border: '1px solid #e8ecf1', borderTop: '3px solid #7b1fa2', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', display: 'flex', flexDirection: 'column' }}>
              <ChangesByPlatformWidget platform={selectedPlatform} days={days} />
              {/* <EmergencyChangesWidget platform={selectedPlatform} days={days} /> */}
            </Paper>
            <Paper elevation={0} sx={{ borderRadius: 2, overflow: 'hidden', border: '1px dashed #c5d0db', bgcolor: '#fbfcfe', minHeight: 260, display: 'flex', flexDirection: 'column' }}>
              <Box sx={{ px: 2, py: 1.5, borderBottom: '1px solid #eef2f6' }}>
                <Typography sx={{ fontSize: '12px', fontWeight: 700, color: '#455a64', textTransform: 'uppercase', letterSpacing: '0.4px' }}>More Change Analytics</Typography>
              </Box>
              <Box sx={{ px: 2, py: 2, display: 'flex', flex: 1, alignItems: 'center' }}>
                <Typography sx={{ fontSize: '12px', color: '#78909c', lineHeight: 1.7 }}>
                  Placeholder for change trends, assignee groups, approvals, CAB metrics, or detailed change tables. The tab now has live change count widgets and can be extended without another layout change.
                </Typography>
              </Box>
            </Paper>
          </Box>
        </>
      )}

    </Box>
  )
}
