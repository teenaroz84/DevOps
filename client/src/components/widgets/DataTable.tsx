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
} from '@mui/material'

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
  /** Background color for the header row */
  headerBg?: string
  /** Tooltip shown on row hover */
  rowTooltip?: string
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
  headerBg = '#f5f5f5',
  rowTooltip,
}: DataTableProps<T>) {
  const cellPy = compact ? 0.5 : 1

  return (
    <Box sx={{ overflowX: 'auto', ...(maxHeight ? { maxHeight, overflowY: 'auto' } : {}) }}>
      <Table size="small" stickyHeader>
        <TableHead>
          <TableRow>
            {columns.map(col => (
              <TableCell
                key={col.key}
                align={col.align ?? 'left'}
                sx={{
                  fontSize: '11px',
                  fontWeight: 700,
                  color: '#555',
                  py: cellPy,
                  px: 1.5,
                  textTransform: 'uppercase',
                  letterSpacing: '0.3px',
                  whiteSpace: 'nowrap',
                  borderBottom: '2px solid #e0e0e0',
                  backgroundColor: `${headerBg} !important`,
                  width: col.width,
                  ...(col.flex ? { minWidth: 0 } : {}),
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
                sx={{ textAlign: 'center', py: 3, color: '#888', fontSize: '13px', border: 0 }}
              >
                {emptyMessage}
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
                  transition: 'background 0.1s',
                  '&:hover': onRowClick ? { backgroundColor: '#f5f9ff' } : {},
                  '&:last-child td': { border: 0 },
                }}
              >
                {columns.map(col => (
                  <TableCell
                    key={col.key}
                    align={col.align ?? 'left'}
                    sx={{
                      fontSize: compact ? '11px' : '12px',
                      color: '#333',
                      py: cellPy,
                      px: 1.5,
                      ...(col.noWrap ? { whiteSpace: 'nowrap' } : {}),
                      ...(col.width ? { width: col.width } : {}),
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
