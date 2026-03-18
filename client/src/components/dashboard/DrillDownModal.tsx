import React from 'react'
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Box, Typography, Chip, Divider, IconButton,
  Tab, Tabs,
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline'
import BugReportIcon from '@mui/icons-material/BugReport'
import ConfirmationNumberIcon from '@mui/icons-material/ConfirmationNumber'
import PlayCircleOutlineIcon from '@mui/icons-material/PlayCircleOutline'

export type DrillDownType = 'pipeline' | 'error' | 'ticket' | 'run'

export interface DrillDownData {
  type: DrillDownType
  data: any
}

interface DrillDownModalProps {
  open: boolean
  onClose: () => void
  drillDown: DrillDownData | null
}

const statusColor = (s: string) => {
  const map: Record<string, { bg: string; color: string }> = {
    healthy:     { bg: '#e8f5e9', color: '#2e7d32' },
    at_risk:     { bg: '#fff8e1', color: '#f57c00' },
    critical:    { bg: '#fce4ec', color: '#c62828' },
    success:     { bg: '#e8f5e9', color: '#2e7d32' },
    failed:      { bg: '#fce4ec', color: '#c62828' },
    in_progress: { bg: '#e3f2fd', color: '#1565c0' },
    open:        { bg: '#fff8e1', color: '#f57c00' },
    resolved:    { bg: '#e8f5e9', color: '#2e7d32' },
    P1:          { bg: '#fce4ec', color: '#c62828' },
    P2:          { bg: '#fff3e0', color: '#e65100' },
    P3:          { bg: '#e8f5e9', color: '#2e7d32' },
    critical2:   { bg: '#fce4ec', color: '#c62828' },
    high:        { bg: '#fff3e0', color: '#e65100' },
    medium:      { bg: '#fff8e1', color: '#f57c00' },
    low:         { bg: '#e8f5e9', color: '#2e7d32' },
  }
  return map[s] || { bg: '#f5f5f5', color: '#555' }
}

const fmt = (iso: string) =>
  new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })

