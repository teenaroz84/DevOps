import React, { useEffect, useMemo, useState } from 'react'
import { Autocomplete, Box, Chip, CircularProgress, MenuItem, Paper, TextField, Typography } from '@mui/material'
import DonutLargeIcon from '@mui/icons-material/DonutLarge'
import SupportAgentIcon from '@mui/icons-material/SupportAgent'
import TimelineIcon from '@mui/icons-material/Timeline'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import { ComposedBarLineChart, DonutChart } from '../widgets'
import { useMockData } from '../../context/MockDataContext'
import {
  MOCK_SERVICENOW_INCIDENT_DASHBOARD_SUMMARY,
  MOCK_SERVICENOW_INCIDENT_STATE_DAILY,
  MOCK_SERVICENOW_INCIDENT_TREND,
  MOCK_SERVICENOW_PLATFORMS,
} from '../../services/servicenowMockData'
import {
  servicenowService,
  type ServiceNowAssignmentGroupTop10Row,
  type ServiceNowDaysFilter,
  type ServiceNowIncidentDashboardSummary,
  type ServiceNowPlatformApplicationTop10Row,
  type ServiceNowPriorityDonutRow,
  type ServiceNowSlaPerformancePanel,
} from '../../services/servicenowService'
import { TRUIST } from '../../theme/truistPalette'

type PlatformOption = { platform: string; hasCritical: boolean }

const INCIDENT_DAY_OPTIONS: ServiceNowDaysFilter[] = [30, 60, 90, 'all']

const KPI_CARD_STYLES: Record<string, { accent: string; bg: string; chipBg: string; chipColor: string }> = {
  total: { accent: '#0f6cbd', bg: '#f7fbff', chipBg: '#e3f2fd', chipColor: '#1565c0' },
  new: { accent: '#ef6c00', bg: '#fff8f1', chipBg: '#fff3e0', chipColor: '#ef6c00' },
  open: { accent: '#c62828', bg: '#fff7f7', chipBg: '#fdecea', chipColor: '#c62828' },
  closed: { accent: '#2e7d32', bg: '#f7fcf7', chipBg: '#e8f5e9', chipColor: '#2e7d32' },
  reopened: { accent: TRUIST.dusk, bg: '#faf7fd', chipBg: '#efe7fb', chipColor: TRUIST.dusk },
}

const PRIORITY_RING_COLORS: Record<string, string> = {
  '1 - Critical': '#d32f2f',
  '2 - High': '#f57c00',
  '3 - Moderate': '#1976d2',
  '4 - Low': '#2e7d32',
  '5 - Planning': '#90a4ae',
}

const MOCK_ASSIGNMENT_GROUP_TOP10: ServiceNowAssignmentGroupTop10Row[] = [
  { assignment_group: 'Service Desk', incident_count: 2786, max_count: 2786, pct_of_total: 22.7 },
  { assignment_group: 'Infra Support', incident_count: 2164, max_count: 2786, pct_of_total: 17.6 },
  { assignment_group: 'App Support', incident_count: 1942, max_count: 2786, pct_of_total: 15.8 },
  { assignment_group: 'Network Support', incident_count: 1621, max_count: 2786, pct_of_total: 13.2 },
  { assignment_group: 'DBA Support', incident_count: 1258, max_count: 2786, pct_of_total: 10.2 },
  { assignment_group: 'Security Ops', incident_count: 1102, max_count: 2786, pct_of_total: 9.0 },
  { assignment_group: 'Desktop Support', incident_count: 916, max_count: 2786, pct_of_total: 7.5 },
  { assignment_group: 'SAP Support', incident_count: 843, max_count: 2786, pct_of_total: 6.9 },
  { assignment_group: 'Middleware Support', incident_count: 689, max_count: 2786, pct_of_total: 5.6 },
  { assignment_group: 'Storage Support', incident_count: 507, max_count: 2786, pct_of_total: 4.1 },
]

