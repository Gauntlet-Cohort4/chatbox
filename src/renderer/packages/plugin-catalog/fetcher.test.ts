import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PluginCatalog } from '@shared/types/plugin'
import { fetchCatalog, startCatalogPolling } from './fetcher'

function createValidCatalogResponse(): PluginCatalog {
	return {
		catalogVersion: 1,
		lastUpdatedAt: Date.now(),
		applications: [],
	}
}

describe('fetchCatalog', () => {
	beforeEach(() => {
		vi.stubGlobal('fetch', vi.fn())
	})

	afterEach(() => {
		vi.restoreAllMocks()
	})

	it('returns parsed PluginCatalog on valid 200 response', async () => {
		const catalog = createValidCatalogResponse()
		vi.mocked(fetch).mockResolvedValue(
			new Response(JSON.stringify(catalog), { status: 200 })
		)
		const result = await fetchCatalog('https://example.com/catalog.json')
		expect(result).toEqual(catalog)
	})

	it('returns null on 304 response', async () => {
		vi.mocked(fetch).mockResolvedValue(
			new Response(null, { status: 304 })
		)
		const result = await fetchCatalog('https://example.com/catalog.json')
		expect(result).toBeNull()
	})

	it('sends cache: no-cache in fetch options', async () => {
		vi.mocked(fetch).mockResolvedValue(
			new Response(JSON.stringify(createValidCatalogResponse()), { status: 200 })
		)
		await fetchCatalog('https://example.com/catalog.json')
		expect(fetch).toHaveBeenCalledWith('https://example.com/catalog.json', { cache: 'no-cache' })
	})

	it('throws on 500 response', async () => {
		vi.mocked(fetch).mockResolvedValue(
			new Response('Server Error', { status: 500 })
		)
		await expect(fetchCatalog('https://example.com/catalog.json')).rejects.toThrow()
	})

	it('throws on invalid JSON body', async () => {
		vi.mocked(fetch).mockResolvedValue(
			new Response('not json', { status: 200 })
		)
		await expect(fetchCatalog('https://example.com/catalog.json')).rejects.toThrow()
	})

	it('throws on valid JSON that fails PluginCatalogSchema validation', async () => {
		vi.mocked(fetch).mockResolvedValue(
			new Response(JSON.stringify({ invalid: true }), { status: 200 })
		)
		await expect(fetchCatalog('https://example.com/catalog.json')).rejects.toThrow()
	})
})

describe('startCatalogPolling', () => {
	beforeEach(() => {
		vi.useFakeTimers()
		vi.stubGlobal('fetch', vi.fn())
	})

	afterEach(() => {
		vi.useRealTimers()
		vi.restoreAllMocks()
	})

	it('calls onUpdate when catalogVersion changes', async () => {
		const catalog = createValidCatalogResponse()
		vi.mocked(fetch).mockResolvedValue(
			new Response(JSON.stringify(catalog), { status: 200 })
		)
		const onUpdate = vi.fn()
		const cleanup = startCatalogPolling('https://example.com/catalog.json', 1000, onUpdate)

		await vi.advanceTimersByTimeAsync(1000)
		expect(onUpdate).toHaveBeenCalledWith(catalog)
		cleanup()
	})

	it('does NOT call onUpdate when catalogVersion is unchanged', async () => {
		const catalog = createValidCatalogResponse()
		vi.mocked(fetch).mockResolvedValue(
			new Response(JSON.stringify(catalog), { status: 200 })
		)
		const onUpdate = vi.fn()
		const cleanup = startCatalogPolling('https://example.com/catalog.json', 1000, onUpdate)

		await vi.advanceTimersByTimeAsync(1000)
		expect(onUpdate).toHaveBeenCalledTimes(1)

		// Second tick — same version, should not call again
		await vi.advanceTimersByTimeAsync(1000)
		expect(onUpdate).toHaveBeenCalledTimes(1)
		cleanup()
	})

	it('does NOT call onUpdate when fetchCatalog returns null (304)', async () => {
		vi.mocked(fetch).mockResolvedValue(
			new Response(null, { status: 304 })
		)
		const onUpdate = vi.fn()
		const cleanup = startCatalogPolling('https://example.com/catalog.json', 1000, onUpdate)

		await vi.advanceTimersByTimeAsync(1000)
		expect(onUpdate).not.toHaveBeenCalled()
		cleanup()
	})

	it('continues polling after a fetch failure (does not stop)', async () => {
		const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
		vi.mocked(fetch)
			.mockRejectedValueOnce(new Error('Network error'))
			.mockResolvedValueOnce(
				new Response(JSON.stringify(createValidCatalogResponse()), { status: 200 })
			)

		const onUpdate = vi.fn()
		const cleanup = startCatalogPolling('https://example.com/catalog.json', 1000, onUpdate)

		// First tick — failure
		await vi.advanceTimersByTimeAsync(1000)
		expect(onUpdate).not.toHaveBeenCalled()

		// Second tick — success
		await vi.advanceTimersByTimeAsync(1000)
		expect(onUpdate).toHaveBeenCalledTimes(1)

		cleanup()
		consoleError.mockRestore()
	})

	it('logs error on fetch failure', async () => {
		const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
		vi.mocked(fetch).mockRejectedValue(new Error('Network error'))

		const cleanup = startCatalogPolling('https://example.com/catalog.json', 1000, vi.fn())
		await vi.advanceTimersByTimeAsync(1000)

		expect(consoleError).toHaveBeenCalled()
		cleanup()
		consoleError.mockRestore()
	})

	it('cleanup function stops the interval', async () => {
		vi.mocked(fetch).mockResolvedValue(
			new Response(JSON.stringify(createValidCatalogResponse()), { status: 200 })
		)
		const onUpdate = vi.fn()
		const cleanup = startCatalogPolling('https://example.com/catalog.json', 1000, onUpdate)

		cleanup()
		await vi.advanceTimersByTimeAsync(5000)
		expect(onUpdate).not.toHaveBeenCalled()
	})
})
