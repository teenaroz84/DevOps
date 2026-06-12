import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import AutorenewIcon from '@mui/icons-material/Autorenew'
import SendIcon from '@mui/icons-material/Send'
import { getAuthenticatedUserId } from '../../services/auth'
import { SESSION_ID } from '../../services/session'
import {
  healthCheckService,
  type HealthCheckWorkflowMessage,
  type HealthCheckWorkflowState,
} from '../../services/healthCheckService'
import { APP_COLORS, TRUIST } from '../../theme/truistPalette'

const STORAGE_KEY = 'dataops:health-check:session-id'

function createWorkflowSessionId(): string {
  try {
    return `health-check-${crypto.randomUUID()}`
  } catch {
    return `health-check-${Date.now()}-${Math.round(Math.random() * 1_000_000)}`
  }
}

function getWorkflowSessionId(): string {
  if (typeof window === 'undefined') return createWorkflowSessionId()

  const existing = window.localStorage.getItem(STORAGE_KEY)
  if (existing) return existing

  const next = createWorkflowSessionId()
  window.localStorage.setItem(STORAGE_KEY, next)
  return next
}

function formatTimestamp(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function stageLabel(stage: HealthCheckWorkflowState['stage'] | undefined): string {
  if (!stage) return 'Not started'
  return stage.replace('-', ' ').replace(/\b\w/g, (char) => char.toUpperCase())
}

function messageTone(role: HealthCheckWorkflowMessage['role']) {
  if (role === 'user') return { align: 'flex-end', bg: APP_COLORS.primary, color: TRUIST.white }
  if (role === 'l1') return { align: 'flex-start', bg: '#EEF7F8', color: TRUIST.ink }
  if (role === 'system') return { align: 'flex-start', bg: '#F6F4F8', color: TRUIST.ink }
  return { align: 'flex-start', bg: TRUIST.white, color: TRUIST.ink }
}

const HEALTH_CHECK_ENVIRONMENT_OPTIONS = ['Production', 'Pre-Prod', 'Test', 'Development'] as const
const HEALTH_CHECK_TYPE_OPTIONS = ['Network', 'Server Health', 'App URL Check', 'DB Connectivity', 'Check ALL'] as const

function buildHealthCheckPrompt(environment: string, checkType: string) {
  return `${environment}-${checkType}`
}

function parseHealthCheckPrompt(prompt: string): { environment: string; checkType: string } | null {
  const normalized = prompt.trim().toLowerCase()
  for (const environment of HEALTH_CHECK_ENVIRONMENT_OPTIONS) {
    for (const checkType of HEALTH_CHECK_TYPE_OPTIONS) {
      if (normalized === buildHealthCheckPrompt(environment, checkType).toLowerCase()) {
        return { environment, checkType }
      }
    }
  }

  return null
}

interface HealthCheckAgentProps {
  onClose: () => void
}

export function HealthCheckAgent({ onClose }: HealthCheckAgentProps) {
  const sessionId = useMemo(() => getWorkflowSessionId(), [])
  const userId = getAuthenticatedUserId() ?? undefined
  const [workflowState, setWorkflowState] = useState<HealthCheckWorkflowState | null>(null)
  const [prompt, setPrompt] = useState('')
  const [selectedEnvironment, setSelectedEnvironment] = useState<string | null>(null)
  const [selectedCheckType, setSelectedCheckType] = useState<string | null>(null)
  const [feedback, setFeedback] = useState('')
  const [busyAction, setBusyAction] = useState<'load' | 'start' | 'approval' | 'feedback' | 'restart' | null>('load')
  const [error, setError] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement | null>(null)

  const syncResponse = useMemo(() => async (request: Promise<{ state: HealthCheckWorkflowState | null; persistenceError?: string }>) => {
    setError(null)
    const response = await request
    setWorkflowState(response.state)
    if (response.state?.l1Feedback) {
      setFeedback(response.state.l1Feedback)
    }
  }, [])

  useEffect(() => {
    let active = true
    setBusyAction('load')
    healthCheckService.loadWorkflow(sessionId)
      .then((response) => {
        if (!active) return
        setWorkflowState(response.state)
        if (response.state?.prompt) {
          setPrompt(response.state.prompt)
          const parsedPrompt = parseHealthCheckPrompt(response.state.prompt)
          if (parsedPrompt) {
            setSelectedEnvironment(parsedPrompt.environment)
            setSelectedCheckType(parsedPrompt.checkType)
          }
        }
        if (response.state?.l1Feedback) {
          setFeedback(response.state.l1Feedback)
        }
      })
      .catch((loadError) => {
        if (!active) return
        setError(loadError instanceof Error ? loadError.message : 'Failed to load workflow')
      })
      .finally(() => {
        if (active) setBusyAction(null)
      })

    return () => {
      active = false
    }
  }, [sessionId])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [workflowState])

  const submitStart = async (mode: 'start' | 'restart') => {
    if (!prompt.trim()) {
      setError('Provide the health check context before starting the workflow.')
      return
    }

    setBusyAction(mode)
    try {
      await syncResponse(
        mode === 'restart'
          ? healthCheckService.restartWorkflow({ sessionId, prompt: prompt.trim(), browserSessionId: SESSION_ID, userId })
          : healthCheckService.startWorkflow({ sessionId, prompt: prompt.trim(), browserSessionId: SESSION_ID, userId }),
      )
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Failed to start workflow')
    } finally {
      setBusyAction(null)
    }
  }

  const submitApproval = async (approval: 'yes' | 'no') => {
    setBusyAction('approval')
    try {
      await syncResponse(healthCheckService.submitApproval({ sessionId, approval, browserSessionId: SESSION_ID, userId }))
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Failed to submit approval')
    } finally {
      setBusyAction(null)
    }
  }

  const submitFeedback = async () => {
    if (!feedback.trim()) {
      setError('L1 feedback is required before the workflow can complete.')
      return
    }

    setBusyAction('feedback')
    try {
      await syncResponse(healthCheckService.submitL1Feedback({ sessionId, feedback: feedback.trim(), browserSessionId: SESSION_ID, userId }))
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Failed to submit L1 feedback')
    } finally {
      setBusyAction(null)
    }
  }

  const stage = workflowState?.stage
  const isWorkflowStarted = !!workflowState && stage !== 'idle'
  const showApproval = !!workflowState?.approvalPrompt && stage === 'approval'
  const showFeedback = stage === 'l1-feedback' || stage === 'completed'
  const isBusy = busyAction !== null
  const composerValue = showFeedback ? feedback : prompt
  const composerPlaceholder = showFeedback
    ? 'Capture L1 feedback and recommended actions...'
    : 'Describe the incident, symptom, or validation request...'
  const composerLabel = showFeedback ? 'L1 Feedback' : 'Health Check Context'

  const handleComposerSubmit = async () => {
    if (showFeedback) {
      await submitFeedback()
      return
    }

    await submitStart(workflowState ? 'restart' : 'start')
  }

  const submitStartWithPrompt = async (mode: 'start' | 'restart', nextPrompt: string) => {
    if (!nextPrompt.trim()) {
      setError('Provide the health check context before starting the workflow.')
      return
    }

    setPrompt(nextPrompt)
    setBusyAction(mode)
    try {
      await syncResponse(
        mode === 'restart'
          ? healthCheckService.restartWorkflow({ sessionId, prompt: nextPrompt.trim(), browserSessionId: SESSION_ID, userId })
          : healthCheckService.startWorkflow({ sessionId, prompt: nextPrompt.trim(), browserSessionId: SESSION_ID, userId }),
      )
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Failed to start workflow')
    } finally {
      setBusyAction(null)
    }
  }

  const handleEnvironmentSelect = async (environment: string) => {
    setError(null)
    setSelectedEnvironment(environment)
    setSelectedCheckType(null)
  }

  const handleCheckTypeSelect = async (checkType: string) => {
    if (!selectedEnvironment) {
      setError('Select an environment first, then choose the health check type from the buttons.')
      return
    }

    setError(null)
    setSelectedCheckType(checkType)
    await submitStartWithPrompt('start', buildHealthCheckPrompt(selectedEnvironment, checkType))
  }

  const handleComposerKeyDown = async (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Enter' || event.shiftKey) return
    event.preventDefault()
    if (showApproval) return
    await handleComposerSubmit()
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        background: 'linear-gradient(180deg, #EEF7F8 0%, #FAFAFA 36%, #F6F4F8 100%)',
        color: APP_COLORS.text,
      }}
    >
      <Box sx={{ px: { xs: 1.5, md: 3 }, py: { xs: 1.5, md: 2.5 } }}>
        <Paper
          elevation={0}
          sx={{
            p: { xs: 2, md: 2.5 },
            borderRadius: 4,
            border: `1px solid ${TRUIST.line}`,
            background: 'linear-gradient(135deg, #14323B 0%, #2E1A47 55%, #7C6992 100%)',
            color: TRUIST.white,
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          <Box sx={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at top right, rgba(176,224,226,0.28), transparent 38%)' }} />
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} justifyContent="space-between" sx={{ position: 'relative' }}>
            <Box>
              <Typography sx={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', opacity: 0.78 }}>
                Agent Foundry
              </Typography>
              <Typography variant="h3" sx={{ mt: 0.75, fontSize: { xs: 28, md: 38 }, fontWeight: 800, letterSpacing: '-0.03em' }}>
                Health Check Agent
              </Typography>
              <Typography sx={{ mt: 1, maxWidth: 760, color: 'rgba(255,255,255,0.82)', fontSize: { xs: 14, md: 15 } }}>
                A full-window conversational workflow for health triage, approval prompts, and L1 feedback.
              </Typography>
            </Box>

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25} alignItems={{ xs: 'stretch', sm: 'flex-start' }}>
              <Chip label={`Stage: ${stageLabel(stage)}`} sx={{ bgcolor: 'rgba(255,255,255,0.14)', color: TRUIST.white, fontWeight: 700 }} />
              {workflowState?.persistedAt ? (
                <Chip label={`Updated ${formatTimestamp(workflowState.persistedAt)}`} sx={{ bgcolor: 'rgba(255,255,255,0.10)', color: TRUIST.white }} />
              ) : null}
              <Button onClick={() => submitStart('restart')} startIcon={<AutorenewIcon />} sx={{ color: TRUIST.white, borderColor: 'rgba(255,255,255,0.28)' }} variant="outlined" disabled={isBusy || !prompt.trim()}>
                Restart
              </Button>
              <Button onClick={onClose} startIcon={<ArrowBackIcon />} sx={{ color: TRUIST.white, borderColor: 'rgba(255,255,255,0.28)' }} variant="outlined">
                Back
              </Button>
            </Stack>
          </Stack>
        </Paper>

        <Paper
          elevation={0}
          sx={{
            mt: 2,
            minHeight: 'calc(100vh - 182px)',
            borderRadius: 4,
            border: `1px solid ${TRUIST.line}`,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: 'rgba(255,255,255,0.88)',
            backdropFilter: 'blur(16px)',
          }}
        >
          <Box sx={{ px: { xs: 1.5, md: 2.5 }, py: 1.5, borderBottom: `1px solid ${TRUIST.line}`, backgroundColor: '#FCFCFD' }}>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.25} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'center' }}>
              <Typography sx={{ fontSize: 13, color: APP_COLORS.subtext }}>
                The agent responds in chat, pauses for approval when needed, then accepts L1 feedback to complete the workflow.
              </Typography>
              {workflowState?.recommendedActions?.length ? (
                <Chip label={`${workflowState.recommendedActions.length} recommended action${workflowState.recommendedActions.length === 1 ? '' : 's'}`} sx={{ bgcolor: TRUIST.shell, color: APP_COLORS.text }} />
              ) : null}
            </Stack>
          </Box>

          <Box
            sx={{
              flex: 1,
              overflowY: 'auto',
              px: { xs: 1.5, md: 2.5 },
              py: 2,
              display: 'flex',
              flexDirection: 'column',
              gap: 1.5,
            }}
          >
            {error && <Alert severity="error">{error}</Alert>}

            {!isWorkflowStarted ? (
              <Box sx={{ minHeight: '100%', display: 'grid', placeItems: 'center', px: 2 }}>
                <Box sx={{ width: '100%', maxWidth: 840 }}>
                  <Paper elevation={0} sx={{ p: { xs: 2, md: 2.5 }, borderRadius: 4, border: `1px solid ${TRUIST.line}`, backgroundColor: '#FCFCFD' }}>
                    <Typography variant="h5" sx={{ fontWeight: 800, color: APP_COLORS.text }}>
                      Start the Health Check conversation
                    </Typography>
                    <Typography sx={{ mt: 1, color: APP_COLORS.subtext, lineHeight: 1.7 }}>
                      Choose the environment first. After that, the health check type buttons will appear and the workflow will start automatically.
                    </Typography>

                    <Box sx={{ mt: 2.5 }}>
                      <Typography sx={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: TRUIST.dusk }}>
                        Environment question
                      </Typography>
                      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mt: 1.25, flexWrap: 'wrap' }}>
                        {HEALTH_CHECK_ENVIRONMENT_OPTIONS.map((environment) => {
                          const isSelected = selectedEnvironment === environment
                          return (
                            <Button
                              key={environment}
                              variant={isSelected ? 'contained' : 'outlined'}
                              onClick={() => void handleEnvironmentSelect(environment)}
                              disabled={isBusy}
                              sx={{ minWidth: 140, justifyContent: 'center' }}
                            >
                              {environment}
                            </Button>
                          )
                        })}
                      </Stack>
                    </Box>

                    {!selectedEnvironment ? (
                      <Typography sx={{ mt: 1.25, fontSize: 12.5, color: APP_COLORS.subtext }}>
                        Please select one environment option above. Typing is not accepted here until the button selections are complete.
                      </Typography>
                    ) : (
                      <Box sx={{ mt: 2.75 }}>
                        <Typography sx={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: TRUIST.dusk }}>
                          Health check type
                        </Typography>
                        <Typography sx={{ mt: 0.6, fontSize: 12.5, color: APP_COLORS.subtext }}>
                          Selected environment: {selectedEnvironment}
                        </Typography>
                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mt: 1.25, flexWrap: 'wrap' }}>
                          {HEALTH_CHECK_TYPE_OPTIONS.map((checkType) => {
                            const isSelected = selectedCheckType === checkType
                            return (
                              <Button
                                key={checkType}
                                variant={isSelected ? 'contained' : 'outlined'}
                                onClick={() => void handleCheckTypeSelect(checkType)}
                                disabled={isBusy}
                                sx={{ minWidth: 160, justifyContent: 'center' }}
                              >
                                {checkType}
                              </Button>
                            )
                          })}
                        </Stack>
                        <Typography sx={{ mt: 1.25, fontSize: 12.5, color: APP_COLORS.subtext }}>
                          If you try to type something else, the agent will keep asking you to use the buttons first.
                        </Typography>
                      </Box>
                    )}
                  </Paper>
                </Box>
              </Box>
            ) : workflowState.messages.map((message) => {
              const tone = messageTone(message.role)
              return (
                <Box key={message.id} sx={{ display: 'flex', justifyContent: tone.align }}>
                  <Box
                    sx={{
                      width: '100%',
                      maxWidth: { xs: '94%', md: '78%' },
                      px: 1.75,
                      py: 1.4,
                      borderRadius: 3,
                      bgcolor: tone.bg,
                      color: tone.color,
                      border: message.role === 'agent' ? `1px solid ${TRUIST.line}` : 'none',
                      boxShadow: message.role === 'user' ? '0 12px 24px rgba(46,26,71,0.18)' : 'none',
                    }}
                  >
                    <Typography sx={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', opacity: 0.78 }}>
                      {message.role}
                    </Typography>
                    <Typography sx={{ mt: 0.75, fontSize: 14, whiteSpace: 'pre-wrap', lineHeight: 1.65 }}>{message.content}</Typography>
                    <Typography sx={{ mt: 1, fontSize: 11, opacity: 0.66 }}>{formatTimestamp(message.timestamp)}</Typography>
                  </Box>
                </Box>
              )
            })}

            {showApproval && workflowState?.approvalPrompt && (
              <Box sx={{ display: 'flex', justifyContent: 'flex-start' }}>
                <Paper elevation={0} sx={{ width: '100%', maxWidth: { xs: '94%', md: '78%' }, p: 2, borderRadius: 3, border: `1px solid ${TRUIST.line}`, backgroundColor: TRUIST.shell }}>
                  <Typography sx={{ fontSize: 15, fontWeight: 800 }}>{workflowState.approvalPrompt.question}</Typography>
                  <Typography sx={{ mt: 0.75, fontSize: 13, color: APP_COLORS.subtext }}>{workflowState.approvalPrompt.description}</Typography>
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25} sx={{ mt: 1.5 }}>
                    {workflowState.approvalPrompt.options.map((option) => (
                      <Button
                        key={option.value}
                        variant={option.variant}
                        onClick={() => submitApproval(option.value)}
                        disabled={isBusy}
                      >
                        {option.label}
                      </Button>
                    ))}
                  </Stack>
                </Paper>
              </Box>
            )}

            {workflowState?.recommendedActions?.length ? (
              <Box sx={{ display: 'flex', justifyContent: 'flex-start' }}>
                <Paper elevation={0} sx={{ width: '100%', maxWidth: { xs: '94%', md: '78%' }, p: 2, borderRadius: 3, border: `1px solid ${TRUIST.line}`, backgroundColor: '#FCFCFD' }}>
                  <Typography sx={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: TRUIST.dusk }}>
                    Recommended Actions
                  </Typography>
                  <Stack spacing={1} sx={{ mt: 1.25 }}>
                    {workflowState.recommendedActions.map((action, index) => (
                      <Typography key={`${action}-${index}`} sx={{ fontSize: 14, color: APP_COLORS.text }}>
                        {`${index + 1}. ${action}`}
                      </Typography>
                    ))}
                  </Stack>
                </Paper>
              </Box>
            ) : null}

            <div ref={messagesEndRef} />
          </Box>

          <Box sx={{ borderTop: `1px solid ${TRUIST.line}`, px: { xs: 1.5, md: 2.5 }, py: 1.75, backgroundColor: '#FCFCFD' }}>
            {showApproval && (
              <Typography sx={{ mb: 1, fontSize: 13, color: APP_COLORS.subtext }}>
                Approval is pending above. Choose Yes or No to continue.
              </Typography>
            )}

            {isWorkflowStarted ? (
              <>
                <TextField
                  value={composerValue}
                  onChange={(event) => {
                    if (showFeedback) {
                      setFeedback(event.target.value)
                      return
                    }
                    setPrompt(event.target.value)
                  }}
                  onKeyDown={handleComposerKeyDown}
                  placeholder={composerPlaceholder}
                  label={composerLabel}
                  fullWidth
                  multiline
                  minRows={3}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 3,
                      backgroundColor: TRUIST.white,
                    },
                  }}
                  disabled={isBusy || showApproval}
                />

                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25} sx={{ mt: 1.5 }} justifyContent="space-between" alignItems={{ xs: 'stretch', sm: 'center' }}>
                  <Typography sx={{ fontSize: 12, color: APP_COLORS.subtext }}>
                    {showFeedback
                      ? 'Press Enter to log L1 feedback. Use Shift+Enter for a new line.'
                      : 'Press Enter to send the incident context. Use Shift+Enter for a new line.'}
                  </Typography>
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25}>
                    {isBusy && <CircularProgress size={22} sx={{ alignSelf: 'center' }} />}
                    <Button
                      variant="contained"
                      endIcon={<SendIcon />}
                      onClick={handleComposerSubmit}
                      disabled={isBusy || showApproval || !composerValue.trim()}
                    >
                      Send
                    </Button>
                  </Stack>
                </Stack>
              </>
            ) : null}
          </Box>
        </Paper>
      </Box>
    </Box>
  )
}