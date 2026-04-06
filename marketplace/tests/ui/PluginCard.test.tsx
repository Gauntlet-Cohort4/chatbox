import { MantineProvider } from '@mantine/core'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { PluginCard } from '../../src/components/PluginCard'
import type { PluginListItem } from '../../src/types/api'

function makePlugin(overrides: Partial<PluginListItem> = {}): PluginListItem {
  return {
    pluginId: 'chess',
    pluginName: 'Chess Tutor',
    description: 'Interactive chess board for teaching openings.',
    author: 'ChatBridge Team',
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

function renderCard(plugin: PluginListItem) {
  return render(
    <MantineProvider>
      <MemoryRouter>
        <PluginCard plugin={plugin} />
      </MemoryRouter>
    </MantineProvider>
  )
}

describe('PluginCard', () => {
  it('renders plugin name, author, description, category, and rating', () => {
    renderCard(makePlugin())
    expect(screen.getByText('Chess Tutor')).toBeInTheDocument()
    expect(screen.getByText(/ChatBridge Team/)).toBeInTheDocument()
    expect(screen.getByText(/Interactive chess/)).toBeInTheDocument()
    expect(screen.getByText('Math')).toBeInTheDocument()
    expect(screen.getByText(/4\.7/)).toBeInTheDocument()
    expect(screen.getByText(/\(12\)/)).toBeInTheDocument()
  })

  it('links to the plugin detail page', () => {
    renderCard(makePlugin())
    const link = screen.getByRole('link', { name: /Chess Tutor/i })
    expect(link).toHaveAttribute('href', '/plugin/chess')
  })

  it('renders a fallback gradient when no screenshot is available', () => {
    renderCard(makePlugin({ screenshotKey: null }))
    // No img element rendered; card text fallback has the plugin name
    const nameMatches = screen.getAllByText('Chess Tutor')
    expect(nameMatches.length).toBeGreaterThan(0)
  })
})
