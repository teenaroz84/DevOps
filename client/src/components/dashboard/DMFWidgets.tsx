import React, { useState, useEffect } from 'react'
import {
  Box,
  Typography,
  Chip,
  CircularProgress,
  Button,
  Autocomplete,
  TextField,
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
  const [lgSourceCode,      setLgSourceCode]      = useState('')
  const [lgDatasets,        setLgDatasets]        = useState<string[]>([])
  const [lgProcTypes,       setLgProcTypes]       = useState<string[]>([])
  const [lgStatuses,        setLgStatuses]        = useState<string[]>([])

  // ── Analytics state ───────────────────────────────────────
  const [analytics,       setAnalytics]       = useState<AnalyticsData | null>(null)
  const [analyticsMeta,       setAnalyticsMeta]       = useState<{ sourceTypes: string[]; targetTypes: string[]; stepNames: string[]; runStatuses: string[] } | null>(null)
  const [analyticsMetaLoaded, setAnalyticsMetaLoaded] = useState(false)
  const [anlSrcTypes,         setAnlSrcTypes]         = useState<string[]>([])
  const [anlTgtTypes,         setAnlTgtTypes]         = useState<string[]>([])
  const [anlStepNames,        setAnlStepNames]        = useState<string[]>([])
  const [anlRunStatuses,      setAnlRunStatuses]      = useState<string[]>([])
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
    setLgSourceCode('')
    setLgDatasets([])
    setLgProcTypes([])
    setLgStatuses([])
    setAnalytics(null)
    setAnalyticsMetaLoaded(false)
    setAnalyticsMeta(null)
    setAnlSrcTypes([]); setAnlTgtTypes([]); setAnlStepNames([]); setAnlRunStatuses([])
    setTrendsLoaded(false)
    setStatusTrend([])
    setRowsTrend([])
    setJobsTrend([])
    setStepFailureTrend([])
  }, [useMock])


  // ── Reset sub-filters when source changes ──────────────────────
  useEffect(() => {
    setLgDatasets([])
    setLgProcTypes([])
    setLgStatuses([])
  }, [lgSourceCode])

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
    if (!lineageLoaded || !lgSourceCode) {
      setLineageJobs([])
      return
    }
    if (useMock) {
      setLineageJobs(MOCK_DMF_LINEAGE_JOBS.filter(j => j.sourceCode === lgSourceCode))
      return
    }
    setLineageJobsLoading(true)
    dmfService.getLineageJobs({ src_cd: lgSourceCode })
      .then(jobs => setLineageJobs(Array.isArray(jobs) ? jobs : []))
      .catch(() => setLineageJobs([]))
      .finally(() => setLineageJobsLoading(false))
  }, [lineageLoaded, lgSourceCode, useMock])

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
    dmfService.getAnalytics({
      src_typ:    anlSrcTypes.length   ? anlSrcTypes.join(',')   : 'All',
      tgt_typ:    anlTgtTypes.length   ? anlTgtTypes.join(',')   : 'All',
      step_nm:    anlStepNames.length  ? anlStepNames.join(',')  : 'All',
      run_status: anlRunStatuses.length ? anlRunStatuses.join(',') : 'All',
    })
      .then(d => setAnalytics(d))
      .catch(() => {})
      .finally(() => setAnlLoading(false))
  }, [activeTab, analyticsMetaLoaded, anlSrcTypes, anlTgtTypes, anlStepNames, anlRunStatuses, useMock])

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
    { key: 'sourceCode',      header: 'Source',           width: 90 },
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
        ) : (() => {
          // ─ Derived: use lineageJobs when source selected, else global counts ─
          const isFiltered = !!lgSourceCode

          const filteredJobs = isFiltered
            ? lineageJobs.filter(j =>
                (lgDatasets.length === 0 || lgDatasets.includes(j.datasetName)) &&
                (lgProcTypes.length === 0 || lgProcTypes.includes(j.processTypeCode)) &&
                (lgStatuses.length === 0 || lgStatuses.includes(j.status))
              )
            : []

          const displayTotal = isFiltered ? filteredJobs.length : (lineageCounts?.total ?? 0)

          const displayByStatus = isFiltered
            ? [
                { status: 'success' as const, count: filteredJobs.filter(j => j.status === 'success').length },
                { status: 'failed'  as const, count: filteredJobs.filter(j => j.status === 'failed').length },
              ].filter(x => x.count > 0)
            : (lineageCounts?.byStatus ?? [])

          const displayByProcType = isFiltered
            ? ['ING','ENR','DIS','INT'].map(t => ({
                procTypeCode: t,
                count: filteredJobs.filter(j => j.processTypeCode === t).length,
              })).filter(x => x.count > 0)
            : (lineageCounts?.byProcType ?? [])

          const displayByTgtNm: { targetName: string; count: number }[] = isFiltered
            ? Object.entries(
                filteredJobs.reduce((acc, j) => {
                  acc[j.targetName] = (acc[j.targetName] ?? 0) + 1
                  return acc
                }, {} as Record<string, number>)
              ).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([targetName, count]) => ({ targetName, count }))
            : (lineageCounts?.byTgtNm ?? [])

          const successCount = displayByStatus.find(x => x.status === 'success')?.count ?? 0
          const successRate  = displayTotal > 0 ? Math.round(successCount / displayTotal * 100) : 0
          const hasSubFilters = lgDatasets.length > 0 || lgProcTypes.length > 0 || lgStatuses.length > 0

          return (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>

              {/* ── 1. Source selector ────────────────────────────────────── */}
              {/* ── 1. Combined Filters ────────────────────────────────────── */}
              <Box sx={{ backgroundColor: '#fff', border: '1px solid #e0e0e0', borderRadius: 2, p: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                  <FilterListIcon sx={{ fontSize: 15, color: '#1565c0' }} />
                  <Typography sx={{ fontWeight: 700, fontSize: '12px', color: '#37474f' }}>Filters</Typography>
                  <Typography sx={{ fontSize: '11px', color: '#aaa', ml: 0.5 }}>
                    {!isFiltered
                      ? `${lineageMeta?.sourceCodes.length ?? 0} sources · ${(lineageCounts?.total ?? 0).toLocaleString()} total jobs`
                      : lineageJobsLoading
                        ? `Loading jobs for ${lgSourceCode}…`
                        : `${filteredJobs.length} of ${lineageJobs.length} jobs · ${lgSourceCode}`}
                  </Typography>
                  {(isFiltered || hasSubFilters) && (
                    <Button
                      size="small"
                      onClick={() => { setLgSourceCode(''); setLgDatasets([]); setLgProcTypes([]); setLgStatuses([]) }}
                      sx={{ ml: 'auto', fontSize: '11px', color: '#d32f2f', textTransform: 'none', height: 22, minWidth: 'auto', px: 1 }}
                    >
                      Clear All
                    </Button>
                  )}
                </Box>
                <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                  {/* Source — searchable, clearable single-select */}
                  <Autocomplete
                    options={lineageMeta?.sourceCodes ?? []}
                    value={lgSourceCode || null}
                    onChange={(_, v) => setLgSourceCode(v ?? '')}
                    size="small"
                    sx={{ minWidth: 180 }}
                    renderInput={(params) => (
                      <TextField {...params} label="Source" placeholder="Search sources…" size="small" />
                    )}
                    ListboxProps={{ sx: { fontSize: '12px' } }}
                  />
                  {/* Dataset — multi-select */}
                  <Autocomplete
                    multiple
                    limitTags={2}
                    disableCloseOnSelect
                    options={lineageMeta?.datasetNames ?? []}
                    value={lgDatasets}
                    onChange={(_, v) => setLgDatasets(v)}
                    disabled={!isFiltered}
                    size="small"
                    sx={{ minWidth: 200 }}
                    renderInput={(params) => (
                      <TextField {...params} label="Dataset" size="small" />
                    )}
                    renderTags={(val, getTagProps) =>
                      val.map((opt, idx) => (
                        <Chip {...getTagProps({ index: idx })} key={opt} label={opt} size="small" sx={{ fontSize: '10px', height: 18 }} />
                      ))
                    }
                    ListboxProps={{ sx: { fontSize: '12px' } }}
                  />
                  {/* Process Type — multi-select */}
                  <Autocomplete
                    multiple
                    limitTags={2}
                    disableCloseOnSelect
                    options={['ING', 'ENR', 'DIS', 'INT']}
                    value={lgProcTypes}
                    onChange={(_, v) => setLgProcTypes(v)}
                    disabled={!isFiltered}
                    size="small"
                    sx={{ minWidth: 160 }}
                    renderInput={(params) => (
                      <TextField {...params} label="Process Type" size="small" />
                    )}
                    renderTags={(val, getTagProps) =>
                      val.map((opt, idx) => (
                        <Chip {...getTagProps({ index: idx })} key={opt} label={opt} size="small" sx={{ fontSize: '10px', height: 18 }} />
                      ))
                    }
                    ListboxProps={{ sx: { fontSize: '12px' } }}
                  />
                  {/* Status — multi-select */}
                  <Autocomplete
                    multiple
                    limitTags={2}
                    disableCloseOnSelect
                    options={['success', 'failed']}
                    value={lgStatuses}
                    onChange={(_, v) => setLgStatuses(v)}
                    disabled={!isFiltered}
                    size="small"
                    sx={{ minWidth: 140 }}
                    renderInput={(params) => (
                      <TextField {...params} label="Status" size="small" />
                    )}
                    renderTags={(val, getTagProps) =>
                      val.map((opt, idx) => (
                        <Chip
                          {...getTagProps({ index: idx })}
                          key={opt}
                          label={opt}
                          size="small"
                          sx={{
                            fontSize: '10px', height: 18,
                            backgroundColor: opt === 'success' ? '#e8f5e9' : '#fce4ec',
                            color: opt === 'success' ? '#2e7d32' : '#c62828',
                          }}
                        />
                      ))
                    }
                    ListboxProps={{ sx: { fontSize: '12px' } }}
                  />
                  {lineageJobsLoading && <CircularProgress size={16} sx={{ mt: 1 }} />}
                </Box>
              </Box>

              {/* ── 2. KPI strip ───────────────────────────────────────────── */}
              <StatCardGrid
                items={[
                  { label: 'Sources', value: lineageMeta?.sourceCodes.length ?? 0, color: '#1565c0', bg: '#e3f2fd' },
                  { label: 'Datasets', value: lineageMeta?.datasetNames.length ?? 0, color: '#2e7d32', bg: '#e8f5e9' },
                  { label: 'Source Names', value: lineageMeta?.sourceNames.length ?? 0, color: '#f57c00', bg: '#fff3e0' },
                  { label: 'Target Names', value: lineageMeta?.targetNames.length ?? 0, color: '#7b1fa2', bg: '#f3e5f5' },
                  {
                    label: isFiltered ? `Jobs ( ${lgSourceCode} )` : 'Total Jobs',
                    value: isFiltered ? displayTotal.toLocaleString() : (lineageCounts?.total ?? 0).toLocaleString(),
                    color: '#1976d2', bg: '#e3f2fd',
                  },
                  {
                    label: 'Success Rate',
                    value: successRate,
                    unit: '%', color: '#2e7d32', bg: '#e8f5e9',
                  },
                ]}
                columns={6}
                compact
              />

              {/* ── 3. Sub-filters (only when source selected) ─────────────── */}
              {/* ── 4. Charts ─────────────────────────────────────────────── */}
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>

                {/* Status donut */}
                <Box sx={{ backgroundColor: '#fff', border: '1px solid #e0e0e0', borderRadius: 2, overflow: 'hidden' }}>
                  <WidgetShell
                    title="Job Status Distribution"
                    source={isFiltered ? `Source: ${lgSourceCode}` : 'All sources'}
                  >
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 1 }}>
                      {isFiltered && lineageJobsLoading ? (
                        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress size={24} /></Box>
                      ) : (
                        <DonutChart
                          data={[
                            { name: 'Success', value: displayByStatus.find(x => x.status === 'success')?.count ?? 0, color: '#2e7d32' },
                            { name: 'Failed',  value: displayByStatus.find(x => x.status === 'failed')?.count  ?? 0, color: '#d32f2f' },
                          ].filter(d => d.value > 0)}
                          centerLabel={displayTotal.toLocaleString()}
                          showLegend
                          size={150}
                        />
                      )}
                    </Box>
                  </WidgetShell>
                </Box>

                {/* Process type donut */}
                <Box sx={{ backgroundColor: '#fff', border: '1px solid #e0e0e0', borderRadius: 2, overflow: 'hidden' }}>
                  <WidgetShell
                    title="Process Type Breakdown"
                    source={isFiltered ? `Source: ${lgSourceCode}` : 'All sources'}
                  >
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 1 }}>
                      {isFiltered && lineageJobsLoading ? (
                        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress size={24} /></Box>
                      ) : (
                        <DonutChart
                          data={['ING','ENR','DIS','INT'].map((type, i) => ({
                            name: type,
                            value: displayByProcType.find(x => x.procTypeCode === type)?.count ?? 0,
                            color: ['#1565c0','#f57c00','#2e7d32','#7b1fa2'][i],
                          })).filter(d => d.value > 0)}
                          centerLabel={displayTotal.toLocaleString()}
                          showLegend
                          size={150}
                        />
                      )}
                    </Box>
                  </WidgetShell>
                </Box>

                {/* Source bar chart — hidden when single source selected; show target dist instead */}
                {!isFiltered ? (
                  <Box sx={{ backgroundColor: '#fff', border: '1px solid #e0e0e0', borderRadius: 2, overflow: 'hidden' }}>
                    <WidgetShell title="Jobs by Source" source={`Top ${Math.min((lineageCounts?.bySrcCd ?? []).length, 10)}`}>
                      <Box sx={{ px: 1, py: 1 }}>
                        <ComposedBarLineChart
                          data={(lineageCounts?.bySrcCd ?? []).slice(0, 10).map(x => ({ name: x.sourceCode, count: x.count }))}
                          xKey="name"
                          bars={[{ key: 'count', label: 'Jobs', color: '#1565c0' }]}
                          lines={[]}
                          height={180}
                        />
                      </Box>
                    </WidgetShell>
                  </Box>
                ) : (
                  <Box sx={{ backgroundColor: '#fff', border: '1px solid #e0e0e0', borderRadius: 2, overflow: 'hidden' }}>
                    <WidgetShell title="Jobs by Dataset" source={`Source: ${lgSourceCode}`}>
                      <Box sx={{ px: 1, py: 1 }}>
                        {lineageJobsLoading ? (
                          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress size={24} /></Box>
                        ) : (
                          <ComposedBarLineChart
                            data={Object.entries(
                              filteredJobs.reduce((acc, j) => {
                                acc[j.datasetName] = (acc[j.datasetName] ?? 0) + 1
                                return acc
                              }, {} as Record<string, number>)
                            ).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([name, count]) => ({
                              name: name.length > 16 ? name.slice(0, 16) + '…' : name,
                              count,
                            }))}
                            xKey="name"
                            bars={[{ key: 'count', label: 'Jobs', color: '#1565c0' }]}
                            lines={[]}
                            height={180}
                          />
                        )}
                      </Box>
                    </WidgetShell>
                  </Box>
                )}

                {/* Target name bar chart */}
                <Box sx={{ backgroundColor: '#fff', border: '1px solid #e0e0e0', borderRadius: 2, overflow: 'hidden' }}>
                  <WidgetShell
                    title="Jobs by Target Name"
                    source={isFiltered ? `Source: ${lgSourceCode}` : `Top ${Math.min((lineageCounts?.byTgtNm ?? []).length, 10)}`}
                  >
                    <Box sx={{ px: 1, py: 1 }}>
                      {isFiltered && lineageJobsLoading ? (
                        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress size={24} /></Box>
                      ) : (
                        <ComposedBarLineChart
                          data={displayByTgtNm.map(x => ({
                            name: x.targetName.length > 14 ? x.targetName.slice(0, 14) + '…' : x.targetName,
                            count: x.count,
                          }))}
                          xKey="name"
                          bars={[{ key: 'count', label: 'Jobs', color: '#7b1fa2' }]}
                          lines={[]}
                          height={180}
                        />
                      )}
                    </Box>
                  </WidgetShell>
                </Box>

              </Box>

              {/* ── 5. Job Details table ──────────────────────────────────────── */}
              <Box sx={{ backgroundColor: '#fff', border: '1px solid #e0e0e0', borderRadius: 2, overflow: 'hidden' }}>
                <WidgetShell
                  title="Job Details"
                  source={!lgSourceCode ? 'Select a source above to load jobs' : `Source: ${lgSourceCode}`}
                  actions={
                    lgSourceCode
                      ? <Chip label={`${filteredJobs.length} jobs`} size="small" sx={{ fontSize: '10px', height: 20, backgroundColor: '#e3f2fd', color: '#1565c0', fontWeight: 600 }} />
                      : undefined
                  }
                >
                  {!lgSourceCode ? (
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 5, gap: 1 }}>
                      <AccountTreeIcon sx={{ fontSize: 36, color: '#ccc' }} />
                      <Typography sx={{ fontSize: '13px', color: '#aaa' }}>
                        Select a <strong>Source</strong> above to view job details.
                      </Typography>
                      <Typography sx={{ fontSize: '11px', color: '#bbb' }}>
                        Total: {(lineageCounts?.total ?? 0).toLocaleString()} jobs across {lineageMeta?.sourceCodes.length ?? 0} sources
                      </Typography>
                    </Box>
                  ) : lineageJobsLoading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress size={28} /></Box>
                  ) : (
                    <DataTable<LineageJob>
                      columns={lineageColumns}
                      accentColor="#1565c0"
                      rows={filteredJobs}
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
        })()
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
            <Box sx={{ backgroundColor: '#fff', border: '1px solid #e0e0e0', borderRadius: 2, p: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                <FilterListIcon sx={{ fontSize: 15, color: '#1976d2' }} />
                <Typography sx={{ fontWeight: 700, fontSize: '12px', color: '#37474f' }}>Filters</Typography>
                <Typography sx={{ fontSize: '11px', color: '#aaa', ml: 0.5 }}>Charts refresh on filter change</Typography>
                {(anlSrcTypes.length > 0 || anlTgtTypes.length > 0 || anlStepNames.length > 0 || anlRunStatuses.length > 0) && (
                  <Button
                    size="small"
                    onClick={() => { setAnlSrcTypes([]); setAnlTgtTypes([]); setAnlStepNames([]); setAnlRunStatuses([]) }}
                    sx={{ ml: 'auto', fontSize: '11px', color: '#d32f2f', textTransform: 'none', height: 22, minWidth: 'auto', px: 1 }}
                  >
                    Clear All
                  </Button>
                )}
              </Box>
              <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                {/* Source Type — multi-select */}
                <Autocomplete
                  multiple
                  limitTags={2}
                  disableCloseOnSelect
                  options={analyticsMeta?.sourceTypes ?? []}
                  value={anlSrcTypes}
                  onChange={(_, v) => setAnlSrcTypes(v)}
                  size="small"
                  sx={{ minWidth: 180 }}
                  renderInput={(params) => (
                    <TextField {...params} label="Source Type" size="small" />
                  )}
                  renderTags={(val, getTagProps) =>
                    val.map((opt, idx) => (
                      <Chip {...getTagProps({ index: idx })} key={opt} label={opt} size="small" sx={{ fontSize: '10px', height: 18 }} />
                    ))
                  }
                  ListboxProps={{ sx: { fontSize: '12px' } }}
                />
                {/* Target Type — multi-select */}
                <Autocomplete
                  multiple
                  limitTags={2}
                  disableCloseOnSelect
                  options={analyticsMeta?.targetTypes ?? []}
                  value={anlTgtTypes}
                  onChange={(_, v) => setAnlTgtTypes(v)}
                  size="small"
                  sx={{ minWidth: 180 }}
                  renderInput={(params) => (
                    <TextField {...params} label="Target Type" size="small" />
                  )}
                  renderTags={(val, getTagProps) =>
                    val.map((opt, idx) => (
                      <Chip {...getTagProps({ index: idx })} key={opt} label={opt} size="small" sx={{ fontSize: '10px', height: 18 }} />
                    ))
                  }
                  ListboxProps={{ sx: { fontSize: '12px' } }}
                />
                {/* Step Name — multi-select, searchable */}
                <Autocomplete
                  multiple
                  limitTags={2}
                  disableCloseOnSelect
                  options={analyticsMeta?.stepNames ?? []}
                  value={anlStepNames}
                  onChange={(_, v) => setAnlStepNames(v)}
                  size="small"
                  sx={{ minWidth: 200 }}
                  renderInput={(params) => (
                    <TextField {...params} label="Step Name" size="small" />
                  )}
                  renderTags={(val, getTagProps) =>
                    val.map((opt, idx) => (
                      <Chip {...getTagProps({ index: idx })} key={opt} label={opt} size="small" sx={{ fontSize: '10px', height: 18 }} />
                    ))
                  }
                  ListboxProps={{ sx: { fontSize: '12px' } }}
                />
                {/* Run Status — multi-select */}
                <Autocomplete
                  multiple
                  limitTags={2}
                  disableCloseOnSelect
                  options={analyticsMeta?.runStatuses ?? []}
                  value={anlRunStatuses}
                  onChange={(_, v) => setAnlRunStatuses(v)}
                  size="small"
                  sx={{ minWidth: 160 }}
                  renderInput={(params) => (
                    <TextField {...params} label="Run Status" size="small" />
                  )}
                  renderTags={(val, getTagProps) =>
                    val.map((opt, idx) => (
                      <Chip
                        {...getTagProps({ index: idx })}
                        key={opt}
                        label={opt}
                        size="small"
                        sx={{
                          fontSize: '10px', height: 18,
                          backgroundColor: opt === 'success' ? '#e8f5e9' : opt === 'failed' ? '#fce4ec' : '#f3e5f5',
                          color: opt === 'success' ? '#2e7d32' : opt === 'failed' ? '#c62828' : '#7b1fa2',
                        }}
                      />
                    ))
                  }
                  ListboxProps={{ sx: { fontSize: '12px' } }}
                />
                {anlLoading && <CircularProgress size={16} sx={{ mt: 1 }} />}
              </Box>
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
