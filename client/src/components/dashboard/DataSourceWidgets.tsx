import React, { useState, useEffect, useMemo } from 'react'
import { Box, Typography, Chip, Paper, TextField, InputAdornment, Button, Autocomplete, CircularProgress, Snackbar, Alert, TablePagination } from '@mui/material'
import BugReportIcon from '@mui/icons-material/BugReport'
import SearchIcon from '@mui/icons-material/Search'
import ConfirmationNumberIcon from '@mui/icons-material/ConfirmationNumber'
import StreamIcon from '@mui/icons-material/Stream'
import AttachMoneyIcon from '@mui/icons-material/AttachMoney'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'
import PipelineIcon from '@mui/icons-material/AccountTree'
import BuildCircleIcon from '@mui/icons-material/BuildCircle'
import SmartToyIcon from '@mui/icons-material/SmartToy'
import { DrillDownModal, DrillDownData } from './DrillDownModal'
import { WidgetShell, StatCardGrid, MetricBarList, DataTable, ColumnDef } from '../widgets'
import { cloudwatchService, servicenowService, snowflakeService, postgresService, espService } from '../../services'
import { DonutChart } from '../widgets'
import { useMockData } from '../../context/MockDataContext'
import {
  MOCK_SERVICENOW_TICKETS,
  MOCK_SERVICENOW_INCIDENTS,
  MOCK_SERVICENOW_MISSED_INCIDENTS,
  MOCK_SERVICENOW_INCIDENT_LIST,
  MOCK_SERVICENOW_EMERGENCY_CHANGES,
  MOCK_SERVICENOW_PLATFORMS,
  MOCK_SERVICENOW_BY_CAPABILITY,
  MOCK_SERVICENOW_BY_ASSIGNMENT_GROUP,
} from '../../services/servicenowMockData'

const SEV_CONFIG: Record<string, { color: string; bg: string; dot: string }> = {
  critical: { color: '#c62828', bg: '#fce4ec', dot: '#e53935' },
  high:     { color: '#e65100', bg: '#fff3e0', dot: '#fb8c00' },
  medium:   { color: '#f57c00', bg: '#fff8e1', dot: '#fdd835' },
  low:      { color: '#2e7d32', bg: '#e8f5e9', dot: '#66bb6a' },
}

