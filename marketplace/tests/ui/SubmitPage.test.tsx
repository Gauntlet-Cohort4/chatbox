import { MantineProvider } from '@mantine/core'
import { Notifications } from '@mantine/notifications'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../src/api/endpoints', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/api/endpoints')>()
  return {
    ...actual,
    submitPlugin: vi.fn(),
  }
})

import { submitPlugin } from '../../src/api/endpoints'
import { SubmitPage } from '../../src/pages/SubmitPage'

function renderPage() {
  return render(
    <MantineProvider>
      <Notifications />
      <MemoryRouter>
        <SubmitPage />
      </MemoryRouter>
    </MantineProvider>
  )
}

describe('SubmitPage', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('renders all form section headings', () => {
    renderPage()
    expect(screen.getByText('Submit a plugin')).toBeInTheDocument()
    expect(screen.getByText('Plugin info')).toBeInTheDocument()
    expect(screen.getByText('Technical')).toBeInTheDocument()
    expect(screen.getByText('Authentication')).toBeInTheDocument()
    expect(screen.getByText('Files')).toBeInTheDocument()
    expect(screen.getByText('Author')).toBeInTheDocument()
  })

  it('shows bundle field as required', () => {
    renderPage()
    const bundleLabel = screen.getByText(/Bundle \(\.zip, max 5MB\)/)
    expect(bundleLabel).toBeInTheDocument()
  })

  it('blocks submission when required fields are empty', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(screen.getByRole('button', { name: /Submit plugin/i }))
    // submitPlugin should NOT have been called — validation failed
    expect(vi.mocked(submitPlugin)).not.toHaveBeenCalled()
  })

  it('shows OAuth fields only when authType is oauth2-pkce', async () => {
    const user = userEvent.setup()
    renderPage()
    expect(screen.queryByLabelText(/Authorization URL/)).toBeNull()
    await user.click(screen.getByLabelText(/OAuth2 PKCE/))
    expect(screen.getByLabelText(/Authorization URL/)).toBeInTheDocument()
  })
})
