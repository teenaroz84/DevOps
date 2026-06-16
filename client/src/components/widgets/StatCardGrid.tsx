/**
 * StatCardGrid — A responsive grid of numeric KPI stat cards.
 *
 * Each card shows a label, value (+ optional unit), and an optional
 * trend indicator. Cards are clickable to open a detail dialog.
 *
 * Usage:
 *   <StatCardGrid
 *     columns={4}
 *     items={[
 *       { label: 'Success Rate', value: 98, unit: '%', color: '#2e7d32', bg: '#e8f5e9' },
 *       { label: 'SLA Breaches', value: 5, color: '#d32f2f', bg: '#fce4ec',
 *         trend: '+2', trendPositiveIsGood: false },
 *     ]}
 *   />
 */
import React, { useState } from 'react'
import { Box, Typography } from '@mui/material'
import { alpha } from '@mui/material/styles'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'
import TrendingDownIcon from '@mui/icons-material/TrendingDown'
import { WidgetDetailModal } from './WidgetDetailModal'

export interface StatCardItem {
  label: string
  value: string | number
  unit?: string
  color?: string
  bg?: string
  /** Trend string, e.g. "+8%" or "-5%" */
  trend?: string
  /**
   * When true (default), a positive trend is shown green (good).
   * When false, a positive trend is shown red (bad) — e.g. for "Failed Runs".
   */
  trendPositiveIsGood?: boolean
  /** Shown in a detail dialog when the card is clicked */
  description?: string
  /** Extra stats shown in the dialog (key: value pairs) */
  dialogStats?: { label: string; value: string | number }[]
  /** Small pill badge shown below the label (e.g. "Mock Data") */
  tag?: { label: string; color?: string; bg?: string }
}

interface StatCardGridProps {
  items: StatCardItem[]
  /** Number of columns. Defaults to items.length. */
  columns?: number
  /** When true, reduces padding and font sizes */
  compact?: boolean
  /** Visual treatment for the cards */
  variant?: 'default' | 'servicenow'
  /** When set, each card shows a dialog on click */
  withDialog?: boolean
  /** External click handler (overrides dialog behavior) */
  onCardClick?: (item: StatCardItem, idx: number) => void
}

