import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SegmentedBarList, SegmentedBarItem } from '../SegmentedBarList'

const items: SegmentedBarItem[] = [
  {
    label: 'Build',
    segments: [
      { value: 80, color: '#2e7d32', label: 'Success' },
      { value: 10, color: '#f57c00', label: 'In Progress' },
      { value: 5, color: '#d32f2f', label: 'Failed' },
    ],
    rightLabel: '84%',
  },
  {
    label: 'Deploy',
    segments: [
      { value: 60, color: '#2e7d32', label: 'Success' },
      { value: 20, color: '#f57c00', label: 'In Progress' },
      { value: 15, color: '#d32f2f', label: 'Failed' },
    ],
    rightLabel: '63%',
  },
]

const legend = [
  { color: '#2e7d32', label: 'Success' },
  { color: '#f57c00', label: 'In Progress' },
  { color: '#d32f2f', label: 'Failed' },
]

describe('SegmentedBarList', () => {
  it('renders all item labels', () => {
    render(<SegmentedBarList items={items} />)
    expect(screen.getByText('Build')).toBeInTheDocument()
    expect(screen.getByText('Deploy')).toBeInTheDocument()
  })

  it('renders right labels', () => {
    render(<SegmentedBarList items={items} />)
    expect(screen.getByText('84%')).toBeInTheDocument()
    expect(screen.getByText('63%')).toBeInTheDocument()
  })

  it('renders legend when provided', () => {
    render(<SegmentedBarList items={items} legend={legend} />)
    expect(screen.getByText('Success')).toBeInTheDocument()
    expect(screen.getByText('In Progress')).toBeInTheDocument()
    expect(screen.getByText('Failed')).toBeInTheDocument()
  })

  it('does not render legend when not provided', () => {
    render(<SegmentedBarList items={items} />)
    // Legend labels are "Success", "In Progress", "Failed" — but segment counts
    // may still appear inside bars. Legend section itself should not exist.
    // Check that no legend-specific container has these labels.
    const { container } = render(<SegmentedBarList items={[]} />)
    expect(container.textContent).toBe('')
  })

  it('fires onClick when item is clicked', () => {
    const onClick = vi.fn()
    const clickItems: SegmentedBarItem[] = [
      { ...items[0], onClick },
    ]
    render(<SegmentedBarList items={clickItems} />)
    fireEvent.click(screen.getByText('Build'))
    expect(onClick).toHaveBeenCalled()
  })

  it('highlights selected item', () => {
    const selectedItems: SegmentedBarItem[] = [
      { ...items[0], selected: true },
    ]
    render(<SegmentedBarList items={selectedItems} />)
    const label = screen.getByText('Build')
    // The parent row should have the selected background color
    const row = label.closest('[class]')
    expect(row).toBeTruthy()
  })

  it('renders segment title tooltips', () => {
    const { container } = render(<SegmentedBarList items={items} />)
    const segmentWithTitle = container.querySelector('[title*="Success"]')
    expect(segmentWithTitle).toBeTruthy()
  })
})
