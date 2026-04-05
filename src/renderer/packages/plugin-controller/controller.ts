import type { PluginEventMap } from '@shared/types/plugin-events'
import type { PluginManifest, PluginToolParameter } from '@shared/types/plugin'
import { tool } from 'ai'
import type { ToolSet } from 'ai'
import Emittery from 'emittery'
import z from 'zod'
import { pluginEventBus } from '@/packages/plugin-event-bus'
import { pluginStore } from '@/stores/pluginStore'

const TOOL_TIMEOUT_MS = 15000

interface PendingCall {
	resolve: (result: unknown) => void
	reject: (error: Error) => void
	timeoutHandle: ReturnType<typeof setTimeout>
}

function generateCallId(): string {
	return crypto.randomUUID()
}

function buildZodSchemaFromParameters(parameters: PluginToolParameter[]): z.ZodObject<Record<string, z.ZodTypeAny>> {
	const shape: Record<string, z.ZodTypeAny> = {}
	for (const param of parameters) {
		let fieldSchema: z.ZodTypeAny
		switch (param.parameterType) {
			case 'string':
				fieldSchema = z.string()
				break
			case 'number':
				fieldSchema = z.number()
				break
			case 'boolean':
				fieldSchema = z.boolean()
				break
			case 'object':
				fieldSchema = z.record(z.string(), z.unknown())
				break
			default:
				fieldSchema = z.unknown()
		}

		fieldSchema = fieldSchema.describe(param.parameterDescription)

		if (!param.isRequired) {
			fieldSchema = fieldSchema.optional()
		}

		shape[param.parameterName] = fieldSchema
	}
	return z.object(shape)
}

