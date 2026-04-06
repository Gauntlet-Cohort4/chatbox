/**
 * Auth middleware.
 *
 * `requireAdmin` validates `Authorization: Bearer {ADMIN_TOKEN}` against the
 * worker's admin token.
 *
 * `requireTeacher` reads the `session` cookie, looks it up in D1, and returns
 * the teacher row on success. Used by routes that should only be accessible
 * to an authenticated teacher.
 */
import { authQueries, teacherQueries, type TeacherRow } from '../db/queries'
import { unauthorized } from '../lib/responses'
import type { Env } from '../types'

export interface AdminAuthResult {
  ok: true
}

export interface TeacherAuthResult {
  ok: true
  teacher: TeacherRow
}

export type AuthFailure = { ok: false; response: Response }

export function requireAdmin(request: Request, env: Env): AdminAuthResult | AuthFailure {
  const header = request.headers.get('Authorization')
  if (!header || !header.startsWith('Bearer ')) {
    return { ok: false, response: unauthorized('Missing admin token') }
  }
  const token = header.slice('Bearer '.length).trim()
  if (!env.ADMIN_TOKEN || token !== env.ADMIN_TOKEN) {
    return { ok: false, response: unauthorized('Invalid admin token') }
  }
  return { ok: true }
}

export function parseCookie(header: string | null, name: string): string | null {
  if (!header) return null
  const parts = header.split(';')
  for (const part of parts) {
    const [k, ...rest] = part.split('=')
    if (k.trim() === name) return rest.join('=').trim()
  }
  return null
}

export async function requireTeacher(
  request: Request,
  env: Env
): Promise<TeacherAuthResult | AuthFailure> {
  const cookieHeader = request.headers.get('Cookie')
  const sessionId = parseCookie(cookieHeader, 'session')
  if (!sessionId) {
    return { ok: false, response: unauthorized('Missing session') }
  }
  const session = await authQueries.getSession(env.DB, sessionId)
  if (!session) {
    return { ok: false, response: unauthorized('Invalid session') }
  }
  if (session.expiresAt < Date.now()) {
    return { ok: false, response: unauthorized('Session expired') }
  }
  const teacher = await teacherQueries.getById(env.DB, session.teacherId)
  if (!teacher) {
    return { ok: false, response: unauthorized('Teacher not found') }
  }
  return { ok: true, teacher }
}
