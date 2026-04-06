import { MantineProvider } from '@mantine/core'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { Layout } from '../../src/components/Layout'
import type { UseAuthResult } from '../../src/hooks/useAuth'

function unauthenticatedAuth(): UseAuthResult {
  return {
    isAuthenticated: false,
    isLoading: false,
    teacher: null,
    refresh: async () => {},
    logout: async () => {},
  }
}

function authenticatedAuth(): UseAuthResult {
  return {
    isAuthenticated: true,
    isLoading: false,
    teacher: { teacherId: 't1', teacherName: 'Ms. Tester' },
    refresh: async () => {},
    logout: async () => {},
  }
}

function renderLayout(auth: UseAuthResult, children: React.ReactNode = <div>content</div>) {
  return render(
    <MantineProvider>
      <MemoryRouter>
        <Layout auth={auth}>{children}</Layout>
      </MemoryRouter>
    </MantineProvider>
  )
}

describe('Layout', () => {
  it('renders the brand title', () => {
    renderLayout(unauthenticatedAuth())
    expect(screen.getByText('ChatBridge Marketplace')).toBeInTheDocument()
  })

  it('shows Browse and Submit nav links for unauthenticated users', () => {
    renderLayout(unauthenticatedAuth())
    expect(screen.getAllByText('Browse').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Submit Plugin').length).toBeGreaterThan(0)
  })

  it('does not show "My Classroom" for unauthenticated users', () => {
    renderLayout(unauthenticatedAuth())
    expect(screen.queryByText('My Classroom')).toBeNull()
  })

  it('shows "My Classroom" and teacher name for authenticated users', () => {
    renderLayout(authenticatedAuth())
    expect(screen.getAllByText('My Classroom').length).toBeGreaterThan(0)
    expect(screen.getByText('Ms. Tester')).toBeInTheDocument()
  })

  it('renders children inside the main area', () => {
    renderLayout(unauthenticatedAuth(), <div data-testid="test-content">hello</div>)
    expect(screen.getByTestId('test-content')).toBeInTheDocument()
  })
})
