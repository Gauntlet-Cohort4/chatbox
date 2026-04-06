import { MantineProvider } from '@mantine/core'
import { Notifications } from '@mantine/notifications'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../src/api/endpoints', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/api/endpoints')>()
  return {
    ...actual,
    getPluginDetail: vi.fn(),
    listReviews: vi.fn(),
  }
})

import { getPluginDetail, listReviews } from '../../src/api/endpoints'
import { PluginDetailPage } from '../../src/pages/PluginDetailPage'
import type { UseAuthResult } from '../../src/hooks/useAuth'

function unauth(): UseAuthResult {
  return {
    isAuthenticated: false,
    isLoading: false,
    teacher: null,
    refresh: async () => {},
    logout: async () => {},
  }
}

function sampleDetail() {
  return {
    pluginId: 'chess',
    pluginName: 'Chess Tutor',
    description: 'Interactive chess board.',
    version: '1.0.0',
    author: 'ChatBridge Team',
    authorEmail: null,
    category: 'Math',
    contentRating: 'educational',
    toolDefinitions: '[]',
    userInterfaceConfig: '{"sandboxPermissions":["allow-scripts"]}',
    authenticationConfig: '{"authType":"none"}',
    contextPrompt: 'Guide the student',
    capabilities: '{"supportsScreenshot":true}',
    bundleUrl: 'bundles/chess/1.0.0/bundle.zip',
    bundleVersion: '1.0.0',
    bundleHash: 'deadbeef',
    bundleSizeBytes: 130000,
    screenshotKey: 'screenshots/chess/screenshot.png',
    averageRating: 4.7,
    totalRatings: 12,
    submittedAt: 1696100000000,
  }
}

function renderDetail(pluginId = 'chess') {
  return render(
    <MantineProvider>
      <Notifications />
      <MemoryRouter initialEntries={[`/plugin/${pluginId}`]}>
        <Routes>
          <Route path="/plugin/:pluginId" element={<PluginDetailPage auth={unauth()} />} />
        </Routes>
      </MemoryRouter>
    </MantineProvider>
  )
}

describe('PluginDetailPage', () => {
  beforeEach(() => {
    vi.mocked(getPluginDetail).mockResolvedValue(sampleDetail())
    vi.mocked(listReviews).mockResolvedValue({ reviews: [], total: 0 })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('renders plugin name and description after loading', async () => {
    renderDetail()
    await waitFor(() => {
      expect(screen.getByText('Chess Tutor')).toBeInTheDocument()
      expect(screen.getByText('Interactive chess board.')).toBeInTheDocument()
    })
  })

  it('renders category and content rating badges', async () => {
    renderDetail()
    await waitFor(() => {
      expect(screen.getByText('Math')).toBeInTheDocument()
      expect(screen.getByText('educational')).toBeInTheDocument()
    })
  })

  it('shows not found message when plugin does not exist', async () => {
    vi.mocked(getPluginDetail).mockRejectedValueOnce(new Error('404'))
    renderDetail('nonexistent')
    await waitFor(() => {
      expect(screen.getByText(/Plugin not found/i)).toBeInTheDocument()
    })
  })

  it('hides add-to-classroom button for unauthenticated users', async () => {
    renderDetail()
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /Add to Classroom/i })).toBeNull()
    })
  })

  it('shows sign-in hint for unauthenticated users', async () => {
    renderDetail()
    await waitFor(() => {
      expect(screen.getByText(/Open this page from the ChatBridge app/i)).toBeInTheDocument()
    })
  })
})
