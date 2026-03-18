import React, { useState } from 'react'
import { Box } from '@mui/material'
import ThermostatIcon from '@mui/icons-material/Thermostat'
import ShowChartIcon from '@mui/icons-material/ShowChart'
import BusinessIcon from '@mui/icons-material/Business'
import PriorityHighIcon from '@mui/icons-material/PriorityHigh'
import {
  WidgetShell,
  StatCardGrid,
  StatCardItem,
  MetricBarList,
  TrendLineChart,
  HeatmapGrid,
  AlertBanner,
  WidgetDetailModal,
} from './widgets'

// ─── KPI Summary ──────────────────────────────────────────
export const KPISummary: React.FC = () => {
  const [kpis, setKpis] = useState<StatCardItem[]>([
    { label: 'Success Rate',  value: '98', unit: '%',   color: '#2e7d32', bg: '#e8f5e9',
      description: 'Pipeline execution success rate. 98% indicates excellent performance with minimal failures.',
      dialogStats: [{ label: 'Peak (7d)', value: '99.2%' }, { label: 'Low (7d)', value: '95.1%' }] },
    { label: 'SLA Breaches',  value: '5',  unit: '',    color: '#d32f2f', bg: '#fce4ec',
      description: '5 SLA breaches detected in the last 7 days. Critical issue requiring immediate attention.',
      dialogStats: [{ label: 'P1 Breaches', value: 2 }, { label: 'P2 Breaches', value: 3 }] },
    { label: 'MTTR',          value: '1.4', unit: 'hrs', color: '#1565c0', bg: '#e3f2fd',
      description: 'Mean Time To Recovery. Average time to resolve issues is 1.4 hours.',
      dialogStats: [{ label: 'Best (7d)', value: '0.5 hrs' }, { label: 'Worst (7d)', value: '4.2 hrs' }] },
    { label: 'Auto-Resolved', value: '75', unit: '%',   color: '#2e7d32', bg: '#e8f5e9',
      description: '75% of issues are automatically resolved by recovery agents, reducing manual intervention.',
      dialogStats: [{ label: 'Manual', value: '25%' }, { label: 'Total Issues', value: 240 }] },
    { label: 'Cost vs Budget', value: '110', unit: '%', color: '#f57c00', bg: '#fff3e0',
      description: 'Operating at 110% of budget. Overspend by 10% — review optimization opportunities.',
      dialogStats: [{ label: 'Budget', value: '$120K' }, { label: 'Actual', value: '$132K' }] },
  ])
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null)
  const [selected, setSelected] = useState<StatCardItem | null>(null)

  const handleDragStart = (e: React.DragEvent, idx: number) => {
    setDraggedIdx(idx)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('index', idx.toString())
  }
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault() }
  const handleDrop = (e: React.DragEvent, targetIdx: number) => {
    e.preventDefault()
    if (draggedIdx === null || draggedIdx === targetIdx) { setDraggedIdx(null); return }
    const updated = [...kpis]
    const [dragged] = updated.splice(draggedIdx, 1)
    updated.splice(targetIdx, 0, dragged)
    setKpis(updated)
    setDraggedIdx(null)
  }

  return (
    <>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, p: 1.2 }}>
        {/* Draggable KPI cards using StatCardGrid click API */}
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 0.5 }}>
          {kpis.map((kpi, idx) => (
            <Box
              key={idx}
              draggable
              onDragStart={e => handleDragStart(e, idx)}
              onDragOver={handleDragOver}
              onDrop={e => handleDrop(e, idx)}
            >
              <StatCardGrid
                items={[kpi]}
                columns={1}
                compact
                withDialog={false}
                onCardClick={() => setSelected(kpi)}
              />
            </Box>
          ))}
        </Box>

        <AlertBanner
          severity="warning"
          title="☁️ 3 pipelines at risk."
          message="Finance D+1 feed delayed due to upstream Talend retry storm."
        />
      </Box>

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
    </>
  )
}