export function createPluginController(eventBus: Emittery<PluginEventMap> = pluginEventBus) {
	const pendingToolCalls = new Map<string, PendingCall>()
	const pendingReadyPromises = new Map<string, PendingCall>()
	const pendingScreenshotPromises = new Map<string, PendingCall>()
	let pendingScreenshotKeys: string[] = []
	const unsubscribers: Array<() => void> = []

	// Subscribe to event bus
	const offToolResult = eventBus.on('tool:result-received', ({ callId, result }) => {
		const pending = pendingToolCalls.get(callId)
		if (pending) {
			clearTimeout(pending.timeoutHandle)
			pendingToolCalls.delete(callId)
			pending.resolve(result)
		}
	})
	unsubscribers.push(offToolResult)

	const offToolError = eventBus.on('tool:error-received', ({ callId, error }) => {
		const pending = pendingToolCalls.get(callId)
		if (pending) {
			clearTimeout(pending.timeoutHandle)
			pendingToolCalls.delete(callId)
			pending.reject(new Error(error))
		}
	})
	unsubscribers.push(offToolError)

	const offPluginReady = eventBus.on('plugin:ready', ({ pluginId }) => {
		const pending = pendingReadyPromises.get(pluginId)
		if (pending) {
			clearTimeout(pending.timeoutHandle)
			pendingReadyPromises.delete(pluginId)
			pending.resolve(undefined)
		}
	})
	unsubscribers.push(offPluginReady)

	const offScreenshotResult = eventBus.on('screenshot:result', ({ pluginId, storageKeys }) => {
		const pending = pendingScreenshotPromises.get(pluginId)
		if (pending) {
			clearTimeout(pending.timeoutHandle)
			pendingScreenshotPromises.delete(pluginId)
			pending.resolve(storageKeys)
		}
	})
	unsubscribers.push(offScreenshotResult)

	function getAvailableTools(
		activePluginId: string | null,
		enabledManifests: PluginManifest[]
	): ToolSet {
		const tools: ToolSet = {}

		for (const manifest of enabledManifests) {
			if (manifest.pluginId === activePluginId) {
				// Active plugin: full tool set
				for (const toolDef of manifest.tools) {
					const toolName = `plugin__${manifest.pluginId}__${toolDef.toolName}`
					tools[toolName] = tool({
						description: toolDef.toolDescription,
						inputSchema: buildZodSchemaFromParameters(toolDef.parameters),
						execute: async (args: Record<string, unknown>) => {
							const callId = generateCallId()
							return new Promise((resolve, reject) => {
								const timeoutHandle = setTimeout(() => {
									pendingToolCalls.delete(callId)
									// Return timeout as result instead of throwing
									resolve({ error: `Tool call timed out after ${TOOL_TIMEOUT_MS / 1000} seconds` })
								}, TOOL_TIMEOUT_MS)
								pendingToolCalls.set(callId, {
									resolve,
									reject: (err: Error) => {
										// Return errors as results so LLM sees them
										clearTimeout(timeoutHandle)
										pendingToolCalls.delete(callId)
										resolve({ error: err.message })
									},
									timeoutHandle,
								})
								eventBus.emit('tool:invoke-request', {
									pluginId: manifest.pluginId,
									callId,
									toolName: toolDef.toolName,
									args: args as Record<string, unknown>,
								})
							})
						},
					})
				}

				// Screenshot tool if supported
				if (manifest.capabilities.supportsScreenshot) {
					const screenshotToolName = `plugin__${manifest.pluginId}__get_visual_context`
					const captureCount = manifest.userInterface.isPersistent ? 1 : 3
					tools[screenshotToolName] = tool({
						description:
							'Capture visual state of the app. Use when the user asks about what they can see, asks for visual help, or refers to something on screen.',
						inputSchema: z.object({}),
						execute: async () => {
							return new Promise((resolve, reject) => {
								const timeoutHandle = setTimeout(() => {
									pendingScreenshotPromises.delete(manifest.pluginId)
									reject(new Error('Screenshot capture timed out'))
								}, TOOL_TIMEOUT_MS)
								pendingScreenshotPromises.set(manifest.pluginId, {
									resolve: (storageKeys) => {
										const keys = storageKeys as string[]
										pendingScreenshotKeys = [...pendingScreenshotKeys, ...keys]
										resolve({ screenshotsCaptured: keys.length })
									},
									reject,
									timeoutHandle,
								})
								eventBus.emit('screenshot:request', {
									pluginId: manifest.pluginId,
									count: captureCount,
									intervalMs: 500,
								})
							})
						},
					})
				}
			} else {
				// Inactive plugin: launch tool only
				const launchToolName = `plugin__${manifest.pluginId}__launch`
				tools[launchToolName] = tool({
					description: manifest.description,
					inputSchema: z.object({}),
					execute: async () => {
						pluginStore.getState().setActivePlugin(manifest.pluginId)
						return new Promise((resolve, reject) => {
							const timeoutHandle = setTimeout(() => {
								pendingReadyPromises.delete(manifest.pluginId)
								reject(new Error(`Plugin launch timed out after ${TOOL_TIMEOUT_MS / 1000} seconds`))
							}, TOOL_TIMEOUT_MS)
							pendingReadyPromises.set(manifest.pluginId, {
								resolve: () => {
									resolve({ status: 'launched', pluginName: manifest.pluginName })
								},
								reject,
								timeoutHandle,
							})
						})
					},
				})
			}
		}

		return tools
	}

	function cleanup() {
		for (const [callId, pending] of pendingToolCalls) {
			clearTimeout(pending.timeoutHandle)
			pending.reject(new Error('Controller shutting down'))
		}
		pendingToolCalls.clear()

		for (const [pluginId, pending] of pendingReadyPromises) {
			clearTimeout(pending.timeoutHandle)
			pending.reject(new Error('Controller shutting down'))
		}
		pendingReadyPromises.clear()

		for (const [pluginId, pending] of pendingScreenshotPromises) {
			clearTimeout(pending.timeoutHandle)
			pending.reject(new Error('Controller shutting down'))
		}
		pendingScreenshotPromises.clear()

		for (const unsub of unsubscribers) {
			unsub()
		}
		unsubscribers.length = 0
	}

	function consumePendingScreenshots(): string[] {
		const keys = [...pendingScreenshotKeys]
		pendingScreenshotKeys = []
		return keys
	}

	return {
		getAvailableTools,
		cleanup,
		consumePendingScreenshots,
		// Expose for testing
		pendingToolCalls,
		pendingReadyPromises,
		pendingScreenshotPromises,
	}
}

// Singleton instance for production use
export const pluginController = createPluginController()
