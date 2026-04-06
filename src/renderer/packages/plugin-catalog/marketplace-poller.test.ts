import type { PluginCatalog } from '@shared/types/plugin'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/platform', () => ({
	default: {
		type: 'web',
		appLog: vi.fn(),
		setStoreBlob: vi.fn(),
		getStoreBlob: vi.fn(),
		delStoreBlob: vi.fn(),
	},
}))

const setCatalogMock = vi.fn()
const getStateMock = vi.fn(() => ({
	catalog: null as PluginCatalog | null,
	setCatalog: setCatalogMock,
}))

vi.mock('@/stores/pluginStore', () => ({
	pluginStore: { getState: () => getStateMock() },
}))

import { mergeMarketplaceIntoCatalog, startMarketplacePolling } from './marketplace-poller'

function makeCatalogResponse(version = '2026-04-06T00:00:00Z', plugins: unknown[] = []): Response {
	return new Response(
		JSON.stringify({
			catalogVersion: version,
			joinCode: 'ALPHA1',
			plugins,
		}),
		{ status: 200, headers: { ETag: '"v1"' } }
	)
}

function marketplacePluginFixture(pluginId: string): Record<string, unknown> {
	return {
		pluginId,
		pluginName: pluginId,
		description: 'test',
		version: '1.0.0',
		author: 'tester',
		category: 'Math',
		contentRating: 'educational',
		tools: [],
		userInterface: {},
		authentication: { authType: 'none' },
		contextPrompt: null,
		capabilities: {},
		bundle: {
			bundleUrl: `bundles/${pluginId}/1.0.0/bundle.zip`,
			bundleVersion: '1.0.0',
			bundleHash: 'hash',
			entryFile: 'index.html',
		},
	}
}

describe('mergeMarketplaceIntoCatalog', () => {
	it('preserves existing plugins whose ids are not in the marketplace result', () => {
		const existing: PluginCatalog = {
			catalogVersion: 1,
			lastUpdatedAt: 0,
			applications: [
				{
					pluginId: 'chess-builtin',
					pluginName: 'Chess',
					description: '',
					version: '1',
					author: 'x',
					category: 'internal',
					contentRating: 'safe',
					tools: [],
					bundle: { bundleUrl: 'builtin://chess', bundleVersion: '1', bundleHash: 'h', entryFile: 'i' },
					userInterface: { sandboxPermissions: [], isPersistent: false },
					authentication: { type: 'none' },
					capabilities: { supportsScreenshot: false, supportsVerboseState: false, supportsEventLog: false },
					isVerified: true,
					approvedAt: 0,
				},
			],
		}
		const marketplaceEntry = {
			pluginId: 'weather',
			pluginName: 'Weather',
			description: '',
			version: '1',
			author: 'x',
			category: 'external-public' as const,
			contentRating: 'general' as const,
			tools: [],
			bundle: { bundleUrl: 'https://x/bundle', bundleVersion: '1', bundleHash: 'h', entryFile: 'i' },
			userInterface: { sandboxPermissions: [], isPersistent: false },
			authentication: { type: 'none' as const },
			capabilities: { supportsScreenshot: false, supportsVerboseState: false, supportsEventLog: false },
			isVerified: true,
			approvedAt: 0,
		}
		const merged = mergeMarketplaceIntoCatalog(existing, [marketplaceEntry], 2)
		expect(merged.applications.map((a) => a.pluginId)).toEqual(['chess-builtin', 'weather'])
		expect(merged.catalogVersion).toBe(2)
	})

	it('replaces existing marketplace entry when same id is returned again', () => {
		const existing: PluginCatalog = {
			catalogVersion: 1,
			lastUpdatedAt: 0,
			applications: [
				{
					pluginId: 'weather',
					pluginName: 'OLD',
					description: '',
					version: '1',
					author: 'x',
					category: 'external-public',
					contentRating: 'general',
					tools: [],
					bundle: { bundleUrl: 'x', bundleVersion: '1', bundleHash: 'h', entryFile: 'i' },
					userInterface: { sandboxPermissions: [], isPersistent: false },
					authentication: { type: 'none' },
					capabilities: { supportsScreenshot: false, supportsVerboseState: false, supportsEventLog: false },
					isVerified: true,
					approvedAt: 0,
				},
			],
		}
		const newer = {
			pluginId: 'weather',
			pluginName: 'NEW',
			description: '',
			version: '2',
			author: 'x',
			category: 'external-public' as const,
			contentRating: 'general' as const,
			tools: [],
			bundle: { bundleUrl: 'x', bundleVersion: '2', bundleHash: 'h', entryFile: 'i' },
			userInterface: { sandboxPermissions: [], isPersistent: false },
			authentication: { type: 'none' as const },
			capabilities: { supportsScreenshot: false, supportsVerboseState: false, supportsEventLog: false },
			isVerified: true,
			approvedAt: 0,
		}
		const merged = mergeMarketplaceIntoCatalog(existing, [newer], 2)
		expect(merged.applications).toHaveLength(1)
		expect(merged.applications[0].pluginName).toBe('NEW')
	})

	it('handles null existing catalog', () => {
		const merged = mergeMarketplaceIntoCatalog(null, [], 1)
		expect(merged.applications).toEqual([])
	})
})

