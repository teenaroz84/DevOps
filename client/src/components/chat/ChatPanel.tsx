import { APP_COLORS, STATUS_BADGE, TRUIST } from '../../theme/truistPalette'
import React, { useState, useRef, useEffect, useCallback } from 'react'
import {
  Box,
  Paper,
  TextField,
  Button,
  Typography,
  Divider,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Chip,
  CircularProgress,
  Tooltip,
  useMediaQuery,
} from '@mui/material'
import SendIcon from '@mui/icons-material/Send'
import CloseIcon from '@mui/icons-material/Close'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import FileDownloadIcon from '@mui/icons-material/FileDownload'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import PersonIcon from '@mui/icons-material/Person'
import OpenInFullIcon from '@mui/icons-material/OpenInFull'
import CloseFullscreenIcon from '@mui/icons-material/CloseFullscreen'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import AddIcon from '@mui/icons-material/Add'
import HistoryIcon from '@mui/icons-material/History'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import KeyboardDoubleArrowLeftIcon from '@mui/icons-material/KeyboardDoubleArrowLeft'
import KeyboardDoubleArrowRightIcon from '@mui/icons-material/KeyboardDoubleArrowRight'
import { chatService } from '../../services'
import { AGENTS } from '../../config/agentConfig'
import type { AgentConfig } from '../../config/agentConfig'
// import { sessionStore } from '../../services/sessionStore'
import { FormattedMessage } from './FormattedMessage'

