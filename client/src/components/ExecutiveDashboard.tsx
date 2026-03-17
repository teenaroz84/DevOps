import React, { useState, useEffect, useRef } from 'react'
import {
  Box,
  Paper,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControlLabel,
  Checkbox,
  Divider,
} from '@mui/material'
import RefreshIcon from '@mui/icons-material/Refresh'
import SettingsIcon from '@mui/icons-material/Settings'
import {
  KPISummary,
  PipelineHealthHeatmap,
  FailuresVsRecoveryTrend,
  BusinessImpact,
  TopRiskyPipelines,
} from './ExecutiveWidgets'

interface GridItem {
  id: string
  title: string
  col: number
  row: number
  width: number
  height: number
  component: React.ReactNode
  visible: boolean
}

interface ExecutiveDashboardProps {
  onChatClick: () => void
}

const GRID_COLS = 4
const GRID_GAP = 12
const CELL_HEIGHT = 110

interface ExecutivePreferences {
  kpi: boolean
  heatmap: boolean
  trend: boolean
  impact: boolean
  risky: boolean
}

const DEFAULT_PREFERENCES: ExecutivePreferences = {
  kpi: true,
  heatmap: true,
  trend: true,
  impact: true,
  risky: true,
}

export const ExecutiveDashboard: React.FC<ExecutiveDashboardProps> = ({ onChatClick }) => {
  const [gridItems, setGridItems] = useState<GridItem[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [preferencesOpen, setPreferencesOpen] = useState(false)
  const [preferences, setPreferences] = useState<ExecutivePreferences>(DEFAULT_PREFERENCES)
  const gridContainerRef = useRef<HTMLDivElement>(null)

  // Initialize grid items from localStorage or defaults
  useEffect(() => {
    // Clear old layout to prevent loading stale data
    localStorage.removeItem('executiveDashboardLayout')
    
    const savedPreferences = localStorage.getItem('executiveDashboardPreferences')

    // Load preferences
    if (savedPreferences) {
      try {
        const parsed = JSON.parse(savedPreferences)
        setPreferences(parsed)
      } catch (error) {
        console.error('Failed to load saved preferences:', error)
      }
    }

    setGridItems(initializeDefaultLayout())
  }, [])

  // Save layout to localStorage whenever it changes
  useEffect(() => {
    if (gridItems.length > 0) {
      const layoutToSave = gridItems.map(item => ({
        id: item.id,
        title: item.title,
        col: item.col,
        row: item.row,
        width: item.width,
        height: item.height,
      }))
      localStorage.setItem('executiveDashboardLayout', JSON.stringify(layoutToSave))
    }
  }, [gridItems])

  // Save preferences to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('executiveDashboardPreferences', JSON.stringify(preferences))
  }, [preferences])

  const initializeDefaultLayout = () => {
    const allItems: GridItem[] = [
      {
        id: 'kpi',
        title: 'KPI Summary',
        col: 0,
        row: 0,
        width: 4,
        height: 2,
        component: <KPISummary />,
        visible: preferences.kpi,
      },
      {
        id: 'heatmap',
        title: 'Pipeline Health Heatmap',
        col: 0,
        row: 0,
        width: 2,
        height: 2,
        component: <PipelineHealthHeatmap />,
        visible: preferences.heatmap,
      },
      {
        id: 'trend',
        title: 'Failures vs Auto-Recovery Trend',
        col: 0,
        row: 0,
        width: 2,
        height: 2,
        component: <FailuresVsRecoveryTrend />,
        visible: preferences.trend,
      },
      {
        id: 'impact',
        title: 'Business Impact',
        col: 0,
        row: 0,
        width: 2,
        height: 2,
        component: <BusinessImpact />,
        visible: preferences.impact,
      },
      {
        id: 'risky',
        title: 'Top Risky Pipelines',
        col: 0,
        row: 0,
        width: 2,
        height: 2,
        component: <TopRiskyPipelines />,
        visible: preferences.risky,
      },
    ]

    // Reposition items to fill grid sequentially
    const visibleItems = allItems.filter(item => item.visible)
    let currentRow = 0
    let currentCol = 0

    const repositioned = visibleItems.map(item => {
      const itemCol = currentCol
      const itemRow = currentRow

      currentCol += item.width
      if (currentCol >= GRID_COLS) {
        currentCol = 0
        currentRow += item.height
      }

      return {
        ...item,
        col: itemCol,
        row: itemRow,
      }
    })

    return repositioned
  }

  const handleDragStart = (e: React.DragEvent, itemId: string) => {
    setIsDragging(true)
    setDraggedId(itemId)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('itemId', itemId)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    if (!gridContainerRef.current || !draggedId) return

    const rect = gridContainerRef.current.getBoundingClientRect()
    
    // Calculate drop position in pixels
    const dropX = e.clientX - rect.left
    const dropY = e.clientY - rect.top

    // Calculate which grid cell was dropped on
    const cellWidth = (rect.width - GRID_GAP * (GRID_COLS - 1)) / GRID_COLS
    let dropCol = Math.floor(dropX / (cellWidth + GRID_GAP))
    let dropRow = Math.floor(dropY / (CELL_HEIGHT + GRID_GAP))

    // Ensure within bounds
    dropCol = Math.max(0, Math.min(dropCol, GRID_COLS - 1))
    dropRow = Math.max(0, dropRow)

    // Reposition widget to drop location and reorder others
    setGridItems(prevItems => {
      const visibleItems = prevItems.filter(item => item.visible)
      const hiddenItems = prevItems.filter(item => !item.visible)

      // Find the dragged item
      const draggedItem = visibleItems.find(item => item.id === draggedId)
      if (!draggedItem) return prevItems

      // Remove dragged item from its current position
      let otherItems = visibleItems.filter(item => item.id !== draggedId)

      // Find which position in the visible list corresponds to drop location
      let insertIndex = 0
      let currentRow = 0
      let currentCol = 0

      for (let i = 0; i < otherItems.length; i++) {
        if (currentRow > dropRow || (currentRow === dropRow && currentCol > dropCol)) {
          insertIndex = i
          break
        }
        insertIndex = i + 1
        currentCol += otherItems[i].width
        if (currentCol >= GRID_COLS) {
          currentCol = 0
          currentRow += otherItems[i].height
        }
      }

      // Insert dragged item at the drop position
      otherItems.splice(insertIndex, 0, draggedItem)

      // Reposition all visible items sequentially
      let updatedItems = otherItems.map(item => {
        const col = 0
        const row = 0
        return { ...item, col, row }
      })

      let currentRow2 = 0
      let currentCol2 = 0

      updatedItems = updatedItems.map(item => {
        const itemCol = currentCol2
        const itemRow = currentRow2

        currentCol2 += item.width
        if (currentCol2 >= GRID_COLS) {
          currentCol2 = 0
          currentRow2 += item.height
        }

        return {
          ...item,
          col: itemCol,
          row: itemRow,
        }
      })

      // Combine with hidden items
      return [...updatedItems, ...hiddenItems]
    })

    setIsDragging(false)
    setDraggedId(null)
  }

  const handleDragEnd = () => {
    setIsDragging(false)
    setDraggedId(null)
  }

  const handleResetLayout = () => {
    localStorage.removeItem('executiveDashboardLayout')
    localStorage.removeItem('executiveDashboardPreferences')
    setGridItems(initializeDefaultLayout())
    setPreferences(DEFAULT_PREFERENCES)
  }

  const handleToggleWidget = (widgetId: string) => {
    const newPreferences = {
      ...preferences,
      [widgetId]: !preferences[widgetId as keyof ExecutivePreferences],
    }
    setPreferences(newPreferences)
    
    // Update visibility and reposition
    setGridItems(prevItems => {
      const updated = prevItems.map(item =>
        item.id === widgetId
          ? { ...item, visible: !item.visible }
          : item
      )
      
      // Reposition all visible items sequentially
      const visibleItems = updated.filter(item => item.visible)
      let currentRow = 0
      let currentCol = 0

      const repositioned = visibleItems.map(item => {
        const itemCol = currentCol
        const itemRow = currentRow

        currentCol += item.width
        if (currentCol >= GRID_COLS) {
          currentCol = 0
          currentRow += item.height
        }

        return {
          ...item,
          col: itemCol,
          row: itemRow,
        }
      })

      return repositioned
    })
  }

  const handleResetPreferences = () => {
    setPreferences(DEFAULT_PREFERENCES)
    localStorage.removeItem('executiveDashboardLayout')
    setGridItems(initializeDefaultLayout())
  }

  const handleClosePreferences = () => {
    setPreferencesOpen(false)
  }

  return (
    <Box
      sx={{
        flex: 1,
        overflow: 'auto',
        backgroundColor: '#fafafa',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Header - Fixed blue background */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#455a64', p: 2, color: '#fff' }}>
        <Box>
          <h2 style={{ margin: '0 0 4px 0', color: '#fff', fontSize: '22px', fontWeight: 600 }}>
            Executive DataOps Health
          </h2>
          <p style={{ margin: 0, color: '#b0bec5', fontSize: '13px' }}>
            Drag and drop widgets to customize your view
          </p>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            startIcon={<SettingsIcon />}
            onClick={() => setPreferencesOpen(true)}
            variant="outlined"
            size="small"
            sx={{ color: '#fff', borderColor: '#fff', '&:hover': { borderColor: '#fff', backgroundColor: 'rgba(255,255,255,0.1)' } }}
          >
            Preferences
          </Button>
          <Button
            startIcon={<RefreshIcon />}
            onClick={handleResetLayout}
            variant="outlined"
            size="small"
            sx={{ color: '#fff', borderColor: '#fff', '&:hover': { borderColor: '#fff', backgroundColor: 'rgba(255,255,255,0.1)' } }}
          >
            Reset Layout
          </Button>
          <Button onClick={onChatClick} variant="contained" size="small" sx={{ ml: 1, backgroundColor: '#1976d2', '&:hover': { backgroundColor: '#1565c0' } }}>
            Ask DataOps Agent
          </Button>
        </Box>
      </Box>

      {/* Content area with scrolling */}
      <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>

      {/* Grid Container */}
      <Box
        ref={gridContainerRef}
        sx={{
          display: 'grid',
          gridTemplateColumns: `repeat(${GRID_COLS}, 1fr)`,
          gap: `${GRID_GAP}px`,
          gridAutoRows: 'auto',
          gridAutoFlow: 'dense',
          position: 'relative',
        }}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        {gridItems.filter(item => item.visible).map(item => (
          <Paper
            key={item.id}
            draggable
            onDragStart={e => handleDragStart(e, item.id)}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
            sx={{
              gridColumn: `${item.col + 1} / span ${item.width}`,
              gridRow: `${item.row + 1} / span ${item.height}`,
              p: 0,
              backgroundColor: '#fff',
              cursor: isDragging && draggedId === item.id ? 'grabbing' : 'grab',
              opacity: isDragging && draggedId === item.id ? 0.6 : 1,
              transition: 'all 0.2s ease',
              boxShadow: isDragging && draggedId === item.id ? '0 8px 24px rgba(25, 118, 210, 0.3)' : '0 1px 3px rgba(0,0,0,0.08)',
              border: isDragging && draggedId === item.id ? '2px solid #1976d2' : 'none',
              transform: isDragging && draggedId === item.id ? 'scale(0.98)' : 'scale(1)',
              '&:hover': {
                boxShadow: !isDragging ? '0 4px 12px rgba(0,0,0,0.12)' : undefined,
              },
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              minHeight: 0,
              borderRadius: '4px',
              height: 'auto',
            }}
          >
            {item.id !== 'kpi' && (
              <Box
                sx={{
                  fontWeight: 600,
                  fontSize: '14px',
                  color: '#1976d2',
                  mb: 1.5,
                  pb: 1,
                  borderBottom: '1px solid #e0e0e0',
                  cursor: 'grab',
                  px: 2,
                  pt: 2,
                  '&:active': {
                    cursor: 'grabbing',
                  },
                }}
              >
                {item.title}
              </Box>
            )}
            <Box
              sx={{
                flex: 1,
                overflow: 'auto',
                minHeight: 0,
                px: item.id === 'kpi' ? 0 : 2,
                pb: item.id === 'kpi' ? 0 : 2,
                pt: item.id === 'kpi' ? 0 : 0,
              }}
            >
              {item.component}
            </Box>
          </Paper>
        ))}
      </Box>
      </Box>

      {/* Preferences Dialog */}
      <Dialog open={preferencesOpen} onClose={handleClosePreferences} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 600, color: '#1976d2' }}>
          Dashboard Preferences
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={preferences.kpi}
                  onChange={() => handleToggleWidget('kpi')}
                />
              }
              label="Executive DataOps Health (KPI Summary)"
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={preferences.heatmap}
                  onChange={() => handleToggleWidget('heatmap')}
                />
              }
              label="Pipeline Health Heatmap"
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={preferences.trend}
                  onChange={() => handleToggleWidget('trend')}
                />
              }
              label="Failures vs Auto-Recovery Trend"
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={preferences.impact}
                  onChange={() => handleToggleWidget('impact')}
                />
              }
              label="Business Impact"
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={preferences.risky}
                  onChange={() => handleToggleWidget('risky')}
                />
              }
              label="Top Risky Pipelines"
            />
          </Box>

          <Divider sx={{ my: 2 }} />

          <Box sx={{ fontSize: '12px', color: '#666', mb: 2 }}>
            <p style={{ margin: '0 0 8px 0', fontWeight: 600 }}>Tips:</p>
            <ul style={{ margin: '0', paddingLeft: '20px' }}>
              <li>Toggle widgets on/off to customize your dashboard view</li>
              <li>Use drag-drop to rearrange widget positions</li>
              <li>Your preferences are saved automatically</li>
              <li>Click "Reset Layout" to restore default arrangement</li>
            </ul>
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={handleResetPreferences} variant="outlined" size="small" color="inherit">
            Reset to Defaults
          </Button>
          <Button onClick={handleClosePreferences} variant="contained" size="small">
            Done
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
