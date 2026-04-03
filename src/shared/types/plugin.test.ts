import { describe, expect, it } from 'vitest'
import {
	PluginAuthConfigSchema,
	PluginCatalogEntrySchema,
	PluginCatalogSchema,
	PluginManifestSchema,
	PluginToolDefinitionSchema,
	PluginToolParameterSchema,
} from './plugin'

function createValidManifest(overrides = {}) {
	return {
		pluginId: 'test-plugin',
		pluginName: 'Test Plugin',
		description: 'A test plugin',
		version: '1.0.0',
		author: 'Test Author',
		category: 'internal' as const,
		contentRating: 'safe' as const,
		tools: [
			{
				toolName: 'test_tool',
				toolDescription: 'A test tool',
				parameters: [
					{
						parameterName: 'input',
						parameterType: 'string' as const,
						parameterDescription: 'Test input',
					},
				],
			},
		],
		bundle: {
			bundleUrl: 'https://example.com/bundle.zip',
			bundleVersion: '1.0.0',
			bundleHash: 'abc123',
		},
		userInterface: {},
		...overrides,
	}
}

function createValidCatalog(overrides = {}) {
	return {
		catalogVersion: 1,
		lastUpdatedAt: Date.now(),
		applications: [
			{
				...createValidManifest(),
				isVerified: true,
				approvedAt: Date.now(),
			},
		],
		...overrides,
	}
}

describe('PluginToolParameterSchema', () => {
	it('accepts valid tool parameter', () => {
		const result = PluginToolParameterSchema.parse({
			parameterName: 'input',
			parameterType: 'string',
			parameterDescription: 'Test input',
		})
		expect(result.parameterName).toBe('input')
	})

	it('applies default for isRequired (true)', () => {
		const result = PluginToolParameterSchema.parse({
			parameterName: 'input',
			parameterType: 'string',
			parameterDescription: 'Test input',
		})
		expect(result.isRequired).toBe(true)
	})
})

describe('PluginToolDefinitionSchema', () => {
	it('accepts valid tool with parameters', () => {
		const result = PluginToolDefinitionSchema.parse({
			toolName: 'test_tool',
			toolDescription: 'A test tool',
			parameters: [
				{
					parameterName: 'input',
					parameterType: 'string',
					parameterDescription: 'Test input',
					isRequired: true,
				},
			],
		})
		expect(result.toolName).toBe('test_tool')
		expect(result.parameters).toHaveLength(1)
	})
})

describe('PluginAuthConfigSchema', () => {
	it("discriminates correctly for 'none'", () => {
		const result = PluginAuthConfigSchema.parse({ type: 'none' })
		expect(result.type).toBe('none')
	})

	it("discriminates correctly for 'api-key'", () => {
		const result = PluginAuthConfigSchema.parse({ type: 'api-key', keyName: 'MY_KEY' })
		expect(result.type).toBe('api-key')
		if (result.type === 'api-key') {
			expect(result.keyName).toBe('MY_KEY')
		}
	})

	it("discriminates correctly for 'oauth2-pkce'", () => {
		const result = PluginAuthConfigSchema.parse({
			type: 'oauth2-pkce',
			authorizationUrl: 'https://auth.example.com/authorize',
			tokenUrl: 'https://auth.example.com/token',
			scopes: ['read', 'write'],
			clientId: 'client-123',
		})
		expect(result.type).toBe('oauth2-pkce')
	})

	it("rejects 'oauth2-pkce' missing authorizationUrl", () => {
		expect(() =>
			PluginAuthConfigSchema.parse({
				type: 'oauth2-pkce',
				tokenUrl: 'https://auth.example.com/token',
				scopes: ['read'],
				clientId: 'client-123',
			})
		).toThrow()
	})
})

describe('PluginManifestSchema', () => {
	it('accepts a valid manifest with all required fields', () => {
		const result = PluginManifestSchema.parse(createValidManifest())
		expect(result.pluginId).toBe('test-plugin')
		expect(result.pluginName).toBe('Test Plugin')
	})

	it('rejects manifest missing pluginId', () => {
		const { pluginId, ...rest } = createValidManifest()
		expect(() => PluginManifestSchema.parse(rest)).toThrow()
	})

	it('rejects manifest missing pluginName', () => {
		const { pluginName, ...rest } = createValidManifest()
		expect(() => PluginManifestSchema.parse(rest)).toThrow()
	})

	it('rejects manifest missing tools array', () => {
		const { tools, ...rest } = createValidManifest()
		expect(() => PluginManifestSchema.parse(rest)).toThrow()
	})

	it('rejects manifest missing bundle', () => {
		const { bundle, ...rest } = createValidManifest()
		expect(() => PluginManifestSchema.parse(rest)).toThrow()
	})

	it("applies default for authentication ({ type: 'none' })", () => {
		const result = PluginManifestSchema.parse(createValidManifest())
		expect(result.authentication).toEqual({ type: 'none' })
	})

	it('applies defaults for capabilities (all false)', () => {
		const result = PluginManifestSchema.parse(createValidManifest())
		expect(result.capabilities.supportsScreenshot).toBe(false)
		expect(result.capabilities.supportsVerboseState).toBe(false)
		expect(result.capabilities.supportsEventLog).toBe(false)
	})

	it("applies default for bundle.entryFile ('index.html')", () => {
		const result = PluginManifestSchema.parse(createValidManifest())
		expect(result.bundle.entryFile).toBe('index.html')
	})
})

describe('PluginCatalogEntrySchema', () => {
	it('includes isVerified and approvedAt fields', () => {
		const now = Date.now()
		const result = PluginCatalogEntrySchema.parse({
			...createValidManifest(),
			isVerified: true,
			approvedAt: now,
		})
		expect(result.isVerified).toBe(true)
		expect(result.approvedAt).toBe(now)
	})
})

describe('PluginCatalogSchema', () => {
	it('accepts valid catalog with multiple applications', () => {
		const result = PluginCatalogSchema.parse(
			createValidCatalog({
				applications: [
					{ ...createValidManifest({ pluginId: 'a' }), isVerified: true, approvedAt: Date.now() },
					{ ...createValidManifest({ pluginId: 'b' }), isVerified: false, approvedAt: Date.now() },
				],
			})
		)
		expect(result.applications).toHaveLength(2)
	})

	it('rejects catalog missing catalogVersion', () => {
		const { catalogVersion, ...rest } = createValidCatalog()
		expect(() => PluginCatalogSchema.parse(rest)).toThrow()
	})
})