describe('startMarketplacePolling', () => {
	beforeEach(() => {
		setCatalogMock.mockClear()
		getStateMock.mockImplementation(() => ({ catalog: null, setCatalog: setCatalogMock }))
	})

	afterEach(() => {
		vi.restoreAllMocks()
	})

	it('calls the catalog endpoint on start and applies the result', async () => {
		// Each call returns a fresh Response — Response bodies can only be
		// consumed once, and startMarketplacePolling fires an immediate tick.
		const fetchMock = vi.fn().mockImplementation(() =>
			Promise.resolve(
				makeCatalogResponse('2026-04-06T00:00:00Z', [marketplacePluginFixture('weather')])
			)
		)
		vi.stubGlobal('fetch', fetchMock)

		const handle = startMarketplacePolling({
			apiBaseUrl: 'https://api.marketplace.test',
			joinCode: 'ALPHA1',
			pollIntervalMs: 60_000,
		})

		await handle.pollNow()
		expect(fetchMock).toHaveBeenCalled()
		expect(setCatalogMock).toHaveBeenCalled()
		const applied = setCatalogMock.mock.calls.at(-1)?.[0] as PluginCatalog
		expect(applied.applications[0].pluginId).toBe('weather')

		handle.stop()
	})

	it('sends If-None-Match on subsequent polls after receiving an etag', async () => {
		let callCount = 0
		const fetchMock = vi.fn().mockImplementation(() => {
			callCount += 1
			if (callCount <= 2) {
				// First two calls: startup tick + first pollNow, both see full catalog
				return Promise.resolve(
					makeCatalogResponse('2026-04-06T00:00:00Z', [marketplacePluginFixture('weather')])
				)
			}
			// Third call (second pollNow): 304 with the etag already threaded through
			return Promise.resolve(new Response(null, { status: 304 }))
		})
		vi.stubGlobal('fetch', fetchMock)

		const handle = startMarketplacePolling({
			apiBaseUrl: 'https://api.marketplace.test',
			joinCode: 'ALPHA1',
			pollIntervalMs: 60_000,
		})
		// Wait for the startup tick to finish so etag is populated
		await handle.pollNow()
		// Second explicit poll should carry the etag
		await handle.pollNow()

		// Find the last call (which had the 304 response) — it should include If-None-Match
		const lastCall = fetchMock.mock.calls.at(-1)
		const init = lastCall?.[1] as RequestInit
		const headers = new Headers(init.headers)
		expect(headers.get('If-None-Match')).toBe('"v1"')

		handle.stop()
	})

	it('does not crash on 404 (returns not-found silently)', async () => {
		const fetchMock = vi
			.fn()
			.mockImplementation(() => Promise.resolve(new Response(null, { status: 404 })))
		vi.stubGlobal('fetch', fetchMock)

		const handle = startMarketplacePolling({
			apiBaseUrl: 'https://api.marketplace.test',
			joinCode: 'NOPE99',
			pollIntervalMs: 60_000,
		})
		const result = await handle.pollNow()
		expect(result.status).toBe('not-found')
		expect(setCatalogMock).not.toHaveBeenCalled()
		handle.stop()
	})

	it('stop() makes subsequent ticks no-ops', async () => {
		const fetchMock = vi
			.fn()
			.mockImplementation(() => Promise.resolve(makeCatalogResponse('2026-04-06T00:00:00Z', [])))
		vi.stubGlobal('fetch', fetchMock)

		const handle = startMarketplacePolling({
			apiBaseUrl: 'https://api.marketplace.test',
			joinCode: 'ALPHA1',
			pollIntervalMs: 60_000,
		})
		// Let the immediate startup tick complete so we don't race with it
		await handle.pollNow()
		handle.stop()
		const result = await handle.pollNow()
		expect(result.status).toBe('not-found')
	})
})
