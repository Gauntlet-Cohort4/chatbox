import type { RefObject } from 'react'
import type Emittery from 'emittery'
import {
	AppToPlatformMessageSchema,
	type AppToPlatformMessage,
	type PlatformToAppMessage,
} from '@shared/types/plugin-protocol'
import type { PluginManifest } from '@shared/types/plugin'
import type { PluginEventMap } from '@shared/types/plugin-events'
import { pluginEventBus } from '@/packages/plugin-event-bus'
import { logPluginEvent } from '@/packages/plugin-logger/logger'

const RATE_LIMIT_MAX = 100
const RATE_LIMIT_WINDOW_MS = 1000
const SCREENSHOT_TIMEOUT_MS = 5000

interface PlatformBlobStore {
	setStoreBlob(key: string, value: string): Promise<void>
}

export class PluginBridge {
	readonly pluginId: string
	private readonly iframeRef: RefObject<HTMLIFrameElement>
	private readonly eventBus: Emittery<PluginEventMap>
	private readonly platform: PlatformBlobStore
	private readonly unsubscribes: Array<() => void> = []
	private boundHandleMessage: ((event: MessageEvent) => void) | null = null

	// Rate limiting state
	private messageTimestamps: number[] = []

	// Screenshot capture state
	private screenshotCapture: {
		expectedCount: number
		storageKeys: string[]
		timeoutId: ReturnType<typeof setTimeout> | null
	} | null = null

	constructor(
		iframeRef: RefObject<HTMLIFrameElement>,
		manifest: PluginManifest,
		eventBus?: Emittery<PluginEventMap>,
		platform?: PlatformBlobStore
	) {
		this.iframeRef = iframeRef
		this.pluginId = manifest.pluginId
		this.eventBus = eventBus ?? pluginEventBus
		this.platform = platform ?? { setStoreBlob: async () => {} }
	}

	init(): void {
		this.boundHandleMessage = (event: MessageEvent) => this.handleMessage(event)
		window.addEventListener('message', this.boundHandleMessage)

		// Subscribe to event bus events filtered by pluginId
		const toolInvokeUnsub = this.eventBus.on('tool:invoke-request', (data) => {
			if (data.pluginId !== this.pluginId) return
			this.sendToApp({
				type: 'tool:invoke',
				callId: data.callId,
				toolName: data.toolName,
				args: data.args,
			})
		})
		this.unsubscribes.push(toolInvokeUnsub)

		const screenshotRequestUnsub = this.eventBus.on('screenshot:request', (data) => {
			if (data.pluginId !== this.pluginId) return
			void this.handleScreenshotRequest({ count: data.count, intervalMs: data.intervalMs })
		})
		this.unsubscribes.push(screenshotRequestUnsub)

		const stateRequestUnsub = this.eventBus.on('state:request', (data) => {
			if (data.pluginId !== this.pluginId) return
			this.sendToApp({ type: 'state:request' })
		})
		this.unsubscribes.push(stateRequestUnsub)
	}

	destroy(): void {
		if (this.boundHandleMessage) {
			window.removeEventListener('message', this.boundHandleMessage)
			this.boundHandleMessage = null
		}

		for (const unsub of this.unsubscribes) {
			unsub()
		}
		// Clear without mutation — replace with empty array via splice
		this.unsubscribes.length = 0

		if (this.screenshotCapture?.timeoutId != null) {
			clearTimeout(this.screenshotCapture.timeoutId)
		}
		this.screenshotCapture = null
		this.messageTimestamps = []
	}

	handleMessage(event: MessageEvent): void {
		const parsed = AppToPlatformMessageSchema.safeParse(event.data)
		if (!parsed.success) {
			logPluginEvent('message_validation_failure', this.pluginId, { error: String(parsed.error) })
			console.warn('[PluginBridge] Invalid message received:', parsed.error)
			return
		}

		if (this.isRateLimited()) {
			logPluginEvent('message_rate_limited', this.pluginId)
			return
		}

		const message = parsed.data
		this.routeMessage(message)
	}

	sendToApp(message: PlatformToAppMessage): void {
		const contentWindow = this.iframeRef.current?.contentWindow
		if (!contentWindow) return
		contentWindow.postMessage(message, '*')
	}

