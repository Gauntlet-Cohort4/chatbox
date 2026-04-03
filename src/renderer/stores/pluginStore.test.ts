import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { PluginCatalog, PluginManifest } from '@shared/types/plugin'

// We'll import the store after it's created — for now define the test structure
// The store will be imported as: import { pluginStore } from './pluginStore'

function createTestManifest(overrides: Partial<PluginManifest> = {}): PluginManifest {
	return {
		pluginId: 'test-plugin',
		pluginName: 'Test Plugin',
		description: 'A test plugin',
		version: '1.0.0',
		author: 'Test',
		category: 'internal',
		contentRating: 'safe',
		tools: [],
		bundle: {
			bundleUrl: 'https://example.com/bundle.zip',
			bundleVersion: '1.0.0',
			bundleHash: 'abc123',
			entryFile: 'index.html',
		},
		userInterface: {
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

function createTestCatalog(manifests: PluginManifest[] = [createTestManifest()]): PluginCatalog {
	return {
		catalogVersion: 1,
		lastUpdatedAt: Date.now(),
		applications: manifests.map((m) => ({
			...m,
			isVerified: true,
			approvedAt: Date.now(),
		})),
	}
}

// Lazy import so the module is loaded fresh if needed
let pluginStore: typeof import('./pluginStore').pluginStore

beforeEach(async () => {
	const mod = await import('./pluginStore')
	pluginStore = mod.pluginStore
	// Reset state before each test
	pluginStore.setState({
		catalog: null,
		catalogVersion: null,
		catalogLastFetched: null,
		enabledPluginIds: [],
		activePluginId: null,
		pluginStates: {},
		pluginEventLogs: {},
		pluginTokens: {},
		localBundles: {},
		loading: false,
		error: null,
	})
})

describe('pluginStore', () => {
	describe('initial state', () => {
		it('has null catalog, empty enabledPluginIds, null activePluginId', () => {
			const state = pluginStore.getState()
			expect(state.catalog).toBeNull()
			expect(state.enabledPluginIds).toEqual([])
			expect(state.activePluginId).toBeNull()
		})

		it('has empty pluginStates, pluginEventLogs, pluginTokens, localBundles', () => {
			const state = pluginStore.getState()
			expect(state.pluginStates).toEqual({})
			expect(state.pluginEventLogs).toEqual({})
			expect(state.pluginTokens).toEqual({})
			expect(state.localBundles).toEqual({})
		})
	})

	describe('setCatalog', () => {
		it('updates catalog, catalogVersion, and catalogLastFetched', () => {
			const catalog = createTestCatalog()
			pluginStore.getState().setCatalog(catalog)
			const state = pluginStore.getState()
			expect(state.catalog).toEqual(catalog)
			expect(state.catalogVersion).toBe(1)
			expect(state.catalogLastFetched).toBeTypeOf('number')
		})
	})

	describe('enablePlugin / disablePlugin', () => {
		it('enablePlugin adds pluginId to enabledPluginIds', () => {
			pluginStore.getState().enablePlugin('chess')
			expect(pluginStore.getState().enabledPluginIds).toContain('chess')
		})

		it('enablePlugin does not add duplicate pluginId', () => {
			pluginStore.getState().enablePlugin('chess')
			pluginStore.getState().enablePlugin('chess')
			expect(pluginStore.getState().enabledPluginIds.filter((id) => id === 'chess')).toHaveLength(1)
		})

		it('disablePlugin removes pluginId from enabledPluginIds', () => {
			pluginStore.getState().enablePlugin('chess')
			pluginStore.getState().disablePlugin('chess')
			expect(pluginStore.getState().enabledPluginIds).not.toContain('chess')
		})

		it('disablePlugin is a no-op for pluginId not in the list', () => {
			pluginStore.getState().enablePlugin('chess')
			pluginStore.getState().disablePlugin('weather')
			expect(pluginStore.getState().enabledPluginIds).toContain('chess')
		})
	})

	describe('setActivePlugin', () => {
		it('updates activePluginId', () => {
			pluginStore.getState().setActivePlugin('chess')
			expect(pluginStore.getState().activePluginId).toBe('chess')
		})

		it('with null clears activePluginId', () => {
			pluginStore.getState().setActivePlugin('chess')
			pluginStore.getState().setActivePlugin(null)
			expect(pluginStore.getState().activePluginId).toBeNull()
		})
	})

	describe('updatePluginState', () => {
		it('stores state keyed by pluginId', () => {
			pluginStore.getState().updatePluginState('chess', { fen: 'initial' })
			expect(pluginStore.getState().pluginStates.chess).toEqual({ fen: 'initial' })
		})

		it('overwrites previous state for same pluginId', () => {
			pluginStore.getState().updatePluginState('chess', { fen: 'initial' })
			pluginStore.getState().updatePluginState('chess', { fen: 'after-e4' })
			expect(pluginStore.getState().pluginStates.chess).toEqual({ fen: 'after-e4' })
		})
	})

	describe('appendEventLog', () => {
		const entry = { eventDescription: 'Move e4', eventTimestamp: Date.now() }

		it('adds entry to pluginEventLogs for the given pluginId', () => {
			pluginStore.getState().appendEventLog('chess', entry)
			expect(pluginStore.getState().pluginEventLogs.chess).toHaveLength(1)
			expect(pluginStore.getState().pluginEventLogs.chess[0]).toEqual(entry)
		})

		it('creates the array if pluginId has no prior logs', () => {
			pluginStore.getState().appendEventLog('weather', entry)
			expect(pluginStore.getState().pluginEventLogs.weather).toHaveLength(1)
		})

		it('enforces rolling buffer cap of 50 entries (oldest dropped first)', () => {
			for (let i = 0; i < 55; i++) {
				pluginStore.getState().appendEventLog('chess', {
					eventDescription: `Event ${i}`,
					eventTimestamp: i,
				})
			}
			const logs = pluginStore.getState().pluginEventLogs.chess
			expect(logs).toHaveLength(50)
			expect(logs[0].eventDescription).toBe('Event 5')
			expect(logs[49].eventDescription).toBe('Event 54')
		})
	})

	describe('clearEventLog', () => {
		it('empties the log array for the given pluginId', () => {
			pluginStore.getState().appendEventLog('chess', {
				eventDescription: 'test',
				eventTimestamp: Date.now(),
			})
			pluginStore.getState().clearEventLog('chess')
			expect(pluginStore.getState().pluginEventLogs.chess).toEqual([])
		})
	})

	describe('token management', () => {
		it('setPluginToken stores token keyed by pluginId', () => {
			pluginStore.getState().setPluginToken('spotify', { accessToken: 'abc' })
			expect(pluginStore.getState().pluginTokens.spotify.accessToken).toBe('abc')
		})

		it('clearPluginToken removes token for pluginId', () => {
			pluginStore.getState().setPluginToken('spotify', { accessToken: 'abc' })
			pluginStore.getState().clearPluginToken('spotify')
			expect(pluginStore.getState().pluginTokens.spotify).toBeUndefined()
		})
	})

	describe('setLocalBundle', () => {
		it('stores bundleVersion and localUrl for pluginId', () => {
			pluginStore.getState().setLocalBundle('chess', '1.0.0', 'chatbox-plugin://chess/index.html')
			const bundle = pluginStore.getState().localBundles.chess
			expect(bundle.bundleVersion).toBe('1.0.0')
			expect(bundle.localUrl).toBe('chatbox-plugin://chess/index.html')
		})
	})

	describe('getEnabledManifests', () => {
		it('returns only manifests whose pluginId is in enabledPluginIds', () => {
			const catalog = createTestCatalog([
				createTestManifest({ pluginId: 'chess' }),
				createTestManifest({ pluginId: 'weather' }),
			])
			pluginStore.getState().setCatalog(catalog)
			pluginStore.getState().enablePlugin('chess')
			const manifests = pluginStore.getState().getEnabledManifests()
			expect(manifests).toHaveLength(1)
			expect(manifests[0].pluginId).toBe('chess')
		})

		it('returns empty array when no plugins enabled', () => {
			pluginStore.getState().setCatalog(createTestCatalog())
			expect(pluginStore.getState().getEnabledManifests()).toEqual([])
		})

		it('returns empty array when catalog is null', () => {
			expect(pluginStore.getState().getEnabledManifests()).toEqual([])
		})
	})

	describe('getActiveManifest', () => {
		it('returns null when activePluginId is null', () => {
			expect(pluginStore.getState().getActiveManifest()).toBeNull()
		})

		it('returns null when activePluginId not found in catalog', () => {
			pluginStore.getState().setCatalog(createTestCatalog())
			pluginStore.getState().setActivePlugin('nonexistent')
			expect(pluginStore.getState().getActiveManifest()).toBeNull()
		})

		it('returns correct manifest when activePluginId matches', () => {
			const catalog = createTestCatalog([
				createTestManifest({ pluginId: 'chess', pluginName: 'Chess' }),
			])
			pluginStore.getState().setCatalog(catalog)
			pluginStore.getState().setActivePlugin('chess')
			const manifest = pluginStore.getState().getActiveManifest()
			expect(manifest).not.toBeNull()
			expect(manifest!.pluginName).toBe('Chess')
		})
	})
})