const MOCK_PLATFORM_APP_TOP10: ServiceNowPlatformApplicationTop10Row[] = [
  { platform_app: 'Windows', total_count: 6125, open_count: 5021, pct_of_open: 15.2 },
  { platform_app: 'SAP', total_count: 4234, open_count: 3698, pct_of_open: 11.2 },
  { platform_app: 'Oracle EBS', total_count: 3125, open_count: 2711, pct_of_open: 8.2 },
  { platform_app: 'Salesforce', total_count: 2342, open_count: 1962, pct_of_open: 6.0 },
  { platform_app: 'Linux', total_count: 1987, open_count: 1692, pct_of_open: 5.1 },
  { platform_app: 'Microsoft 365', total_count: 1856, open_count: 1535, pct_of_open: 4.7 },
  { platform_app: 'Citrix', total_count: 1254, open_count: 1018, pct_of_open: 3.1 },
  { platform_app: 'Azure', total_count: 987, open_count: 821, pct_of_open: 2.5 },
  { platform_app: 'VMware', total_count: 765, open_count: 603, pct_of_open: 1.8 },
  { platform_app: 'Others', total_count: 1893, open_count: 1614, pct_of_open: 4.9 },
]

const MOCK_PRIORITY_DONUT: ServiceNowPriorityDonutRow[] = [
  { priority: '1 - Critical', incident_count: 1245, pct_of_total: 5.1 },
  { priority: '2 - High', incident_count: 5328, pct_of_total: 21.7 },
  { priority: '3 - Moderate', incident_count: 9842, pct_of_total: 40.1 },
  { priority: '4 - Low', incident_count: 7256, pct_of_total: 29.8 },
  { priority: '5 - Planning', incident_count: 897, pct_of_total: 3.6 },
]

const MOCK_SLA_PANEL: ServiceNowSlaPerformancePanel = {
  within_sla: 7745,
  breaching_soon: 1035,
  breached: 376,
  total_open: 9156,
  within_sla_pct: 84.6,
}

function formatRangeLabel(days: ServiceNowDaysFilter) {
  if (days === 'all') return 'All available history'

  const end = new Date()
  const start = new Date()
  start.setDate(end.getDate() - (days - 1))

  const formatDate = (value: Date) =>
    value.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

  return `${formatDate(start)} - ${formatDate(end)}`
}

