/**
 * MetricBarList — Labeled horizontal progress/metric bars.
 *
 * Each row shows a label (and optional sublabel), a progress bar,
 * and a right-aligned value. The bar color and value can be anything.
 *
 * Usage:
 *   <MetricBarList
 *     items={[
 *       { label: 'Finance ETL',  value: 95, suffix: '%', color: '#2e7d32' },
 *       { label: 'Customer 360', value: 72, max: 200, suffix: ' runs', color: '#1976d2' },
 *     ]}
 *     colorByValue={(v, max) => v / max > 0.9 ? '#2e7d32' : v / max > 0.6 ? '#f57c00' : '#d32f2f'}
 *   />
 */
import React from 'react'
import { Box, Typography } from '@mui/material'

export interface MetricBarItem {
  label: string
  value: number
  /** Denominator for percentage; defaults to 100 */
  max?: number
  /** Bar and value color */
  color?: string
  /** Appended to the value string, e.g. "%" or " runs" */
  suffix?: string
  /** Smaller secondary line below the main label */
  sublabel?: string
  /** Arbitrary element rendered to the right of the value */
  right?: React.ReactNode
  /** Click handler */
  onClick?: () => void
}

interface MetricBarListProps {
  items: MetricBarItem[]
  /** Pixel height of the progress bar. Defaults to 6 */
  barHeight?: number
  /** When provided, overrides item.color and computes color from value/max */
  colorByValue?: (value: number, max: number) => string
  /** If false, hides the bar and shows just labels + values. Defaults to true */
  showBar?: boolean
  /** Padding and font compression */
  compact?: boolean
  /** Default suffix appended to values that don't have their own item.suffix */
  suffix?: string
}

export const MetricBarList: React.FC<MetricBarListProps> = ({
  items,
  barHeight = 6,
  colorByValue,
  showBar = true,
  compact = false,
  suffix: defaultSuffix,
}) => {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: compact ? 1 : 1.5 }}>
      {items.map((item, idx) => {
        const max = item.max ?? 100
        const pct = Math.min((item.value / max) * 100, 100)
        const barColor = colorByValue
          ? colorByValue(item.value, max)
          : item.color ?? '#1976d2'

        return (
          <Box
            key={idx}
            onClick={item.onClick}
            sx={item.onClick ? { cursor: 'pointer', '&:hover': { opacity: 0.85 } } : {}}
          >
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                mb: showBar ? 0.4 : 0,
              }}
            >
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography
                  sx={{
                    fontSize: compact ? '11px' : '12px',
                    fontWeight: 500,
                    color: '#333',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {item.label}
                </Typography>
                {item.sublabel && (
                  <Typography sx={{ fontSize: '10px', color: '#888' }}>
                    {item.sublabel}
                  </Typography>
                )}
              </Box>

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0, ml: 1 }}>
                {item.right}
                <Typography
                  sx={{ fontSize: compact ? '11px' : '12px', fontWeight: 700, color: barColor }}
                >
                  {item.value}{item.suffix ?? defaultSuffix ?? ''}
                </Typography>
              </Box>
            </Box>

            {showBar && (
              <Box
                sx={{
                  height: barHeight,
                  backgroundColor: '#e0e0e0',
                  borderRadius: barHeight / 2,
                  overflow: 'hidden',
                }}
              >
                <Box
                  sx={{
                    height: '100%',
                    width: `${pct}%`,
                    backgroundColor: barColor,
                    borderRadius: barHeight / 2,
                    transition: 'width 0.4s ease',
                  }}
                />
              </Box>
            )}
          </Box>
        )
      })}
    </Box>
  )
}
