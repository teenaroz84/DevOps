import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { WidgetDetailModal } from '../WidgetDetailModal'

describe('WidgetDetailModal', () => {
  const defaultProps = {
    open: true,
    onClose: vi.fn(),
    title: 'Total Runs',
    value: 1500,
    unit: 'jobs',
    description: 'Total DMF jobs executed this week',
    stats: [
      { label: 'Success', value: '1400' },
      { label: 'Failed', value: '100' },
    ],
  }

  it('renders title, value, and unit when open', () => {
    render(<WidgetDetailModal {...defaultProps} />)
    expect(screen.getByText('Total Runs')).toBeInTheDocument()
    expect(screen.getByText('1500')).toBeInTheDocument()
    expect(screen.getByText('jobs')).toBeInTheDocument()
  })

  it('renders description', () => {
    render(<WidgetDetailModal {...defaultProps} />)
    expect(screen.getByText('Total DMF jobs executed this week')).toBeInTheDocument()
  })

  it('renders stat tiles', () => {
    render(<WidgetDetailModal {...defaultProps} />)
    expect(screen.getByText('Success')).toBeInTheDocument()
    expect(screen.getByText('1400')).toBeInTheDocument()
    expect(screen.getByText('Failed')).toBeInTheDocument()
    expect(screen.getByText('100')).toBeInTheDocument()
  })

  it('calls onClose when close button is clicked', () => {
    const onClose = vi.fn()
    render(<WidgetDetailModal {...defaultProps} onClose={onClose} />)
    fireEvent.click(screen.getByText('Close'))
    expect(onClose).toHaveBeenCalled()
  })
})
