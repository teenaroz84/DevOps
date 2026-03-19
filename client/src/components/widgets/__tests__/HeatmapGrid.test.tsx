import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { HeatmapGrid } from '../HeatmapGrid'

const rows = ['Pipeline A', 'Pipeline B']
const cols = ['Mon', 'Tue', 'Wed']
const values = [
  [95, 50, 15],
  [70, 30, 85],
]

describe('HeatmapGrid', () => {
  it('renders the correct number of cells', () => {
    const { container } = render(
      <HeatmapGrid rows={rows} cols={cols} values={values} />
    )
    // Each cell gets a title attribute; count them
    const cells = container.querySelectorAll('[title]')
    expect(cells.length).toBeGreaterThanOrEqual(rows.length * cols.length)
  })

  it('shows legend by default', () => {
    render(<HeatmapGrid rows={rows} cols={cols} values={values} />)
    expect(screen.getByText('Healthy')).toBeInTheDocument()
    expect(screen.getByText('At Risk')).toBeInTheDocument()
    expect(screen.getByText('Critical')).toBeInTheDocument()
  })

  it('hides legend when showLegend is false', () => {
    render(
      <HeatmapGrid rows={rows} cols={cols} values={values} showLegend={false} />
    )
    expect(screen.queryByText('Healthy')).not.toBeInTheDocument()
  })

  it('shows row labels when showRowLabels is true', () => {
    render(
      <HeatmapGrid rows={rows} cols={cols} values={values} showRowLabels />
    )
    expect(screen.getByText('Pipeline A')).toBeInTheDocument()
    expect(screen.getByText('Pipeline B')).toBeInTheDocument()
  })

  it('hides row labels by default', () => {
    render(<HeatmapGrid rows={rows} cols={cols} values={values} />)
    expect(screen.queryByText('Pipeline A')).not.toBeInTheDocument()
  })

  it('calls onCellClick with correct arguments', () => {
    const onClick = vi.fn()
    const { container } = render(
      <HeatmapGrid rows={rows} cols={cols} values={values} onCellClick={onClick} />
    )
    // Click the first cell (title contains row and value info)
    const firstCell = container.querySelector('[title*="Pipeline A"]')
    expect(firstCell).toBeTruthy()
    fireEvent.click(firstCell!)
    expect(onClick).toHaveBeenCalledWith('Pipeline A', 'Mon', 95, 0, 0)
  })

  it('renders cell with title containing value', () => {
    const { container } = render(
      <HeatmapGrid rows={['R']} cols={['C']} values={[[95]]} showLegend={false} />
    )
    const cell = container.querySelector('[title]') as HTMLElement
    expect(cell).toBeTruthy()
    expect(cell.getAttribute('title')).toContain('95')
  })
})
