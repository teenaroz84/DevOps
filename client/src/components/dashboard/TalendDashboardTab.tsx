import React, { useState, useEffect, useMemo, useRef } from 'react'
import { Box, Typography, Chip, Paper, CircularProgress, TextField, InputAdornment, Button, Slider, Tooltip } from '@mui/material'
import IntegrationInstructionsIcon from '@mui/icons-material/IntegrationInstructions'
import SearchIcon from '@mui/icons-material/Search'
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline'
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline'
import ListAltIcon from '@mui/icons-material/ListAlt'
import { WidgetShell, StatCardGrid, DonutChart, DataTable, ColumnDef, ComposedBarLineChart } from '../widgets'
import { IncidentListWidget, IncidentsWidget, IncidentTrendWidget } from './DataSourceWidgets'
import { servicenowService, talendService } from '../../services'
import { useMockData } from '../../context/MockDataContext'
import { AGENTS } from '../../config/agentConfig'
import { APP_COLORS, TRUIST } from '../../theme/truistPalette'
import {
  MOCK_TALEND_SUMMARY,
  MOCK_TALEND_LEVEL_COUNTS,
  MOCK_TALEND_RECENT_TASKS,
  MOCK_TALEND_RECENT_ERRORS,
} from '../../services/talendMockData'
import {
  MOCK_SERVICENOW_INCIDENTS,
  MOCK_SERVICENOW_MISSED_INCIDENTS,
} from '../../services/servicenowMockData'

const TALEND_DAY_PRESETS = [30, 60, 90]
const TALEND_SERVICENOW_PLATFORM = 'Talend'

const STATUS_COLOR: Record<string, { color: string; bg: string }> = {
  EXECUTION_SUCCESS: { color: '#2e7d32', bg: '#e8f5e9' },
  SUCCESS:           { color: '#2e7d32', bg: '#e8f5e9' },
  EXECUTION_FAILED:  { color: '#c62828', bg: '#fce4ec' },
  FAILED:            { color: '#c62828', bg: '#fce4ec' },
  EXECUTION_RUNNING: { color: '#f57c00', bg: '#fff8e1' },
  RUNNING:           { color: '#f57c00', bg: '#fff8e1' },
}
const LEVEL_COLOR: Record<string, { color: string; bg: string }> = {
  FATAL: { color: '#c62828', bg: '#fce4ec' },
  ERROR: { color: '#e53935', bg: '#fce4ec' },
  WARN:  { color: '#f57c00', bg: '#fff3e0' },
  INFO:  { color: '#1565c0', bg: '#e3f2fd' },
  DEBUG: { color: '#546e7a', bg: '#eceff1' },
}

const statusLabel = (s: string) =>
  s.replace('EXECUTION_', '').replace('_', ' ')

const fmtTs = (ts: string | null) => {
  if (!ts) return '—'
  try { return new Date(ts).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) }
  catch { return ts }
}

const ExpandableErrorText: React.FC<{ value?: string | null }> = ({ value }) => {
  const [expanded, setExpanded] = useState(false)
  const [showToggle, setShowToggle] = useState(false)
  const textRef = useRef<HTMLDivElement | null>(null)

  const normalizedValue = typeof value === 'string'
    ? value.trim()
    : value == null
      ? ''
      : String(value).trim()

  useEffect(() => {
    setExpanded(false)
  }, [normalizedValue])

  useEffect(() => {
    if (expanded) {
      return
    }

    let frameId = 0

    const measureOverflow = () => {
      const element = textRef.current
      if (!element) return
      setShowToggle(
        element.scrollWidth > element.clientWidth + 1 ||
        element.scrollHeight > element.clientHeight + 1
      )
    }

    frameId = window.requestAnimationFrame(measureOverflow)
    window.addEventListener('resize', measureOverflow)
    return () => {
      window.cancelAnimationFrame(frameId)
      window.removeEventListener('resize', measureOverflow)
    }
  }, [normalizedValue, expanded])

  if (!normalizedValue) {
    return <Typography sx={{ fontSize: '11px', color: '#bbb' }}>—</Typography>
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 0.5, width: '100%' }}>
      <Typography
        component="div"
        ref={textRef}
        sx={{
          fontSize: '11px',
          color: '#444',
          lineHeight: 1.4,
          whiteSpace: expanded ? 'pre-wrap' : 'nowrap',
          wordBreak: 'break-word',
          width: '100%',
          maxWidth: '100%',
          ...(expanded ? {} : {
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }),
        }}
      >
        {normalizedValue}
      </Typography>
      {showToggle && (
        <Button
          size="small"
          onClick={() => setExpanded(prev => !prev)}
          sx={{
            minWidth: 0,
            px: 0,
            py: 0,
            fontSize: '10px',
            fontWeight: 700,
            textTransform: 'none',
            color: '#1565c0',
            '&:hover': { backgroundColor: 'transparent', color: '#0d47a1' },
          }}
        >
          {expanded ? 'Show less' : 'Show more'}
        </Button>
      )}
    </Box>
  )
}

