import { PluginCatalogSchema, type PluginCatalog } from '@shared/types/plugin'
import { logPluginEvent } from '@/packages/plugin-logger/logger'

export async function fetchCatalog(catalogUrl: string): Promise<PluginCatalog | null> {
	const response = await fetch(catalogUrl, { cache: 'no-cache' })

	if (response.status === 304) {
		return null
	}

	if (!response.ok) {
		throw new Error(`Catalog fetch failed with status ${response.status}`)
	}

	const json = await response.json()
	return PluginCatalogSchema.parse(json)
}

export function startCatalogPolling(
	catalogUrl: string,
	pollIntervalMs: number,
	onUpdate: (catalog: PluginCatalog) => void
): () => void {
	let lastKnownVersion: number | null = null

	const poll = async () => {
		try {
			const catalog = await fetchCatalog(catalogUrl)
			if (catalog !== null && catalog.catalogVersion !== lastKnownVersion) {
				logPluginEvent('catalog_update', 'system', { previousVersion: lastKnownVersion, newVersion: catalog.catalogVersion })
				lastKnownVersion = catalog.catalogVersion
				onUpdate(catalog)
			}
			logPluginEvent('catalog_poll_success', 'system')
		} catch (error) {
			logPluginEvent('catalog_poll_failure', 'system', { error: String(error) })
			console.error('[plugin-catalog] Polling failed:', error)
		}
	}

	const intervalId = setInterval(poll, pollIntervalMs)

	return () => {
		clearInterval(intervalId)
	}
}
