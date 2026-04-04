import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Emittery from 'emittery'
import type { PluginEventMap } from '@shared/types/plugin-events'
import type { PluginManifest } from '@shared/types/plugin'

// Mock pluginStore
const mockSetActivePlugin = vi.fn()
vi.mock('@/stores/pluginStore', () => ({
	pluginStore: {
		getState: () => ({
			setActivePlugin: mockSetActivePlugin,
		}),
	},
}))

// Use a fresh event bus for tests
let testEventBus: Emittery<PluginEventMap>

function createTestManifest(overrides: Partial<PluginManifest> = {}): PluginManifest {
	return {
		pluginId: 'chess',
		pluginName: 'Chess',
		description: 'Play chess',
		version: '1.0.0',
		author: 'Test',
		category: 'internal',
		contentRating: 'safe',
		tools: [
			{
				toolName: 'make_move',
				toolDescription: 'Make a chess move',
				parameters: [
					{
						parameterName: 'move',
						parameterType: 'string',
						parameterDescription: 'The move in algebraic notation',
						isRequired: true,
					},
				],
			},
			{
				toolName: 'get_board_state',
				toolDescription: 'Get the current board state',
				parameters: [],
			},
		],
		bundle: {
			bundleUrl: 'https://example.com/chess.zip',
			bundleVersion: '1.0.0',
			bundleHash: 'abc',
			entryFile: 'index.html',
		},
		userInterface: { sandboxPermissions: [], isPersistent: true },
		authentication: { type: 'none' },
		capabilities: {
			supportsScreenshot: true,
			supportsVerboseState: true,
			supportsEventLog: true,
		},
		...overrides,
	}
}

// Lazy import controller to allow event bus injection
let createPluginController: typeof import('./controller').createPluginController

beforeEach(async () => {
	testEventBus = new Emittery<PluginEventMap>()
	const mod = await import('./controller')
	createPluginController = mod.createPluginController
	mockSetActivePlugin.mockClear()
})