/** Block drilldown when no platform is selected and total incidents exceed this threshold */
const DRILLDOWN_LIMIT = 10000

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
        titleIcon={<BugReportIcon sx={{ color: '#e53935', fontSize: 18 }} />}
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
            accentColor="#e53935"
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
        titleIcon={<ConfirmationNumberIcon sx={{ color: '#7b1fa2', fontSize: 18 }} />}
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
            accentColor="#7b1fa2"
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
      titleIcon={<StreamIcon sx={{ color: '#1565c0', fontSize: 18 }} />}
      source="CloudWatch"
      loading={loading}
      subheader={
        <Box sx={{ display: 'flex', gap: 0.5, px: 1.5, py: 0.8 }}>
          {['ALL', 'ERROR', 'WARN', 'INFO'].map(f => (
            <Chip key={f} label={f} size="small" onClick={() => setFilter(f)}
              sx={{
                fontSize: '10px', height: 20, cursor: 'pointer',
                backgroundColor: filter === f ? (LOG_COLORS[f] || '#1976d2') : '#f0f0f0',
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
      titleIcon={<AttachMoneyIcon sx={{ color: '#388e3c', fontSize: 18 }} />}
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
      titleIcon={<WorkIcon sx={{ color: '#2e7d32', fontSize: 18 }} />}
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
  const [drillDown, setDrillDown] = useState<DrillDownData | null>(null)
  const [hint, setHint] = useState(false)
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
        title="Critical Incidents (P1 / P2)"
        titleIcon={<WarningAmberIcon sx={{ color: '#c62828', fontSize: 18 }} />}
        source="PostgreSQL · edoops.service_now_inc"
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
                    bg: ({ P1: '#fce4ec', P2: '#fff3e0', P3: '#e8f5e9', P4: '#e3f2fd', P5: '#f5f5f5' } as Record<string,string>)[i.priority_field] || '#f5f5f5',
                  })),
                  { label: 'Total', value: totalIncidents, color: '#1565c0', bg: '#e3f2fd' },
                ]}
                columns={Math.min(incidents.length + 1, 6)}
                compact
                onCardClick={(item, idx) => {
                  if (idx < incidents.length) {
                    const count = item.value as number
                    if (!platform && count > DRILLDOWN_LIMIT) { setHint(true); return }
                    setDrillDown({
                      type: 'sn_priority',
                      data: { priority: item.label, count, source: 'Open Incidents', platform: platform ?? undefined },
                    })
                  }
                }}
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
      <DrillDownModal open={!!drillDown} onClose={() => setDrillDown(null)} drillDown={drillDown} />
      <Snackbar open={hint} autoHideDuration={5000} onClose={() => setHint(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity="info" onClose={() => setHint(false)} sx={{ fontSize: '13px' }}>
          Too many records to display. Select a <strong>platform</strong> using the filter above to drill down into incidents.
        </Alert>
      </Snackbar>
    </>
  )
}

// ─── Missed / Open P3+P4 Incidents Widget (bar chart) ────

export const MissedIncidentsWidget: React.FC<{ platform?: string | null }> = ({ platform }) => {
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [drillDown, setDrillDown] = useState<DrillDownData | null>(null)
  const [hint, setHint] = useState(false)
  const { useMock } = useMockData()

  useEffect(() => {
    setLoading(true); setData([]); setError(null)
    if (useMock) {
      setData(MOCK_SERVICENOW_MISSED_INCIDENTS)
      setLoading(false)
      return
    }
    servicenowService.getMissedIncidents(platform ?? undefined)
      .then(d => { setData(Array.isArray(d) ? d : []); setLoading(false) })
      .catch(err => { setError(err.message || 'Failed to fetch'); setLoading(false) })
  }, [useMock, platform])

  const total = data.reduce((s, r) => s + (r.incident_count || 0), 0)
  const maxCount = Math.max(...data.map(r => r.incident_count || 0), 1)

  return (
    <>
      <WidgetShell
        title="Lower Priority Incidents (P3 / P4)"
        titleIcon={<WarningAmberIcon sx={{ color: '#e65100', fontSize: 18 }} />}
        source="PostgreSQL · edoops.service_now_inc"
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
                    bg: ({ P3: '#e8f5e9', P4: '#e3f2fd' } as Record<string,string>)[r.priority_field] || '#f5f5f5',
                  })),
                  { label: 'Total', value: total, color: '#e65100', bg: '#fff3e0' },
                ]}
                columns={3}
                compact
                onCardClick={(item, idx) => {
                  if (idx < data.length) {
                    const count = item.value as number
                    if (!platform && count > DRILLDOWN_LIMIT) { setHint(true); return }
                    setDrillDown({
                      type: 'sn_priority',
                      data: { priority: item.label, count, source: 'Missed SLA', platform: platform ?? undefined },
                    })
                  }
                }}
              />
            </Box>
            <Box sx={{ px: 2, pb: 1.5, display: 'flex', flexDirection: 'column', gap: 1 }}>
              {data.map(r => {
                const pct = Math.round(((r.incident_count || 0) / maxCount) * 100)
                const color = INCIDENT_COLORS[r.priority_field] || '#757575'
                return (
                  <Box key={r.priority_field}
                    onClick={() => {
                      if (!platform && r.incident_count > DRILLDOWN_LIMIT) { setHint(true); return }
                      setDrillDown({
                        type: 'sn_priority',
                        data: { priority: r.priority_field, count: r.incident_count, source: 'Missed SLA', platform: platform ?? undefined },
                      })
                    }}
                    sx={{ cursor: 'pointer', borderRadius: 1, p: 0.5, '&:hover': { backgroundColor: '#f5f5f5' } }}
                  >
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.4 }}>
                      <Typography sx={{ fontSize: '12px', fontWeight: 600, color: '#333' }}>{r.priority_field}</Typography>
                      <Typography sx={{ fontSize: '12px', color: '#666' }}>{r.incident_count} incidents</Typography>
                    </Box>
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
      <DrillDownModal open={!!drillDown} onClose={() => setDrillDown(null)} drillDown={drillDown} />
      <Snackbar open={hint} autoHideDuration={5000} onClose={() => setHint(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity="info" onClose={() => setHint(false)} sx={{ fontSize: '13px' }}>
          Too many records to display. Select a <strong>platform</strong> using the filter above to drill down into incidents.
        </Alert>
      </Snackbar>
    </>
  )
}

// ─── Incident List Widget (P3/P4 detailed records) ────────

export const IncidentListWidget: React.FC<{ platform?: string | null }> = ({ platform }) => {
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [priorityFilter, setPriorityFilter] = useState('All')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const rowsPerPage = 100
  const { useMock } = useMockData()

  useEffect(() => {
    setLoading(true); setData([]); setError(null)
    if (useMock) {
      setData(MOCK_SERVICENOW_INCIDENT_LIST)
      setLoading(false)
      return
    }
    servicenowService.getIncidentList(platform ?? undefined)
      .then(d => { setData(Array.isArray(d) ? d : []); setLoading(false) })
      .catch(err => { setError(err.message || 'Failed to fetch'); setLoading(false) })
  }, [useMock, platform])

  const filtered = useMemo(() =>
    data
      .filter(r => priorityFilter === 'All' || r.priority_field === priorityFilter)
      .filter(r => !search || [
        r.sninc_inc_num, r.sninc_capability, r.sninc_short_desc, r.sninc_assignment_grp
      ].some(v => (v || '').toLowerCase().includes(search.toLowerCase()))),
  [data, priorityFilter, search])

  // Reset to first page whenever filters change
  const handlePriorityChange = (p: string) => { setPriorityFilter(p); setPage(0) }
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
            backgroundColor: ({ P1: '#fce4ec', P2: '#fff3e0', P3: '#e8f5e9', P4: '#e3f2fd' } as Record<string,string>)[row.priority_field] || '#eee' }} />
      ),
    },
    { key: 'sninc_capability',     header: 'Capability',        width: 140, render: row => <Typography sx={{ fontSize: '11px', color: '#555' }}>{row.sninc_capability || '—'}</Typography> },
    { key: 'sninc_short_desc',     header: 'Description',       flex: 1,    render: row => <Typography sx={{ fontSize: '11px', color: '#333' }}>{row.sninc_short_desc || '—'}</Typography> },
    { key: 'sninc_assignment_grp', header: 'Assignment Group',  width: 150, render: row => <Typography sx={{ fontSize: '11px', color: '#666' }}>{row.sninc_assignment_grp || '—'}</Typography> },
  ]

  return (
    <WidgetShell
      title="Open Incidents"
      titleIcon={<WarningAmberIcon sx={{ color: '#1565c0', fontSize: 18 }} />}
      source="PostgreSQL · edoops.service_now_inc"
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
            {['All', 'P1', 'P2', 'P3', 'P4'].map(p => (
              <Chip key={p} label={p} size="small" onClick={() => handlePriorityChange(p)}
                sx={{
                  fontSize: '10px', height: 22, cursor: 'pointer',
                  fontWeight: priorityFilter === p ? 700 : 400,
                  backgroundColor: priorityFilter === p ? (({ P1: '#fce4ec', P2: '#fff3e0', P3: '#e8f5e9', P4: '#e3f2fd' } as Record<string,string>)[p] ?? '#e3f2fd') : '#f5f5f5',
                  color: priorityFilter === p ? (INCIDENT_COLORS[p] ?? '#1565c0') : '#aaa',
                  border: priorityFilter === p ? `1px solid ${INCIDENT_COLORS[p] ?? '#1565c0'}40` : '1px solid transparent',
                  '& .MuiChip-label': { px: 1 },
                }}
              />
            ))}
            <Typography sx={{ fontSize: '10px', color: '#aaa', ml: 'auto' }}>{filtered.length} records</Typography>
          </Box>
          <Box sx={{ flex: 1, overflowY: 'auto', px: 1.5, pb: 1 }}>
            <DataTable columns={incidentColumns} rows={paginated} rowKey="sninc_inc_num" compact accentColor="#1565c0" />
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

const CAPABILITY_COLORS = ['#1565c0','#2e7d32','#e65100','#7b1fa2','#c62828','#00838f','#37474f']

export const CapabilityWidget: React.FC<{ platform?: string | null }> = ({ platform }) => {
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { useMock } = useMockData()

  useEffect(() => {
    setLoading(true); setData([]); setError(null)
    if (useMock) { setData(MOCK_SERVICENOW_BY_CAPABILITY); setLoading(false); return }
    servicenowService.getByCapability(platform ?? undefined)
      .then(d => { setData(Array.isArray(d) ? d : []); setLoading(false) })
      .catch(err => { setError(err.message || 'Failed to fetch'); setLoading(false) })
  }, [useMock, platform])

  const max = Math.max(...data.map(r => r.incident_count || 0), 1)

  return (
    <WidgetShell
      title="Incidents by Capability"
      titleIcon={<BugReportIcon sx={{ color: '#1565c0', fontSize: 18 }} />}
      source="PostgreSQL · edoops.service_now_inc"
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

export const AssignmentGroupWidget: React.FC<{ platform?: string | null }> = ({ platform }) => {
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { useMock } = useMockData()

  useEffect(() => {
    setLoading(true); setData([]); setError(null)
    if (useMock) { setData(MOCK_SERVICENOW_BY_ASSIGNMENT_GROUP); setLoading(false); return }
    servicenowService.getByAssignmentGroup(platform ?? undefined)
      .then(d => { setData(Array.isArray(d) ? d : []); setLoading(false) })
      .catch(err => { setError(err.message || 'Failed to fetch'); setLoading(false) })
  }, [useMock, platform])

  const total = data.reduce((s, r) => s + (r.incident_count || 0), 0)
  const donutData = data.map((r, i) => ({
    name: r.assignment_group,
    value: r.incident_count || 0,
    color: CAPABILITY_COLORS[i % CAPABILITY_COLORS.length],
  }))

  return (
    <WidgetShell
      title="Incidents by Assignment Group"
      titleIcon={<ConfirmationNumberIcon sx={{ color: '#2e7d32', fontSize: 18 }} />}
      source="PostgreSQL · edoops.service_now_inc"
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

// ─── Emergency Changes Widget ──────────────────────────────

export const EmergencyChangesWidget: React.FC<{ platform?: string | null }> = ({ platform }) => {
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
    servicenowService.getEmergencyChanges(platform ?? undefined)
      .then(d => { setChanges(Array.isArray(d) ? d : []); setLoading(false) })
      .catch(err => { setError(err.message || 'Failed to fetch emergency changes'); setLoading(false) })
  }, [useMock, platform])

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
      source="PostgreSQL · edoops.service_now_chg"
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
                  bg: r.priority_field === 'P1' ? '#fce4ec' : r.priority_field === 'P2' ? '#fff3e0' : '#e8f5e9',
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

// ─── Pipelines Widget ──────────────────────────────────────

const STATUS_CFG: Record<string, { color: string; bg: string; dot: string }> = {
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
              sx={{ height: 18, fontSize: '10px', fontWeight: 700, ...STATUS_CFG[row.status] }} />
          </Box>
          <Box sx={{ display: 'flex', gap: 2, mb: 0.4 }}>
            <Typography sx={{ fontSize: '11px', color: '#777' }}>Success: <b>{row.successRate}%</b></Typography>
            <Typography sx={{ fontSize: '11px', color: '#777' }}>Avg: <b>{row.avgDuration}</b></Typography>
            <Typography sx={{ fontSize: '11px', color: '#777' }}>{row.schedule}</Typography>
          </Box>
          <Box sx={{ height: 4, backgroundColor: '#e0e0e0', borderRadius: 2, overflow: 'hidden' }}>
            <Box sx={{ height: '100%', width: `${row.successRate}%`, backgroundColor: STATUS_CFG[row.status]?.dot || '#aaa', borderRadius: 2 }} />
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

// ─── ServiceNow Dashboard (full-page layout) ───────────────

import SupportAgentIcon from '@mui/icons-material/SupportAgent'

export const ServiceNowDashboard: React.FC<{ onOpenAgent?: (agentId: string) => void }> = ({ onOpenAgent }) => {
  const { useMock } = useMockData()
  const [platforms,        setPlatforms]        = useState<{ platform: string; hasCritical: boolean }[]>([])
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null)
  const [platformsLoading, setPlatformsLoading] = useState(false)

  useEffect(() => {
    setPlatformsLoading(true)
    if (useMock) {
      setPlatforms(MOCK_SERVICENOW_PLATFORMS)
      setPlatformsLoading(false)
      return
    }
    servicenowService.getPlatforms()
      .then(d => { setPlatforms(Array.isArray(d) ? d : []); setPlatformsLoading(false) })
      .catch(() => setPlatformsLoading(false))
  }, [useMock])

  return (
    <Box sx={{ bgcolor: '#f5f6f8', minHeight: '100%', p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>

      {/* ── Header bar ── */}
      <Paper elevation={0} sx={{ borderRadius: 2, border: '1px solid #e8ecf1', bgcolor: '#f8f9fb', overflow: 'hidden', position: 'sticky', top: 0, zIndex: 10, boxShadow: '0 2px 8px rgba(0,0,0,0.07)' }}>
        <Box sx={{ px: 2, py: 1.25, display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
          <SupportAgentIcon sx={{ fontSize: 16, color: '#c62828' }} />
          <Typography sx={{ fontWeight: 700, fontSize: '11px', color: '#555', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
            ServiceNow 
          </Typography>
          {useMock && (
            <Chip label="MOCK DATA" size="small" sx={{ fontSize: '9px', height: 18, bgcolor: '#fff3e0', color: '#f57c00', fontWeight: 700, border: '1px solid #f57c0040' }} />
          )}
          <Autocomplete
              options={platforms}
              getOptionLabel={(opt) => opt.platform}
              value={platforms.find(p => p.platform === selectedPlatform) ?? null}
              onChange={(_, v) => setSelectedPlatform(v?.platform ?? null)}
              isOptionEqualToValue={(opt, val) => opt.platform === val.platform}
              loading={platformsLoading}
              size="small"
              sx={{ minWidth: 220, '& .MuiInputBase-root': { fontSize: '11px' }, '& .MuiInputLabel-root': { fontSize: '11px' } }}
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
          <Typography sx={{ fontSize: '11px', color: '#aaa', ml: 'auto' }}>
            Source: PostgreSQL · edoops.service_now_inc
          </Typography>
          {onOpenAgent && (
            <Button
              size="small"
              variant="contained"
              startIcon={<SmartToyIcon sx={{ fontSize: 14 }} />}
              onClick={() => onOpenAgent('servicenow')}
              sx={{
                backgroundColor: '#5c6bc0',
                textTransform: 'none',
                fontSize: '11px',
                fontWeight: 700,
                height: 28,
                px: 1.5,
                '&:hover': { backgroundColor: '#3949ab', filter: 'brightness(0.9)' },
              }}
            >
              Ask ServiceNow Agent
            </Button>
          )}
        </Box>
      </Paper>

      {/* ── Row 1: Open P1/P2/P3 counts + Missed P3/P4 bar chart ── */}
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, alignItems: 'start' }}>
        <Paper elevation={0} sx={{ borderRadius: 2, overflow: 'hidden', border: '1px solid #e8ecf1', borderTop: '3px solid #c62828', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <IncidentsWidget platform={selectedPlatform} />
        </Paper>
        <Paper elevation={0} sx={{ borderRadius: 2, overflow: 'hidden', border: '1px solid #e8ecf1', borderTop: '3px solid #e65100', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <MissedIncidentsWidget platform={selectedPlatform} />
        </Paper>
      </Box>

      {/* ── Row 2: Incident list (full width) ── */}
      <Paper elevation={0} sx={{ borderRadius: 2, overflow: 'hidden', border: '1px solid #e8ecf1', borderTop: '3px solid #1565c0', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
        <IncidentListWidget platform={selectedPlatform} />
      </Paper>

      {/* ── Row 3: By Capability + By Assignment Group ── */}
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, alignItems: 'start' }}>
        <Paper elevation={0} sx={{ borderRadius: 2, overflow: 'hidden', border: '1px solid #e8ecf1', borderTop: '3px solid #1565c0', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <CapabilityWidget platform={selectedPlatform} />
        </Paper>
        <Paper elevation={0} sx={{ borderRadius: 2, overflow: 'hidden', border: '1px solid #e8ecf1', borderTop: '3px solid #2e7d32', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <AssignmentGroupWidget platform={selectedPlatform} />
        </Paper>
      </Box>

    </Box>
  )
}
