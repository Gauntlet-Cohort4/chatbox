// @vitest-environment jsdom
class ResizeObserverMock {
	observe() {}
	unobserve() {}
	disconnect() {}
}
globalThis.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver

Object.defineProperty(window, 'matchMedia', {
	writable: true,
	value: (query: string) => ({
		matches: false,
		media: query,
		onchange: null,
		addListener: () => {},
		removeListener: () => {},
		addEventListener: () => {},
		removeEventListener: () => {},
		dispatchEvent: () => false,
	}),
})

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MantineProvider } from '@mantine/core'
import type { ReactNode } from 'react'
import type { PluginCatalogEntry } from '@shared/types/plugin'

// Mock store state
const mockStoreState = {
	catalog: null as { catalogVersion: number; lastUpdatedAt: number; applications: PluginCatalogEntry[] } | null,
	enabledPluginIds: [] as string[],
	enablePlugin: vi.fn(),
	disablePlugin: vi.fn(),
}

vi.mock('@/stores/pluginStore', () => ({
	pluginStore: {
		getState: () => mockStoreState,
		subscribe: vi.fn(() => vi.fn()),
	},
	usePluginStore: (selector: (state: typeof mockStoreState) => unknown) => selector(mockStoreState),
}))

function wrapper({ children }: { children: ReactNode }) {
	return <MantineProvider>{children}</MantineProvider>
}

function createTestEntry(overrides: Partial<PluginCatalogEntry> = {}): PluginCatalogEntry {
	return {
		pluginId: 'detail-plugin',
		pluginName: 'Detail Plugin',
		description: 'A detailed plugin for testing the detail modal',
		version: '2.0.0',
		author: 'Detail Author',
		category: 'external-authenticated',
		contentRating: 'educational',
		isVerified: true,
		approvedAt: 1700000000000,
		tools: [
			{
				toolName: 'searchTool',
				toolDescription: 'Searches the web for information',
				parameters: [
					{ parameterName: 'query', parameterType: 'string', parameterDescription: 'Search query', isRequired: true },
				],
			},
			{
				toolName: 'fetchTool',
				toolDescription: 'Fetches a URL',
				parameters: [],
			},
		],
		bundle: {
			bundleUrl: 'https://example.com/detail.zip',
			bundleVersion: '2.0.0',
			bundleHash: 'def456',
			entryFile: 'index.html',
		},
		userInterface: {
			defaultWidth: 600,
			defaultHeight: 800,
			sandboxPermissions: ['allow-scripts', 'allow-forms'],
			isPersistent: true,
		},
		authentication: {
			type: 'oauth2-pkce',
			authorizationUrl: 'https://auth.example.com/authorize',
			tokenUrl: 'https://auth.example.com/token',
			scopes: ['read', 'write'],
			clientId: 'client-123',
		},
		capabilities: {
			supportsScreenshot: true,
			supportsVerboseState: true,
			supportsEventLog: false,
		},
		contextPrompt: 'You are a helpful assistant that uses this plugin.',
		...overrides,
	}
}

describe('PluginDetailModal', () => {
	beforeEach(() => {
		mockStoreState.enabledPluginIds = []
		mockStoreState.enablePlugin.mockClear()
		mockStoreState.disablePlugin.mockClear()
	})

	afterEach(() => {
		cleanup()
	})

	it('shows full pluginName and description', async () => {
		const entry = createTestEntry()
		const { PluginDetailModal } = await import('./PluginDetailModal')
		render(<PluginDetailModal entry={entry} opened={true} onClose={vi.fn()} />, { wrapper })
		expect(screen.getByText('Detail Plugin')).toBeDefined()
		expect(screen.getByText('A detailed plugin for testing the detail modal')).toBeDefined()
	})

	it('shows author and version', async () => {
		const entry = createTestEntry()
		const { PluginDetailModal } = await import('./PluginDetailModal')
		render(<PluginDetailModal entry={entry} opened={true} onClose={vi.fn()} />, { wrapper })
		expect(screen.getByText(/Detail Author/)).toBeDefined()
		expect(screen.getAllByText(/2\.0\.0/).length).toBeGreaterThan(0)
	})

	it('shows list of tools with toolName and toolDescription', async () => {
		const entry = createTestEntry()
		const { PluginDetailModal } = await import('./PluginDetailModal')
		render(<PluginDetailModal entry={entry} opened={true} onClose={vi.fn()} />, { wrapper })
		expect(screen.getByText('searchTool')).toBeDefined()
		expect(screen.getByText('Searches the web for information')).toBeDefined()
		expect(screen.getByText('fetchTool')).toBeDefined()
		expect(screen.getByText('Fetches a URL')).toBeDefined()
	})

	it('shows authentication type', async () => {
		const entry = createTestEntry()
		const { PluginDetailModal } = await import('./PluginDetailModal')
		render(<PluginDetailModal entry={entry} opened={true} onClose={vi.fn()} />, { wrapper })
		expect(screen.getByText(/oauth2-pkce/)).toBeDefined()
	})

	it('enable/disable button calls correct store action', async () => {
		const entry = createTestEntry({ pluginId: 'toggle-detail' })
		mockStoreState.enabledPluginIds = []
		const { PluginDetailModal } = await import('./PluginDetailModal')
		render(<PluginDetailModal entry={entry} opened={true} onClose={vi.fn()} />, { wrapper })
		const enableBtn = screen.getByRole('button', { name: /enable/i })
		fireEvent.click(enableBtn)
		expect(mockStoreState.enablePlugin).toHaveBeenCalledWith('toggle-detail')
	})
})
