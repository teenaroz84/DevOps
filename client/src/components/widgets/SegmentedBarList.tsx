/**
 * SegmentedBarList — A list of rows showing stacked colored segments within a bar.
 *
 * Ideal for showing multi-category breakdowns per row (e.g. pipeline stages
 * broken down by Success/InProgress/Failed, or error reasons by stage).
 *
 * Usage:
 *   <SegmentedBarList
 *     items={stages.map(s => ({
 *       label: s.stage,
 *       labelColor: STAGE_COLORS[s.stage],
 *       segments: [
 *         { value: s.success,    color: '#2e7d32', label: 'Success' },
 *         { value: s.inProgress, color: '#f57c00', label: 'In Progress' },
 *         { value: s.failed,     color: '#d32f2f', label: 'Failed' },
 *       ],
 *       rightLabel: `${s.rate}%`,
 *       rightColor: s.rate >= 90 ? '#2e7d32' : '#d32f2f',
 *       selected: selectedStage === s.stage,
 *       onClick: () => onStageClick(s.stage),
 *     }))}
 *     legend={[
 *       { color: '#2e7d32', label: 'Success' },
 *       { color: '#f57c00', label: 'In Progress' },
 *       { color: '#d32f2f', label: 'Failed' },
 *     ]}
 *   />
 */
import React from 'react'
import { Box, Typography } from '@mui/material'

export interface SegmentedBarSegment {
  value: number
  color: string
  label: string
}

export interface SegmentedBarItem {
  label: string
  /** Color applied to the row label text */
  labelColor?: string
  segments: SegmentedBarSegment[]
  /** Text displayed right-aligned after the bar */
  rightLabel?: string | number
  /** Color of rightLabel */
  rightColor?: string
  /** Highlighted state (e.g. when this row is the active filter) */
  selected?: boolean
  onClick?: () => void
  /** Min fraction (0–1) of total width needed to show count inside segment */
  minLabelPct?: number
}

interface SegmentedBarListProps {
  items: SegmentedBarItem[]
  barHeight?: number
  /** Label legend shown below the list */
  legend?: { color: string; label: string }[]
  /** Width reserved on the left for the row label */
  labelWidth?: number
  compact?: boolean
}

export const SegmentedBarList: React.FC<SegmentedBarListProps> = ({
  items,
  barHeight = 22,
  legend,
  labelWidth = 100,
  compact = false,
}) => {
  const minLabelPct = 0.08

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: compact ? 0.75 : 1.5 }}>
      {items.map((item, idx) => {
        const total = item.segments.reduce((s, seg) => s + seg.value, 0)

        return (
          <Box
            key={idx}
            onClick={item.onClick}
            sx={{
              p: compact ? 0.5 : 1,
              borderRadius: 1,
              cursor: item.onClick ? 'pointer' : 'default',
              backgroundColor: item.selected ? '#e3f2fd' : 'transparent',
              border: item.selected ? '1px solid #1976d2' : '1px solid transparent',
              transition: 'all 0.15s',
              '&:hover': item.onClick
                ? { backgroundColor: item.selected ? '#e3f2fd' : '#f5f5f5' }
                : {},
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {/* Row label */}
              <Typography
                sx={{
                  fontSize: compact ? '11px' : '12px',
                  fontWeight: 600,
                  color: item.labelColor ?? '#333',
                  width: labelWidth,
                  flexShrink: 0,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {item.label}
              </Typography>

              {/* Stacked bar */}
              <Box
                sx={{
                  flex: 1,
                  display: 'flex',
                  height: barHeight,
                  borderRadius: 1,
                  overflow: 'hidden',
                  gap: '1px',
                }}
              >
                {item.segments.map((seg, si) => {
                  const pct = total > 0 ? seg.value / total : 0
                  if (pct === 0) return null
                  const showCount = pct > minLabelPct

                  return (
                    <Box
                      key={si}
                      title={`${seg.label}: ${seg.value.toLocaleString()}`}
                      sx={{
                        width: `${pct * 100}%`,
                        backgroundColor: seg.color,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'width 0.3s',
                      }}
                    >
                      {showCount && (
                        <Typography
                          sx={{
                            fontSize: '10px',
                            color: '#fff',
                            fontWeight: 700,
                            userSelect: 'none',
                          }}
                        >
                          {seg.value.toLocaleString()}
                        </Typography>
                      )}
                    </Box>
                  )
                })}
              </Box>

              {/* Right label */}
              {item.rightLabel !== undefined && (
                <Typography
                  sx={{
                    fontSize: compact ? '12px' : '13px',
                    fontWeight: 700,
                    color: item.rightColor ?? '#333',
                    minWidth: 38,
                    textAlign: 'right',
                    flexShrink: 0,
                  }}
                >
                  {item.rightLabel}
                </Typography>
              )}
            </Box>
          </Box>
        )
      })}

      {/* Legend */}
      {legend && legend.length > 0 && (
        <Box
          sx={{
            display: 'flex',
            gap: 2,
            pt: 1,
            borderTop: '1px solid #f0f0f0',
            flexWrap: 'wrap',
          }}
        >
          {legend.map(l => (
            <Box key={l.label} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Box
                sx={{ width: 10, height: 10, borderRadius: 0.5, backgroundColor: l.color }}
              />
              <Typography sx={{ fontSize: '11px', color: '#555' }}>{l.label}</Typography>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  )
}