export const TalendDashboardTab: React.FC<{ onOpenAgent?: (agentId: string) => void }> = ({ onOpenAgent }) => {
  const { useMock } = useMockData()
  const summaryRequestIdRef = useRef(0)
  const serviceNowKpisRequestIdRef = useRef(0)
  const levelCountsRequestIdRef = useRef(0)
  const recentTasksRequestIdRef = useRef(0)
  const recentErrorsRequestIdRef = useRef(0)

  const [summary,      setSummary]      = useState<any>(null)
  const [summaryLoading, setSummaryLoading] = useState(true)
  const [summaryError, setSummaryError] = useState<string | null>(null)
  const [serviceNowKpisLoading, setServiceNowKpisLoading] = useState(true)
  const [serviceNowKpisError, setServiceNowKpisError] = useState<string | null>(null)
  const [serviceNowOpenIncidents, setServiceNowOpenIncidents] = useState<any[]>([])
  const [serviceNowMissedIncidents, setServiceNowMissedIncidents] = useState<any[]>([])
  const [levelCounts,  setLevelCounts]  = useState<any[]>([])
  const [levelCountsLoading, setLevelCountsLoading] = useState(true)
  const [levelCountsError, setLevelCountsError] = useState<string | null>(null)
  const [recentTasks,  setRecentTasks]  = useState<any[]>([])
  const [recentTasksLoading, setRecentTasksLoading] = useState(true)
  const [recentTasksError, setRecentTasksError] = useState<string | null>(null)
  const [recentErrors, setRecentErrors] = useState<any[]>([])
  const [recentErrorsLoading, setRecentErrorsLoading] = useState(true)
  const [recentErrorsError, setRecentErrorsError] = useState<string | null>(null)
  const [taskSearch,   setTaskSearch]   = useState('')
  const [statusFilter, setStatusFilter] = useState('All')
  const [levelFilter,  setLevelFilter]  = useState('All')
  const [days,         setDays]         = useState(15)
  const [selectedDays, setSelectedDays] = useState(15)
  const [sliderDays,   setSliderDays]   = useState(15)

  const commitDays = (nextDays: number) => {
    if (nextDays === days) {
      setSelectedDays(nextDays)
      setSliderDays(nextDays)
      return
    }
    setSelectedDays(nextDays)
    setSliderDays(nextDays)
    setSummaryLoading(true)
    setLevelCountsLoading(true)
    setRecentTasksLoading(true)
    setRecentErrorsLoading(true)
    setDays(prev => prev === nextDays ? prev : nextDays)
  }

  useEffect(() => {
    setSliderDays(days)
  }, [days])

  useEffect(() => {
    setSelectedDays(days)
  }, [days])

  useEffect(() => {
    const requestId = ++summaryRequestIdRef.current
    setSummaryLoading(true)
    setSummaryError(null)
    if (useMock) {
      setSummary(MOCK_TALEND_SUMMARY)
      setSummaryLoading(false)
      return
    }
    talendService.getSummary(days)
      .then((data) => {
        if (requestId !== summaryRequestIdRef.current) return
        setSummary(data)
        setSummaryLoading(false)
      })
      .catch((err) => {
        if (requestId !== summaryRequestIdRef.current) return
        setSummaryError(err.message || 'Failed to load Talend summary')
        setSummaryLoading(false)
      })
  }, [useMock, days])

  useEffect(() => {
    const requestId = ++serviceNowKpisRequestIdRef.current
    setServiceNowKpisLoading(true)
    setServiceNowKpisError(null)

    if (useMock) {
      setServiceNowOpenIncidents(MOCK_SERVICENOW_INCIDENTS)
      setServiceNowMissedIncidents(MOCK_SERVICENOW_MISSED_INCIDENTS)
      setServiceNowKpisLoading(false)
      return
    }

    Promise.all([
      servicenowService.getIncidents(TALEND_SERVICENOW_PLATFORM),
      servicenowService.getMissedIncidents(TALEND_SERVICENOW_PLATFORM, days),
    ])
      .then(([openData, missedData]) => {
        if (requestId !== serviceNowKpisRequestIdRef.current) return
        setServiceNowOpenIncidents(Array.isArray(openData) ? openData : [])
        setServiceNowMissedIncidents(Array.isArray(missedData) ? missedData : [])
        setServiceNowKpisLoading(false)
      })
      .catch((err) => {
        if (requestId !== serviceNowKpisRequestIdRef.current) return
        setServiceNowKpisError(err.message || 'Failed to load Talend ServiceNow KPIs')
        setServiceNowKpisLoading(false)
      })
  }, [useMock, days])

  useEffect(() => {
    const requestId = ++levelCountsRequestIdRef.current
    setLevelCountsLoading(true)
    setLevelCountsError(null)
    if (useMock) {
      setLevelCounts(MOCK_TALEND_LEVEL_COUNTS)
      setLevelCountsLoading(false)
      return
    }
    talendService.getLevelCounts(days)
      .then((data) => {
        if (requestId !== levelCountsRequestIdRef.current) return
        setLevelCounts(Array.isArray(data) ? data : [])
        setLevelCountsLoading(false)
      })
      .catch((err) => {
        if (requestId !== levelCountsRequestIdRef.current) return
        setLevelCountsError(err.message || 'Failed to load log level distribution')
        setLevelCountsLoading(false)
      })
  }, [useMock, days])

  useEffect(() => {
    const requestId = ++recentTasksRequestIdRef.current
    setRecentTasksLoading(true)
    setRecentTasksError(null)
    if (useMock) {
      setRecentTasks(MOCK_TALEND_RECENT_TASKS)
      setRecentTasksLoading(false)
      return
    }
    talendService.getRecentTasks(days)
      .then((data) => {
        if (requestId !== recentTasksRequestIdRef.current) return
        setRecentTasks(Array.isArray(data) ? data : [])
        setRecentTasksLoading(false)
      })
      .catch((err) => {
        if (requestId !== recentTasksRequestIdRef.current) return
        setRecentTasksError(err.message || 'Failed to load recent tasks')
        setRecentTasksLoading(false)
      })
  }, [useMock, days])

  useEffect(() => {
    const requestId = ++recentErrorsRequestIdRef.current
    setRecentErrorsLoading(true)
    setRecentErrorsError(null)
    if (useMock) {
      setRecentErrors(MOCK_TALEND_RECENT_ERRORS)
      setRecentErrorsLoading(false)
      return
    }
    talendService.getRecentErrors(days)
      .then((data) => {
        if (requestId !== recentErrorsRequestIdRef.current) return
        setRecentErrors(Array.isArray(data) ? data : [])
        setRecentErrorsLoading(false)
      })
      .catch((err) => {
        if (requestId !== recentErrorsRequestIdRef.current) return
        setRecentErrorsError(err.message || 'Failed to load recent errors')
        setRecentErrorsLoading(false)
      })
  }, [useMock, days])

  // ── Filtered rows ──────────────────────────────────────────
  const filteredTasks = useMemo(() =>
    recentTasks
      .filter(t => statusFilter === 'All' || String(t.execution_status || '').toUpperCase().includes(statusFilter))
      .filter(t => !taskSearch || (t.task_name || '').toLowerCase().includes(taskSearch.toLowerCase())),
  [recentTasks, statusFilter, taskSearch])

  const filteredErrors = useMemo(() =>
    recentErrors
      .filter(e => levelFilter === 'All' || String(e.derived_level || '').toUpperCase() === levelFilter)
      .filter(e => !taskSearch || (e.task_name || '').toLowerCase().includes(taskSearch.toLowerCase())),
  [recentErrors, levelFilter, taskSearch])

  // ── Derived summary stats ─────────────────────────────────
  const statusBreakdown: any[] = summary?.statusBreakdown ?? []
  const total   = statusBreakdown.reduce((s: number, r: any) => s + r.count, 0)
  const success = statusBreakdown.find((r: any) => r.status?.includes('SUCCESS'))?.count ?? 0
  const failed  = statusBreakdown.find((r: any) => r.status?.includes('FAILED'))?.count  ?? 0
  const serviceNowOpenTotal = serviceNowOpenIncidents.reduce((sum, row) => sum + (row.incident_count || 0), 0)
  const serviceNowIncidentVolume = serviceNowMissedIncidents.reduce((sum, row) => sum + (row.incident_count || 0), 0)
  const serviceNowSlaBreaches = serviceNowMissedIncidents.reduce((sum, row) => sum + (row.breached_count || 0), 0)

  const statCards = [
    { label: 'Total Executions', value: total,        color: '#1565c0', bg: '#e3f2fd' },
    { label: 'Success',          value: success,      color: '#2e7d32', bg: '#e8f5e9' },
    { label: 'Failed',           value: failed,       color: '#c62828', bg: '#fce4ec' },
    // { label: 'Running',          value: running,      color: '#f57c00', bg: '#fff8e1' },
    // { label: 'Success Rate',     value: `${successRate}%`, color: successRate >= 90 ? '#2e7d32' : '#c62828', bg: successRate >= 90 ? '#e8f5e9' : '#fce4ec' },
    // { label: 'FATAL Logs',       value: fatal,        color: fatal > 0 ? '#c62828' : '#2e7d32', bg: fatal > 0 ? '#fce4ec' : '#e8f5e9' },
    { label: 'SN Open Incidents', value: serviceNowOpenTotal, color: '#8e24aa', bg: '#f3e5f5' },
    { label: `SN Volume ${days}d`, value: serviceNowIncidentVolume, color: '#1565c0', bg: '#e3f2fd' },
    { label: 'SN SLA Breaches', value: serviceNowSlaBreaches, color: '#ef6c00', bg: '#fff3e0' },
  ]

  const donutData = statusBreakdown.map((r: any) => ({
    name:  statusLabel(r.status),
    value: r.count,
    color: STATUS_COLOR[r.status]?.color || '#78909c',
  }))

  const levelBarData = levelCounts.map((r: any) => ({
    name:  r.level,
    count: r.count,
  }))
  const hasAnyData = summary !== null || levelCounts.length > 0 || recentTasks.length > 0 || recentErrors.length > 0
  const initialLoading = !hasAnyData && (summaryLoading || levelCountsLoading || recentTasksLoading || recentErrorsLoading)

  // ── Task table columns ────────────────────────────────────
  const taskCols: ColumnDef[] = [
    {
      key: 'task_name', header: 'Task Name', flex: 1.2,
      render: row => (
        <Tooltip title={`AArtifact Name: ${row.artifact_name || 'N/A'}`} arrow>
          <Box>
            <Typography sx={{ fontSize: '12px', fontWeight: 600, color: '#222' }}>{row.task_name || '—'}</Typography>
            <Typography sx={{ fontSize: '10px', color: '#999' }}>{row.artifact_name} v{row.artifact_version}</Typography>
          </Box>
        </Tooltip>
      ),
    },
    { key: 'task_id', header: 'Task ID', width: 180, render: row => <Typography sx={{ fontSize: '11px', color: '#666' }}>{row.task_id || '—'}</Typography> },
    { key: 'task_execution_id', header: 'Execution ID', width: 200, render: row => <Typography sx={{ fontSize: '10px', color: '#666', fontFamily: 'monospace' }}>{row.task_execution_id || '—'}</Typography> },
    {
      key: 'execution_status', header: 'Status', width: 110,
      render: row => {
        const key = String(row.execution_status || '').toUpperCase()
        const cfg = STATUS_COLOR[key] || { color: '#546e7a', bg: '#eceff1' }
        return (
          <Chip label={statusLabel(row.execution_status || '—')} size="small"
            sx={{ height: 20, fontSize: '10px', fontWeight: 700, color: cfg.color, backgroundColor: cfg.bg }} />
        )
      },
    },
    { key: 'workspace_name',    header: 'Workspace',   width: 140, render: row => <Typography sx={{ fontSize: '11px', color: '#666' }}>{row.workspace_name || '—'}</Typography> },
    { key: 'remote_engine_name',header: 'Engine',      width: 160, render: row => <Typography sx={{ fontSize: '11px', color: '#666' }}>{row.remote_engine_name || '—'}</Typography> },
    { key: 'run_type',          header: 'Run Type',    width: 100,  render: row => <Typography sx={{ fontSize: '11px', color: '#888' }}>{row.run_type || '—'}</Typography> },
    { key: 'start_timestamp', header: 'Executed',  width: 140, render: row => <Typography sx={{ fontSize: '11px', color: '#888' }}>{fmtTs(row.start_timestamp)}</Typography> },
  ]

  // ── Error log table columns ───────────────────────────────
  const errorCols: ColumnDef[] = [
    {
      key: 'derived_level', header: 'Level', width: 80,
      render: row => {
        const cfg = LEVEL_COLOR[String(row.derived_level || '').toUpperCase()] || { color: '#546e7a', bg: '#eceff1' }
        return (
          <Chip label={row.derived_level || '—'} size="small"
            sx={{ height: 20, fontSize: '10px', fontWeight: 700, color: cfg.color, backgroundColor: cfg.bg }} />
        )
      },
    },
    {
      key: 'execution_status', header: 'Exec Status', width: 150,
      render: row => {
        const s = String(row.execution_status || '').toUpperCase()
        const color = s.includes('FAIL') ? '#d32f2f' : s.includes('RUNNING') ? '#f57c00' : '#546e7a'
        const bg    = s.includes('FAIL') ? '#ffebee'  : s.includes('RUNNING') ? '#fff3e0'  : '#eceff1'
        return (
          <Chip label={row.execution_status || '—'} size="small"
            sx={{ height: 20, fontSize: '10px', fontWeight: 600, color, backgroundColor: bg, '& .MuiChip-label': { px: 1 } }} />
        )
      },
    },
    {
      key: 'task_name', header: 'Task / Artifact', flex: 1.1,
      render: row => (
        <Tooltip title={`Artifact Name: ${row.artifact_name || 'N/A'}`} arrow>
          <Box>
            <Typography sx={{ fontSize: '11px', fontWeight: 600, color: '#333' }}>{row.task_name || '—'}</Typography>
            <Typography sx={{ fontSize: '10px', color: '#bbb' }}>{row.artifact_name}</Typography>
          </Box>
        </Tooltip>
      ),
    },
    {
      key: 'err_message_desc', header: 'Error Details', flex: 1.4,
      render: row => <ExpandableErrorText value={row.err_message_desc} />,
      disableSort: true,
    },
    { key: 'task_id', header: 'Task ID', width: 180, render: row => <Typography sx={{ fontSize: '11px', color: '#666' }}>{row.task_id || '—'}</Typography> },
    { key: 'task_execution_id', header: 'Execution ID', width: 200, render: row => <Typography sx={{ fontSize: '10px', color: '#666', fontFamily: 'monospace' }}>{row.task_execution_id || '—'}</Typography> },
    {
      key: 'fatal_count', header: 'Fatal', width: 70, align: 'right',
      render: row => (
        <Typography sx={{ fontSize: '11px', fontWeight: row.fatal_count > 0 ? 700 : 400, color: row.fatal_count > 0 ? '#c62828' : '#ccc' }}>
          {row.fatal_count ?? 0}
        </Typography>
      ),
    },
    {
      key: 'error_count', header: 'Error', width: 70, align: 'right',
      render: row => (
        <Typography sx={{ fontSize: '11px', fontWeight: row.error_count > 0 ? 700 : 400, color: row.error_count > 0 ? '#e53935' : '#ccc' }}>
          {row.error_count ?? 0}
        </Typography>
      ),
    },
    {
      key: 'warn_count', header: 'Warn', width: 70, align: 'right',
      render: row => (
        <Typography sx={{ fontSize: '11px', fontWeight: row.warn_count > 0 ? 700 : 400, color: row.warn_count > 0 ? '#f57c00' : '#ccc' }}>
          {row.warn_count ?? 0}
        </Typography>
      ),
    },
    { key: 'workspace_name',    header: 'Workspace', width: 140, render: row => <Typography sx={{ fontSize: '10px', color: '#888' }}>{row.workspace_name || '—'}</Typography> },
    { key: 'remote_engine_name', header: 'Engine',   width: 160, render: row => <Typography sx={{ fontSize: '10px', color: '#888' }}>{row.remote_engine_name || '—'}</Typography> },
    { key: 'start_timestamp',   header: 'Time',      width: 140, render: row => <Typography sx={{ fontSize: '10px', color: '#aaa' }}>{fmtTs(row.start_timestamp)}</Typography> },
  ]

  return (
    <Box sx={{ bgcolor: '#f5f6f8', minHeight: '100%', p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>

      {/* ── Header bar ── */}
      <Paper elevation={0} sx={{ borderRadius: 2, border: '1px solid #e8ecf1', bgcolor: '#f8f9fb', overflow: 'hidden', position: 'sticky', top: 0, zIndex: 10, boxShadow: '0 2px 8px rgba(0,0,0,0.07)' }}>
        <Box sx={{ px: 2, py: 1.25, display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
          <IntegrationInstructionsIcon sx={{ fontSize: 16, color: '#e65100' }} />
          <Typography sx={{ fontWeight: 700, fontSize: '11px', color: '#555', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
            Talend Logs
          </Typography>
          {useMock && (
            <Chip label="MOCK DATA" size="small" sx={{ fontSize: '9px', height: 18, bgcolor: '#fff3e0', color: '#f57c00', fontWeight: 700, border: '1px solid #f57c0040' }} />
          )}
          <Typography sx={{ fontSize: '11px', color: '#aaa', ml: 'auto' }}>
            Source: edoops.talend_logs_dashboard
          </Typography>

          {/* ── Date range slider ── */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, ml: 2, minWidth: 220 }}>
            <Typography sx={{ fontSize: '11px', color: '#777', whiteSpace: 'nowrap' }}>Last {sliderDays}d</Typography>
            <Slider
              value={sliderDays}
              min={1}
              max={90}
              step={1}
              onChange={(_e, v) => setSliderDays(v as number)}
              onChangeCommitted={(_e, v) => commitDays(v as number)}
              size="small"
              sx={{
                color: '#e65100',
                width: 140,
                '& .MuiSlider-thumb': { width: 12, height: 12 },
                '& .MuiSlider-rail': { opacity: 0.3 },
              }}
            />
            <Typography sx={{ fontSize: '10px', color: '#bbb', whiteSpace: 'nowrap' }}>90d</Typography>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
            {TALEND_DAY_PRESETS.map((presetDays) => {
              const isActive = selectedDays === presetDays
              return (
                <Chip
                  key={presetDays}
                  label={`${presetDays}d`}
                  size="small"
                  onClick={() => commitDays(presetDays)}
                  sx={{
                    height: 22,
                    fontSize: '10px',
                    fontWeight: isActive ? 700 : 500,
                    cursor: 'pointer',
                    backgroundColor: isActive ? '#fff3e0' : '#f5f5f5',
                    color: isActive ? '#e65100' : '#78909c',
                    border: isActive ? '1px solid #e6510040' : '1px solid transparent',
                    '& .MuiChip-label': { px: 1 },
                  }}
                />
              )
            })}
          </Box>

          {onOpenAgent && (
            <Button
              size="small"
              variant="contained"
              startIcon={<Box component="img" src={AGENTS.talend.icon} alt="Talend agent icon" sx={{ width: 14, height: 14, borderRadius: '50%', objectFit: 'contain', display: 'block' }} />}
              onClick={() => onOpenAgent('talend')}
              sx={{
                backgroundColor: APP_COLORS.primary,
                textTransform: 'none',
                fontSize: '11px',
                fontWeight: 700,
                height: 28,
                px: 1.5,
                color: TRUIST.white,
                '&:hover': { backgroundColor: TRUIST.dusk },
              }}
            >
              Ask Talend Agent
            </Button>
          )}
        </Box>
      </Paper>

      {/* ── Loading ── */}
      {initialLoading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress sx={{ color: '#e65100' }} />
        </Box>
      )}

      {!initialLoading && (
        <>
          {/* ── Row 1: Stat cards ── */}
          <Paper elevation={0} sx={{ borderRadius: 2, overflow: 'hidden', border: '1px solid #e8ecf1', borderTop: '3px solid #e65100', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <WidgetShell
              title="Talend Execution Summary"
              titleIcon={<IntegrationInstructionsIcon sx={{ color: '#e65100', fontSize: 18 }} />}
              source="edoops.talend_logs_dashboard"
              loading={summaryLoading || serviceNowKpisLoading}
              error={summaryError ?? serviceNowKpisError ?? undefined}
            >
              <Box sx={{ px: 1.5, py: 1 }}>
                <StatCardGrid items={statCards} columns={6} compact />
              </Box>
            </WidgetShell>
          </Paper>

          {/* ── Row 2: Status donut + Log level bar chart ── */}
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1.6fr', gap: 2, alignItems: 'start' }}>
            <Paper elevation={0} sx={{ borderRadius: 2, overflow: 'hidden', border: '1px solid #e8ecf1', borderTop: '3px solid #2e7d32', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
              <WidgetShell
                title="Execution Status Breakdown"
                titleIcon={<CheckCircleOutlineIcon sx={{ color: '#2e7d32', fontSize: 18 }} />}
                source="edoops.talend_logs_dashboard"
                loading={summaryLoading}
                error={summaryError ?? undefined}
              >
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 1 }}>
                  <DonutChart data={donutData} centerLabel={total} showLegend size={150} />
                </Box>
              </WidgetShell>
            </Paper>

            <Paper elevation={0} sx={{ borderRadius: 2, overflow: 'hidden', border: '1px solid #e8ecf1', borderTop: '3px solid #1565c0', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
              <WidgetShell
                title="Log Level Distribution"
                titleIcon={<ErrorOutlineIcon sx={{ color: '#c62828', fontSize: 18 }} />}
                source="edoops.talend_logs_dashboard · fatal_count / error_count / warn_count / info_count"
                loading={levelCountsLoading}
                error={levelCountsError ?? undefined}
              >
                <Box sx={{ px: 1, py: 1 }}>
                  <ComposedBarLineChart
                    data={levelBarData}
                    xKey="name"
                    bars={[{ key: 'count', label: 'Log Count', color: '#e65100' }]}
                    lines={[]}
                    height={180}
                    margin={{ top: 24, right: 35, left: 0, bottom: 5 }}
                    showBarLabels
                  />
                </Box>
              </WidgetShell>
            </Paper>
          </Box>

          {/* ── Row 3: Recent task executions table ── */}
          <Paper elevation={0} sx={{ borderRadius: 2, overflow: 'hidden', border: '1px solid #e8ecf1', borderTop: '3px solid #1565c0', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <WidgetShell
              title="Recent Task Executions"
              titleIcon={<ListAltIcon sx={{ color: '#1565c0', fontSize: 18 }} />}
              source="edoops.talend_logs_dashboard · latest 50"
              loading={recentTasksLoading}
              error={recentTasksError ?? undefined}
            >
              <Box sx={{ px: 1.5, pt: 1, pb: 0, display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
                <TextField
                  size="small"
                  placeholder="Search task name…"
                  value={taskSearch}
                  onChange={e => setTaskSearch(e.target.value)}
                  InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon sx={{ fontSize: 15, color: '#aaa' }} /></InputAdornment> }}
                  sx={{ minWidth: 200, '& .MuiOutlinedInput-root': { fontSize: '11px', borderRadius: 2 } }}
                />
                {['All', 'SUCCESS', 'FAILED', 'RUNNING'].map(s => (
                  <Chip
                    key={s}
                    label={s}
                    size="small"
                    onClick={() => setStatusFilter(s)}
                    sx={{
                      fontSize: '10px', height: 22, cursor: 'pointer',
                      fontWeight: statusFilter === s ? 700 : 400,
                      backgroundColor: statusFilter === s ? (STATUS_COLOR[s]?.bg ?? '#e3f2fd') : '#f5f5f5',
                      color: statusFilter === s ? (STATUS_COLOR[s]?.color ?? '#1565c0') : '#aaa',
                      border: statusFilter === s ? `1px solid ${STATUS_COLOR[s]?.color ?? '#1565c0'}40` : '1px solid transparent',
                      '& .MuiChip-label': { px: 1 },
                    }}
                  />
                ))}
                <Typography sx={{ fontSize: '10px', color: '#aaa', ml: 'auto' }}>{filteredTasks.length} tasks</Typography>
              </Box>
              <Box sx={{ px: 1.5, pb: 1.5 }}>
                <DataTable
                  columns={taskCols}
                  rows={filteredTasks}
                  rowKey="task_execution_id"
                  compact
                  accentColor="#e65100"
                  maxHeight={280}
                  tableMinWidth={1200}
                  defaultSortKey="start_timestamp"
                  defaultSortDir="desc"
                />
              </Box>
            </WidgetShell>
          </Paper>

          {/* ── Row 4: FATAL / ERROR log entries ── */}
          <Paper elevation={0} sx={{ borderRadius: 2, overflow: 'hidden', border: '1px solid #e8ecf1', borderTop: '3px solid #c62828', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <WidgetShell
              title="Recent Errors & Fatal Logs"
              titleIcon={<ErrorOutlineIcon sx={{ color: '#c62828', fontSize: 18 }} />}
              source="edoops.talend_logs_dashboard · execution_status NOT IN (SUCCESS) · latest"
              loading={recentErrorsLoading}
              error={recentErrorsError ?? undefined}
            >
              <Box sx={{ px: 1.5, pt: 1, pb: 0, display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
                {['All', 'FATAL', 'ERROR', 'WARN'].map(l => (
                  <Chip
                    key={l}
                    label={l}
                    size="small"
                    onClick={() => setLevelFilter(l)}
                    sx={{
                      fontSize: '10px', height: 22, cursor: 'pointer',
                      fontWeight: levelFilter === l ? 700 : 400,
                      backgroundColor: levelFilter === l ? (LEVEL_COLOR[l]?.bg ?? '#eceff1') : '#f5f5f5',
                      color: levelFilter === l ? (LEVEL_COLOR[l]?.color ?? '#546e7a') : '#aaa',
                      border: levelFilter === l ? `1px solid ${LEVEL_COLOR[l]?.color ?? '#546e7a'}40` : '1px solid transparent',
                      '& .MuiChip-label': { px: 1 },
                    }}
                  />
                ))}
                <Typography sx={{ fontSize: '10px', color: '#aaa', ml: 'auto' }}>{filteredErrors.length} entries</Typography>
              </Box>
              <Box sx={{ px: 1.5, pb: 1.5 }}>
                <DataTable
                  columns={errorCols}
                  rows={filteredErrors}
                  rowKey="start_timestamp"
                  compact
                  accentColor="#c62828"
                  maxHeight={420}
                  tableMinWidth={1600}
                  defaultSortKey="start_timestamp"
                  defaultSortDir="desc"
                />
              </Box>
            </WidgetShell>
          </Paper>
          {/* ── Row 5: Talend-specific ServiceNow incidents ── */}
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1.35fr', gap: 2, alignItems: 'stretch' }}>
            <Paper elevation={0} sx={{ borderRadius: 2, overflow: 'hidden', border: '1px solid #e8ecf1', borderTop: '3px solid #c62828', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
              <IncidentsWidget platform={TALEND_SERVICENOW_PLATFORM} />
            </Paper>

            <Paper elevation={0} sx={{ borderRadius: 2, overflow: 'hidden', border: '1px solid #e8ecf1', borderTop: '3px solid #7b1fa2', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
              <IncidentTrendWidget platform={TALEND_SERVICENOW_PLATFORM} days={days} />
            </Paper>
          </Box>

          <Paper elevation={0} sx={{ borderRadius: 2, overflow: 'hidden', border: '1px solid #e8ecf1', borderTop: '3px solid #7b1fa2', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <IncidentListWidget platform={TALEND_SERVICENOW_PLATFORM} days={days} />
          </Paper>
        </>
      )}

    </Box>
  )
}
