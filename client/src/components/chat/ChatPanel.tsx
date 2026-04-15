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
} from '@mui/material'
import SendIcon from '@mui/icons-material/Send'
import CloseIcon from '@mui/icons-material/Close'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import SmartToyIcon from '@mui/icons-material/SmartToy'
import FileDownloadIcon from '@mui/icons-material/FileDownload'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import PersonIcon from '@mui/icons-material/Person'
import OpenInFullIcon from '@mui/icons-material/OpenInFull'
import CloseFullscreenIcon from '@mui/icons-material/CloseFullscreen'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
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

interface ChatPanelProps {
  isOpen: boolean
  onClose: () => void
  fullScreen?: boolean
  /** When provided, the panel operates as a dashboard-specific agent */
  agentConfig?: AgentConfig
}

const DEFAULT_WELCOME: Message = {
  role: 'agent',
  content: '👋 Hi! I\'m your DataOps Knowledge Assistant. Ask me about DMF ingestion, enrichment standards, ESP scheduling, Talend development, or any other platform guidelines.',
  type: 'info',
}

export function ChatPanel({ isOpen, onClose, fullScreen = false, agentConfig }: ChatPanelProps) {
  const PANEL_MARGIN = 24
  // Resolved config — fall back to global knowledge agent
  const agent: AgentConfig = agentConfig ?? AGENTS.knowledge
  const [input, setInput] = useState('')
  const [expanded, setExpanded] = useState(false)
  const [showQuickActions, setShowQuickActions] = useState(true)
  const [panelPosition, setPanelPosition] = useState({ x: PANEL_MARGIN, y: PANEL_MARGIN })
  const [dragging, setDragging] = useState(false)
  const dragRef = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null)

  const WELCOME_MESSAGE: Message = React.useMemo(() => ({
    role: 'agent',
    content: agentConfig ? agentConfig.welcomeMessage : DEFAULT_WELCOME.content,
    type: 'info',
  }), [agentConfig])

  const STORAGE_KEY = `chat_history_${agent.id}`

  // ── Session state ────────────────────────────────────────────────────────
  // Start with localStorage for instant paint, then hydrate from DynamoDB.
  const [messages, setMessages] = useState<Message[]>(() => {
    try {
      const saved = localStorage.getItem(`chat_history_${agent.id}`)
      if (saved) {
        const parsed = JSON.parse(saved) as Message[]
        return [WELCOME_MESSAGE, ...parsed.slice(1)]
      }
    } catch {
      // corrupted data — fall through
    }
    return [WELCOME_MESSAGE]
  })
  const [sessionLoading, setSessionLoading] = useState(false)

  // Load DynamoDB session for the current agent
  const loadAgentSession = useCallback(async (agentId: string, welcome: Message) => {
    setSessionLoading(true)
    try {
      const remote = await chatService.loadSession(agentId)
      if (remote.length > 0) {
        const typed = remote.map(m => ({
          ...m,
          type: m.type as Message['type'],
        })) as Message[]
        setMessages([welcome, ...typed.slice(1)])
        // Sync to localStorage so next mount is instant
        localStorage.setItem(`chat_history_${agentId}`, JSON.stringify([welcome, ...typed.slice(1)]))
      } else {
        // Nothing in DynamoDB yet — keep whatever was in localStorage
        setMessages(prev => prev.length > 0 ? prev : [welcome])
      }
    } catch {
      // DynamoDB unreachable — keep localStorage version
    } finally {
      setSessionLoading(false)
    }
  }, [])

  // When the agent changes, reload the correct history and welcome message
  useEffect(() => {
    // Immediately paint localStorage version
    try {
      const saved = localStorage.getItem(`chat_history_${agent.id}`)
      if (saved) {
        const parsed = JSON.parse(saved) as Message[]
        setMessages([WELCOME_MESSAGE, ...parsed.slice(1)])
      } else {
        setMessages([WELCOME_MESSAGE])
      }
    } catch {
      setMessages([WELCOME_MESSAGE])
    }
    // Then hydrate from DynamoDB in the background
    loadAgentSession(agent.id, WELCOME_MESSAGE)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agent.id])

  const [loading, setLoading] = useState(false)
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null)
  const [inputHistory, setInputHistory] = useState<string[]>([])
  const [historyIdx, setHistoryIdx] = useState(-1)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const isMobileViewport = !fullScreen && typeof window !== 'undefined' && window.innerWidth <= 600
  const panelWidth = isMobileViewport ? (typeof window !== 'undefined' ? window.innerWidth : 440) : (expanded ? 760 : 440)
  const panelHeight = isMobileViewport
    ? (typeof window !== 'undefined' ? window.innerHeight : 0)
    : (typeof window !== 'undefined' ? Math.min(window.innerHeight - PANEL_MARGIN * 2, 820) : 780)

  const clampPanelPosition = useCallback((x: number, y: number) => {
    if (typeof window === 'undefined' || isMobileViewport) return { x: 0, y: 0 }
    const maxX = Math.max(PANEL_MARGIN, window.innerWidth - panelWidth - PANEL_MARGIN)
    const maxY = Math.max(PANEL_MARGIN, window.innerHeight - panelHeight - PANEL_MARGIN)
    return {
      x: Math.min(Math.max(PANEL_MARGIN, x), maxX),
      y: Math.min(Math.max(PANEL_MARGIN, y), maxY),
    }
  }, [isMobileViewport, panelHeight, panelWidth])

  useEffect(() => {
    if (typeof window === 'undefined' || fullScreen) return
    if (isMobileViewport) {
      setPanelPosition({ x: 0, y: 0 })
      return
    }
    setPanelPosition(prev => {
      const defaultX = window.innerWidth - panelWidth - PANEL_MARGIN
      const defaultY = Math.max(PANEL_MARGIN, Math.round((window.innerHeight - panelHeight) / 2))
      if (prev.x === PANEL_MARGIN && prev.y === PANEL_MARGIN) {
        return clampPanelPosition(defaultX, defaultY)
      }
      return clampPanelPosition(prev.x, prev.y)
    })
  }, [clampPanelPosition, fullScreen, isMobileViewport, panelHeight, panelWidth])

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

  // Persist to localStorage + DynamoDB whenever messages change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages))
    } catch {
      // storage quota exceeded — ignore
    }
    // Skip DynamoDB sync while the initial load is still in flight
    if (!sessionLoading) {
      chatService.saveSession(agent.id, messages)
    }
  }, [messages, STORAGE_KEY, agent.id, sessionLoading])

  const HEALTH_CHECK_QUERY = '__health_check__'

  const quickActions = agent.quickActions

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = async (messageText?: string) => {
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
        const data = await chatService.sendMessage(textToSend, agent.endpoint)
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
    localStorage.removeItem(STORAGE_KEY)
    chatService.clearSession(agent.id)
    setMessages([WELCOME_MESSAGE])
    setInput('')
  }

  // Get the last message with data
  if (!isOpen && !fullScreen) return null

  if (fullScreen) {
    // Full-screen chat layout — results panel hidden
    return (
      <Box sx={{ display: 'flex', height: '100vh', backgroundColor: '#fff' }}>
        {/* Chat — full width */}
        <Box
          sx={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Header */}
          <Box
            sx={{
              backgroundColor: agent.color,
              color: '#fff',
              p: 2.5,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <SmartToyIcon />
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
                  {agent.name}
                </Typography>
                <Typography sx={{ fontSize: '11px', opacity: 0.8, lineHeight: 1 }}>
                  {agent.subtitle}
                </Typography>
              </Box>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              {messages.length > 1 && (
                <Button
                  size="small"
                  onClick={resetToMainMenu}
                  sx={{
                    color: '#fff',
                    textTransform: 'none',
                    fontSize: '13px',
                    '&:hover': { backgroundColor: 'rgba(255,255,255,0.1)' },
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
                  color: '#fff',
                  textTransform: 'none',
                  fontSize: '13px',
                  fontWeight: 600,
                  border: '1px solid rgba(255,255,255,0.4)',
                  borderRadius: 1.5,
                  px: 1.5,
                  '&:hover': { backgroundColor: 'rgba(255,255,255,0.15)', borderColor: '#fff' },
                }}
              >
                Back to Dashboard
              </Button>
            </Box>
          </Box>

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
                <Typography sx={{ fontSize: '11px', color: '#90a4ae' }}>Restoring history…</Typography>
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
                        ? '#1976d2'
                        : msg.type === 'error'
                          ? '#ffebee'
                          : msg.type === 'success'
                            ? '#e8f5e9'
                            : '#f5f5f5',
                    color: msg.role === 'user' ? '#fff' : msg.type === 'error' ? '#c62828' : '#333',
                    boxShadow: 'none',
                    border: msg.type === 'error' ? '1px solid #ef5350' : 'none',
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
                        sx={{ ml: 1, color: '#1976d2', '&:hover': { backgroundColor: 'rgba(25,118,210,0.08)' } }}
                      >
                        <FileDownloadIcon sx={{ fontSize: 18 }} />
                      </IconButton>
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
                        disabled={loading}
                        sx={{
                          fontSize: '12px',
                          fontWeight: 500,
                          textTransform: 'none',
                          padding: '6px 12px',
                          backgroundColor: 
                            action.action === 'restart_service' ? '#4caf50' :
                            action.action === 'terminate_service' ? '#ef5350' :
                            msg.type === 'error' ? '#ef5350' : 
                            msg.type === 'success' ? '#4caf50' : '#1976d2',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          '&:hover': { 
                            backgroundColor: 
                              action.action === 'restart_service' ? '#388e3c' :
                              action.action === 'terminate_service' ? '#d32f2f' :
                              msg.type === 'error' ? '#d32f2f' : 
                              msg.type === 'success' ? '#388e3c' : '#1565c0',
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

            {loading && (
              <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 0.75 }}>
                <Box sx={{ width: 26, height: 26, borderRadius: '50%', backgroundColor: '#1976d2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <SmartToyIcon sx={{ fontSize: 14, color: '#fff' }} />
                </Box>
                <Paper sx={{ p: 1.5, backgroundColor: '#f0f4f8', boxShadow: 'none', borderRadius: '16px 16px 16px 4px', border: '1px solid transparent' }}>
                  <TypingDots />
                </Paper>
              </Box>
            )}

            <div ref={messagesEndRef} />
          </Box>

          {/* Quick Actions Strip */}
          <Box sx={{ px: 2.5, py: 1.25, backgroundColor: '#fff', borderTop: '1px solid #f0f0f0', flexShrink: 0 }}>
            <Typography sx={{ color: '#78909c', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', mb: 0.75 }}>
              Quick Actions
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
              {quickActions.map((action, idx) => (
                <Chip
                  key={idx}
                  label={action.label}
                  size="small"
                  onClick={() => sendMessage(action.query)}
                  disabled={loading}
                  sx={{
                    fontSize: '11px',
                    height: 28,
                    cursor: 'pointer',
                    backgroundColor: '#e3f2fd',
                    color: '#1565c0',
                    border: '1px solid #bbdefb',
                    fontWeight: 500,
                    '&:hover': { backgroundColor: '#bbdefb' },
                    '& .MuiChip-label': { px: 1.2 },
                  }}
                />
              ))}
            </Box>
          </Box>

          {/* Divider */}
          <Divider />

          {/* Input Area */}
          <Box sx={{ p: 2.5, backgroundColor: '#fff', display: 'flex', gap: 1 }}>
            <TextField
              fullWidth
              multiline
              maxRows={3}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={agent.placeholder}
              disabled={loading}
              size="small"
              variant="outlined"
              sx={{
                '& .MuiOutlinedInput-root': {
                  fontSize: '13px',
                  borderRadius: 1,
                },
              }}
            />
            <Button
              variant="contained"
              onClick={() => sendMessage()}
              disabled={loading || !input.trim()}
              sx={{ backgroundColor: agent.color, minWidth: '44px', height: '44px', p: 1 }}
            >
              <SendIcon sx={{ fontSize: '18px' }} />
            </Button>
          </Box>
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
        transition: 'width 0.22s cubic-bezier(0.4,0,0.2,1)',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: isMobileViewport ? '-2px 0 12px rgba(0,0,0,0.18)' : '0 12px 32px rgba(0,0,0,0.22)',
        backgroundColor: '#fff',
        zIndex: 3000,
        borderRadius: isMobileViewport ? 0 : 3,
        overflow: 'hidden',
        userSelect: dragging ? 'none' : 'auto',
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
          color: '#fff',
          p: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: isMobileViewport ? 'default' : (dragging ? 'grabbing' : 'grab'),
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <SmartToyIcon sx={{ flexShrink: 0 }} />
          <Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
              {agent.name}
            </Typography>
            <Typography sx={{ fontSize: '10px', opacity: 0.8, lineHeight: 1 }}>
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
                color: '#fff',
                textTransform: 'none',
                fontSize: '12px',
                minWidth: 'auto',
                padding: '4px 8px',
                '&:hover': { backgroundColor: 'rgba(255,255,255,0.1)' },
              }}
            >
              ↺ Clear
            </Button>
          )}
          <Tooltip title={expanded ? 'Collapse panel' : 'Expand panel'} placement="bottom">
            <IconButton size="small" onClick={() => setExpanded(e => !e)} sx={{ color: '#fff' }}>
              {expanded ? <CloseFullscreenIcon sx={{ fontSize: 18 }} /> : <OpenInFullIcon sx={{ fontSize: 18 }} />}
            </IconButton>
          </Tooltip>
          <IconButton size="small" onClick={onClose} sx={{ color: '#fff' }}>
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
            <Typography sx={{ fontSize: '11px', color: '#90a4ae' }}>Restoring history…</Typography>
          </Box>
        )}
        {messages.map((msg, idx) => (
          <Box key={idx} sx={{ display: 'flex', alignItems: 'flex-end', gap: 0.75, justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
            {msg.role === 'agent' && (
              <Box sx={{ width: 26, height: 26, borderRadius: '50%', backgroundColor: agent.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, mb: 0.5 }}>
                <SmartToyIcon sx={{ fontSize: 14, color: '#fff' }} />
              </Box>
            )}
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: expanded ? '88%' : '80%' }}>
              <Box sx={{ position: 'relative', '&:hover .msg-copy': { opacity: 1 } }}>
                <Paper
                  sx={{
                    p: 1.5,
                    backgroundColor:
                      msg.role === 'user'
                        ? agent.color
                        : msg.type === 'error'
                          ? '#ffebee'
                          : msg.type === 'success'
                            ? '#e8f5e9'
                            : '#f0f4f8',
                    color: msg.role === 'user' ? '#fff' : msg.type === 'error' ? '#c62828' : '#333',
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
                      disabled={loading}
                      sx={{
                        fontSize: '11px',
                        fontWeight: 500,
                        textTransform: 'none',
                        padding: '5px 10px',
                        backgroundColor:
                          action.action === 'restart_service' ? '#4caf50' :
                          action.action === 'terminate_service' ? '#ef5350' :
                          msg.type === 'error' ? '#ef5350' :
                          msg.type === 'success' ? '#4caf50' : '#1976d2',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '3px',
                        cursor: 'pointer',
                        '&:hover': {
                          backgroundColor:
                            action.action === 'restart_service' ? '#388e3c' :
                            action.action === 'terminate_service' ? '#d32f2f' :
                            msg.type === 'error' ? '#d32f2f' :
                            msg.type === 'success' ? '#388e3c' : '#1565c0',
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

        {loading && (
          <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 0.75 }}>
            <Box sx={{ width: 26, height: 26, borderRadius: '50%', backgroundColor: agent.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <SmartToyIcon sx={{ fontSize: 14, color: '#fff' }} />
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
                disabled={loading}
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
      <Box sx={{ p: 1.25, backgroundColor: '#fff' }}>
        <Box sx={{ display: 'flex', gap: 0.75, alignItems: 'flex-end' }}>
          <Box sx={{ flex: 1, position: 'relative' }}>
            <TextField
              fullWidth
              multiline
              maxRows={4}
              value={input}
              onChange={(e) => { setInput(e.target.value); setHistoryIdx(-1) }}
              onKeyDown={handleKeyDown}
              placeholder={agent.placeholder}
              disabled={loading}
              size="small"
              variant="outlined"
              sx={{
                '& .MuiOutlinedInput-root': {
                  fontSize: '13px',
                  borderRadius: 2.5,
                },
              }}
            />
            {input.length > 60 && (
              <Typography sx={{ position: 'absolute', bottom: 6, right: 12, fontSize: '10px', color: input.length > 500 ? '#e53935' : '#bbb', pointerEvents: 'none' }}>
                {input.length}
              </Typography>
            )}
          </Box>
          <Tooltip title={input.trim() ? 'Send (Enter)' : 'Type a message'}>
            <span>
              <Button
                variant="contained"
                onClick={() => sendMessage()}
                disabled={loading || !input.trim()}
                sx={{
                  backgroundColor: agent.color,
                  minWidth: '40px',
                  height: '40px',
                  p: 0.75,
                  borderRadius: 2.5,
                  '&:hover': { backgroundColor: agent.color, filter: 'brightness(0.9)' },
                }}
              >
                <SendIcon sx={{ fontSize: '18px' }} />
              </Button>
            </span>
          </Tooltip>
        </Box>
        <Typography sx={{ fontSize: '10px', color: '#ccc', mt: 0.5, textAlign: 'center' }}>
          Enter to send · Shift+Enter for new line · ↑↓ history
        </Typography>
      </Box>
    </Paper>
  )
}
