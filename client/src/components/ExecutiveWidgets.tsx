import React, { useState } from 'react'
import { Box, Typography, Dialog, DialogTitle, DialogContent, DialogActions, Button } from '@mui/material'
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts'
import WarningIcon from '@mui/icons-material/Warning'

// KPI Summary Widget
export const KPISummary: React.FC = () => {
  const [kpis, setKpis] = useState([
    { label: 'Success Rate', value: '98', unit: '%', color: '#2e7d32', details: 'Pipeline execution success rate. 98% indicates excellent performance with minimal failures.' },
    { label: 'SLA Breaches', value: '5', unit: '', color: '#d32f2f', details: '5 SLA breaches detected in the last 7 days. Critical issue requiring immediate attention.' },
    { label: 'MTTR', value: '1.4', unit: 'hrs', color: '#1565c0', details: 'Mean Time To Recovery. Average time to resolve issues is 1.4 hours.' },
    { label: 'Auto-Resolved', value: '75', unit: '%', color: '#2e7d32', details: '75% of issues are automatically resolved by recovery agents, reducing manual intervention.' },
    { label: 'Cost vs Budget', value: '110', unit: '%', color: '#f57c00', details: 'Operating at 110% of budget. Overspend by 10% - review optimization opportunities.' },
  ])
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null)
  const [selectedKpi, setSelectedKpi] = useState<typeof kpis[0] | null>(null)

  const handleDragStart = (e: React.DragEvent, idx: number) => {
    setDraggedIdx(idx)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('index', idx.toString())
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleDrop = (e: React.DragEvent, targetIdx: number) => {
    e.preventDefault()
    if (draggedIdx === null || draggedIdx === targetIdx) {
      setDraggedIdx(null)
      return
    }

    const newKpis = [...kpis]
    const draggedItem = newKpis[draggedIdx]
    newKpis.splice(draggedIdx, 1)
    newKpis.splice(targetIdx, 0, draggedItem)
    setKpis(newKpis)
    setDraggedIdx(null)
  }

  return (
    <>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, p: 1.2 }}>
        {/* KPI Cards Row */}
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 0.5 }}>
          {kpis.map((kpi, idx) => (
            <Box
              key={idx}
              draggable
              onDragStart={(e) => handleDragStart(e, idx)}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, idx)}
              onClick={() => setSelectedKpi(kpi)}
              sx={{
                textAlign: 'center',
                backgroundColor: '#fafafa',
                border: draggedIdx === idx ? '2px solid #1976d2' : '1px solid #e0e0e0',
                borderRadius: '4px',
                p: 0.6,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                opacity: draggedIdx === idx ? 0.6 : 1,
                '&:active': {
                  cursor: 'grabbing',
                },
                '&:hover': {
                  boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                  backgroundColor: '#f0f0f0',
                },
              }}
            >
              <Typography
                sx={{
                  fontSize: '10px',
                  fontWeight: 600,
                  color: '#666',
                  mb: 0.3,
                  textTransform: 'uppercase',
                  letterSpacing: '0.2px',
                }}
              >
                {kpi.label}
              </Typography>
              <Typography
                sx={{
                  fontSize: '28px',
                  fontWeight: 700,
                  color: kpi.color,
                  lineHeight: 1,
                  mb: 0.2,
                }}
              >
                {kpi.value}
              </Typography>
              {kpi.unit && (
                <Typography
                  sx={{
                    fontSize: '12px',
                    fontWeight: 500,
                    color: kpi.color,
                  }}
                >
                  {kpi.unit}
                </Typography>
              )}
            </Box>
          ))}
        </Box>

        {/* Alert Section */}
        <Box
          sx={{
            backgroundColor: '#fffbfa',
            border: '1px solid #ff9800',
            borderLeft: '4px solid #ff9800',
            borderRadius: '4px',
            p: 0.8,
            display: 'flex',
            gap: 0.4,
            alignItems: 'flex-start',
          }}
        >
          <WarningIcon
            sx={{
              color: '#ff9800',
              fontSize: '18px',
              flexShrink: 0,
              mt: 0.1,
            }}
          />
          <Box>
            <Typography sx={{ fontSize: '12px', color: '#333', fontWeight: 600, mb: 0.2 }}>
              ☁️ 3 pipelines at risk.
            </Typography>
            <Typography sx={{ fontSize: '11px', color: '#666', lineHeight: 1.2 }}>
              Finance D+1 feed delayed due to upstream Talend retry storm.
            </Typography>
          </Box>
        </Box>
      </Box>

      {/* KPI Details Dialog */}
      <Dialog open={!!selectedKpi} onClose={() => setSelectedKpi(null)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 600, color: selectedKpi?.color || '#1976d2' }}>
          {selectedKpi?.label}
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Box sx={{ textAlign: 'center' }}>
              <Typography sx={{ fontSize: '48px', fontWeight: 700, color: selectedKpi?.color }}>
                {selectedKpi?.value}
              </Typography>
              <Typography sx={{ fontSize: '14px', color: '#666', mt: 1 }}>
                {selectedKpi?.unit}
              </Typography>
            </Box>
            <Box sx={{ backgroundColor: '#f5f5f5', p: 2, borderRadius: 1 }}>
              <Typography sx={{ fontSize: '13px', color: '#333', lineHeight: 1.6 }}>
                {selectedKpi?.details}
              </Typography>
            </Box>
            <Box sx={{ backgroundColor: '#f9f9f9', p: 2, borderRadius: 1 }}>
              <Typography sx={{ fontSize: '12px', fontWeight: 600, color: '#666', mb: 1 }}>
                Trend & Last 7 Days:
              </Typography>
              <Typography sx={{ fontSize: '12px', color: '#666', lineHeight: 1.5 }}>
                • Daily Average: {selectedKpi?.value}<br/>
                • Peak: {parseInt(selectedKpi?.value || '0') + 5}{selectedKpi?.unit}<br/>
                • Low: {Math.max(0, parseInt(selectedKpi?.value || '0') - 8)}{selectedKpi?.unit}
              </Typography>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSelectedKpi(null)} variant="contained">
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}

