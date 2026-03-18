/**
 * AlertBanner — A compact alert bar for in-widget notifications.
 *
 * Usage:
 *   <AlertBanner
 *     severity="warning"
 *     title="3 pipelines at risk."
 *     message="Finance D+1 feed delayed due to upstream Talend retry storm."
 *   />
 */
import React from 'react'
import { Box, Typography } from '@mui/material'
import WarningIcon from '@mui/icons-material/Warning'
import ErrorIcon from '@mui/icons-material/Error'
import InfoIcon from '@mui/icons-material/Info'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'

export type AlertSeverity = 'error' | 'warning' | 'info' | 'success'

interface AlertConfig {
  bg: string
  border: string
  accent: string
  icon: React.ReactNode
}

const ALERT_CONFIG: Record<AlertSeverity, AlertConfig> = {
  error: {
    bg: '#fff5f5',
    border: '#f44336',
    accent: '#d32f2f',
    icon: <ErrorIcon sx={{ fontSize: 18, color: '#d32f2f' }} />,
  },
  warning: {
    bg: '#fffbfa',
    border: '#ff9800',
    accent: '#e65100',
    icon: <WarningIcon sx={{ fontSize: 18, color: '#ff9800' }} />,
  },
  info: {
    bg: '#f3f8ff',
    border: '#1976d2',
    accent: '#1565c0',
    icon: <InfoIcon sx={{ fontSize: 18, color: '#1976d2' }} />,
  },
  success: {
    bg: '#f3fdf4',
    border: '#43a047',
    accent: '#2e7d32',
    icon: <CheckCircleIcon sx={{ fontSize: 18, color: '#43a047' }} />,
  },
}

export interface AlertBannerProps {
  severity?: AlertSeverity
  title: string
  message?: string
  /** Replace the default severity icon */
  icon?: React.ReactNode
  /** Optional right-side actions */
  actions?: React.ReactNode
}

export const AlertBanner: React.FC<AlertBannerProps> = ({
  severity = 'warning',
  title,
  message,
  icon,
  actions,
}) => {
  const cfg = ALERT_CONFIG[severity]

  return (
    <Box
      sx={{
        backgroundColor: cfg.bg,
        border: `1px solid ${cfg.border}`,
        borderLeft: `4px solid ${cfg.border}`,
        borderRadius: '4px',
        p: 0.8,
        display: 'flex',
        gap: 0.5,
        alignItems: 'flex-start',
      }}
    >
      <Box sx={{ flexShrink: 0, mt: 0.1 }}>{icon ?? cfg.icon}</Box>

      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography
          sx={{ fontSize: '12px', color: cfg.accent, fontWeight: 600, mb: message ? 0.2 : 0 }}
        >
          {title}
        </Typography>
        {message && (
          <Typography sx={{ fontSize: '11px', color: '#666', lineHeight: 1.3 }}>
            {message}
          </Typography>
        )}
      </Box>

      {actions && <Box sx={{ flexShrink: 0 }}>{actions}</Box>}
    </Box>
  )
}
