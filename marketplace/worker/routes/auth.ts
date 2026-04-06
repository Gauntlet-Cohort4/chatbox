/**
 * Auth flow routes.
 *
 * - POST /auth/exchange-code   (apiToken → one-time code, 60s TTL)
 * - POST /auth/exchange        (code → session cookie)
 * - GET  /auth/me              (session cookie → teacher info)
 * - POST /auth/logout          (session cookie → clear)
 */
import { z } from 'zod'
import { authQueries, teacherQueries } from '../db/queries'
import { badRequest, json, unauthorized } from '../lib/responses'
import { randomToken } from '../lib/crypto'
import { parseCookie, requireTeacher } from '../middleware/auth'
import type { Env } from '../types'

const EXCHANGE_CODE_TTL_MS = 60_000
const SESSION_TTL_MS = 8 * 60 * 60 * 1000

// POST /auth/exchange-code
export async function generateExchangeCode(request: Request, env: Env): Promise<Response> {
  const header = request.headers.get('Authorization')
  if (!header || !header.startsWith('Bearer ')) {
    return unauthorized('Missing apiToken')
  }
  const apiToken = header.slice('Bearer '.length).trim()
  const teacher = await teacherQueries.getByToken(env.DB, apiToken)
  if (!teacher) return unauthorized('Invalid apiToken')

  const code = randomToken(16)
  const expiresAt = Date.now() + EXCHANGE_CODE_TTL_MS
  await authQueries.createCode(env.DB, code, teacher.teacherId, expiresAt)

  return json({ code, expiresAt })
}

// POST /auth/exchange
const ExchangeBodySchema = z.object({ code: z.string().min(1) })

export async function exchangeCode(request: Request, env: Env): Promise<Response> {
  const bodyJson = await readJson(request)
  if (bodyJson == null) return badRequest('Body must be JSON')
  const parsed = ExchangeBodySchema.safeParse(bodyJson)
  if (!parsed.success) return badRequest('code is required')

  const row = await authQueries.consumeCode(env.DB, parsed.data.code)
  if (!row) return unauthorized('Invalid or unknown code')
  if (row.used === 1) return unauthorized('Code already used')
  if (row.expiresAt < Date.now()) {
    // Clean up expired code best-effort
    await authQueries.deleteExpiredCodes(env.DB).catch(() => {})
    return unauthorized('Code expired')
  }

  const sessionId = randomToken(32)
  const sessionExpiresAt = Date.now() + SESSION_TTL_MS
  await authQueries.createSession(env.DB, sessionId, row.teacherId, sessionExpiresAt)

  const cookie = buildSessionCookie(sessionId, SESSION_TTL_MS)
  return json(
    { status: 'ok', expiresAt: sessionExpiresAt },
    { headers: { 'Set-Cookie': cookie } }
  )
}

// GET /auth/me
export async function getMe(request: Request, env: Env): Promise<Response> {
  const auth = await requireTeacher(request, env)
  if (!auth.ok) return auth.response
  return json({ teacherId: auth.teacher.teacherId, teacherName: auth.teacher.teacherName })
}

// POST /auth/logout
export async function logout(request: Request, env: Env): Promise<Response> {
  const sessionId = parseCookie(request.headers.get('Cookie'), 'session')
  if (sessionId) {
    await authQueries.deleteSession(env.DB, sessionId)
  }
  const clearCookie = 'session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0'
  return json({ status: 'ok' }, { headers: { 'Set-Cookie': clearCookie } })
}

function buildSessionCookie(sessionId: string, maxAgeMs: number): string {
  const maxAge = Math.floor(maxAgeMs / 1000)
  return `session=${sessionId}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${maxAge}`
}

async function readJson(request: Request): Promise<unknown | null> {
  try {
    return await request.json()
  } catch {
    return null
  }
}
