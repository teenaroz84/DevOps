/**
 * WidgetDetailModal — A reusable popup for any clickable widget element.
 *
 * Shows a large value, description, and an optional grid of extra stat tiles.
 * Used by StatCardGrid (withDialog mode), KPISummary, and anywhere else that
 * needs a consistent "click to learn more" pattern.
 *
 * Usage:
 *   <WidgetDetailModal
 *     open={!!selected}
 *     onClose={() => setSelected(null)}
 *     title="Success Rate"
 *     value="98"
 *     unit="%"
 *     color="#2e7d32"
 *     description="Pipeline execution success rate…"
 *     stats={[{ label: 'Peak (7d)', value: '99.2%' }, { label: 'Low (7d)', value: '95.1%' }]}
 *   />
 */
import React from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  IconButton,
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'

export interface WidgetDetailStat {
  label: string
  value: string | number
}

export interface WidgetDetailModalProps {
  open: boolean
  onClose: () => void
  /** Card / section title */
  title: string
  /** Primary numeric or string value to display large */
  value?: string | number
  /** Unit suffix shown next to value (e.g. "%" or "hrs") */
  unit?: string
  /** Accent color for title, large value, and header left border */
  color?: string
  /** Paragraph describing what this metric means */
  description?: string
  /** Additional stat tiles shown in a 2-column grid below the description */
  stats?: WidgetDetailStat[]
  /** Optional extra JSX rendered below everything else */
  extra?: React.ReactNode
}

export const WidgetDetailModal: React.FC<WidgetDetailModalProps> = ({
  open,
  onClose,
  title,
  value,
  unit,
  color = '#1976d2',
  description,
  stats,
  extra,
}) => (
  <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth
    PaperProps={{ sx: { borderRadius: 3, overflow: 'hidden' } }}>

    {/* ── Header ── */}
    <DialogTitle sx={{
      display: 'flex',
      alignItems: 'center',
      gap: 1.5,
      py: 2,
      borderLeft: `4px solid ${color}`,
      backgroundColor: '#fafafa',
    }}>
      <Typography sx={{ fontWeight: 700, fontSize: '15px', flex: 1, color: '#1a1a1a' }}>
        {title}
      </Typography>
      <IconButton onClick={onClose} size="small" sx={{ color: '#888', '&:hover': { color: '#333' } }}>
        <CloseIcon fontSize="small" />
      </IconButton>
    </DialogTitle>

    {/* ── Body ── */}
    <DialogContent sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 2.5 }}>

      {/* Large value display */}
      {value !== undefined && (
        <Box sx={{ textAlign: 'center', py: 1.5, backgroundColor: `${color}0d`, borderRadius: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: '4px' }}>
            <Typography sx={{ fontSize: '52px', fontWeight: 800, lineHeight: 1, color }}>
              {value}
            </Typography>
            {unit && (
              <Typography sx={{ fontSize: '24px', fontWeight: 600, color, opacity: 0.8 }}>
                {unit}
              </Typography>
            )}
          </Box>
        </Box>
      )}

      {/* Description */}
      {description && (
        <Box sx={{ backgroundColor: '#f5f7fa', p: 2, borderRadius: 1.5, border: '1px solid #e8eaed' }}>
          <Typography sx={{ fontSize: '13px', color: '#444', lineHeight: 1.7 }}>
            {description}
          </Typography>
        </Box>
      )}

      {/* Stats grid */}
      {stats && stats.length > 0 && (
        <Box>
          <Typography sx={{ fontSize: '11px', fontWeight: 700, color: '#999', textTransform: 'uppercase', letterSpacing: '0.6px', mb: 1 }}>
            Additional Details
          </Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 1 }}>
            {stats.map((s, i) => (
              <Box key={i} sx={{
                backgroundColor: '#f9f9f9',
                p: 1.5,
                borderRadius: 1.5,
                border: '1px solid #f0f0f0',
              }}>
                <Typography sx={{ fontSize: '10px', color: '#999', mb: 0.4, textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.5px' }}>
                  {s.label}
                </Typography>
                <Typography sx={{ fontSize: '14px', fontWeight: 700, color: '#333' }}>
                  {s.value}
                </Typography>
              </Box>
            ))}
          </Box>
        </Box>
      )}

      {/* Extra slot */}
      {extra}
    </DialogContent>

    <DialogActions sx={{ px: 3, py: 2, borderTop: '1px solid #e0e0e0' }}>
      <Button onClick={onClose} variant="outlined" size="small">Close</Button>
    </DialogActions>
  </Dialog>
)
