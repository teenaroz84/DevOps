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
}

interface StatCardGridProps {
  items: StatCardItem[]
  /** Number of columns. Defaults to items.length. */
  columns?: number
  /** When true, reduces padding and font sizes */
  compact?: boolean
  /** When set, each card shows a dialog on click */
  withDialog?: boolean
  /** External click handler (overrides dialog behavior) */
  onCardClick?: (item: StatCardItem, idx: number) => void
}

export const StatCardGrid: React.FC<StatCardGridProps> = ({
  items,
  columns,
  compact = false,
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
          const isPositive = item.trend?.startsWith('+') ?? false
          const isGood =
            item.trendPositiveIsGood !== false ? isPositive : !isPositive
          const TrendIcon = isPositive ? TrendingUpIcon : TrendingDownIcon

          return (
            <Box
              key={idx}
              onClick={() => handleClick(item, idx)}
              sx={{
                textAlign: 'center',
                backgroundColor: item.bg ?? '#fafafa',
                border: '1px solid',
                borderColor: item.bg ? 'transparent' : '#e0e0e0',
                borderRadius: 1.5,
                p: compact ? 0.6 : 1.2,
                cursor: isClickable ? 'pointer' : 'default',
                userSelect: 'none',
                transition: 'all 0.2s',
                '&:hover': isClickable
                  ? { boxShadow: '0 3px 10px rgba(0,0,0,0.1)', transform: 'translateY(-2px)' }
                  : {},
              }}
            >
              <Typography
                sx={{
                  fontSize: '10px',
                  fontWeight: 600,
                  color: '#666',
                  mb: 0.3,
                  textTransform: 'uppercase',
                  letterSpacing: '0.3px',
                }}
              >
                {item.label}
              </Typography>

              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'baseline',
                  justifyContent: 'center',
                  gap: '2px',
                }}
              >
                <Typography
                  sx={{
                    fontSize: compact ? '20px' : '26px',
                    fontWeight: 700,
                    color: item.color ?? '#333',
                    lineHeight: 1,
                  }}
                >
                  {item.value}
                </Typography>
                {item.unit && (
                  <Typography
                    sx={{
                      fontSize: compact ? '11px' : '13px',
                      fontWeight: 600,
                      color: item.color ?? '#666',
                      lineHeight: 1,
                    }}
                  >
                    {item.unit}
                  </Typography>
                )}
              </Box>

              {item.trend && (
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 0.3,
                    mt: 0.3,
                  }}
                >
                  <TrendIcon
                    sx={{ fontSize: 12, color: isGood ? '#2e7d32' : '#d32f2f' }}
                  />
                  <Typography
                    sx={{
                      fontSize: '11px',
                      fontWeight: 600,
                      color: isGood ? '#2e7d32' : '#d32f2f',
                    }}
                  >
                    {item.trend}
                  </Typography>
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
