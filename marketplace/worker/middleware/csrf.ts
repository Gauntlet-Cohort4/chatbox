/**
 * CSRF protection via Origin header validation.
 *
 * For state-changing methods (POST/PUT/DELETE), the request's Origin header
 * must match one of the allowed origins. GET/HEAD requests are exempt since
 * they should be idempotent.
 *
 * This is sufficient as the primary defense because session cookies are
 * `SameSite=Lax`, and a malicious cross-origin form would either not send
 * the cookie (for POST) or be blocked by the Origin mismatch.
 */
import { forbidden } from '../lib/responses'

const EXEMPT_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

/**
 * Paths that are exempt from CSRF Origin checks because they are called
 * from the ChatBridge desktop/mobile app (which does not set an Origin
 * header in the way browsers do) or are public student-facing endpoints.
 */
const EXEMPT_PATH_PREFIXES = [
  '/teachers/register', // called from ChatBridge app (Authorization: Bearer apiToken)
  '/auth/exchange-code', // called from ChatBridge app (Authorization: Bearer apiToken)
  '/auth/exchange', // called from marketplace but code is single-use anyway
  '/catalog/', // public student polling endpoint
  '/health',
]

function parseAllowedOrigins(env: { ALLOWED_ORIGINS?: string }): string[] {
  if (!env.ALLOWED_ORIGINS) {
    return [
      'http://localhost:5174',
      'http://localhost:5175',
      'http://localhost:8787',
    ]
  }
  return env.ALLOWED_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean)
}

export function enforceCsrf(
  request: Request,
  env: { ALLOWED_ORIGINS?: string }
): Response | null {
  if (EXEMPT_METHODS.has(request.method.toUpperCase())) return null

  const url = new URL(request.url)
  if (EXEMPT_PATH_PREFIXES.some((prefix) => url.pathname === prefix || url.pathname.startsWith(prefix))) {
    return null
  }

  const origin = request.headers.get('Origin')
  if (!origin) {
    return forbidden('Origin header required for state-changing requests')
  }

  const allowed = parseAllowedOrigins(env)
  if (!allowed.includes(origin)) {
    return forbidden('Origin not allowed')
  }

  return null
}
