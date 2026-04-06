import { afterEach, describe, expect, it, vi } from 'vitest'
import {
	fetchMarketplaceCatalog,
	generateExchangeCode,
	registerTeacher,
} from './marketplace-client'

const API = 'https://api.marketplace.test'

function mockFetch(
	response: { status: number; body?: unknown; headers?: Record<string, string> }
): ReturnType<typeof vi.fn> {
	return vi.fn().mockResolvedValue(
		new Response(response.body != null ? JSON.stringify(response.body) : null, {
			status: response.status,
			headers: response.headers,
		})
	)
}

describe('registerTeacher', () => {
	afterEach(() => vi.restoreAllMocks())

	it('POSTs to /teachers/register and returns the registration', async () => {
		const fetchMock = mockFetch({
			status: 201,
			body: {
				teacherId: 'teacher_abc',
				teacherName: 'Ms. Rivera',
				joinCode: 'ALPHA1',
				apiToken: 'tok_123',
			},
		})
		vi.stubGlobal('fetch', fetchMock)

		const result = await registerTeacher(API, 'Ms. Rivera')
		expect(result.teacherId).toBe('teacher_abc')
		expect(result.joinCode).toBe('ALPHA1')
		expect(result.apiToken).toBe('tok_123')
		expect(fetchMock).toHaveBeenCalledWith(
			'https://api.marketplace.test/teachers/register',
			expect.objectContaining({ method: 'POST' })
		)
	})

	it('throws on non-2xx response', async () => {
		vi.stubGlobal('fetch', mockFetch({ status: 400 }))
		await expect(registerTeacher(API, 'bad')).rejects.toThrow(/Teacher registration failed/)
	})
})

describe('generateExchangeCode', () => {
	afterEach(() => vi.restoreAllMocks())

	it('POSTs with Authorization: Bearer and returns code', async () => {
		const fetchMock = mockFetch({
			status: 200,
			body: { code: 'abc123', expiresAt: Date.now() + 60_000 },
		})
		vi.stubGlobal('fetch', fetchMock)

		const result = await generateExchangeCode(API, 'tok_123')
		expect(result.code).toBe('abc123')
		const call = fetchMock.mock.calls[0]
		const init = call[1] as RequestInit
		const headers = new Headers(init.headers)
		expect(headers.get('Authorization')).toBe('Bearer tok_123')
	})

	it('throws on 401', async () => {
		vi.stubGlobal('fetch', mockFetch({ status: 401 }))
		await expect(generateExchangeCode(API, 'bad')).rejects.toThrow(/Exchange code failed/)
	})
})

describe('fetchMarketplaceCatalog', () => {
	afterEach(() => vi.restoreAllMocks())

	it('returns ok + catalog + etag on 200', async () => {
		const fetchMock = mockFetch({
			status: 200,
			body: {
				catalogVersion: '2026-04-06T00:00:00Z',
				joinCode: 'ALPHA1',
				plugins: [],
			},
			headers: { ETag: '"abc123"' },
		})
		vi.stubGlobal('fetch', fetchMock)

		const result = await fetchMarketplaceCatalog(API, 'ALPHA1', null)
		expect(result.status).toBe('ok')
		expect(result.catalog?.joinCode).toBe('ALPHA1')
		expect(result.etag).toBe('"abc123"')
	})

	it('sends If-None-Match when previousEtag is set', async () => {
		const fetchMock = mockFetch({ status: 304 })
		vi.stubGlobal('fetch', fetchMock)

		await fetchMarketplaceCatalog(API, 'ALPHA1', '"prev-etag"')
		const call = fetchMock.mock.calls[0]
		const init = call[1] as RequestInit
		const headers = new Headers(init.headers)
		expect(headers.get('If-None-Match')).toBe('"prev-etag"')
	})

	it('returns not-modified on 304 and preserves previous etag', async () => {
		vi.stubGlobal('fetch', mockFetch({ status: 304 }))
		const result = await fetchMarketplaceCatalog(API, 'ALPHA1', '"prev-etag"')
		expect(result.status).toBe('not-modified')
		expect(result.catalog).toBeNull()
		expect(result.etag).toBe('"prev-etag"')
	})

	it('returns not-found on 404', async () => {
		vi.stubGlobal('fetch', mockFetch({ status: 404 }))
		const result = await fetchMarketplaceCatalog(API, 'UNKNOWN', null)
		expect(result.status).toBe('not-found')
		expect(result.catalog).toBeNull()
	})

	it('throws on 500', async () => {
		vi.stubGlobal('fetch', mockFetch({ status: 500 }))
		await expect(fetchMarketplaceCatalog(API, 'ALPHA1', null)).rejects.toThrow(/Catalog fetch failed/)
	})
})