// Pipeline Health Heatmap Widget
export const PipelineHealthHeatmap: React.FC = () => {
  const heatmapData = Array.from({ length: 5 }, () =>
    Array.from({ length: 14 }, () => Math.random() * 100)
  )

  const pipelineNames = ['Finance ETL', 'Customer 360', 'Inventory Sync', 'Sales Feed', 'HR Data']
  const dayLabels = Array.from({ length: 14 }, (_, i) => {
    const date = new Date()
    date.setDate(date.getDate() - (13 - i))
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  })

  const [selectedCell, setSelectedCell] = useState<{
    pipeline: string
    day: string
    value: number
    dayIndex: number
    pipelineIndex: number
  } | null>(null)

  const getColor = (value: number): string => {
    if (value > 80) return '#66bb6a'
    if (value > 60) return '#9ccc65'
    if (value > 40) return '#fdd835'
    if (value > 20) return '#fb8c00'
    return '#e53935'
  }

  const getDetailedMetrics = (value: number) => {
    const runTime = Math.floor(30 + value * 1.5) + ' min'
    const recordsProcessed = Math.floor(50000 + Math.random() * 100000)
    const errorRate = Math.max(0, (100 - value) * 0.5).toFixed(1) + '%'
    const status = value > 80 ? 'Success' : value > 60 ? 'Completed with Warnings' : value > 40 ? 'Partial Failure' : 'Failed'

    return { runTime, recordsProcessed, errorRate, status }
  }

  return (
    <>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, height: '100%', p: 2 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75, flex: 1 }}>
          {heatmapData.map((row, rowIdx) => (
            <Box key={rowIdx} sx={{ display: 'flex', gap: 0.4, justifyContent: 'space-between' }}>
              {row.map((value, colIdx) => (
                <Box
                  key={colIdx}
                  onClick={() =>
                    setSelectedCell({
                      pipeline: pipelineNames[rowIdx],
                      day: dayLabels[colIdx],
                      value: Math.round(value),
                      dayIndex: colIdx,
                      pipelineIndex: rowIdx,
                    })
                  }
                  sx={{
                    flex: 1,
                    aspectRatio: '1 / 1',
                    backgroundColor: getColor(value),
                    borderRadius: '2px',
                    cursor: 'pointer',
                    transition: 'transform 0.2s ease',
                    '&:hover': {
                      transform: 'scale(1.1)',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                    },
                  }}
                  title={`${pipelineNames[rowIdx]} - ${dayLabels[colIdx]}: ${value.toFixed(0)}%`}
                />
              ))}
            </Box>
          ))}
        </Box>
        <Box sx={{ display: 'flex', gap: 1.5, justifyContent: 'center', fontSize: '11px' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Box sx={{ width: '10px', height: '10px', backgroundColor: '#66bb6a', borderRadius: '1px' }} />
            <span>Healthy</span>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Box sx={{ width: '10px', height: '10px', backgroundColor: '#fdd835', borderRadius: '1px' }} />
            <span>At Risk</span>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Box sx={{ width: '10px', height: '10px', backgroundColor: '#e53935', borderRadius: '1px' }} />
            <span>Critical</span>
          </Box>
        </Box>
      </Box>

      {/* Heatmap Details Dialog */}
      <Dialog open={!!selectedCell} onClose={() => setSelectedCell(null)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 600 }}>
          {selectedCell?.pipeline} - {selectedCell?.day}
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          {selectedCell && (() => {
            const metrics = getDetailedMetrics(selectedCell.value)
            return (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Box sx={{ textAlign: 'center' }}>
                  <Box
                    sx={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '80px',
                      height: '80px',
                      borderRadius: '50%',
                      backgroundColor: getColor(selectedCell.value),
                      color: '#fff',
                      fontSize: '32px',
                      fontWeight: 700,
                    }}
                  >
                    {selectedCell.value}%
                  </Box>
                  <Typography sx={{ fontSize: '14px', color: '#666', mt: 2, fontWeight: 600 }}>
                    {metrics.status}
                  </Typography>
                </Box>
                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
                  <Box sx={{ backgroundColor: '#f5f5f5', p: 1.5, borderRadius: 1 }}>
                    <Typography sx={{ fontSize: '11px', fontWeight: 600, color: '#666', mb: 0.5 }}>
                      Run Time
                    </Typography>
                    <Typography sx={{ fontSize: '14px', fontWeight: 700, color: '#333' }}>
                      {metrics.runTime}
                    </Typography>
                  </Box>
                  <Box sx={{ backgroundColor: '#f5f5f5', p: 1.5, borderRadius: 1 }}>
                    <Typography sx={{ fontSize: '11px', fontWeight: 600, color: '#666', mb: 0.5 }}>
                      Error Rate
                    </Typography>
                    <Typography sx={{ fontSize: '14px', fontWeight: 700, color: '#d32f2f' }}>
                      {metrics.errorRate}
                    </Typography>
                  </Box>
                </Box>
                <Box sx={{ backgroundColor: '#f9f9f9', p: 1.5, borderRadius: 1 }}>
                  <Typography sx={{ fontSize: '11px', fontWeight: 600, color: '#666', mb: 0.5 }}>
                    Records Processed
                  </Typography>
                  <Typography sx={{ fontSize: '14px', fontWeight: 700, color: '#333' }}>
                    {metrics.recordsProcessed.toLocaleString()}
                  </Typography>
                </Box>
              </Box>
            )
          })()}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSelectedCell(null)} variant="contained">
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}

