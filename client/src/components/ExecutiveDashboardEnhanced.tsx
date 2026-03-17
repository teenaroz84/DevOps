import React, { useState, useEffect } from 'react'
import { Box, Container, Typography, CircularProgress } from '@mui/material'
import { DashboardFilters, DashboardFilters as DashboardFiltersType } from './DashboardFilters'
import { KPIComparison } from './KPIComparison'
import { DrillDownView } from './DrillDownView'
import { KPISummary, PipelineHealthHeatmap } from './ExecutiveWidgets'

interface ComparisonMetric {
  label: string
  current: string | number
  previous: string | number
  unit?: string
  trend: 'up' | 'down' | 'neutral'
  percentChange: number
}

export const ExecutiveDashboardEnhanced: React.FC = () => {
  const [filters, setFilters] = useState<DashboardFiltersType>({
    dateRange: 'month',
    status: 'all',
    compareWith: 'previousPeriod',
  })
  const [isLoading, setIsLoading] = useState(false)
  const [drillDownOpen, setDrillDownOpen] = useState(false)
  const [comparisonMetrics, setComparisonMetrics] = useState<ComparisonMetric[]>([])

  // Load comparison data when filters change
  useEffect(() => {
    loadComparisonData()
  }, [filters])

  const loadComparisonData = () => {
    setIsLoading(true)

    // Simulate API call for comparison data
    setTimeout(() => {
      setComparisonMetrics([
        {
          label: 'Success Rate',
          current: '98%',
          previous: '95%',
          trend: 'up',
          percentChange: 3,
        },
        {
          label: 'SLA Breaches',
          current: '5',
          previous: '12',
          unit: 'incidents',
          trend: 'down',
          percentChange: -58,
        },
        {
          label: 'MTTR',
          current: '1.4h',
          previous: '2.1h',
          unit: 'hours',
          trend: 'down',
          percentChange: -33,
        },
        {
          label: 'Auto-Resolved',
          current: '75%',
          previous: '68%',
          trend: 'up',
          percentChange: 7,
        },
        {
          label: 'Cost vs Budget',
          current: '110%',
          previous: '115%',
          trend: 'down',
          percentChange: -5,
        },
      ])
      setIsLoading(false)
    }, 500)
  }

  const handleFilterChange = (newFilters: DashboardFiltersType) => {
    setFilters(newFilters)
  }

  const handleRefresh = () => {
    loadComparisonData()
  }

  return (
    <Container maxWidth={false} sx={{ py: 1, px: 2 }}>
      {/* Header with QuickSight-style branding */}
      <Box sx={{ mb: 2 }}>
        <Typography variant="h4" sx={{ fontWeight: 700, color: '#1a1a1a', mb: 0.5 }}>
          Executive DataOps Health
        </Typography>
        <Typography variant="body2" sx={{ color: '#666' }}>
          Real-time operational metrics and performance analytics
        </Typography>
      </Box>

      {/* Interactive Filters - QuickSight Style */}
      <DashboardFilters onFilterChange={handleFilterChange} onRefresh={handleRefresh} />

      {/* Period Comparison - QuickSight Style */}
      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      ) : (
        <>
          {filters.compareWith !== 'none' && (
            <KPIComparison
              metrics={comparisonMetrics}
              title={`Period Comparison ${
                filters.compareWith === 'previousPeriod' ? '(vs Previous Period)' : '(vs Year Ago)'
              }`}
            />
          )}

          {/* Main Dashboard Widgets - Using Flexbox */}
          <Box sx={{ 
            display: 'flex', 
            gap: 1.5, 
            width: '100%',
            flexWrap: 'wrap'
          }}>
            {/* Left: KPI Summary */}
            <Box sx={{ flex: '1 1 calc(50% - 12px)', minWidth: '300px', backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e0e0e0', overflow: 'hidden' }}>
              <KPISummary />
            </Box>

            {/* Right: Pipeline Health Heatmap */}
            <Box sx={{ flex: '1 1 calc(50% - 12px)', minWidth: '300px', backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e0e0e0' }}>
              <Typography variant="h6" sx={{ p: 2, pb: 1, fontWeight: 600 }}>
                Pipeline Health Heatmap
              </Typography>
              <Box sx={{ height: '280px' }}>
                <PipelineHealthHeatmap />
              </Box>
            </Box>
          </Box>

          {/* Drill-Down View Modal */}
          {drillDownOpen && (
            <DrillDownView
              title="At-Risk Pipelines"
              items={[
                {
                  id: '1',
                  name: 'Customer 360',
                  value: 'CRITICAL',
                  status: 'critical',
                  trend: -15,
                  details: {
                    'Success Rate': '75%',
                    'Last Run': '2 hours ago',
                    'Error Count': '245',
                    'Avg Duration': '8.5 min',
                  },
                },
                {
                  id: '2',
                  name: 'Finance ETL',
                  value: 'HIGH',
                  status: 'warning',
                  trend: -8,
                  details: {
                    'Success Rate': '92%',
                    'Last Run': '30 min ago',
                    'Error Count': '12',
                    'Avg Duration': '4.2 min',
                  },
                },
                {
                  id: '3',
                  name: 'Inventory Sync',
                  value: 'MEDIUM',
                  status: 'warning',
                  trend: 5,
                  details: {
                    'Success Rate': '94%',
                    'Last Run': '15 min ago',
                    'Error Count': '8',
                    'Avg Duration': '2.1 min',
                  },
                },
              ]}
              columns={[
                { field: 'name', label: 'Pipeline Name' },
                { field: 'value', label: 'Severity' },
                { field: 'status', label: 'Status' },
                { field: 'trend', label: 'Trend', format: (v) => `${v > 0 ? '+' : ''}${v}%` },
              ]}
              onClose={() => setDrillDownOpen(false)}
            />
          )}
        </>
      )}
    </Container>
  )
}

export default ExecutiveDashboardEnhanced
