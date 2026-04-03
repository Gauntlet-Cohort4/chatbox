import { z } from 'zod'

// Platform → App messages
export const PlatformToAppMessageSchema = z.discriminatedUnion('type', [
	z.object({
		type: z.literal('app:init'),
		sessionId: z.string(),
		config: z.record(z.string(), z.unknown()).default({}),
	}),
	z.object({
		type: z.literal('tool:invoke'),
		callId: z.string(),
		toolName: z.string(),
		args: z.record(z.string(), z.unknown()),
	}),
	z.object({ type: z.literal('state:request') }),
	z.object({
		type: z.literal('auth:token'),
		token: z.string(),
	}),
	z.object({ type: z.literal('screenshot:request') }),
])

// App → Platform messages
export const AppToPlatformMessageSchema = z.discriminatedUnion('type', [
	z.object({ type: z.literal('app:ready') }),
	z.object({
		type: z.literal('tool:result'),
		callId: z.string(),
		result: z.unknown(),
	}),
	z.object({
		type: z.literal('tool:error'),
		callId: z.string(),
		error: z.string(),
	}),
	z.object({
		type: z.literal('state:update'),
		state: z.record(z.string(), z.unknown()),
		description: z.string().optional(),
	}),
	z.object({
		type: z.literal('state:response'),
		state: z.record(z.string(), z.unknown()),
		description: z.string().optional(),
	}),
	z.object({
		type: z.literal('app:complete'),
		summary: z.string(),
	}),
	z.object({
		type: z.literal('ui:resize'),
		width: z.number().optional(),
		height: z.number(),
	}),
	z.object({
		type: z.literal('screenshot:response'),
		imageData: z.string(),
		mimeType: z.string().default('image/png'),
	}),
	z.object({
		type: z.literal('event:log'),
		eventDescription: z.string(),
		eventData: z.record(z.string(), z.unknown()).optional(),
		eventTimestamp: z.number(),
	}),
])

export type PlatformToAppMessage = z.infer<typeof PlatformToAppMessageSchema>
export type AppToPlatformMessage = z.infer<typeof AppToPlatformMessageSchema>