	sendAppInit(sessionId: string, config?: Record<string, unknown>): void {
		this.sendToApp({
			type: 'app:init',
			sessionId,
			config: config ?? {},
		})
	}

	sendAuthToken(token: string): void {
		this.sendToApp({
			type: 'auth:token',
			token,
		})
	}

	async handleScreenshotRequest(data: { count: number; intervalMs: number }): Promise<void> {
		const { count, intervalMs } = data

		// Initialize capture state
		this.screenshotCapture = {
			expectedCount: count,
			storageKeys: [],
			timeoutId: null,
		}

		// Set up timeout
		this.screenshotCapture.timeoutId = setTimeout(() => {
			this.finalizeScreenshotCapture()
		}, SCREENSHOT_TIMEOUT_MS)

		// Send screenshot requests at intervals
		this.sendToApp({ type: 'screenshot:request' })

		for (let i = 1; i < count; i++) {
			await new Promise<void>((resolve) => {
				setTimeout(resolve, intervalMs)
			})
			this.sendToApp({ type: 'screenshot:request' })
		}
	}

	private isRateLimited(): boolean {
		const now = Date.now()
		// Remove timestamps outside the window — create new array
		this.messageTimestamps = this.messageTimestamps.filter(
			(ts) => now - ts < RATE_LIMIT_WINDOW_MS
		)

		if (this.messageTimestamps.length >= RATE_LIMIT_MAX) {
			console.warn('[PluginBridge] Message rate limit exceeded, dropping message')
			return true
		}

		this.messageTimestamps = [...this.messageTimestamps, now]
		return false
	}

	private routeMessage(message: AppToPlatformMessage): void {
		switch (message.type) {
			case 'app:ready':
				void this.eventBus.emit('plugin:ready', { pluginId: this.pluginId })
				break

			case 'tool:result':
				void this.eventBus.emit('tool:result-received', {
					pluginId: this.pluginId,
					callId: message.callId,
					result: message.result,
				})
				break

			case 'tool:error':
				void this.eventBus.emit('tool:error-received', {
					pluginId: this.pluginId,
					callId: message.callId,
					error: message.error,
				})
				break

			case 'state:update':
				void this.eventBus.emit('plugin:state-update', {
					pluginId: this.pluginId,
					state: message.state,
					description: message.description,
				})
				break

			case 'state:response':
				void this.eventBus.emit('state:response', {
					pluginId: this.pluginId,
					state: message.state,
					description: message.description,
				})
				break

			case 'app:complete':
				void this.eventBus.emit('plugin:complete', {
					pluginId: this.pluginId,
					summary: message.summary,
				})
				break

			case 'event:log':
				void this.eventBus.emit('plugin:event-log', {
					pluginId: this.pluginId,
					eventDescription: message.eventDescription,
					eventData: message.eventData,
					eventTimestamp: message.eventTimestamp,
				})
				break

			case 'ui:resize':
				this.handleUiResize(message.height)
				break

			case 'screenshot:response':
				void this.handleScreenshotResponse(message.imageData)
				break
		}
	}

	private handleUiResize(height: number): void {
		const iframe = this.iframeRef.current
		if (!iframe) return
		iframe.style.height = `${height}px`
	}

	private async handleScreenshotResponse(imageData: string): Promise<void> {
		if (!this.screenshotCapture) return

		const key = `plugin-screenshot-${this.pluginId}-${Date.now()}-${this.screenshotCapture.storageKeys.length}`
		await this.platform.setStoreBlob(key, imageData)

		// Create new capture state with the added key (immutable update)
		this.screenshotCapture = {
			...this.screenshotCapture,
			storageKeys: [...this.screenshotCapture.storageKeys, key],
		}

		if (this.screenshotCapture.storageKeys.length >= this.screenshotCapture.expectedCount) {
			this.finalizeScreenshotCapture()
		}
	}

	private finalizeScreenshotCapture(): void {
		if (!this.screenshotCapture) return

		const { storageKeys, timeoutId } = this.screenshotCapture

		if (timeoutId != null) {
			clearTimeout(timeoutId)
		}

		this.screenshotCapture = null

		void this.eventBus.emit('screenshot:result', {
			pluginId: this.pluginId,
			storageKeys: [...storageKeys],
		})
	}
}
