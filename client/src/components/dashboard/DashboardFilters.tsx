import React, { useState } from 'react'
import {
  Box,
  Paper,
  Button,
  Select,
  MenuItem,
  TextField,
  Chip,
  Divider,
  FormControl,
  InputLabel,
  Grid,
} from '@mui/material'
import FilterListIcon from '@mui/icons-material/FilterList'
import RefreshIcon from '@mui/icons-material/Refresh'
import DownloadIcon from '@mui/icons-material/Download'
import CalendarTodayIcon from '@mui/icons-material/CalendarToday'

interface DashboardFiltersProps {
  onFilterChange: (filters: DashboardFilters) => void
  onRefresh: () => void
}

export interface DashboardFilters {
  dateRange: 'today' | 'week' | 'month' | 'quarter' | 'year'
  pipeline?: string
  status?: 'all' | 'healthy' | 'atrisk' | 'critical'
  compareWith?: 'previousPeriod' | 'yearOverYear' | 'none'
}

export const DashboardFilters: React.FC<DashboardFiltersProps> = ({ onFilterChange, onRefresh }) => {
  const [filters, setFilters] = useState<DashboardFilters>({
    dateRange: 'month',
    status: 'all',
    compareWith: 'previousPeriod',
  })

  const handleFilterChange = (field: keyof DashboardFilters, value: any) => {
    const updated = { ...filters, [field]: value }
    setFilters(updated)
    onFilterChange(updated)
  }

  const handleExport = () => {
    alert('📊 Exporting dashboard report as PDF...')
    // Would implement actual export functionality
  }

  return (
    <Paper
      sx={{
        p: 1.5,
        mb: 1.5,
        backgroundColor: '#fff',
        borderBottom: '2px solid #e0e0e0',
      }}
    >
      <Grid container spacing={2} alignItems="center">
        {/* Date Range Selector */}
        <Grid item xs={12} sm={6} md={2}>
          <FormControl fullWidth size="small">
            <InputLabel>Date Range</InputLabel>
            <Select
              value={filters.dateRange}
              label="Date Range"
              onChange={(e) => handleFilterChange('dateRange', e.target.value)}
              startAdornment={<CalendarTodayIcon sx={{ mr: 1, fontSize: '18px' }} />}
              sx={{ backgroundColor: '#f5f5f5' }}
            >
              <MenuItem value="today">Today</MenuItem>
              <MenuItem value="week">Last 7 Days</MenuItem>
              <MenuItem value="month">Last 30 Days</MenuItem>
              <MenuItem value="quarter">Last Quarter</MenuItem>
              <MenuItem value="year">Year to Date</MenuItem>
            </Select>
          </FormControl>
        </Grid>

        {/* Pipeline Filter */}
        <Grid item xs={12} sm={6} md={2}>
          <FormControl fullWidth size="small">
            <InputLabel>Pipeline</InputLabel>
            <Select
              value={filters.pipeline || ''}
              label="Pipeline"
              onChange={(e) => handleFilterChange('pipeline', e.target.value || undefined)}
              sx={{ backgroundColor: '#f5f5f5' }}
            >
              <MenuItem value="">All Pipelines</MenuItem>
              <MenuItem value="finance">Finance ETL</MenuItem>
              <MenuItem value="inventory">Inventory Sync</MenuItem>
              <MenuItem value="customer">Customer 360</MenuItem>
              <MenuItem value="sales">Sales Feed</MenuItem>
            </Select>
          </FormControl>
        </Grid>

        {/* Status Filter */}
        <Grid item xs={12} sm={6} md={2}>
          <FormControl fullWidth size="small">
            <InputLabel>Status</InputLabel>
            <Select
              value={filters.status}
              label="Status"
              onChange={(e) => handleFilterChange('status', e.target.value)}
              sx={{ backgroundColor: '#f5f5f5' }}
            >
              <MenuItem value="all">All Status</MenuItem>
              <MenuItem value="healthy">✓ Healthy</MenuItem>
              <MenuItem value="atrisk">⚠ At Risk</MenuItem>
              <MenuItem value="critical">🔴 Critical</MenuItem>
            </Select>
          </FormControl>
        </Grid>

        {/* Compare With */}
        <Grid item xs={12} sm={6} md={2}>
          <FormControl fullWidth size="small">
            <InputLabel>Compare</InputLabel>
            <Select
              value={filters.compareWith}
              label="Compare"
              onChange={(e) => handleFilterChange('compareWith', e.target.value)}
              sx={{ backgroundColor: '#f5f5f5' }}
            >
              <MenuItem value="none">No Comparison</MenuItem>
              <MenuItem value="previousPeriod">vs Previous Period</MenuItem>
              <MenuItem value="yearOverYear">vs Year Ago</MenuItem>
            </Select>
          </FormControl>
        </Grid>

        {/* Action Buttons */}
        <Grid item xs={12} sm={6} md={4} sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
          <Button
            variant="outlined"
            size="small"
            startIcon={<RefreshIcon />}
            onClick={onRefresh}
            sx={{
              borderColor: '#1976d2',
              color: '#1976d2',
              '&:hover': { backgroundColor: '#e3f2fd' },
            }}
          >
            Refresh
          </Button>
          <Button
            variant="outlined"
            size="small"
            startIcon={<DownloadIcon />}
            onClick={handleExport}
            sx={{
              borderColor: '#1976d2',
              color: '#1976d2',
              '&:hover': { backgroundColor: '#e3f2fd' },
            }}
          >
            Export
          </Button>
        </Grid>
      </Grid>

      {/* Active Filters Display */}
      {(filters.pipeline || filters.status !== 'all' || filters.compareWith !== 'none') && (
        <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid #e0e0e0' }}>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
            <FilterListIcon sx={{ fontSize: '18px', color: '#666' }} />
            {filters.pipeline && (
              <Chip
                label={`Pipeline: ${filters.pipeline}`}
                onDelete={() => handleFilterChange('pipeline', undefined)}
                size="small"
                sx={{ backgroundColor: '#e3f2fd', color: '#1976d2' }}
              />
            )}
            {filters.status !== 'all' && (
              <Chip
                label={`Status: ${filters.status}`}
                onDelete={() => handleFilterChange('status', 'all')}
                size="small"
                sx={{ backgroundColor: '#e3f2fd', color: '#1976d2' }}
              />
            )}
            {filters.compareWith !== 'none' && (
              <Chip
                label={`Compare: ${filters.compareWith}`}
                onDelete={() => handleFilterChange('compareWith', 'none')}
                size="small"
                sx={{ backgroundColor: '#e3f2fd', color: '#1976d2' }}
              />
            )}
          </Box>
        </Box>
      )}
    </Paper>
  )
}
