/**
 * HeatmapGrid — A 2D grid of colored cells representing a scalar field.
 *
 * Values are mapped to colors via a configurable colorScale function.
 * Rows are labeled on the left; column labels are shown below (optional).
 * Clicking a cell calls onCellClick with row/col/value.
 *
 * Usage:
 *   <HeatmapGrid
 *     rows={['Finance ETL', 'Customer 360', ...]}
 *     cols={['Mar 1', 'Mar 2', ...]}
 *     values={[[95, 88, ...], [72, 91, ...], ...]}
 *     onCellClick={(row, col, val) => showDetail(row, col, val)}
 *   />
 */
import React from 'react'
import { Box, Typography } from '@mui/material'

export interface HeatmapGridProps {
  /** Row label strings (Y axis) */
  rows: string[]
  /** Column label strings (X axis, optional) */
  cols?: string[]
  /** 2D array: values[rowIdx][colIdx], expected range 0–100 */
  values: number[][]
  /** Maps a raw value (0–100) to a CSS color string. Defaults to green/yellow/red. */
  colorScale?: (value: number) => string
  onCellClick?: (row: string, col: string, value: number, rowIdx: number, colIdx: number) => void
  /** Show the color legend below the grid. Defaults to true. */
  showLegend?: boolean
  /** Show row labels on the left. Defaults to false. */
  showRowLabels?: boolean
  /** Height of each cell row in px. Defaults to auto/aspect-1:1 */
  rowLabels?: string[]
}

const DEFAULT_COLOR_SCALE = (value: number): string => {
  if (value > 80) return '#66bb6a'
  if (value > 60) return '#9ccc65'
  if (value > 40) return '#fdd835'
  if (value > 20) return '#fb8c00'
  return '#e53935'
}

export const HeatmapGrid: React.FC<HeatmapGridProps> = ({
  rows,
  cols,
  values,
  colorScale = DEFAULT_COLOR_SCALE,
  onCellClick,
  showLegend = true,
  showRowLabels = false,
  rowLabels,
}) => {
  const labels = rowLabels ?? rows
  const colLabels = cols ?? []

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, height: '100%' }}>
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 0.75 }}>
        {values.map((row, rowIdx) => (
          <Box key={rowIdx} sx={{ display: 'flex', gap: 0.4, alignItems: 'center' }}>
            {showRowLabels && (
              <Typography
                sx={{
                  fontSize: '10px',
                  color: '#555',
                  minWidth: 80,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                  pr: 0.5,
                }}
              >
                {labels[rowIdx]}
              </Typography>
            )}
            {row.map((value, colIdx) => (
              <Box
                key={colIdx}
                onClick={() =>
                  onCellClick?.(
                    rows[rowIdx],
                    colLabels[colIdx] ?? String(colIdx),
                    Math.round(value),
                    rowIdx,
                    colIdx
                  )
                }
                sx={{
                  flex: 1,
                  aspectRatio: '1 / 1',
                  backgroundColor: colorScale(value),
                  borderRadius: '2px',
                  cursor: onCellClick ? 'pointer' : 'default',
                  transition: 'transform 0.15s',
                  '&:hover': onCellClick
                    ? { transform: 'scale(1.15)', boxShadow: '0 2px 8px rgba(0,0,0,0.2)', zIndex: 1 }
                    : {},
                }}
                title={`${rows[rowIdx]}${colLabels[colIdx] ? ` — ${colLabels[colIdx]}` : ''}: ${value.toFixed(0)}%`}
              />
            ))}
          </Box>
        ))}
      </Box>

      {showLegend && (
        <Box sx={{ display: 'flex', gap: 1.5, justifyContent: 'center' }}>
          {[
            { label: 'Healthy', color: '#66bb6a' },
            { label: 'At Risk', color: '#fdd835' },
            { label: 'Critical', color: '#e53935' },
          ].map(l => (
            <Box key={l.label} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Box sx={{ width: 10, height: 10, backgroundColor: l.color, borderRadius: '1px' }} />
              <Typography sx={{ fontSize: '11px', color: '#555' }}>{l.label}</Typography>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  )
}
