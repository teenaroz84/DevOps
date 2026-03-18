import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AlertBanner } from '../AlertBanner'

describe('AlertBanner', () => {
  it('renders title text', () => {
    render(<AlertBanner title="System Alert" />)
    expect(screen.getByText('System Alert')).toBeInTheDocument()
  })

  it('renders optional message', () => {
    render(<AlertBanner title="Warning" message="Disk space low" />)
    expect(screen.getByText('Disk space low')).toBeInTheDocument()
  })

  it('renders actions when provided', () => {
    render(
      <AlertBanner title="Alert" actions={<button>Dismiss</button>} />,
    )
    expect(screen.getByText('Dismiss')).toBeInTheDocument()
  })
})