// ─── Pipeline Health Heatmap ───────────────────────────────
export const PipelineHealthHeatmap: React.FC = () => {
  const pipelineNames = ['Finance ETL', 'Customer 360', 'Inventory Sync', 'Sales Feed', 'HR Data']
  const dayLabels = Array.from({ length: 14 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (13 - i))
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  })

  const values = Array.from({ length: 5 }, () =>
    Array.from({ length: 14 }, () => Math.random() * 100)
  )

  const [selectedCell, setSelectedCell] = useState<{
    pipeline: string; day: string; value: number
  } | null>(null)

  const getMetrics = (value: number) => ({
    runTime: `${Math.floor(30 + value * 1.5)} min`,
    records: Math.floor(50000 + Math.random() * 100000),
    errorRate: `${Math.max(0, (100 - value) * 0.5).toFixed(1)}%`,
    status: value > 80 ? 'Success' : value > 60 ? 'Completed with Warnings' : value > 40 ? 'Partial Failure' : 'Failed',
  })

  return (
    <>
      <WidgetShell
        title="Pipeline Health Heatmap"
        titleIcon={<ThermostatIcon sx={{ color: '#f57c00', fontSize: 18 }} />}
      >
        <Box sx={{ flex: 1, p: 2, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <HeatmapGrid
            rows={pipelineNames}
            cols={dayLabels}
            values={values}
            onCellClick={(row, col, val) => setSelectedCell({ pipeline: row, day: col, value: val })}
          />
        </Box>
      </WidgetShell>

      <WidgetDetailModal
        open={!!selectedCell}
        onClose={() => setSelectedCell(null)}
        title={selectedCell ? `${selectedCell.pipeline} — ${selectedCell.day}` : ''}
        value={selectedCell?.value}
        unit="%"
        color={
          selectedCell
            ? selectedCell.value > 80 ? '#66bb6a'
              : selectedCell.value > 60 ? '#9ccc65'
              : selectedCell.value > 40 ? '#fdd835'
              : '#e53935'
            : undefined
        }
        description={selectedCell ? getMetrics(selectedCell.value).status : undefined}
        stats={selectedCell ? [
          { label: 'Run Time',           value: getMetrics(selectedCell.value).runTime },
          { label: 'Error Rate',         value: getMetrics(selectedCell.value).errorRate },
          { label: 'Records Processed',  value: getMetrics(selectedCell.value).records.toLocaleString() },
        ] : undefined}
      />
    </>
  )
}

// ─── Failures vs Auto-Recovery Trend ──────────────────────
export const FailuresVsRecoveryTrend: React.FC = () => {
  const data = [
    { name: 'Jan', failures: 80,  recovery: 40  },
    { name: 'Feb', failures: 120, recovery: 70  },
    { name: 'Mar', failures: 150, recovery: 95  },
    { name: 'Apr', failures: 180, recovery: 125 },
    { name: 'May', failures: 210, recovery: 155 },
    { name: 'Jun', failures: 240, recovery: 190 },
  ]

  return (
    <WidgetShell
      title="Failures vs Auto-Recovery"
      titleIcon={<ShowChartIcon sx={{ color: '#1976d2', fontSize: 18 }} />}
    >
      <Box sx={{ flex: 1, px: 1, pb: 1, pt: 0.5, overflow: 'hidden' }}>
        <TrendLineChart
          data={data}
          xKey="name"
          lines={[
            { key: 'failures', label: 'Failures',      color: '#d32f2f' },
            { key: 'recovery', label: 'Auto-Recovery', color: '#2e7d32' },
          ]}
        />
      </Box>
    </WidgetShell>
  )
}

// ─── Business Impact ───────────────────────────────────────
export const BusinessImpact: React.FC = () => {
  const impacts = [
    { label: 'Affected Data Products',  value: 85, max: 120, color: '#f57c00' },
    { label: 'Retail Sales & Failure',  value: 45, max: 120, color: '#d32f2f' },
    { label: 'Frontier Wireless Drops', value: 25, max: 120, color: '#2e7d32' },
  ]

  return (
    <WidgetShell
      title="Business Impact"
      titleIcon={<BusinessIcon sx={{ color: '#f57c00', fontSize: 18 }} />}
    >
      <Box sx={{ flex: 1, p: 2, overflow: 'auto' }}>
        <MetricBarList items={impacts} barHeight={8} />
      </Box>
    </WidgetShell>
  )
}

// ─── Top Risky Pipelines ───────────────────────────────────
export const TopRiskyPipelines: React.FC = () => {
  const items = [
    { label: 'Finance Daily ETL',  value: 95, color: '#f57c00' },
    { label: 'Customer 360 Sync',  value: 72, color: '#43a047' },
    { label: 'Retail DQ Check',    value: 65, color: '#43a047' },
  ]

  return (
    <WidgetShell
      title="Top Risky Pipelines"
      titleIcon={<PriorityHighIcon sx={{ color: '#d32f2f', fontSize: 18 }} />}
    >
      <Box sx={{ flex: 1, p: 2, overflow: 'auto' }}>
        <MetricBarList
          items={items}
          barHeight={8}
          colorByValue={v => v >= 90 ? '#f57c00' : v >= 70 ? '#fdd835' : '#43a047'}
          suffix="%"
        />
      </Box>
    </WidgetShell>
  )
}
