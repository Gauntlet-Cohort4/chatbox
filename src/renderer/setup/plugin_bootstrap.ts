import { startCatalogPolling } from '@/packages/plugin-catalog/fetcher'
import { pluginStore } from '@/stores/pluginStore'
import { initSettingsStore } from '@/stores/settingsStore'

let cleanupPolling: (() => void) | null = null

initSettingsStore()
	.then((settings) => {
		const { plugins } = settings
		if (!plugins?.catalogUrl) {
			console.info('[plugin-bootstrap] No catalog URL configured, skipping plugin polling')
			return
		}

		const pollIntervalMs = plugins.pollIntervalMs ?? 60000
		console.info(`[plugin-bootstrap] Starting catalog polling at ${pollIntervalMs}ms interval`)

		cleanupPolling = startCatalogPolling(plugins.catalogUrl, pollIntervalMs, (catalog) => {
			pluginStore.getState().setCatalog(catalog)
		})
	})
	.catch((err) => {
		console.error('[plugin-bootstrap] Failed to initialize plugin system:', err)
	})

export function stopPluginPolling() {
	if (cleanupPolling) {
		cleanupPolling()
		cleanupPolling = null
	}
}
