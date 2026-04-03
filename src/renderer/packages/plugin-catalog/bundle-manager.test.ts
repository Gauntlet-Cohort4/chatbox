import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Mock platform before importing bundle-manager
vi.mock('@/platform', () => ({
	default: {
		type: 'web' as const,
		setStoreBlob: vi.fn().mockResolvedValue(undefined),
		getStoreBlob: vi.fn().mockResolvedValue(null),
		delStoreBlob: vi.fn().mockResolvedValue(undefined),
	},
}))

// Mock pluginStore
const mockPluginStoreState = {
	localBundles: {} as Record<string, { bundleVersion: string; localUrl: string }>,
	setLocalBundle: vi.fn(),
}

vi.mock('@/stores/pluginStore', () => ({
	pluginStore: {
		getState: () => mockPluginStoreState,
	},
}))

// Mock URL.createObjectURL
vi.stubGlobal('URL', {
	...globalThis.URL,
	createObjectURL: vi.fn(() => 'blob:http://localhost/fake-blob-url'),
	revokeObjectURL: vi.fn(),
})

import platform from '@/platform'
import { clearBundle, downloadBundle, ensureBundle, getLocalPluginUrl, isBundleCached } from './bundle-manager'

// Helper to create a mock response with text content
function mockFetchWithContent(content: string) {
	vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
		new Response(content, { status: 200 })
	))
}

// Compute SHA-256 hash the same way the bundle manager does
async function computeHash(content: string): Promise<string> {
	const encoder = new TextEncoder()
	const data = encoder.encode(content)
	const hashBuffer = await crypto.subtle.digest('SHA-256', data)
	const hashArray = Array.from(new Uint8Array(hashBuffer))
	return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

describe('downloadBundle', () => {
	afterEach(() => {
		vi.restoreAllMocks()
	})

	it('fetches bundle and stores it', async () => {
		const content = '<html>plugin</html>'
		const hash = await computeHash(content)
		mockFetchWithContent(content)

		await downloadBundle('chess', 'https://example.com/bundle.zip', hash)
		expect(platform.setStoreBlob).toHaveBeenCalledWith('plugin-bundle:chess', content)
	})

	it('computes SHA-256 hash and compares with expectedHash', async () => {
		const content = '<html>plugin</html>'
		const hash = await computeHash(content)
		mockFetchWithContent(content)

		// Should not throw when hashes match
		await expect(downloadBundle('chess', 'https://example.com/bundle.zip', hash)).resolves.toBeUndefined()
	})

	it('throws on hash mismatch with descriptive error', async () => {
		mockFetchWithContent('<html>plugin</html>')
		await expect(
			downloadBundle('chess', 'https://example.com/bundle.zip', 'wrong-hash')
		).rejects.toThrow(/hash mismatch/i)
	})

	it('throws on fetch failure', async () => {
		vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')))
		await expect(
			downloadBundle('chess', 'https://example.com/bundle.zip', 'somehash')
		).rejects.toThrow('Network error')
	})
})

describe('getLocalPluginUrl', () => {
	afterEach(() => {
		vi.restoreAllMocks()
	})

	it('returns chatbox-plugin:// URL on desktop platform', async () => {
		const origType = platform.type
		;(platform as any).type = 'desktop'
		const url = getLocalPluginUrl('chess', 'index.html')
		expect(url).toBe('chatbox-plugin://chess/index.html')
		;(platform as any).type = origType
	})

	it('returns blob URL on web platform', async () => {
		;(platform as any).type = 'web'
		vi.mocked(platform.getStoreBlob).mockResolvedValue('<html>plugin</html>')
		const url = await getLocalPluginUrl('chess', 'index.html')
		expect(url).toBe('blob:http://localhost/fake-blob-url')
	})
})

describe('isBundleCached', () => {
	it('returns true when localBundles has matching pluginId and bundleVersion', () => {
		mockPluginStoreState.localBundles = { chess: { bundleVersion: '1.0.0', localUrl: 'some-url' } }
		expect(isBundleCached('chess', '1.0.0')).toBe(true)
	})

	it('returns false when bundleVersion differs', () => {
		mockPluginStoreState.localBundles = { chess: { bundleVersion: '1.0.0', localUrl: 'some-url' } }
		expect(isBundleCached('chess', '2.0.0')).toBe(false)
	})

	it('returns false when pluginId not in localBundles', () => {
		mockPluginStoreState.localBundles = {}
		expect(isBundleCached('chess', '1.0.0')).toBe(false)
	})
})

describe('clearBundle', () => {
	it('removes from platform storage and pluginStore', async () => {
		await clearBundle('chess')
		expect(platform.delStoreBlob).toHaveBeenCalledWith('plugin-bundle:chess')
	})
})

describe('ensureBundle', () => {
	afterEach(() => {
		vi.restoreAllMocks()
	})

	it('returns existing URL if bundle is cached with correct version', async () => {
		mockPluginStoreState.localBundles = {
			chess: { bundleVersion: '1.0.0', localUrl: 'chatbox-plugin://chess/index.html' },
		}
		const url = await ensureBundle('chess', {
			bundleUrl: 'https://example.com/bundle.zip',
			bundleVersion: '1.0.0',
			bundleHash: 'abc',
			entryFile: 'index.html',
		})
		expect(url).toBe('chatbox-plugin://chess/index.html')
	})

	it('downloads and stores if bundle is not cached', async () => {
		mockPluginStoreState.localBundles = {}
		const content = '<html>chess</html>'
		const hash = await computeHash(content)
		mockFetchWithContent(content)
		;(platform as any).type = 'desktop'

		const url = await ensureBundle('chess', {
			bundleUrl: 'https://example.com/bundle.zip',
			bundleVersion: '1.0.0',
			bundleHash: hash,
			entryFile: 'index.html',
		})
		expect(url).toBe('chatbox-plugin://chess/index.html')
		expect(mockPluginStoreState.setLocalBundle).toHaveBeenCalled()
	})

	it('downloads and replaces if cached version differs', async () => {
		mockPluginStoreState.localBundles = {
			chess: { bundleVersion: '0.9.0', localUrl: 'old-url' },
		}
		const content = '<html>chess v2</html>'
		const hash = await computeHash(content)
		mockFetchWithContent(content)
		;(platform as any).type = 'desktop'

		const url = await ensureBundle('chess', {
			bundleUrl: 'https://example.com/bundle.zip',
			bundleVersion: '2.0.0',
			bundleHash: hash,
			entryFile: 'index.html',
		})
		expect(url).toBe('chatbox-plugin://chess/index.html')
		expect(mockPluginStoreState.setLocalBundle).toHaveBeenCalled()
	})
})
