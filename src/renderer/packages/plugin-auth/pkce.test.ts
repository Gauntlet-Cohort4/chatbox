import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { generateCodeVerifier, generateCodeChallenge, buildAuthorizationUrl, exchangeCodeForToken, refreshAccessToken } from './pkce'
import type { PluginAuthConfig } from '@shared/types/plugin'

type OAuth2PkceConfig = Extract<PluginAuthConfig, { type: 'oauth2-pkce' }>

const mockConfig: OAuth2PkceConfig = {
	type: 'oauth2-pkce',
	authorizationUrl: 'https://auth.example.com/authorize',
	tokenUrl: 'https://auth.example.com/token',
	scopes: ['read', 'write'],
	clientId: 'test-client-id',
}

describe('generateCodeVerifier', () => {
	it('returns string of length between 43 and 128', () => {
		const verifier = generateCodeVerifier()
		expect(verifier.length).toBeGreaterThanOrEqual(43)
		expect(verifier.length).toBeLessThanOrEqual(128)
	})

	it('uses only URL-safe characters', () => {
		const verifier = generateCodeVerifier()
		expect(verifier).toMatch(/^[A-Za-z0-9\-._~]+$/)
	})

	it('returns different values on consecutive calls', () => {
		const v1 = generateCodeVerifier()
		const v2 = generateCodeVerifier()
		expect(v1).not.toBe(v2)
	})
})

describe('generateCodeChallenge', () => {
	it('produces a valid base64url string (no +, /, or = characters)', async () => {
		const verifier = generateCodeVerifier()
		const challenge = await generateCodeChallenge(verifier)
		expect(challenge).not.toMatch(/[+/=]/)
		expect(challenge.length).toBeGreaterThan(0)
	})

	it('produces consistent output for same input', async () => {
		const verifier = 'test-verifier-value-that-is-long-enough-for-pkce'
		const c1 = await generateCodeChallenge(verifier)
		const c2 = await generateCodeChallenge(verifier)
		expect(c1).toBe(c2)
	})
})

describe('buildAuthorizationUrl', () => {
	const codeChallenge = 'test-challenge'
	const state = 'test-state'
	const redirectUri = 'https://app.example.com/callback'

	it('includes response_type=code parameter', () => {
		const url = buildAuthorizationUrl(mockConfig, codeChallenge, state, redirectUri)
		const parsed = new URL(url)
		expect(parsed.searchParams.get('response_type')).toBe('code')
	})

	it('includes client_id from config', () => {
		const url = buildAuthorizationUrl(mockConfig, codeChallenge, state, redirectUri)
		const parsed = new URL(url)
		expect(parsed.searchParams.get('client_id')).toBe('test-client-id')
	})

	it('includes redirect_uri parameter', () => {
		const url = buildAuthorizationUrl(mockConfig, codeChallenge, state, redirectUri)
		const parsed = new URL(url)
		expect(parsed.searchParams.get('redirect_uri')).toBe(redirectUri)
	})

	it('includes scope with spaces joining config.scopes', () => {
		const url = buildAuthorizationUrl(mockConfig, codeChallenge, state, redirectUri)
		const parsed = new URL(url)
		expect(parsed.searchParams.get('scope')).toBe('read write')
	})

	it('includes code_challenge parameter', () => {
		const url = buildAuthorizationUrl(mockConfig, codeChallenge, state, redirectUri)
		const parsed = new URL(url)
		expect(parsed.searchParams.get('code_challenge')).toBe(codeChallenge)
	})

	it('includes code_challenge_method=S256 parameter', () => {
		const url = buildAuthorizationUrl(mockConfig, codeChallenge, state, redirectUri)
		const parsed = new URL(url)
		expect(parsed.searchParams.get('code_challenge_method')).toBe('S256')
	})

	it('includes state parameter', () => {
		const url = buildAuthorizationUrl(mockConfig, codeChallenge, state, redirectUri)
		const parsed = new URL(url)
		expect(parsed.searchParams.get('state')).toBe(state)
	})
})

