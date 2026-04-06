import { MantineProvider } from '@mantine/core'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Mock the API client endpoints BEFORE importing the page
vi.mock('../../src/api/endpoints', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/api/endpoints')>()
  return {
    ...actual,
    listPlugins: vi.fn(),
    listCategories: vi.fn(),
  }
})

import { listCategories, listPlugins } from '../../src/api/endpoints'
import { BrowsePage } from '../../src/pages/BrowsePage'

function makePlugin(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    pluginId: 'chess',
    pluginName: 'Chess Tutor',
    description: 'Interactive chess',
    author: 'ChatBridge',
    category: 'Math',
    contentRating: 'educational',
    version: '1.0.0',
    averageRating: 4.7,
    totalRatings: 12,
    screenshotKey: 'screenshots/chess/screenshot.png',
    bundleSizeBytes: 130000,
    ...overrides,
  }
}

function renderBrowse(initialEntry = '/') {
  return render(
    <MantineProvider>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/" element={<BrowsePage />} />
        </Routes>
      </MemoryRouter>
    </MantineProvider>
  )
}

describe('BrowsePage', () => {
  beforeEach(() => {
    vi.mocked(listCategories).mockResolvedValue({
      categories: [
        { name: 'Math', count: 2 },
        { name: 'Science', count: 1 },
      ],
    })
    vi.mocked(listPlugins).mockResolvedValue({
      plugins: [makePlugin(), makePlugin({ pluginId: 'weather', pluginName: 'Weather', category: 'Science' })],
      total: 2,
      page: 1,
      limit: 24,
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('renders the search bar', async () => {
    renderBrowse()
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Search educational plugins/i)).toBeInTheDocument()
    })
  })

  it('renders plugin cards from API', async () => {
    renderBrowse()
    await waitFor(() => {
      expect(screen.getByText('Chess Tutor')).toBeInTheDocument()
      expect(screen.getByText('Weather')).toBeInTheDocument()
    })
  })

  it('displays the count of plugins', async () => {
    renderBrowse()
    await waitFor(() => {
      expect(screen.getByText(/Showing 2 of 2 plugins/i)).toBeInTheDocument()
    })
  })

  it('shows empty state when no plugins returned', async () => {
    vi.mocked(listPlugins).mockResolvedValue({ plugins: [], total: 0, page: 1, limit: 24 })
    renderBrowse()
    await waitFor(() => {
      expect(screen.getByText(/No plugins found/i)).toBeInTheDocument()
    })
  })

  it('reads initial category from URL query param', async () => {
    renderBrowse('/?category=Math')
    await waitFor(() => {
      expect(vi.mocked(listPlugins)).toHaveBeenCalledWith(expect.objectContaining({ category: 'Math' }))
    })
  })

  it('calls listPlugins with sort key from URL', async () => {
    renderBrowse('/?sort=newest')
    await waitFor(() => {
      expect(vi.mocked(listPlugins)).toHaveBeenCalledWith(expect.objectContaining({ sort: 'newest' }))
    })
  })

  it('debounces search input and triggers a new fetch', async () => {
    const user = userEvent.setup()
    renderBrowse()
    await waitFor(() => expect(screen.getByText('Chess Tutor')).toBeInTheDocument())

    const input = screen.getByPlaceholderText(/Search educational plugins/i)
    await user.type(input, 'chess')

    await waitFor(
      () => {
        expect(vi.mocked(listPlugins)).toHaveBeenLastCalledWith(expect.objectContaining({ search: 'chess' }))
      },
      { timeout: 1500 }
    )
  })
})
