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
} from '@mui/material'
import FilterListIcon from '@mui/icons-material/FilterList'
import AccountTreeIcon from '@mui/icons-material/AccountTree'
import AnalyticsIcon from '@mui/icons-material/Analytics'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'
import SmartToyIcon from '@mui/icons-material/SmartToy'
import {
  StatCardGrid,
  DonutChart,
  TrendLineChart,
  DataTable,
  ColumnDef,
  WidgetShell,
  MetricBarList,
  ComposedBarLineChart,
} from '../widgets'
import { dmfService } from '../../services'
import { useMockData } from '../../context/MockDataContext'
import {
  MOCK_DMF_STATUS_TREND, MOCK_DMF_ROWS_TREND, MOCK_DMF_JOBS_TREND, MOCK_DMF_STEP_FAILURE_TREND,
  MOCK_DMF_ANALYTICS, MOCK_DMF_LINEAGE_META, MOCK_DMF_LINEAGE_JOBS, MOCK_DMF_LINEAGE_COUNTS,
} from '../../services/dmfMockData'





// ─── NEW: Lineage / Analytics / Trends types ───────────────
interface LineageCounts {
  total: number
  byStatus:   { status: 'success' | 'failed'; count: number }[]
  byProcType: { procTypeCode: string; count: number }[]
  bySrcCd:    { sourceCode: string; count: number }[]
  byTgtNm:    { targetName: string; count: number }[]
}

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
  { key: 'lineage',   label: 'Lineage',   icon: <AccountTreeIcon sx={{ fontSize: 14 }} /> },
  { key: 'analytics', label: 'Analytics', icon: <AnalyticsIcon sx={{ fontSize: 14 }} /> },
  { key: 'trends',    label: 'Trends',    icon: <TrendingUpIcon sx={{ fontSize: 14 }} /> },
] as const
type DMFTab = typeof DMF_TABS[number]['key']


