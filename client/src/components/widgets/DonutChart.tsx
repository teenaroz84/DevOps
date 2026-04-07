/**
 * DonutChart — A pie/donut chart with an optional side legend.
 *
 * Usage:
 *   <DonutChart
 *     data={[
 *       { name: 'Success', value: 1177, color: '#2e7d32' },
 *       { name: 'In Progress', value: 74, color: '#f57c00' },
 *       { name: 'Failed', value: 68, color: '#d32f2f' },
 *     ]}
 *     title="Pipeline Run Status"
 *     innerRadius={28}
 *     outerRadius={44}
 *   />
 */
import React from 'react'
import { Box, Tooltip, Typography } from '@mui/material'
import {
  PieChart,
  Pie,
  Cell,
  Tooltip as RechartsTooltip,
} from 'recharts'

export interface DonutSlice {
  name: string
  value: number
  color: string
}

interface DonutChartProps {
  data: DonutSlice[]
  /** Chart panel width/height in px. Defaults to 120 */
  size?: number
  innerRadius?: number
  outerRadius?: number
  /** Show an inline legend to the right of the chart */
  showLegend?: boolean
  /** Label for the center (e.g. total) */
  centerLabel?: string | number
  title?: string
  /** When set, wraps the whole thing in a titled section card */
  showTitle?: boolean
}

export const DonutChart: React.FC<DonutChartProps> = ({
  data,
  size = 120,
  innerRadius = 28,
  outerRadius = 46,
  showLegend = true,
  centerLabel,
  title,
  showTitle = false,
}) => {
  const cx = size / 2
  const cy = size / 2

  return (
    <Box>
      {showTitle && title && (
        <Typography
          sx={{ fontWeight: 700, fontSize: '12px', color: '#1a1a1a', mb: 0.5 }}
        >
          {title}
        </Typography>
      )}

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        {/* Chart */}
        <Box sx={{ position: 'relative', flexShrink: 0 }}>
          <PieChart width={size} height={size}>
            <Pie
              data={data}
              cx={cx}
              cy={cy}
              innerRadius={innerRadius}
              outerRadius={outerRadius}
              paddingAngle={2}
              dataKey="value"
              startAngle={90}
              endAngle={-270}
            >
              {data.map((entry, i) => (
                <Cell key={i} fill={entry.color} />
              ))}
            </Pie>
            <RechartsTooltip
              formatter={(val: any) => [
                typeof val === 'number' ? val.toLocaleString() : val,
              ]}
              contentStyle={{
                fontSize: 12,
                border: '1px solid #ddd',
                borderRadius: 4,
              }}
            />
          </PieChart>

          {/* Center label */}
          {centerLabel !== undefined && (
            <Box
              sx={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                textAlign: 'center',
                pointerEvents: 'none',
              }}
            >
              <Typography sx={{ fontSize: '13px', fontWeight: 800, color: '#333', lineHeight: 1 }}>
                {typeof centerLabel === 'number'
                  ? centerLabel.toLocaleString()
                  : centerLabel}
              </Typography>
            </Box>
          )}
        </Box>

        {/* Legend */}
        {showLegend && (
          <Box sx={{ flex: 1, minWidth: 80 }}>
            {data.map(item => (
              <Tooltip
                key={item.name}
                title={`${item.name}: ${item.value.toLocaleString()}`}
                placement="right"
                arrow
              >
                <Box
                  sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5, cursor: 'default' }}
                >
                  <Box
                    sx={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      backgroundColor: item.color,
                      flexShrink: 0,
                    }}
                  />
                  <Typography
                    sx={{
                      fontSize: '11px',
                      color: '#555',
                      flex: 1,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {item.name}
                  </Typography>
                  <Typography sx={{ fontSize: '12px', fontWeight: 700, color: '#222', flexShrink: 0 }}>
                    {item.value.toLocaleString()}
                  </Typography>
                </Box>
              </Tooltip>
            ))}
          </Box>
        )}
      </Box>
    </Box>
  )
}

/**
 * DonutPair — Two donuts side by side with titles, in a shared container.
 * Useful for showing two related breakdowns at once.
 */
interface DonutPairProps {
  left: { title: string; data: DonutSlice[] }
  right: { title: string; data: DonutSlice[] }
  size?: number
}

export const DonutPair: React.FC<DonutPairProps> = ({ left, right, size = 120 }) => {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <Box
        sx={{
          backgroundColor: '#fff',
          border: '1px solid #e0e0e0',
          borderRadius: 2,
          p: 1.5,
        }}
      >
        <Typography sx={{ fontWeight: 700, fontSize: '12px', color: '#1a1a1a', mb: 0.5 }}>
          {left.title}
        </Typography>
        <DonutChart data={left.data} size={size} showLegend />
      </Box>

      <Box
        sx={{
          backgroundColor: '#fff',
          border: '1px solid #e0e0e0',
          borderRadius: 2,
          p: 1.5,
        }}
      >
        <Typography sx={{ fontWeight: 700, fontSize: '12px', color: '#1a1a1a', mb: 0.5 }}>
          {right.title}
        </Typography>
        <DonutChart data={right.data} size={size} showLegend />
      </Box>
    </Box>
  )
}
