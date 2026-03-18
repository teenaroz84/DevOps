import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MetricBarList } from '../MetricBarList'

describe('MetricBarList', () => {
  const items = [
    { label: 'Extraction', value: 42, max: 100 },
    { label: 'Transform', value: 78, max: 100 },
    { label: 'Load', value: 15, max: 100, suffix: 'ms' },
  ]

  it('renders all metric labels', () => {
    render(<MetricBarList items={items} />)
    expect(screen.getByText('Extraction')).toBeInTheDocument()
    expect(screen.getByText('Transform')).toBeInTheDocument()
    expect(screen.getByText('Load')).toBeInTheDocument()
  })

  it('renders values', () => {
    render(<MetricBarList items={items} />)
    expect(screen.getByText('42')).toBeInTheDocument()
    expect(screen.getByText('78')).toBeInTheDocument()
  })

  it('renders suffix when provided on item', () => {
    render(<MetricBarList items={items} />)
    expect(screen.getByText(/15/)).toBeInTheDocument()
  })
})
