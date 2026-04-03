import { describe, expect, it } from 'vitest'
import { injectScreenshotsIntoUserMessage } from './screenshot-injector'
import type { Message } from '@shared/types'

function createTestMessage(overrides: Partial<Message> = {}): Message {
	return {
		id: 'msg-1',
		role: 'user',
		contentParts: [{ type: 'text', text: 'What is happening on the board?' }],
		...overrides,
	} as Message
}

describe('injectScreenshotsIntoUserMessage', () => {
	it('returns a new message object (does not mutate original)', () => {
		const original = createTestMessage()
		const result = injectScreenshotsIntoUserMessage(['key1'], original)
		expect(result).not.toBe(original)
		expect(original.contentParts).toHaveLength(1) // unchanged
	})

	it('appends MessageImagePart entries with correct storageKeys', () => {
		const msg = createTestMessage()
		const result = injectScreenshotsIntoUserMessage(['key1', 'key2'], msg)
		const imageParts = result.contentParts.filter((p) => p.type === 'image')
		expect(imageParts).toHaveLength(2)
		expect((imageParts[0] as any).storageKey).toBe('key1')
		expect((imageParts[1] as any).storageKey).toBe('key2')
	})

	it('preserves existing contentParts in the message', () => {
		const msg = createTestMessage()
		const result = injectScreenshotsIntoUserMessage(['key1'], msg)
		expect(result.contentParts[0]).toEqual({ type: 'text', text: 'What is happening on the board?' })
	})

	it('handles empty storageKeys array (returns clone with no changes)', () => {
		const msg = createTestMessage()
		const result = injectScreenshotsIntoUserMessage([], msg)
		expect(result.contentParts).toHaveLength(1)
		expect(result).not.toBe(msg)
	})

	it('handles message with no existing contentParts', () => {
		const msg = createTestMessage({ contentParts: [] })
		const result = injectScreenshotsIntoUserMessage(['key1'], msg)
		expect(result.contentParts).toHaveLength(1)
		expect(result.contentParts[0].type).toBe('image')
	})

	it('appends multiple image parts for multiple storageKeys', () => {
		const msg = createTestMessage()
		const result = injectScreenshotsIntoUserMessage(['a', 'b', 'c'], msg)
		expect(result.contentParts).toHaveLength(4) // 1 text + 3 images
	})
})