// Failures vs Auto-Recovery Trend Widget
export const FailuresVsRecoveryTrend: React.FC = () => {
  const data = [
    { name: 'Jan', failures: 80, recovery: 40 },
    { name: 'Feb', failures: 120, recovery: 70 },
    { name: 'Mar', failures: 150, recovery: 95 },
    { name: 'Apr', failures: 180, recovery: 125 },
    { name: 'May', failures: 210, recovery: 155 },
    { name: 'Jun', failures: 240, recovery: 190 },
  ]

  return (
    <Box sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column' }}>
      <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 10, right: 20, left: -10, bottom: 10 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" vertical={false} />
        <XAxis dataKey="name" tick={{ fontSize: 12 }} stroke="#999" />
        <YAxis tick={{ fontSize: 12 }} stroke="#999" />
        <Tooltip
          contentStyle={{
            backgroundColor: '#fff',
            border: '1px solid #ddd',
            borderRadius: '4px',
            fontSize: '12px',
          }}
        />
        <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
        <Line
          type="monotone"
          dataKey="failures"
          stroke="#d32f2f"
          strokeWidth={2.5}
          dot={{ fill: '#d32f2f', r: 4 }}
          activeDot={{ r: 6 }}
          name="Failures"
        />
        <Line
          type="monotone"
          dataKey="recovery"
          stroke="#2e7d32"
          strokeWidth={2.5}
          dot={{ fill: '#2e7d32', r: 4 }}
          activeDot={{ r: 6 }}
          name="Auto-Recovery"
        />
      </LineChart>
    </ResponsiveContainer>
    </Box>
  )
}

