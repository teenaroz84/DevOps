/**
 * DataTable — A generic, scrollable table with configurable columns.
 *
 * Supports custom cell renderers, row click handlers, compact mode,
 * sticky headers, and a custom empty state message.
 *
 * Usage:
 *   <DataTable
 *     columns={[
 *       { key: 'id', header: 'ID', width: 80 },
 *       { key: 'message', header: 'Message', flex: 1 },
 *       { key: 'severity', header: 'Severity', width: 90,
 *         render: row => <Chip label={row.severity} ... /> },
 *     ]}
 *     rows={errors}
 *     onRowClick={row => setDrillDown(row)}
 *     maxHeight={360}
 *   />
 */
import React from 'react'
import {
  Box,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  Typography,
} from '@mui/material'
import TableRowsIcon from '@mui/icons-material/TableRows'

export interface ColumnDef<T = any> {
  /** Property name on the row object, or any unique string when using render */
  key: string
  header: string
  /** Fixed pixel width */
  width?: number | string
  /** Flex grow value (relative to other flex columns) */
  flex?: number
  /** Custom cell renderer. Falls back to row[key] if not set. */
  render?: (row: T) => React.ReactNode
  align?: 'left' | 'center' | 'right'
  /** Prevent text wrapping */
  noWrap?: boolean
}

interface DataTableProps<T = any> {
  columns: ColumnDef<T>[]
  rows: T[]
  onRowClick?: (row: T) => void
  /** CSS max-height for the scrollable body. E.g. 320 or "50vh". */
  maxHeight?: number | string
  /** Shown when rows is empty */
  emptyMessage?: string
  /** Key extractor. Falls back to index. */
  rowKey?: string | ((row: T) => string)
  compact?: boolean
  /** Background color for the header row (overrides default) */
  headerBg?: string
  /** Tooltip shown on row hover */
  rowTooltip?: string
  /** Accent color for header left border strip (defaults to #1976d2) */
  accentColor?: string
}

function getKey<T>(row: T, rowKey: DataTableProps<T>['rowKey'], idx: number): string {
  if (!rowKey) return String(idx)
  if (typeof rowKey === 'string') return String((row as any)[rowKey] ?? idx)
  return rowKey(row)
}

export function DataTable<T = any>({
  columns,
  rows,
  onRowClick,
  maxHeight,
  emptyMessage = 'No data',
  rowKey,
  compact = false,
  headerBg,
  rowTooltip,
  accentColor = '#1976d2',
}: DataTableProps<T>) {
  const cellPy = compact ? 0.6 : 1
  const resolvedHeaderBg = headerBg ?? '#f0f4f8'

  return (
    <Box
      sx={{
        overflowX: 'auto',
        borderRadius: 1.5,
        border: '1px solid #e8ecf1',
        ...(maxHeight ? { maxHeight, overflowY: 'auto' } : {}),
      }}
    >
      <Table size="small" stickyHeader>
        <TableHead>
          <TableRow>
            {columns.map((col, colIdx) => (
              <TableCell
                key={col.key}
                align={col.align ?? 'left'}
                sx={{
                  fontSize: '10px',
                  fontWeight: 700,
                  color: '#4a5568',
                  py: cellPy,
                  px: 1.5,
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  whiteSpace: 'nowrap',
                  borderBottom: `2px solid ${accentColor}33`,
                  backgroundColor: `${resolvedHeaderBg} !important`,
                  width: col.width,
                  ...(col.flex ? { minWidth: 0 } : {}),
                  // Left accent strip on first column
                  ...(colIdx === 0 ? {
                    borderLeft: `3px solid ${accentColor}`,
                    pl: '10px',
                  } : {}),
                }}
              >
                {col.header}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>

        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={columns.length}
                sx={{ border: 0 }}
              >
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 4, gap: 1 }}>
                  <TableRowsIcon sx={{ fontSize: 28, color: '#d0d5dd' }} />
                  <Typography sx={{ fontSize: '12px', color: '#aab', fontWeight: 500 }}>
                    {emptyMessage}
                  </Typography>
                </Box>
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row, idx) => (
              <TableRow
                key={getKey(row, rowKey, idx)}
                onClick={() => onRowClick?.(row)}
                title={rowTooltip}
                sx={{
                  cursor: onRowClick ? 'pointer' : 'default',
                  transition: 'background 0.12s, border-color 0.12s',
                  backgroundColor: idx % 2 === 0 ? '#ffffff' : '#fafbfc',
                  '&:hover': onRowClick
                    ? { backgroundColor: `${accentColor}0d`, '& td:first-of-type': { borderLeftColor: accentColor } }
                    : { backgroundColor: idx % 2 === 0 ? '#f7f9fc' : '#f4f6f9' },
                  '&:last-child td': { border: 0 },
                }}
              >
                {columns.map((col, colIdx) => (
                  <TableCell
                    key={col.key}
                    align={col.align ?? 'left'}
                    sx={{
                      fontSize: compact ? '11px' : '12px',
                      color: '#2d3748',
                      py: cellPy,
                      px: 1.5,
                      borderBottom: '1px solid #f0f2f5',
                      ...(col.noWrap ? { whiteSpace: 'nowrap' } : {}),
                      ...(col.width ? { width: col.width } : {}),
                      // Carry the left accent through body rows too
                      ...(colIdx === 0 ? {
                        borderLeft: `3px solid ${accentColor}22`,
                        pl: '10px',
                        transition: 'border-color 0.12s',
                      } : {}),
                    }}
                  >
                    {col.render
                      ? col.render(row)
                      : String((row as any)[col.key] ?? '')}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </Box>
  )
}
