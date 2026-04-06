/**
 * Transforms marketplace catalog plugins into the ChatBridge internal
 * PluginCatalogEntry shape.
 *
 * Key mappings:
 * - `bundleUrl` (R2 relative path) → absolute `{apiBaseUrl}/marketplace/plugins/{id}/bundle`
 * - `authentication.authType` → `authentication.type`
 * - subject category → `external-public` or `external-authenticated`
 */
import type { PluginCatalogEntry } from '@shared/types/plugin'
import type { MarketplaceCatalogPlugin } from './marketplace-client'

function coerceAuthType(
	raw: MarketplaceCatalogPlugin['authentication']
): PluginCatalogEntry['authentication'] {
	switch (raw.authType) {
		case 'none':
			return { type: 'none' }
		case 'api-key':
			return {
				type: 'api-key',
				keyName: typeof raw.keyHeaderName === 'string' ? raw.keyHeaderName : 'X-API-Key',
			}
		case 'oauth2-pkce':
			return {
				type: 'oauth2-pkce',
				authorizationUrl: String(raw.authorizationUrl ?? ''),
				tokenUrl: String(raw.tokenUrl ?? ''),
				scopes: Array.isArray(raw.scopes) ? (raw.scopes as string[]) : [],
				clientId: String(raw.clientId ?? ''),
			}
		default:
			return { type: 'none' }
	}
}

function resolveChatBridgeCategory(
	plugin: MarketplaceCatalogPlugin
): PluginCatalogEntry['category'] {
	return plugin.authentication.authType === 'none' ? 'external-public' : 'external-authenticated'
}

function resolveContentRating(plugin: MarketplaceCatalogPlugin): PluginCatalogEntry['contentRating'] {
	if (plugin.contentRating === 'safe' || plugin.contentRating === 'educational' || plugin.contentRating === 'general') {
		return plugin.contentRating
	}
	return 'general'
}

export function transformMarketplacePlugin(
	apiBaseUrl: string,
	plugin: MarketplaceCatalogPlugin
): PluginCatalogEntry {
	return {
		pluginId: plugin.pluginId,
		pluginName: plugin.pluginName,
		description: plugin.description,
		version: plugin.version,
		author: plugin.author,
		category: resolveChatBridgeCategory(plugin),
		contentRating: resolveContentRating(plugin),
		tools: Array.isArray(plugin.tools) ? (plugin.tools as PluginCatalogEntry['tools']) : [],
		bundle: {
			bundleUrl: `${apiBaseUrl}/marketplace/plugins/${encodeURIComponent(plugin.pluginId)}/bundle`,
			bundleVersion: plugin.bundle.bundleVersion,
			bundleHash: plugin.bundle.bundleHash,
			entryFile: plugin.bundle.entryFile || 'index.html',
		},
		userInterface:
			plugin.userInterface && typeof plugin.userInterface === 'object'
				? (plugin.userInterface as PluginCatalogEntry['userInterface'])
				: { sandboxPermissions: [], isPersistent: false },
		authentication: coerceAuthType(plugin.authentication),
		contextPrompt: plugin.contextPrompt ?? undefined,
		capabilities:
			plugin.capabilities && typeof plugin.capabilities === 'object'
				? (plugin.capabilities as PluginCatalogEntry['capabilities'])
				: { supportsScreenshot: false, supportsVerboseState: false, supportsEventLog: false },
		isVerified: true,
		approvedAt: Date.now(),
	}
}
