/**
 * Worker-side Zod schemas for plugin submissions.
 *
 * Mirrors `marketplace/src/types/plugin.ts` but without frontend-only
 * imports so the worker bundle stays lean.
 */
import { z } from 'zod'

const PluginToolParameterSchema = z.object({
  parameterName: z.string(),
  parameterType: z.enum(['string', 'number', 'boolean', 'object']),
  parameterDescription: z.string(),
  isRequired: z.boolean(),
})

const PluginToolDefinitionSchema = z.object({
  toolName: z.string(),
  toolDescription: z.string(),
  parameters: z.array(PluginToolParameterSchema),
})

const PluginCapabilitiesSchema = z.object({
  supportsScreenshot: z.boolean().default(false),
  supportsVerboseState: z.boolean().default(false),
  supportsEventLog: z.boolean().default(false),
})

const PluginUserInterfaceSchema = z.object({
  defaultWidth: z.number().default(400),
  defaultHeight: z.number().default(600),
  sandboxPermissions: z.array(z.string()).default(['allow-scripts']),
  isPersistent: z.boolean().default(false),
})

const PluginAuthConfigSchema = z.discriminatedUnion('authType', [
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

export const PluginSubmissionSchema = z.object({
  pluginName: z.string().min(1).max(80),
  description: z.string().min(1).max(2000),
  version: z.string().min(1),
  author: z.string().min(1),
  authorEmail: z.string().email().optional(),
  category: z.string().min(1),
  contentRating: z.enum(['safe', 'educational', 'general']),
  tools: z.array(PluginToolDefinitionSchema),
  userInterface: PluginUserInterfaceSchema,
  authentication: PluginAuthConfigSchema,
  contextPrompt: z.string().max(1000).optional(),
  capabilities: PluginCapabilitiesSchema,
})

export type PluginSubmission = z.infer<typeof PluginSubmissionSchema>
