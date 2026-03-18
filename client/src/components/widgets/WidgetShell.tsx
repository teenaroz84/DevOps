/**
 * WidgetShell — The standard card wrapper for every widget.
 *
 * Provides a consistent header (icon + title + source badge + optional actions),
 * a loading/error state, and a scrollable content area.
 * Any widget can be built by wrapping content with <WidgetShell>.
 */
import React from 'react'
import { Box, Typography, CircularProgress } from '@mui/material'

export interface WidgetShellProps {
  /** Main title shown in the header */
  title?: string
  /** Optional icon shown to the left of the title */
  titleIcon?: React.ReactNode
  /** Source system label (e.g. "CloudWatch", "PostgreSQL") — shown right-aligned */
  source?: string
  /** When true, fills the body with a spinner */
  loading?: boolean
  /** When set, shows an error message instead of children */
  error?: string
  /** Content rendered inside the card body */
  children: React.ReactNode
  /** Optional controls rendered on the right of the header */
  actions?: React.ReactNode
  /** Secondary content rendered directly below the header (e.g. filter chips) */
  subheader?: React.ReactNode
  /** Background color of the header row */
  headerBg?: string
}

export const WidgetShell: React.FC<WidgetShellProps> = ({
  title,
  titleIcon,
  source,
  loading,
  error,
  children,
  actions,
  subheader,
  headerBg,
}) => {
  const hasHeader = title || actions || source

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {hasHeader && (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            px: 2,
            pt: 1.5,
            pb: 1,
            borderBottom: '1px solid #f0f0f0',
            flexShrink: 0,
            backgroundColor: headerBg,
          }}
        >
          {titleIcon && <Box sx={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>{titleIcon}</Box>}
          {title && (
            <Typography sx={{ fontWeight: 700, fontSize: '13px', color: '#1a1a1a', flex: 1 }}>
              {title}
            </Typography>
          )}
          {source && (
            <Typography sx={{ fontSize: '11px', color: '#999', flexShrink: 0 }}>{source}</Typography>
          )}
          {actions && <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>{actions}</Box>}
        </Box>
      )}

      {subheader && <Box sx={{ flexShrink: 0 }}>{subheader}</Box>}

      {loading ? (
        <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <CircularProgress size={24} />
        </Box>
      ) : error ? (
        <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', p: 2 }}>
          <Typography sx={{ fontSize: '13px', color: '#d32f2f', textAlign: 'center' }}>{error}</Typography>
        </Box>
      ) : (
        <Box sx={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {children}
        </Box>
      )}
    </Box>
  )
}
