import { describe, expect, it } from 'vitest'
import { AppToPlatformMessageSchema, PlatformToAppMessageSchema } from './plugin-protocol'

describe('PlatformToAppMessageSchema', () => {
	it('accepts app:init message', () => {
		const result = PlatformToAppMessageSchema.parse({
			type: 'app:init',
			sessionId: 'session-1',
		})
		expect(result.type).toBe('app:init')
	})

	it('accepts tool:invoke message', () => {
		const result = PlatformToAppMessageSchema.parse({
			type: 'tool:invoke',
			callId: 'call-1',
			toolName: 'test_tool',
			args: { input: 'hello' },
		})
		expect(result.type).toBe('tool:invoke')
	})

	it('accepts state:request message', () => {
		const result = PlatformToAppMessageSchema.parse({ type: 'state:request' })
		expect(result.type).toBe('state:request')
	})

	it('accepts auth:token message', () => {
		const result = PlatformToAppMessageSchema.parse({
			type: 'auth:token',
			token: 'abc123',
		})
		expect(result.type).toBe('auth:token')
	})

	it('accepts screenshot:request message', () => {
		const result = PlatformToAppMessageSchema.parse({ type: 'screenshot:request' })
		expect(result.type).toBe('screenshot:request')
	})

	it('rejects message with unknown type', () => {
		expect(() =>
			PlatformToAppMessageSchema.parse({ type: 'unknown:message' })
		).toThrow()
	})
})

describe('AppToPlatformMessageSchema', () => {
	it('accepts app:ready message', () => {
		const result = AppToPlatformMessageSchema.parse({ type: 'app:ready' })
		expect(result.type).toBe('app:ready')
	})

	it('accepts tool:result message', () => {
		const result = AppToPlatformMessageSchema.parse({
			type: 'tool:result',
			callId: 'call-1',
			result: { data: 'test' },
		})
		expect(result.type).toBe('tool:result')
	})

	it('accepts tool:error message', () => {
		const result = AppToPlatformMessageSchema.parse({
			type: 'tool:error',
			callId: 'call-1',
			error: 'Something went wrong',
		})
		expect(result.type).toBe('tool:error')
	})

	it('accepts state:update message with description', () => {
		const result = AppToPlatformMessageSchema.parse({
			type: 'state:update',
			state: { score: 10 },
			description: 'Score updated',
		})
		expect(result.type).toBe('state:update')
		if (result.type === 'state:update') {
			expect(result.description).toBe('Score updated')
		}
	})

	it('accepts state:update message without description', () => {
		const result = AppToPlatformMessageSchema.parse({
			type: 'state:update',
			state: { score: 10 },
		})
		expect(result.type).toBe('state:update')
	})

	it('accepts state:response message', () => {
		const result = AppToPlatformMessageSchema.parse({
			type: 'state:response',
			state: { fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR' },
			description: 'Initial position',
		})
		expect(result.type).toBe('state:response')
	})

	it('accepts app:complete message', () => {
		const result = AppToPlatformMessageSchema.parse({
			type: 'app:complete',
			summary: 'Game over!',
		})
		expect(result.type).toBe('app:complete')
	})

	it('accepts ui:resize message', () => {
		const result = AppToPlatformMessageSchema.parse({
			type: 'ui:resize',
			height: 600,
		})
		expect(result.type).toBe('ui:resize')
	})

	it('accepts screenshot:response message', () => {
		const result = AppToPlatformMessageSchema.parse({
			type: 'screenshot:response',
			imageData: 'base64data...',
		})
		expect(result.type).toBe('screenshot:response')
	})

	it('accepts event:log message with eventData', () => {
		const result = AppToPlatformMessageSchema.parse({
			type: 'event:log',
			eventDescription: 'Piece captured',
			eventData: { piece: 'knight' },
			eventTimestamp: Date.now(),
		})
		expect(result.type).toBe('event:log')
	})

	it('accepts event:log message without eventData', () => {
		const result = AppToPlatformMessageSchema.parse({
			type: 'event:log',
			eventDescription: 'Game started',
			eventTimestamp: Date.now(),
		})
		expect(result.type).toBe('event:log')
	})

	it('rejects message with unknown type', () => {
		expect(() =>
			AppToPlatformMessageSchema.parse({ type: 'unknown:message' })
		).toThrow()
	})
})
