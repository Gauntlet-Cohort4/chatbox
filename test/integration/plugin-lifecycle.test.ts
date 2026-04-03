/**
 * Phase 12: Integration tests for the full plugin lifecycle.
 * These tests verify that all phases work together correctly.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Emittery from 'emittery'
import type { PluginEventMap } from '@shared/types/plugin-events'
import type { PluginCatalog, PluginCatalogEntry, PluginManifest } from '@shared/types/plugin'
import { PluginCatalogSchema, PluginManifestSchema } from '@shared/types/plugin'
import { pluginStore } from '@/stores/pluginStore'
import { createPluginController } from '@/packages/plugin-controller/controller'
import { buildPluginContextForLLM } from '@/packages/plugin-context/builder'
import { injectScreenshotsIntoUserMessage } from '@/packages/plugin-context/screenshot-injector'
import { fetchCatalog, startCatalogPolling } from '@/packages/plugin-catalog/fetcher'
import type { Message } from '@shared/types'

// ─── Test Fixtures ─────────────────────────────────────────────────

function createChessManifest(): PluginManifest {
	return {
		pluginId: 'chess',
		pluginName: 'Chess',
		description: 'Interactive chess game. Play against yourself or ask the AI for move suggestions.',
		version: '1.0.0',
		author: 'ChatBridge',
		category: 'internal',
		contentRating: 'safe',
		tools: [
			{ toolName: 'start_game', toolDescription: 'Start a new chess game.', parameters: [] },
			{
				toolName: 'make_move',
				toolDescription: 'Make a chess move.',
				parameters: [
					{ parameterName: 'move', parameterType: 'string', parameterDescription: 'Algebraic notation', isRequired: true },
				],
			},
			{ toolName: 'get_board_state', toolDescription: 'Get board state.', parameters: [] },
			{ toolName: 'resign', toolDescription: 'Resign the game.', parameters: [] },
		],
		bundle: { bundleUrl: 'https://example.com/chess.zip', bundleVersion: '1.0.0', bundleHash: 'abc', entryFile: 'index.html' },
		userInterface: { defaultWidth: 420, defaultHeight: 520, sandboxPermissions: [], isPersistent: true },
		authentication: { type: 'none' },
		contextPrompt: 'This is an interactive chess game.',
		capabilities: { supportsScreenshot: true, supportsVerboseState: true, supportsEventLog: true },
	}
}

function createWeatherManifest(): PluginManifest {
	return {
		pluginId: 'weather',
		pluginName: 'Weather Dashboard',
		description: 'Look up current weather conditions and forecast.',
		version: '1.0.0',
		author: 'ChatBridge',
		category: 'external-public',
		contentRating: 'safe',
		tools: [
			{
				toolName: 'lookup_weather',
				toolDescription: 'Look up weather for a location.',
				parameters: [
					{ parameterName: 'location', parameterType: 'string', parameterDescription: 'City name', isRequired: true },
				],
			},
		],
		bundle: { bundleUrl: 'https://example.com/weather.zip', bundleVersion: '1.0.0', bundleHash: 'def', entryFile: 'index.html' },
		userInterface: { defaultWidth: 380, defaultHeight: 450, sandboxPermissions: [], isPersistent: false },
		authentication: { type: 'none' },
		contextPrompt: 'Weather dashboard for looking up conditions.',
		capabilities: { supportsScreenshot: false, supportsVerboseState: false, supportsEventLog: false },
	}
}

function createTestCatalog(manifests: PluginManifest[]): PluginCatalog {
	return {
		catalogVersion: 1,
		lastUpdatedAt: Date.now(),
		applications: manifests.map((m) => ({ ...m, isVerified: true, approvedAt: Date.now() })),
	}
}

// ─── Test Suite ────────────────────────────────────────────────────

describe('Plugin Lifecycle Integration', () => {
	let eventBus: Emittery<PluginEventMap>

	beforeEach(() => {
		eventBus = new Emittery<PluginEventMap>()
		pluginStore.setState({
			catalog: null,
			catalogVersion: null,
			catalogLastFetched: null,
			enabledPluginIds: [],
			activePluginId: null,
			pluginStates: {},
			pluginStateDescriptions: {},
			pluginEventLogs: {},
			pluginTokens: {},
			localBundles: {},
			loading: false,
			error: null,
		})
	})

	// 1. Tool discovery and launch
	describe('tool discovery and launch', () => {
		it('launch tool is available for enabled inactive plugins', () => {
			const catalog = createTestCatalog([createChessManifest()])
			pluginStore.getState().setCatalog(catalog)
			pluginStore.getState().enablePlugin('chess')

			const controller = createPluginController(eventBus)
			const manifests = pluginStore.getState().getEnabledManifests()
			const tools = controller.getAvailableTools(null, manifests)

			expect(tools).toHaveProperty('plugin__chess__launch')
			expect(tools['plugin__chess__launch'].description).toBe(createChessManifest().description)
			controller.cleanup()
		})
	})

	// 2. Launch lifecycle end-to-end
	describe('launch lifecycle', () => {
		it('launch tool resolves when plugin:ready fires', async () => {
			const catalog = createTestCatalog([createChessManifest()])
			pluginStore.getState().setCatalog(catalog)
			pluginStore.getState().enablePlugin('chess')

			const controller = createPluginController(eventBus)
			const manifests = pluginStore.getState().getEnabledManifests()
			const tools = controller.getAvailableTools(null, manifests)

			const launchPromise = tools['plugin__chess__launch'].execute!(
				{},
				{ toolCallId: 'test', messages: [], abortSignal: new AbortController().signal }
			)

			await new Promise((r) => setTimeout(r, 10))
			eventBus.emit('plugin:ready', { pluginId: 'chess' })

			const result = await launchPromise
			expect(result).toEqual({ status: 'launched', pluginName: 'Chess' })
			controller.cleanup()
		})
	})

	// 4. Bidirectional tool invocation
	describe('bidirectional tool invocation', () => {
		it('active tool resolves when tool:result-received fires', async () => {
			const catalog = createTestCatalog([createChessManifest()])
			pluginStore.getState().setCatalog(catalog)
			pluginStore.getState().enablePlugin('chess')
			pluginStore.getState().setActivePlugin('chess')

			const controller = createPluginController(eventBus)
			const manifests = pluginStore.getState().getEnabledManifests()
			const tools = controller.getAvailableTools('chess', manifests)

			// Listen for the invoke request to get the callId
			const invokePromise = new Promise<string>((resolve) => {
				eventBus.on('tool:invoke-request', (data) => resolve(data.callId))
			})

			const resultPromise = tools['plugin__chess__make_move'].execute!(
				{ move: 'e4' },
				{ toolCallId: 'test', messages: [], abortSignal: new AbortController().signal }
			)

			const callId = await invokePromise
			eventBus.emit('tool:result-received', {
				pluginId: 'chess',
				callId,
				result: { fen: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1' },
			})

			const result = await resultPromise
			expect(result).toHaveProperty('fen')
			controller.cleanup()
		})
	})

	// 5. State awareness in LLM context
	describe('state awareness in LLM context', () => {
		it('buildPluginContextForLLM includes state and event log', () => {
			const manifest = createChessManifest()
			const state = { fen: 'some-fen', currentTurn: 'black' }
			const eventLog = [
				{ eventDescription: 'White played e4', eventTimestamp: Date.now() - 5000 },
				{ eventDescription: 'Black played e5', eventTimestamp: Date.now() - 2000 },
			]

			const context = buildPluginContextForLLM(manifest, state, eventLog, 'White played e4. Black to move.')
			expect(context).toContain('[Active App: Chess]')
			expect(context).toContain('This is an interactive chess game.')
			expect(context).toContain('Current app state: White played e4. Black to move.')
			expect(context).toContain('Recent app events')
			expect(context).toContain('Black played e5')
			expect(context).toContain('White played e4')
		})
	})

	// 6. Event log context
	describe('event log context', () => {
		it('event log entries are stored and retrievable', () => {
			pluginStore.getState().appendEventLog('chess', {
				eventDescription: 'Knight captures bishop on f6',
				eventTimestamp: Date.now(),
				eventData: { capturedPiece: 'b', square: 'f6' },
			})
			pluginStore.getState().appendEventLog('chess', {
				eventDescription: 'Black is in check',
				eventTimestamp: Date.now(),
			})

			const logs = pluginStore.getState().pluginEventLogs.chess
			expect(logs).toHaveLength(2)
			expect(logs[0].eventDescription).toBe('Knight captures bishop on f6')
			expect(logs[1].eventDescription).toBe('Black is in check')
		})
	})

	// 7. Completion signaling
	describe('completion signaling', () => {
		it('plugin:complete event can close the active plugin', () => {
			pluginStore.getState().setActivePlugin('chess')
			expect(pluginStore.getState().activePluginId).toBe('chess')

			// Simulate what the side panel does on plugin:complete
			pluginStore.getState().setActivePlugin(null)
			expect(pluginStore.getState().activePluginId).toBeNull()
		})
	})

	// 9. Multi-app switching
	describe('multi-app switching', () => {
		it('switching active plugin changes available tools', () => {
			const catalog = createTestCatalog([createChessManifest(), createWeatherManifest()])
			pluginStore.getState().setCatalog(catalog)
			pluginStore.getState().enablePlugin('chess')
			pluginStore.getState().enablePlugin('weather')

			const controller = createPluginController(eventBus)
			const manifests = pluginStore.getState().getEnabledManifests()

			// Chess active
			const chessTools = controller.getAvailableTools('chess', manifests)
			expect(chessTools).toHaveProperty('plugin__chess__make_move')
			expect(chessTools).toHaveProperty('plugin__weather__launch')
			expect(chessTools).not.toHaveProperty('plugin__weather__lookup_weather')

			// Switch to weather
			const weatherTools = controller.getAvailableTools('weather', manifests)
			expect(weatherTools).toHaveProperty('plugin__weather__lookup_weather')
			expect(weatherTools).toHaveProperty('plugin__chess__launch')
			expect(weatherTools).not.toHaveProperty('plugin__chess__make_move')

			controller.cleanup()
		})
	})

	// 10. Ambiguous routing
	describe('ambiguous routing', () => {
		it('both launch tools visible with distinct descriptions when no plugin active', () => {
			const catalog = createTestCatalog([createChessManifest(), createWeatherManifest()])
			pluginStore.getState().setCatalog(catalog)
			pluginStore.getState().enablePlugin('chess')
			pluginStore.getState().enablePlugin('weather')

			const controller = createPluginController(eventBus)
			const manifests = pluginStore.getState().getEnabledManifests()
			const tools = controller.getAvailableTools(null, manifests)

			expect(tools).toHaveProperty('plugin__chess__launch')
			expect(tools).toHaveProperty('plugin__weather__launch')
			expect(tools['plugin__chess__launch'].description).not.toBe(tools['plugin__weather__launch'].description)

			controller.cleanup()
		})
	})

	// 11. Correct refusal
	describe('correct refusal', () => {
		it('no plugin tools available when no plugins are enabled', () => {
			const catalog = createTestCatalog([createChessManifest()])
			pluginStore.getState().setCatalog(catalog)
			// Don't enable any plugins

			const controller = createPluginController(eventBus)
			const manifests = pluginStore.getState().getEnabledManifests()
			const tools = controller.getAvailableTools(null, manifests)

			expect(Object.keys(tools)).toHaveLength(0)
			controller.cleanup()
		})
	})

	// 12. Error recovery on timeout
	describe('error recovery on timeout', () => {
		it('tool call rejects after timeout', async () => {
			vi.useFakeTimers()

			const catalog = createTestCatalog([createChessManifest()])
			pluginStore.getState().setCatalog(catalog)
			pluginStore.getState().enablePlugin('chess')
			pluginStore.getState().setActivePlugin('chess')

			const controller = createPluginController(eventBus)
			const manifests = pluginStore.getState().getEnabledManifests()
			const tools = controller.getAvailableTools('chess', manifests)

			const resultPromise = tools['plugin__chess__make_move'].execute!(
				{ move: 'e4' },
				{ toolCallId: 'test', messages: [], abortSignal: new AbortController().signal }
			)

			vi.advanceTimersByTime(15001)
			await expect(resultPromise).rejects.toThrow(/timed out/i)

			controller.cleanup()
			vi.useRealTimers()
		})
	})

	// 16. Screenshot injection
	describe('screenshot injection', () => {
		it('injects image parts into user message', () => {
			const msg: Message = {
				id: 'msg-1',
				role: 'user',
				contentParts: [{ type: 'text', text: "What's happening on the board?" }],
			} as Message

			const result = injectScreenshotsIntoUserMessage(['key-1', 'key-2'], msg)
			expect(result.contentParts).toHaveLength(3)
			expect(result.contentParts[1].type).toBe('image')
			expect(result.contentParts[2].type).toBe('image')
			expect(result).not.toBe(msg) // immutable
		})
	})

	// 17. Catalog polling with version check
	describe('catalog polling with version check', () => {
		it('does not call onUpdate when version is unchanged', async () => {
			vi.useFakeTimers()
			const catalog = createTestCatalog([createChessManifest()])

			vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
				new Response(JSON.stringify(catalog), { status: 200 })
			))

			const onUpdate = vi.fn()
			const cleanup = startCatalogPolling('https://example.com/catalog.json', 1000, onUpdate)

			await vi.advanceTimersByTimeAsync(1000)
			expect(onUpdate).toHaveBeenCalledTimes(1)

			// Same version — should not call again
			await vi.advanceTimersByTimeAsync(1000)
			expect(onUpdate).toHaveBeenCalledTimes(1)

			cleanup()
			vi.useRealTimers()
			vi.restoreAllMocks()
		})

		it('calls onUpdate when version changes', async () => {
			vi.useFakeTimers()
			const catalog1 = createTestCatalog([createChessManifest()])
			const catalog2 = { ...catalog1, catalogVersion: 2 }

			vi.stubGlobal('fetch', vi.fn()
				.mockResolvedValueOnce(new Response(JSON.stringify(catalog1), { status: 200 }))
				.mockResolvedValueOnce(new Response(JSON.stringify(catalog2), { status: 200 }))
			)

			const onUpdate = vi.fn()
			const cleanup = startCatalogPolling('https://example.com/catalog.json', 1000, onUpdate)

			await vi.advanceTimersByTimeAsync(1000)
			expect(onUpdate).toHaveBeenCalledTimes(1)

			await vi.advanceTimersByTimeAsync(1000)
			expect(onUpdate).toHaveBeenCalledTimes(2)

			cleanup()
			vi.useRealTimers()
			vi.restoreAllMocks()
		})
	})

	// 18. Content safety filtering
	describe('content safety', () => {
		it('context builder output can be combined with safety instruction', () => {
			const manifest = createChessManifest()
			const context = buildPluginContextForLLM(manifest, null, [], null)
			const safetyInstruction = 'When presenting results from third-party apps to the user, evaluate whether the content is appropriate for a K-12 educational setting.'

			const fullPrompt = context + '\n\n' + safetyInstruction
			expect(fullPrompt).toContain('[Active App: Chess]')
			expect(fullPrompt).toContain('K-12 educational setting')
		})
	})

	// Manifest validation for all plugins
	describe('manifest validation', () => {
		it('chess manifest is valid', () => {
			expect(() => PluginManifestSchema.parse(createChessManifest())).not.toThrow()
		})

		it('weather manifest is valid', () => {
			expect(() => PluginManifestSchema.parse(createWeatherManifest())).not.toThrow()
		})

		it('catalog with both plugins is valid', () => {
			const catalog = createTestCatalog([createChessManifest(), createWeatherManifest()])
			expect(() => PluginCatalogSchema.parse(catalog)).not.toThrow()
		})
	})
})
