import type { PluginBundle } from '@shared/types/plugin'
import platform from '@/platform'
import { pluginStore } from '@/stores/pluginStore'

const BUNDLE_STORAGE_PREFIX = 'plugin-bundle:'

async function computeSha256(content: string): Promise<string> {
	const encoder = new TextEncoder()
	const data = encoder.encode(content)
	const hashBuffer = await crypto.subtle.digest('SHA-256', data)
	const hashArray = Array.from(new Uint8Array(hashBuffer))
	return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

export async function downloadBundle(
	pluginId: string,
	bundleUrl: string,
	expectedHash: string
): Promise<void> {
	const response = await fetch(bundleUrl)
	const content = await response.text()

	const actualHash = await computeSha256(content)
	if (actualHash !== expectedHash) {
		throw new Error(
			`Bundle hash mismatch for plugin "${pluginId}": expected ${expectedHash}, got ${actualHash}`
		)
	}

	await platform.setStoreBlob(`${BUNDLE_STORAGE_PREFIX}${pluginId}`, content)
}

export function getLocalPluginUrl(pluginId: string, entryFile: string): string | Promise<string> {
	if (platform.type === 'desktop') {
		return `chatbox-plugin://${pluginId}/${entryFile}`
	}

	// Web platform: read stored bundle, create blob URL
	return (async () => {
		const content = await platform.getStoreBlob(`${BUNDLE_STORAGE_PREFIX}${pluginId}`)
		if (!content) {
			throw new Error(`No stored bundle found for plugin "${pluginId}"`)
		}
		const blob = new Blob([content], { type: 'text/html' })
		return URL.createObjectURL(blob)
	})()
}

export function isBundleCached(pluginId: string, bundleVersion: string): boolean {
	const { localBundles } = pluginStore.getState()
	const cached = localBundles[pluginId]
	return cached !== undefined && cached.bundleVersion === bundleVersion
}

export async function clearBundle(pluginId: string): Promise<void> {
	await platform.delStoreBlob(`${BUNDLE_STORAGE_PREFIX}${pluginId}`)
}

export async function ensureBundle(pluginId: string, bundle: PluginBundle): Promise<string> {
	if (isBundleCached(pluginId, bundle.bundleVersion)) {
		return pluginStore.getState().localBundles[pluginId].localUrl
	}

	await downloadBundle(pluginId, bundle.bundleUrl, bundle.bundleHash)
	const localUrl = await getLocalPluginUrl(pluginId, bundle.entryFile)
	pluginStore.getState().setLocalBundle(pluginId, bundle.bundleVersion, localUrl)
	return localUrl
}