// Business Impact Widget
export const BusinessImpact: React.FC = () => {
  const impacts = [
    { name: 'Affected Data Products', value: 85, color: '#f57c00' },
    { name: 'Retail Sales & Failure', value: 45, color: '#d32f2f' },
    { name: 'Frontier Wireless Drops', value: 25, color: '#2e7d32' },
  ]

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, height: '100%', p: 2 }}>
      {impacts.map((item, idx) => (
        <Box key={idx}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5, alignItems: 'center' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
              <Box
                sx={{
                  width: '14px',
                  height: '14px',
                  backgroundColor: item.color,
                  borderRadius: '2px',
                  flexShrink: 0,
                }}
              />
              <Typography sx={{ fontSize: '12px', fontWeight: 500, color: '#333' }}>
                {item.name}
              </Typography>
            </Box>
            <Box
              sx={{
                width: '60px',
                height: '20px',
                backgroundColor: item.color,
                borderRadius: '2px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Typography
                sx={{
                  fontSize: '11px',
                  fontWeight: 700,
                  color: '#fff',
                }}
              >
                {item.value}
              </Typography>
            </Box>
          </Box>
        </Box>
      ))}
    </Box>
  )
}

// Top Risky Pipelines Widget
export const TopRiskyPipelines: React.FC = () => {
  const risky = [
    { name: 'Finance Daily ETL', risk: 95, color: '#f57c00', fill: '#fff59d' },
    { name: 'Customer 360 Sync', risk: 72, color: '#66bb6a', fill: '#c8e6c9' },
    { name: 'Retail DQ Check', risk: 65, color: '#66bb6a', fill: '#c8e6c9' },
  ]

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, height: '100%', p: 2 }}>
      {risky.map((pipeline, idx) => (
        <Box key={idx} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '18px',
              height: '18px',
              backgroundColor: '#1976d2',
              borderRadius: '3px',
              color: '#fff',
              fontSize: '12px',
              fontWeight: 700,
              flexShrink: 0,
            }}
          >
            ✓
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography
              sx={{
                fontSize: '12px',
                fontWeight: 500,
                color: '#333',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {pipeline.name}
            </Typography>
          </Box>
          <Box
            sx={{
              width: '60px',
              height: '20px',
              backgroundColor: pipeline.fill,
              borderRadius: '2px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: `1px solid ${pipeline.color}`,
              flexShrink: 0,
            }}
          >
            <Typography
              sx={{
                fontSize: '11px',
                fontWeight: 700,
                color: pipeline.color,
              }}
            >
              {pipeline.risk}%
            </Typography>
          </Box>
        </Box>
      ))}
    </Box>
  )
}
