import React from 'react'
import { Box, Typography } from '@mui/material'

/** Renders inline **bold** and `code` within a line. */
function renderInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i}>{part.slice(2, -2)}</strong>
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <Box key={i} component="code" sx={{ backgroundColor: 'rgba(0,0,0,0.07)', borderRadius: '3px', px: '3px', fontSize: '12px', fontFamily: 'monospace' }}>
          {part.slice(1, -1)}
        </Box>
      )
    }
    return part
  })
}

/** Renders agent message text with basic formatting:
 *  - **bold** → <strong>
 *  - `code` → inline code block
 *  - Lines starting with - / • / * → indented bullet
 *  - Lines starting with 1. 2. → numbered list
 *  - ### / ## / # → bold heading
 *  - Blank lines → spacing
 */
export function FormattedMessage({ text, color }: { text: string; color?: string }) {
  const lines = text.split('\n')
  return (
    <Box sx={{ fontSize: '13px', lineHeight: 1.6, color: color || 'inherit' }}>
      {lines.map((line, i) => {
        const trimmed = line.trim()

        // Empty line → small spacer
        if (!trimmed) return <Box key={i} sx={{ height: '6px' }} />

        // Headings: ###, ##, #
        const headingMatch = trimmed.match(/^(#{1,3})\s+(.+)/)
        if (headingMatch) {
          const level = headingMatch[1].length
          const sizes = ['15px', '14px', '13px']
          return (
            <Typography key={i} component="div" sx={{ fontSize: sizes[level - 1] ?? '13px', fontWeight: 700, mt: 0.5, mb: 0.25 }}>
              {renderInline(headingMatch[2])}
            </Typography>
          )
        }

        // Bullet lines: - or • or *
        if (/^[-•*]\s+/.test(trimmed)) {
          return (
            <Box key={i} sx={{ display: 'flex', gap: '6px', pl: 1, mb: '2px' }}>
              <span style={{ flexShrink: 0, marginTop: '1px' }}>•</span>
              <span>{renderInline(trimmed.replace(/^[-•*]\s+/, ''))}</span>
            </Box>
          )
        }

        // Numbered list: 1. 2. etc.
        const numMatch = trimmed.match(/^(\d+)\.\s+(.+)/)
        if (numMatch) {
          return (
            <Box key={i} sx={{ display: 'flex', gap: '6px', pl: 1, mb: '2px' }}>
              <span style={{ flexShrink: 0, minWidth: '16px', marginTop: '1px' }}>{numMatch[1]}.</span>
              <span>{renderInline(numMatch[2])}</span>
            </Box>
          )
        }

        // Normal paragraph line
        return (
          <Typography key={i} component="div" sx={{ fontSize: '13px', mb: '1px' }}>
            {renderInline(trimmed)}
          </Typography>
        )
      })}
    </Box>
  )
}
