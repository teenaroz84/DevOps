import React, { useState, useRef, useEffect } from 'react'
import {
  Box,
  Paper,
  TextField,
  Button,
  Typography,
  Divider,
  CircularProgress,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
} from '@mui/material'
import SendIcon from '@mui/icons-material/Send'
import CloseIcon from '@mui/icons-material/Close'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import SmartToyIcon from '@mui/icons-material/SmartToy'
import FileDownloadIcon from '@mui/icons-material/FileDownload'
import { chatService } from '../../services'
import { sessionStore } from '../../services/sessionStore'
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

interface Message {
  role: 'user' | 'agent'
  content: string
  type?: 'status' | 'error' | 'success' | 'info' | 'table'
  data?: any
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
}

const WELCOME_MESSAGE: Message = {
  role: 'agent',
  content: '👋 Hi! I\'m your DataOps Knowledge Assistant. Ask me about DMF ingestion, enrichment standards, ESP scheduling, Talend development, or any other platform guidelines.',
  type: 'info',
}

export function ChatPanel({ isOpen, onClose, fullScreen = false }: ChatPanelProps) {
  const [input, setInput] = useState('')

  // Restore chat history from localStorage on first mount
  const [messages, setMessages] = useState<Message[]>(() => {
    const saved = sessionStore.getChat().history
    return saved && saved.length > 0 ? (saved as Message[]) : [WELCOME_MESSAGE]
  })

  const [loading, setLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Persist history whenever messages change (skip welcome-only state)
  useEffect(() => {
    if (messages.length > 1 || messages[0]?.content !== WELCOME_MESSAGE.content) {
      sessionStore.setChat({
        history: messages.map(({ role, content }) => ({ role, content })),
      })
    }
  }, [messages])

  const HEALTH_CHECK_QUERY = '__health_check__'

  const quickActions = [
    { label: '🩺 Agent Health Check', query: HEALTH_CHECK_QUERY },
    { label: '📁 DMF Ingestion Directory Structure', query: 'What is the DMF ingestion directory structure?' },
    { label: '🔧 DMF Enrichment Standards', query: 'What are the DMF enrichment standards?' },
    { label: '⏱ DMF ESP Scheduling Standards', query: 'What are the DMF ESP scheduling standards?' },
    { label: '📘 Talend Dev Guide', query: 'Provide the Talend development guide and best practices.' },
  ]

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = async (messageText?: string) => {
    const textToSend = messageText || input
    if (!textToSend.trim()) return

    const isHealthCheck = textToSend === HEALTH_CHECK_QUERY
    const userMessage: Message = { role: 'user', content: isHealthCheck ? '🩺 Agent Health Check' : textToSend }
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
        }])
      } else {
        const data = await chatService.sendMessage(textToSend)
        sessionStore.setChat({ lastAgentId: 'default' })
        const agentResponse: Message = {
          role: 'agent',
          content: data.text || '(No response)',
          type: data.type as Message['type'],
          data: data.data,
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
        suggestedActions: [{ label: '🔄 Retry', action: textToSend }],
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setLoading(false)
    }
  }

  

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const resetToMainMenu = () => {
    sessionStore.clearChatHistory()
    setMessages([WELCOME_MESSAGE])
    setInput('')
  }

  // Get the last message with data
  const lastMessageWithData = [...messages].reverse().find(msg => msg.data)

  if (!isOpen && !fullScreen) return null

  if (fullScreen) {
    // Full-screen split layout
    return (
      <Box sx={{ display: 'flex', height: '100vh', backgroundColor: '#fff' }}>
        {/* Left Side - Chat */}
        <Box
          sx={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            borderRight: '1px solid #e0e0e0',
          }}
        >
          {/* Header */}
          <Box
            sx={{
              backgroundColor: '#1976d2',
              color: '#fff',
              p: 2.5,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <SmartToyIcon />
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                DataOps Assistant
              </Typography>
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
                  ↺ Main Menu
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
            {messages.length <= 1 && (
              <Box>
                <Typography variant="caption" sx={{ color: '#999', fontSize: '12px', display: 'block', mb: 1.5 }}>
                  Quick actions:
                </Typography>
                {quickActions.map((action, idx) => (
                  <Button
                    key={idx}
                    fullWidth
                    variant="outlined"
                    size="small"
                    onClick={() => sendMessage(action.query)}
                    sx={{
                      mb: 1,
                      justifyContent: 'flex-start',
                      textTransform: 'none',
                      color: '#1976d2',
                      borderColor: '#e0e0e0',
                      fontSize: '13px',
                      '&:hover': { backgroundColor: '#f0f0f0' },
                    }}
                  >
                    → {action.label}
                  </Button>
                ))}
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
              <Box sx={{ display: 'flex', justifyContent: 'flex-start' }}>
                <CircularProgress size={24} />
              </Box>
            )}

            <div ref={messagesEndRef} />
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
              onKeyPress={handleKeyPress}
              placeholder="Ask about DMF, ESP, Talend, ingestion standards..."
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
              sx={{ backgroundColor: '#1976d2', minWidth: '44px', height: '44px', p: 1 }}
            >
              <SendIcon sx={{ fontSize: '18px' }} />
            </Button>
          </Box>
        </Box>

        {/* Right Side - Results */}
        <Box
          sx={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: '#f5f5f5',
            overflow: 'hidden',
          }}
        >
          {lastMessageWithData ? (
            <>
              <Box sx={{ p: 2.5, borderBottom: '1px solid #e0e0e0', backgroundColor: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#1976d2' }}>
                  Results
                </Typography>
                {lastMessageWithData.data && lastMessageWithData.data.length > 0 && (
                  <IconButton
                    size="small"
                    onClick={() => exportDataAsCsv(lastMessageWithData.data)}
                    title="Export as CSV"
                    sx={{ color: '#1976d2', '&:hover': { backgroundColor: 'rgba(25,118,210,0.08)' } }}
                  >
                    <FileDownloadIcon sx={{ fontSize: 20 }} />
                  </IconButton>
                )}
              </Box>
              <Box sx={{ flex: 1, overflowY: 'auto', p: 2.5 }}>
                <Paper sx={{ p: 2, backgroundColor: '#fff' }}>
                  <Typography variant="body2" sx={{ mb: 2, color: '#666', fontSize: '13px' }}>
                    {lastMessageWithData.content}
                  </Typography>
                  {lastMessageWithData.data && lastMessageWithData.data.length > 0 && (
                    <Box sx={{ overflowX: 'auto' }}>
                      <Table size="small">
                        <TableHead>
                          <TableRow sx={{ backgroundColor: '#f5f5f5' }}>
                            {Object.keys(lastMessageWithData.data[0] || {}).map(key => (
                              <TableCell key={key} sx={{ fontSize: '12px', fontWeight: 600, py: 1 }}>
                                {key}
                              </TableCell>
                            ))}
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {lastMessageWithData.data.map((row: any, rowIdx: number) => (
                            <TableRow key={rowIdx} sx={{ '&:hover': { backgroundColor: '#f9f9f9' } }}>
                              {Object.values(row).map((val: any, colIdx) => (
                                <TableCell key={colIdx} sx={{ fontSize: '12px', py: 1 }}>
                                  {String(val).substring(0, 30)}
                                </TableCell>
                              ))}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </Box>
                  )}
                </Paper>
              </Box>
            </>
          ) : (
            <Box
              sx={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#999',
              }}
            >
              <Typography variant="body2" sx={{ textAlign: 'center' }}>
                Results will appear here
              </Typography>
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
        right: 0,
        top: 0,
        height: '100vh',
        width: 400,
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '-2px 0 8px rgba(0,0,0,0.15)',
        backgroundColor: '#fff',
        zIndex: 3000,
        '@media (max-width: 600px)': {
          width: '100%',
        },
      }}
    >
      {/* Header */}
      <Box
        sx={{
          backgroundColor: '#1976d2',
          color: '#fff',
          p: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <SmartToyIcon />
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
            DataOps Assistant
          </Typography>
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
              ↺ Menu
            </Button>
          )}
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
          p: 2,
          backgroundColor: '#fafafa',
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
        }}
      >
        {messages.length <= 1 && (
          <Box>
            <Typography variant="caption" sx={{ color: '#999', fontSize: '12px', display: 'block', mb: 1.5 }}>
              Quick actions:
            </Typography>
            {quickActions.map((action, idx) => (
              <Button
                key={idx}
                fullWidth
                variant="outlined"
                size="small"
                onClick={() => sendMessage(action.query)}
                sx={{
                  mb: 1,
                  justifyContent: 'flex-start',
                  textTransform: 'none',
                  color: '#1976d2',
                  borderColor: '#e0e0e0',
                  fontSize: '13px',
                  '&:hover': { backgroundColor: '#f0f0f0' },
                }}
              >
                → {action.label}
              </Button>
            ))}
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
                              {String(val).substring(0, 25)}
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
        ))}

        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'flex-start' }}>
            <CircularProgress size={24} />
          </Box>
        )}

        <div ref={messagesEndRef} />
      </Box>

      {/* Divider */}
      <Divider />

      {/* Input Area */}
      <Box sx={{ p: 2, backgroundColor: '#fff', display: 'flex', gap: 1 }}>
        <TextField
          fullWidth
          multiline
          maxRows={3}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Ask about DMF, ESP, Talend, ingestion standards..."
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
          sx={{
            backgroundColor: '#1976d2',
            minWidth: '44px',
            height: '44px',
            p: 1,
          }}
        >
          <SendIcon sx={{ fontSize: '18px' }} />
        </Button>
      </Box>
    </Paper>
  )
}
