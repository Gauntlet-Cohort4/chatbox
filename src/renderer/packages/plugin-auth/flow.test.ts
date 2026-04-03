import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { PluginManifest } from '@shared/types/plugin'
import { pluginStore } from '@/stores/pluginStore'

// Mock the pkce module
vi.mock('./pkce', () => ({
	generateCodeVerifier: vi.fn(() => 'mock-verifier'),
	generateCodeChallenge: vi.fn(() => Promise.resolve('mock-challenge')),
	buildAuthorizationUrl: vi.fn(() => 'https://auth.example.com/authorize?mock=true'),
	exchangeCodeForToken: vi.fn(() => Promise.resolve({ accessToken: 'tok', refreshToken: 'ref' })),
	refreshAccessToken: vi.fn(() => Promise.resolve({ accessToken: 'new-tok', refreshToken: 'new-ref', expiresAt: Date.now() + 3600000 })),
}))

// Mock platform
vi.mock('@/platform', () => ({
	default: {
		type: 'web' as const,
		openLink: vi.fn(() => Promise.resolve()),
	},
}))

import { ensureValidToken, startOAuthFlow } from './flow'
import * as pkce from './pkce'

const makeManifest = (authType: string): PluginManifest => ({
	pluginId: 'test-plugin',
	pluginName: 'Test Plugin',
	description: 'Test',
	version: '1.0.0',
	author: 'Test',
	category: 'external-authenticated',
	contentRating: 'safe',
	tools: [],
	bundle: {
		bundleUrl: 'https://example.com/bundle.zip',
		bundleVersion: '1.0.0',
		bundleHash: 'abc123',
		entryFile: 'index.html',
	},
	userInterface: {
		sandboxPermissions: [],
		isPersistent: false,
	},
	authentication: authType === 'oauth2-pkce'
		? {
			type: 'oauth2-pkce' as const,
			authorizationUrl: 'https://auth.example.com/authorize',
			tokenUrl: 'https://auth.example.com/token',
			scopes: ['read'],
			clientId: 'client-123',
		}
		: { type: 'none' as const },
	capabilities: {
		supportsScreenshot: false,
		supportsVerboseState: false,
		supportsEventLog: false,
	},
})

describe('ensureValidToken', () => {
	beforeEach(() => {
		// Reset store tokens
		pluginStore.getState().clearPluginToken('test-plugin')
	})

	it('returns stored accessToken when not expired', async () => {
		pluginStore.getState().setPluginToken('test-plugin', {
			accessToken: 'valid-token',
			expiresAt: Date.now() + 300_000,
		})

		const token = await ensureValidToken('test-plugin', makeManifest('oauth2-pkce'))
		expect(token).toBe('valid-token')
	})

	it('returns stored accessToken when expiresAt is more than 60s in future', async () => {
		const futureTime = Date.now() + 120_000
		pluginStore.getState().setPluginToken('test-plugin', {
			accessToken: 'future-token',
			expiresAt: futureTime,
		})

		const token = await ensureValidToken('test-plugin', makeManifest('oauth2-pkce'))
		expect(token).toBe('future-token')
	})

	it('calls refreshAccessToken when token is expired but refreshToken exists', async () => {
		pluginStore.getState().setPluginToken('test-plugin', {
			accessToken: 'expired-token',
			refreshToken: 'my-refresh',
			expiresAt: Date.now() - 1000,
		})

		const refreshMock = vi.mocked(pkce.refreshAccessToken)
		refreshMock.mockResolvedValue({ accessToken: 'refreshed-tok', refreshToken: 'new-ref', expiresAt: Date.now() + 3600000 })

		const token = await ensureValidToken('test-plugin', makeManifest('oauth2-pkce'))
		expect(refreshMock).toHaveBeenCalled()
		expect(token).toBe('refreshed-tok')
	})

	it('stores new token after successful refresh', async () => {
		const newExpiresAt = Date.now() + 3600000
		pluginStore.getState().setPluginToken('test-plugin', {
			accessToken: 'expired-token',
			refreshToken: 'my-refresh',
			expiresAt: Date.now() - 1000,
		})

		vi.mocked(pkce.refreshAccessToken).mockResolvedValue({
			accessToken: 'refreshed-tok',
			refreshToken: 'new-ref',
			expiresAt: newExpiresAt,
		})

		await ensureValidToken('test-plugin', makeManifest('oauth2-pkce'))
		const stored = pluginStore.getState().pluginTokens['test-plugin']
		expect(stored.accessToken).toBe('refreshed-tok')
	})

	it('throws when no token is stored', async () => {
		await expect(
			ensureValidToken('test-plugin', makeManifest('oauth2-pkce'))
		).rejects.toThrow()
	})

	it('throws when token is expired and no refreshToken exists', async () => {
		pluginStore.getState().setPluginToken('test-plugin', {
			accessToken: 'expired-token',
			expiresAt: Date.now() - 1000,
		})

		await expect(
			ensureValidToken('test-plugin', makeManifest('oauth2-pkce'))
		).rejects.toThrow()
	})

	it('throws when refresh fails', async () => {
		pluginStore.getState().setPluginToken('test-plugin', {
			accessToken: 'expired-token',
			refreshToken: 'bad-refresh',
			expiresAt: Date.now() - 1000,
		})

		vi.mocked(pkce.refreshAccessToken).mockRejectedValue(new Error('Refresh failed'))

		await expect(
			ensureValidToken('test-plugin', makeManifest('oauth2-pkce'))
		).rejects.toThrow()
	})
})

describe('startOAuthFlow', () => {
	it('throws when manifest authentication is not oauth2-pkce', async () => {
		const manifest = makeManifest('none')
		await expect(startOAuthFlow(manifest)).rejects.toThrow()
	})
})
