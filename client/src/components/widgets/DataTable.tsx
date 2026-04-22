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
import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react'
import {
  Box,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  Typography,
  InputBase,
  TablePagination,
} from '@mui/material'
import TableRowsIcon from '@mui/icons-material/TableRows'
import SearchIcon from '@mui/icons-material/Search'
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward'
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward'
import UnfoldMoreIcon from '@mui/icons-material/UnfoldMore'
import DownloadIcon from '@mui/icons-material/Download'
import { IconButton, Tooltip } from '@mui/material'
import { APP_COLORS } from '../../theme/truistPalette'

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
  /** Disable sort for this specific column (default: sortable) */
  disableSort?: boolean
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
  /** Accent color for header left border strip */
  accentColor?: string
  /** Optional minimum width for the inner table to enable horizontal scrolling */
  tableMinWidth?: number | string
  /**
   * When set, enables pagination once rows exceed this threshold.
   * E.g. pageSize={500} shows pages of 500 rows when total > 500.
   */
  pageSize?: number
}

function getKey<T>(row: T, rowKey: DataTableProps<T>['rowKey'], idx: number): string {
  if (!rowKey) return String(idx)
  if (typeof rowKey === 'string') return `${String((row as any)[rowKey] ?? idx)}-${idx}`
  return `${rowKey(row)}-${idx}`
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
  accentColor = APP_COLORS.primary,
  tableMinWidth,
  pageSize,
}: DataTableProps<T>) {
  const safeColumns = useMemo(
    () => columns.filter((col): col is ColumnDef<T> => Boolean(col && typeof col.key === 'string' && col.key.length > 0)),
    [columns]
  )
  const cellPy = compact ? 0.6 : 1
  const resolvedHeaderBg = headerBg ?? '#f0f4f8'
  const sampledRows = useMemo(() => rows.slice(0, 200), [rows])

  const inferColumnWidth = useCallback((col: ColumnDef<T>) => {
    const headerChars = String(col.header ?? '').length
    const contentChars = sampledRows.reduce((maxChars, row) => {
      const raw = (row as any)?.[col.key]
      const len = raw == null ? 0 : String(raw).length
      return Math.max(maxChars, len)
    }, 0)

    const maxChars = Math.max(headerChars, contentChars)
    const autoWidth = Math.min(420, Math.max(90, Math.ceil(maxChars * 7 + 42)))

    if (typeof col.width === 'number') {
      return Math.max(col.width, autoWidth)
    }
    if (typeof col.width === 'string') {
      const numeric = parseInt(col.width, 10)
      if (!isNaN(numeric)) return Math.max(numeric, autoWidth)
    }
    if (col.flex) {
      return Math.max(160, autoWidth)
    }
    return autoWidth
  }, [sampledRows])

  // ── Sort ─────────────────────────────────────────────────
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  // ── Pagination ────────────────────────────────────────────
  const [page, setPage] = useState(0)

  // ── Global filter ─────────────────────────────────────────
  const [filterText, setFilterText] = useState('')

  // ── Column widths (resize) ────────────────────────────────
  const [colWidths, setColWidths] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {}
    safeColumns.forEach(col => {
      init[col.key] = typeof col.width === 'number' ? col.width : col.flex ? 160 : 110
    })
    return init
  })

  useEffect(() => {
    setColWidths(prev => {
      const next: Record<string, number> = {}
      safeColumns.forEach(col => {
        const inferred = inferColumnWidth(col)
        // Keep manual resize if user expanded wider than inferred; still auto-grow if inferred is larger.
        next[col.key] = Math.max(prev[col.key] ?? 0, inferred)
      })
      return next
    })
  }, [safeColumns, sampledRows, inferColumnWidth])

  const resizingRef = useRef<{ key: string; startX: number; startWidth: number } | null>(null)

  const handleResizeMouseDown = useCallback((e: React.MouseEvent, key: string) => {
    e.preventDefault()
    e.stopPropagation()
    resizingRef.current = { key, startX: e.clientX, startWidth: colWidths[key] ?? 100 }
    const onMouseMove = (ev: MouseEvent) => {
      if (!resizingRef.current) return
      const newW = Math.max(40, resizingRef.current.startWidth + ev.clientX - resizingRef.current.startX)
      setColWidths(prev => ({ ...prev, [resizingRef.current!.key]: newW }))
    }
    const onMouseUp = () => {
      resizingRef.current = null
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }, [colWidths])

  const handleSort = (col: ColumnDef<T>) => {
    if (col.disableSort) return
    if (sortKey === col.key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(col.key)
      setSortDir('asc')
    }
  }

  // ── Filter ────────────────────────────────────────────────
  const needle = filterText.trim().toLowerCase()
  const filtered = needle
    ? rows.filter(row =>
        safeColumns.some(col => {
          const val = (row as any)[col.key]
          return val != null && String(val).toLowerCase().includes(needle)
        })
      )
    : rows

  // ── Sort ─────────────────────────────────────────────────
  const displayRows = sortKey
    ? [...filtered].sort((a, b) => {
        const av = (a as any)[sortKey]
        const bv = (b as any)[sortKey]
        const cmp =
          av == null ? 1 :
          bv == null ? -1 :
          typeof av === 'number' && typeof bv === 'number'
            ? av - bv
            : String(av).localeCompare(String(bv), undefined, { numeric: true })
        return sortDir === 'asc' ? cmp : -cmp
      })
    : filtered

  // ── Pagination ────────────────────────────────────────────
  const usePagination = pageSize != null && displayRows.length > pageSize
  const pagedRows = usePagination
    ? displayRows.slice(page * pageSize!, (page + 1) * pageSize!)
    : displayRows

  const resolvedTableMinWidth = typeof tableMinWidth === 'number'
    ? `${tableMinWidth}px`
    : tableMinWidth

  const parsedTableMinWidth = useMemo(() => {
    if (typeof tableMinWidth === 'number') return tableMinWidth
    if (typeof tableMinWidth === 'string') {
      const parsed = parseInt(tableMinWidth, 10)
      return isNaN(parsed) ? 0 : parsed
    }
    return 0
  }, [tableMinWidth])

  const totalColumnWidth = useMemo(
    () => safeColumns.reduce((sum, col) => sum + (colWidths[col.key] ?? inferColumnWidth(col)), 0),
    [safeColumns, colWidths, inferColumnWidth]
  )

  const computedTableWidth = Math.max(totalColumnWidth, parsedTableMinWidth)

  // ── CSV export ────────────────────────────────────────────
  const exportCsv = () => {
    if (displayRows.length === 0) return
    const headers = safeColumns.map(c => c.header)
    const csvRows = [
      headers.join(','),
      ...displayRows.map(row =>
        safeColumns.map(col => {
          const val = (row as any)[col.key]
          const str = val == null ? '' : String(val).replace(/"/g, '""')
          return `"${str}"`
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

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>

      {/* ── Search / filter bar ── */}
      <Box sx={{
        display: 'flex', alignItems: 'center', gap: 1,
        backgroundColor: '#f8f9fb', border: '1px solid #e8ecf1',
        borderRadius: 1.5, px: 1.5, py: 0.4,
      }}>
        <SearchIcon sx={{ fontSize: 14, color: '#b0bec5', flexShrink: 0 }} />
        <InputBase
          value={filterText}
          onChange={e => setFilterText(e.target.value)}
          placeholder="Filter rows…"
          sx={{ fontSize: '12px', color: '#333', flex: 1, '& input': { py: 0.2 } }}
        />
        {filterText && (
          <Typography
            onClick={() => setFilterText('')}
            sx={{ fontSize: '11px', color: '#b0bec5', cursor: 'pointer', userSelect: 'none', flexShrink: 0, '&:hover': { color: '#78909c' } }}
          >
            ✕
          </Typography>
        )}
        <Typography sx={{ fontSize: '10px', color: '#cfd8dc', flexShrink: 0 }}>
          {displayRows.length}/{rows.length}
        </Typography>
        <Tooltip title={`Download ${displayRows.length} rows as CSV`} placement="top">
          <span>
            <IconButton
              size="small"
              onClick={exportCsv}
              disabled={displayRows.length === 0}
              sx={{
                p: 0.4,
                color: '#90a4ae',
                '&:hover': { color: accentColor, backgroundColor: `${accentColor}12` },
                '&.Mui-disabled': { color: '#dde' },
              }}
            >
              <DownloadIcon sx={{ fontSize: 14 }} />
            </IconButton>
          </span>
        </Tooltip>
      </Box>

      {/* ── Table ── */}
      <Box
        sx={{
          overflowX: 'scroll',
          borderRadius: 1.5,
          border: '1px solid #e8ecf1',
          scrollbarWidth: 'thin',
          '&::-webkit-scrollbar': { height: 10, width: 10 },
          '&::-webkit-scrollbar-thumb': { backgroundColor: '#c7d1db', borderRadius: 8 },
          '&::-webkit-scrollbar-track': { backgroundColor: '#eef3f8' },
          ...(maxHeight ? { maxHeight, overflowY: 'auto' } : {}),
        }}
      >
        <Table
          size="small"
          stickyHeader
          sx={{
            tableLayout: 'fixed',
            width: computedTableWidth > 0 ? `max(100%, ${computedTableWidth}px)` : (resolvedTableMinWidth ? `max(100%, ${resolvedTableMinWidth})` : '100%'),
            minWidth: resolvedTableMinWidth,
          }}
        >
          <TableHead>
            <TableRow>
              {safeColumns.map((col, colIdx) => {
                const w = colWidths[col.key]
                const isSorted = sortKey === col.key
                return (
                  <TableCell
                    key={col.key}
                    align={col.align ?? 'left'}
                    onClick={() => handleSort(col)}
                    sx={{
                      fontSize: '10px',
                      fontWeight: 700,
                      color: isSorted ? accentColor : '#4a5568',
                      py: cellPy,
                      px: 1.5,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      whiteSpace: 'nowrap',
                      borderBottom: `2px solid ${accentColor}33`,
                      backgroundColor: `${resolvedHeaderBg} !important`,
                      width: w,
                      minWidth: w,
                      maxWidth: w,
                      cursor: col.disableSort ? 'default' : 'pointer',
                      userSelect: 'none',
                      position: 'sticky',
                      top: 0,
                      zIndex: 3,
                      overflow: 'hidden',
                      ...(colIdx === 0 ? {
                        borderLeft: `3px solid ${accentColor}`,
                        pl: '10px',
                      } : {}),
                      '&:hover': col.disableSort ? {} : { backgroundColor: `${accentColor}10 !important` },
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.4, overflow: 'hidden' }}>
                      <Typography sx={{
                        fontSize: '10px', fontWeight: 700,
                        color: isSorted ? accentColor : '#4a5568',
                        textTransform: 'uppercase', letterSpacing: '0.5px',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {col.header}
                      </Typography>
                      {!col.disableSort && (
                        <Box sx={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>
                          {isSorted
                            ? sortDir === 'asc'
                              ? <ArrowUpwardIcon sx={{ fontSize: 10, color: accentColor }} />
                              : <ArrowDownwardIcon sx={{ fontSize: 10, color: accentColor }} />
                            : <UnfoldMoreIcon sx={{ fontSize: 10, color: '#cfd8dc' }} />
                          }
                        </Box>
                      )}
                    </Box>
                    {/* Resize handle */}
                    <Box
                      onMouseDown={e => handleResizeMouseDown(e, col.key)}
                      onClick={e => e.stopPropagation()}
                      sx={{
                        position: 'absolute', right: 0, top: 0, bottom: 0,
                        width: 5, cursor: 'col-resize', zIndex: 1,
                        backgroundColor: 'transparent',
                        transition: 'background 0.15s',
                        '&:hover': { backgroundColor: `${accentColor}50` },
                      }}
                    />
                  </TableCell>
                )
              })}
            </TableRow>
          </TableHead>

          <TableBody>
            {displayRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={safeColumns.length || 1} sx={{ border: 0 }}>
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 4, gap: 1 }}>
                    <TableRowsIcon sx={{ fontSize: 28, color: '#d0d5dd' }} />
                    <Typography sx={{ fontSize: '12px', color: '#aab', fontWeight: 500 }}>
                      {needle ? `No rows match "${filterText}"` : emptyMessage}
                    </Typography>
                  </Box>
                </TableCell>
              </TableRow>
            ) : (
              pagedRows.map((row, idx) => (
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
                  {safeColumns.map((col, colIdx) => (
                    <TableCell
                      key={col.key}
                      align={col.align ?? 'left'}
                      sx={{
                        fontSize: compact ? '11px' : '12px',
                        color: '#2d3748',
                        py: cellPy,
                        px: 1.5,
                        borderBottom: '1px solid #f0f2f5',
                        overflow: 'hidden',
                        width: colWidths[col.key],
                        minWidth: colWidths[col.key],
                        maxWidth: colWidths[col.key],
                        ...(col.noWrap ? { whiteSpace: 'nowrap' } : {}),
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

      {/* ── Pagination footer ── */}
      {usePagination && (
        <TablePagination
          component="div"
          count={displayRows.length}
          page={page}
          onPageChange={(_e, p) => setPage(p)}
          rowsPerPage={pageSize!}
          rowsPerPageOptions={[pageSize!]}
          sx={{
            fontSize: '11px',
            '& .MuiTablePagination-selectLabel, & .MuiTablePagination-displayedRows': { fontSize: '11px' },
            '& .MuiTablePagination-toolbar': { minHeight: 36, pl: 1 },
            borderTop: '1px solid #e8ecf1',
          }}
        />
      )}
    </Box>
  )
}
