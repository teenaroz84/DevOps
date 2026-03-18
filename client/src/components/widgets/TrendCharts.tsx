/**
 * TrendLineChart — A configurable recharts line chart.
 * ComposedBarLineChart — Bars + one or more lines on dual Y-axes.
 *
 * Usage (line chart):
 *   <TrendLineChart
 *     data={[{ name: 'Jan', failures: 80, recovery: 40 }, ...]}
 *     xKey="name"
 *     lines={[
 *       { key: 'failures', label: 'Failures', color: '#d32f2f' },
 *       { key: 'recovery', label: 'Auto-Recovery', color: '#2e7d32' },
 *     ]}
 *   />
 *
 * Usage (composed bar+line):
 *   <ComposedBarLineChart
 *     data={[{ date: 'Mar 10', total: 160, failed: 9, successRate: 94.4 }, ...]}
 *     xKey="date"
 *     bars={[
 *       { key: 'total', label: 'Total Runs', color: '#1976d2' },
 *       { key: 'failed', label: 'Failed', color: '#d32f2f' },
 *     ]}
 *     lines={[
 *       { key: 'successRate', label: 'Success Rate', color: '#2e7d32', yAxisId: 'right', unit: '%' }
 *     ]}
 *     rightYDomain={[85, 100]}
 *   />
 */
import React from 'react'
import { Box } from '@mui/material'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  ComposedChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'

// ─── TrendLineChart ────────────────────────────────────────

export interface LineConfig {
  key: string
  label: string
  color: string
  strokeWidth?: number
  dashed?: boolean
}

interface TrendLineChartProps {
  data: Record<string, any>[]
  xKey: string
  lines: LineConfig[]
  height?: number
  showGrid?: boolean
  /** Optional fixed domain for Y axis as [min, max] */
  yDomain?: [number | 'auto', number | 'auto']
  margin?: { top?: number; right?: number; bottom?: number; left?: number }
}

export const TrendLineChart: React.FC<TrendLineChartProps> = ({
  data,
  xKey,
  lines,
  height = 220,
  showGrid = true,
  yDomain,
  margin = { top: 10, right: 20, left: -10, bottom: 10 },
}) => {
  return (
    <Box sx={{ width: '100%', height, minWidth: 0 }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={margin}>
          {showGrid && (
            <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" vertical={false} />
          )}
          <XAxis dataKey={xKey} tick={{ fontSize: 11 }} stroke="#bbb" />
          <YAxis
            tick={{ fontSize: 11 }}
            stroke="#bbb"
            domain={yDomain}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#fff',
              border: '1px solid #ddd',
              borderRadius: 4,
              fontSize: 12,
            }}
          />
          <Legend
            wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
            iconSize={10}
          />
          {lines.map(l => (
            <Line
              key={l.key}
              type="monotone"
              dataKey={l.key}
              name={l.label}
              stroke={l.color}
              strokeWidth={l.strokeWidth ?? 2.5}
              strokeDasharray={l.dashed ? '5 4' : undefined}
              dot={{ fill: l.color, r: 3 }}
              activeDot={{ r: 5 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </Box>
  )
}

// ─── ComposedBarLineChart ──────────────────────────────────

export interface BarConfig {
  key: string
  label: string
  color: string
  opacity?: number
  yAxisId?: string
  stackId?: string
}

export interface ComposedLineConfig {
  key: string
  label: string
  color: string
  yAxisId?: string
  strokeWidth?: number
  unit?: string
}

interface ComposedBarLineChartProps {
  data: Record<string, any>[]
  xKey: string
  bars: BarConfig[]
  lines: ComposedLineConfig[]
  height?: number
  showGrid?: boolean
  /** Domain for the right Y axis (for line series) */
  rightYDomain?: [number | 'auto', number | 'auto']
  margin?: { top?: number; right?: number; bottom?: number; left?: number }
}

export const ComposedBarLineChart: React.FC<ComposedBarLineChartProps> = ({
  data,
  xKey,
  bars,
  lines,
  height = 220,
  showGrid = true,
  rightYDomain,
  margin = { top: 5, right: 35, left: 0, bottom: 5 },
}) => {
  const hasRightAxis = lines.some(l => l.yAxisId === 'right')

  return (
    <Box sx={{ width: '100%', height, minWidth: 0 }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={margin}>
          {showGrid && (
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          )}
          <XAxis dataKey={xKey} tick={{ fontSize: 11 }} />
          <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
          {hasRightAxis && (
            <YAxis
              yAxisId="right"
              orientation="right"
              domain={rightYDomain}
              tick={{ fontSize: 11 }}
            />
          )}
          <Tooltip
            contentStyle={{
              backgroundColor: '#fff',
              border: '1px solid #ddd',
              borderRadius: 4,
              fontSize: 12,
            }}
          />
          <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
          {bars.map(b => (
            <Bar
              key={b.key}
              yAxisId={b.yAxisId ?? 'left'}
              dataKey={b.key}
              name={b.label}
              fill={b.color}
              opacity={b.opacity ?? 0.8}
              radius={[2, 2, 0, 0]}
              stackId={b.stackId}
            />
          ))}
          {lines.map(l => (
            <Line
              key={l.key}
              yAxisId={l.yAxisId ?? 'left'}
              type="monotone"
              dataKey={l.key}
              name={l.label}
              stroke={l.color}
              strokeWidth={l.strokeWidth ?? 2}
              dot={{ r: 3, fill: l.color }}
              unit={l.unit}
            />
          ))}
        </ComposedChart>
      </ResponsiveContainer>
    </Box>
  )
}

// ─── SimpleBarChart ────────────────────────────────────────

interface SimpleBarChartProps {
  data: Record<string, any>[]
  xKey: string
  bars: BarConfig[]
  height?: number
  showGrid?: boolean
  margin?: { top?: number; right?: number; bottom?: number; left?: number }
}

export const SimpleBarChart: React.FC<SimpleBarChartProps> = ({
  data,
  xKey,
  bars,
  height = 220,
  showGrid = true,
  margin = { top: 5, right: 10, left: -10, bottom: 5 },
}) => {
  return (
    <Box sx={{ width: '100%', height, minWidth: 0 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={margin}>
          {showGrid && (
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          )}
          <XAxis dataKey={xKey} tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip
            contentStyle={{
              backgroundColor: '#fff',
              border: '1px solid #ddd',
              borderRadius: 4,
              fontSize: 12,
            }}
          />
          <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
          {bars.map(b => (
            <Bar
              key={b.key}
              dataKey={b.key}
              name={b.label}
              fill={b.color}
              opacity={b.opacity ?? 0.85}
              radius={[2, 2, 0, 0]}
              stackId={b.stackId}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </Box>
  )
}
