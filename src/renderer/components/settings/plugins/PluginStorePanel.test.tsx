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
import type { PluginCatalog, PluginCatalogEntry } from '@shared/types/plugin'

// Mock store state
// NOTE: pluginApprovalStatus and setApprovalStatus were added when the panel
// switched to the three-state approval workflow (not-approved → approved →
// deployed). The component reads pluginApprovalStatus on every card render,
// so omitting it from the mock causes "Cannot read properties of undefined"
// errors before any test assertions can run.
const mockStoreState = {
	catalog: null as PluginCatalog | null,
	enabledPluginIds: [] as string[],
	pluginApprovalStatus: {} as Record<string, 'not-approved' | 'approved' | 'deployed'>,
	enablePlugin: vi.fn(),
	disablePlugin: vi.fn(),
	setApprovalStatus: vi.fn(),
}

vi.mock('@/stores/pluginStore', () => ({
	pluginStore: {
		getState: () => mockStoreState,
		subscribe: vi.fn(() => vi.fn()),
	},
	usePluginStore: (selector: (state: typeof mockStoreState) => unknown) => selector(mockStoreState),
}))

// PluginDetailModal opens via internal state when a card is clicked. We don't
// exercise the modal in this file, so stub it to avoid pulling in its full
// dependency tree.
vi.mock('./PluginDetailModal', () => ({
	PluginDetailModal: () => null,
}))

function wrapper({ children }: { children: ReactNode }) {
	return <MantineProvider>{children}</MantineProvider>
}

function createTestEntry(overrides: Partial<PluginCatalogEntry> = {}): PluginCatalogEntry {
	return {
		pluginId: 'test-plugin',
		pluginName: 'Test Plugin',
		description: 'A test plugin for unit testing',
		version: '1.0.0',
		author: 'Test Author',
		category: 'internal',
		contentRating: 'safe',
		isVerified: false,
		approvedAt: 1700000000000,
		tools: [
			{
				toolName: 'testTool',
				toolDescription: 'A test tool',
				parameters: [],
			},
		],
		bundle: {
			bundleUrl: 'https://example.com/test.zip',
			bundleVersion: '1.0.0',
			bundleHash: 'abc123',
			entryFile: 'index.html',
		},
		userInterface: {
			defaultWidth: 400,
			defaultHeight: 500,
			sandboxPermissions: [],
			isPersistent: false,
		},
		authentication: { type: 'none' },
		capabilities: {
			supportsScreenshot: false,
			supportsVerboseState: false,
			supportsEventLog: false,
		},
		...overrides,
	}
}

function createTestCatalog(applications: PluginCatalogEntry[] = []): PluginCatalog {
	return {
		catalogVersion: 1,
		lastUpdatedAt: 1700000000000,
		applications,
	}
}

