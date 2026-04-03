import { useState, useEffect } from 'react'
import { SESSION_ID } from './services/session'
import { ThemeProvider, createTheme, CssBaseline } from '@mui/material'
import { Box } from '@mui/material'
import { Navigation } from './components/layout/Navigation'
import { Dashboard } from './components/dashboard/Dashboard'
import { ChatPanel } from './components/chat/ChatPanel'
import { UserPreferences, WidgetPreferences } from './components/settings/UserPreferences'
import { ExecutiveDashboard } from './components/dashboard/ExecutiveDashboard'
import ExecutiveDashboardEnhanced from './components/dashboard/ExecutiveDashboardEnhanced'
import { MockDataProvider } from './context/MockDataContext'
import { AGENTS } from './config/agentConfig'

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
  // null = closed; 'knowledge' | 'esp' | 'dmf' | etc = open panel for that agent
  const [openAgentId, setOpenAgentId] = useState<string | null>(null)
  const [preferences, setPreferences] = useState<WidgetPreferences>(DEFAULT_PREFERENCES)
  const [widgetOrder, setWidgetOrder] = useState<string[]>(DEFAULT_WIDGET_ORDER)

  // Load preferences and widget order from localStorage on mount
  useEffect(() => {
    const savedPreferences = localStorage.getItem(`dashboardPreferences:${SESSION_ID}`)
    if (savedPreferences) {
      try {
        const parsed = JSON.parse(savedPreferences)
        setPreferences(parsed)
      } catch (error) {
        console.error('Failed to parse saved preferences:', error)
      }
    }

    const savedWidgetOrder = localStorage.getItem(`dashboardWidgetOrder:${SESSION_ID}`)
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
    localStorage.setItem(`dashboardPreferences:${SESSION_ID}`, JSON.stringify(preferences))
  }, [preferences])

  // Save widget order to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem(`dashboardWidgetOrder:${SESSION_ID}`, JSON.stringify(widgetOrder))
  }, [widgetOrder])

  return (
    <MockDataProvider>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {activeMenu === 'chat' ? (
        // Full-screen knowledge-assistant layout (nav shortcut)
        <ChatPanel
          isOpen={true}
          fullScreen={true}
          agentConfig={AGENTS.knowledge}
          onClose={() => setActiveMenu('executive')}
        />
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
                onChatClick={() => setOpenAgentId('knowledge')}
                preferences={preferences}
                widgetOrder={widgetOrder}
                onWidgetOrderChange={setWidgetOrder}
              />
            )}
            {activeMenu === 'executive' && (
              <ExecutiveDashboard
                onChatClick={() => setOpenAgentId('knowledge')}
                onOpenAgent={(agentId) => setOpenAgentId(agentId)}
              />
            )}
            {activeMenu === 'quicksight-demo' && (
              <Box sx={{ flex: 1, overflow: 'auto', backgroundColor: '#fafafa' }}>
                <ExecutiveDashboardEnhanced />
              </Box>
            )}
          </Box>

          {/* Floating dashboard-specific or global agent panel */}
          {openAgentId && (
            <ChatPanel
              isOpen={true}
              agentConfig={AGENTS[openAgentId] ?? AGENTS.knowledge}
              onClose={() => setOpenAgentId(null)}
            />
          )}
        </Box>
      )}
    </ThemeProvider>
    </MockDataProvider>
  )
}

export default App
