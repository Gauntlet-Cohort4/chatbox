// @vitest-environment node
import { describe, expect, it } from 'vitest'
import workerHandler from '../../worker/index'
import { authQueries } from '../../worker/db/queries'
import { createExecutionContext, createTestHarness } from './helpers/test-env'

function doFetch(
  harness: Awaited<ReturnType<typeof createTestHarness>>,
  path: string,
  init: RequestInit = {}
): Promise<Response> {
  return Promise.resolve(
    workerHandler.fetch(new Request(`http://test.local${path}`, init), harness.env, createExecutionContext())
  )
}

async function bodyJson<T>(response: Response): Promise<T> {
  const text = await response.text()
  return (text ? JSON.parse(text) : null) as T
}

describe('POST /teachers/register', () => {
  it('creates a teacher with unique join code and apiToken', async () => {
    const harness = await createTestHarness()
    const response = await doFetch(harness, '/teachers/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ teacherName: 'Ms. New' }),
    })
    expect(response.status).toBe(201)
    const body = await bodyJson<{ teacherId: string; joinCode: string; apiToken: string }>(response)
    expect(body.teacherId).toMatch(/^teacher_/)
    expect(body.joinCode).toHaveLength(6)
    expect(body.apiToken).toMatch(/^[0-9a-f]{64}$/)
  })

  it('generates unique join codes across many registrations', async () => {
    const harness = await createTestHarness({ withSeed: false })
    const codes = new Set<string>()
    for (let i = 0; i < 50; i++) {
      const res = await doFetch(harness, '/teachers/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teacherName: `Teacher ${i}` }),
      })
      expect(res.status).toBe(201)
      const body = await bodyJson<{ joinCode: string }>(res)
      codes.add(body.joinCode)
    }
    expect(codes.size).toBe(50)
  })

  it('rejects empty teacherName', async () => {
    const harness = await createTestHarness()
    const response = await doFetch(harness, '/teachers/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ teacherName: '' }),
    })
    expect(response.status).toBe(400)
  })
})

