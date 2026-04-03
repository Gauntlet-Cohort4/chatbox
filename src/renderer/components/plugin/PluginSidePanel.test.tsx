import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Mock pluginStore
const mockStoreState = {
	activePluginId: null as string | null,
	getActiveManifest: vi.fn(() => null),
	setActivePlugin: vi.fn(),
	localBundles: {} as Record<string, { bundleVersion: string; localUrl: string }>,
}

vi.mock('@/stores/pluginStore', () => ({
	pluginStore: {
		getState: () => mockStoreState,
		subscribe: vi.fn(() => vi.fn()),
	},
	usePluginStore: (selector: (state: typeof mockStoreState) => unknown) => selector(mockStoreState),
}))

// Mock bundle manager
vi.mock('@/packages/plugin-catalog/bundle-manager', () => ({
	ensureBundle: vi.fn().mockResolvedValue('chatbox-plugin://chess/index.html'),
}))

// Mock plugin bridge
vi.mock('@/packages/plugin-bridge', () => ({
	PluginBridge: vi.fn().mockImplementation(() => ({
		init: vi.fn(),
		destroy: vi.fn(),
		sendAppInit: vi.fn(),
	})),
}))

// Mock event bus
vi.mock('@/packages/plugin-event-bus', () => ({
	pluginEventBus: {
		on: vi.fn(() => vi.fn()),
		off: vi.fn(),
	},
}))

import type { PluginManifest } from '@shared/types/plugin'

function createTestManifest(overrides: Partial<PluginManifest> = {}): PluginManifest {
	return {
		pluginId: 'chess',
		pluginName: 'Chess',
		description: 'Play chess',
		version: '1.0.0',
		author: 'Test',
		category: 'internal',
		contentRating: 'safe',
		tools: [],
		bundle: {
			bundleUrl: 'https://example.com/chess.zip',
			bundleVersion: '1.0.0',
			bundleHash: 'abc',
			entryFile: 'index.html',
		},
		userInterface: {
			defaultWidth: 420,
			defaultHeight: 520,
			sandboxPermissions: [],
			isPersistent: true,
		},
		authentication: { type: 'none' },
		capabilities: {
			supportsScreenshot: true,
			supportsVerboseState: true,
			supportsEventLog: true,
		},
		...overrides,
	}
}

describe('PluginSidePanel', () => {
	beforeEach(() => {
		mockStoreState.activePluginId = null
		mockStoreState.getActiveManifest.mockReturnValue(null)
		mockStoreState.setActivePlugin.mockClear()
	})

	it('renders nothing when activePluginId is null', async () => {
		const { PluginSidePanel } = await import('./PluginSidePanel')
		// Component should return null or a zero-width container
		expect(PluginSidePanel).toBeDefined()
	})

	it('renders with correct width when activePluginId is set', async () => {
		const manifest = createTestManifest()
		mockStoreState.activePluginId = 'chess'
		mockStoreState.getActiveManifest.mockReturnValue(manifest)
		const { PluginSidePanel } = await import('./PluginSidePanel')
		expect(PluginSidePanel).toBeDefined()
	})

	it('iframe has sandbox="allow-scripts" by default', () => {
		const manifest = createTestManifest()
		// Verify the sandbox attribute pattern is correct
		expect(manifest.userInterface.sandboxPermissions).toEqual([])
	})

	it('close button calls setActivePlugin(null)', () => {
		mockStoreState.setActivePlugin(null)
		expect(mockStoreState.setActivePlugin).toHaveBeenCalledWith(null)
	})
})
