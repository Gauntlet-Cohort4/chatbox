import { startCatalogPolling } from '@/packages/plugin-catalog/fetcher'
import { startMarketplacePolling } from '@/packages/plugin-catalog/marketplace-poller'
import { pluginEventBus } from '@/packages/plugin-event-bus'
import { pluginStore } from '@/stores/pluginStore'
import { initSettingsStore } from '@/stores/settingsStore'
import { registerBuiltinPlugins } from './builtin-plugins'

let cleanupPolling: (() => void) | null = null
let cleanupMarketplacePolling: (() => void) | null = null

// Wire event bus listeners for state and event log persistence
pluginEventBus.on('plugin:event-log', (data) => {
	pluginStore.getState().appendEventLog(data.pluginId, {
		eventDescription: data.eventDescription,
		eventData: data.eventData,
		eventTimestamp: data.eventTimestamp,
	})
})

pluginEventBus.on('plugin:state-update', (data) => {
	pluginStore.getState().updatePluginState(data.pluginId, data.state, data.description)
})

// Register built-in plugins (chess, etc.) so they work without a remote catalog
registerBuiltinPlugins().catch((err) => {
	console.error('[plugin-bootstrap] Failed to register built-in plugins:', err)
})

initSettingsStore()
	.then((settings) => {
		const { plugins } = settings

		if (plugins?.catalogUrl) {
			const pollIntervalMs = plugins.pollIntervalMs ?? 60000
			console.info(`[plugin-bootstrap] Starting catalog polling at ${pollIntervalMs}ms interval`)
			cleanupPolling = startCatalogPolling(plugins.catalogUrl, pollIntervalMs, (catalog) => {
				pluginStore.getState().setCatalog(catalog)
			})
		} else {
			console.info('[plugin-bootstrap] No catalog URL configured, skipping legacy plugin polling')
		}

		// Marketplace polling — only for students who have entered a teacher join code
		if (plugins?.marketplaceApiUrl && plugins?.marketplaceStudentJoinCode) {
			const pollIntervalMs = plugins.pollIntervalMs ?? 60000
			console.info(
				`[plugin-bootstrap] Starting marketplace polling for joinCode=${plugins.marketplaceStudentJoinCode}`
			)
			const handle = startMarketplacePolling({
				apiBaseUrl: plugins.marketplaceApiUrl,
				joinCode: plugins.marketplaceStudentJoinCode,
				pollIntervalMs,
			})
			cleanupMarketplacePolling = handle.stop
		}
	})
	.catch((err) => {
		console.error('[plugin-bootstrap] Failed to initialize plugin system:', err)
	})

export function stopPluginPolling() {
	if (cleanupPolling) {
		cleanupPolling()
		cleanupPolling = null
	}
	if (cleanupMarketplacePolling) {
		cleanupMarketplacePolling()
		cleanupMarketplacePolling = null
	}
}
