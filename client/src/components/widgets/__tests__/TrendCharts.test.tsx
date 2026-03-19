import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { TrendLineChart, ComposedBarLineChart } from '../TrendCharts'

const lineData = [
  { month: 'Jan', failures: 80, recovery: 40 },
  { month: 'Feb', failures: 60, recovery: 55 },
  { month: 'Mar', failures: 45, recovery: 70 },
]

const composedData = [
  { date: 'Mar 10', total: 160, failed: 9, successRate: 94.4 },
  { date: 'Mar 11', total: 150, failed: 12, successRate: 92.0 },
  { date: 'Mar 12', total: 170, failed: 5, successRate: 97.1 },
]

describe('TrendLineChart', () => {
  it('renders without crashing', () => {
    const { container } = render(
      <TrendLineChart
        data={lineData}
        xKey="month"
        lines={[
          { key: 'failures', label: 'Failures', color: '#d32f2f' },
          { key: 'recovery', label: 'Recovery', color: '#2e7d32' },
        ]}
      />
    )
    expect(container.querySelector('.recharts-responsive-container')).toBeInTheDocument()
  })

  it('renders a responsive container for the chart', () => {
    const { container } = render(
      <TrendLineChart
        data={lineData}
        xKey="month"
        lines={[
          { key: 'failures', label: 'Failures', color: '#d32f2f' },
          { key: 'recovery', label: 'Recovery', color: '#2e7d32' },
        ]}
      />
    )
    expect(container.querySelector('.recharts-responsive-container')).toBeInTheDocument()
  })

  it('renders with custom height', () => {
    const { container } = render(
      <TrendLineChart
        data={lineData}
        xKey="month"
        lines={[{ key: 'failures', label: 'Failures', color: '#d32f2f' }]}
        height={300}
      />
    )
    expect(container.firstChild).toBeTruthy()
  })

  it('renders without grid when showGrid is false', () => {
    const { container } = render(
      <TrendLineChart
        data={lineData}
        xKey="month"
        lines={[{ key: 'failures', label: 'Failures', color: '#d32f2f' }]}
        showGrid={false}
      />
    )
    expect(container.querySelector('.recharts-cartesian-grid')).toBeNull()
  })
})

describe('ComposedBarLineChart', () => {
  it('renders without crashing', () => {
    const { container } = render(
      <ComposedBarLineChart
        data={composedData}
        xKey="date"
        bars={[
          { key: 'total', label: 'Total Runs', color: '#1976d2' },
          { key: 'failed', label: 'Failed', color: '#d32f2f' },
        ]}
        lines={[
          { key: 'successRate', label: 'Success Rate', color: '#2e7d32', yAxisId: 'right' },
        ]}
        rightYDomain={[85, 100]}
      />
    )
    expect(container.querySelector('.recharts-responsive-container')).toBeInTheDocument()
  })

  it('renders a responsive container for bars and lines', () => {
    const { container } = render(
      <ComposedBarLineChart
        data={composedData}
        xKey="date"
        bars={[
          { key: 'total', label: 'Total', color: '#1976d2' },
        ]}
        lines={[
          { key: 'successRate', label: 'Rate', color: '#2e7d32' },
        ]}
      />
    )
    expect(container.querySelector('.recharts-responsive-container')).toBeInTheDocument()
  })

  it('renders with default props', () => {
    const { container } = render(
      <ComposedBarLineChart
        data={composedData}
        xKey="date"
        bars={[{ key: 'total', label: 'Total', color: '#1976d2' }]}
        lines={[{ key: 'successRate', label: 'Rate', color: '#2e7d32' }]}
      />
    )
    expect(container.firstChild).toBeTruthy()
  })
})