export const StatCardGrid: React.FC<StatCardGridProps> = ({
  items,
  columns,
  compact = false,
  variant = 'default',
  withDialog = false,
  onCardClick,
}) => {
  const [selected, setSelected] = useState<StatCardItem | null>(null)
  const cols = columns ?? items.length

  const handleClick = (item: StatCardItem, idx: number) => {
    if (onCardClick) {
      onCardClick(item, idx)
    } else if (withDialog && item.description) {
      setSelected(item)
    }
  }

  const isClickable = !!onCardClick || withDialog

  return (
    <>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: `repeat(${cols}, 1fr)`,
          gap: compact ? 0.5 : 1,
        }}
      >
        {items.map((item, idx) => {
          const accent = item.color ?? '#0f6cbd'
          const bg = item.bg ?? '#fafafa'
          const hasTrend = Boolean(item.trend)
          const trendDirection = item.trend?.startsWith('+') ? 'up' : item.trend?.startsWith('-') ? 'down' : 'neutral'
          const isPositive = trendDirection === 'up'
          const isGood = trendDirection === 'neutral'
            ? null
            : item.trendPositiveIsGood !== false ? isPositive : !isPositive
          const TrendIcon = trendDirection === 'up' ? TrendingUpIcon : TrendingDownIcon
          const trendColor = isGood === null ? '#53657a' : isGood ? '#15803d' : '#b45309'
          const trendBg = isGood === null ? '#eef2f6' : isGood ? '#f0fdf4' : '#fff7ed'
          const cardStyles = variant === 'servicenow'
            ? {
              textAlign: 'left',
              backgroundColor: bg,
              border: '1px solid #e6ebf2',
              borderTop: `3px solid ${accent}`,
              borderRadius: 2.5,
              p: compact ? 1.1 : 1.35,
              minHeight: compact ? 104 : 112,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              boxShadow: '0 8px 18px rgba(15, 23, 42, 0.04)',
            }
            : {
              textAlign: 'center',
              backgroundColor: bg,
              border: '1px solid',
              borderColor: item.bg ? 'transparent' : '#e0e0e0',
              borderRadius: 1.5,
              p: compact ? 0.6 : 1.2,
            }

          return (
            <Box
              key={idx}
              onClick={() => handleClick(item, idx)}
              sx={{
                ...cardStyles,
                cursor: isClickable ? 'pointer' : 'default',
                userSelect: 'none',
                transition: 'all 0.2s',
                '&:hover': isClickable
                  ? {
                    boxShadow: variant === 'servicenow' ? '0 12px 24px rgba(15, 23, 42, 0.08)' : '0 3px 10px rgba(0,0,0,0.1)',
                    transform: 'translateY(-2px)',
                  }
                  : {},
              }}
            >
              <Typography
                sx={{
                  fontSize: variant === 'servicenow' ? '11px' : '10px',
                  fontWeight: variant === 'servicenow' ? 700 : 600,
                  color: variant === 'servicenow' ? '#475569' : '#666',
                  mb: variant === 'servicenow' ? 0.65 : 0.3,
                  textTransform: 'uppercase',
                  letterSpacing: variant === 'servicenow' ? '0.35px' : '0.3px',
                  lineHeight: 1.3,
                }}
              >
                {item.label}
              </Typography>

              {item.tag && (
                <Box
                  sx={{
                    display: 'inline-block',
                    px: 0.75,
                    py: '1px',
                    borderRadius: '4px',
                    backgroundColor: item.tag.bg ?? (variant === 'servicenow' ? alpha(accent, 0.12) : '#fff3e0'),
                    mb: 0.4,
                  }}
                >
                  <Typography sx={{ fontSize: '9px', fontWeight: 700, color: item.tag.color ?? '#e65100', letterSpacing: '0.3px', textTransform: 'uppercase' }}>
                    {item.tag.label}
                  </Typography>
                </Box>
              )}

              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'baseline',
                  justifyContent: variant === 'servicenow' ? 'flex-start' : 'center',
                  gap: '2px',
                  mb: hasTrend && variant === 'servicenow' ? 0.65 : 0,
                }}
              >
                <Typography
                  sx={{
                    fontSize: variant === 'servicenow'
                      ? compact ? '24px' : '28px'
                      : compact ? '20px' : '26px',
                    fontWeight: variant === 'servicenow' ? 800 : 700,
                    color: variant === 'servicenow' ? '#102a43' : item.color ?? '#333',
                    lineHeight: 1.05,
                    letterSpacing: variant === 'servicenow' ? '-0.4px' : 'normal',
                  }}
                >
                  {item.value}
                </Typography>
                {item.unit && (
                  <Typography
                    sx={{
                      fontSize: variant === 'servicenow'
                        ? compact ? '12px' : '13px'
                        : compact ? '11px' : '13px',
                      fontWeight: 600,
                      color: variant === 'servicenow' ? '#607080' : item.color ?? '#666',
                      lineHeight: 1,
                    }}
                  >
                    {item.unit}
                  </Typography>
                )}
              </Box>

              {hasTrend && (
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: variant === 'servicenow' ? 'flex-start' : 'center',
                    gap: 0.45,
                    mt: variant === 'servicenow' ? 0 : 0.3,
                  }}
                >
                  {variant === 'servicenow' ? (
                    <Box
                      sx={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 0.45,
                        px: 0.8,
                        py: 0.35,
                        borderRadius: 99,
                        backgroundColor: trendBg,
                      }}
                    >
                      {trendDirection !== 'neutral' && (
                        <TrendIcon sx={{ fontSize: 12, color: trendColor }} />
                      )}
                      <Typography
                        sx={{
                          fontSize: '10px',
                          fontWeight: 800,
                          color: trendColor,
                          lineHeight: 1.1,
                        }}
                      >
                        {item.trend}
                      </Typography>
                    </Box>
                  ) : (
                    <>
                      {trendDirection !== 'neutral' && (
                        <TrendIcon sx={{ fontSize: 12, color: isGood ? '#2e7d32' : '#d32f2f' }} />
                      )}
                      <Typography
                        sx={{
                          fontSize: '11px',
                          fontWeight: 600,
                          color: isGood === null ? '#666' : isGood ? '#2e7d32' : '#d32f2f',
                        }}
                      >
                        {item.trend}
                      </Typography>
                    </>
                  )}
                </Box>
              )}
            </Box>
          )
        })}
      </Box>

      {/* Detail dialog */}
      {withDialog && (
        <WidgetDetailModal
          open={!!selected}
          onClose={() => setSelected(null)}
          title={selected?.label ?? ''}
          value={selected?.value}
          unit={selected?.unit}
          color={selected?.color}
          description={selected?.description}
          stats={selected?.dialogStats}
        />
      )}
    </>
  )
}
