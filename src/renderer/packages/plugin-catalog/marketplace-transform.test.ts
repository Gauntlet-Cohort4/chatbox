import { describe, expect, it } from 'vitest'
import type { MarketplaceCatalogPlugin } from './marketplace-client'
import { transformMarketplacePlugin } from './marketplace-transform'

const API_BASE = 'https://api.marketplace.test'

function sample(overrides: Partial<MarketplaceCatalogPlugin> = {}): MarketplaceCatalogPlugin {
	return {
		pluginId: 'chess',
		pluginName: 'Chess Tutor',
		description: 'Interactive chess',
		version: '1.0.0',
		author: 'ChatBridge',
		category: 'Math',
		contentRating: 'educational',
		tools: [],
		userInterface: { sandboxPermissions: ['allow-scripts'], isPersistent: true },
		authentication: { authType: 'none' },
		contextPrompt: 'Teach chess concepts',
		capabilities: { supportsScreenshot: true, supportsVerboseState: false, supportsEventLog: false },
		bundle: {
			bundleUrl: 'bundles/chess/1.0.0/bundle.zip',
			bundleVersion: '1.0.0',
			bundleHash: 'abc',
			entryFile: 'index.html',
		},
		...overrides,
	}
}

describe('transformMarketplacePlugin', () => {
	it('maps base fields straight through', () => {
		const result = transformMarketplacePlugin(API_BASE, sample())
		expect(result.pluginId).toBe('chess')
		expect(result.pluginName).toBe('Chess Tutor')
		expect(result.description).toBe('Interactive chess')
		expect(result.version).toBe('1.0.0')
		expect(result.author).toBe('ChatBridge')
		expect(result.contentRating).toBe('educational')
	})

	it('rewrites bundleUrl to absolute download endpoint', () => {
		const result = transformMarketplacePlugin(API_BASE, sample())
		expect(result.bundle.bundleUrl).toBe('https://api.marketplace.test/marketplace/plugins/chess/bundle')
		expect(result.bundle.bundleVersion).toBe('1.0.0')
		expect(result.bundle.bundleHash).toBe('abc')
		expect(result.bundle.entryFile).toBe('index.html')
	})

	it('encodes pluginId in the bundle URL', () => {
		const result = transformMarketplacePlugin(API_BASE, sample({ pluginId: 'plugin with spaces' }))
		expect(result.bundle.bundleUrl).toContain('plugin%20with%20spaces')
	})

	it('maps none-auth subject category to external-public', () => {
		const result = transformMarketplacePlugin(API_BASE, sample())
		expect(result.category).toBe('external-public')
		expect(result.authentication).toEqual({ type: 'none' })
	})

	it('maps api-key auth to external-authenticated', () => {
		const plugin = sample({
			authentication: { authType: 'api-key', keyHeaderName: 'X-API-Key' },
		})
		const result = transformMarketplacePlugin(API_BASE, plugin)
		expect(result.category).toBe('external-authenticated')
		expect(result.authentication).toEqual({ type: 'api-key', keyName: 'X-API-Key' })
	})

	it('maps oauth2-pkce auth with all fields', () => {
		const plugin = sample({
			authentication: {
				authType: 'oauth2-pkce',
				authorizationUrl: 'https://auth.example/authorize',
				tokenUrl: 'https://auth.example/token',
				scopes: ['read', 'write'],
				clientId: 'client-123',
			},
		})
		const result = transformMarketplacePlugin(API_BASE, plugin)
		expect(result.authentication).toEqual({
			type: 'oauth2-pkce',
			authorizationUrl: 'https://auth.example/authorize',
			tokenUrl: 'https://auth.example/token',
			scopes: ['read', 'write'],
			clientId: 'client-123',
		})
		expect(result.category).toBe('external-authenticated')
	})

	it('sets isVerified true and approvedAt to current timestamp', () => {
		const before = Date.now()
		const result = transformMarketplacePlugin(API_BASE, sample())
		expect(result.isVerified).toBe(true)
		expect(result.approvedAt).toBeGreaterThanOrEqual(before)
	})

	it('clamps unrecognized contentRating to general', () => {
		const result = transformMarketplacePlugin(API_BASE, sample({ contentRating: 'weird-rating' }))
		expect(result.contentRating).toBe('general')
	})

	it('defaults tools to empty array when not an array', () => {
		const result = transformMarketplacePlugin(API_BASE, sample({ tools: null as unknown as [] }))
		expect(result.tools).toEqual([])
	})

	it('defaults userInterface when missing', () => {
		const result = transformMarketplacePlugin(
			API_BASE,
			sample({ userInterface: null as unknown as Record<string, unknown> })
		)
		expect(result.userInterface).toEqual({ sandboxPermissions: [], isPersistent: false })
	})
})