describe('POST /auth/exchange-code', () => {
  it('returns 401 without apiToken', async () => {
    const harness = await createTestHarness()
    const response = await doFetch(harness, '/auth/exchange-code', { method: 'POST' })
    expect(response.status).toBe(401)
  })

  it('returns 401 with unknown apiToken', async () => {
    const harness = await createTestHarness()
    const response = await doFetch(harness, '/auth/exchange-code', {
      method: 'POST',
      headers: { Authorization: 'Bearer unknown-token' },
    })
    expect(response.status).toBe(401)
  })

  it('creates a one-time code with 60s TTL for valid apiToken', async () => {
    const harness = await createTestHarness({ withSeed: false })
    // Register a teacher
    const reg = await doFetch(harness, '/teachers/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ teacherName: 'Alice' }),
    })
    const { apiToken, teacherId } = await bodyJson<{ apiToken: string; teacherId: string }>(reg)

    const response = await doFetch(harness, '/auth/exchange-code', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiToken}` },
    })
    expect(response.status).toBe(200)
    const body = await bodyJson<{ code: string; expiresAt: number }>(response)
    expect(body.code).toMatch(/^[0-9a-f]{32}$/)
    expect(body.expiresAt - Date.now()).toBeGreaterThan(50_000)
    expect(body.expiresAt - Date.now()).toBeLessThanOrEqual(60_000)

    // Code is stored with correct teacherId
    const row = await harness.env.DB.prepare('SELECT * FROM exchange_codes WHERE code = ?').bind(body.code).first<{ teacherId: string }>()
    expect(row?.teacherId).toBe(teacherId)
  })
})

describe('POST /auth/exchange', () => {
  it('returns 401 for unknown code', async () => {
    const harness = await createTestHarness()
    const response = await doFetch(harness, '/auth/exchange', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: 'does-not-exist' }),
    })
    expect(response.status).toBe(401)
  })

  it('returns 401 for expired code', async () => {
    const harness = await createTestHarness()
    await authQueries.createCode(harness.env.DB, 'expired-code', 'teacher_alice', 1)
    const response = await doFetch(harness, '/auth/exchange', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: 'expired-code' }),
    })
    expect(response.status).toBe(401)
  })

  it('exchanges valid code for session cookie and creates session row', async () => {
    const harness = await createTestHarness()
    await authQueries.createCode(harness.env.DB, 'valid-code', 'teacher_alice', Date.now() + 60_000)

    const response = await doFetch(harness, '/auth/exchange', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: 'valid-code' }),
    })
    expect(response.status).toBe(200)
    const setCookie = response.headers.get('Set-Cookie')
    expect(setCookie).toBeTruthy()
    expect(setCookie).toMatch(/session=/)
    expect(setCookie).toMatch(/HttpOnly/)
    expect(setCookie).toMatch(/Secure/)
    expect(setCookie).toMatch(/SameSite=Lax/)
  })

  it('rejects reused code', async () => {
    const harness = await createTestHarness()
    await authQueries.createCode(harness.env.DB, 'reuse-code', 'teacher_alice', Date.now() + 60_000)

    const first = await doFetch(harness, '/auth/exchange', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: 'reuse-code' }),
    })
    expect(first.status).toBe(200)

    const second = await doFetch(harness, '/auth/exchange', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: 'reuse-code' }),
    })
    expect(second.status).toBe(401)
  })
})

describe('GET /auth/me', () => {
  it('returns 401 without session', async () => {
    const harness = await createTestHarness()
    const response = await doFetch(harness, '/auth/me')
    expect(response.status).toBe(401)
  })

  it('returns teacher info with valid session', async () => {
    const harness = await createTestHarness()
    // Create a valid session
    await authQueries.createSession(harness.env.DB, 'valid-session', 'teacher_alice', Date.now() + 60_000)
    const response = await doFetch(harness, '/auth/me', {
      headers: { Cookie: 'session=valid-session' },
    })
    expect(response.status).toBe(200)
    const body = await bodyJson<{ teacherId: string; teacherName: string }>(response)
    expect(body.teacherId).toBe('teacher_alice')
    expect(body.teacherName).toBe('Ms. Alice Rivera')
  })

  it('returns 401 for expired session', async () => {
    const harness = await createTestHarness()
    await authQueries.createSession(harness.env.DB, 'expired-session', 'teacher_alice', 1)
    const response = await doFetch(harness, '/auth/me', {
      headers: { Cookie: 'session=expired-session' },
    })
    expect(response.status).toBe(401)
  })
})

describe('POST /auth/logout', () => {
  it('clears the session cookie and deletes the session row', async () => {
    const harness = await createTestHarness()
    await authQueries.createSession(harness.env.DB, 'logout-session', 'teacher_alice', Date.now() + 60_000)

    const response = await doFetch(harness, '/auth/logout', {
      method: 'POST',
      headers: { Cookie: 'session=logout-session' },
    })
    expect(response.status).toBe(200)
    const setCookie = response.headers.get('Set-Cookie')
    expect(setCookie).toMatch(/session=;/)
    expect(setCookie).toMatch(/Max-Age=0/)

    // Session row should be gone
    const remaining = await authQueries.getSession(harness.env.DB, 'logout-session')
    expect(remaining).toBeNull()
  })

  it('returns 200 even without a session cookie', async () => {
    const harness = await createTestHarness()
    const response = await doFetch(harness, '/auth/logout', { method: 'POST' })
    expect(response.status).toBe(200)
  })
})

describe('full auth round-trip', () => {
  it('register → exchange-code → exchange → /auth/me → logout', async () => {
    const harness = await createTestHarness({ withSeed: false })

    // 1. Register
    const reg = await doFetch(harness, '/teachers/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ teacherName: 'RoundTrip Teacher' }),
    })
    const { apiToken, teacherId } = await bodyJson<{ apiToken: string; teacherId: string }>(reg)

    // 2. Generate exchange code
    const codeRes = await doFetch(harness, '/auth/exchange-code', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiToken}` },
    })
    const { code } = await bodyJson<{ code: string }>(codeRes)

    // 3. Exchange code for session
    const exchangeRes = await doFetch(harness, '/auth/exchange', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    })
    const setCookie = exchangeRes.headers.get('Set-Cookie') ?? ''
    const sessionMatch = setCookie.match(/session=([^;]+)/)
    expect(sessionMatch).not.toBeNull()
    const sessionValue = sessionMatch?.[1] ?? ''

    // 4. /auth/me with the session
    const meRes = await doFetch(harness, '/auth/me', {
      headers: { Cookie: `session=${sessionValue}` },
    })
    expect(meRes.status).toBe(200)
    const me = await bodyJson<{ teacherId: string; teacherName: string }>(meRes)
    expect(me.teacherId).toBe(teacherId)
    expect(me.teacherName).toBe('RoundTrip Teacher')

    // 5. Logout
    const logoutRes = await doFetch(harness, '/auth/logout', {
      method: 'POST',
      headers: { Cookie: `session=${sessionValue}` },
    })
    expect(logoutRes.status).toBe(200)

    // 6. /auth/me after logout should be 401
    const afterLogout = await doFetch(harness, '/auth/me', {
      headers: { Cookie: `session=${sessionValue}` },
    })
    expect(afterLogout.status).toBe(401)
  })
})

describe('scheduled cleanup', () => {
  it('deletes expired sessions and codes', async () => {
    const harness = await createTestHarness()
    await authQueries.createSession(harness.env.DB, 'expired-s', 'teacher_alice', 1)
    await authQueries.createSession(harness.env.DB, 'valid-s', 'teacher_alice', Date.now() + 60_000)
    await authQueries.createCode(harness.env.DB, 'expired-c', 'teacher_alice', 1)
    await authQueries.createCode(harness.env.DB, 'valid-c', 'teacher_alice', Date.now() + 60_000)

    // Call the scheduled handler directly
    const scheduledHandler = workerHandler.scheduled
    if (!scheduledHandler) throw new Error('scheduled handler not exported')
    await scheduledHandler({} as ScheduledController, harness.env, createExecutionContext())

    expect(await authQueries.getSession(harness.env.DB, 'expired-s')).toBeNull()
    expect(await authQueries.getSession(harness.env.DB, 'valid-s')).not.toBeNull()
    const expiredCode = await harness.env.DB.prepare('SELECT * FROM exchange_codes WHERE code = ?').bind('expired-c').first()
    const validCode = await harness.env.DB.prepare('SELECT * FROM exchange_codes WHERE code = ?').bind('valid-c').first()
    expect(expiredCode).toBeNull()
    expect(validCode).not.toBeNull()
  })
})
