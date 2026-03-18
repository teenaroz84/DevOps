import React from 'react'
import { Box, Paper, Typography, Grid } from '@mui/material'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'
import TrendingDownIcon from '@mui/icons-material/TrendingDown'

interface ComparisonMetric {
  label: string
  current: string | number
  previous: string | number
  unit?: string
  trend: 'up' | 'down' | 'neutral'
  percentChange: number
}

interface KPIComparisonProps {
  metrics: ComparisonMetric[]
  title?: string
}

export const KPIComparison: React.FC<KPIComparisonProps> = ({ 
  metrics, 
  title = 'Period Comparison' 
}) => {
  return (
    <Paper
      sx={{
        p: 1.5,
        mb: 1.5,
        backgroundColor: '#fff',
        border: '1px solid #e0e0e0',
        borderRadius: '8px',
      }}
    >
      <Typography variant="h6" sx={{ mb: 1.5, fontWeight: 600, color: '#333' }}>
        {title}
      </Typography>

      <Grid container spacing={1.5}>
        {metrics.map((metric, idx) => (
          <Grid item xs={6} sm={4} md={2.4} key={idx}>
            <Box
              sx={{
                p: 1.5,
                backgroundColor: '#f9f9f9',
                borderRadius: '6px',
                border: '1px solid #f0f0f0',
                textAlign: 'center',
              }}
            >
              {/* Current Value */}
              <Typography variant="h6" sx={{ fontWeight: 700, color: '#1976d2', mb: 0.5 }}>
                {metric.current}
                {metric.unit && <span style={{ fontSize: '12px', marginLeft: '4px' }}>{metric.unit}</span>}
              </Typography>

              {/* Label */}
              <Typography variant="caption" sx={{ display: 'block', color: '#666', mb: 0.5 }}>
                {metric.label}
              </Typography>

              {/* Comparison Row */}
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 0.5,
                  fontSize: '12px',
                  color: metric.trend === 'up' ? '#4caf50' : metric.trend === 'down' ? '#f44336' : '#999',
                }}
              >
                {metric.trend === 'up' && <TrendingUpIcon sx={{ fontSize: '14px' }} />}
                {metric.trend === 'down' && <TrendingDownIcon sx={{ fontSize: '14px' }} />}
                <span>
                  {metric.trend !== 'neutral' ? (
                    <>
                      {Math.abs(metric.percentChange)}% 
                      <span style={{ marginLeft: '4px', color: '#999' }}>vs {metric.previous}</span>
                    </>
                  ) : (
                    <span style={{ color: '#999' }}>vs {metric.previous}</span>
                  )}
                </span>
              </Box>
            </Box>
          </Grid>
        ))}
      </Grid>
    </Paper>
  )
}