describe('PluginStorePanel', () => {
	beforeEach(() => {
		mockStoreState.catalog = null
		mockStoreState.enabledPluginIds = []
		mockStoreState.pluginApprovalStatus = {}
		mockStoreState.enablePlugin.mockClear()
		mockStoreState.disablePlugin.mockClear()
		mockStoreState.setApprovalStatus.mockClear()
	})

	afterEach(() => {
		cleanup()
	})

	it('shows loading state when catalog is null', async () => {
		mockStoreState.catalog = null
		const { PluginStorePanel } = await import('./PluginStorePanel')
		render(<PluginStorePanel />, { wrapper })
		expect(screen.getByText('Loading app catalog...')).toBeDefined()
	})

	it('shows "No apps available" when catalog.applications is empty', async () => {
		mockStoreState.catalog = createTestCatalog([])
		const { PluginStorePanel } = await import('./PluginStorePanel')
		render(<PluginStorePanel />, { wrapper })
		expect(screen.getByText('No apps available')).toBeDefined()
	})

	it('renders app cards from catalog.applications', async () => {
		const entries = [
			createTestEntry({ pluginId: 'app-1', pluginName: 'Chess App' }),
			createTestEntry({ pluginId: 'app-2', pluginName: 'Weather App' }),
		]
		mockStoreState.catalog = createTestCatalog(entries)
		const { PluginStorePanel } = await import('./PluginStorePanel')
		render(<PluginStorePanel />, { wrapper })
		expect(screen.getByText('Chess App')).toBeDefined()
		expect(screen.getByText('Weather App')).toBeDefined()
	})

	it('each card shows pluginName, description, author, category badge', async () => {
		const entry = createTestEntry({
			pluginId: 'app-1',
			pluginName: 'My Plugin',
			description: 'My plugin description',
			author: 'Author Name',
			category: 'external-public',
		})
		mockStoreState.catalog = createTestCatalog([entry])
		const { PluginStorePanel } = await import('./PluginStorePanel')
		render(<PluginStorePanel />, { wrapper })
		expect(screen.getByText('My Plugin')).toBeDefined()
		expect(screen.getByText(/My plugin description/)).toBeDefined()
		expect(screen.getByText('Author Name')).toBeDefined()
		expect(screen.getByText('external-public')).toBeDefined()
	})

	it('each card shows isVerified badge for verified apps', async () => {
		const entry = createTestEntry({ pluginId: 'v-app', pluginName: 'Verified App', isVerified: true })
		mockStoreState.catalog = createTestCatalog([entry])
		const { PluginStorePanel } = await import('./PluginStorePanel')
		render(<PluginStorePanel />, { wrapper })
		expect(screen.getByText('Verified')).toBeDefined()
	})

	it('each card renders an approval action button', async () => {
		// The panel renders the action button labeled by STATUS_CONFIG for the
		// current approval status. Plugins default to 'not-approved', so the
		// label should be "Approve".
		const entry = createTestEntry({ pluginId: 'action-app' })
		mockStoreState.catalog = createTestCatalog([entry])
		const { PluginStorePanel } = await import('./PluginStorePanel')
		render(<PluginStorePanel />, { wrapper })
		const buttons = screen.getAllByRole('button', { name: 'Approve' })
		expect(buttons.length).toBe(1)
	})

	it('search input filters apps by pluginName (case-insensitive)', async () => {
		const entries = [
			createTestEntry({ pluginId: 'chess', pluginName: 'Chess Game' }),
			createTestEntry({ pluginId: 'weather', pluginName: 'Weather Widget' }),
		]
		mockStoreState.catalog = createTestCatalog(entries)
		const { PluginStorePanel } = await import('./PluginStorePanel')
		render(<PluginStorePanel />, { wrapper })
		const searchInput = screen.getByPlaceholderText('Search apps...')
		fireEvent.change(searchInput, { target: { value: 'chess' } })
		expect(screen.getByText('Chess Game')).toBeDefined()
		expect(screen.queryByText('Weather Widget')).toBeNull()
	})

	it('search input filters apps by description (case-insensitive)', async () => {
		const entries = [
			createTestEntry({ pluginId: 'a1', pluginName: 'App One', description: 'Plays music' }),
			createTestEntry({ pluginId: 'a2', pluginName: 'App Two', description: 'Shows weather' }),
		]
		mockStoreState.catalog = createTestCatalog(entries)
		const { PluginStorePanel } = await import('./PluginStorePanel')
		render(<PluginStorePanel />, { wrapper })
		const searchInput = screen.getByPlaceholderText('Search apps...')
		fireEvent.change(searchInput, { target: { value: 'WEATHER' } })
		expect(screen.queryByText('App One')).toBeNull()
		expect(screen.getByText('App Two')).toBeDefined()
	})

	it('category filter shows only apps matching selected category', async () => {
		const entries = [
			createTestEntry({ pluginId: 'int', pluginName: 'Internal App', category: 'internal' }),
			createTestEntry({ pluginId: 'ext', pluginName: 'External App', category: 'external-public' }),
		]
		mockStoreState.catalog = createTestCatalog(entries)
		const { PluginStorePanel } = await import('./PluginStorePanel')
		render(<PluginStorePanel />, { wrapper })
		const internalLabel = screen.getByText('Internal')
		fireEvent.click(internalLabel)
		expect(screen.getByText('Internal App')).toBeDefined()
		expect(screen.queryByText('External App')).toBeNull()
	})

	it('category filter "All" shows all apps', async () => {
		const entries = [
			createTestEntry({ pluginId: 'int', pluginName: 'Internal App', category: 'internal' }),
			createTestEntry({ pluginId: 'ext', pluginName: 'External App', category: 'external-public' }),
		]
		mockStoreState.catalog = createTestCatalog(entries)
		const { PluginStorePanel } = await import('./PluginStorePanel')
		render(<PluginStorePanel />, { wrapper })
		// "All" should be selected by default
		expect(screen.getByText('Internal App')).toBeDefined()
		expect(screen.getByText('External App')).toBeDefined()
	})

	it('clicking Approve on a not-approved plugin transitions it to approved', async () => {
		const entry = createTestEntry({ pluginId: 'approve-me' })
		mockStoreState.catalog = createTestCatalog([entry])
		// Default approval status is 'not-approved', so the button reads "Approve"
		// and clicking it should transition to 'approved'.
		const { PluginStorePanel } = await import('./PluginStorePanel')
		render(<PluginStorePanel />, { wrapper })
		const button = screen.getByRole('button', { name: 'Approve' })
		fireEvent.click(button)
		expect(mockStoreState.setApprovalStatus).toHaveBeenCalledWith('approve-me', 'approved')
	})

	it('clicking Deploy on an approved plugin transitions it to deployed', async () => {
		const entry = createTestEntry({ pluginId: 'deploy-me' })
		mockStoreState.catalog = createTestCatalog([entry])
		mockStoreState.pluginApprovalStatus = { 'deploy-me': 'approved' }
		const { PluginStorePanel } = await import('./PluginStorePanel')
		render(<PluginStorePanel />, { wrapper })
		const button = screen.getByRole('button', { name: 'Deploy' })
		fireEvent.click(button)
		expect(mockStoreState.setApprovalStatus).toHaveBeenCalledWith('deploy-me', 'deployed')
	})

	it('clicking Revoke on a deployed plugin transitions it back to approved', async () => {
		const entry = createTestEntry({ pluginId: 'revoke-me' })
		mockStoreState.catalog = createTestCatalog([entry])
		mockStoreState.pluginApprovalStatus = { 'revoke-me': 'deployed' }
		const { PluginStorePanel } = await import('./PluginStorePanel')
		render(<PluginStorePanel />, { wrapper })
		// Deployed plugins show a primary "Revoke" button (back to approved) AND
		// a subtle "Unapprove" button (back to not-approved). The primary action
		// is the Revoke button.
		const button = screen.getByRole('button', { name: 'Revoke' })
		fireEvent.click(button)
		expect(mockStoreState.setApprovalStatus).toHaveBeenCalledWith('revoke-me', 'approved')
	})

	it('clicking Unapprove on a deployed plugin transitions it to not-approved', async () => {
		const entry = createTestEntry({ pluginId: 'unapprove-me' })
		mockStoreState.catalog = createTestCatalog([entry])
		mockStoreState.pluginApprovalStatus = { 'unapprove-me': 'deployed' }
		const { PluginStorePanel } = await import('./PluginStorePanel')
		render(<PluginStorePanel />, { wrapper })
		const button = screen.getByRole('button', { name: 'Unapprove' })
		fireEvent.click(button)
		expect(mockStoreState.setApprovalStatus).toHaveBeenCalledWith('unapprove-me', 'not-approved')
	})

	it('shows catalog version and last updated timestamp', async () => {
		mockStoreState.catalog = {
			catalogVersion: 42,
			lastUpdatedAt: 1700000000000,
			applications: [createTestEntry()],
		}
		const { PluginStorePanel } = await import('./PluginStorePanel')
		render(<PluginStorePanel />, { wrapper })
		expect(screen.getByText(/v42/)).toBeDefined()
		expect(screen.getByText(/2023/)).toBeDefined()
	})
})
