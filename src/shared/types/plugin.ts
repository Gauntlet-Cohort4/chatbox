import { z } from 'zod'

export const PluginToolParameterSchema = z.object({
	parameterName: z.string(),
	parameterType: z.enum(['string', 'number', 'boolean', 'object']),
	parameterDescription: z.string(),
	isRequired: z.boolean().default(true),
})

export const PluginToolDefinitionSchema = z.object({
	toolName: z.string(),
	toolDescription: z.string(),
	parameters: z.array(PluginToolParameterSchema),
})

export const PluginAuthConfigSchema = z.discriminatedUnion('type', [
	z.object({ type: z.literal('none') }),
	z.object({
		type: z.literal('api-key'),
		keyName: z.string(),
	}),
	z.object({
		type: z.literal('oauth2-pkce'),
		authorizationUrl: z.string().url(),
		tokenUrl: z.string().url(),
		scopes: z.array(z.string()),
		clientId: z.string(),
	}),
])

export const PluginBundleSchema = z.object({
	bundleUrl: z.string().url(),
	bundleVersion: z.string(),
	bundleHash: z.string(),
	entryFile: z.string().default('index.html'),
})

export const PluginUserInterfaceSchema = z.object({
	defaultWidth: z.number().optional(),
	defaultHeight: z.number().optional(),
	sandboxPermissions: z.array(z.string()).default([]),
	isPersistent: z.boolean().default(false),
})

export const PluginCapabilitiesSchema = z.object({
	supportsScreenshot: z.boolean().default(false),
	supportsVerboseState: z.boolean().default(false),
	supportsEventLog: z.boolean().default(false),
})

export const PluginManifestSchema = z.object({
	pluginId: z.string(),
	pluginName: z.string(),
	description: z.string(),
	version: z.string(),
	author: z.string(),
	category: z.enum(['internal', 'external-public', 'external-authenticated']),
	contentRating: z.enum(['safe', 'educational', 'general']),
	tools: z.array(PluginToolDefinitionSchema),
	bundle: PluginBundleSchema,
	userInterface: PluginUserInterfaceSchema,
	authentication: PluginAuthConfigSchema.default({ type: 'none' }),
	contextPrompt: z.string().optional(),
	capabilities: PluginCapabilitiesSchema.default({
		supportsScreenshot: false,
		supportsVerboseState: false,
		supportsEventLog: false,
	}),
})

export const PluginCatalogEntrySchema = PluginManifestSchema.extend({
	isVerified: z.boolean(),
	approvedAt: z.number(),
})

export const PluginCatalogSchema = z.object({
	catalogVersion: z.number(),
	lastUpdatedAt: z.number(),
	applications: z.array(PluginCatalogEntrySchema),
})

// Inferred types
export type PluginToolParameter = z.infer<typeof PluginToolParameterSchema>
export type PluginToolDefinition = z.infer<typeof PluginToolDefinitionSchema>
export type PluginAuthConfig = z.infer<typeof PluginAuthConfigSchema>
export type PluginBundle = z.infer<typeof PluginBundleSchema>
export type PluginUserInterface = z.infer<typeof PluginUserInterfaceSchema>
export type PluginCapabilities = z.infer<typeof PluginCapabilitiesSchema>
export type PluginManifest = z.infer<typeof PluginManifestSchema>
export type PluginCatalogEntry = z.infer<typeof PluginCatalogEntrySchema>
export type PluginCatalog = z.infer<typeof PluginCatalogSchema>