// ─── Pipeline Drill-Down ───────────────────────────────────
const PipelineDetail: React.FC<{ data: any }> = ({ data }) => {
  const [tab, setTab] = React.useState(0)
  return (
    <Box>
      <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', mb: 2 }}>
        <Chip label={data.status.replace('_', ' ').toUpperCase()} size="small"
          sx={{ ...statusColor(data.status), fontWeight: 700 }} />
        <Chip label={`${data.successRate}% success`} size="small" variant="outlined" />
        <Chip label={`Avg ${data.avgDuration}`} size="small" variant="outlined" />
        <Chip label={data.schedule} size="small" variant="outlined" />
        <Chip label={`Owner: ${data.owner}`} size="small" variant="outlined" />
      </Box>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2, borderBottom: '1px solid #e0e0e0' }}>
        <Tab label="Run History" />
        <Tab label="Details" />
      </Tabs>

      {tab === 0 && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {data.runs.map((run: any) => (
            <Box key={run.runId} sx={{
              border: '1px solid #e0e0e0', borderRadius: 2, p: 1.5,
              borderLeft: `4px solid ${run.status === 'success' ? '#4caf50' : '#f44336'}`,
              backgroundColor: run.status === 'failed' ? '#fff8f8' : '#f9fff9',
            }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <PlayCircleOutlineIcon sx={{ fontSize: 16, color: run.status === 'success' ? '#4caf50' : '#f44336' }} />
                  <Typography sx={{ fontWeight: 600, fontSize: '13px' }}>{run.runId}</Typography>
                  <Chip label={run.status.toUpperCase()} size="small"
                    sx={{ ...statusColor(run.status), fontSize: '11px', height: 20 }} />
                </Box>
                <Typography sx={{ fontSize: '12px', color: '#888' }}>{fmt(run.start)}</Typography>
              </Box>
              <Box sx={{ display: 'flex', gap: 2, mt: 0.5 }}>
                <Typography sx={{ fontSize: '12px', color: '#555' }}>Duration: <b>{run.duration}</b></Typography>
                {run.records !== undefined && (
                  <Typography sx={{ fontSize: '12px', color: '#555' }}>Records: <b>{run.records.toLocaleString()}</b></Typography>
                )}
              </Box>
              {run.error && (
                <Box sx={{ mt: 1, backgroundColor: '#fff0f0', border: '1px solid #ffcdd2', borderRadius: 1, p: 1 }}>
                  <Typography sx={{ fontSize: '12px', color: '#c62828', fontFamily: 'monospace' }}>
                    ⚠ {run.error}
                  </Typography>
                </Box>
              )}
            </Box>
          ))}
        </Box>
      )}

      {tab === 1 && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {[
            ['Pipeline ID', data.id],
            ['Name', data.name],
            ['Owner', data.owner],
            ['Schedule', data.schedule],
            ['Avg Duration', data.avgDuration],
            ['Success Rate', `${data.successRate}%`],
            ['Last Run', fmt(data.lastRun)],
          ].map(([label, val]) => (
            <Box key={label} sx={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f0f0f0', pb: 0.5 }}>
              <Typography sx={{ fontSize: '13px', color: '#888' }}>{label}</Typography>
              <Typography sx={{ fontSize: '13px', fontWeight: 600 }}>{val}</Typography>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  )
}

// ─── Error Drill-Down ──────────────────────────────────────
const ErrorDetail: React.FC<{ data: any }> = ({ data }) => (
  <Box>
    <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', mb: 2 }}>
      <Chip label={data.severity.toUpperCase()} size="small"
        sx={{ ...statusColor(data.severity), fontWeight: 700 }} />
      <Chip label={`${data.count} occurrences`} size="small" variant="outlined" />
      <Chip label={data.service} size="small" variant="outlined" />
    </Box>

    <Box sx={{ mb: 2 }}>
      <Typography sx={{ fontSize: '12px', color: '#888', mb: 0.5 }}>First Seen</Typography>
      <Typography sx={{ fontSize: '13px' }}>{fmt(data.firstSeen)}</Typography>
    </Box>
    <Box sx={{ mb: 2 }}>
      <Typography sx={{ fontSize: '12px', color: '#888', mb: 0.5 }}>Last Seen</Typography>
      <Typography sx={{ fontSize: '13px', fontWeight: 600, color: '#c62828' }}>{fmt(data.lastSeen)}</Typography>
    </Box>

    {data.affectedPipelines.length > 0 && (
      <Box sx={{ mb: 2 }}>
        <Typography sx={{ fontSize: '12px', color: '#888', mb: 0.5 }}>Affected Pipelines</Typography>
        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
          {data.affectedPipelines.map((p: string) => (
            <Chip key={p} label={p} size="small" sx={{ backgroundColor: '#fff3e0', color: '#e65100' }} />
          ))}
        </Box>
      </Box>
    )}

    <Divider sx={{ my: 2 }} />
    <Typography sx={{ fontSize: '12px', color: '#888', mb: 1 }}>Stack Trace</Typography>
    <Box sx={{ backgroundColor: '#1a1a2e', borderRadius: 2, p: 2, mb: 2, overflowX: 'auto' }}>
      <Typography sx={{ fontSize: '12px', color: '#e91e63', fontFamily: 'monospace', whiteSpace: 'pre-line', lineHeight: 1.8 }}>
        {data.stackTrace}
      </Typography>
    </Box>

    <Box sx={{ backgroundColor: '#e8f5e9', border: '1px solid #a5d6a7', borderRadius: 2, p: 2 }}>
      <Typography sx={{ fontSize: '12px', fontWeight: 700, color: '#2e7d32', mb: 0.5 }}>✅ Recommended Resolution</Typography>
      <Typography sx={{ fontSize: '13px', color: '#333', lineHeight: 1.6 }}>{data.resolution}</Typography>
    </Box>
  </Box>
)

// ─── Ticket Drill-Down ─────────────────────────────────────
const TicketDetail: React.FC<{ data: any }> = ({ data }) => (
  <Box>
    <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', mb: 2 }}>
      <Chip label={data.priority} size="small" sx={{ ...statusColor(data.priority), fontWeight: 700 }} />
      <Chip label={data.status.replace('_', ' ').toUpperCase()} size="small"
        sx={{ ...statusColor(data.status), fontWeight: 600 }} />
      {data.sla.breached && <Chip label="⚠ SLA BREACHED" size="small" sx={{ backgroundColor: '#fce4ec', color: '#c62828', fontWeight: 700 }} />}
    </Box>

    <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5, mb: 2 }}>
      {[
        ['Ticket ID', data.id],
        ['Assignee', data.assignee],
        ['Team', data.team],
        ['Affected Service', data.affectedService],
        ['SLA Target', data.sla.target],
        ['SLA Status', data.sla.remaining],
        ['Created', fmt(data.createdAt)],
        ['Updated', fmt(data.updatedAt)],
      ].map(([label, val]) => (
        <Box key={label} sx={{ backgroundColor: '#f9f9f9', borderRadius: 1, p: 1 }}>
          <Typography sx={{ fontSize: '11px', color: '#888' }}>{label}</Typography>
          <Typography sx={{ fontSize: '13px', fontWeight: 600 }}>{val}</Typography>
        </Box>
      ))}
    </Box>

    <Box sx={{ backgroundColor: '#f5f5f5', borderRadius: 2, p: 2, mb: 2 }}>
      <Typography sx={{ fontSize: '12px', fontWeight: 700, color: '#555', mb: 0.5 }}>Description</Typography>
      <Typography sx={{ fontSize: '13px', color: '#333', lineHeight: 1.6 }}>{data.description}</Typography>
    </Box>

    <Divider sx={{ my: 2 }} />
    <Typography sx={{ fontSize: '12px', fontWeight: 700, color: '#555', mb: 1 }}>Activity Log</Typography>
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      {data.comments.map((c: any, i: number) => (
        <Box key={i} sx={{ display: 'flex', gap: 1.5, p: 1.5, backgroundColor: '#fafafa', borderRadius: 2, border: '1px solid #eeeeee' }}>
          <Box sx={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#1976d2', mt: 0.7, flexShrink: 0 }} />
          <Box>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 0.3 }}>
              <Typography sx={{ fontSize: '12px', fontWeight: 700, color: '#1976d2' }}>{c.author}</Typography>
              <Typography sx={{ fontSize: '11px', color: '#aaa' }}>{fmt(c.time)}</Typography>
            </Box>
            <Typography sx={{ fontSize: '13px', color: '#444', lineHeight: 1.5 }}>{c.text}</Typography>
          </Box>
        </Box>
      ))}
      {data.comments.length === 0 && (
        <Typography sx={{ fontSize: '13px', color: '#aaa', fontStyle: 'italic' }}>No comments yet.</Typography>
      )}
    </Box>
  </Box>
)

