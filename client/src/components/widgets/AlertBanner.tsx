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
import { STATUS_BADGE, TRUIST } from '../../theme/truistPalette'

export type AlertSeverity = 'error' | 'warning' | 'info' | 'success'

interface AlertConfig {
  bg: string
  border: string
  accent: string
  icon: React.ReactNode
}

const ALERT_CONFIG: Record<AlertSeverity, AlertConfig> = {
  error: {
    bg: STATUS_BADGE.error.bg,
    border: STATUS_BADGE.error.dot,
    accent: STATUS_BADGE.error.color,
    icon: <ErrorIcon sx={{ fontSize: 18, color: STATUS_BADGE.error.color }} />,
  },
  warning: {
    bg: STATUS_BADGE.warning.bg,
    border: STATUS_BADGE.warning.dot,
    accent: STATUS_BADGE.warning.color,
    icon: <WarningIcon sx={{ fontSize: 18, color: STATUS_BADGE.warning.color }} />,
  },
  info: {
    bg: STATUS_BADGE.info.bg,
    border: STATUS_BADGE.info.dot,
    accent: STATUS_BADGE.info.color,
    icon: <InfoIcon sx={{ fontSize: 18, color: STATUS_BADGE.info.color }} />,
  },
  success: {
    bg: STATUS_BADGE.success.bg,
    border: STATUS_BADGE.success.dot,
    accent: STATUS_BADGE.success.color,
    icon: <CheckCircleIcon sx={{ fontSize: 18, color: STATUS_BADGE.success.color }} />,
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
          <Typography sx={{ fontSize: '11px', color: TRUIST.muted, lineHeight: 1.3 }}>
            {message}
          </Typography>
        )}
      </Box>

      {actions && <Box sx={{ flexShrink: 0 }}>{actions}</Box>}
    </Box>
  )
}
