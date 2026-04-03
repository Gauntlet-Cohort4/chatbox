import type { Message, MessageContentPart } from '@shared/types'

export function injectScreenshotsIntoUserMessage(
	storageKeys: string[],
	userMessage: Message
): Message {
	const imageParts: MessageContentPart[] = storageKeys.map((storageKey) => ({
		type: 'image' as const,
		storageKey,
	}))

	return {
		...userMessage,
		contentParts: [...userMessage.contentParts, ...imageParts],
	}
}
