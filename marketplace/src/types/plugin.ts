/**
 * Plugin types for the marketplace.
 *
 * Re-exports the subset of the ChatBridge PluginManifest schema needed
 * by the marketplace frontend and worker. The canonical Zod schemas live
 * in the main app at `src/shared/types/plugin.ts`; we duplicate the
 * minimal interface here so the marketplace package stays self-contained.
 */
import { z } from 'zod'

export const PluginToolParameterSchema = z.object({
  parameterName: z.string(),
  parameterType: z.enum(['string', 'number', 'boolean', 'object']),
  parameterDescription: z.string(),
  isRequired: z.boolean(),
})

export const PluginToolDefinitionSchema = z.object({
  toolName: z.string(),
  toolDescription: z.string(),
  parameters: z.array(PluginToolParameterSchema),
})

export const PluginCapabilitiesSchema = z.object({
  supportsScreenshot: z.boolean().default(false),
  supportsVerboseState: z.boolean().default(false),
  supportsEventLog: z.boolean().default(false),
})

export const PluginUserInterfaceSchema = z.object({
  defaultWidth: z.number().default(400),
  defaultHeight: z.number().default(600),
  sandboxPermissions: z.array(z.string()).default(['allow-scripts']),
  isPersistent: z.boolean().default(false),
})

export const PluginAuthConfigSchema = z.discriminatedUnion('authType', [
  z.object({ authType: z.literal('none') }),
  z.object({
    authType: z.literal('api-key'),
    keyHeaderName: z.string(),
    instructions: z.string().optional(),
  }),
  z.object({
    authType: z.literal('oauth2-pkce'),
    authorizationUrl: z.string().url(),
    tokenUrl: z.string().url(),
    scopes: z.array(z.string()),
    clientId: z.string(),
  }),
])

export const PluginBundleSchema = z.object({
  bundleUrl: z.string(),
  bundleVersion: z.string(),
  bundleHash: z.string(),
  entryFile: z.string().default('index.html'),
})

export const PluginManifestSchema = z.object({
  pluginId: z.string(),
  pluginName: z.string().min(1).max(80),
  description: z.string().min(1).max(2000),
  version: z.string(),
  author: z.string().min(1),
  authorEmail: z.string().email().optional(),
  category: z.string(),
  contentRating: z.enum(['safe', 'educational', 'general']),
  tools: z.array(PluginToolDefinitionSchema),
  userInterface: PluginUserInterfaceSchema,
  authentication: PluginAuthConfigSchema,
  contextPrompt: z.string().max(1000).optional(),
  capabilities: PluginCapabilitiesSchema,
  bundle: PluginBundleSchema,
})

/** Submission input — pluginId and bundle details generated server-side */
export const PluginSubmissionSchema = z.object({
  pluginName: z.string().min(1).max(80),
  description: z.string().min(1).max(2000),
  version: z.string(),
  author: z.string().min(1),
  authorEmail: z.string().email().optional(),
  category: z.string(),
  contentRating: z.enum(['safe', 'educational', 'general']),
  tools: z.array(PluginToolDefinitionSchema),
  userInterface: PluginUserInterfaceSchema,
  authentication: PluginAuthConfigSchema,
  contextPrompt: z.string().max(1000).optional(),
  capabilities: PluginCapabilitiesSchema,
})

export type PluginManifest = z.infer<typeof PluginManifestSchema>
export type PluginSubmission = z.infer<typeof PluginSubmissionSchema>
export type PluginToolDefinition = z.infer<typeof PluginToolDefinitionSchema>
export type PluginToolParameter = z.infer<typeof PluginToolParameterSchema>
export type PluginCapabilities = z.infer<typeof PluginCapabilitiesSchema>
export type PluginUserInterface = z.infer<typeof PluginUserInterfaceSchema>
export type PluginAuthConfig = z.infer<typeof PluginAuthConfigSchema>
export type PluginBundle = z.infer<typeof PluginBundleSchema>
