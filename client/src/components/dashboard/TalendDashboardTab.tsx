import React, { useState, useEffect, useMemo, useRef } from 'react'
import { Box, Typography, Chip, Paper, CircularProgress, TextField, InputAdornment, Button, Slider, Tooltip } from '@mui/material'
import IntegrationInstructionsIcon from '@mui/icons-material/IntegrationInstructions'
import SearchIcon from '@mui/icons-material/Search'
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline'
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline'
import ListAltIcon from '@mui/icons-material/ListAlt'
import { WidgetShell, StatCardGrid, DonutChart, DataTable, ColumnDef, ComposedBarLineChart } from '../widgets'
import { talendService } from '../../services'
import { useMockData } from '../../context/MockDataContext'
import { AGENTS } from '../../config/agentConfig'
import { APP_COLORS, TRUIST } from '../../theme/truistPalette'
import {
  MOCK_TALEND_SUMMARY,
  MOCK_TALEND_LEVEL_COUNTS,
  MOCK_TALEND_RECENT_TASKS,
  MOCK_TALEND_RECENT_ERRORS,
} from '../../services/talendMockData'

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

  const [summary,      setSummary]      = useState<any>(null)
  const [levelCounts,  setLevelCounts]  = useState<any[]>([])
  const [recentTasks,  setRecentTasks]  = useState<any[]>([])
  const [recentErrors, setRecentErrors] = useState<any[]>([])
  const [loading,      setLoading]      = useState(true)
  const [error,        setError]        = useState<string | null>(null)
  const [taskSearch,   setTaskSearch]   = useState('')
  const [statusFilter, setStatusFilter] = useState('All')
  const [levelFilter,  setLevelFilter]  = useState('All')
  const [days,         setDays]         = useState(7)

  useEffect(() => {
    setLoading(true)
    setError(null)
    setSummary(null)
    setLevelCounts([])
    setRecentTasks([])
    setRecentErrors([])
    if (useMock) {
      setSummary(MOCK_TALEND_SUMMARY)
      setLevelCounts(MOCK_TALEND_LEVEL_COUNTS)
      setRecentTasks(MOCK_TALEND_RECENT_TASKS)
      setRecentErrors(MOCK_TALEND_RECENT_ERRORS)
      setLoading(false)
      return
    }
    Promise.all([
      talendService.getSummary(days),
      talendService.getLevelCounts(days),
      talendService.getRecentTasks(days),
      talendService.getRecentErrors(days),
    ])
      .then(([s, lc, rt, re]) => {
        setSummary(s)
        setLevelCounts(Array.isArray(lc) ? lc : [])
        setRecentTasks(Array.isArray(rt) ? rt : [])
        setRecentErrors(Array.isArray(re) ? re : [])
        setLoading(false)
      })
      .catch(err => { setError(err.message || 'Failed to load Talend data'); setLoading(false) })
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
  const running = statusBreakdown.find((r: any) => r.status?.includes('RUNNING'))?.count ?? 0
  const fatal   = levelCounts.find((r: any) => r.level === 'FATAL')?.count ?? 0
  const successRate = total > 0 ? Math.round((success / total) * 100) : 0

  const statCards = [
    { label: 'Total Executions', value: total,        color: '#1565c0', bg: '#e3f2fd' },
    { label: 'Success',          value: success,      color: '#2e7d32', bg: '#e8f5e9' },
    { label: 'Failed',           value: failed,       color: '#c62828', bg: '#fce4ec' },
    { label: 'Running',          value: running,      color: '#f57c00', bg: '#fff8e1' },
    { label: 'Success Rate',     value: `${successRate}%`, color: successRate >= 90 ? '#2e7d32' : '#c62828', bg: successRate >= 90 ? '#e8f5e9' : '#fce4ec' },
    { label: 'FATAL Logs',       value: fatal,        color: fatal > 0 ? '#c62828' : '#2e7d32', bg: fatal > 0 ? '#fce4ec' : '#e8f5e9' },
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

  // ── Task table columns ────────────────────────────────────
  const taskCols: ColumnDef[] = [
    {
      key: 'task_name', header: 'Task Name', flex: 1.2,
      render: row => (
        <Tooltip title={`Artifact ID: ${row.artifact_id || 'N/A'}\nArtifact Name: ${row.artifact_name || 'N/A'}`} arrow>
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
    { key: 'count_of_attempts', header: 'Attempts',   width: 90,  align: 'right', render: row => <Typography sx={{ fontSize: '11px', color: '#888' }}>{row.count_of_attempts ?? '—'}</Typography> },
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
      key: 'task_name', header: 'Task / Artifact', flex: 1.1,
      render: row => (
        <Tooltip title={`Artifact ID: ${row.artifact_id || 'N/A'}\nArtifact Name: ${row.artifact_name || 'N/A'}`} arrow>
          <Box>
            <Typography sx={{ fontSize: '11px', fontWeight: 600, color: '#333' }}>{row.task_name || '—'}</Typography>
            <Typography sx={{ fontSize: '10px', color: '#bbb' }}>{row.artifact_name}</Typography>
          </Box>
        </Tooltip>
      ),
    },
    { key: 'task_id', header: 'Task ID', width: 180, render: row => <Typography sx={{ fontSize: '11px', color: '#666' }}>{row.task_id || '—'}</Typography> },
    { key: 'task_execution_id', header: 'Execution ID', width: 200, render: row => <Typography sx={{ fontSize: '10px', color: '#666', fontFamily: 'monospace' }}>{row.task_execution_id || '—'}</Typography> },
    {
      key: 'err_message_desc', header: 'Error Details', flex: 1.4,
      render: row => <ExpandableErrorText value={row.err_message_desc} />,
      disableSort: true,
    },
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
            Source: PostgreSQL · edoops.talend_logs_dashboard
          </Typography>

          {/* ── Date range slider ── */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, ml: 2, minWidth: 220 }}>
            <Typography sx={{ fontSize: '11px', color: '#777', whiteSpace: 'nowrap' }}>Last {days}d</Typography>
            <Slider
              value={days}
              min={1}
              max={15}
              step={1}
              onChange={(_e, v) => setDays(v as number)}
              size="small"
              sx={{
                color: '#e65100',
                width: 140,
                '& .MuiSlider-thumb': { width: 12, height: 12 },
                '& .MuiSlider-rail': { opacity: 0.3 },
              }}
            />
            <Typography sx={{ fontSize: '10px', color: '#bbb', whiteSpace: 'nowrap' }}>15d</Typography>
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
      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress sx={{ color: '#e65100' }} />
        </Box>
      )}

      {/* ── Error ── */}
      {error && !loading && (
        <Paper elevation={0} sx={{ borderRadius: 2, p: 4, textAlign: 'center', border: '1px solid #fce4ec', bgcolor: '#fff8f8' }}>
          <Typography sx={{ fontSize: '13px', color: '#c62828' }}>{error}</Typography>
        </Paper>
      )}

      {!loading && !error && (
        <>
          {/* ── Row 1: Stat cards ── */}
          <Paper elevation={0} sx={{ borderRadius: 2, overflow: 'hidden', border: '1px solid #e8ecf1', borderTop: '3px solid #e65100', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <WidgetShell
              title="Talend Execution Summary"
              titleIcon={<IntegrationInstructionsIcon sx={{ color: '#e65100', fontSize: 18 }} />}
              source="edoops.talend_logs_dashboard"
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
              >
                <Box sx={{ px: 1, py: 1 }}>
                  <ComposedBarLineChart
                    data={levelBarData}
                    xKey="name"
                    bars={[{ key: 'count', label: 'Log Count', color: '#e65100' }]}
                    lines={[]}
                    height={180}
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
                />
              </Box>
            </WidgetShell>
          </Paper>

          {/* ── Row 4: FATAL / ERROR log entries ── */}
          <Paper elevation={0} sx={{ borderRadius: 2, overflow: 'hidden', border: '1px solid #e8ecf1', borderTop: '3px solid #c62828', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <WidgetShell
              title="Recent Errors & Fatal Logs"
              titleIcon={<ErrorOutlineIcon sx={{ color: '#c62828', fontSize: 18 }} />}
              source="edoops.talend_logs_dashboard · fatal/error/warn/info count > 0 · latest 200"
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
                />
              </Box>
            </WidgetShell>
          </Paper>
        </>
      )}

    </Box>
  )
}
