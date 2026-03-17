import React from 'react'
import {
  Box,
  Paper,
  Typography,
  Switch,
  FormControlLabel,
  Button,
} from '@mui/material'
import RefreshIcon from '@mui/icons-material/Refresh'
import SaveIcon from '@mui/icons-material/Save'

export interface WidgetPreferences {
  activeWorkflows: boolean
  aiAgents: boolean
  dataSources: boolean
  activeUsers: boolean
  pipelineMetrics: boolean
  platformAvailability: boolean
  activeWorkflowsTable: boolean
  systemComponents: boolean
}

interface UserPreferencesProps {
  preferences: WidgetPreferences
  onPreferencesChange: (prefs: WidgetPreferences) => void
}

export const UserPreferences: React.FC<UserPreferencesProps> = ({
  preferences,
  onPreferencesChange,
}) => {
  const widgetCategories = [
    {
      title: 'Key Metrics',
      widgets: [
        { key: 'activeWorkflows' as const, label: 'Active Workflows Card', icon: '📊' },
        { key: 'aiAgents' as const, label: 'AI Agents Card', icon: '🤖' },
        { key: 'dataSources' as const, label: 'Data Sources Card', icon: '💾' },
        { key: 'activeUsers' as const, label: 'Active Users Card', icon: '👥' },
      ],
    },
    {
      title: 'Performance Data',
      widgets: [
        { key: 'pipelineMetrics' as const, label: 'Pipeline Metrics', icon: '📈' },
        { key: 'platformAvailability' as const, label: 'Platform Availability', icon: '✅' },
      ],
    },
    {
      title: 'Detailed Tables',
      widgets: [
        { key: 'activeWorkflowsTable' as const, label: 'Active Workflows Table', icon: '📋' },
        { key: 'systemComponents' as const, label: 'System Components Table', icon: '⚙️' },
      ],
    },
  ]

  const handleToggle = (key: keyof WidgetPreferences) => {
    onPreferencesChange({
      ...preferences,
      [key]: !preferences[key],
    })
  }

  const handleResetDefaults = () => {
    const defaults: WidgetPreferences = {
      activeWorkflows: true,
      aiAgents: true,
      dataSources: true,
      activeUsers: true,
      pipelineMetrics: true,
      platformAvailability: true,
      activeWorkflowsTable: true,
      systemComponents: true,
    }
    onPreferencesChange(defaults)
  }

  const visibleCount = Object.values(preferences).filter(v => v).length
  const totalCount = Object.values(preferences).length

  return (
    <Box sx={{ p: 3, backgroundColor: '#fafafa', minHeight: '100vh' }}>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 700, color: '#1976d2', mb: 1 }}>
          User Preferences
        </Typography>
        <Typography variant="body2" sx={{ color: '#666' }}>
          Customize your dashboard by showing/hiding widgets and organizing your layout
        </Typography>
      </Box>

      {/* Stats */}
      <Paper sx={{ p: 2, mb: 3, backgroundColor: '#e3f2fd', borderLeft: '4px solid #1976d2' }}>
        <Typography variant="body1" sx={{ fontWeight: 600 }}>
          Visible Widgets: {visibleCount} / {totalCount}
        </Typography>
        <Typography variant="caption" sx={{ color: '#666' }}>
          Hover over cards in the dashboard to drag and reorder them
        </Typography>
      </Paper>

      {/* Widget Settings by Category */}
      {widgetCategories.map((category, idx) => (
        <Paper key={idx} sx={{ mb: 2, overflow: 'hidden' }}>
          {/* Category Header */}
          <Box sx={{ p: 2, backgroundColor: '#f5f5f5', borderBottom: '1px solid #e0e0e0' }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 600, color: '#333' }}>
              {category.title}
            </Typography>
          </Box>

          {/* Category Widgets */}
          <Box sx={{ p: 2 }}>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
              {category.widgets.map((widget) => (
                <Box key={widget.key}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={preferences[widget.key]}
                        onChange={() => handleToggle(widget.key)}
                        color="primary"
                      />
                    }
                    label={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography sx={{ fontSize: '18px' }}>{widget.icon}</Typography>
                        <Typography variant="body2" sx={{ fontWeight: 500, color: '#333' }}>
                          {widget.label}
                        </Typography>
                      </Box>
                    }
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: 1,
                      border: '1px solid #e0e0e0',
                      backgroundColor: preferences[widget.key] ? '#e8f5e9' : '#f5f5f5',
                      transition: 'all 0.2s ease',
                      '&:hover': {
                        backgroundColor: preferences[widget.key] ? '#c8e6c9' : '#eeeeee',
                      },
                    }}
                  />
                </Box>
              ))}
            </Box>
          </Box>
        </Paper>
      ))}

      {/* Dashboard Tips */}
      <Paper sx={{ p: 2.5, mb: 2, backgroundColor: '#fff3e0', border: '1px solid #ffe0b2' }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#e65100', mb: 1 }}>
          💡 Tips for Dashboard Customization
        </Typography>
        <Box component="ul" sx={{ m: 0, pl: 2, color: '#555', fontSize: '13px' }}>
          <li>Toggle switches to show or hide widgets</li>
          <li>Hover over cards on the dashboard to see drag handles</li>
          <li>Click and drag cards to reorder them</li>
          <li>Your preferences are automatically saved</li>
          <li>Reset to defaults at any time</li>
        </Box>
      </Paper>

      {/* Action Buttons */}
      <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-start' }}>
        <Button
          variant="contained"
          startIcon={<SaveIcon />}
          onClick={() => {
            // Preferences are auto-saved, show confirmation
            alert('Preferences saved successfully!')
          }}
          sx={{ backgroundColor: '#1976d2' }}
        >
          Save Preferences
        </Button>
        <Button
          variant="outlined"
          startIcon={<RefreshIcon />}
          onClick={handleResetDefaults}
          sx={{ borderColor: '#ff9800', color: '#ff9800' }}
        >
          Reset to Defaults
        </Button>
      </Box>

      {/* Preview Note */}
      <Paper sx={{ p: 2, mt: 3, backgroundColor: '#f5f5f5', border: '1px dashed #ccc' }}>
        <Typography variant="caption" sx={{ color: '#999' }}>
          📍 Note: Go back to Dashboard to see your customizations in action. Widget positions will update based on your drag and drop arrangement.
        </Typography>
      </Paper>
    </Box>
  )
}
