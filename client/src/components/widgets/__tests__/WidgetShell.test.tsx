import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { WidgetShell } from '../WidgetShell'

describe('WidgetShell', () => {
  it('renders title and children', () => {
    render(
      <WidgetShell title="My Widget">
        <p>Widget content</p>
      </WidgetShell>,
    )
    expect(screen.getByText('My Widget')).toBeInTheDocument()
    expect(screen.getByText('Widget content')).toBeInTheDocument()
  })

  it('renders source badge when provided', () => {
    render(
      <WidgetShell title="Test" source="CloudWatch">
        <span />
      </WidgetShell>,
    )
    expect(screen.getByText('CloudWatch')).toBeInTheDocument()
  })

  it('shows loading spinner when loading', () => {
    render(
      <WidgetShell title="Test" loading>
        <span>hidden</span>
      </WidgetShell>,
    )
    expect(screen.getByRole('progressbar')).toBeInTheDocument()
  })

  it('shows error message when error is set', () => {
    render(
      <WidgetShell title="Test" error="Something went wrong">
        <span>hidden</span>
      </WidgetShell>,
    )
    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
  })

  it('renders actions in header', () => {
    render(
      <WidgetShell title="Test" actions={<button>Refresh</button>}>
        <span />
      </WidgetShell>,
    )
    expect(screen.getByText('Refresh')).toBeInTheDocument()
  })
})
