/**
 * ChatBridge Marketplace API client.
 *
 * Small fetch wrapper for the three marketplace endpoints the ChatBridge
 * desktop app needs to talk to. Lives here (not in @/packages) because it
 * is owned by the plugin-catalog module.
 */

export interface TeacherRegistration {
	teacherId: string
	teacherName: string
	joinCode: string
	apiToken: string
}

export interface ExchangeCodeResponse {
	code: string
	expiresAt: number
}

export interface MarketplaceCatalogPlugin {
	pluginId: string
	pluginName: string
	description: string
	version: string
	author: string
	category: string
	contentRating: string
	tools: unknown
	userInterface: unknown
	authentication: { authType: 'none' | 'api-key' | 'oauth2-pkce'; [k: string]: unknown }
	contextPrompt: string | null
	capabilities: unknown
	bundle: {
		bundleUrl: string
		bundleVersion: string
		bundleHash: string
		entryFile: string
	}
}

export interface MarketplaceCatalog {
	catalogVersion: string
	joinCode: string
	plugins: MarketplaceCatalogPlugin[]
}

export interface CatalogFetchResult {
	status: 'ok' | 'not-modified' | 'not-found'
	catalog: MarketplaceCatalog | null
	etag: string | null
}

/**
 * Register a new teacher with the marketplace. The returned apiToken must
 * be stored locally — the marketplace does not allow re-retrieval.
 */
export async function registerTeacher(
	apiBaseUrl: string,
	teacherName: string
): Promise<TeacherRegistration> {
	const response = await fetch(`${apiBaseUrl}/teachers/register`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ teacherName }),
	})
	if (!response.ok) {
		throw new Error(`Teacher registration failed: ${response.status} ${response.statusText}`)
	}
	return (await response.json()) as TeacherRegistration
}

/**
 * Generate a one-time exchange code. The returned code is appended as a
 * query param to the marketplace web URL and expires after 60 seconds.
 */
export async function generateExchangeCode(
	apiBaseUrl: string,
	apiToken: string
): Promise<ExchangeCodeResponse> {
	const response = await fetch(`${apiBaseUrl}/auth/exchange-code`, {
		method: 'POST',
		headers: { Authorization: `Bearer ${apiToken}` },
	})
	if (!response.ok) {
		throw new Error(`Exchange code failed: ${response.status} ${response.statusText}`)
	}
	return (await response.json()) as ExchangeCodeResponse
}

/**
 * Fetch the student catalog for a join code. Uses If-None-Match for ETag
 * revalidation so repeated polls are cheap when the catalog is unchanged.
 */
export async function fetchMarketplaceCatalog(
	apiBaseUrl: string,
	joinCode: string,
	previousEtag: string | null
): Promise<CatalogFetchResult> {
	const headers: Record<string, string> = {}
	if (previousEtag) headers['If-None-Match'] = previousEtag

	const response = await fetch(`${apiBaseUrl}/catalog/${encodeURIComponent(joinCode)}`, {
		method: 'GET',
		headers,
	})

	if (response.status === 304) {
		return { status: 'not-modified', catalog: null, etag: previousEtag }
	}
	if (response.status === 404) {
		return { status: 'not-found', catalog: null, etag: null }
	}
	if (!response.ok) {
		throw new Error(`Catalog fetch failed: ${response.status} ${response.statusText}`)
	}

	const catalog = (await response.json()) as MarketplaceCatalog
	const etag = response.headers.get('ETag')
	return { status: 'ok', catalog, etag }
}
