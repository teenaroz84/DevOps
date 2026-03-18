import React, { useState } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Box,
  Typography,
  Chip,
  LinearProgress,
} from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'

interface DrillDownItem {
  id: string
  name: string
  value: string | number
  status?: 'healthy' | 'warning' | 'critical'
  trend?: number
  details?: Record<string, string | number>
}

interface DrillDownViewProps {
  title: string
  items: DrillDownItem[]
  onClose: () => void
  columns: { field: keyof DrillDownItem; label: string; format?: (v: any) => string }[]
}

const getStatusColor = (
  status?: 'healthy' | 'warning' | 'critical'
): 'success' | 'warning' | 'error' => {
  switch (status) {
    case 'healthy':
      return 'success'
    case 'warning':
      return 'warning'
    case 'critical':
      return 'error'
    default:
      return 'success'
  }
}

const getStatusLabel = (status?: 'healthy' | 'warning' | 'critical'): string => {
  switch (status) {
    case 'healthy':
      return '✓ Healthy'
    case 'warning':
      return '⚠ Warning'
    case 'critical':
      return '🔴 Critical'
    default:
      return 'Unknown'
  }
}

export const DrillDownView: React.FC<DrillDownViewProps> = ({ title, items, onClose, columns }) => {
  const [selectedItem, setSelectedItem] = useState<DrillDownItem | null>(null)

  if (selectedItem) {
    return (
      <Dialog open={true} onClose={onClose} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Button
            size="small"
            variant="text"
            startIcon={<ArrowBackIcon />}
            onClick={() => setSelectedItem(null)}
            sx={{ color: '#1976d2' }}
          >
            Back
          </Button>
          <Typography variant="h6" sx={{ flex: 1 }}>
            {selectedItem.name} Details
          </Typography>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            {/* Metric */}
            <Box sx={{ mb: 2, pb: 2, borderBottom: '1px solid #e0e0e0' }}>
              <Typography variant="caption" sx={{ color: '#666' }}>
                Value
              </Typography>
              <Typography variant="h5" sx={{ fontWeight: 700, color: '#1976d2' }}>
                {selectedItem.value}
              </Typography>
            </Box>

            {/* Status */}
            {selectedItem.status && (
              <Box sx={{ mb: 2, pb: 2, borderBottom: '1px solid #e0e0e0' }}>
                <Typography variant="caption" sx={{ color: '#666' }}>
                  Status
                </Typography>
                <Box sx={{ mt: 0.5 }}>
                  <Chip
                    label={getStatusLabel(selectedItem.status)}
                    color={getStatusColor(selectedItem.status)}
                    size="small"
                    variant="outlined"
                  />
                </Box>
              </Box>
            )}

            {/* Trend */}
            {selectedItem.trend !== undefined && (
              <Box sx={{ mb: 2, pb: 2, borderBottom: '1px solid #e0e0e0' }}>
                <Typography variant="caption" sx={{ color: '#666' }}>
                  Trend
                </Typography>
                <Box sx={{ mt: 0.5, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <LinearProgress
                    variant="determinate"
                    value={Math.min(Math.abs(selectedItem.trend), 100)}
                    sx={{ flex: 1, height: '8px', borderRadius: '4px' }}
                  />
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {selectedItem.trend > 0 ? '+' : ''}{selectedItem.trend}%
                  </Typography>
                </Box>
              </Box>
            )}

            {/* Additional Details */}
            {selectedItem.details && Object.keys(selectedItem.details).length > 0 && (
              <Box>
                <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
                  Additional Details
                </Typography>
                {Object.entries(selectedItem.details).map(([key, value]) => (
                  <Box
                    key={key}
                    sx={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      py: 0.75,
                      borderBottom: '1px solid #f0f0f0',
                    }}
                  >
                    <Typography variant="body2" sx={{ color: '#666' }}>
                      {key}
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600, color: '#333' }}>
                      {String(value)}
                    </Typography>
                  </Box>
                ))}
              </Box>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Close</Button>
        </DialogActions>
      </Dialog>
    )
  }

  return (
    <Dialog open={true} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>{title} - Drill Down View</DialogTitle>
      <DialogContent>
        <TableContainer component={Paper} sx={{ mt: 2 }}>
          <Table>
            <TableHead sx={{ backgroundColor: '#f5f5f5' }}>
              <TableRow>
                {columns.map((col) => (
                  <TableCell key={String(col.field)} sx={{ fontWeight: 600 }}>
                    {col.label}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {items.map((item) => (
                <TableRow
                  key={item.id}
                  onClick={() => setSelectedItem(item)}
                  sx={{
                    cursor: 'pointer',
                    '&:hover': { backgroundColor: '#f9f9f9' },
                  }}
                >
                  {columns.map((col) => {
                    const value = item[col.field]
                    const formatted = col.format ? col.format(value) : String(value)

                    return (
                      <TableCell key={String(col.field)}>
                        {col.field === 'status' && item[col.field] ? (
                          <Chip
                            label={getStatusLabel(item.status)}
                            color={getStatusColor(item.status)}
                            size="small"
                            variant="outlined"
                          />
                        ) : (
                          formatted
                        )}
                      </TableCell>
                    )
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        <Typography variant="caption" sx={{ display: 'block', mt: 2, color: '#999' }}>
          Click on any row to see detailed information
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  )
}