// ─── Main Modal ────────────────────────────────────────────
const iconFor = (type: DrillDownType) => {
  if (type === 'error') return <BugReportIcon />
  if (type === 'ticket') return <ConfirmationNumberIcon />
  return <ErrorOutlineIcon />
}

const titleFor = (dd: DrillDownData) => {
  if (dd.type === 'pipeline') return `Pipeline: ${dd.data.name}`
  if (dd.type === 'error') return `Error: ${dd.data.id}`
  if (dd.type === 'ticket') return `Ticket: ${dd.data.id}`
  return 'Details'
}

export const DrillDownModal: React.FC<DrillDownModalProps> = ({ open, onClose, drillDown }) => {
  if (!drillDown) return null

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth
      PaperProps={{ sx: { borderRadius: 3, overflow: 'hidden' } }}>
      <DialogTitle sx={{
        background: 'linear-gradient(120deg, #1565c0 0%, #1976d2 100%)',
        color: '#fff', display: 'flex', alignItems: 'center', gap: 1.5, py: 2,
      }}>
        {iconFor(drillDown.type)}
        <Typography sx={{ fontWeight: 700, fontSize: '16px', flex: 1 }}>{titleFor(drillDown)}</Typography>
        <IconButton onClick={onClose} size="small" sx={{ color: 'rgba(255,255,255,0.8)', '&:hover': { color: '#fff' } }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ p: 3, backgroundColor: '#fdfdfd' }}>
        {drillDown.type === 'pipeline' && <PipelineDetail data={drillDown.data} />}
        {drillDown.type === 'error'    && <ErrorDetail    data={drillDown.data} />}
        {drillDown.type === 'ticket'   && <TicketDetail   data={drillDown.data} />}
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2, borderTop: '1px solid #e0e0e0' }}>
        <Button onClick={onClose} variant="outlined" size="small">Close</Button>
      </DialogActions>
    </Dialog>
  )
}
