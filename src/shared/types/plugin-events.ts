// Events emitted on the shared Emittery instance.
// These are the contracts between the controller, bridge, and logger.

export interface PluginEventMap {
	// Controller → Bridge: invoke a tool on the active app
	'tool:invoke-request': {
		pluginId: string
		callId: string
		toolName: string
		args: Record<string, unknown>
	}

	// Bridge → Controller: tool result received from app
	'tool:result-received': {
		pluginId: string
		callId: string
		result: unknown
	}

	// Bridge → Controller: tool error received from app
	'tool:error-received': {
		pluginId: string
		callId: string
		error: string
	}

	// Bridge → Controller + Store: app is ready
	'plugin:ready': {
		pluginId: string
	}

	// Bridge → Store: app state updated
	'plugin:state-update': {
		pluginId: string
		state: Record<string, unknown>
		description?: string
	}

	// Bridge → Store + Chat: app completed
	'plugin:complete': {
		pluginId: string
		summary: string
	}

	// Bridge → Store: event log entry from app
	'plugin:event-log': {
		pluginId: string
		eventDescription: string
		eventData?: Record<string, unknown>
		eventTimestamp: number
	}

	// Controller → Bridge: request screenshot(s)
	'screenshot:request': {
		pluginId: string
		count: number // 1 for persistent/turn-based, 3 for continuous
		intervalMs: number // 500ms between captures for continuous apps
	}

	// Bridge → Controller: screenshot(s) captured
	'screenshot:result': {
		pluginId: string
		storageKeys: string[] // keys for blobs stored via platform.setStoreBlob
	}

	// Controller → Bridge: request current state
	'state:request': {
		pluginId: string
	}

	// Bridge → Controller: state response
	'state:response': {
		pluginId: string
		state: Record<string, unknown>
		description?: string
	}
}
