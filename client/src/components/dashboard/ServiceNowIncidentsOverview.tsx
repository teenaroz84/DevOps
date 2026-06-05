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
  type ServiceNowDaysFilter,
  type ServiceNowIncidentDashboardSummary,
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
      setLoading(false)
      return
    }

    Promise.all([
      servicenowService.getIncidentDashboardSummary(selectedPlatform ?? undefined, days),
      servicenowService.getIncidentStateDaily(selectedPlatform ?? undefined, days),
      servicenowService.getIncidentTrend(selectedPlatform ?? undefined, days),
    ])
      .then(([summaryData, stateDailyData, trendData]) => {
        setSummary(summaryData)
        setStateDaily(Array.isArray(stateDailyData) ? stateDailyData : [])
        setTrend(Array.isArray(trendData) ? trendData : [])
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
          </Box>
        )}
      </Paper>
    </Box>
  )
}

export default ServiceNowIncidentsOverview