function formatShortDayLabel(value: string | number) {
  if (typeof value !== 'string') return String(value)
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function getXAxisInterval(length: number) {
  if (length <= 8) return 0
  return Math.max(Math.ceil(length / 6) - 1, 0)
}

function formatMetric(value: number) {
  return value.toLocaleString('en-US')
}

function getTimeWindowLabel(days: ServiceNowDaysFilter) {
  return days === 'all' ? 'All time' : `Last ${days} days`
}

const MetricCard: React.FC<{
  title: string
  value: number
  currentWindowValue: number
  previousWindowValue: number
  subtitle: string
  tone: keyof typeof KPI_CARD_STYLES
  isAllTime?: boolean
}> = ({ title, value, currentWindowValue, previousWindowValue, subtitle, tone, isAllTime = false }) => {
  const style = KPI_CARD_STYLES[tone]

  return (
    <Paper
      elevation={0}
      sx={{
        borderRadius: 2.5,
        border: '1px solid #e6ebf2',
        borderTop: `3px solid ${style.accent}`,
        backgroundColor: style.bg,
        px: 1.5,
        py: 1.35,
        minHeight: 108,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        boxShadow: '0 8px 18px rgba(15, 23, 42, 0.04)',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1 }}>
        <Typography sx={{ fontSize: '11px', fontWeight: 700, color: '#3d4b5a', textTransform: 'uppercase', letterSpacing: '0.35px', lineHeight: 1.3 }}>
          {title}
        </Typography>
        {/* <Chip
          label={isAllTime ? 'All time' : delta.label}
          size="small"
          sx={{
            height: 20,
            bgcolor: isAllTime ? '#eef2f6' : delta.bg,
            color: isAllTime ? '#53657a' : delta.color,
            fontSize: '9px',
            fontWeight: 800,
            '& .MuiChip-label': { px: 0.8 },
          }}
        /> */}
      </Box>
      <Box>
        <Typography sx={{ fontSize: '24px', fontWeight: 800, color: '#102a43', letterSpacing: '-0.4px', lineHeight: 1.05 }}>
          {formatMetric(value)}
        </Typography>
        <Typography sx={{ mt: 0.5, fontSize: '10px', color: '#607080', lineHeight: 1.4 }}>
          {subtitle}
        </Typography>
      </Box>
      <Typography sx={{ fontSize: '9px', fontWeight: 700, color: style.chipColor, textTransform: 'uppercase', letterSpacing: '0.3px' }}>
        {isAllTime ? 'Full history view' : `${formatMetric(currentWindowValue)} vs prior ${formatMetric(previousWindowValue)}`}
      </Typography>
    </Paper>
  )
}

export const ServiceNowIncidentsOverview: React.FC = () => {
  const { useMock } = useMockData()
  const [platforms, setPlatforms] = useState<PlatformOption[]>([])
  const [platformsLoading, setPlatformsLoading] = useState(false)
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null)
  const [days, setDays] = useState<ServiceNowDaysFilter>(90)
  const [summary, setSummary] = useState<ServiceNowIncidentDashboardSummary>(MOCK_SERVICENOW_INCIDENT_DASHBOARD_SUMMARY)
  const [stateDaily, setStateDaily] = useState<any[]>([])
  const [trend, setTrend] = useState<any[]>([])
  const [assignmentTop10, setAssignmentTop10] = useState<ServiceNowAssignmentGroupTop10Row[]>([])
  const [platformAppTop10, setPlatformAppTop10] = useState<ServiceNowPlatformApplicationTop10Row[]>([])
  const [priorityDonut, setPriorityDonut] = useState<ServiceNowPriorityDonutRow[]>([])
  const [slaPanel, setSlaPanel] = useState<ServiceNowSlaPerformancePanel>(MOCK_SLA_PANEL)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const isAllTime = days === 'all'

  useEffect(() => {
    setPlatformsLoading(true)
    if (useMock) {
      setPlatforms(MOCK_SERVICENOW_PLATFORMS)
      setPlatformsLoading(false)
      return
    }
    servicenowService.getPlatforms(90)
      .then((data) => {
        setPlatforms(Array.isArray(data) ? data : [])
        setPlatformsLoading(false)
      })
      .catch(() => setPlatformsLoading(false))
  }, [useMock])

  useEffect(() => {
    setLoading(true)
    setError(null)

    if (useMock) {
      setSummary({ ...MOCK_SERVICENOW_INCIDENT_DASHBOARD_SUMMARY, days, platform: selectedPlatform })
      setStateDaily(MOCK_SERVICENOW_INCIDENT_STATE_DAILY)
      setTrend(MOCK_SERVICENOW_INCIDENT_TREND)
      setAssignmentTop10(MOCK_ASSIGNMENT_GROUP_TOP10)
      setPlatformAppTop10(MOCK_PLATFORM_APP_TOP10)
      setPriorityDonut(MOCK_PRIORITY_DONUT)
      setSlaPanel(MOCK_SLA_PANEL)
      setLoading(false)
      return
    }

    Promise.all([
      servicenowService.getIncidentDashboardSummary(selectedPlatform ?? undefined, days),
      servicenowService.getIncidentStateDaily(selectedPlatform ?? undefined, days),
      servicenowService.getIncidentTrend(selectedPlatform ?? undefined, days),
      servicenowService.getIncidentsAssignmentGroupTop10(),
      servicenowService.getIncidentsPlatformApplicationTop10(),
      servicenowService.getIncidentsPriorityDonut(),
      servicenowService.getSlaPerformancePanel(),
    ])
      .then(([
        summaryData,
        stateDailyData,
        trendData,
        assignmentData,
        platformData,
        priorityData,
        slaData,
      ]) => {
        setSummary(summaryData)
        setStateDaily(Array.isArray(stateDailyData) ? stateDailyData : [])
        setTrend(Array.isArray(trendData) ? trendData : [])
        setAssignmentTop10(Array.isArray(assignmentData) ? assignmentData : [])
        setPlatformAppTop10(Array.isArray(platformData) ? platformData : [])
        setPriorityDonut(Array.isArray(priorityData) ? priorityData : [])
        setSlaPanel(slaData ?? MOCK_SLA_PANEL)
        setLoading(false)
      })
      .catch((err) => {
        setError(err?.message || 'Failed to load incident overview')
        setLoading(false)
      })
  }, [days, selectedPlatform, useMock])

  const chartDonutData = useMemo(
    () => [
      { name: 'New', value: summary.new_current, color: '#ef6c00' },
      { name: 'Open', value: summary.open_current, color: '#c62828' },
      { name: 'Closed', value: summary.closed_current, color: '#2e7d32' },
    ].filter((item) => item.value > 0),
    [summary.closed_current, summary.new_current, summary.open_current],
  )

  const metricCards = useMemo(
    () => [
      {
        key: 'total',
        title: 'Total Incidents',
        value: summary.total_incidents,
        current: summary.current_90d,
        previous: summary.prev_90d,
        subtitle: '' /* `${selectedPlatform ?? 'All platforms'} across the selected executive view` */,
        tone: 'total' as const,
      },
      {
        key: 'new',
        title: 'New Incidents',
        value: summary.new_current,
        current: summary.new_current,
        previous: summary.new_prev,
        subtitle: '' /* isAllTime ? 'Tickets created across all available history' : `Tickets created in the last ${days} days` */,
        tone: 'new' as const,
      },
      {
        key: 'open',
        title: 'Open Incidents',
        value: summary.open_current,
        current: summary.open_current,
        previous: summary.open_prev,
        subtitle: isAllTime ? 'Open-state tickets across all available history' : 'Open-state tickets still active in the current window',
        tone: 'open' as const,
      },
      {
        key: 'closed',
        title: 'Closed Incidents',
        value: summary.closed_current,
        current: summary.closed_current,
        previous: summary.closed_prev,
        subtitle: '' /* isAllTime ? 'Closed-state tickets across all available history' : 'Closed-state tickets completed in the current window' */,
        tone: 'closed' as const,
      },
      {
        key: 'reopened',
        title: 'Reopened Incidents',
        value: summary.reopened_current,
        current: summary.reopened_current,
        previous: summary.reopened_prev,
        subtitle: '' /* isAllTime ? 'Tickets that re-entered the queue across all available history' : 'Tickets that re-entered the queue in the current window' */,
        tone: 'reopened' as const,
      },
    ],
    [days, isAllTime, selectedPlatform, summary],
  )

  const priorityDonutSlices = useMemo(
    () => priorityDonut.map((item) => ({
      name: item.priority,
      value: Number(item.incident_count ?? 0),
      color: PRIORITY_RING_COLORS[item.priority] ?? '#78909c',
    })),
    [priorityDonut],
  )

  const totalPriorityIncidents = useMemo(
    () => priorityDonut.reduce((sum, item) => sum + Number(item.incident_count ?? 0), 0),
    [priorityDonut],
  )

  const slaPercent = Math.max(0, Math.min(100, Number(slaPanel.within_sla_pct ?? 0)))
  const slaNeedleDegrees = -90 + (slaPercent * 1.8)

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Paper
        elevation={0}
        sx={{
          borderRadius: 2.5,
          border: '1px solid #e5ebf2',
          overflow: 'hidden',
          background: 'linear-gradient(135deg, #f8fbff 0%, #ffffff 42%, #f7fafc 100%)',
          boxShadow: '0 14px 32px rgba(15, 23, 42, 0.05)',
        }}
      >
        <Box sx={{ px: { xs: 2, md: 2.5 }, py: 2.25, borderBottom: '1px solid #edf2f7' }}>
          <Box sx={{ display: 'flex', alignItems: { xs: 'flex-start', md: 'center' }, justifyContent: 'space-between', gap: 1.5, flexWrap: 'wrap' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
              <Box sx={{ width: 38, height: 38, borderRadius: 2, bgcolor: '#e8f1fb', color: '#0f6cbd', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <SupportAgentIcon sx={{ fontSize: 20 }} />
              </Box>
              <Box>
                <Typography sx={{ fontSize: '20px', fontWeight: 800, color: '#102a43', letterSpacing: '-0.3px' }}>
                  ServiceNow Incidents Overview
                </Typography>
                {/* <Typography sx={{ mt: 0.4, fontSize: '12px', color: '#5b7083', maxWidth: 720 }}>
                  First section of the incidents dashboard with executive KPIs, state mix, and volume movement. Quick filters are platform-only for now.
                </Typography> */}
              </Box>
            </Box>
            <Chip
              label={`${getTimeWindowLabel(days)} · ${formatRangeLabel(days)}`}
              size="small"
              sx={{
                height: 24,
                bgcolor: '#eff6ff',
                color: '#0f6cbd',
                fontWeight: 700,
                fontSize: '10px',
                border: '1px solid #c7defb',
              }}
            />
          </Box>

          <Box sx={{ mt: 2, display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '280px 1fr' }, gap: 1.5, alignItems: 'center' }}>
            <Autocomplete
              options={platforms}
              getOptionLabel={(option) => option.platform}
              value={platforms.find((option) => option.platform === selectedPlatform) ?? null}
              onChange={(_, value) => setSelectedPlatform(value?.platform ?? null)}
              isOptionEqualToValue={(option, value) => option.platform === value.platform}
              loading={platformsLoading}
              size="small"
              sx={{ '& .MuiInputBase-root': { fontSize: '12px' } }}
              renderOption={({ key, ...props }, option) => (
                <li key={key} {...props}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                      {option.hasCritical && <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: '#c62828' }} />}
                      <Typography sx={{ fontSize: '12px' }}>{option.platform}</Typography>
                    </Box>
                    {option.hasCritical && (
                      <Chip label="P1/P2" size="small" sx={{ height: 18, fontSize: '9px', bgcolor: '#fdecea', color: '#c62828', fontWeight: 700 }} />
                    )}
                  </Box>
                </li>
              )}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Platform"
                  placeholder="All Platforms"
                  InputProps={{
                    ...params.InputProps,
                    endAdornment: (
                      <>
                        {platformsLoading && <CircularProgress size={14} />}
                        {params.InputProps.endAdornment}
                      </>
                    ),
                  }}
                />
              )}
            />

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
              <TextField
                select
                label="Time Window"
                value={String(days)}
                onChange={(event) => {
                  const value = event.target.value
                  setDays(value === 'all' ? 'all' : Number(value))
                }}
                size="small"
                sx={{ minWidth: 170, '& .MuiInputBase-root': { fontSize: '12px' } }}
              >
                {INCIDENT_DAY_OPTIONS.map((option) => (
                  <MenuItem key={String(option)} value={String(option)}>
                    {getTimeWindowLabel(option)}
                  </MenuItem>
                ))}
              </TextField>
              <Chip
                icon={<WarningAmberIcon sx={{ fontSize: 15 }} />}
                label={selectedPlatform ?? 'All Platforms'}
                sx={{
                  height: 28,
                  fontSize: '11px',
                  fontWeight: 700,
                  color: '#5f2a7a',
                  bgcolor: '#f8f1fc',
                  border: '1px solid #e8d8f5',
                }}
              />
            </Box>
          </Box>

          {/* <Box sx={{ mt: 1.5, display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
            <Typography sx={{ fontSize: '11px', fontWeight: 700, color: '#607080', textTransform: 'uppercase', letterSpacing: '0.45px' }}>
              Quick Filters
            </Typography>
            <Chip
              label="All Platforms"
              onClick={() => setSelectedPlatform(null)}
              sx={{
                height: 24,
                fontSize: '10px',
                fontWeight: selectedPlatform === null ? 800 : 600,
                color: selectedPlatform === null ? '#0f6cbd' : '#607080',
                bgcolor: selectedPlatform === null ? '#e8f1fb' : '#f4f7fb',
                border: selectedPlatform === null ? '1px solid #c2daf8' : '1px solid #e5ebf2',
                cursor: 'pointer',
              }}
            />
            {quickPlatforms.map((platform) => {
              const active = selectedPlatform === platform.platform
              return (
                <Chip
                  key={platform.platform}
                  label={platform.platform}
                  onClick={() => setSelectedPlatform(active ? null : platform.platform)}
                  sx={{
                    height: 24,
                    fontSize: '10px',
                    fontWeight: active ? 800 : 600,
                    color: active ? '#0f6cbd' : '#607080',
                    bgcolor: active ? '#e8f1fb' : '#ffffff',
                    border: `1px solid ${active ? '#c2daf8' : '#dde6ef'}`,
                    cursor: 'pointer',
                  }}
                />
              )
            })}
          </Box> */}
        </Box>

        {loading ? (
          <Box sx={{ px: 2.5, py: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1.25 }}>
            <CircularProgress size={20} />
            <Typography sx={{ fontSize: '12px', color: '#607080' }}>Loading ServiceNow incident overview…</Typography>
          </Box>
        ) : error ? (
          <Box sx={{ px: 2.5, py: 4 }}>
            <Typography sx={{ fontSize: '12px', color: '#c62828' }}>{error}</Typography>
          </Box>
        ) : (
          <Box sx={{ p: { xs: 2, md: 2.5 }, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(5, minmax(0, 1fr))' }, gap: 1.1 }}>
              {metricCards.map((card) => (
                <MetricCard
                  key={card.key}
                  title={card.title}
                  value={card.value}
                  currentWindowValue={card.current}
                  previousWindowValue={card.previous}
                  subtitle={card.subtitle}
                  tone={card.tone}
                  isAllTime={isAllTime}
                />
              ))}
            </Box>

            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1.55fr 0.95fr 1.15fr' }, gap: 1.1, alignItems: 'stretch' }}>
              <Paper elevation={0} sx={{ borderRadius: 2.5, border: '1px solid #e6ebf2', p: 1.6, boxShadow: '0 8px 18px rgba(15, 23, 42, 0.04)' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.25 }}>
                  <TimelineIcon sx={{ fontSize: 18, color: '#0f6cbd' }} />
                  <Box>
                    <Typography sx={{ fontSize: '13px', fontWeight: 800, color: '#102a43' }}>Incidents by State Over Time (Daily Stacked Bar)</Typography>
                    <Typography sx={{ fontSize: '11px', color: '#607080' }}>Daily stacked state composition for the selected interval</Typography>
                  </Box>
                </Box>
                <ComposedBarLineChart
                  data={stateDaily}
                  xKey="day"
                  bars={[
                    { key: 'new', label: 'New', color: '#ef6c00', stackId: 'states' },
                    { key: 'open', label: 'Open', color: '#c62828', stackId: 'states' },
                    { key: 'closed', label: 'Closed', color: '#2e7d32', stackId: 'states' },
                  ]}
                  lines={[]}
                  height={228}
                  xAxisTickFormatter={formatShortDayLabel}
                  xAxisInterval={getXAxisInterval(stateDaily.length)}
                  xAxisHeight={36}
                />
              </Paper>

              <Paper elevation={0} sx={{ borderRadius: 2.5, border: '1px solid #e6ebf2', p: 1.6, boxShadow: '0 8px 18px rgba(15, 23, 42, 0.04)' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.25 }}>
                  <DonutLargeIcon sx={{ fontSize: 18, color: TRUIST.dusk }} />
                  <Box>
                    <Typography sx={{ fontSize: '13px', fontWeight: 800, color: '#102a43' }}>Current State Breakdown</Typography>
                    <Typography sx={{ fontSize: '11px', color: '#607080' }}>New, open, and closed incident mix in the active window</Typography>
                  </Box>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'center', pt: 1 }}>
                  <DonutChart data={chartDonutData} centerLabel={chartDonutData.reduce((sum, item) => sum + item.value, 0)} size={152} innerRadius={36} outerRadius={58} showLegend />
                </Box>
              </Paper>

              <Paper elevation={0} sx={{ borderRadius: 2.5, border: '1px solid #e6ebf2', p: 1.6, boxShadow: '0 8px 18px rgba(15, 23, 42, 0.04)' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.25 }}>
                  <TrendingUpIcon sx={{ fontSize: 18, color: '#0f6cbd' }} />
                  <Box>
                    <Typography sx={{ fontSize: '13px', fontWeight: 800, color: '#102a43' }}>Incident Trend (Daily Line Chart)</Typography>
                    <Typography sx={{ fontSize: '11px', color: '#607080' }}>Daily incident volume over the last 90 days</Typography>
                  </Box>
                </Box>
                <ComposedBarLineChart
                  data={trend}
                  xKey="day"
                  bars={[]}
                  lines={[
                    { key: 'total', label: 'Total', color: '#0f6cbd', strokeWidth: 2.5 },
                  ]}
                  height={228}
                  xAxisTickFormatter={formatShortDayLabel}
                  xAxisInterval={getXAxisInterval(trend.length)}
                  xAxisHeight={36}
                />
              </Paper>
            </Box>

            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr 1fr 1fr' }, gap: 1.1, alignItems: 'stretch' }}>
              <Paper elevation={0} sx={{ borderRadius: 2.5, border: '1px solid #e6ebf2', p: 1.6, boxShadow: '0 8px 18px rgba(15, 23, 42, 0.04)' }}>
                <Typography sx={{ fontSize: '14px', fontWeight: 800, color: '#102a43', mb: 1 }}>By Assignment Group (Top 10)</Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {assignmentTop10.map((row) => {
                    const max = Number(row.max_count || 1)
                    const value = Number(row.incident_count || 0)
                    const widthPct = Math.min((value / max) * 100, 100)
                    return (
                      <Box key={row.assignment_group}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, mb: 0.2 }}>
                          <Typography sx={{ fontSize: '11px', color: '#334155', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {row.assignment_group}
                          </Typography>
                          <Typography sx={{ fontSize: '11px', fontWeight: 700, color: '#0f6cbd' }}>
                            {formatMetric(value)}
                          </Typography>
                        </Box>
                        <Box sx={{ height: 7, borderRadius: 4, backgroundColor: '#eaf1fb', overflow: 'hidden' }}>
                          <Box sx={{ height: '100%', width: `${widthPct}%`, borderRadius: 4, backgroundColor: '#2f6bd2' }} />
                        </Box>
                      </Box>
                    )
                  })}
                </Box>
              </Paper>

              <Paper elevation={0} sx={{ borderRadius: 2.5, border: '1px solid #e6ebf2', p: 1.6, boxShadow: '0 8px 18px rgba(15, 23, 42, 0.04)' }}>
                <Typography sx={{ fontSize: '14px', fontWeight: 800, color: '#102a43', mb: 1 }}>By Platform (Top 10)</Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {platformAppTop10.map((row) => {
                    const max = Math.max(...platformAppTop10.map((item) => Number(item.total_count || 0)), 1)
                    const value = Number(row.total_count || 0)
                    const widthPct = Math.min((value / max) * 100, 100)
                    return (
                      <Box key={row.platform_app}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, mb: 0.2 }}>
                          <Typography sx={{ fontSize: '11px', color: '#334155', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {row.platform_app}
                          </Typography>
                          <Typography sx={{ fontSize: '11px', fontWeight: 700, color: '#6d5bd0' }}>
                            {formatMetric(value)}
                          </Typography>
                        </Box>
                        <Box sx={{ height: 7, borderRadius: 4, backgroundColor: '#f0edfe', overflow: 'hidden' }}>
                          <Box sx={{ height: '100%', width: `${widthPct}%`, borderRadius: 4, backgroundColor: '#6d5bd0' }} />
                        </Box>
                      </Box>
                    )
                  })}
                </Box>
              </Paper>

              <Paper elevation={0} sx={{ borderRadius: 2.5, border: '1px solid #e6ebf2', p: 1.6, boxShadow: '0 8px 18px rgba(15, 23, 42, 0.04)' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.8 }}>
                  <Typography sx={{ fontSize: '14px', fontWeight: 800, color: '#102a43' }}>Incidents by Priority</Typography>
                  <Typography sx={{ fontSize: '11px', color: '#607080' }}>All open</Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 0.25 }}>
                  <DonutChart data={priorityDonutSlices} centerLabel={totalPriorityIncidents} size={156} innerRadius={34} outerRadius={56} />
                </Box>
                <Box sx={{ mt: 0.6, display: 'flex', flexDirection: 'column', gap: 0.45 }}>
                  {priorityDonut.map((row) => (
                    <Box key={row.priority} sx={{ display: 'grid', gridTemplateColumns: '1fr auto auto', alignItems: 'center', gap: 1 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6, minWidth: 0 }}>
                        <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: PRIORITY_RING_COLORS[row.priority] ?? '#78909c' }} />
                        <Typography sx={{ fontSize: '11px', color: '#334155', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {row.priority}
                        </Typography>
                      </Box>
                      <Typography sx={{ fontSize: '11px', fontWeight: 700, color: '#102a43' }}>{formatMetric(Number(row.incident_count || 0))}</Typography>
                      <Typography sx={{ fontSize: '11px', color: '#607080' }}>{Number(row.pct_of_total || 0).toFixed(1)}%</Typography>
                    </Box>
                  ))}
                </Box>
              </Paper>

              <Paper elevation={0} sx={{ borderRadius: 2.5, border: '1px solid #e6ebf2', p: 1.6, boxShadow: '0 8px 18px rgba(15, 23, 42, 0.04)' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.8 }}>
                  <Typography sx={{ fontSize: '14px', fontWeight: 800, color: '#102a43' }}>SLA Performance (Open)</Typography>
                  <Typography sx={{ fontSize: '11px', color: '#0f6cbd' }}>View SLA Dashboard</Typography>
                </Box>

                <Box sx={{ display: 'flex', justifyContent: 'center', py: 0.5 }}>
                  <Box sx={{ position: 'relative', width: 188, height: 106, overflow: 'hidden' }}>
                    <Box
                      sx={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: 188,
                        height: 188,
                        borderRadius: '50%',
                        background: 'conic-gradient(#2e7d32 0deg 220deg, #f9a825 220deg 300deg, #c62828 300deg 360deg)',
                      }}
                    />
                    <Box
                      sx={{
                        position: 'absolute',
                        top: 18,
                        left: 18,
                        width: 152,
                        height: 152,
                        borderRadius: '50%',
                        backgroundColor: '#fff',
                      }}
                    />
                    <Box
                      sx={{
                        position: 'absolute',
                        left: '50%',
                        bottom: 14,
                        width: 2,
                        height: 66,
                        backgroundColor: '#1f2937',
                        transformOrigin: 'bottom center',
                        transform: `translateX(-50%) rotate(${slaNeedleDegrees}deg)`,
                        borderRadius: 2,
                      }}
                    />
                    <Box sx={{ position: 'absolute', left: '50%', bottom: 10, width: 10, height: 10, borderRadius: '50%', bgcolor: '#1f2937', transform: 'translateX(-50%)' }} />
                    <Box sx={{ position: 'absolute', left: 0, right: 0, bottom: 2, textAlign: 'center' }}>
                      <Typography sx={{ fontSize: '38px', fontWeight: 800, color: '#1f4732', letterSpacing: '-1px', lineHeight: 1 }}>
                        {slaPercent.toFixed(1)}%
                      </Typography>
                      <Typography sx={{ fontSize: '11px', color: '#607080' }}>Within SLA</Typography>
                    </Box>
                  </Box>
                </Box>

                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 0.8, mt: 0.7, alignItems: 'center' }}>
                  <Typography sx={{ fontSize: '11px', color: '#2e7d32' }}>Within SLA</Typography>
                  <Typography sx={{ fontSize: '11px', fontWeight: 700, color: '#102a43' }}>{formatMetric(Number(slaPanel.within_sla || 0))}</Typography>
                  <Typography sx={{ fontSize: '11px', color: '#607080' }}>{((Number(slaPanel.within_sla || 0) / Math.max(Number(slaPanel.total_open || 1), 1)) * 100).toFixed(1)}%</Typography>

                  <Typography sx={{ fontSize: '11px', color: '#f57c00' }}>Breaching Soon</Typography>
                  <Typography sx={{ fontSize: '11px', fontWeight: 700, color: '#102a43' }}>{formatMetric(Number(slaPanel.breaching_soon || 0))}</Typography>
                  <Typography sx={{ fontSize: '11px', color: '#607080' }}>{((Number(slaPanel.breaching_soon || 0) / Math.max(Number(slaPanel.total_open || 1), 1)) * 100).toFixed(1)}%</Typography>

                  <Typography sx={{ fontSize: '11px', color: '#c62828' }}>Breached</Typography>
                  <Typography sx={{ fontSize: '11px', fontWeight: 700, color: '#102a43' }}>{formatMetric(Number(slaPanel.breached || 0))}</Typography>
                  <Typography sx={{ fontSize: '11px', color: '#607080' }}>{((Number(slaPanel.breached || 0) / Math.max(Number(slaPanel.total_open || 1), 1)) * 100).toFixed(1)}%</Typography>
                </Box>

                <Box sx={{ mt: 1, p: 0.9, borderRadius: 1.2, border: '1px solid #fde8d6', bgcolor: '#fff7ed' }}>
                  <Typography sx={{ fontSize: '10px', color: '#9a3412', fontWeight: 700 }}>SLA Breach Risk Active</Typography>
                  <Typography sx={{ mt: 0.25, fontSize: '10px', color: '#7c2d12' }}>
                    {formatMetric(Number(slaPanel.breaching_soon || 0))} incidents are due within 4 hours.
                  </Typography>
                </Box>
              </Paper>
            </Box>
          </Box>
        )}
      </Paper>
    </Box>
  )
}

export default ServiceNowIncidentsOverview