describe('exchangeCodeForToken', () => {
	const originalFetch = globalThis.fetch

	beforeEach(() => {
		vi.stubGlobal('fetch', vi.fn())
	})

	afterEach(() => {
		vi.restoreAllMocks()
		globalThis.fetch = originalFetch
	})

	it('sends POST request to config.tokenUrl', async () => {
		const mockFetch = vi.mocked(globalThis.fetch)
		mockFetch.mockResolvedValue(
			new Response(JSON.stringify({ access_token: 'tok' }), { status: 200 })
		)

		await exchangeCodeForToken(mockConfig, 'auth-code', 'verifier', 'https://app.example.com/callback')
		expect(mockFetch).toHaveBeenCalledWith(mockConfig.tokenUrl, expect.objectContaining({ method: 'POST' }))
	})

	it('sends form-urlencoded body with grant_type=authorization_code', async () => {
		const mockFetch = vi.mocked(globalThis.fetch)
		mockFetch.mockResolvedValue(
			new Response(JSON.stringify({ access_token: 'tok' }), { status: 200 })
		)

		await exchangeCodeForToken(mockConfig, 'auth-code', 'verifier', 'https://app.example.com/callback')
		const call = mockFetch.mock.calls[0]
		const body = call[1]?.body as string
		expect(body).toContain('grant_type=authorization_code')
		const headers = call[1]?.headers as Record<string, string>
		expect(headers['Content-Type']).toBe('application/x-www-form-urlencoded')
	})

	it('sends code_verifier in body', async () => {
		const mockFetch = vi.mocked(globalThis.fetch)
		mockFetch.mockResolvedValue(
			new Response(JSON.stringify({ access_token: 'tok' }), { status: 200 })
		)

		await exchangeCodeForToken(mockConfig, 'auth-code', 'my-verifier', 'https://app.example.com/callback')
		const body = mockFetch.mock.calls[0][1]?.body as string
		expect(body).toContain('code_verifier=my-verifier')
	})

	it('returns parsed token with accessToken mapped from access_token', async () => {
		const mockFetch = vi.mocked(globalThis.fetch)
		mockFetch.mockResolvedValue(
			new Response(JSON.stringify({ access_token: 'my-access-token' }), { status: 200 })
		)

		const result = await exchangeCodeForToken(mockConfig, 'code', 'verifier', 'https://app.example.com/callback')
		expect(result.accessToken).toBe('my-access-token')
	})

	it('returns refreshToken when present in response', async () => {
		const mockFetch = vi.mocked(globalThis.fetch)
		mockFetch.mockResolvedValue(
			new Response(JSON.stringify({ access_token: 'tok', refresh_token: 'ref-tok' }), { status: 200 })
		)

		const result = await exchangeCodeForToken(mockConfig, 'code', 'verifier', 'https://app.example.com/callback')
		expect(result.refreshToken).toBe('ref-tok')
	})

	it('computes expiresAt from expires_in', async () => {
		const now = Date.now()
		vi.spyOn(Date, 'now').mockReturnValue(now)
		const mockFetch = vi.mocked(globalThis.fetch)
		mockFetch.mockResolvedValue(
			new Response(JSON.stringify({ access_token: 'tok', expires_in: 3600 }), { status: 200 })
		)

		const result = await exchangeCodeForToken(mockConfig, 'code', 'verifier', 'https://app.example.com/callback')
		expect(result.expiresAt).toBe(now + 3600 * 1000)
	})

	it('throws on non-200 response', async () => {
		const mockFetch = vi.mocked(globalThis.fetch)
		mockFetch.mockResolvedValue(
			new Response('Unauthorized', { status: 401 })
		)

		await expect(
			exchangeCodeForToken(mockConfig, 'code', 'verifier', 'https://app.example.com/callback')
		).rejects.toThrow()
	})
})

describe('refreshAccessToken', () => {
	const originalFetch = globalThis.fetch

	beforeEach(() => {
		vi.stubGlobal('fetch', vi.fn())
	})

	afterEach(() => {
		vi.restoreAllMocks()
		globalThis.fetch = originalFetch
	})

	it('sends POST with grant_type=refresh_token', async () => {
		const mockFetch = vi.mocked(globalThis.fetch)
		mockFetch.mockResolvedValue(
			new Response(JSON.stringify({ access_token: 'new-tok' }), { status: 200 })
		)

		await refreshAccessToken(mockConfig, 'old-refresh-token')
		const body = mockFetch.mock.calls[0][1]?.body as string
		expect(body).toContain('grant_type=refresh_token')
	})

	it('sends refresh_token in body', async () => {
		const mockFetch = vi.mocked(globalThis.fetch)
		mockFetch.mockResolvedValue(
			new Response(JSON.stringify({ access_token: 'new-tok' }), { status: 200 })
		)

		await refreshAccessToken(mockConfig, 'old-refresh-token')
		const body = mockFetch.mock.calls[0][1]?.body as string
		expect(body).toContain('refresh_token=old-refresh-token')
	})

	it('returns new token response', async () => {
		const mockFetch = vi.mocked(globalThis.fetch)
		mockFetch.mockResolvedValue(
			new Response(JSON.stringify({ access_token: 'new-tok', refresh_token: 'new-ref', expires_in: 7200 }), { status: 200 })
		)

		const now = Date.now()
		vi.spyOn(Date, 'now').mockReturnValue(now)
		const result = await refreshAccessToken(mockConfig, 'old-refresh-token')
		expect(result.accessToken).toBe('new-tok')
		expect(result.refreshToken).toBe('new-ref')
		expect(result.expiresAt).toBe(now + 7200 * 1000)
	})
})
