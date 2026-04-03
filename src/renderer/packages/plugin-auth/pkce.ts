import type { PluginAuthConfig } from '@shared/types/plugin'

type OAuth2PkceConfig = Extract<PluginAuthConfig, { type: 'oauth2-pkce' }>

interface TokenResponse {
	accessToken: string
	refreshToken?: string
	expiresAt?: number
}

const URL_SAFE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~'
const VERIFIER_LENGTH = 64

export function generateCodeVerifier(): string {
	const randomValues = new Uint8Array(VERIFIER_LENGTH)
	crypto.getRandomValues(randomValues)
	return Array.from(randomValues)
		.map((byte) => URL_SAFE_CHARS[byte % URL_SAFE_CHARS.length])
		.join('')
}

export async function generateCodeChallenge(verifier: string): Promise<string> {
	const encoder = new TextEncoder()
	const data = encoder.encode(verifier)
	const digest = await crypto.subtle.digest('SHA-256', data)
	const base64 = btoa(String.fromCharCode(...new Uint8Array(digest)))
	return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function buildAuthorizationUrl(
	config: OAuth2PkceConfig,
	codeChallenge: string,
	state: string,
	redirectUri: string,
): string {
	const url = new URL(config.authorizationUrl)
	url.searchParams.set('response_type', 'code')
	url.searchParams.set('client_id', config.clientId)
	url.searchParams.set('redirect_uri', redirectUri)
	url.searchParams.set('scope', config.scopes.join(' '))
	url.searchParams.set('code_challenge', codeChallenge)
	url.searchParams.set('code_challenge_method', 'S256')
	url.searchParams.set('state', state)
	return url.toString()
}

function parseTokenResponse(json: Record<string, unknown>): TokenResponse {
	const result: TokenResponse = {
		accessToken: json.access_token as string,
	}
	if (typeof json.refresh_token === 'string') {
		result.refreshToken = json.refresh_token
	}
	if (typeof json.expires_in === 'number') {
		result.expiresAt = Date.now() + json.expires_in * 1000
	}
	return result
}

export async function exchangeCodeForToken(
	config: OAuth2PkceConfig,
	code: string,
	codeVerifier: string,
	redirectUri: string,
): Promise<TokenResponse> {
	const body = new URLSearchParams({
		grant_type: 'authorization_code',
		code,
		code_verifier: codeVerifier,
		redirect_uri: redirectUri,
		client_id: config.clientId,
	}).toString()

	const response = await fetch(config.tokenUrl, {
		method: 'POST',
		headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
		body,
	})

	if (!response.ok) {
		throw new Error(`Token exchange failed: ${response.status} ${response.statusText}`)
	}

	const json = (await response.json()) as Record<string, unknown>
	return parseTokenResponse(json)
}

export async function refreshAccessToken(
	config: OAuth2PkceConfig,
	refreshToken: string,
): Promise<TokenResponse> {
	const body = new URLSearchParams({
		grant_type: 'refresh_token',
		refresh_token: refreshToken,
		client_id: config.clientId,
	}).toString()

	const response = await fetch(config.tokenUrl, {
		method: 'POST',
		headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
		body,
	})

	if (!response.ok) {
		throw new Error(`Token refresh failed: ${response.status} ${response.statusText}`)
	}

	const json = (await response.json()) as Record<string, unknown>
	return parseTokenResponse(json)
}
