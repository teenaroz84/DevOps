import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DonutChart, DonutSlice } from '../DonutChart'

const slices: DonutSlice[] = [
  { name: 'Success', value: 100, color: '#2e7d32' },
  { name: 'Failed', value: 20, color: '#d32f2f' },
  { name: 'Pending', value: 5, color: '#f57c00' },
]

describe('DonutChart', () => {
  it('renders without crashing', () => {
    const { container } = render(<DonutChart data={slices} />)
    expect(container.querySelector('.recharts-pie')).toBeInTheDocument()
  })

  it('shows legend items by default', () => {
    render(<DonutChart data={slices} />)
    expect(screen.getByText('Success')).toBeInTheDocument()
    expect(screen.getByText('Failed')).toBeInTheDocument()
    expect(screen.getByText('Pending')).toBeInTheDocument()
  })

  it('hides legend when showLegend is false', () => {
    render(<DonutChart data={slices} showLegend={false} />)
    expect(screen.queryByText('Success')).not.toBeInTheDocument()
  })

  it('displays title when showTitle is true', () => {
    render(<DonutChart data={slices} title="Pipeline Status" showTitle />)
    expect(screen.getByText('Pipeline Status')).toBeInTheDocument()
  })

  it('hides title when showTitle is false', () => {
    render(<DonutChart data={slices} title="Pipeline Status" showTitle={false} />)
    expect(screen.queryByText('Pipeline Status')).not.toBeInTheDocument()
  })

  it('renders center label when provided', () => {
    render(<DonutChart data={slices} centerLabel={125} />)
    expect(screen.getByText('125')).toBeInTheDocument()
  })

  it('renders string center label', () => {
    render(<DonutChart data={slices} centerLabel="Total" />)
    expect(screen.getByText('Total')).toBeInTheDocument()
  })

  it('displays legend values formatted with locale string', () => {
    const bigSlices: DonutSlice[] = [
      { name: 'Big', value: 1500, color: '#000' },
    ]
    render(<DonutChart data={bigSlices} />)
    expect(screen.getByText('1,500')).toBeInTheDocument()
  })
})
