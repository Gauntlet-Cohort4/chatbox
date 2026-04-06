/**
 * Marketplace catalog polling loop.
 *
 * Polls the ChatBridge Marketplace `/catalog/:joinCode` endpoint on a
 * fixed interval and merges the returned plugins into the pluginStore's
 * catalog, keeping any built-in plugins intact.
 *
 * ETag cache: the last seen ETag is held in memory so repeated unchanged
 * polls return 304 and do not trigger a catalog update.
 */
import type { PluginCatalog, PluginCatalogEntry } from '@shared/types/plugin'
import { logPluginEvent } from '@/packages/plugin-logger/logger'
import { pluginStore } from '@/stores/pluginStore'
import { fetchMarketplaceCatalog, type CatalogFetchResult } from './marketplace-client'
import { transformMarketplacePlugin } from './marketplace-transform'

interface MarketplacePollerConfig {
	apiBaseUrl: string
	joinCode: string
	pollIntervalMs?: number
}

interface MarketplacePollerHandle {
	stop: () => void
	pollNow: () => Promise<CatalogFetchResult>
}

const DEFAULT_POLL_INTERVAL_MS = 60_000

/**
 * Merge marketplace plugins into the existing pluginStore catalog.
 * Built-in plugins (and any other non-marketplace entries) are preserved
 * by keeping every existing entry whose pluginId is NOT in the marketplace
 * result, then appending the marketplace entries.
 */
export function mergeMarketplaceIntoCatalog(
	existing: PluginCatalog | null,
	marketplaceEntries: PluginCatalogEntry[],
	catalogVersion: number
): PluginCatalog {
	const marketplaceIds = new Set(marketplaceEntries.map((p) => p.pluginId))
	const preserved = (existing?.applications ?? []).filter((p) => !marketplaceIds.has(p.pluginId))
	return {
		catalogVersion,
		lastUpdatedAt: Date.now(),
		applications: [...preserved, ...marketplaceEntries],
	}
}

/**
 * Convert an ISO timestamp string into a monotonic integer version so it
 * fits the ChatBridge PluginCatalog schema (which expects a number).
 */
function catalogVersionFromIso(iso: string): number {
	const parsed = Date.parse(iso)
	if (Number.isFinite(parsed)) return parsed
	return Date.now()
}

async function pollOnce(
	config: MarketplacePollerConfig,
	previousEtag: string | null
): Promise<{ result: CatalogFetchResult; nextEtag: string | null }> {
	try {
		const result = await fetchMarketplaceCatalog(config.apiBaseUrl, config.joinCode, previousEtag)

		if (result.status === 'not-modified') {
			logPluginEvent('marketplace_poll_unchanged', 'system')
			return { result, nextEtag: previousEtag }
		}

		if (result.status === 'not-found') {
			logPluginEvent('marketplace_poll_not_found', 'system', { joinCode: config.joinCode })
			return { result, nextEtag: null }
		}

		if (result.catalog) {
			const transformed = result.catalog.plugins.map((p) =>
				transformMarketplacePlugin(config.apiBaseUrl, p)
			)
			const version = catalogVersionFromIso(result.catalog.catalogVersion)
			const existing = pluginStore.getState().catalog
			const merged = mergeMarketplaceIntoCatalog(existing, transformed, version)
			pluginStore.getState().setCatalog(merged)
			logPluginEvent('marketplace_poll_applied', 'system', {
				pluginCount: transformed.length,
				catalogVersion: version,
			})
		}

		return { result, nextEtag: result.etag }
	} catch (error) {
		logPluginEvent('marketplace_poll_failure', 'system', { error: String(error) })
		console.error('[marketplace-poller] Poll failed:', error)
		return { result: { status: 'not-found', catalog: null, etag: null }, nextEtag: previousEtag }
	}
}

/**
 * Start the marketplace polling loop. Returns a handle that can stop the
 * loop and force an immediate poll.
 */
export function startMarketplacePolling(config: MarketplacePollerConfig): MarketplacePollerHandle {
	let etag: string | null = null
	let stopped = false

	const interval = config.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS

	const tick = async (): Promise<CatalogFetchResult> => {
		if (stopped) return { status: 'not-found', catalog: null, etag: null }
		const { result, nextEtag } = await pollOnce(config, etag)
		etag = nextEtag
		return result
	}

	// Kick off the first poll immediately
	void tick()

	const intervalId = setInterval(() => {
		void tick()
	}, interval)

	return {
		stop() {
			stopped = true
			clearInterval(intervalId)
		},
		pollNow: tick,
	}
}
