import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { DataTable } from '../DataTable'

describe('DataTable', () => {
  const columns = [
    { key: 'name', header: 'Name' },
    { key: 'status', header: 'Status' },
  ]
  const rows = [
    { name: 'Job Alpha', status: 'Running' },
    { name: 'Job Beta', status: 'Failed' },
  ]

  it('renders column headers', () => {
    render(<DataTable columns={columns} rows={rows} />)
    expect(screen.getByText('Name')).toBeInTheDocument()
    expect(screen.getByText('Status')).toBeInTheDocument()
  })

  it('renders row data', () => {
    render(<DataTable columns={columns} rows={rows} />)
    expect(screen.getByText('Job Alpha')).toBeInTheDocument()
    expect(screen.getByText('Failed')).toBeInTheDocument()
  })

  it('shows empty message when no rows', () => {
    render(<DataTable columns={columns} rows={[]} emptyMessage="Nothing here" />)
    expect(screen.getByText('Nothing here')).toBeInTheDocument()
  })

  it('fires onRowClick when a row is clicked', () => {
    const onClick = vi.fn()
    render(<DataTable columns={columns} rows={rows} onRowClick={onClick} />)
    fireEvent.click(screen.getByText('Job Alpha'))
    expect(onClick).toHaveBeenCalledWith(rows[0])
  })
})
