import { useState, useEffect } from 'react'
import { ThemeProvider, createTheme, CssBaseline } from '@mui/material'
import { Box } from '@mui/material'
import { Navigation } from './components/layout/Navigation'
import { Dashboard } from './components/dashboard/Dashboard'
import { ChatPanel } from './components/chat/ChatPanel'
import { UserPreferences, WidgetPreferences } from './components/settings/UserPreferences'
import { ExecutiveDashboard } from './components/dashboard/ExecutiveDashboard'
import ExecutiveDashboardEnhanced from './components/dashboard/ExecutiveDashboardEnhanced'

// Default preferences
const DEFAULT_PREFERENCES: WidgetPreferences = {
  activeWorkflows: true,
  aiAgents: true,
  dataSources: true,
  activeUsers: true,
  pipelineMetrics: true,
  platformAvailability: true,
  activeWorkflowsTable: true,
  systemComponents: true,
}

// Default widget order
const DEFAULT_WIDGET_ORDER = [
  'activeWorkflows',
  'aiAgents',
  'dataSources',
  'activeUsers',
  'pipelineMetrics',
  'platformAvailability',
  'activeWorkflowsTable',
  'systemComponents',
]

// Create Material UI theme matching DataOps design
const theme = createTheme({
  palette: {
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#2e7d32',
    },
    background: {
      default: '#fafafa',
      paper: '#fff',
    },
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
    fontSize: 14,
    h4: {
      fontWeight: 700,
    },
    h6: {
      fontWeight: 600,
    },
  },
})

function App() {
  const [activeMenu, setActiveMenu] = useState<'dashboard' | 'chat' | 'preferences' | 'executive' | 'quicksight-demo'>('executive')
  const [chatPanelOpen, setChatPanelOpen] = useState(false)
  const [preferences, setPreferences] = useState<WidgetPreferences>(DEFAULT_PREFERENCES)
  const [widgetOrder, setWidgetOrder] = useState<string[]>(DEFAULT_WIDGET_ORDER)

  // Load preferences and widget order from localStorage on mount
  useEffect(() => {
    const savedPreferences = localStorage.getItem('dashboardPreferences')
    if (savedPreferences) {
      try {
        const parsed = JSON.parse(savedPreferences)
        setPreferences(parsed)
      } catch (error) {
        console.error('Failed to parse saved preferences:', error)
      }
    }

    const savedWidgetOrder = localStorage.getItem('dashboardWidgetOrder')
    if (savedWidgetOrder) {
      try {
        const parsed = JSON.parse(savedWidgetOrder)
        setWidgetOrder(parsed)
      } catch (error) {
        console.error('Failed to parse saved widget order:', error)
      }
    }
  }, [])

  // Save preferences to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('dashboardPreferences', JSON.stringify(preferences))
  }, [preferences])

  // Save widget order to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('dashboardWidgetOrder', JSON.stringify(widgetOrder))
  }, [widgetOrder])

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {activeMenu === 'chat' ? (
        // Full-screen chat layout
        <ChatPanel isOpen={true} fullScreen={true} onClose={() => setActiveMenu('executive')} />
      ) : activeMenu === 'preferences' ? (
        // Preferences layout
        <Box sx={{ display: 'flex', height: '100vh', backgroundColor: '#fafafa' }}>
          <Navigation activeMenu={activeMenu} onMenuChange={setActiveMenu} />
          <Box sx={{ flex: 1, overflow: 'auto' }}>
            <UserPreferences preferences={preferences} onPreferencesChange={setPreferences} />
          </Box>
        </Box>
      ) : (
        // Dashboard layout with sidebar
        <Box sx={{ display: 'flex', height: '100vh', backgroundColor: '#fafafa' }}>
          {/* Navigation Sidebar */}
          <Navigation activeMenu={activeMenu} onMenuChange={setActiveMenu} />

          {/* Main Content */}
          <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {activeMenu === 'dashboard' && (
              <Dashboard
                onChatClick={() => setChatPanelOpen(true)}
                preferences={preferences}
                widgetOrder={widgetOrder}
                onWidgetOrderChange={setWidgetOrder}
              />
            )}
            {activeMenu === 'executive' && (
              <ExecutiveDashboard onChatClick={() => setChatPanelOpen(true)} />
            )}
            {activeMenu === 'quicksight-demo' && (
              <Box sx={{ flex: 1, overflow: 'auto', backgroundColor: '#fafafa' }}>
                <ExecutiveDashboardEnhanced />
              </Box>
            )}
          </Box>

          {/* Floating Chat Panel on Dashboard */}
          {chatPanelOpen && (
            <ChatPanel isOpen={chatPanelOpen} onClose={() => setChatPanelOpen(false)} />
          )}
        </Box>
      )}
    </ThemeProvider>
  )
}

export default App
