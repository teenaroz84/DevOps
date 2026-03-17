import { useState } from 'react'
import {
  Box,
  Card,
  CardContent,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Chip,
  Button,
  LinearProgress,
  Paper,
  IconButton,
} from '@mui/material'
import RefreshIcon from '@mui/icons-material/Refresh'
import WorkflowIcon from '@mui/icons-material/AutoAwesome'
import StorageIcon from '@mui/icons-material/Storage'
import GroupIcon from '@mui/icons-material/Group'
import AnalyticsIcon from '@mui/icons-material/Analytics'
import DragIndicatorIcon from '@mui/icons-material/DragIndicator'
import { WidgetPreferences } from './UserPreferences'

interface Workflow {
  id: string
  name: string
  status: 'active' | 'failed' | 'idle'
  lastRun?: string
}

interface DashboardProps {
  onChatClick: () => void
  preferences?: WidgetPreferences
  widgetOrder?: string[]
  onWidgetOrderChange?: (order: string[]) => void
}

export function Dashboard({ onChatClick, preferences, widgetOrder = [], onWidgetOrderChange }: DashboardProps) {
  const [workflows] = useState<Workflow[]>([
    { id: 'wf-001', name: 'orders_etl', status: 'active', lastRun: 'Succeeded' },
    { id: 'wf-002', name: 'customers_delta_sync', status: 'active', lastRun: 'Succeeded' },
    { id: 'wf-003', name: 'inventory_refresh', status: 'idle', lastRun: 'Idle' },
    { id: 'wf-004', name: 'analytics_aggregation', status: 'active', lastRun: 'Succeeded' },
  ])

  const [draggedWidget, setDraggedWidget] = useState<string | null>(null)
  const [dragOverWidget, setDragOverWidget] = useState<string | null>(null)

  const activeWorkflows = workflows.filter(w => w.status === 'active').length

  // Use default preferences if not provided
  const prefs: WidgetPreferences = preferences || {
    activeWorkflows: true,
    aiAgents: true,
    dataSources: true,
    activeUsers: true,
    pipelineMetrics: true,
    platformAvailability: true,
    activeWorkflowsTable: true,
    systemComponents: true,
  }

  // Handle widget reordering
  const handleDragStart = (widgetId: string) => {
    setDraggedWidget(widgetId)
  }

  const handleDragOver = (widgetId: string) => {
    if (draggedWidget && draggedWidget !== widgetId) {
      setDragOverWidget(widgetId)
    }
  }

  const handleDrop = (targetWidgetId: string) => {
    if (draggedWidget && draggedWidget !== targetWidgetId && onWidgetOrderChange) {
      const currentOrder = widgetOrder.length > 0 ? [...widgetOrder] : getAllWidgetIds()
      const draggedIndex = currentOrder.indexOf(draggedWidget)
      const targetIndex = currentOrder.indexOf(targetWidgetId)

      // Remove dragged widget
      currentOrder.splice(draggedIndex, 1)
      // Insert at target position
      currentOrder.splice(targetIndex, 0, draggedWidget)

      onWidgetOrderChange(currentOrder)
    }
    resetDragState()
  }

  const resetDragState = () => {
    setDraggedWidget(null)
    setDragOverWidget(null)
  }

  // Get all widget IDs
  const getAllWidgetIds = () => [
    'activeWorkflows',
    'aiAgents',
    'dataSources',
    'activeUsers',
    'pipelineMetrics',
    'platformAvailability',
    'activeWorkflowsTable',
    'systemComponents',
  ]

  // Sort widgets based on widgetOrder
  const getSortedMetricWidgets = () => {
    const metricWidgets = ['activeWorkflows', 'aiAgents', 'dataSources', 'activeUsers']
    const order = widgetOrder.length > 0 ? widgetOrder : getAllWidgetIds()
    return metricWidgets.sort((a, b) => order.indexOf(a) - order.indexOf(b))
  }

  const getSortedTableWidgets = () => {
    const tableWidgets = ['activeWorkflowsTable', 'systemComponents']
    const order = widgetOrder.length > 0 ? widgetOrder : getAllWidgetIds()
    return tableWidgets.sort((a, b) => order.indexOf(a) - order.indexOf(b))
  }

  // Draggable Widget Container
  const DraggableWidget = ({ widgetId, children }: { widgetId: string; children: React.ReactNode }) => (
    <Box
      draggable
      onDragStart={() => handleDragStart(widgetId)}
      onDragOver={(e) => {
        e.preventDefault()
        handleDragOver(widgetId)
      }}
      onDragLeave={() => setDragOverWidget(null)}
      onDrop={() => handleDrop(widgetId)}
      onDragEnd={() => resetDragState()}
      sx={{
        cursor: 'move',
        opacity: draggedWidget === widgetId ? 0.5 : 1,
        transform: dragOverWidget === widgetId && draggedWidget ? 'scale(1.02)' : 'scale(1)',
        backgroundColor: dragOverWidget === widgetId && draggedWidget ? '#e3f2fd' : 'transparent',
        transition: 'all 0.2s ease',
        position: 'relative',
        borderRadius: 1,
        '&:hover .drag-handle': {
          opacity: 1,
        },
      }}
    >
      <Box
        className="drag-handle"
        sx={{
          position: 'absolute',
          top: 8,
          left: 8,
          opacity: 0,
          transition: 'opacity 0.2s ease',
          color: '#1976d2',
          zIndex: 10,
        }}
      >
        <DragIndicatorIcon sx={{ fontSize: '18px' }} />
      </Box>
      {children}
    </Box>
  )

  // Metric Card Component
  const MetricCard = ({ icon, value, label, change }: any) => (
    <Card
      sx={{
        backgroundColor: '#fff',
        border: '1px solid #e0e0e0',
        boxShadow: 'none',
        cursor: 'move',
        '&:hover': {
          boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
          borderColor: '#1976d2',
        },
      }}
    >
      <CardContent sx={{ p: 2.5, display: 'flex', alignItems: 'center', gap: 2 }}>
        <Box
          sx={{
            fontSize: '28px',
            minWidth: '50px',
            textAlign: 'center',
          }}
        >
          {icon}
        </Box>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h5" sx={{ fontWeight: 700, color: '#1976d2', mb: 0.5 }}>
            {value}
          </Typography>
          <Typography variant="caption" sx={{ color: '#666', fontSize: '12px' }}>
            {label}
          </Typography>
          {change && (
            <Typography
              variant="caption"
              sx={{
                display: 'block',
                color: change.includes('+') ? '#2e7d32' : '#d32f2f',
                fontSize: '11px',
                mt: 0.5,
              }}
            >
              {change}
            </Typography>
          )}
        </Box>
      </CardContent>
    </Card>
  )

  return (
    <Box sx={{ p: 3, backgroundColor: '#fafafa', minHeight: '100vh', flexGrow: 1, overflow: 'auto' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700, color: '#1a1a1a', mb: 0.5 }}>
            DataOps Intelligence Dashboard
          </Typography>
          <Typography variant="body2" sx={{ color: '#666' }}>
            Monitor your data workflows and pipeline performance
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <IconButton size="small" sx={{ color: '#1976d2' }}>
            <RefreshIcon />
          </IconButton>
          <Button
            variant="contained"
            size="small"
            onClick={onChatClick}
            sx={{
              backgroundColor: '#1976d2',
              textTransform: 'none',
              fontSize: '13px',
              fontWeight: 500,
            }}
          >
            💬 DataOps Assistant
          </Button>
        </Box>
      </Box>

      {/* Customization Tip */}
      <Paper sx={{ p: 1.5, mb: 2.5, backgroundColor: '#e3f2fd', border: '1px solid #90caf9' }}>
        <Typography variant="caption" sx={{ color: '#1565c0', fontSize: '12px' }}>
          💡 Drag widgets to reorder them. Configure visibility in User Preference settings.
        </Typography>
      </Paper>

      {/* Overview Metrics */}
      {(prefs.activeWorkflows || prefs.aiAgents || prefs.dataSources || prefs.activeUsers) && (
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '1fr 1fr 1fr 1fr' }, gap: 2, mb: 3 }}>
          {getSortedMetricWidgets().map((widgetId) => {
            if (widgetId === 'activeWorkflows' && prefs.activeWorkflows) {
              return (
                <DraggableWidget key={widgetId} widgetId={widgetId}>
                  <MetricCard icon="🔄" value={activeWorkflows} label="Active Workflows" change="+8.5%" />
                </DraggableWidget>
              )
            }
            if (widgetId === 'aiAgents' && prefs.aiAgents) {
              return (
                <DraggableWidget key={widgetId} widgetId={widgetId}>
                  <MetricCard icon="🤖" value="8" label="AI Agents" change="+12.3%" />
                </DraggableWidget>
              )
            }
            if (widgetId === 'dataSources' && prefs.dataSources) {
              return (
                <DraggableWidget key={widgetId} widgetId={widgetId}>
                  <MetricCard icon="📊" value="24" label="Data Sources" change="-2.1%" />
                </DraggableWidget>
              )
            }
            if (widgetId === 'activeUsers' && prefs.activeUsers) {
              return (
                <DraggableWidget key={widgetId} widgetId={widgetId}>
                  <MetricCard icon="👥" value="156" label="Active Users" change="+15.2%" />
                </DraggableWidget>
              )
            }
            return null
          })}
        </Box>
      )}

      {/* Data Pipeline Performance */}
      {prefs.pipelineMetrics && (
        <DraggableWidget widgetId="pipelineMetrics">
          <Paper sx={{ mb: 3, backgroundColor: '#fff', border: '1px solid #e0e0e0', cursor: 'move' }}>
            <Box sx={{ p: 2.5, borderBottom: '1px solid #e0e0e0', display: 'flex', alignItems: 'center', gap: 1 }}>
              <AnalyticsIcon sx={{ color: '#1976d2', fontSize: '20px' }} />
              <Typography variant="h6" sx={{ fontWeight: 600, color: '#1a1a1a' }}>
                Data Pipeline Performance
              </Typography>
            </Box>
            <Box sx={{ p: 2.5 }}>
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '1fr 1fr 1fr 1fr' }, gap: 3 }}>
                <Box>
                  <Typography variant="caption" sx={{ color: '#666', fontSize: '12px', display: 'block', mb: 0.5 }}>
                    Pipeline Success Rate
                  </Typography>
                  <Typography variant="h5" sx={{ fontWeight: 700, color: '#2e7d32', mb: 0.5 }}>
                    98.7%
                  </Typography>
                  <Chip label="+2.3% vs last week" size="small" variant="outlined" sx={{ fontSize: '11px' }} />
                </Box>
                <Box>
                  <Typography variant="caption" sx={{ color: '#666', fontSize: '12px', display: 'block', mb: 0.5 }}>
                    Data Processed Today
                  </Typography>
                  <Typography variant="h5" sx={{ fontWeight: 700, color: '#2e7d32', mb: 0.5 }}>
                    2.4 TB
                  </Typography>
                  <Chip label="+15.8% vs last week" size="small" variant="outlined" sx={{ fontSize: '11px' }} />
                </Box>
                <Box>
                  <Typography variant="caption" sx={{ color: '#666', fontSize: '12px', display: 'block', mb: 0.5 }}>
                    Pipeline Executions
                  </Typography>
                  <Typography variant="h5" sx={{ fontWeight: 700, color: '#2e7d32', mb: 0.5 }}>
                    1847
                  </Typography>
                  <Chip label="+12.4% vs last week" size="small" variant="outlined" sx={{ fontSize: '11px' }} />
                </Box>
                <Box>
                  <Typography variant="caption" sx={{ color: '#666', fontSize: '12px', display: 'block', mb: 0.5 }}>
                    Avg Processing Time
                  </Typography>
                  <Typography variant="h5" sx={{ fontWeight: 700, color: '#2e7d32', mb: 0.5 }}>
                    4.2 min
                  </Typography>
                  <Chip label="-2.5% vs last week" size="small" variant="outlined" sx={{ fontSize: '11px' }} />
                </Box>
              </Box>
            </Box>
          </Paper>
        </DraggableWidget>
      )}

      {/* Platform Availability & Performance */}
      {prefs.platformAvailability && (
        <DraggableWidget widgetId="platformAvailability">
          <Paper sx={{ mb: 3, backgroundColor: '#fff', border: '1px solid #e0e0e0', cursor: 'move' }}>
            <Box sx={{ p: 2.5, borderBottom: '1px solid #e0e0e0', display: 'flex', alignItems: 'center', gap: 1 }}>
              <StorageIcon sx={{ color: '#1976d2', fontSize: '20px' }} />
              <Typography variant="h6" sx={{ fontWeight: 600, color: '#1a1a1a' }}>
                Platform Availability & Performance
              </Typography>
            </Box>
            <Box sx={{ p: 2.5 }}>
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '1fr 1fr 1fr 1fr' }, gap: 3 }}>
                <Box>
                  <Typography variant="caption" sx={{ color: '#666', fontSize: '12px', display: 'block', mb: 0.5 }}>
                    Platform Uptime
                  </Typography>
                  <Typography variant="h5" sx={{ fontWeight: 700, color: '#2e7d32', mb: 0.5 }}>
                    99.9%
                  </Typography>
                  <Chip label="SUCCESS" size="small" sx={{ backgroundColor: '#e8f5e9', color: '#2e7d32', fontSize: '10px' }} />
                </Box>
                <Box>
                  <Typography variant="caption" sx={{ color: '#666', fontSize: '12px', display: 'block', mb: 0.5 }}>
                    API Response Time
                  </Typography>
                  <Typography variant="h5" sx={{ fontWeight: 700, color: '#2e7d32', mb: 0.5 }}>
                    142 ms
                  </Typography>
                  <Chip label="SUCCESS" size="small" sx={{ backgroundColor: '#e8f5e9', color: '#2e7d32', fontSize: '10px' }} />
                </Box>
                <Box>
                  <Typography variant="caption" sx={{ color: '#666', fontSize: '12px', display: 'block', mb: 0.5 }}>
                    Error Rate
                  </Typography>
                  <Typography variant="h5" sx={{ fontWeight: 700, color: '#2e7d32', mb: 0.5 }}>
                    0.03%
                  </Typography>
                  <Chip label="SUCCESS" size="small" sx={{ backgroundColor: '#e8f5e9', color: '#2e7d32', fontSize: '10px' }} />
                </Box>
                <Box>
                  <Typography variant="caption" sx={{ color: '#666', fontSize: '12px', display: 'block', mb: 0.5 }}>
                    Active Connections
                  </Typography>
                  <Typography variant="h5" sx={{ fontWeight: 700, color: '#2e7d32', mb: 0.5 }}>
                    1234
                  </Typography>
                  <Chip label="SUCCESS" size="small" sx={{ backgroundColor: '#e8f5e9', color: '#2e7d32', fontSize: '10px' }} />
                </Box>
              </Box>
            </Box>
          </Paper>
        </DraggableWidget>
      )}

      {/* Workflows Table */}
      {(prefs.activeWorkflowsTable || prefs.systemComponents) && (
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 3 }}>
          {getSortedTableWidgets().map((widgetId) => {
            if (widgetId === 'activeWorkflowsTable' && prefs.activeWorkflowsTable) {
              return (
                <DraggableWidget key={widgetId} widgetId={widgetId}>
                  <Paper sx={{ backgroundColor: '#fff', border: '1px solid #e0e0e0', cursor: 'move' }}>
                    <Box sx={{ p: 2.5, borderBottom: '1px solid #e0e0e0', display: 'flex', alignItems: 'center', gap: 1 }}>
                      <WorkflowIcon sx={{ color: '#1976d2', fontSize: '20px' }} />
                      <Typography variant="h6" sx={{ fontWeight: 600, color: '#1a1a1a' }}>
                        Active Workflows
                      </Typography>
                    </Box>
                    <Table size="small" sx={{ '& .MuiTableCell-root': { fontSize: '13px', py: 1.2 } }}>
                      <TableHead>
                        <TableRow sx={{ backgroundColor: '#f5f5f5' }}>
                          <TableCell sx={{ fontWeight: 600 }}>Workflow</TableCell>
                          <TableCell align="center" sx={{ fontWeight: 600 }}>Status</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 600 }}>Last Run</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {workflows.map((workflow) => (
                          <TableRow key={workflow.id} sx={{ '&:hover': { backgroundColor: '#f9f9f9' } }}>
                            <TableCell>{workflow.name}</TableCell>
                            <TableCell align="center">
                              <Chip
                                label={workflow.status.toUpperCase()}
                                size="small"
                                sx={{
                                  backgroundColor: workflow.status === 'active' ? '#e8f5e9' : '#fff3e0',
                                  color: workflow.status === 'active' ? '#2e7d32' : '#f57c00',
                                  fontSize: '11px',
                                  fontWeight: 500,
                                }}
                              />
                            </TableCell>
                            <TableCell align="right">{workflow.lastRun}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </Paper>
                </DraggableWidget>
              )
            }

            if (widgetId === 'systemComponents' && prefs.systemComponents) {
              return (
                <DraggableWidget key={widgetId} widgetId={widgetId}>
                  <Paper sx={{ backgroundColor: '#fff', border: '1px solid #e0e0e0', cursor: 'move' }}>
                    <Box sx={{ p: 2.5, borderBottom: '1px solid #e0e0e0', display: 'flex', alignItems: 'center', gap: 1 }}>
                      <GroupIcon sx={{ color: '#1976d2', fontSize: '20px' }} />
                      <Typography variant="h6" sx={{ fontWeight: 600, color: '#1a1a1a' }}>
                        System Components
                      </Typography>
                    </Box>
                    <Table size="small" sx={{ '& .MuiTableCell-root': { fontSize: '13px', py: 1.2 } }}>
                      <TableHead>
                        <TableRow sx={{ backgroundColor: '#f5f5f5' }}>
                          <TableCell sx={{ fontWeight: 600 }}>Component</TableCell>
                          <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                          <TableCell sx={{ fontWeight: 600 }}>CPU</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {[
                          { name: 'API Gateway', status: 'ONLINE', cpu: 45 },
                          { name: 'Database Cluster', status: 'ONLINE', cpu: 62 },
                          { name: 'Cache Layer', status: 'WARNING', cpu: 78 },
                          { name: 'Analytics Engine', status: 'ONLINE', cpu: 28 },
                        ].map((item, idx) => (
                          <TableRow key={idx} sx={{ '&:hover': { backgroundColor: '#f9f9f9' } }}>
                            <TableCell>{item.name}</TableCell>
                            <TableCell>
                              <Chip
                                label={item.status}
                                size="small"
                                sx={{
                                  backgroundColor: item.status === 'ONLINE' ? '#e8f5e9' : '#fff3e0',
                                  color: item.status === 'ONLINE' ? '#2e7d32' : '#f57c00',
                                  fontSize: '11px',
                                  fontWeight: 500,
                                }}
                              />
                            </TableCell>
                            <TableCell>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <LinearProgress variant="determinate" value={item.cpu} sx={{ flex: 1, height: 6 }} />
                                <Typography variant="caption" sx={{ minWidth: '30px', fontSize: '11px' }}>
                                  {item.cpu}%
                                </Typography>
                              </Box>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </Paper>
                </DraggableWidget>
              )
            }

            return null
          })}
        </Box>
      )}
    </Box>
  )
}