export const DMFPipelineWidget: React.FC<{ onOpenAgent?: (agentId: string) => void }> = ({ onOpenAgent }) => {
  const { useMock } = useMockData()
  const [activeTab, setActiveTab] = useState<DMFTab>('lineage')


  // ── Lineage state ─────────────────────────────────────────
  const [lineageMeta,       setLineageMeta]       = useState<{ sourceCodes: string[]; datasetNames: string[]; sourceNames: string[]; targetNames: string[] } | null>(null)
  const [lineageCounts,     setLineageCounts]     = useState<LineageCounts | null>(null)
  const [lineageJobs,       setLineageJobs]       = useState<LineageJob[]>([])
  const [lineageJobsLoading, setLineageJobsLoading] = useState(false)
  const [lineageLoaded,     setLineageLoaded]     = useState(false)
  const [lgSourceCode,      setLgSourceCode]      = useState('All')
  const [lgDataset,         setLgDataset]         = useState('All')
  const [lgProcType,        setLgProcType]        = useState('All')
  const [lgStatus,          setLgStatus]          = useState('All')

  // ── Analytics state ───────────────────────────────────────
  const [analytics,       setAnalytics]       = useState<AnalyticsData | null>(null)
  const [analyticsMeta,       setAnalyticsMeta]       = useState<{ sourceTypes: string[]; targetTypes: string[]; stepNames: string[]; runStatuses: string[] } | null>(null)
  const [analyticsMetaLoaded, setAnalyticsMetaLoaded] = useState(false)
  const [anlSrcType,          setAnlSrcType]          = useState('All')
  const [anlTgtType,          setAnlTgtType]          = useState('All')
  const [anlStepName,         setAnlStepName]         = useState('All')
  const [anlRunStatus,        setAnlRunStatus]        = useState('All')
  const [anlLoading,          setAnlLoading]          = useState(false)

  // ── Trends state ──────────────────────────────────────────
  const [statusTrend,      setStatusTrend]      = useState<any[]>([])
  const [rowsTrend,        setRowsTrend]        = useState<any[]>([])
  const [jobsTrend,        setJobsTrend]        = useState<any[]>([])
  const [stepFailureTrend, setStepFailureTrend] = useState<any[]>([])
  const [trendsLoaded,     setTrendsLoaded]     = useState(false)


  // Reset all lazy-loaded tab data whenever mock toggle changes
  useEffect(() => {
    setLineageLoaded(false)
    setLineageMeta(null)
    setLineageCounts(null)
    setLineageJobs([])
    setLineageJobsLoading(false)
    setAnalytics(null)
    setAnalyticsMetaLoaded(false)
    setAnalyticsMeta(null)
    setAnlSrcType('All'); setAnlTgtType('All'); setAnlStepName('All'); setAnlRunStatus('All')
    setTrendsLoaded(false)
    setStatusTrend([])
    setRowsTrend([])
    setJobsTrend([])
    setStepFailureTrend([])
  }, [useMock])


  // ── Lazy-load Lineage meta + counts (never loads all jobs) ─
  useEffect(() => {
    if (activeTab !== 'lineage' || lineageLoaded) return
    if (useMock) {
      setLineageMeta(MOCK_DMF_LINEAGE_META)
      setLineageCounts(MOCK_DMF_LINEAGE_COUNTS as LineageCounts)
      setLineageLoaded(true)
      return
    }
    Promise.all([
      dmfService.getLineageMeta(),
      dmfService.getLineageCounts(),
    ]).then(([meta, counts]) => {
      setLineageMeta(meta)
      setLineageCounts(counts)
      setLineageLoaded(true)
    }).catch(() => setLineageLoaded(true))
  }, [activeTab, lineageLoaded, useMock])

  // ── Load jobs only when a specific source code is selected ─
  useEffect(() => {
    if (!lineageLoaded || lgSourceCode === 'All') {
      setLineageJobs([])
      return
    }
    if (useMock) {
      setLineageJobs(MOCK_DMF_LINEAGE_JOBS.filter(j => j.sourceCode === lgSourceCode))
      return
    }
    setLineageJobsLoading(true)
    dmfService.getLineageJobs({ src_cd: lgSourceCode, dataset_nm: lgDataset, proc_typ_cd: lgProcType, run_status: lgStatus })
      .then(jobs => setLineageJobs(Array.isArray(jobs) ? jobs : []))
      .catch(() => setLineageJobs([]))
      .finally(() => setLineageJobsLoading(false))
  }, [lineageLoaded, lgSourceCode, lgDataset, lgProcType, lgStatus, useMock])

  // ── Lazy-load Analytics meta (once per mock toggle) ────────
  useEffect(() => {
    if (activeTab !== 'analytics' || analyticsMetaLoaded) return
    if (useMock) {
      setAnalyticsMeta({ sourceTypes: [], targetTypes: [], stepNames: [], runStatuses: [] })
      setAnalyticsMetaLoaded(true)
      setAnalytics(MOCK_DMF_ANALYTICS)
      return
    }
    dmfService.getAnalyticsMeta()
      .then(d => { setAnalyticsMeta(d); setAnalyticsMetaLoaded(true) })
      .catch(() => setAnalyticsMetaLoaded(true))
  }, [activeTab, analyticsMetaLoaded, useMock])

  // ── Re-fetch Analytics data when filters change ───────────
  useEffect(() => {
    if (activeTab !== 'analytics' || !analyticsMetaLoaded || useMock) return
    setAnlLoading(true)
    dmfService.getAnalytics({ src_typ: anlSrcType, tgt_typ: anlTgtType, step_nm: anlStepName, run_status: anlRunStatus })
      .then(d => setAnalytics(d))
      .catch(() => {})
      .finally(() => setAnlLoading(false))
  }, [activeTab, analyticsMetaLoaded, anlSrcType, anlTgtType, anlStepName, anlRunStatus, useMock])

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
      <Box sx={{ display: 'flex', alignItems: 'center', backgroundColor: '#1a2535', px: 2, flexShrink: 0 }}>
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

      {/* ── Agent button strip ── */}
      {onOpenAgent && (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', px: 2, py: 0.75, backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', flexShrink: 0 }}>
          <Button
            size="small"
            variant="contained"
            startIcon={<SmartToyIcon sx={{ fontSize: 13 }} />}
            onClick={() => onOpenAgent('dmf')}
            sx={{
              backgroundColor: '#0288d1',
              textTransform: 'none',
              fontSize: '11px',
              fontWeight: 700,
              height: 28,
              px: 1.5,
              '&:hover': { backgroundColor: '#0277bd' },
            }}
          >
            Ask DMF Agent
          </Button>
        </Box>
      )}

      {/* ── Tab content ── */}
      <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>

      {/* ════════════════════════════════════════════════════════
         LINEAGE TAB
         ════════════════════════════════════════════════════════ */}
      {activeTab === 'lineage' && (
        !lineageLoaded ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}><CircularProgress size={36} /></Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {/* Lineage KPI Summary — counts from server, no full row scan */}
            <StatCardGrid
              items={[
                { label: 'Source Codes', value: lineageMeta?.sourceCodes.length ?? 0, color: '#1565c0', bg: '#e3f2fd' },
                { label: 'Datasets', value: lineageMeta?.datasetNames.length ?? 0, color: '#2e7d32', bg: '#e8f5e9' },
                { label: 'Source Names', value: lineageMeta?.sourceNames.length ?? 0, color: '#f57c00', bg: '#fff3e0' },
                { label: 'Target Names', value: lineageMeta?.targetNames.length ?? 0, color: '#7b1fa2', bg: '#f3e5f5' },
                {
                  label: 'Total Jobs',
                  value: (lineageCounts?.total ?? 0).toLocaleString(),
                  color: '#1976d2', bg: '#e3f2fd',
                },
                {
                  label: 'Success Rate',
                  value: (() => {
                    const s = lineageCounts?.byStatus.find(x => x.status === 'success')?.count ?? 0
                    const t = lineageCounts?.total ?? 0
                    return t > 0 ? Math.round(s / t * 100) : 0
                  })(),
                  unit: '%', color: '#2e7d32', bg: '#e8f5e9',
                },
              ]}
              columns={6}
              compact
            />

            {/* Filter bar — Source Code selection triggers job load */}
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

            {/* Visual breakdowns — powered by aggregate counts, not full job array */}
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>

              {/* Status donut */}
              <Box sx={{ backgroundColor: '#fff', border: '1px solid #e0e0e0', borderRadius: 2, overflow: 'hidden' }}>
                <WidgetShell title="Job Status Distribution" source="All lineage jobs">
                  <Box sx={{ display: 'flex', justifyContent: 'center', py: 1 }}>
                    <DonutChart
                      data={[
                        { name: 'Success', value: lineageCounts?.byStatus.find(x => x.status === 'success')?.count ?? 0, color: '#2e7d32' },
                        { name: 'Failed',  value: lineageCounts?.byStatus.find(x => x.status === 'failed')?.count  ?? 0, color: '#d32f2f' },
                      ].filter(d => d.value > 0)}
                      centerLabel={(lineageCounts?.total ?? 0).toLocaleString()}
                      showLegend
                      size={150}
                    />
                  </Box>
                </WidgetShell>
              </Box>

              {/* Process type donut */}
              <Box sx={{ backgroundColor: '#fff', border: '1px solid #e0e0e0', borderRadius: 2, overflow: 'hidden' }}>
                <WidgetShell title="Process Type Breakdown" source="All lineage jobs">
                  <Box sx={{ display: 'flex', justifyContent: 'center', py: 1 }}>
                    <DonutChart
                      data={['ING','ENR','DIS','INT'].map((type, i) => ({
                        name: type,
                        value: lineageCounts?.byProcType.find(x => x.procTypeCode === type)?.count ?? 0,
                        color: ['#1565c0','#f57c00','#2e7d32','#7b1fa2'][i],
                      })).filter(d => d.value > 0)}
                      centerLabel={(lineageCounts?.total ?? 0).toLocaleString()}
                      showLegend
                      size={150}
                    />
                  </Box>
                </WidgetShell>
              </Box>

              {/* Source code bar chart */}
              <Box sx={{ backgroundColor: '#fff', border: '1px solid #e0e0e0', borderRadius: 2, overflow: 'hidden' }}>
                <WidgetShell title="Jobs by Source Code" source={`Top ${Math.min((lineageCounts?.bySrcCd ?? []).length, 10)}`}>
                  <Box sx={{ px: 1, py: 1 }}>
                    <ComposedBarLineChart
                      data={(lineageCounts?.bySrcCd ?? []).slice(0, 10).map(x => ({
                        name: x.sourceCode,
                        count: x.count,
                      }))}
                      xKey="name"
                      bars={[{ key: 'count', label: 'Jobs', color: '#1565c0' }]}
                      lines={[]}
                      height={180}
                    />
                  </Box>
                </WidgetShell>
              </Box>

              {/* Target name bar chart */}
              <Box sx={{ backgroundColor: '#fff', border: '1px solid #e0e0e0', borderRadius: 2, overflow: 'hidden' }}>
                <WidgetShell title="Jobs by Target Name" source={`Top ${Math.min((lineageCounts?.byTgtNm ?? []).length, 10)}`}>
                  <Box sx={{ px: 1, py: 1 }}>
                    <ComposedBarLineChart
                      data={(lineageCounts?.byTgtNm ?? []).slice(0, 10).map(x => ({
                        name: x.targetName.length > 14 ? x.targetName.slice(0, 14) + '…' : x.targetName,
                        count: x.count,
                      }))}
                      xKey="name"
                      bars={[{ key: 'count', label: 'Jobs', color: '#7b1fa2' }]}
                      lines={[]}
                      height={180}
                    />
                  </Box>
                </WidgetShell>
              </Box>

            </Box>

            {/* Job Details table — only loads when a Source Code is selected */}
            <Box sx={{ backgroundColor: '#fff', border: '1px solid #e0e0e0', borderRadius: 2, overflow: 'hidden' }}>
              <WidgetShell
                title="Job Details"
                source={lgSourceCode === 'All' ? 'Select a Source Code above to load jobs' : `Source: ${lgSourceCode}`}
                actions={
                  lgSourceCode !== 'All'
                    ? <Chip label={`${lineageJobs.length} jobs`} size="small" sx={{ fontSize: '10px', height: 20, backgroundColor: '#e3f2fd', color: '#1565c0', fontWeight: 600 }} />
                    : undefined
                }
              >
                {lgSourceCode === 'All' ? (
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 5, gap: 1 }}>
                    <AccountTreeIcon sx={{ fontSize: 36, color: '#ccc' }} />
                    <Typography sx={{ fontSize: '13px', color: '#aaa' }}>
                      Select a <strong>Source Code</strong> from the filter above to view job details.
                    </Typography>
                    <Typography sx={{ fontSize: '11px', color: '#bbb' }}>
                      Total: {(lineageCounts?.total ?? 0).toLocaleString()} jobs across {lineageMeta?.sourceCodes.length ?? 0} source codes
                    </Typography>
                  </Box>
                ) : lineageJobsLoading ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress size={28} /></Box>
                ) : (
                  <DataTable<LineageJob>
                    columns={lineageColumns}
                    accentColor="#1565c0"
                    rows={lineageJobs}
                    rowKey="id"
                    maxHeight={360}
                    emptyMessage="No lineage jobs match the current filters"
                    compact
                  />
                )}
              </WidgetShell>
            </Box>
          </Box>
        )
      )}

      {/* ════════════════════════════════════════════════════════
         ANALYTICS TAB
         ════════════════════════════════════════════════════════ */}
      {activeTab === 'analytics' && (
        !analyticsMetaLoaded ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}><CircularProgress size={36} /></Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {/* Analytics Filter Bar */}
            <Box sx={{ backgroundColor: '#fff', border: '1px solid #e0e0e0', borderRadius: 2, overflow: 'hidden' }}>
              <WidgetShell title="Analytics Filters" source="Charts refresh on filter change" titleIcon={<FilterListIcon sx={{ fontSize: 16, color: '#1976d2' }} />}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', px: 2, py: 1.5 }}>
                  {[
                    { label: 'Source Type', value: anlSrcType,   setter: setAnlSrcType,   options: analyticsMeta?.sourceTypes ?? [] },
                    { label: 'Target Type', value: anlTgtType,   setter: setAnlTgtType,   options: analyticsMeta?.targetTypes ?? [] },
                    { label: 'Step Name',   value: anlStepName,  setter: setAnlStepName,  options: analyticsMeta?.stepNames   ?? [] },
                    { label: 'Run Status',  value: anlRunStatus, setter: setAnlRunStatus, options: analyticsMeta?.runStatuses ?? [] },
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
                    onClick={() => { setAnlSrcType('All'); setAnlTgtType('All'); setAnlStepName('All'); setAnlRunStatus('All') }}
                    sx={{ height: 32, fontSize: '12px', textTransform: 'none', px: 1.5 }}
                  >
                    Reset
                  </Button>
                  {anlLoading && <CircularProgress size={18} sx={{ ml: 1 }} />}
                </Box>
              </WidgetShell>
            </Box>

          {analytics && (
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

            {/* Status Donut + Source Type (bar) + Target Type (bar) + Step Failures (bar) */}
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

              {/* Source Type Counts — vertical bar chart */}
              <Box sx={{ backgroundColor: '#fff', border: '1px solid #e0e0e0', borderRadius: 2, overflow: 'hidden' }}>
                <WidgetShell title="Count of Source Type" source={`${analytics.sourceTypeCounts.length} types`}>
                  <Box sx={{ px: 1, pb: 1 }}>
                    <ComposedBarLineChart
                      data={analytics.sourceTypeCounts.map(r => ({ type: r.type, count: r.count }))}
                      xKey="type"
                      bars={[{ key: 'count', label: 'Records', color: '#1565c0' }]}
                      lines={[]}
                      height={190}
                      margin={{ top: 6, right: 8, left: -20, bottom: 40 }}
                    />
                  </Box>
                </WidgetShell>
              </Box>

              {/* Target Type Counts — vertical bar chart */}
              <Box sx={{ backgroundColor: '#fff', border: '1px solid #e0e0e0', borderRadius: 2, overflow: 'hidden' }}>
                <WidgetShell title="Count of Target Type" source={`${analytics.targetTypeCounts.length} types`}>
                  <Box sx={{ px: 1, pb: 1 }}>
                    <ComposedBarLineChart
                      data={analytics.targetTypeCounts.map(r => ({ type: r.type, count: r.count }))}
                      xKey="type"
                      bars={[{ key: 'count', label: 'Records', color: '#00838f' }]}
                      lines={[]}
                      height={190}
                      margin={{ top: 6, right: 8, left: -20, bottom: 40 }}
                    />
                  </Box>
                </WidgetShell>
              </Box>

              {/* Step Failure Counts — vertical bar chart */}
              <Box sx={{ backgroundColor: '#fff', border: '1px solid #e0e0e0', borderRadius: 2, overflow: 'hidden' }}>
                <WidgetShell title="Step Failures" source="DMF">
                  <Box sx={{ px: 1, pb: 1 }}>
                    <ComposedBarLineChart
                      data={analytics.stepFailureCounts.map(r => ({ step: r.step, count: r.count }))}
                      xKey="step"
                      bars={[{ key: 'count', label: 'Failures', color: '#d32f2f' }]}
                      lines={[]}
                      height={190}
                      margin={{ top: 6, right: 8, left: -20, bottom: 40 }}
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
          )}
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
