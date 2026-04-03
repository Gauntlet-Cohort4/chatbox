// @vitest-environment jsdom
import { type Mock, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Emittery from 'emittery'
import type { PluginEventMap } from '@shared/types/plugin-events'
import type { PluginManifest } from '@shared/types/plugin'
import { PluginBridge } from './bridge'

function createMockManifest(overrides: Partial<PluginManifest> = {}): PluginManifest {
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
			bundleUrl: 'https://example.com/bundle.js',
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

function createMockIframeRef(postMessageMock?: Mock) {
	const postMessage = postMessageMock ?? vi.fn()
	return {
		current: {
			contentWindow: { postMessage },
			style: { height: '' },
		} as unknown as HTMLIFrameElement,
	}
}

function createMockPlatform() {
	return {
		setStoreBlob: vi.fn().mockResolvedValue(undefined),
	}
}

describe('PluginBridge', () => {
	let eventBus: Emittery<PluginEventMap>
	let manifest: PluginManifest
	let iframeRef: ReturnType<typeof createMockIframeRef>
	let bridge: PluginBridge
	let mockPlatform: ReturnType<typeof createMockPlatform>

	beforeEach(() => {
		eventBus = new Emittery<PluginEventMap>()
		manifest = createMockManifest()
		iframeRef = createMockIframeRef()
		mockPlatform = createMockPlatform()
		bridge = new PluginBridge(iframeRef, manifest, eventBus, mockPlatform)
	})

	afterEach(() => {
		bridge.destroy()
		vi.restoreAllMocks()
	})

	it('init() registers window message event listener', () => {
		const addSpy = vi.spyOn(window, 'addEventListener')
		bridge.init()
		expect(addSpy).toHaveBeenCalledWith('message', expect.any(Function))
	})

	it('destroy() removes window message event listener', () => {
		const removeSpy = vi.spyOn(window, 'removeEventListener')
		bridge.init()
		bridge.destroy()
		expect(removeSpy).toHaveBeenCalledWith('message', expect.any(Function))
	})

	it('destroy() unsubscribes from all event bus subscriptions', () => {
		bridge.init()
		// After destroy, emitting events should not trigger sendToApp
		bridge.destroy()
		const postMessage = (iframeRef.current?.contentWindow as unknown as { postMessage: Mock })
			.postMessage
		void eventBus.emit('tool:invoke-request', {
			pluginId: 'test-plugin',
			callId: 'c1',
			toolName: 'tool1',
			args: {},
		})
		expect(postMessage).not.toHaveBeenCalled()
	})

	it('handleMessage drops messages that fail AppToPlatformMessageSchema validation (log warning)', () => {
		const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
		bridge.init()

		const event = new MessageEvent('message', {
			data: { type: 'invalid:message', foo: 'bar' },
		})
		window.dispatchEvent(event)

		expect(warnSpy).toHaveBeenCalledWith(
			expect.stringContaining('[PluginBridge]'),
			expect.anything()
		)
	})

	it('handleMessage routes app:ready → emits plugin:ready on event bus with correct pluginId', async () => {
		bridge.init()
		const received = eventBus.once('plugin:ready')

		window.dispatchEvent(new MessageEvent('message', { data: { type: 'app:ready' } }))

		const result = await received
		expect(result).toEqual({ pluginId: 'test-plugin' })
	})

	it('handleMessage routes tool:result → emits tool:result-received with pluginId, callId, result', async () => {
		bridge.init()
		const received = eventBus.once('tool:result-received')

		window.dispatchEvent(
			new MessageEvent('message', {
				data: { type: 'tool:result', callId: 'c1', result: { value: 42 } },
			})
		)

		const result = await received
		expect(result).toEqual({
			pluginId: 'test-plugin',
			callId: 'c1',
			result: { value: 42 },
		})
	})

	it('handleMessage routes tool:error → emits tool:error-received with pluginId, callId, error', async () => {
		bridge.init()
		const received = eventBus.once('tool:error-received')

		window.dispatchEvent(
			new MessageEvent('message', {
				data: { type: 'tool:error', callId: 'c1', error: 'Something broke' },
			})
		)

		const result = await received
		expect(result).toEqual({
			pluginId: 'test-plugin',
			callId: 'c1',
			error: 'Something broke',
		})
	})

	it('handleMessage routes state:update → emits plugin:state-update with pluginId, state, description', async () => {
		bridge.init()
		const received = eventBus.once('plugin:state-update')

		window.dispatchEvent(
			new MessageEvent('message', {
				data: {
					type: 'state:update',
					state: { score: 10 },
					description: 'Score changed',
				},
			})
		)

		const result = await received
		expect(result).toEqual({
			pluginId: 'test-plugin',
			state: { score: 10 },
			description: 'Score changed',
		})
	})

	it('handleMessage routes state:response → emits state:response with pluginId, state, description', async () => {
		bridge.init()
		const received = eventBus.once('state:response')

		window.dispatchEvent(
			new MessageEvent('message', {
				data: {
					type: 'state:response',
					state: { board: 'fen' },
					description: 'Current state',
				},
			})
		)

		const result = await received
		expect(result).toEqual({
			pluginId: 'test-plugin',
			state: { board: 'fen' },
			description: 'Current state',
		})
	})

	it('handleMessage routes app:complete → emits plugin:complete with pluginId, summary', async () => {
		bridge.init()
		const received = eventBus.once('plugin:complete')

		window.dispatchEvent(
			new MessageEvent('message', {
				data: { type: 'app:complete', summary: 'Game over!' },
			})
		)

		const result = await received
		expect(result).toEqual({
			pluginId: 'test-plugin',
			summary: 'Game over!',
		})
	})

	it('handleMessage routes event:log → emits plugin:event-log with all fields', async () => {
		bridge.init()
		const received = eventBus.once('plugin:event-log')
		const ts = Date.now()

		window.dispatchEvent(
			new MessageEvent('message', {
				data: {
					type: 'event:log',
					eventDescription: 'Piece moved',
					eventData: { piece: 'knight' },
					eventTimestamp: ts,
				},
			})
		)

		const result = await received
		expect(result).toEqual({
			pluginId: 'test-plugin',
			eventDescription: 'Piece moved',
			eventData: { piece: 'knight' },
			eventTimestamp: ts,
		})
	})

	it('handleMessage routes ui:resize → sets iframe height style', () => {
		bridge.init()

		window.dispatchEvent(
			new MessageEvent('message', {
				data: { type: 'ui:resize', height: 500 },
			})
		)

		expect(iframeRef.current?.style.height).toBe('500px')
	})

	it('handleMessage routes screenshot:response → stores blob and collects for multi-capture', async () => {
		bridge.init()

		// Trigger a screenshot request first so the bridge expects responses
		const resultPromise = eventBus.once('screenshot:result')
		void eventBus.emit('screenshot:request', {
			pluginId: 'test-plugin',
			count: 1,
			intervalMs: 0,
		})

		// Wait a tick for the event handler to fire
		await new Promise((r) => setTimeout(r, 50))

		window.dispatchEvent(
			new MessageEvent('message', {
				data: {
					type: 'screenshot:response',
					imageData: 'data:image/png;base64,abc123',
					mimeType: 'image/png',
				},
			})
		)

		const result = await resultPromise
		expect(result.pluginId).toBe('test-plugin')
		expect(result.storageKeys).toHaveLength(1)
		expect(mockPlatform.setStoreBlob).toHaveBeenCalledWith(
			expect.stringContaining('test-plugin'),
			'data:image/png;base64,abc123'
		)
	})

	it('responds to tool:invoke-request events by calling sendToApp with tool:invoke message', async () => {
		bridge.init()
		const postMessage = (iframeRef.current?.contentWindow as unknown as { postMessage: Mock })
			.postMessage

		await eventBus.emit('tool:invoke-request', {
			pluginId: 'test-plugin',
			callId: 'c1',
			toolName: 'test_tool',
			args: { input: 'hello' },
		})

		expect(postMessage).toHaveBeenCalledWith(
			{
				type: 'tool:invoke',
				callId: 'c1',
				toolName: 'test_tool',
				args: { input: 'hello' },
			},
			'*'
		)
	})

	it('responds to screenshot:request events — sends correct number of screenshot:request messages at intervals', async () => {
		vi.useFakeTimers()
		bridge.init()
		const postMessage = (iframeRef.current?.contentWindow as unknown as { postMessage: Mock })
			.postMessage

		void eventBus.emit('screenshot:request', {
			pluginId: 'test-plugin',
			count: 3,
			intervalMs: 500,
		})

		// First screenshot:request is sent immediately
		await vi.advanceTimersByTimeAsync(0)
		expect(postMessage).toHaveBeenCalledTimes(1)
		expect(postMessage).toHaveBeenCalledWith({ type: 'screenshot:request' }, '*')

		await vi.advanceTimersByTimeAsync(500)
		expect(postMessage).toHaveBeenCalledTimes(2)

		await vi.advanceTimersByTimeAsync(500)
		expect(postMessage).toHaveBeenCalledTimes(3)

		vi.useRealTimers()
	})

	it('responds to state:request events by calling sendToApp with state:request message', async () => {
		bridge.init()
		const postMessage = (iframeRef.current?.contentWindow as unknown as { postMessage: Mock })
			.postMessage

		await eventBus.emit('state:request', {
			pluginId: 'test-plugin',
		})

		expect(postMessage).toHaveBeenCalledWith({ type: 'state:request' }, '*')
	})

	it('sendToApp calls iframe contentWindow.postMessage with * target origin', () => {
		bridge.init()
		const postMessage = (iframeRef.current?.contentWindow as unknown as { postMessage: Mock })
			.postMessage

		bridge.sendToApp({ type: 'state:request' })

		expect(postMessage).toHaveBeenCalledWith({ type: 'state:request' }, '*')
	})

	it('sendAppInit sends correctly formatted app:init message', () => {
		bridge.init()
		const postMessage = (iframeRef.current?.contentWindow as unknown as { postMessage: Mock })
			.postMessage

		bridge.sendAppInit('session-1', { theme: 'dark' })

		expect(postMessage).toHaveBeenCalledWith(
			{
				type: 'app:init',
				sessionId: 'session-1',
				config: { theme: 'dark' },
			},
			'*'
		)
	})

	it('sendAuthToken sends correctly formatted auth:token message', () => {
		bridge.init()
		const postMessage = (iframeRef.current?.contentWindow as unknown as { postMessage: Mock })
			.postMessage

		bridge.sendAuthToken('my-secret-token')

		expect(postMessage).toHaveBeenCalledWith(
			{
				type: 'auth:token',
				token: 'my-secret-token',
			},
			'*'
		)
	})

	it('rate limiting: drops messages exceeding 100/sec threshold and logs warning', () => {
		vi.useFakeTimers()
		const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
		bridge.init()

		// Send 101 valid messages in rapid succession
		for (let i = 0; i < 101; i++) {
			window.dispatchEvent(
				new MessageEvent('message', {
					data: { type: 'app:ready' },
				})
			)
		}

		expect(warnSpy).toHaveBeenCalledWith(
			expect.stringContaining('rate limit')
		)

		vi.useRealTimers()
	})

	it('multi-screenshot capture: collects correct count before emitting screenshot:result', async () => {
		bridge.init()

		const results: Array<{ pluginId: string; storageKeys: string[] }> = []
		eventBus.on('screenshot:result', (data) => {
			results.push(data)
		})

		// Directly call handleScreenshotRequest to avoid event bus async timing
		await bridge.handleScreenshotRequest({ count: 2, intervalMs: 0 })

		// Send first screenshot response
		window.dispatchEvent(
			new MessageEvent('message', {
				data: {
					type: 'screenshot:response',
					imageData: 'data:image/png;base64,first',
					mimeType: 'image/png',
				},
			})
		)

		// Allow async setStoreBlob to resolve
		await new Promise((r) => setTimeout(r, 20))

		// Should not have emitted yet — only 1 of 2
		expect(results).toHaveLength(0)

		// Send second screenshot response
		window.dispatchEvent(
			new MessageEvent('message', {
				data: {
					type: 'screenshot:response',
					imageData: 'data:image/png;base64,second',
					mimeType: 'image/png',
				},
			})
		)

		await new Promise((r) => setTimeout(r, 20))

		expect(results).toHaveLength(1)
		expect(results[0].pluginId).toBe('test-plugin')
		expect(results[0].storageKeys).toHaveLength(2)
	})

	it('multi-screenshot capture: times out after 5 seconds if not all screenshots received', async () => {
		vi.useFakeTimers()
		bridge.init()

		const resultPromise = eventBus.once('screenshot:result')

		void eventBus.emit('screenshot:request', {
			pluginId: 'test-plugin',
			count: 3,
			intervalMs: 100,
		})

		// Send requests
		await vi.advanceTimersByTimeAsync(0)
		await vi.advanceTimersByTimeAsync(100)
		await vi.advanceTimersByTimeAsync(100)

		// Only send 1 of 3 responses
		window.dispatchEvent(
			new MessageEvent('message', {
				data: {
					type: 'screenshot:response',
					imageData: 'data:image/png;base64,only-one',
					mimeType: 'image/png',
				},
			})
		)

		// Advance past the 5-second timeout
		await vi.advanceTimersByTimeAsync(5000)

		const result = await resultPromise
		expect(result.pluginId).toBe('test-plugin')
		// Should emit with whatever was collected (1 out of 3)
		expect(result.storageKeys).toHaveLength(1)

		vi.useRealTimers()
	})

	it('multi-screenshot capture: stores each screenshot via platform.setStoreBlob with unique keys', async () => {
		bridge.init()

		const resultPromise = eventBus.once('screenshot:result')

		void eventBus.emit('screenshot:request', {
			pluginId: 'test-plugin',
			count: 2,
			intervalMs: 0,
		})

		await new Promise((r) => setTimeout(r, 50))

		window.dispatchEvent(
			new MessageEvent('message', {
				data: {
					type: 'screenshot:response',
					imageData: 'data:image/png;base64,first',
					mimeType: 'image/png',
				},
			})
		)

		await new Promise((r) => setTimeout(r, 10))

		window.dispatchEvent(
			new MessageEvent('message', {
				data: {
					type: 'screenshot:response',
					imageData: 'data:image/png;base64,second',
					mimeType: 'image/png',
				},
			})
		)

		const result = await resultPromise

		expect(mockPlatform.setStoreBlob).toHaveBeenCalledTimes(2)

		// Each key should be unique
		const key1 = mockPlatform.setStoreBlob.mock.calls[0][0] as string
		const key2 = mockPlatform.setStoreBlob.mock.calls[1][0] as string
		expect(key1).not.toBe(key2)
		expect(result.storageKeys).toHaveLength(2)
		expect(result.storageKeys[0]).not.toBe(result.storageKeys[1])
	})

	it('ignores tool:invoke-request events for different pluginId', async () => {
		bridge.init()
		const postMessage = (iframeRef.current?.contentWindow as unknown as { postMessage: Mock })
			.postMessage

		await eventBus.emit('tool:invoke-request', {
			pluginId: 'other-plugin',
			callId: 'c1',
			toolName: 'test_tool',
			args: {},
		})

		expect(postMessage).not.toHaveBeenCalled()
	})
})