function exportDataAsCsv(data: any[]) {
  if (!data || data.length === 0) return
  const headers = Object.keys(data[0])
  const csvRows = [
    headers.join(','),
    ...data.map(row =>
      headers.map(h => {
        const val = String(row[h] ?? '').replace(/"/g, '""')
        return `"${val}"`
      }).join(',')
    ),
  ]
  const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `export_${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// Animated typing indicator
const TypingDots: React.FC = () => (
  <Box sx={{ display: 'flex', gap: '5px', alignItems: 'center', py: 0.25 }}>
    {[0, 1, 2].map(i => (
      <Box
        key={i}
        sx={{
          width: 7, height: 7, borderRadius: '50%',
          backgroundColor: '#90a4ae',
          animation: 'typingBounce 1.2s ease-in-out infinite',
          animationDelay: `${i * 0.18}s`,
          '@keyframes typingBounce': {
            '0%, 80%, 100%': { transform: 'scale(0.55)', opacity: 0.4 },
            '40%': { transform: 'scale(1)', opacity: 1 },
          },
        }}
      />
    ))}
  </Box>
)

const formatTime = (ts: number) =>
  new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

interface Message {
  role: 'user' | 'agent'
  content: string
  type?: 'status' | 'error' | 'success' | 'info' | 'table'
  data?: any
  timestamp?: number
  suggestedActions?: Array<{
    label: string
    action: string
    icon?: string
  }>
}

interface ChatSessionSummary {
  sessionId: string
  title: string
  preview: string
  updatedAt: number
}

interface PersistedPopupChatSession extends ChatSessionSummary {
  messages: Message[]
}

interface PersistedPopupChatState {
  activeSessionId: string
  sessions: PersistedPopupChatSession[]
}

const POPUP_CHAT_STORAGE_PREFIX = 'dataops:popup-chat:'

function createSessionId(scope: 'chat' | 'popup' = 'chat'): string {
  const prefix = scope === 'popup' ? 'popup-session' : 'session'
  try {
    return `${prefix}-${crypto.randomUUID()}`
  } catch {
    return `${prefix}-${Date.now()}-${Math.round(Math.random() * 1_000_000)}`
  }
}

function readPersistedPopupChats(storageKey: string): PersistedPopupChatState | null {
  if (typeof window === 'undefined') return null

  try {
    const raw = window.localStorage.getItem(storageKey)
    if (!raw) return null

    const parsed = JSON.parse(raw) as PersistedPopupChatState
    if (!parsed || !Array.isArray(parsed.sessions)) return null

    const sessions = parsed.sessions.filter(session => (
      typeof session.sessionId === 'string'
      && typeof session.title === 'string'
      && typeof session.preview === 'string'
      && typeof session.updatedAt === 'number'
      && Array.isArray(session.messages)
    ))

    if (sessions.length === 0) return null

    return {
      activeSessionId: typeof parsed.activeSessionId === 'string' ? parsed.activeSessionId : sessions[0].sessionId,
      sessions,
    }
  } catch {
    return null
  }
}

function writePersistedPopupChats(storageKey: string, state: PersistedPopupChatState): void {
  if (typeof window === 'undefined') return

  try {
    window.localStorage.setItem(storageKey, JSON.stringify(state))
  } catch (error) {
    console.warn('[ChatPanel] Failed to persist popup chat sessions', error)
  }
}

function buildSessionSummary(sessionId: string, messages: Message[]): ChatSessionSummary {
  const meaningfulMessages = messages.filter(m => m.content.trim().length > 0)
  const firstUser = meaningfulMessages.find(m => m.role === 'user')
  const lastMessage = meaningfulMessages[meaningfulMessages.length - 1]

  const title = firstUser?.content?.trim()
    ? firstUser.content.trim().slice(0, 48)
    : 'New Chat'
  const preview = lastMessage?.content?.trim()
    ? lastMessage.content.trim().slice(0, 90)
    : 'No messages yet'

  return {
    sessionId,
    title,
    preview,
    updatedAt: Date.now(),
  }
}

function formatSessionTime(timestamp: number): string {
  const now = Date.now()
  const diff = now - timestamp
  const hour = 60 * 60 * 1000
  const day = 24 * hour
  if (diff < hour) return 'Just now'
  if (diff < day) return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  return new Date(timestamp).toLocaleDateString()
}

interface ChatPanelProps {
  isOpen: boolean
  onClose: () => void
  fullScreen?: boolean
  /** When provided, the panel operates as a dashboard-specific agent */
  agentConfig?: AgentConfig
}

type ResizeDirection = 'top' | 'right' | 'bottom' | 'left' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'

const DEFAULT_WELCOME: Message = {
  role: 'agent',
  content: '👋 Hi! I\'m your DataOps Knowledge Assistant. Ask me about DMF ingestion, enrichment standards, ESP scheduling, Talend development, or any other platform guidelines.',
  type: 'info',
}

export function ChatPanel({ isOpen, onClose, fullScreen = false, agentConfig }: ChatPanelProps) {
  const PANEL_MARGIN = 24
  const MIN_PANEL_WIDTH = 400
  const MAX_PANEL_WIDTH = Number.MAX_SAFE_INTEGER
  const MIN_PANEL_HEIGHT = 520
  const MAX_PANEL_HEIGHT = Number.MAX_SAFE_INTEGER
  // Resolved config — fall back to global knowledge agent
  const agent: AgentConfig = agentConfig ?? AGENTS.knowledge
  const useDarkHeaderText = agent.id === 'snowflake'
  const headerTextColor = useDarkHeaderText ? TRUIST.charcoal : TRUIST.white
  const headerSubtextColor = useDarkHeaderText ? TRUIST.purple : 'rgba(255,255,255,0.82)'
  const headerMutedTextColor = useDarkHeaderText ? TRUIST.darkGray : 'rgba(255,255,255,0.82)'
  const headerActionBorder = useDarkHeaderText ? `1px solid ${TRUIST.charcoal}55` : '1px solid rgba(255,255,255,0.4)'
  const headerActionHover = useDarkHeaderText ? 'rgba(52,52,59,0.08)' : 'rgba(255,255,255,0.15)'
  const userBubbleColor = APP_COLORS.primary
  const userBubbleTextColor = TRUIST.white
  const renderAgentIcon = (size: number) => {
    const effectiveSize = Math.max(14, Math.round(size * 0.75))

    return (
    <Box
      component="img"
      src={agent.icon}
      alt={`${agent.name} icon`}
      sx={{ width: effectiveSize, height: effectiveSize, borderRadius: effectiveSize > 18 ? 2 : '50%', objectFit: 'contain', display: 'block', flexShrink: 0 }}
    />
    )
  }
  const [input, setInput] = useState('')
  const [expanded, setExpanded] = useState(false)
  const [showQuickActions, setShowQuickActions] = useState(true)
  const [panelPosition, setPanelPosition] = useState({ x: PANEL_MARGIN, y: PANEL_MARGIN })
  const [dragging, setDragging] = useState(false)
  const dragRef = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null)
  const popupStorageKey = `${POPUP_CHAT_STORAGE_PREFIX}${agent.id}`
  const sessionIdScope: 'chat' | 'popup' = fullScreen ? 'chat' : 'popup'

  const welcomeMessageText = agentConfig ? agentConfig.welcomeMessage : DEFAULT_WELCOME.content
  const WELCOME_MESSAGE: Message = React.useMemo(() => ({
    role: 'agent',
    content: welcomeMessageText,
    type: 'info',
  }), [welcomeMessageText])

  const [chatSessions, setChatSessions] = useState<ChatSessionSummary[]>([])
  const [activeSessionId, setActiveSessionId] = useState('')
  const sessionMessagesRef = useRef<Record<string, Message[]>>({})
  const fullScreenSessionLoadRef = useRef(0)

  // ── Session state ────────────────────────────────────────────────────────
  const [messages, setMessages] = useState<Message[]>(() => {
    return [WELCOME_MESSAGE]
  })
  const [sessionLoading, setSessionLoading] = useState(false)

  useEffect(() => {
    const starterMessages = [WELCOME_MESSAGE]
    const restoreStarterSession = () => {
      const starter = buildSessionSummary(createSessionId(sessionIdScope), starterMessages)
      sessionMessagesRef.current = { [starter.sessionId]: starterMessages }
      setMessages(starterMessages)
      setChatSessions([starter])
      setActiveSessionId(starter.sessionId)
    }

    if (!fullScreen) {
      const persisted = readPersistedPopupChats(popupStorageKey)
      if (persisted) {
        const restoredMessages = persisted.sessions.reduce<Record<string, Message[]>>((acc, session) => {
          acc[session.sessionId] = session.messages.length > 0 ? session.messages : starterMessages
          return acc
        }, {})
        const restoredSessions = persisted.sessions.map(session => ({
          sessionId: session.sessionId,
          title: session.title,
          preview: session.preview,
          updatedAt: session.updatedAt,
        }))
        const restoredActiveSessionId = restoredMessages[persisted.activeSessionId]
          ? persisted.activeSessionId
          : restoredSessions[0].sessionId
        sessionMessagesRef.current = restoredMessages
        setChatSessions(restoredSessions)
        setActiveSessionId(restoredActiveSessionId)
        setMessages(restoredMessages[restoredActiveSessionId] ?? starterMessages)
        setSessionLoading(false)
        setSessionListLoading(false)
        return
      }

      restoreStarterSession()
      setSessionLoading(false)
      setSessionListLoading(false)
      return
    }

    let cancelled = false
    setSessionLoading(true)
    setSessionListLoading(true)

    chatService.listSessions(agent.id)
      .then(async (sessions) => {
        if (cancelled) return

        if (!Array.isArray(sessions) || sessions.length === 0) {
          restoreStarterSession()
          setSessionLoading(false)
          setSessionListLoading(false)
          return
        }

        setChatSessions(sessions)
        const nextSessionId = sessions[0].sessionId
        setActiveSessionId(nextSessionId)
        setInput('')
        setLoading(false)
        setLoadingSessionId(null)
        setSessionListLoading(false)

        const requestId = ++fullScreenSessionLoadRef.current
        const loadedMessages = await chatService.loadSession(agent.id, nextSessionId)
        if (cancelled || fullScreenSessionLoadRef.current !== requestId) return

        const nextMessages = loadedMessages.length > 0 ? loadedMessages as Message[] : starterMessages
        sessionMessagesRef.current[nextSessionId] = nextMessages
        setMessages(nextMessages)
        setSessionLoading(false)
      })
      .catch(() => {
        if (cancelled) return
        restoreStarterSession()
        setSessionLoading(false)
        setSessionListLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [WELCOME_MESSAGE, agent.id, fullScreen, popupStorageKey, sessionIdScope])

  useEffect(() => {
    if (!activeSessionId) return
    const sessionEntry = sessionMessagesRef.current[activeSessionId]
    if (!sessionEntry && fullScreen) return
    const nextMessages = sessionEntry ?? [WELCOME_MESSAGE]
    setMessages(prev => (prev === nextMessages ? prev : nextMessages))
    setSessionLoading(false)
  }, [activeSessionId, WELCOME_MESSAGE, fullScreen])

  const [loading, setLoading] = useState(false)
  const [loadingSessionId, setLoadingSessionId] = useState<string | null>(null)
  const [sessionListLoading, setSessionListLoading] = useState(false)
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null)
  const [inputHistory, setInputHistory] = useState<string[]>([])
  const [historyIdx, setHistoryIdx] = useState(-1)
  const [isSessionSidebarCollapsed, setIsSessionSidebarCollapsed] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const sessionsListRef = useRef<HTMLDivElement>(null)
  const [panelSize, setPanelSize] = useState(() => {
    const fallback = { width: 440, height: 780 }
    if (typeof window === 'undefined') return fallback
    return {
      width: fallback.width,
      height: Math.min(window.innerHeight - PANEL_MARGIN * 2, 820),
    }
  })
  const [resizing, setResizing] = useState(false)
  const resizeRef = useRef<{
    startX: number
    startY: number
    originWidth: number
    originHeight: number
    originX: number
    originY: number
    direction: ResizeDirection
  } | null>(null)

  const isCompactFullScreen = useMediaQuery('(max-width:980px)')
  const isMobileViewport = !fullScreen && typeof window !== 'undefined' && window.innerWidth <= 600
  const panelWidth = isMobileViewport ? (typeof window !== 'undefined' ? window.innerWidth : 440) : panelSize.width
  const panelHeight = isMobileViewport
    ? (typeof window !== 'undefined' ? window.innerHeight : 0)
    : panelSize.height

  const clampPanelPosition = useCallback((x: number, y: number) => {
    if (typeof window === 'undefined' || isMobileViewport) return { x: 0, y: 0 }
    const maxX = Math.max(0, window.innerWidth - panelWidth)
    const maxY = Math.max(0, window.innerHeight - panelHeight)
    return {
      x: Math.min(Math.max(0, x), maxX),
      y: Math.min(Math.max(0, y), maxY),
    }
  }, [isMobileViewport, panelHeight, panelWidth])

  useEffect(() => {
    if (typeof window === 'undefined' || fullScreen) return
    if (isMobileViewport) {
      setPanelPosition(prev => (prev.x === 0 && prev.y === 0 ? prev : { x: 0, y: 0 }))
      return
    }
    setPanelPosition(prev => {
      const defaultX = window.innerWidth - panelWidth - PANEL_MARGIN
      const defaultY = Math.max(PANEL_MARGIN, Math.round((window.innerHeight - panelHeight) / 2))
      if (prev.x === PANEL_MARGIN && prev.y === PANEL_MARGIN) {
        const next = clampPanelPosition(defaultX, defaultY)
        return next.x === prev.x && next.y === prev.y ? prev : next
      }
      const next = clampPanelPosition(prev.x, prev.y)
      return next.x === prev.x && next.y === prev.y ? prev : next
    })
  }, [clampPanelPosition, fullScreen, isMobileViewport, panelHeight, panelWidth])

  useEffect(() => {
    if (typeof window === 'undefined' || fullScreen || isMobileViewport) return
    const maxHeightInViewport = Math.min(window.innerHeight, MAX_PANEL_HEIGHT)
    const targetWidth = expanded ? 760 : 440
    setPanelSize(prev => {
      const nextWidth = Math.min(Math.max(targetWidth, MIN_PANEL_WIDTH), MAX_PANEL_WIDTH)
      const nextHeight = Math.min(Math.max(prev.height, MIN_PANEL_HEIGHT), maxHeightInViewport)
      return prev.width === nextWidth && prev.height === nextHeight
        ? prev
        : { width: nextWidth, height: nextHeight }
    })
  }, [expanded, fullScreen, isMobileViewport])

  useEffect(() => {
    if (fullScreen || isMobileViewport || !dragging) return

    const handleMouseMove = (event: MouseEvent) => {
      const drag = dragRef.current
      if (!drag) return
      const nextX = drag.originX + (event.clientX - drag.startX)
      const nextY = drag.originY + (event.clientY - drag.startY)
      setPanelPosition(clampPanelPosition(nextX, nextY))
    }

    const handleMouseUp = () => {
      dragRef.current = null
      setDragging(false)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [clampPanelPosition, dragging, fullScreen, isMobileViewport])

  useEffect(() => {
    if (fullScreen || isMobileViewport || !resizing) return

    const handleMouseMove = (event: MouseEvent) => {
      const resize = resizeRef.current
      if (!resize || typeof window === 'undefined') return

      const dx = event.clientX - resize.startX
      const dy = event.clientY - resize.startY
      const dir = resize.direction

      let nextX = resize.originX
      let nextY = resize.originY
      let nextWidth = resize.originWidth
      let nextHeight = resize.originHeight

      if (dir.includes('right')) {
        const maxWidth = Math.min(MAX_PANEL_WIDTH, window.innerWidth - resize.originX)
        nextWidth = Math.min(Math.max(MIN_PANEL_WIDTH, resize.originWidth + dx), maxWidth)
      }
      if (dir.includes('left')) {
        const rightEdge = resize.originX + resize.originWidth
        const minLeft = Math.max(0, rightEdge - MAX_PANEL_WIDTH)
        const maxLeft = rightEdge - MIN_PANEL_WIDTH
        nextX = Math.min(Math.max(minLeft, resize.originX + dx), maxLeft)
        nextWidth = rightEdge - nextX
      }
      if (dir.includes('bottom')) {
        const maxHeight = Math.min(MAX_PANEL_HEIGHT, window.innerHeight - resize.originY)
        nextHeight = Math.min(Math.max(MIN_PANEL_HEIGHT, resize.originHeight + dy), maxHeight)
      }
      if (dir.includes('top')) {
        const bottomEdge = resize.originY + resize.originHeight
        const minTop = Math.max(0, bottomEdge - MAX_PANEL_HEIGHT)
        const maxTop = bottomEdge - MIN_PANEL_HEIGHT
        nextY = Math.min(Math.max(minTop, resize.originY + dy), maxTop)
        nextHeight = bottomEdge - nextY
      }

      setPanelPosition(prev => (
        prev.x === nextX && prev.y === nextY ? prev : { x: nextX, y: nextY }
      ))
      setPanelSize(prev => (
        prev.width === nextWidth && prev.height === nextHeight
          ? prev
          : { width: nextWidth, height: nextHeight }
      ))
    }

    const handleMouseUp = () => {
      resizeRef.current = null
      setResizing(false)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [fullScreen, isMobileViewport, resizing])

  const handleDragStart = (event: React.MouseEvent<HTMLDivElement>) => {
    if (fullScreen || isMobileViewport) return
    const target = event.target as HTMLElement
    if (target.closest('button') || target.closest('input') || target.closest('textarea')) return
    dragRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      originX: panelPosition.x,
      originY: panelPosition.y,
    }
    setDragging(true)
  }

  const handleResizeStart = (direction: ResizeDirection) => (event: React.MouseEvent<HTMLDivElement>) => {
    if (fullScreen || isMobileViewport) return
    event.preventDefault()
    event.stopPropagation()
    resizeRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      originWidth: panelWidth,
      originHeight: panelHeight,
      originX: panelPosition.x,
      originY: panelPosition.y,
      direction,
    }
    setResizing(true)
  }

  useEffect(() => {
    if (activeSessionId) {
      sessionMessagesRef.current[activeSessionId] = messages

      const summary = buildSessionSummary(activeSessionId, messages)
      setChatSessions(prev => {
        const others = prev.filter(item => item.sessionId !== activeSessionId)
        return [summary, ...others]
      })
    }
  }, [messages, activeSessionId])

  useEffect(() => {
    if (fullScreen || !activeSessionId || chatSessions.length === 0) return

    const persistedSessions = chatSessions.map(session => ({
      ...session,
      messages: sessionMessagesRef.current[session.sessionId] ?? (session.sessionId === activeSessionId ? messages : [WELCOME_MESSAGE]),
    }))

    writePersistedPopupChats(popupStorageKey, {
      activeSessionId,
      sessions: persistedSessions,
    })
  }, [activeSessionId, chatSessions, fullScreen, messages, popupStorageKey, WELCOME_MESSAGE])

  useEffect(() => {
    if (!fullScreen || !activeSessionId) return
    if (!messages.some((message) => message.role === 'user')) return

    chatService.saveSession(agent.id, messages, activeSessionId)
  }, [activeSessionId, agent.id, fullScreen, messages])

  const HEALTH_CHECK_QUERY = '__health_check__'

  const quickActions = agent.quickActions
  const isSessionLoading = loading && loadingSessionId === activeSessionId
  const hasConversationStarted = messages.some((msg) => msg.role === 'user') || messages.length > 1

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (hasConversationStarted) setShowQuickActions(false)
  }, [hasConversationStarted])

  const sendMessage = async (messageText?: string) => {
    if (!activeSessionId) return
    const requestSessionId = activeSessionId
    const textToSend = messageText || input
    if (!textToSend.trim()) return

    const isHealthCheck = textToSend === HEALTH_CHECK_QUERY
    if (!isHealthCheck && textToSend.trim()) {
      setInputHistory(prev => [textToSend, ...prev.slice(0, 19)])
    }
    setHistoryIdx(-1)
    const userMessage: Message = { role: 'user', content: isHealthCheck ? '🩺 Agent Health Check' : textToSend, timestamp: Date.now() }
    setMessages(prev => [...prev, userMessage])
    setInput('')
    setLoading(true)
    setLoadingSessionId(requestSessionId)

    try {
      if (isHealthCheck) {
        const health = await chatService.checkHealth()
        const status = health.status ?? 'unknown'
        const isOk = /^(ok|healthy|up|running)$/i.test(status)
        // Build a readable summary from whatever the server returns
        const details = Object.entries(health)
          .filter(([k]) => k !== 'status')
          .map(([k, v]) => `• ${k}: ${JSON.stringify(v)}`)
          .join('\n')
        setMessages(prev => [...prev, {
          role: 'agent',
          content: `${isOk ? '✅' : '⚠️'} Agent status: **${status}**${details ? `\n${details}` : ''}`,
          type: isOk ? 'success' : 'error',
          timestamp: Date.now(),
        }])
      } else {
        const data = await chatService.sendMessage(textToSend, agent.endpoint, requestSessionId)
        // sessionStore.setChat({ lastAgentId: agent.id })
        const agentResponse: Message = {
          role: 'agent',
          content: data.text || '(No response)',
          type: data.type as Message['type'],
          data: data.data,
          timestamp: Date.now(),
          suggestedActions: (data as any).suggestedActions,
        }
        setMessages(prev => [...prev, agentResponse])
      }
    } catch (error) {
      console.error('API Error:', error)
      const errorMessage: Message = {
        role: 'agent',
        content: `❌ Error: ${error instanceof Error ? error.message : 'Failed to connect to the assistant service'}`,
        type: 'error',
        timestamp: Date.now(),
        suggestedActions: [{ label: '🔄 Retry', action: textToSend }],
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setLoading(false)
      setLoadingSessionId(null)
    }
  }

  

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    } else if (e.key === 'ArrowUp' && !input) {
      e.preventDefault()
      const nextIdx = Math.min(historyIdx + 1, inputHistory.length - 1)
      setHistoryIdx(nextIdx)
      setInput(inputHistory[nextIdx] ?? '')
    } else if (e.key === 'ArrowDown' && historyIdx >= 0) {
      e.preventDefault()
      const nextIdx = historyIdx - 1
      setHistoryIdx(nextIdx)
      setInput(nextIdx < 0 ? '' : inputHistory[nextIdx])
    }
  }

  const resetToMainMenu = () => {
    if (!activeSessionId) return
    const resetMessages = [WELCOME_MESSAGE]
    sessionMessagesRef.current[activeSessionId] = resetMessages
    setMessages(resetMessages)
    setInput('')
    if (fullScreen) {
      chatService.clearSession(agent.id, activeSessionId)
    }
    setChatSessions(prev => {
      return [buildSessionSummary(activeSessionId, resetMessages), ...prev.filter(item => item.sessionId !== activeSessionId)]
    })
  }

  const createNewChat = useCallback(() => {
    const nextSessionId = createSessionId(sessionIdScope)
    const nextMessages = [WELCOME_MESSAGE]
    const nextSummary = buildSessionSummary(nextSessionId, nextMessages)
    sessionMessagesRef.current[nextSessionId] = nextMessages
    setChatSessions(prev => {
      return [nextSummary, ...prev]
    })
    setActiveSessionId(nextSessionId)
    setMessages(nextMessages)
    setInput('')
    setLoading(false)
    setLoadingSessionId(null)
  }, [WELCOME_MESSAGE, sessionIdScope])

  const switchToSession = useCallback((sessionId: string) => {
    const nextMessages = sessionMessagesRef.current[sessionId]
    setActiveSessionId(sessionId)
    setInput('')
    setLoading(false)
    setLoadingSessionId(null)

    if (nextMessages) {
      setMessages(nextMessages)
      setSessionLoading(false)
      return
    }

    if (!fullScreen) {
      setMessages([WELCOME_MESSAGE])
      setSessionLoading(false)
      return
    }

    setSessionLoading(true)
    const requestId = ++fullScreenSessionLoadRef.current
    chatService.loadSession(agent.id, sessionId)
      .then((loadedMessages) => {
        if (fullScreenSessionLoadRef.current !== requestId) return
        const restoredMessages = loadedMessages.length > 0 ? loadedMessages as Message[] : [WELCOME_MESSAGE]
        sessionMessagesRef.current[sessionId] = restoredMessages
        setMessages(restoredMessages)
      })
      .catch(() => {
        if (fullScreenSessionLoadRef.current !== requestId) return
        const fallbackMessages = [WELCOME_MESSAGE]
        sessionMessagesRef.current[sessionId] = fallbackMessages
        setMessages(fallbackMessages)
      })
      .finally(() => {
        if (fullScreenSessionLoadRef.current === requestId) {
          setSessionLoading(false)
        }
      })
  }, [WELCOME_MESSAGE, agent.id, fullScreen])

  const deleteChatSession = useCallback((sessionId: string) => {
    const remaining = chatSessions.filter((session) => session.sessionId !== sessionId)

    if (fullScreen) {
      chatService.clearSession(agent.id, sessionId)
    }

    if (remaining.length === 0) {
      const starterMessages = [WELCOME_MESSAGE]
      const starter = buildSessionSummary(createSessionId(sessionIdScope), starterMessages)
      sessionMessagesRef.current = { [starter.sessionId]: starterMessages }
      setChatSessions([starter])
      setActiveSessionId(starter.sessionId)
      setMessages(starterMessages)
      setInput('')
      setLoading(false)
      setLoadingSessionId(null)
      setSessionLoading(false)
      return
    }

    setChatSessions(remaining)
    delete sessionMessagesRef.current[sessionId]

    if (activeSessionId === sessionId) {
      const nextMessages = sessionMessagesRef.current[remaining[0].sessionId] ?? [WELCOME_MESSAGE]
      setActiveSessionId(remaining[0].sessionId)
      setMessages(nextMessages)
      setInput('')
      setLoading(false)
      setLoadingSessionId(null)
      setSessionLoading(false)
    }
  }, [activeSessionId, agent.id, chatSessions, fullScreen, WELCOME_MESSAGE, sessionIdScope])

  const scrollSessionsToEnd = useCallback(() => {
    const node = sessionsListRef.current
    if (!node) return
    node.scrollTo({ top: node.scrollHeight, behavior: 'smooth' })
  }, [])

  // Get the last message with data
  if (!isOpen && !fullScreen) return null

  if (fullScreen) {
    const showCollapsedSessionRail = !isCompactFullScreen && isSessionSidebarCollapsed

    // Full-screen chat layout — results panel hidden
    return (
      <Box
        sx={{
          display: 'flex',
          height: '100vh',
          backgroundColor: '#f2f5f9',
          flexDirection: isCompactFullScreen ? 'column' : 'row',
        }}
      >
        {/* Session Sidebar */}
        {showCollapsedSessionRail ? (
          <Box
            sx={{
              width: 56,
              borderRight: '1px solid #dde5ef',
              backgroundColor: '#f7fafc',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              py: 1,
              gap: 1,
            }}
          >
            <Tooltip title="Expand sessions" placement="right">
              <IconButton
                size="small"
                onClick={() => setIsSessionSidebarCollapsed(false)}
                sx={{ color: '#546e7a' }}
              >
                <KeyboardDoubleArrowRightIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </Tooltip>
            <Tooltip title="New chat" placement="right">
              <IconButton
                size="small"
                onClick={createNewChat}
                sx={{ color: '#1565c0', backgroundColor: '#e3f2fd', '&:hover': { backgroundColor: '#bbdefb' } }}
              >
                <AddIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Tooltip>
            <HistoryIcon sx={{ fontSize: 18, color: '#90a4ae', mt: 0.5 }} />
          </Box>
        ) : (
          <Box
            sx={{
              width: isCompactFullScreen ? '100%' : 320,
              borderRight: isCompactFullScreen ? 'none' : '1px solid #dde5ef',
              borderBottom: isCompactFullScreen ? '1px solid #dde5ef' : 'none',
              backgroundColor: '#f7fafc',
              display: 'flex',
              flexDirection: 'column',
              maxHeight: isCompactFullScreen ? 260 : '100vh',
            }}
          >
            <Box sx={{ p: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <HistoryIcon sx={{ fontSize: 18, color: '#546e7a' }} />
                <Typography sx={{ fontSize: '12px', fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase', color: '#607d8b' }}>
                  Chat Sessions
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                {!isCompactFullScreen && (
                  <Tooltip title="Collapse sessions" placement="bottom">
                    <IconButton
                      size="small"
                      onClick={() => setIsSessionSidebarCollapsed(true)}
                      sx={{ color: '#607d8b' }}
                    >
                      <KeyboardDoubleArrowLeftIcon sx={{ fontSize: 18 }} />
                    </IconButton>
                  </Tooltip>
                )}
                <Button
                  size="small"
                  variant="contained"
                  startIcon={<AddIcon sx={{ fontSize: 14 }} />}
                  onClick={createNewChat}
                  sx={{ textTransform: 'none', fontWeight: 600, borderRadius: 2, backgroundColor: APP_COLORS.primary, '&:hover': { backgroundColor: TRUIST.dusk } }}
                >
                  New Chat
                </Button>
              </Box>
            </Box>
            <Box
              ref={sessionsListRef}
              sx={{
                px: 1.5,
                pb: 1.5,
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: 1,
                scrollbarWidth: 'thin',
                scrollbarColor: '#90a4ae #eaf0f6',
                '&::-webkit-scrollbar': { width: 8 },
                '&::-webkit-scrollbar-track': { backgroundColor: '#eaf0f6', borderRadius: 8 },
                '&::-webkit-scrollbar-thumb': { backgroundColor: '#90a4ae', borderRadius: 8 },
                '&::-webkit-scrollbar-thumb:hover': { backgroundColor: '#78909c' },
              }}
            >
              {sessionListLoading ? (
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1, py: 4, color: '#90a4ae' }}>
                  <CircularProgress size={18} sx={{ color: '#90a4ae' }} />
                  <Typography sx={{ fontSize: '11px' }}>Loading chat sessions...</Typography>
                </Box>
              ) : chatSessions.length === 0 ? (
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1, py: 4, px: 2, textAlign: 'center' }}>
                  <HistoryIcon sx={{ fontSize: 20, color: '#b0bec5' }} />
                  <Typography sx={{ fontSize: '12px', fontWeight: 600, color: '#607d8b' }}>No chats yet</Typography>
                  <Typography sx={{ fontSize: '11px', color: '#90a4ae', lineHeight: 1.4 }}>Start a new conversation to create your first saved session for this agent.</Typography>
                </Box>
              ) : chatSessions.map(session => {
                const active = session.sessionId === activeSessionId
                return (
                  <Paper
                    key={session.sessionId}
                    onClick={() => switchToSession(session.sessionId)}
                    sx={{
                      p: 1.25,
                      borderRadius: 2,
                      boxShadow: 'none',
                      border: active ? `1px solid ${TRUIST.dawn}` : '1px solid #dbe5f0',
                      backgroundColor: active ? TRUIST.mist : '#fff',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      '&:hover': { borderColor: TRUIST.sky, transform: 'translateY(-1px)' },
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 0.5 }}>
                      <Typography sx={{ fontSize: '13px', fontWeight: 700, color: '#1f2937', mb: 0.3 }}>
                        {session.title}
                      </Typography>
                      <IconButton
                        size="small"
                        onClick={(event) => {
                          event.stopPropagation()
                          deleteChatSession(session.sessionId)
                        }}
                        sx={{ mt: -0.6, mr: -0.6, color: '#90a4ae', '&:hover': { color: TRUIST.charcoal, backgroundColor: '#EFEDF4' } }}
                        title="Delete chat session"
                      >
                        <DeleteOutlineIcon sx={{ fontSize: 16 }} />
                      </IconButton>
                    </Box>
                    <Typography sx={{ fontSize: '11px', color: '#607d8b', lineHeight: 1.35, mb: 0.6 }}>
                      {session.preview}
                    </Typography>
                    <Typography sx={{ fontSize: '10px', color: '#90a4ae' }}>
                      {formatSessionTime(session.updatedAt)}
                    </Typography>
                  </Paper>
                )
              })}
            </Box>
            <Box sx={{ p: 1.5, pt: 0.75, borderTop: '1px solid #dde5ef', backgroundColor: '#f7fafc' }}>
              <Button
                fullWidth
                size="small"
                variant="outlined"
                onClick={scrollSessionsToEnd}
                sx={{
                  textTransform: 'none',
                  fontWeight: 600,
                  borderRadius: 2,
                  borderColor: TRUIST.dawn,
                  color: APP_COLORS.primary,
                  '&:hover': { borderColor: '#64b5f6', backgroundColor: '#edf6ff' },
                }}
              >
                See All Chats
              </Button>
            </Box>
          </Box>
        )}

        {/* Chat — main conversation pane */}
        <Box
          sx={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            minWidth: 0,
            backgroundColor: '#fff',
          }}
        >
          {/* Header */}
          <Box
            sx={{
              backgroundColor: agent.color,
              color: headerTextColor,
              p: 2.5,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              {renderAgentIcon(22)}
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
                  {agent.name}
                </Typography>
                <Typography sx={{ fontSize: '11px', color: headerSubtextColor, lineHeight: 1 }}>
                  {agent.subtitle}
                </Typography>
                <Typography sx={{ fontSize: '10px', color: headerMutedTextColor, lineHeight: 1.1, mt: 0.5 }}>
                  {chatSessions.find(s => s.sessionId === activeSessionId)?.title ?? 'New Chat'}
                </Typography>
              </Box>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              {messages.length > 1 && (
                <Button
                  size="small"
                  onClick={resetToMainMenu}
                  sx={{
                    color: headerTextColor,
                    textTransform: 'none',
                    fontSize: '13px',
                    '&:hover': { backgroundColor: headerActionHover },
                  }}
                >
                  ↺ Clear
                </Button>
              )}
               <Button
                size="small"
                startIcon={<ArrowBackIcon sx={{ fontSize: 16 }} />}
                onClick={onClose}
                sx={{
                  color: headerTextColor,
                  textTransform: 'none',
                  fontSize: '13px',
                  fontWeight: 600,
                  border: headerActionBorder,
                  borderRadius: 1.5,
                  px: 1.5,
                  '&:hover': { backgroundColor: headerActionHover, borderColor: useDarkHeaderText ? TRUIST.charcoal : '#fff' },
                }}
              >
                Back to Dashboard
              </Button>
            </Box>
          </Box>

          {hasConversationStarted ? (
            <>
              {/* Messages Area */}
              <Box
                sx={{
                  flex: 1,
                  overflowY: 'auto',
                  p: 2.5,
                  backgroundColor: '#fafafa',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 2,
                }}
              >
                {/* Session loading from DynamoDB */}
                {sessionLoading && (
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, py: 1 }}>
                    <CircularProgress size={14} sx={{ color: '#90a4ae' }} />
                    <Typography sx={{ fontSize: '11px', color: '#90a4ae' }}>Restoring history...</Typography>
                  </Box>
                )}
                {messages.map((msg, idx) => (
                  <Box key={idx} sx={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start', flexDirection: 'column', alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start', gap: 1 }}>
                    <Paper
                      sx={{
                        maxWidth: '85%',
                        p: 1.5,
                        backgroundColor:
                          msg.role === 'user'
                            ? APP_COLORS.primary
                            : msg.type === 'error'
                              ? STATUS_BADGE.error.bg
                              : msg.type === 'success'
                                ? STATUS_BADGE.success.bg
                                : '#f5f5f5',
                        color: msg.role === 'user' ? '#fff' : msg.type === 'error' ? STATUS_BADGE.error.color : '#333',
                        boxShadow: 'none',
                        border: msg.type === 'error' ? `1px solid ${STATUS_BADGE.error.dot}` : 'none',
                      }}
                    >
                      {msg.type === 'table' && msg.data ? (
                        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                          <Typography variant="body2" sx={{ fontSize: '13px' }}>
                            📊 {msg.content}
                          </Typography>
                          <IconButton
                            size="small"
                            onClick={() => exportDataAsCsv(msg.data)}
                            title="Export as CSV"
                            sx={{ ml: 1, color: APP_COLORS.primary, '&:hover': { backgroundColor: 'rgba(46,26,71,0.08)' } }}
                          >
                            <FileDownloadIcon sx={{ fontSize: 18 }} />
                          </IconButton>
                        </Box>
                      ) : msg.role === 'agent' ? (
                        <FormattedMessage
                          text={msg.content}
                          color={msg.type === 'error' ? STATUS_BADGE.error.color : msg.type === 'success' ? STATUS_BADGE.success.color : '#333'}
                        />
                      ) : (
                        <Typography variant="body2" sx={{ fontSize: '13px', lineHeight: 1.4 }}>
                          {msg.content}
                        </Typography>
                      )}
                    </Paper>
                    {msg.suggestedActions && msg.suggestedActions.length > 0 && (
                      <Box sx={{ display: 'flex', gap: 0.8, flexWrap: 'wrap', mt: 1.2, width: '100%' }}>
                        {msg.suggestedActions.map((action, aIdx) => (
                          <Button
                            key={aIdx}
                            size="small"
                            variant="contained"
                            onClick={() => {
                              if (action.action === 'restart_service') {
                                sendMessage('Restart the DataOps service')
                              } else if (action.action === 'terminate_service') {
                                const termMsg: Message = {
                                  role: 'agent',
                                  content: 'Service terminated. You can restart it when you are ready.',
                                  type: 'success',
                                  suggestedActions: [
                                    { label: '▶️ Restart Service', action: 'restart_service' }
                                  ]
                                }
                                setMessages(prev => [...prev, termMsg])
                              } else {
                                sendMessage(action.action)
                              }
                            }}
                            disabled={isSessionLoading}
                            sx={{
                              fontSize: '12px',
                              fontWeight: 500,
                              textTransform: 'none',
                              padding: '6px 12px',
                              backgroundColor:
                                action.action === 'restart_service' ? TRUIST.dusk :
                                action.action === 'terminate_service' ? TRUIST.charcoal :
                                msg.type === 'error' ? TRUIST.charcoal :
                                msg.type === 'success' ? TRUIST.dusk : APP_COLORS.primary,
                              color: '#fff',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              '&:hover': {
                                backgroundColor:
                                  action.action === 'restart_service' ? TRUIST.darkGray :
                                  action.action === 'terminate_service' ? TRUIST.purple :
                                  msg.type === 'error' ? TRUIST.purple :
                                  msg.type === 'success' ? TRUIST.darkGray : TRUIST.dusk,
                                boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
                              },
                              '&:disabled': { opacity: 0.6, cursor: 'not-allowed' },
                              transition: 'all 0.2s ease',
                            }}
                          >
                            {action.label}
                          </Button>
                        ))}
                      </Box>
                    )}
                  </Box>
                ))}

                {isSessionLoading && (
                  <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 0.75 }}>
                    <Box sx={{ width: 26, height: 26, borderRadius: '50%', backgroundColor: APP_COLORS.primary, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {renderAgentIcon(18)}
                    </Box>
                    <Paper sx={{ p: 1.5, backgroundColor: '#f0f4f8', boxShadow: 'none', borderRadius: '16px 16px 16px 4px', border: '1px solid transparent' }}>
                      <TypingDots />
                    </Paper>
                  </Box>
                )}

                <div ref={messagesEndRef} />
              </Box>

              {/* Quick Actions Strip */}
              <Box sx={{ borderTop: '1px solid #f0f0f0', flexShrink: 0, backgroundColor: '#fff' }}>
                <Box
                  onClick={() => setShowQuickActions(v => !v)}
                  sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 2.5, py: 0.6, cursor: 'pointer', '&:hover': { backgroundColor: '#f9f9f9' } }}
                >
                  <Typography sx={{ color: '#78909c', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                    Quick Actions
                  </Typography>
                  {showQuickActions
                    ? <ExpandLessIcon sx={{ fontSize: 15, color: '#90a4ae' }} />
                    : <ExpandMoreIcon sx={{ fontSize: 15, color: '#90a4ae' }} />
                  }
                </Box>
                {showQuickActions && (
                  <Box sx={{ px: 2.5, pb: 0.75, display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                    {quickActions.map((action, idx) => (
                      <Chip
                        key={idx}
                        label={action.label}
                        size="small"
                        onClick={() => sendMessage(action.query)}
                        disabled={isSessionLoading}
                        sx={{
                          fontSize: '11px',
                          height: 28,
                          cursor: 'pointer',
                          backgroundColor: TRUIST.mist,
                          color: APP_COLORS.primary,
                          border: `1px solid ${TRUIST.sky}`,
                          fontWeight: 500,
                          '&:hover': { backgroundColor: '#bbdefb' },
                          '& .MuiChip-label': { px: 1.2 },
                        }}
                      />
                    ))}
                  </Box>
                )}
              </Box>

              {/* Divider */}
              <Divider />

              {/* Input Area */}
              <Box sx={{ p: 2.5, backgroundColor: '#fff' }}>
                <Paper sx={{ p: 1.25, borderRadius: 3, border: '1px solid #d9e3ee', boxShadow: '0 8px 24px rgba(20,36,58,0.06)' }}>
                  <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-end' }}>
                    <TextField
                      fullWidth
                      multiline
                      minRows={2}
                      maxRows={6}
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder={agent.placeholder}
                      disabled={isSessionLoading}
                      size="small"
                      variant="outlined"
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          fontSize: '14px',
                          borderRadius: 2.5,
                          backgroundColor: '#fff',
                          minHeight: 72,
                          alignItems: 'flex-start',
                        },
                        '& .MuiOutlinedInput-input': {
                          py: 1.6,
                        },
                      }}
                    />
                    <Button
                      variant="contained"
                      onClick={() => sendMessage()}
                      disabled={isSessionLoading || !input.trim()}
                      sx={{ backgroundColor: agent.color, minWidth: '52px', height: '52px', p: 1, borderRadius: 2.5, '&:hover': { backgroundColor: agent.color, filter: 'brightness(0.92)' } }}
                    >
                      <SendIcon sx={{ fontSize: '20px' }} />
                    </Button>
                  </Box>
                </Paper>
              </Box>
            </>
          ) : (
            <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', px: 3, py: 4 }}>
              <Box sx={{ width: '100%', maxWidth: 760, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2.5 }}>
                <Typography sx={{ fontSize: isCompactFullScreen ? '30px' : '42px', fontWeight: 500, color: '#2f3a45', letterSpacing: '-0.8px', textAlign: 'center' }}>
                  How can I help you today?
                </Typography>
                {sessionLoading && (
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, py: 0.5 }}>
                    <CircularProgress size={14} sx={{ color: '#90a4ae' }} />
                    <Typography sx={{ fontSize: '11px', color: '#90a4ae' }}>Restoring history...</Typography>
                  </Box>
                )}
                <Paper sx={{ width: '100%', p: 1.4, borderRadius: 3.5, border: '1px solid #d9e3ee', boxShadow: '0 10px 32px rgba(20,36,58,0.06)' }}>
                  <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 1.1 }}>
                    <TextField
                      fullWidth
                      multiline
                      minRows={2}
                      maxRows={6}
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder={agent.placeholder}
                      disabled={isSessionLoading}
                      size="small"
                      variant="outlined"
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          fontSize: '15px',
                          borderRadius: 2.5,
                          backgroundColor: '#fff',
                          minHeight: 76,
                          alignItems: 'flex-start',
                        },
                        '& .MuiOutlinedInput-input': {
                          py: 1.75,
                        },
                      }}
                    />
                    <Button
                      variant="contained"
                      onClick={() => sendMessage()}
                      disabled={isSessionLoading || !input.trim()}
                      sx={{ backgroundColor: agent.color, minWidth: '54px', height: '54px', p: 1, borderRadius: 2.5, '&:hover': { backgroundColor: agent.color, filter: 'brightness(0.92)' } }}
                    >
                      <SendIcon sx={{ fontSize: '20px' }} />
                    </Button>
                  </Box>
                </Paper>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, justifyContent: 'center' }}>
                  {quickActions.map((action, idx) => (
                    <Chip
                      key={idx}
                      label={action.label}
                      size="small"
                      onClick={() => sendMessage(action.query)}
                      disabled={loading}
                      sx={{
                        fontSize: '11px',
                        height: 30,
                        cursor: 'pointer',
                        backgroundColor: '#edf4fb',
                        color: '#0f4c81',
                        border: '1px solid #c8dcf2',
                        fontWeight: 600,
                        '&:hover': { backgroundColor: '#dfeffc' },
                        '& .MuiChip-label': { px: 1.4 },
                      }}
                    />
                  ))}
                </Box>
              </Box>
            </Box>
          )}
        </Box>
      </Box>
    )
  }

  return (
    <Paper
      sx={{
        position: 'fixed',
        left: isMobileViewport ? 0 : panelPosition.x,
        top: isMobileViewport ? 0 : panelPosition.y,
        height: isMobileViewport ? '100vh' : panelHeight,
        width: isMobileViewport ? '100%' : panelWidth,
        transition: resizing ? 'none' : 'width 0.22s cubic-bezier(0.4,0,0.2,1), height 0.22s cubic-bezier(0.4,0,0.2,1)',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: isMobileViewport ? '-2px 0 12px rgba(0,0,0,0.18)' : '0 12px 32px rgba(0,0,0,0.22)',
        backgroundColor: '#fff',
        zIndex: 3000,
        borderRadius: isMobileViewport ? 0 : 3,
        overflow: 'hidden',
        userSelect: dragging || resizing ? 'none' : 'auto',
        '@media (max-width: 600px)': {
          width: '100%',
        },
      }}
    >
      {/* Header */}
      <Box
        onMouseDown={handleDragStart}
        sx={{
          backgroundColor: agent.color,
          color: headerTextColor,
          p: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: isMobileViewport ? 'default' : (dragging ? 'grabbing' : 'grab'),
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {renderAgentIcon(20)}
          <Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
              {agent.name}
            </Typography>
            <Typography sx={{ fontSize: '10px', color: headerSubtextColor, lineHeight: 1 }}>
              {agent.subtitle}
            </Typography>
          </Box>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0 }}>
          {messages.length > 1 && (
            <Button
              size="small"
              onClick={resetToMainMenu}
              sx={{
                color: headerTextColor,
                textTransform: 'none',
                fontSize: '12px',
                minWidth: 'auto',
                padding: '4px 8px',
                '&:hover': { backgroundColor: headerActionHover },
              }}
            >
              ↺ Clear
            </Button>
          )}
          <Tooltip title={expanded ? 'Collapse panel' : 'Expand panel'} placement="bottom">
            <IconButton size="small" onClick={() => setExpanded(e => !e)} sx={{ color: headerTextColor }}>
              {expanded ? <CloseFullscreenIcon sx={{ fontSize: 18 }} /> : <OpenInFullIcon sx={{ fontSize: 18 }} />}
            </IconButton>
          </Tooltip>
          <IconButton size="small" onClick={onClose} sx={{ color: headerTextColor }}>
            <CloseIcon />
          </IconButton>
        </Box>
      </Box>

      {/* Messages Area */}
      <Box
        sx={{
          flex: 1,
          overflowY: 'auto',
          p: 1.5,
          backgroundColor: '#fafafa',
          display: 'flex',
          flexDirection: 'column',
          gap: 1.5,
        }}
      >
        {/* Session loading from DynamoDB */}
        {sessionLoading && (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, py: 1 }}>
            <CircularProgress size={14} sx={{ color: '#90a4ae' }} />
            <Typography sx={{ fontSize: '11px', color: '#90a4ae' }}>Restoring history...</Typography>
          </Box>
        )}
        {messages.map((msg, idx) => (
          <Box key={idx} sx={{ display: 'flex', alignItems: 'flex-end', gap: 0.75, justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
            {msg.role === 'agent' && (
              <Box sx={{ width: 26, height: 26, borderRadius: '50%', backgroundColor: agent.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, mb: 0.5 }}>
                {renderAgentIcon(18)}
              </Box>
            )}
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: expanded ? '88%' : '80%' }}>
              <Box sx={{ position: 'relative', '&:hover .msg-copy': { opacity: 1 } }}>
                <Paper
                  sx={{
                    p: 1.5,
                    backgroundColor:
                      msg.role === 'user'
                        ? userBubbleColor
                        : msg.type === 'error'
                          ? '#ffebee'
                          : msg.type === 'success'
                            ? '#e8f5e9'
                            : '#f0f4f8',
                    color: msg.role === 'user' ? userBubbleTextColor : msg.type === 'error' ? '#c62828' : '#333',
                    boxShadow: 'none',
                    border: msg.type === 'error' ? '1px solid #ef5350' : '1px solid transparent',
                    borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                  }}
                >
                  {msg.type === 'table' && msg.data ? (
                    <Box sx={{ overflowX: 'auto', maxHeight: '300px', overflowY: 'auto', position: 'relative' }}>
                      <IconButton
                        size="small"
                        onClick={() => exportDataAsCsv(msg.data)}
                        title="Export as CSV"
                        sx={{ position: 'absolute', top: 2, right: 2, zIndex: 11, color: '#1976d2', backgroundColor: 'rgba(255,255,255,0.8)', '&:hover': { backgroundColor: 'rgba(25,118,210,0.1)' } }}
                      >
                        <FileDownloadIcon sx={{ fontSize: 16 }} />
                      </IconButton>
                      <Table size="small" sx={{ fontSize: '11px' }}>
                        <TableHead sx={{ position: 'sticky', top: 0, zIndex: 10 }}>
                          <TableRow sx={{ backgroundColor: 'rgba(25, 118, 210, 0.1)' }}>
                            {Object.keys(msg.data[0] || {}).map(key => (
                              <TableCell key={key} sx={{ p: 0.75, fontSize: '11px', fontWeight: 600, backgroundColor: 'rgba(25, 118, 210, 0.15)' }}>
                                {key}
                              </TableCell>
                            ))}
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {msg.data.map((row: any, rowIdx: number) => (
                            <TableRow key={rowIdx} sx={{ '&:hover': { backgroundColor: 'rgba(25, 118, 210, 0.05)' } }}>
                              {Object.values(row).map((val: any, colIdx) => (
                                <TableCell key={colIdx} sx={{ p: 0.75, fontSize: '11px' }}>
                                  {expanded ? String(val) : String(val).substring(0, 40)}
                                </TableCell>
                              ))}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </Box>
                  ) : msg.role === 'agent' ? (
                    <FormattedMessage
                      text={msg.content}
                      color={msg.type === 'error' ? '#c62828' : msg.type === 'success' ? '#2e7d32' : '#333'}
                    />
                  ) : (
                    <Typography variant="body2" sx={{ fontSize: '13px', lineHeight: 1.4 }}>
                      {msg.content}
                    </Typography>
                  )}
                </Paper>
                {msg.role === 'agent' && !msg.data && (
                  <Tooltip title={copiedIdx === idx ? 'Copied!' : 'Copy'} placement="right">
                    <IconButton
                      className="msg-copy"
                      size="small"
                      onClick={() => {
                        navigator.clipboard.writeText(msg.content)
                        setCopiedIdx(idx)
                        setTimeout(() => setCopiedIdx(null), 2000)
                      }}
                      sx={{ position: 'absolute', top: -4, right: -30, opacity: 0, transition: 'opacity 0.15s', p: '3px', backgroundColor: '#fff', boxShadow: '0 1px 4px rgba(0,0,0,0.15)', borderRadius: '50%', '&:hover': { backgroundColor: '#f5f5f5' } }}
                    >
                      <ContentCopyIcon sx={{ fontSize: 11, color: copiedIdx === idx ? '#4caf50' : '#999' }} />
                    </IconButton>
                  </Tooltip>
                )}
              </Box>
              {msg.timestamp && (
                <Typography sx={{ fontSize: '10px', color: '#bbb', mt: 0.3, px: 0.5 }}>
                  {formatTime(msg.timestamp)}
                </Typography>
              )}
              {msg.suggestedActions && msg.suggestedActions.length > 0 && (
                <Box sx={{ display: 'flex', gap: 0.6, flexWrap: 'wrap', mt: 0.8, width: '100%' }}>
                  {msg.suggestedActions.map((action, aIdx) => (
                    <Button
                      key={aIdx}
                      size="small"
                      variant="contained"
                      onClick={() => {
                        if (action.action === 'restart_service') {
                          sendMessage('Restart the DataOps service')
                        } else if (action.action === 'terminate_service') {
                          const termMsg: Message = {
                            role: 'agent',
                            content: 'Service terminated. You can restart it when you are ready.',
                            type: 'success',
                            timestamp: Date.now(),
                            suggestedActions: [
                              { label: '▶️ Restart Service', action: 'restart_service' }
                            ]
                          }
                          setMessages(prev => [...prev, termMsg])
                        } else {
                          sendMessage(action.action)
                        }
                      }}
                      disabled={isSessionLoading}
                      sx={{
                        fontSize: '11px',
                        fontWeight: 500,
                        textTransform: 'none',
                        padding: '5px 10px',
                        backgroundColor:
                          action.action === 'restart_service' ? TRUIST.dusk :
                          action.action === 'terminate_service' ? TRUIST.charcoal :
                          APP_COLORS.primary,
                        color: '#fff',
                        border: 'none',
                        borderRadius: '3px',
                        cursor: 'pointer',
                        '&:hover': {
                          backgroundColor:
                            action.action === 'restart_service' ? TRUIST.darkGray :
                            action.action === 'terminate_service' ? TRUIST.purple :
                            TRUIST.dusk,
                          boxShadow: '0 2px 6px rgba(0,0,0,0.2)'
                        },
                        '&:disabled': { opacity: 0.6, cursor: 'not-allowed' },
                        transition: 'all 0.2s ease',
                      }}
                    >
                      {action.label}
                    </Button>
                  ))}
                </Box>
              )}
            </Box>
            {msg.role === 'user' && (
              <Box sx={{ width: 26, height: 26, borderRadius: '50%', backgroundColor: '#e8eaf6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, mb: 0.5 }}>
                <PersonIcon sx={{ fontSize: 14, color: '#3f51b5' }} />
              </Box>
            )}
          </Box>
        ))}

        {isSessionLoading && (
          <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 0.75 }}>
            <Box sx={{ width: 26, height: 26, borderRadius: '50%', backgroundColor: agent.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              {renderAgentIcon(18)}
            </Box>
            <Paper sx={{ p: 1.5, backgroundColor: '#f0f4f8', boxShadow: 'none', borderRadius: '16px 16px 16px 4px', border: '1px solid transparent' }}>
              <TypingDots />
            </Paper>
          </Box>
        )}

        <div ref={messagesEndRef} />
      </Box>

      {/* Collapsible Quick Actions */}
      <Box sx={{ borderTop: '1px solid #f0f0f0', flexShrink: 0, backgroundColor: '#fff' }}>
        <Box
          onClick={() => setShowQuickActions(v => !v)}
          sx={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            px: 1.5, py: 0.5, cursor: 'pointer',
            '&:hover': { backgroundColor: '#f9f9f9' },
          }}
        >
          <Typography sx={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: '#78909c' }}>
            Quick Actions
          </Typography>
          {showQuickActions
            ? <ExpandLessIcon sx={{ fontSize: 16, color: '#90a4ae' }} />
            : <ExpandMoreIcon sx={{ fontSize: 16, color: '#90a4ae' }} />
          }
        </Box>
        {showQuickActions && (
          <Box sx={{ px: 1.5, pb: 0.75, display: 'flex', gap: 0.6, flexWrap: 'wrap' }}>
            {quickActions.map((action, idx) => (
              <Chip
                key={idx}
                label={action.label}
                size="small"
                onClick={() => sendMessage(action.query)}
                disabled={isSessionLoading}
                sx={{
                  fontSize: '11px',
                  height: 26,
                  cursor: 'pointer',
                  backgroundColor: '#e3f2fd',
                  color: '#1565c0',
                  border: '1px solid #bbdefb',
                  fontWeight: 500,
                  '&:hover': { backgroundColor: '#bbdefb' },
                  '& .MuiChip-label': { px: 1 },
                }}
              />
            ))}
          </Box>
        )}
      </Box>

      {/* Divider */}
      <Divider />

      {/* Input Area */}
      <Box sx={{ p: 1.5, backgroundColor: '#fff' }}>
        <Paper sx={{ p: 1.1, borderRadius: 3, border: '1px solid #d9e3ee', boxShadow: '0 8px 24px rgba(20,36,58,0.06)' }}>
          <Box sx={{ display: 'flex', gap: 0.9, alignItems: 'flex-end' }}>
            <Box sx={{ flex: 1, position: 'relative' }}>
              <TextField
                fullWidth
                multiline
                minRows={2}
                maxRows={6}
                value={input}
                onChange={(e) => { setInput(e.target.value); setHistoryIdx(-1) }}
                onKeyDown={handleKeyDown}
                placeholder={agent.placeholder}
                disabled={loading}
                size="small"
                variant="outlined"
                sx={{
                  '& .MuiOutlinedInput-root': {
                    fontSize: '14px',
                    borderRadius: 2.5,
                    minHeight: 72,
                    alignItems: 'flex-start',
                  },
                  '& .MuiOutlinedInput-input': {
                    py: 1.5,
                  },
                }}
              />
              {input.length > 60 && (
                <Typography sx={{ position: 'absolute', bottom: 8, right: 14, fontSize: '10px', color: input.length > 500 ? '#e53935' : '#9aa5b1', pointerEvents: 'none' }}>
                  {input.length}
                </Typography>
              )}
            </Box>
            <Tooltip title={input.trim() ? 'Send (Enter)' : 'Type a message'}>
              <span>
                <Button
                  variant="contained"
                  onClick={() => sendMessage()}
                  disabled={isSessionLoading || !input.trim()}
                  sx={{
                    backgroundColor: agent.color,
                    minWidth: '52px',
                    height: '52px',
                    p: 0.75,
                    borderRadius: 2.5,
                    '&:hover': { backgroundColor: agent.color, filter: 'brightness(0.9)' },
                  }}
                >
                  <SendIcon sx={{ fontSize: '20px' }} />
                </Button>
              </span>
            </Tooltip>
          </Box>
        </Paper>
        <Typography sx={{ fontSize: '10px', color: '#b0b8c4', mt: 0.6, textAlign: 'center' }}>
          Enter to send · Shift+Enter for new line · ↑↓ history
        </Typography>
      </Box>

      {!fullScreen && !isMobileViewport && (
        <>
          <Box onMouseDown={handleResizeStart('top')} sx={{ position: 'absolute', top: 0, left: 10, right: 10, height: 8, cursor: 'ns-resize' }} />
          <Box onMouseDown={handleResizeStart('right')} sx={{ position: 'absolute', top: 10, right: 0, bottom: 10, width: 8, cursor: 'ew-resize' }} />
          <Box onMouseDown={handleResizeStart('bottom')} sx={{ position: 'absolute', left: 10, right: 10, bottom: 0, height: 8, cursor: 'ns-resize' }} />
          <Box onMouseDown={handleResizeStart('left')} sx={{ position: 'absolute', top: 10, left: 0, bottom: 10, width: 8, cursor: 'ew-resize' }} />

          <Box onMouseDown={handleResizeStart('top-left')} sx={{ position: 'absolute', top: 0, left: 0, width: 12, height: 12, cursor: 'nwse-resize' }} />
          <Box onMouseDown={handleResizeStart('top-right')} sx={{ position: 'absolute', top: 0, right: 0, width: 12, height: 12, cursor: 'nesw-resize' }} />
          <Box onMouseDown={handleResizeStart('bottom-left')} sx={{ position: 'absolute', bottom: 0, left: 0, width: 12, height: 12, cursor: 'nesw-resize' }} />
          <Box
            onMouseDown={handleResizeStart('bottom-right')}
            sx={{
              position: 'absolute',
              right: 0,
              bottom: 0,
              width: 14,
              height: 14,
              cursor: 'nwse-resize',
              borderRight: '2px solid #90a4ae',
              borderBottom: '2px solid #90a4ae',
              borderRadius: '0 0 4px 0',
              opacity: 0.8,
              '&:hover': { opacity: 1, borderColor: '#607d8b' },
            }}
          />
        </>
      )}
    </Paper>
  )
}
