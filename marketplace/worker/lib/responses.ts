/**
 * Shared JSON response helpers for worker routes.
 */

export function json<T>(data: T, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers)
  headers.set('Content-Type', 'application/json; charset=utf-8')
  return new Response(JSON.stringify(data), { ...init, headers })
}

export function errorJson(status: number, message: string, details?: Record<string, string[]>): Response {
  return json({ error: message, details }, { status })
}

export function notFound(message = 'Not found'): Response {
  return errorJson(404, message)
}

export function badRequest(message: string, details?: Record<string, string[]>): Response {
  return errorJson(400, message, details)
}

export function unauthorized(message = 'Unauthorized'): Response {
  return errorJson(401, message)
}

export function forbidden(message = 'Forbidden'): Response {
  return errorJson(403, message)
}

export function conflict(message = 'Conflict'): Response {
  return errorJson(409, message)
}

export function serverError(message = 'Internal server error'): Response {
  return errorJson(500, message)
}
