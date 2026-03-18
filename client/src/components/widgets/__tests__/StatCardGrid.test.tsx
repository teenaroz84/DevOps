import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { StatCardGrid } from '../StatCardGrid'

describe('StatCardGrid', () => {
  const items = [
    { label: 'Total Jobs', value: 1234, color: '#1976d2' },
    { label: 'Failures', value: 56, color: '#d32f2f', trend: '-12%' },
    { label: 'Success Rate', value: 95, unit: '%', color: '#2e7d32', trend: '+3%' },
  ]

  it('renders all stat cards', () => {
    render(<StatCardGrid items={items} />)
    expect(screen.getByText('Total Jobs')).toBeInTheDocument()
    expect(screen.getByText('1234')).toBeInTheDocument()
    expect(screen.getByText('Failures')).toBeInTheDocument()
    expect(screen.getByText('56')).toBeInTheDocument()
    expect(screen.getByText('Success Rate')).toBeInTheDocument()
  })

  it('renders unit when provided', () => {
    render(<StatCardGrid items={items} />)
    expect(screen.getByText('%')).toBeInTheDocument()
  })

  it('fires onCardClick with item and index', () => {
    const onClick = vi.fn()
    render(<StatCardGrid items={items} onCardClick={onClick} />)
    fireEvent.click(screen.getByText('Total Jobs'))
    expect(onClick).toHaveBeenCalledWith(items[0], 0)
  })
})
