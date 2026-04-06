/**
 * CORS middleware.
 *
 * Allows credentials (session cookies). Origins are validated against the
 * ALLOWED_ORIGINS env-derived list. When the env var is unset (dev), we echo
 * the request origin back — safe locally but tightened per deployment.
 */

const DEFAULT_ALLOWED = ['http://localhost:5174', 'http://localhost:5175', 'http://localhost:8787']

function parseAllowedOrigins(env: { ALLOWED_ORIGINS?: string }): string[] {
  if (!env.ALLOWED_ORIGINS) return DEFAULT_ALLOWED
  return env.ALLOWED_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean)
}

function resolveOrigin(request: Request, env: { ALLOWED_ORIGINS?: string }): string | null {
  const requestOrigin = request.headers.get('Origin')
  if (!requestOrigin) return null
  const allowed = parseAllowedOrigins(env)
  return allowed.includes(requestOrigin) ? requestOrigin : null
}

export function buildCorsHeaders(
  request: Request,
  env: { ALLOWED_ORIGINS?: string }
): Record<string, string> {
  const origin = resolveOrigin(request, env)
  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, If-None-Match',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  }
  if (origin) {
    headers['Access-Control-Allow-Origin'] = origin
    headers['Access-Control-Allow-Credentials'] = 'true'
  }
  return headers
}

export function handlePreflight(request: Request, env: { ALLOWED_ORIGINS?: string }): Response | null {
  if (request.method !== 'OPTIONS') return null
  return new Response(null, { status: 204, headers: buildCorsHeaders(request, env) })
}

export function withCors(response: Response, request: Request, env: { ALLOWED_ORIGINS?: string }): Response {
  const corsHeaders = buildCorsHeaders(request, env)
  const headers = new Headers(response.headers)
  for (const [key, value] of Object.entries(corsHeaders)) {
    headers.set(key, value)
  }
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers })
}
