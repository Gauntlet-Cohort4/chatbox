import type { PluginAuthConfig, PluginManifest } from '@shared/types/plugin'
import { pluginStore } from '@/stores/pluginStore'
import platform from '@/platform'
import {
	generateCodeVerifier,
	generateCodeChallenge,
	buildAuthorizationUrl,
	exchangeCodeForToken,
	refreshAccessToken,
} from './pkce'

type OAuth2PkceConfig = Extract<PluginAuthConfig, { type: 'oauth2-pkce' }>

interface TokenResponse {
	accessToken: string
	refreshToken?: string
	expiresAt?: number
}

const OAUTH_TIMEOUT_MS = 120_000
const TOKEN_EXPIRY_BUFFER_MS = 60_000

function getRedirectUri(): string {
	if (platform.type === 'desktop') {
		return 'chatbox://oauth-callback'
	}
	return `${window.location.origin}/oauth-callback`
}

function generateRandomState(): string {
	const randomValues = new Uint8Array(32)
	crypto.getRandomValues(randomValues)
	return Array.from(randomValues)
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('')
}

function waitForDesktopCallback(
	expectedState: string,
	timeoutMs: number,
): Promise<{ code: string; state: string }> {
	return new Promise((resolve, reject) => {
		const timer = setTimeout(() => {
			cleanup()
			reject(new Error('OAuth flow timed out'))
		}, timeoutMs)

		const cleanup = platform.onNavigate
			? platform.onNavigate((path: string) => {
				const url = new URL(path, 'chatbox://localhost')
				const code = url.searchParams.get('code')
				const state = url.searchParams.get('state')
				if (code != null && state === expectedState) {
					clearTimeout(timer)
					resolve({ code, state })
				}
			})
			: () => {
				clearTimeout(timer)
				reject(new Error('Desktop deep link navigation not supported'))
			}
	})
}

function waitForWebPopupCallback(
	popup: Window,
	expectedState: string,
	redirectUri: string,
	timeoutMs: number,
): Promise<{ code: string; state: string }> {
	return new Promise((resolve, reject) => {
		const timer = setTimeout(() => {
			clearInterval(pollInterval)
			popup.close()
			reject(new Error('OAuth flow timed out'))
		}, timeoutMs)

		const pollInterval = setInterval(() => {
			try {
				if (popup.closed) {
					clearInterval(pollInterval)
					clearTimeout(timer)
					reject(new Error('OAuth popup was closed'))
					return
				}
				const popupUrl = popup.location.href
				if (popupUrl.startsWith(redirectUri)) {
					clearInterval(pollInterval)
					clearTimeout(timer)
					const url = new URL(popupUrl)
					const code = url.searchParams.get('code')
					const state = url.searchParams.get('state')
					popup.close()
					if (code != null && state === expectedState) {
						resolve({ code, state })
					} else {
						reject(new Error('Missing code or state mismatch in OAuth callback'))
					}
				}
			} catch {
				// Cross-origin access to popup.location will throw; that's expected while on the provider's page
			}
		}, 500)
	})
}

export async function startOAuthFlow(manifest: PluginManifest): Promise<TokenResponse> {
	const auth = manifest.authentication
	if (auth.type !== 'oauth2-pkce') {
		throw new Error(`Expected oauth2-pkce authentication, got ${auth.type}`)
	}
	const config: OAuth2PkceConfig = auth

	const codeVerifier = generateCodeVerifier()
	const codeChallenge = await generateCodeChallenge(codeVerifier)
	const state = generateRandomState()
	const redirectUri = getRedirectUri()
	const authUrl = buildAuthorizationUrl(config, codeChallenge, state, redirectUri)

	let callbackResult: { code: string; state: string }

	if (platform.type === 'desktop') {
		await platform.openLink(authUrl)
		callbackResult = await waitForDesktopCallback(state, OAUTH_TIMEOUT_MS)
	} else {
		const popup = window.open(authUrl, 'oauth-popup', 'width=600,height=700')
		if (popup == null) {
			throw new Error('Failed to open OAuth popup window')
		}
		callbackResult = await waitForWebPopupCallback(popup, state, redirectUri, OAUTH_TIMEOUT_MS)
	}

	if (callbackResult.state !== state) {
		throw new Error('OAuth state mismatch — possible CSRF attack')
	}

	const tokenResponse = await exchangeCodeForToken(config, callbackResult.code, codeVerifier, redirectUri)

	pluginStore.getState().setPluginToken(manifest.pluginId, {
		accessToken: tokenResponse.accessToken,
		...(tokenResponse.refreshToken != null ? { refreshToken: tokenResponse.refreshToken } : {}),
		...(tokenResponse.expiresAt != null ? { expiresAt: tokenResponse.expiresAt } : {}),
	})

	return tokenResponse
}

export async function ensureValidToken(pluginId: string, manifest: PluginManifest): Promise<string> {
	const stored = pluginStore.getState().pluginTokens[pluginId]

	if (stored == null) {
		throw new Error(`No token stored for plugin ${pluginId}`)
	}

	const now = Date.now()

	// Token has no expiry or is still valid (more than 60s in the future)
	if (stored.expiresAt == null || stored.expiresAt > now + TOKEN_EXPIRY_BUFFER_MS) {
		return stored.accessToken
	}

	// Token is expired — try to refresh
	if (stored.refreshToken == null) {
		throw new Error(`Token expired for plugin ${pluginId} and no refresh token available`)
	}

	const auth = manifest.authentication
	if (auth.type !== 'oauth2-pkce') {
		throw new Error(`Expected oauth2-pkce authentication, got ${auth.type}`)
	}

	const newToken = await refreshAccessToken(auth, stored.refreshToken)

	pluginStore.getState().setPluginToken(pluginId, {
		accessToken: newToken.accessToken,
		...(newToken.refreshToken != null ? { refreshToken: newToken.refreshToken } : {}),
		...(newToken.expiresAt != null ? { expiresAt: newToken.expiresAt } : {}),
	})

	return newToken.accessToken
}
