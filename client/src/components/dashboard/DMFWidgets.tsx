import React, { useState, useEffect } from 'react'
import {
  Box,
  Typography,
  Chip,
  CircularProgress,
  Select,
  MenuItem,
  FormControl,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material'
import FilterListIcon from '@mui/icons-material/FilterList'
import StorageIcon from '@mui/icons-material/Storage'
import AccountTreeIcon from '@mui/icons-material/AccountTree'
import AnalyticsIcon from '@mui/icons-material/Analytics'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'
import {
  StatCardGrid,
  StatCardItem,
  SegmentedBarList,
  SegmentedBarItem,
  DonutPair,
  DonutChart,
  ComposedBarLineChart,
  TrendLineChart,
  DataTable,
  ColumnDef,
  WidgetShell,
  MetricBarList,
} from '../widgets'
import { dmfService } from '../../services'
import { useMockData } from '../../context/MockDataContext'
import {
  MOCK_DMF_SUMMARY, MOCK_DMF_STAGES, MOCK_DMF_RUN_STATUS, MOCK_DMF_FAILED_BY_STAGE,
  MOCK_DMF_RUNS_OVER_TIME, MOCK_DMF_ERROR_REASONS, MOCK_DMF_RECENT_FAILURES,
  MOCK_DMF_STATUS_TREND, MOCK_DMF_ROWS_TREND, MOCK_DMF_JOBS_TREND, MOCK_DMF_STEP_FAILURE_TREND,
  MOCK_DMF_ANALYTICS, MOCK_DMF_LINEAGE_META, MOCK_DMF_LINEAGE_JOBS,
} from '../../services/dmfMockData'

const STAGE_COLORS: Record<string, string> = {
  Ingestion: '#1565c0',
  Enrichment: '#f57c00',
  Distribution: '#2e7d32',
  Integration: '#7b1fa2',
}

interface DMFSummary {
  totalRuns: { value: number; trend: string; label: string }
  failedRuns: { value: number; trend: string; label: string }
  runsInProgress: { value: number; trend: string; label: string }
  successRate: { value: number; trend: string; label: string }
}

interface DMFStage {
  stage: string
  success: number
  inProgress: number
  failed: number
  rate: number
}

interface DMFRunStatus {
  name: string
  value: number
  color: string
}

interface DMFErrorReason {
  reason: string
  ingestion: number
  enrichment: number
  distribution: number
  integration: number
}

interface DMFFailure {
  id: string
  etlProcess: string
  runId: string
  batchId: string
  startTime: string
  endTime: string
  failedStage: string
  errorDescription: string
  details: string
}

// ─── NEW: Lineage / Analytics / Trends types ───────────────
interface LineageJob {
  id: string
  processDate: string
  sourceCode: string
  datasetName: string
  processTypeCode: string
  sourceName: string
  targetName: string
  runStartTime: string
  runEndTime: string
  status: string
}

interface AnalyticsData {
  statusSummary:      { status: string; count: number }[]
  sourceTypeCounts:   { type: string; count: number }[]
  targetTypeCounts:   { type: string; count: number }[]
  stepFailureCounts:  { step: string; count: number }[]
  failuresBySource:   { source: string; count: number }[]
  datasetsByExecTime: { dataset: string; avgMs: number }[]
}

const DMF_TABS = [
  { key: 'overview',  label: 'Overview',  icon: <StorageIcon sx={{ fontSize: 14 }} /> },
  { key: 'lineage',   label: 'Lineage',   icon: <AccountTreeIcon sx={{ fontSize: 14 }} /> },
  { key: 'analytics', label: 'Analytics', icon: <AnalyticsIcon sx={{ fontSize: 14 }} /> },
  { key: 'trends',    label: 'Trends',    icon: <TrendingUpIcon sx={{ fontSize: 14 }} /> },
] as const
type DMFTab = typeof DMF_TABS[number]['key']


export const DMFPipelineWidget: React.FC = () => {
  const { useMock } = useMockData()
  const [activeTab, setActiveTab] = useState<DMFTab>('overview')

  // ── Overview state ────────────────────────────────────────
  const [summary, setSummary] = useState<DMFSummary | null>(null)
  const [stages, setStages] = useState<DMFStage[]>([])
  const [runStatus, setRunStatus] = useState<DMFRunStatus[]>([])
  const [failedByStage, setFailedByStage] = useState<DMFRunStatus[]>([])
  const [runsOverTime, setRunsOverTime] = useState<any[]>([])
  const [errorReasons, setErrorReasons] = useState<DMFErrorReason[]>([])
  const [recentFailures, setRecentFailures] = useState<DMFFailure[]>([])
  const [loading, setLoading] = useState(true)

  // ── Lineage state ─────────────────────────────────────────
  const [lineageMeta,   setLineageMeta]   = useState<{ sourceCodes: string[]; datasetNames: string[]; sourceNames: string[]; targetNames: string[] } | null>(null)
  const [lineageJobs,   setLineageJobs]   = useState<LineageJob[]>([])
  const [lineageLoaded, setLineageLoaded] = useState(false)
  const [lgSourceCode,  setLgSourceCode]  = useState('All')
  const [lgDataset,     setLgDataset]     = useState('All')
  const [lgProcType,    setLgProcType]    = useState('All')
  const [lgStatus,      setLgStatus]      = useState('All')

  // ── Analytics state ───────────────────────────────────────
  const [analytics,       setAnalytics]       = useState<AnalyticsData | null>(null)
  const [analyticsLoaded, setAnalyticsLoaded] = useState(false)

  // ── Trends state ──────────────────────────────────────────
  const [statusTrend,      setStatusTrend]      = useState<any[]>([])
  const [rowsTrend,        setRowsTrend]        = useState<any[]>([])
  const [jobsTrend,        setJobsTrend]        = useState<any[]>([])
  const [stepFailureTrend, setStepFailureTrend] = useState<any[]>([])
  const [trendsLoaded,     setTrendsLoaded]     = useState(false)

  // Filter state
  const [dateRange, setDateRange] = useState('Last 7 Days')
  const [etlProcess, setEtlProcess] = useState('All')
  const [statusFilter, setStatusFilter] = useState('All')
  const [stageFilter, setStageFilter] = useState('All')

  // Interaction state
  const [selectedStage, setSelectedStage] = useState<string | null>(null)
  const [selectedFailure, setSelectedFailure] = useState<DMFFailure | null>(null)
  const [selectedError, setSelectedError] = useState<DMFErrorReason | null>(null)

  // Reset all lazy-loaded tab data whenever mock toggle changes
  useEffect(() => {
    setLineageLoaded(false)
    setLineageMeta(null)
    setLineageJobs([])
    setAnalyticsLoaded(false)
    setAnalytics(null)
    setTrendsLoaded(false)
    setStatusTrend([])
    setRowsTrend([])
    setJobsTrend([])
    setStepFailureTrend([])
  }, [useMock])

  useEffect(() => {
    setLoading(true)
    if (useMock) {
      setSummary(MOCK_DMF_SUMMARY as any)
      setStages(MOCK_DMF_STAGES as any)
      setRunStatus(MOCK_DMF_RUN_STATUS as any)
      setFailedByStage(MOCK_DMF_FAILED_BY_STAGE as any)
      setRunsOverTime(MOCK_DMF_RUNS_OVER_TIME)
      setErrorReasons(MOCK_DMF_ERROR_REASONS as any)
      setRecentFailures(MOCK_DMF_RECENT_FAILURES as any)
      setLoading(false)
      return
    }
    Promise.all([
      dmfService.getSummary(),
      dmfService.getStages(),
      dmfService.getRunStatus(),
      dmfService.getFailedByStage(),
      dmfService.getRunsOverTime(),
      dmfService.getErrorReasons(),
      dmfService.getRecentFailures(),
    ])
      .then(([sum, stg, rs, fbs, rot, er, rf]) => {
        setSummary(sum)
        setStages(stg)
        setRunStatus(rs)
        setFailedByStage(fbs)
        setRunsOverTime(rot)
        setErrorReasons(er)
        setRecentFailures(rf)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [useMock])

  // ── Lazy-load Lineage data ────────────────────────────────
  useEffect(() => {
    if (activeTab !== 'lineage' || lineageLoaded) return
    if (useMock) {
      setLineageMeta(MOCK_DMF_LINEAGE_META)
      setLineageJobs(MOCK_DMF_LINEAGE_JOBS)
      setLineageLoaded(true)
      return
    }
    Promise.all([
      dmfService.getLineageMeta(),
      dmfService.getLineageJobs(),
    ]).then(([meta, jobs]) => {
      setLineageMeta(meta)
      setLineageJobs(Array.isArray(jobs) ? jobs : [])
      setLineageLoaded(true)
    }).catch(() => setLineageLoaded(true))
  }, [activeTab, lineageLoaded, useMock])

  // ── Lazy-load Analytics data ──────────────────────────────
  useEffect(() => {
    if (activeTab !== 'analytics' || analyticsLoaded) return
    if (useMock) {
      setAnalytics(MOCK_DMF_ANALYTICS)
      setAnalyticsLoaded(true)
      return
    }
    dmfService.getAnalytics()
      .then(d => { setAnalytics(d); setAnalyticsLoaded(true) })
      .catch(() => setAnalyticsLoaded(true))
  }, [activeTab, analyticsLoaded, useMock])

  // ── Lazy-load Trends data ─────────────────────────────────
  useEffect(() => {
    if (activeTab !== 'trends' || trendsLoaded) return
    if (useMock) {
      setStatusTrend(MOCK_DMF_STATUS_TREND)
      setRowsTrend(MOCK_DMF_ROWS_TREND)
      setJobsTrend(MOCK_DMF_JOBS_TREND)
      setStepFailureTrend(MOCK_DMF_STEP_FAILURE_TREND)
      setTrendsLoaded(true)
      return
    }
    Promise.all([
      dmfService.getStatusTrend(),
      dmfService.getRowsTrend(),
      dmfService.getJobsTrend(),
      dmfService.getStepFailureTrend(),
    ]).then(([st, rt, jt, sft]) => {
      setStatusTrend(st); setRowsTrend(rt); setJobsTrend(jt); setStepFailureTrend(sft)
      setTrendsLoaded(true)
    }).catch(() => setTrendsLoaded(true))
  }, [activeTab, trendsLoaded, useMock])

  const activeStageFilter = selectedStage ?? (stageFilter !== 'All' ? stageFilter : null)

  const filteredFailures = recentFailures.filter(f => {
    if (activeStageFilter && f.failedStage !== activeStageFilter) return false
    if (etlProcess !== 'All' && f.etlProcess !== etlProcess) return false
    return true
  })

  const handleStageClick = (stageName: string) => {
    if (selectedStage === stageName) {
      setSelectedStage(null)
      setStageFilter('All')
    } else {
      setSelectedStage(stageName)
      setStageFilter(stageName)
    }
  }

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })

  if (loading) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 400 }}>
        <CircularProgress size={40} />
      </Box>
    )
  }

  // ── Primitive data mappings ────────────────────────────────────────────────

  const kpiItems: StatCardItem[] = summary
    ? [
        {
          label: 'Total Runs',
          value: summary.totalRuns.value.toLocaleString(),
          color: '#1565c0',
          bg: '#e3f2fd',
          trend: summary.totalRuns.trend,
          trendPositiveIsGood: true,
          description: summary.totalRuns.label,
        },
        {
          label: 'Failed Runs',
          value: summary.failedRuns.value,
          color: '#c62828',
          bg: '#fce4ec',
          trend: summary.failedRuns.trend,
          trendPositiveIsGood: false,
          description: summary.failedRuns.label,
        },
        {
          label: 'In Progress',
          value: summary.runsInProgress.value,
          color: '#e65100',
          bg: '#fff3e0',
          trend: summary.runsInProgress.trend,
          trendPositiveIsGood: true,
          description: summary.runsInProgress.label,
        },
        {
          label: 'Success Rate',
          value: `${summary.successRate.value}%`,
          color: '#2e7d32',
          bg: '#e8f5e9',
          trend: summary.successRate.trend,
          trendPositiveIsGood: true,
          description: summary.successRate.label,
        },
      ]
    : []

  const stageItems: SegmentedBarItem[] = stages.map(stg => ({
    label: stg.stage,
    labelColor: STAGE_COLORS[stg.stage],
    segments: [
      { value: stg.success,    color: '#2e7d32', label: 'Success'     },
      { value: stg.inProgress, color: '#f57c00', label: 'In Progress' },
      { value: stg.failed,     color: '#d32f2f', label: 'Failed'      },
    ],
    rightLabel: `${stg.rate}%`,
    rightColor: stg.rate >= 90 ? '#2e7d32' : stg.rate >= 80 ? '#f57c00' : '#d32f2f',
    selected: selectedStage === stg.stage,
    onClick: () => handleStageClick(stg.stage),
  }))

  const errorReasonItems: SegmentedBarItem[] = errorReasons.map(reason => ({
    label: reason.reason,
    segments: [
      { value: reason.ingestion,    color: '#1565c0', label: 'Ingestion'    },
      { value: reason.enrichment,   color: '#f57c00', label: 'Enrichment'   },
      { value: reason.distribution, color: '#2e7d32', label: 'Distribution' },
      { value: reason.integration,  color: '#7b1fa2', label: 'Integration'  },
    ],
    rightLabel: String(reason.ingestion + reason.enrichment + reason.distribution + reason.integration),
    onClick: () => setSelectedError(reason),
  }))

  const failuresColumns: ColumnDef<DMFFailure>[] = [
    { key: 'etlProcess',       header: 'ETL Process',      flex: 2, render: r => r.etlProcess.replace(/_/g, ' ') },
    { key: 'runId',            header: 'Run ID',           width: 90,  noWrap: true },
    { key: 'batchId',          header: 'Batch ID',         width: 90 },
    { key: 'startTime',        header: 'Start Time',       width: 130, noWrap: true, render: r => formatTime(r.startTime) },
    { key: 'endTime',          header: 'End Time',         width: 130, noWrap: true, render: r => formatTime(r.endTime) },
    {
      key: 'failedStage',      header: 'Failed Stage',     width: 110,
      render: r => (
        <Chip
          label={r.failedStage}
          size="small"
          sx={{
            fontSize: '10px', height: 20, fontWeight: 600,
            backgroundColor: `${STAGE_COLORS[r.failedStage] ?? '#999'}22`,
            color: STAGE_COLORS[r.failedStage] ?? '#555',
          }}
        />
      ),
    },
    { key: 'errorDescription', header: 'Error Description', flex: 3, render: r => r.errorDescription },
  ]

  // ── Lineage columns ────────────────────────────────────────
  const lineageColumns: ColumnDef<LineageJob>[] = [
    { key: 'processDate',     header: 'Process Date',     width: 95 },
    { key: 'sourceCode',      header: 'Source Code',      width: 90 },
    { key: 'datasetName',     header: 'Dataset Name',     flex: 2 },
    { key: 'processTypeCode', header: 'Process Type',     width: 80 },
    { key: 'sourceName',      header: 'Source Name',      flex: 2 },
    { key: 'targetName',      header: 'Target Name',      flex: 2 },
    { key: 'runStartTime',    header: 'Run Start Time',   width: 140, noWrap: true },
    { key: 'runEndTime',      header: 'Run End Time',     width: 140, noWrap: true },
    {
      key: 'status',           header: 'Status',           width: 80,
      render: r => (
        <Box
          sx={{
            width: 10, height: 10, borderRadius: '50%', mx: 'auto',
            backgroundColor: r.status === 'success' ? '#2e7d32' : '#d32f2f',
          }}
        />
      ),
    },
  ]

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0, height: '100%' }}>

      {/* ── Sub-tab bar (dark themed like Tableau screenshots) ── */}
      <Box sx={{ display: 'flex', backgroundColor: '#1a2535', px: 2, flexShrink: 0 }}>
        {DMF_TABS.map(tab => {
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
                '&:hover': { color: '#fff', backgroundColor: 'rgba(255,255,255,0.05)' },
              }}
            >
              {React.cloneElement(tab.icon, { sx: { fontSize: 14, color: isActive ? '#1976d2' : 'inherit' } })}
              <Typography sx={{ fontSize: '12px', fontWeight: isActive ? 700 : 400 }}>{tab.label}</Typography>
            </Box>
          )
        })}
      </Box>

      {/* ── Tab content ── */}
      <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>

      {/* ════════════════════════════════════════════════════════
         OVERVIEW TAB
         ════════════════════════════════════════════════════════ */}
      {activeTab === 'overview' && (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>

      {/* ── Header + Filter Bar ── */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <StorageIcon sx={{ color: '#1976d2', fontSize: 20 }} />
          <Typography sx={{ fontWeight: 700, fontSize: '15px', color: '#1a1a1a' }}>DMF Dashboard</Typography>
          {/* <Chip label="PostgreSQL" size="small" sx={{ fontSize: '10px', height: 20, backgroundColor: '#e3f2fd', color: '#1565c0', fontWeight: 600 }} /> */}
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <FormControl size="small">
            <Select value={dateRange} onChange={e => setDateRange(e.target.value)} sx={{ fontSize: '12px', height: 32, minWidth: 110 }}>
              {['Today', 'Last 7 Days', 'Last 30 Days', 'Quarter'].map(v => (
                <MenuItem key={v} value={v} sx={{ fontSize: '12px' }}>{v}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small">
            <Select value={etlProcess} onChange={e => setEtlProcess(e.target.value)} sx={{ fontSize: '12px', height: 32, minWidth: 160 }}>
              {['All', 'CUSTOMER_LOAD_PIPELINE', 'ORDER_PROCESSING_PIPELINE', 'SALES_DATA_PIPELINE', 'FINANCE_PIPELINE'].map(v => (
                <MenuItem key={v} value={v} sx={{ fontSize: '12px' }}>
                  {v === 'All' ? 'All ETL Processes' : v.replace(/_/g, ' ')}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small">
            <Select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} sx={{ fontSize: '12px', height: 32, minWidth: 95 }}>
              {['All', 'Success', 'Failed', 'In Progress'].map(v => (
                <MenuItem key={v} value={v} sx={{ fontSize: '12px' }}>{v === 'All' ? 'All Status' : v}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small">
            <Select value={stageFilter} onChange={e => { setStageFilter(e.target.value); setSelectedStage(null) }} sx={{ fontSize: '12px', height: 32, minWidth: 115 }}>
              {['All', 'Ingestion', 'Enrichment', 'Distribution', 'Integration'].map(v => (
                <MenuItem key={v} value={v} sx={{ fontSize: '12px' }}>{v === 'All' ? 'All Stages' : v}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <Button
            variant="contained"
            size="small"
            startIcon={<FilterListIcon />}
            onClick={() => { setSelectedStage(null); setStageFilter('All'); setEtlProcess('All'); setStatusFilter('All') }}
            sx={{ height: 32, fontSize: '12px', backgroundColor: '#1976d2', textTransform: 'none', px: 1.5 }}
          >
            Reset
          </Button>
        </Box>
      </Box>

      {/* ── KPI Cards ── */}
      {summary && <StatCardGrid items={kpiItems} columns={4} />}

      {/* ── Pipeline Stages + Donuts ── */}
      <Box sx={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 2 }}>
        {/* Pipeline Stages */}
        <Box sx={{ backgroundColor: '#fff', border: '1px solid #e0e0e0', borderRadius: 2, p: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
            <Typography sx={{ fontWeight: 700, fontSize: '13px', color: '#1a1a1a' }}>Pipeline Stages</Typography>
            {selectedStage && (
              <Chip
                label={`Filtered: ${selectedStage}`}
                size="small"
                onDelete={() => { setSelectedStage(null); setStageFilter('All') }}
                sx={{ fontSize: '10px', height: 20, backgroundColor: `${STAGE_COLORS[selectedStage]}22`, color: STAGE_COLORS[selectedStage] }}
              />
            )}
          </Box>
          <SegmentedBarList
            items={stageItems}
            barHeight={22}
            labelWidth={100}
            legend={[
              { color: '#2e7d32', label: 'Success'     },
              { color: '#f57c00', label: 'In Progress' },
              { color: '#d32f2f', label: 'Failed'      },
            ]}
          />
        </Box>

        {/* Donut Charts */}
        <DonutPair
          left={{  title: 'Pipeline Run Status',    data: runStatus.map(r    => ({ name: r.name, value: r.value, color: r.color })) }}
          right={{ title: 'Failed Stage Breakdown', data: failedByStage.map(r => ({ name: r.name, value: r.value, color: r.color })) }}
        />
      </Box>

      {/* ── Runs Over Time + Top Error Reasons ── */}
      <Box sx={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: 2 }}>
        {/* Runs Over Time */}
        <Box sx={{ backgroundColor: '#fff', border: '1px solid #e0e0e0', borderRadius: 2, p: 2 }}>
          <Typography sx={{ fontWeight: 700, fontSize: '13px', color: '#1a1a1a', mb: 1.5 }}>Pipeline Runs Over Time</Typography>
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
            height={210}
          />
        </Box>

        {/* Top Error Reasons */}
        <Box sx={{ backgroundColor: '#fff', border: '1px solid #e0e0e0', borderRadius: 2, p: 2 }}>
          <Typography sx={{ fontWeight: 700, fontSize: '13px', color: '#1a1a1a', mb: 1.5 }}>Top Error Reasons</Typography>
          <SegmentedBarList
            items={errorReasonItems}
            barHeight={18}
            compact
            legend={[
              { color: '#1565c0', label: 'Ingestion'    },
              { color: '#f57c00', label: 'Enrichment'   },
              { color: '#2e7d32', label: 'Distribution' },
              { color: '#7b1fa2', label: 'Integration'  },
            ]}
          />
        </Box>
      </Box>

      {/* ── Recent Pipeline Failures Table ── */}
      <Box sx={{ backgroundColor: '#fff', border: '1px solid #e0e0e0', borderRadius: 2, overflow: 'hidden' }}>
        <Box sx={{ px: 2, py: 1.5, borderBottom: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fafafa' }}>
          <Typography sx={{ fontWeight: 700, fontSize: '13px', color: '#1a1a1a' }}>Recent Pipeline Failures</Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {activeStageFilter && (
              <Chip
                label={`Stage: ${activeStageFilter}`}
                size="small"
                onDelete={() => { setSelectedStage(null); setStageFilter('All') }}
                sx={{ fontSize: '10px', height: 20, backgroundColor: `${STAGE_COLORS[activeStageFilter]}22`, color: STAGE_COLORS[activeStageFilter] }}
              />
            )}
            <Chip
              label={`${filteredFailures.length} failures`}
              size="small"
              sx={{ fontSize: '10px', height: 20, backgroundColor: '#fce4ec', color: '#c62828', fontWeight: 600 }}
            />
          </Box>
        </Box>
        <DataTable<DMFFailure>
          columns={failuresColumns}
          rows={filteredFailures}
          rowKey="id"
          onRowClick={setSelectedFailure}
          maxHeight={320}
          emptyMessage="No failures match the current filters"
          compact
        />
      </Box>

      {/* ── Failure Detail Modal ── */}
      <Dialog open={!!selectedFailure} onClose={() => setSelectedFailure(null)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700, fontSize: '15px', color: '#c62828', borderBottom: '1px solid #fce4ec', pb: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
          Pipeline Failure Detail
          {selectedFailure && (
            <Chip
              label={selectedFailure.failedStage}
              size="small"
              sx={{ fontSize: '10px', height: 20, backgroundColor: `${STAGE_COLORS[selectedFailure.failedStage] ?? '#999'}22`, color: STAGE_COLORS[selectedFailure.failedStage] ?? '#555' }}
            />
          )}
        </DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          {selectedFailure && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
                {[
                  { label: 'ETL Process', value: selectedFailure.etlProcess.replace(/_/g, ' ') },
                  { label: 'Run ID',      value: selectedFailure.runId },
                  { label: 'Batch ID',    value: selectedFailure.batchId },
                  { label: 'Failed Stage',value: selectedFailure.failedStage },
                  { label: 'Start Time',  value: new Date(selectedFailure.startTime).toLocaleString() },
                  { label: 'End Time',    value: new Date(selectedFailure.endTime).toLocaleString() },
                ].map(({ label, value }) => (
                  <Box key={label} sx={{ backgroundColor: '#f9f9f9', p: 1.5, borderRadius: 1, border: '1px solid #f0f0f0' }}>
                    <Typography sx={{ fontSize: '10px', color: '#999', mb: 0.3, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</Typography>
                    <Typography sx={{ fontSize: '12px', color: '#1a1a1a', fontWeight: 600 }}>{value}</Typography>
                  </Box>
                ))}
              </Box>
              <Box sx={{ backgroundColor: '#fce4ec', border: '1px solid #ef9a9a', borderRadius: 1, p: 1.5 }}>
                <Typography sx={{ fontSize: '11px', fontWeight: 700, color: '#c62828', mb: 0.5 }}>Error Description</Typography>
                <Typography sx={{ fontSize: '12px', color: '#333' }}>{selectedFailure.errorDescription}</Typography>
              </Box>
              <Box sx={{ backgroundColor: '#f5f5f5', border: '1px solid #e0e0e0', borderRadius: 1, p: 1.5 }}>
                <Typography sx={{ fontSize: '11px', fontWeight: 700, color: '#555', mb: 0.5 }}>Resolution Details</Typography>
                <Typography sx={{ fontSize: '12px', color: '#444', lineHeight: 1.7 }}>{selectedFailure.details}</Typography>
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 2, pb: 2 }}>
          <Button onClick={() => setSelectedFailure(null)} variant="contained" size="small" sx={{ textTransform: 'none', backgroundColor: '#1976d2' }}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* ── Error Reason Detail Modal ── */}
      <Dialog open={!!selectedError} onClose={() => setSelectedError(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700, fontSize: '14px', borderBottom: '1px solid #f0f0f0', pb: 1.5 }}>
          {selectedError?.reason}
        </DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          {selectedError && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              <Typography sx={{ fontSize: '12px', color: '#666' }}>Error count by pipeline stage:</Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {[
                  { stage: 'Ingestion',    count: selectedError.ingestion,    color: '#1565c0', bg: '#e3f2fd' },
                  { stage: 'Enrichment',   count: selectedError.enrichment,   color: '#f57c00', bg: '#fff3e0' },
                  { stage: 'Distribution', count: selectedError.distribution, color: '#2e7d32', bg: '#e8f5e9' },
                  { stage: 'Integration',  count: selectedError.integration,  color: '#7b1fa2', bg: '#f3e5f5' },
                ].map(({ stage, count, color, bg }) => {
                  const total = selectedError.ingestion + selectedError.enrichment + selectedError.distribution + selectedError.integration
                  return (
                    <Box key={stage} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, p: 1.5, backgroundColor: bg, borderRadius: 1 }}>
                      <Typography sx={{ fontSize: '12px', fontWeight: 700, color, width: 95, flexShrink: 0 }}>{stage}</Typography>
                      <Box sx={{ flex: 1, height: 8, backgroundColor: '#e0e0e0', borderRadius: 4, overflow: 'hidden' }}>
                        <Box sx={{ height: '100%', width: `${(count / total) * 100}%`, backgroundColor: color, borderRadius: 4 }} />
                      </Box>
                      <Typography sx={{ fontSize: '14px', fontWeight: 800, color, minWidth: 28, textAlign: 'right' }}>{count}</Typography>
                    </Box>
                  )
                })}
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 2, pb: 2 }}>
          <Button onClick={() => setSelectedError(null)} variant="contained" size="small" sx={{ textTransform: 'none', backgroundColor: '#1976d2' }}>Close</Button>
        </DialogActions>
      </Dialog>
      </Box>
      )}

      {/* ════════════════════════════════════════════════════════
         LINEAGE TAB
         ════════════════════════════════════════════════════════ */}
      {activeTab === 'lineage' && (
        !lineageLoaded ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}><CircularProgress size={36} /></Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {/* Lineage KPI Summary */}
            <StatCardGrid
              items={[
                { label: 'Source Codes', value: lineageMeta?.sourceCodes.length ?? 0, color: '#1565c0', bg: '#e3f2fd' },
                { label: 'Datasets', value: lineageMeta?.datasetNames.length ?? 0, color: '#2e7d32', bg: '#e8f5e9' },
                { label: 'Source Names', value: lineageMeta?.sourceNames.length ?? 0, color: '#f57c00', bg: '#fff3e0' },
                { label: 'Target Names', value: lineageMeta?.targetNames.length ?? 0, color: '#7b1fa2', bg: '#f3e5f5' },
                { label: 'Total Jobs', value: lineageJobs.length, color: '#1976d2', bg: '#e3f2fd' },
                { label: 'Success Rate', value: lineageJobs.length ? Math.round(lineageJobs.filter(j => j.status === 'success').length / lineageJobs.length * 100) : 0, unit: '%', color: '#2e7d32', bg: '#e8f5e9' },
              ]}
              columns={6}
              compact
            />

            {/* Filter bar */}
            <Box sx={{ backgroundColor: '#fff', border: '1px solid #e0e0e0', borderRadius: 2, overflow: 'hidden' }}>
              <WidgetShell title="Lineage Filters" titleIcon={<FilterListIcon sx={{ fontSize: 16, color: '#1976d2' }} />}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', px: 2, py: 1 }}>
                  {[
                    { label: 'Source Code',  value: lgSourceCode, setter: setLgSourceCode, options: lineageMeta?.sourceCodes ?? [] },
                    { label: 'Dataset Name', value: lgDataset,    setter: setLgDataset,    options: lineageMeta?.datasetNames ?? [] },
                    { label: 'Process Type', value: lgProcType,   setter: setLgProcType,   options: ['ING','ENR','DIS','INT'] },
                    { label: 'Status',       value: lgStatus,     setter: setLgStatus,     options: ['success','failed'] },
                  ].map(f => (
                    <FormControl key={f.label} size="small">
                      <Select
                        value={f.value}
                        onChange={e => f.setter(e.target.value)}
                        sx={{ fontSize: '12px', height: 32, minWidth: 140 }}
                        displayEmpty
                      >
                        <MenuItem value="All" sx={{ fontSize: '12px' }}>All {f.label}s</MenuItem>
                        {f.options.map(o => (
                          <MenuItem key={o} value={o} sx={{ fontSize: '12px' }}>{o}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  ))}
                  <Button
                    size="small"
                    startIcon={<FilterListIcon />}
                    onClick={() => { setLgSourceCode('All'); setLgDataset('All'); setLgProcType('All'); setLgStatus('All') }}
                    sx={{ height: 32, fontSize: '12px', textTransform: 'none', px: 1.5 }}
                  >
                    Reset
                  </Button>
                </Box>
              </WidgetShell>
            </Box>

            {/* Reference Lists — MetricBarList showing job count per item */}
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 2 }}>
              {[
                { title: 'Source Code',  field: 'sourceCode'  as keyof LineageJob, items: lineageMeta?.sourceCodes ?? [],  color: '#1565c0' },
                { title: 'Dataset Name', field: 'datasetName' as keyof LineageJob, items: lineageMeta?.datasetNames ?? [], color: '#2e7d32' },
                { title: 'Source Name',  field: 'sourceName'  as keyof LineageJob, items: lineageMeta?.sourceNames ?? [],  color: '#f57c00' },
                { title: 'Target Name',  field: 'targetName'  as keyof LineageJob, items: lineageMeta?.targetNames ?? [],  color: '#7b1fa2' },
              ].map(col => (
                <Box key={col.title} sx={{ backgroundColor: '#fff', border: '1px solid #e0e0e0', borderRadius: 2, overflow: 'hidden' }}>
                  <WidgetShell title={col.title} source={`${col.items.length} items`}>
                    <Box sx={{ maxHeight: 220, overflow: 'auto', px: 1.5, py: 1 }}>
                      <MetricBarList
                        items={col.items.map(item => ({
                          label: item,
                          value: lineageJobs.filter(j => j[col.field] === item).length,
                          max: Math.max(1, ...col.items.map(it => lineageJobs.filter(j => j[col.field] === it).length)),
                          color: col.color,
                          suffix: ' jobs',
                        }))}
                        compact
                        barHeight={5}
                      />
                    </Box>
                  </WidgetShell>
                </Box>
              ))}
            </Box>

            {/* Job Details table */}
            <Box sx={{ backgroundColor: '#fff', border: '1px solid #e0e0e0', borderRadius: 2, overflow: 'hidden' }}>
              <WidgetShell
                title="Job Details"
                source="DMF Lineage"
                actions={
                  <Chip label={`${lineageJobs.filter(j => {
                    if (lgSourceCode !== 'All' && j.sourceCode !== lgSourceCode) return false
                    if (lgDataset !== 'All' && j.datasetName !== lgDataset) return false
                    if (lgProcType !== 'All' && j.processTypeCode !== lgProcType) return false
                    if (lgStatus !== 'All' && j.status !== lgStatus) return false
                    return true
                  }).length} jobs`} size="small" sx={{ fontSize: '10px', height: 20, backgroundColor: '#e3f2fd', color: '#1565c0', fontWeight: 600 }} />
                }
              >
                <DataTable<LineageJob>
                  columns={lineageColumns}
                  rows={lineageJobs.filter(j => {
                    if (lgSourceCode !== 'All' && j.sourceCode !== lgSourceCode) return false
                    if (lgDataset !== 'All' && j.datasetName !== lgDataset) return false
                    if (lgProcType !== 'All' && j.processTypeCode !== lgProcType) return false
                    if (lgStatus !== 'All' && j.status !== lgStatus) return false
                    return true
                  })}
                  rowKey="id"
                  maxHeight={360}
                  emptyMessage="No lineage jobs match the current filters"
                  compact
                />
              </WidgetShell>
            </Box>
          </Box>
        )
      )}

      {/* ════════════════════════════════════════════════════════
         ANALYTICS TAB
         ════════════════════════════════════════════════════════ */}
      {activeTab === 'analytics' && (
        !analyticsLoaded ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}><CircularProgress size={36} /></Box>
        ) : analytics && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {/* Analytics KPI Summary */}
            <StatCardGrid
              items={(() => {
                const total = analytics.statusSummary.reduce((s, r) => s + r.count, 0)
                const success = analytics.statusSummary.find(r => r.status === 'success')?.count ?? 0
                const failed = analytics.statusSummary.find(r => r.status === 'failed')?.count ?? 0
                return [
                  { label: 'Total Records', value: total.toLocaleString(), color: '#1976d2', bg: '#e3f2fd' },
                  { label: 'Success', value: success.toLocaleString(), color: '#2e7d32', bg: '#e8f5e9', trend: `${total ? Math.round(success / total * 100) : 0}%` },
                  { label: 'Failed', value: failed.toLocaleString(), color: '#d32f2f', bg: '#fce4ec', trendPositiveIsGood: false },
                  { label: 'Source Types', value: analytics.sourceTypeCounts.length, color: '#f57c00', bg: '#fff3e0' },
                  { label: 'Target Types', value: analytics.targetTypeCounts.length, color: '#7b1fa2', bg: '#f3e5f5' },
                  { label: 'Step Failures', value: analytics.stepFailureCounts.reduce((s, r) => s + r.count, 0).toLocaleString(), color: '#c62828', bg: '#fce4ec' },
                ]
              })()}
              columns={6}
              compact
            />

            {/* Status Donut + Source Type + Target Type + Step Failures */}
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr 1.5fr 1fr', gap: 2 }}>
              {/* Status Summary — Donut */}
              <Box sx={{ backgroundColor: '#fff', border: '1px solid #e0e0e0', borderRadius: 2, overflow: 'hidden' }}>
                <WidgetShell title="Status Summary" source="DMF">
                  <Box sx={{ px: 2, py: 1.5 }}>
                    <DonutChart
                      data={analytics.statusSummary.map((r, i) => ({
                        name: r.status,
                        value: r.count,
                        color: ['#2e7d32', '#d32f2f', '#f57c00', '#7b1fa2'][i % 4],
                      }))}
                      size={110}
                      centerLabel={analytics.statusSummary.reduce((s, r) => s + r.count, 0)}
                    />
                  </Box>
                </WidgetShell>
              </Box>

              {/* Source Type Counts */}
              <Box sx={{ backgroundColor: '#fff', border: '1px solid #e0e0e0', borderRadius: 2, overflow: 'hidden' }}>
                <WidgetShell title="Count of Source Type" source={`${analytics.sourceTypeCounts.length} types`}>
                  <Box sx={{ maxHeight: 220, overflow: 'auto', px: 1.5, py: 1 }}>
                    <MetricBarList
                      items={analytics.sourceTypeCounts.map((r, i) => ({
                        label: r.type,
                        value: r.count,
                        max: Math.max(...analytics.sourceTypeCounts.map(x => x.count)),
                        color: ['#1565c0', '#2e7d32', '#f57c00', '#d32f2f', '#7b1fa2', '#00838f', '#4527a0'][i % 7],
                        suffix: '',
                      }))}
                      compact
                      barHeight={6}
                    />
                  </Box>
                </WidgetShell>
              </Box>

              {/* Target Type Counts */}
              <Box sx={{ backgroundColor: '#fff', border: '1px solid #e0e0e0', borderRadius: 2, overflow: 'hidden' }}>
                <WidgetShell title="Count of Target Type" source={`${analytics.targetTypeCounts.length} types`}>
                  <Box sx={{ maxHeight: 220, overflow: 'auto', px: 1.5, py: 1 }}>
                    <MetricBarList
                      items={analytics.targetTypeCounts.map((r, i) => ({
                        label: r.type,
                        value: r.count,
                        max: Math.max(...analytics.targetTypeCounts.map(x => x.count)),
                        color: ['#00838f', '#4527a0', '#1565c0', '#2e7d32', '#f57c00', '#d32f2f', '#7b1fa2', '#e65100'][i % 8],
                        suffix: '',
                      }))}
                      compact
                      barHeight={6}
                    />
                  </Box>
                </WidgetShell>
              </Box>

              {/* Step Failure Counts */}
              <Box sx={{ backgroundColor: '#fff', border: '1px solid #e0e0e0', borderRadius: 2, overflow: 'hidden' }}>
                <WidgetShell title="Step Failures" source="DMF">
                  <Box sx={{ maxHeight: 220, overflow: 'auto', px: 1.5, py: 1 }}>
                    <MetricBarList
                      items={analytics.stepFailureCounts.map(r => ({
                        label: r.step,
                        value: r.count,
                        max: Math.max(...analytics.stepFailureCounts.map(x => x.count)),
                        color: '#d32f2f',
                        suffix: '',
                      }))}
                      compact
                      barHeight={6}
                    />
                  </Box>
                </WidgetShell>
              </Box>
            </Box>

            {/* Failures by Source + Datasets by Execution Time — MetricBarList */}
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
              {/* Failures by Source Name */}
              <Box sx={{ backgroundColor: '#fff', border: '1px solid #e0e0e0', borderRadius: 2, overflow: 'hidden' }}>
                <WidgetShell title="Failures by Source Name" source="DMF Analytics">
                  <Box sx={{ maxHeight: 360, overflow: 'auto', px: 1.5, py: 1 }}>
                    <MetricBarList
                      items={analytics.failuresBySource.map(r => ({
                        label: r.source,
                        value: r.count,
                        max: Math.max(...analytics.failuresBySource.map(x => x.count)),
                        color: '#c62828',
                        suffix: '',
                      }))}
                      compact
                      barHeight={8}
                    />
                  </Box>
                </WidgetShell>
              </Box>

              {/* Datasets by Execution Time (Avg) */}
              <Box sx={{ backgroundColor: '#fff', border: '1px solid #e0e0e0', borderRadius: 2, overflow: 'hidden' }}>
                <WidgetShell title="Datasets by Execution Time (Avg)" source="DMF Analytics">
                  <Box sx={{ maxHeight: 360, overflow: 'auto', px: 1.5, py: 1 }}>
                    <MetricBarList
                      items={analytics.datasetsByExecTime.map(r => ({
                        label: r.dataset,
                        value: r.avgMs,
                        max: Math.max(...analytics.datasetsByExecTime.map(x => x.avgMs)),
                        suffix: 'ms',
                      }))}
                      compact
                      barHeight={8}
                      colorByValue={(v, max) => v / max > 0.7 ? '#d32f2f' : v / max > 0.4 ? '#f57c00' : '#2e7d32'}
                    />
                  </Box>
                </WidgetShell>
              </Box>
            </Box>
          </Box>
        )
      )}

      {/* ════════════════════════════════════════════════════════
         TRENDS TAB
         ════════════════════════════════════════════════════════ */}
      {activeTab === 'trends' && (
        !trendsLoaded ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}><CircularProgress size={36} /></Box>
        ) : (
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
            {/* Status Trend */}
            <Box sx={{ backgroundColor: '#fff', border: '1px solid #e0e0e0', borderRadius: 2, overflow: 'hidden' }}>
              <WidgetShell title="Status Trend" source="DMF Trends" titleIcon={<TrendingUpIcon sx={{ fontSize: 16, color: '#2e7d32' }} />}>
                <Box sx={{ p: 1.5 }}>
                  <TrendLineChart
                    data={statusTrend}
                    xKey="month"
                    lines={[
                      { key: 'success',     label: 'Success',      color: '#2e7d32' },
                      { key: 'failed',      label: 'Failed',       color: '#d32f2f' },
                      { key: 'inProgress',  label: 'In Progress',  color: '#f57c00' },
                      { key: 'partialLoad', label: 'Partial Load', color: '#7b1fa2' },
                    ]}
                    height={200}
                  />
                </Box>
              </WidgetShell>
            </Box>

            {/* Rows Trend */}
            <Box sx={{ backgroundColor: '#fff', border: '1px solid #e0e0e0', borderRadius: 2, overflow: 'hidden' }}>
              <WidgetShell title="Rows Trend" source="DMF Trends" titleIcon={<TrendingUpIcon sx={{ fontSize: 16, color: '#1565c0' }} />}>
                <Box sx={{ p: 1.5 }}>
                  <TrendLineChart
                    data={rowsTrend}
                    xKey="month"
                    lines={[
                      { key: 'rowsLoaded', label: 'Rows Loaded',   color: '#1565c0' },
                      { key: 'rowsParsed', label: 'Rows Parsed',   color: '#2e7d32' },
                      { key: 'rowsRjctd',  label: 'Rows Rejected', color: '#d32f2f' },
                    ]}
                    height={200}
                  />
                </Box>
              </WidgetShell>
            </Box>

            {/* Jobs Trend */}
            <Box sx={{ backgroundColor: '#fff', border: '1px solid #e0e0e0', borderRadius: 2, overflow: 'hidden' }}>
              <WidgetShell title="Jobs Trend" source="DMF Trends" titleIcon={<TrendingUpIcon sx={{ fontSize: 16, color: '#f57c00' }} />}>
                <Box sx={{ p: 1.5 }}>
                  <TrendLineChart
                    data={jobsTrend}
                    xKey="month"
                    lines={[
                      { key: 'ING', label: 'Ingestion',    color: '#1565c0' },
                      { key: 'ENR', label: 'Enrichment',   color: '#f57c00' },
                      { key: 'DIS', label: 'Distribution', color: '#2e7d32' },
                      { key: 'INT', label: 'Integration',  color: '#7b1fa2' },
                    ]}
                    height={200}
                  />
                </Box>
              </WidgetShell>
            </Box>

            {/* Step Failure Trend */}
            <Box sx={{ backgroundColor: '#fff', border: '1px solid #e0e0e0', borderRadius: 2, overflow: 'hidden' }}>
              <WidgetShell title="Step Failure Trend" source="DMF Trends" titleIcon={<TrendingUpIcon sx={{ fontSize: 16, color: '#d32f2f' }} />}>
                <Box sx={{ p: 1.5 }}>
                  <TrendLineChart
                    data={stepFailureTrend}
                    xKey="period"
                    lines={[
                      { key: 'count', label: 'Failures', color: '#d32f2f' },
                    ]}
                    height={200}
                  />
                </Box>
              </WidgetShell>
            </Box>
          </Box>
        )
      )}
      </Box>
    </Box>
  )
}
