import { MantineProvider } from '@mantine/core'
import { ModalsProvider } from '@mantine/modals'
import { Notifications } from '@mantine/notifications'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../src/api/endpoints', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/api/endpoints')>()
  return {
    ...actual,
    listTeacherPlugins: vi.fn(),
  }
})

import { listTeacherPlugins } from '../../src/api/endpoints'
import { ClassroomPage } from '../../src/pages/ClassroomPage'
import type { UseAuthResult } from '../../src/hooks/useAuth'

function auth(): UseAuthResult {
  return {
    isAuthenticated: true,
    isLoading: false,
    teacher: { teacherId: 'teacher_alice', teacherName: 'Ms. Alice' },
    refresh: async () => {},
    logout: async () => {},
  }
}

function renderPage() {
  return render(
    <MantineProvider>
      <ModalsProvider>
        <Notifications />
        <MemoryRouter>
          <ClassroomPage auth={auth()} />
        </MemoryRouter>
      </ModalsProvider>
    </MantineProvider>
  )
}

describe('ClassroomPage', () => {
  beforeEach(() => {
    vi.mocked(listTeacherPlugins).mockResolvedValue({
      joinCode: 'ALPHA1',
      plugins: [
        {
          pluginId: 'chess',
          pluginName: 'Chess Tutor',
          description: 'Chess',
          author: 'Team',
          category: 'Math',
          averageRating: 4.7,
          status: 'pending_review',
          addedAt: 1,
          approvedAt: null,
          deployedAt: null,
          revokedAt: null,
          screenshotKey: 'k',
        },
        {
          pluginId: 'weather',
          pluginName: 'Weather Explorer',
          description: 'Weather',
          author: 'Skylab',
          category: 'Science',
          averageRating: 4.5,
          status: 'deployed',
          addedAt: 1,
          approvedAt: 2,
          deployedAt: 3,
          revokedAt: null,
          screenshotKey: 'k',
        },
      ],
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('renders the join code', async () => {
    renderPage()
    await waitFor(() => {
      expect(screen.getByText('ALPHA1')).toBeInTheDocument()
    })
  })

  it('groups plugins into status sections', async () => {
    renderPage()
    await waitFor(() => {
      // Section headings have the "(1)" count suffix
      expect(screen.getByText(/Pending Review \(1\)/)).toBeInTheDocument()
      expect(screen.getByText(/Deployed \(1\)/)).toBeInTheDocument()
      expect(screen.getByText('Chess Tutor')).toBeInTheDocument()
      expect(screen.getByText('Weather Explorer')).toBeInTheDocument()
    })
  })

  it('shows empty state alert when no plugins', async () => {
    vi.mocked(listTeacherPlugins).mockResolvedValue({ joinCode: 'ALPHA1', plugins: [] })
    renderPage()
    await waitFor(() => {
      expect(screen.getByText(/Your classroom is empty/i)).toBeInTheDocument()
    })
  })
})
