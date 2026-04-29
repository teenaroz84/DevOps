import { useState, useEffect, useCallback } from 'react'
import { ThemeProvider, createTheme, CssBaseline } from '@mui/material'
import { Box } from '@mui/material'
import { Navigation } from './components/layout/Navigation'
import { Dashboard } from './components/dashboard/Dashboard'
import { ChatPanel } from './components/chat/ChatPanel'
import { LoginScreen } from './components/auth/LoginScreen'
import { UserPreferences, WidgetPreferences } from './components/settings/UserPreferences'
import { ExecutiveDashboard, type SourceKey } from './components/dashboard/ExecutiveDashboard'
import ExecutiveDashboardEnhanced from './components/dashboard/ExecutiveDashboardEnhanced'
import { MockDataProvider } from './context/MockDataContext'
import { AGENTS, FULLSCREEN_AGENT_MENUS, type FullscreenAgentMenuId } from './config/agentConfig'
import { authService, type AuthSession } from './services/auth'
import { APP_COLORS } from './theme/truistPalette'

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
      main: APP_COLORS.primary,
    },
    secondary: {
      main: APP_COLORS.secondary,
    },
    background: {
      default: APP_COLORS.background,
      paper: APP_COLORS.panel,
    },
    text: {
      primary: APP_COLORS.text,
      secondary: APP_COLORS.subtext,
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
  const [authSession, setAuthSession] = useState<AuthSession | null>(() => authService.getSession())
  const isLoginRoute = typeof window !== 'undefined' && window.location.pathname === '/login'
  const [activeMenu, setActiveMenu] = useState<'dashboard' | 'preferences' | 'executive' | 'quicksight-demo' | FullscreenAgentMenuId>('executive')
  // null = closed; 'knowledge' | 'esp' | 'dmf' | etc = open panel for that agent
  const [openAgentId, setOpenAgentId] = useState<string | null>(null)
  const [executiveSource, setExecutiveSource] = useState<SourceKey>('overview')
  const [preferences, setPreferences] = useState<WidgetPreferences>(DEFAULT_PREFERENCES)
  const [widgetOrder, setWidgetOrder] = useState<string[]>(DEFAULT_WIDGET_ORDER)
  const activeBrowserSessionId = authSession?.sessionId

  const handleOpenAgent = useCallback((agentId: string) => setOpenAgentId(agentId), [])
  const handleCloseAgent = useCallback(() => setOpenAgentId(null), [])
  const handleChatClick = useCallback(() => setOpenAgentId('knowledge'), [])
  const handleLogin = useCallback((session: AuthSession) => {
    setAuthSession(session)
    if (typeof window !== 'undefined' && window.location.pathname === '/login') {
      window.history.replaceState({}, '', '/')
    }
  }, [])

  // Load preferences and widget order from localStorage on mount
  useEffect(() => {
    if (!activeBrowserSessionId) return

    setPreferences(DEFAULT_PREFERENCES)
    setWidgetOrder(DEFAULT_WIDGET_ORDER)

    const savedPreferences = localStorage.getItem(`dashboardPreferences:${activeBrowserSessionId}`)
    if (savedPreferences) {
      try {
        const parsed = JSON.parse(savedPreferences)
        setPreferences(parsed)
      } catch (error) {
        console.error('Failed to parse saved preferences:', error)
      }
    }

    const savedWidgetOrder = localStorage.getItem(`dashboardWidgetOrder:${activeBrowserSessionId}`)
    if (savedWidgetOrder) {
      try {
        const parsed = JSON.parse(savedWidgetOrder)
        setWidgetOrder(parsed)
      } catch (error) {
        console.error('Failed to parse saved widget order:', error)
      }
    }
  }, [activeBrowserSessionId])

  // Save preferences to localStorage whenever they change
  useEffect(() => {
    if (!activeBrowserSessionId) return
    localStorage.setItem(`dashboardPreferences:${activeBrowserSessionId}`, JSON.stringify(preferences))
  }, [activeBrowserSessionId, preferences])

  // Save widget order to localStorage whenever it changes
  useEffect(() => {
    if (!activeBrowserSessionId) return
    localStorage.setItem(`dashboardWidgetOrder:${activeBrowserSessionId}`, JSON.stringify(widgetOrder))
  }, [activeBrowserSessionId, widgetOrder])

  const fullscreenAgentMenu = FULLSCREEN_AGENT_MENUS.find((item) => item.menuId === activeMenu)
  const fullscreenAgentSourceMap: Partial<Record<FullscreenAgentMenuId, SourceKey>> = {
    chat: 'overview',
    'esp-chat': 'pipeline',
    'dmf-chat': 'dmf',
    'servicenow-chat': 'servicenow',
    'talend-chat': 'logs',
    'snowflake-chat': 'snowflake',
  }

  const handleCloseFullscreenAgent = useCallback(() => {
    const targetSource = fullscreenAgentMenu ? fullscreenAgentSourceMap[fullscreenAgentMenu.menuId] : undefined
    if (targetSource) {
      setExecutiveSource(targetSource)
    }
    setActiveMenu('executive')
  }, [fullscreenAgentMenu])

  return (
    <MockDataProvider>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {!authSession || isLoginRoute ? (
        <LoginScreen onLogin={handleLogin} />
      ) : fullscreenAgentMenu ? (
        // Full-screen agent layout (nav shortcut)
        <ChatPanel
          isOpen={true}
          fullScreen={true}
          agentConfig={AGENTS[fullscreenAgentMenu.agentId]}
          onClose={handleCloseFullscreenAgent}
        />
      ) : activeMenu === 'preferences' ? (
        // Preferences layout
        <Box sx={{ display: 'flex', height: '100vh', backgroundColor: APP_COLORS.background }}>
          <Navigation activeMenu={activeMenu} onMenuChange={setActiveMenu} loggedInUserId={authSession?.userId} />
          <Box sx={{ flex: 1, overflow: 'auto' }}>
            <UserPreferences preferences={preferences} onPreferencesChange={setPreferences} />
          </Box>
        </Box>
      ) : (
        // Dashboard layout with sidebar
        <Box sx={{ display: 'flex', height: '100vh', backgroundColor: APP_COLORS.background }}>
          {/* Navigation Sidebar */}
          <Navigation activeMenu={activeMenu} onMenuChange={setActiveMenu} loggedInUserId={authSession?.userId} />

          {/* Main Content */}
          <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {activeMenu === 'dashboard' && (
              <Dashboard
                onChatClick={handleChatClick}
                preferences={preferences}
                widgetOrder={widgetOrder}
                onWidgetOrderChange={setWidgetOrder}
              />
            )}
            {activeMenu === 'executive' && (
              <ExecutiveDashboard
                onChatClick={handleChatClick}
                onOpenAgent={handleOpenAgent}
                source={executiveSource}
                onSourceChange={setExecutiveSource}
              />
            )}
            {activeMenu === 'quicksight-demo' && (
              <Box sx={{ flex: 1, overflow: 'auto', backgroundColor: APP_COLORS.background }}>
                <ExecutiveDashboardEnhanced />
              </Box>
            )}
          </Box>

          {/* Floating dashboard-specific or global agent panel */}
          {openAgentId && (
            <ChatPanel
              isOpen={true}
              agentConfig={AGENTS[openAgentId] ?? AGENTS.knowledge}
              onClose={handleCloseAgent}
            />
          )}
        </Box>
      )}
    </ThemeProvider>
    </MockDataProvider>
  )
}

export default App
