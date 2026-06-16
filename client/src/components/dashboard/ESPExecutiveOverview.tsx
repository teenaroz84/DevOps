import React, { useMemo } from 'react'
import { Box, Chip, CircularProgress, Paper, Typography } from '@mui/material'

export type EspOverviewIntervalOption = 30 | 60 | 90 | 'all'

export interface EspOverviewCard {
  key: string
  title: string
  description: string
  value: number
  accent: string
  background: string
  trend: Array<{ day: string; value: number }>
}

interface ESPExecutiveOverviewProps {
  cards: EspOverviewCard[]
  loading?: boolean
  error?: string | null
  interval: EspOverviewIntervalOption
  onIntervalChange: (interval: EspOverviewIntervalOption) => void
  scopeLabel: string
}

const INTERVAL_OPTIONS: EspOverviewIntervalOption[] = [30, 60, 90, 'all']

function formatMetric(value: number) {
  return value.toLocaleString('en-US')
}

function formatIntervalLabel(value: EspOverviewIntervalOption) {
  return value === 'all' ? 'All' : `${value}d`
}

function formatIntervalContext(value: EspOverviewIntervalOption) {
  return value === 'all' ? 'all time' : `last ${value} days`
}

function getSparkPoints(values: number[], width = 116, height = 24, padding = 2) {
  if (!values.length) return ''
  const min = Math.min(...values)
  const max = Math.max(...values)
  const spread = max - min || 1

  return values
    .map((point, index) => {
      const x = padding + (index * (width - padding * 2)) / Math.max(values.length - 1, 1)
      const y = height - padding - ((point - min) / spread) * (height - padding * 2)
      return `${x},${y}`
    })
    .join(' ')
}

function getDeltaLabel(card: EspOverviewCard, interval: EspOverviewIntervalOption) {
  const intervalContext = formatIntervalContext(interval)
  if (card.trend.length < 2) return interval === 'all' ? 'All time view' : `No prior data for ${intervalContext}`

  const latest = Number(card.trend[card.trend.length - 1]?.value ?? 0)
  const previous = Number(card.trend[card.trend.length - 2]?.value ?? 0)
  const delta = latest - previous
  if (delta === 0) return `No change in ${intervalContext}`
  return `${delta > 0 ? '▲' : '▼'} ${Math.abs(delta).toLocaleString('en-US')} in ${intervalContext}`
}

export const ESPExecutiveOverview: React.FC<ESPExecutiveOverviewProps> = ({
  cards,
  loading = false,
  error,
  interval,
  onIntervalChange,
  scopeLabel,
}) => {
  const renderedCards = useMemo(() => cards, [cards])

  return (
    <Paper elevation={0} sx={{ borderRadius: 2.5, overflow: 'hidden', border: '1px solid #e8ecf1', boxShadow: '0 10px 24px rgba(15, 23, 42, 0.05)' }}>
      <Box sx={{ px: 2, py: 1.35, borderBottom: '1px solid #eef2f6', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1.5, flexWrap: 'wrap' }}>
        <Box>
          <Typography sx={{ fontSize: '12px', fontWeight: 800, color: '#102a43', textTransform: 'uppercase', letterSpacing: '0.45px' }}>
            ESP Executive Overview
          </Typography>
          <Typography sx={{ mt: 0.35, fontSize: '11px', color: '#607080' }}>
            {scopeLabel}
          </Typography>
        </Box>

        <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.6, flexWrap: 'wrap' }}>
          {INTERVAL_OPTIONS.map((option) => {
            const active = option === interval
            return (
              <Chip
                key={String(option)}
                label={formatIntervalLabel(option)}
                size="small"
                onClick={() => onIntervalChange(option)}
                sx={{
                  height: 24,
                  fontSize: '10px',
                  fontWeight: active ? 800 : 600,
                  cursor: 'pointer',
                  color: active ? '#0f6cbd' : '#64748b',
                  backgroundColor: active ? '#e3f2fd' : '#f8fafc',
                  border: `1px solid ${active ? '#90caf9' : '#d9e2ec'}`,
                  '& .MuiChip-label': { px: 1.1 },
                }}
              />
            )
          })}
        </Box>
      </Box>

      {loading ? (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 116 }}>
          <CircularProgress size={24} sx={{ color: '#1565c0' }} />
        </Box>
      ) : error ? (
        <Box sx={{ px: 2, py: 2.5 }}>
          <Typography sx={{ fontSize: '12px', color: '#c62828' }}>{error}</Typography>
        </Box>
      ) : (
        <Box sx={{ p: 1.5, display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' }, gap: 1.25 }}>
          {renderedCards.map((card) => {
            const sparkValues = card.trend.map((point) => Number(point.value ?? 0))
            const sparkPoints = getSparkPoints(sparkValues)
            return (
              <Paper
                key={card.key}
                elevation={0}
                sx={{
                  borderRadius: 2.5,
                  border: '1px solid #e6ebf2',
                  borderTop: `3px solid ${card.accent}`,
                  backgroundColor: card.background,
                  px: 1.35,
                  py: 1.15,
                  minHeight: 108,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  boxShadow: '0 8px 18px rgba(15, 23, 42, 0.04)',
                }}
              >
                <Box>
                  <Typography sx={{ fontSize: '11px', fontWeight: 700, color: '#3d4b5a', textTransform: 'uppercase', letterSpacing: '0.35px', lineHeight: 1.3 }}>
                    {card.title}
                  </Typography>
                  <Typography sx={{ mt: 0.7, fontSize: '24px', fontWeight: 800, color: '#102a43', letterSpacing: '-0.4px', lineHeight: 1.05 }}>
                    {formatMetric(card.value)}
                  </Typography>
                  <Box sx={{ mt: 0.55, display: 'inline-flex', alignItems: 'center', px: 0.75, py: 0.3, borderRadius: 99, backgroundColor: '#f8fafc' }}>
                    <Typography sx={{ fontSize: '10px', fontWeight: 800, color: '#53657a' }}>{getDeltaLabel(card, interval)}</Typography>
                  </Box>
                  <Typography sx={{ mt: 0.5, fontSize: '10px', color: '#607080', lineHeight: 1.4 }}>
                    {card.description}
                  </Typography>
                </Box>

                <Box sx={{ mt: 0.6 }}>
                  {sparkPoints ? (
                    <svg width="116" height="24" viewBox="0 0 116 24">
                      <polyline
                        fill="none"
                        stroke={card.accent}
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        points={sparkPoints}
                      />
                    </svg>
                  ) : (
                    <Box sx={{ height: 24, display: 'flex', alignItems: 'center' }}>
                      <Typography sx={{ fontSize: '10px', color: '#94a3b8' }}>No trend data</Typography>
                    </Box>
                  )}
                  <Typography sx={{ mt: 0.35, fontSize: '9px', fontWeight: 700, color: card.accent, textTransform: 'uppercase', letterSpacing: '0.3px' }}>
                    {interval === 'all' ? 'Full history view' : `Last ${interval} days`}
                  </Typography>
                </Box>
              </Paper>
            )
          })}
        </Box>
      )}
    </Paper>
  )
}

export default ESPExecutiveOverview