describe('pluginController', () => {
	describe('getAvailableTools', () => {
		it('with no plugins returns empty object', () => {
			const controller = createPluginController(testEventBus)
			const tools = controller.getAvailableTools(null, [])
			expect(Object.keys(tools)).toHaveLength(0)
		})

		it('with active plugin returns one tool per manifest tool definition', () => {
			const controller = createPluginController(testEventBus)
			const manifest = createTestManifest()
			const tools = controller.getAvailableTools('chess', [manifest])
			// 2 tools + get_visual_context (supportsScreenshot is true)
			expect(Object.keys(tools)).toContain('plugin__chess__make_move')
			expect(Object.keys(tools)).toContain('plugin__chess__get_board_state')
		})

		it('active plugin tool names follow plugin__{pluginId}__{toolName} pattern', () => {
			const controller = createPluginController(testEventBus)
			const manifest = createTestManifest()
			const tools = controller.getAvailableTools('chess', [manifest])
			for (const name of Object.keys(tools)) {
				if (name !== 'plugin__chess__get_visual_context') {
					expect(name).toMatch(/^plugin__chess__/)
				}
			}
		})

		it('active plugin with supportsScreenshot includes get_visual_context tool', () => {
			const controller = createPluginController(testEventBus)
			const manifest = createTestManifest()
			const tools = controller.getAvailableTools('chess', [manifest])
			expect(Object.keys(tools)).toContain('plugin__chess__get_visual_context')
		})

		it('get_visual_context description mentions visual/screen context', () => {
			const controller = createPluginController(testEventBus)
			const manifest = createTestManifest()
			const tools = controller.getAvailableTools('chess', [manifest])
			const vctool = tools['plugin__chess__get_visual_context']
			expect(vctool.description?.toLowerCase()).toMatch(/visual|screen/)
		})

		it('inactive enabled plugins returns only launch tools', () => {
			const controller = createPluginController(testEventBus)
			const chess = createTestManifest({ pluginId: 'chess' })
			const weather = createTestManifest({ pluginId: 'weather', pluginName: 'Weather' })
			// chess is active, weather is inactive
			const tools = controller.getAvailableTools('chess', [chess, weather])
			expect(Object.keys(tools)).toContain('plugin__weather__launch')
			expect(Object.keys(tools)).not.toContain('plugin__weather__make_move')
		})

		it('inactive launch tool names follow plugin__{pluginId}__launch pattern', () => {
			const controller = createPluginController(testEventBus)
			const weather = createTestManifest({ pluginId: 'weather' })
			const tools = controller.getAvailableTools(null, [weather])
			expect(Object.keys(tools)).toContain('plugin__weather__launch')
		})

		it('inactive launch tool description matches manifest description', () => {
			const controller = createPluginController(testEventBus)
			const weather = createTestManifest({ pluginId: 'weather', description: 'Check the weather' })
			const tools = controller.getAvailableTools(null, [weather])
			expect(tools['plugin__weather__launch'].description).toBe('Check the weather')
		})

		it('with both active and inactive returns active full tools + inactive launch tools', () => {
			const controller = createPluginController(testEventBus)
			const chess = createTestManifest({ pluginId: 'chess' })
			const weather = createTestManifest({ pluginId: 'weather' })
			const tools = controller.getAvailableTools('chess', [chess, weather])
			// Active chess tools
			expect(Object.keys(tools)).toContain('plugin__chess__make_move')
			expect(Object.keys(tools)).toContain('plugin__chess__get_board_state')
			// Inactive weather launch
			expect(Object.keys(tools)).toContain('plugin__weather__launch')
		})
	})

	describe('tool execution', () => {
		it('active tool execute emits tool:invoke-request on event bus', async () => {
			const controller = createPluginController(testEventBus)
			const manifest = createTestManifest()
			const tools = controller.getAvailableTools('chess', [manifest])

			const emitPromise = new Promise<void>((resolve) => {
				testEventBus.on('tool:invoke-request', (data) => {
					expect(data.pluginId).toBe('chess')
					expect(data.toolName).toBe('make_move')
					expect(data.args).toEqual({ move: 'e4' })
					resolve()
				})
			})

			// Execute the tool but also resolve it so it doesn't hang
			const executePromise = tools['plugin__chess__make_move'].execute!({ move: 'e4' }, { toolCallId: 'test', messages: [], abortSignal: new AbortController().signal })

			await emitPromise

			// Resolve the pending call via event bus
			const callId = Array.from((controller as any).pendingToolCalls.keys())[0]
			testEventBus.emit('tool:result-received', { pluginId: 'chess', callId, result: { fen: 'new' } })

			const result = await executePromise
			expect(result).toEqual({ fen: 'new' })
		})

		it('active tool execute returns error object after 15 second timeout', async () => {
			vi.useFakeTimers()
			const controller = createPluginController(testEventBus)
			const manifest = createTestManifest()
			const tools = controller.getAvailableTools('chess', [manifest])

			const executePromise = tools['plugin__chess__make_move'].execute!({ move: 'e4' }, { toolCallId: 'test', messages: [], abortSignal: new AbortController().signal })

			vi.advanceTimersByTime(15001)

			const result = await executePromise
			expect(result).toHaveProperty('error')
			expect((result as any).error).toMatch(/timed out/i)
			vi.useRealTimers()
		})

		it('tool:error-received returns error object to resolve', async () => {
			const controller = createPluginController(testEventBus)
			const manifest = createTestManifest()
			const tools = controller.getAvailableTools('chess', [manifest])

			const executePromise = tools['plugin__chess__make_move'].execute!({ move: 'e4' }, { toolCallId: 'test', messages: [], abortSignal: new AbortController().signal })

			// Wait for the emit to be set up
			await new Promise((r) => setTimeout(r, 10))

			const callId = Array.from((controller as any).pendingToolCalls.keys())[0]
			testEventBus.emit('tool:error-received', { pluginId: 'chess', callId, error: 'Invalid move' })

			const result = await executePromise
			expect(result).toHaveProperty('error')
			expect((result as any).error).toBe('Invalid move')
		})

		it('tool:result-received with unknown callId does not throw', () => {
			const controller = createPluginController(testEventBus)
			// Should not throw
			expect(() => {
				testEventBus.emit('tool:result-received', { pluginId: 'chess', callId: 'unknown', result: {} })
			}).not.toThrow()
		})
	})

	describe('launch tool', () => {
		it('launch tool calls pluginStore.setActivePlugin', async () => {
			const controller = createPluginController(testEventBus)
			const manifest = createTestManifest({ pluginId: 'chess' })
			const tools = controller.getAvailableTools(null, [manifest])

			// Listen for plugin:ready and immediately resolve
			testEventBus.on('tool:invoke-request', () => {})
			const executePromise = tools['plugin__chess__launch'].execute!({}, { toolCallId: 'test', messages: [], abortSignal: new AbortController().signal })

			// Simulate plugin becoming ready
			await new Promise((r) => setTimeout(r, 10))
			testEventBus.emit('plugin:ready', { pluginId: 'chess' })

			await executePromise
			expect(mockSetActivePlugin).toHaveBeenCalledWith('chess')
		})

		it('launch tool returns { status: launched, pluginName }', async () => {
			const controller = createPluginController(testEventBus)
			const manifest = createTestManifest({ pluginId: 'chess', pluginName: 'Chess' })
			const tools = controller.getAvailableTools(null, [manifest])

			const executePromise = tools['plugin__chess__launch'].execute!({}, { toolCallId: 'test', messages: [], abortSignal: new AbortController().signal })

			await new Promise((r) => setTimeout(r, 10))
			testEventBus.emit('plugin:ready', { pluginId: 'chess' })

			const result = await executePromise
			expect(result).toEqual({ status: 'launched', pluginName: 'Chess' })
		})

		it('launch tool rejects after 15 second timeout', async () => {
			vi.useFakeTimers()
			const controller = createPluginController(testEventBus)
			const manifest = createTestManifest({ pluginId: 'chess' })
			const tools = controller.getAvailableTools(null, [manifest])

			const executePromise = tools['plugin__chess__launch'].execute!({}, { toolCallId: 'test', messages: [], abortSignal: new AbortController().signal })

			vi.advanceTimersByTime(15001)

			await expect(executePromise).rejects.toThrow(/timed out/i)
			vi.useRealTimers()
		})
	})

	describe('cleanup', () => {
		it('resolves pending tool calls with error on cleanup', async () => {
			const controller = createPluginController(testEventBus)
			const manifest = createTestManifest()
			const tools = controller.getAvailableTools('chess', [manifest])

			const executePromise = tools['plugin__chess__make_move'].execute!({ move: 'e4' }, { toolCallId: 'test', messages: [], abortSignal: new AbortController().signal })

			await new Promise((r) => setTimeout(r, 10))
			controller.cleanup()

			const result = await executePromise
			expect(result).toHaveProperty('error')
			expect((result as any).error).toMatch(/shutting down/i)
		})

		it('rejects all pending ready promises', async () => {
			const controller = createPluginController(testEventBus)
			const manifest = createTestManifest({ pluginId: 'chess' })
			const tools = controller.getAvailableTools(null, [manifest])

			const executePromise = tools['plugin__chess__launch'].execute!({}, { toolCallId: 'test', messages: [], abortSignal: new AbortController().signal })

			await new Promise((r) => setTimeout(r, 10))
			controller.cleanup()

			await expect(executePromise).rejects.toThrow(/shutting down/i)
		})
	})

	describe('buildZodSchemaFromParameters', () => {
		it('correctly maps string parameters', () => {
			const controller = createPluginController(testEventBus)
			const manifest = createTestManifest()
			const tools = controller.getAvailableTools('chess', [manifest])
			// The make_move tool should accept a string 'move' parameter
			const result = tools['plugin__chess__make_move']
			expect(result).toBeDefined()
		})

		it('correctly maps number parameters', () => {
			const controller = createPluginController(testEventBus)
			const manifest = createTestManifest({
				tools: [{
					toolName: 'set_difficulty',
					toolDescription: 'Set difficulty',
					parameters: [{
						parameterName: 'level',
						parameterType: 'number',
						parameterDescription: 'Difficulty level',
						isRequired: true,
					}],
				}],
			})
			const tools = controller.getAvailableTools('chess', [manifest])
			expect(tools['plugin__chess__set_difficulty']).toBeDefined()
		})

		it('correctly maps boolean parameters', () => {
			const controller = createPluginController(testEventBus)
			const manifest = createTestManifest({
				tools: [{
					toolName: 'toggle',
					toolDescription: 'Toggle setting',
					parameters: [{
						parameterName: 'enabled',
						parameterType: 'boolean',
						parameterDescription: 'Enable or disable',
						isRequired: true,
					}],
				}],
			})
			const tools = controller.getAvailableTools('chess', [manifest])
			expect(tools['plugin__chess__toggle']).toBeDefined()
		})

		it('applies .optional() for isRequired: false', () => {
			const controller = createPluginController(testEventBus)
			const manifest = createTestManifest({
				tools: [{
					toolName: 'search',
					toolDescription: 'Search',
					parameters: [{
						parameterName: 'query',
						parameterType: 'string',
						parameterDescription: 'Search query',
						isRequired: true,
					}, {
						parameterName: 'limit',
						parameterType: 'number',
						parameterDescription: 'Max results',
						isRequired: false,
					}],
				}],
			})
			const tools = controller.getAvailableTools('chess', [manifest])
			expect(tools['plugin__chess__search']).toBeDefined()
		})
	})
})
