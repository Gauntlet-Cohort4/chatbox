import { PluginCatalogSchema, type PluginCatalog } from '@shared/types/plugin'

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
				lastKnownVersion = catalog.catalogVersion
				onUpdate(catalog)
			}
		} catch (error) {
			console.error('[plugin-catalog] Polling failed:', error)
		}
	}

	const intervalId = setInterval(poll, pollIntervalMs)

	return () => {
		clearInterval(intervalId)
	}
}
