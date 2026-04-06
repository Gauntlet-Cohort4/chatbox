// @vitest-environment node
/**
 * End-to-end integration tests covering the critical user journeys
 * described in the masterplan. Each test drives the Worker through a
 * complete flow using the in-memory D1 + R2 adapters.
 */
import { describe, expect, it } from 'vitest'
import workerHandler from '../../worker/index'
import { createExecutionContext, createTestHarness, type TestHarness } from '../worker/helpers/test-env'

const ORIGIN = 'http://localhost:5174'

async function send(
  harness: TestHarness,
  method: string,
  path: string,
  opts: { body?: unknown; cookie?: string; bearer?: string; form?: FormData } = {}
): Promise<{ status: number; body: unknown; headers: Headers }> {
  const headers = new Headers()
  headers.set('Origin', ORIGIN)
  if (opts.cookie) headers.set('Cookie', opts.cookie)
  if (opts.bearer) headers.set('Authorization', `Bearer ${opts.bearer}`)

  let body: BodyInit | undefined
  if (opts.form) {
    body = opts.form
  } else if (opts.body != null) {
    headers.set('Content-Type', 'application/json')
    body = JSON.stringify(opts.body)
  }

  const request = new Request(`http://test.local${path}`, { method, headers, body })
  const response = await workerHandler.fetch(request, harness.env, createExecutionContext())
  const text = await response.text()
  let parsed: unknown = null
  try {
    parsed = text ? JSON.parse(text) : null
  } catch {
    parsed = text
  }
  return { status: response.status, body: parsed, headers: response.headers }
}

function sessionFromSetCookie(headers: Headers): string {
  const setCookie = headers.get('Set-Cookie') ?? ''
  const match = setCookie.match(/session=([^;]+)/)
  return match?.[1] ?? ''
}

function buildSubmissionForm(overrides: Record<string, unknown> = {}): FormData {
  const manifest = {
    pluginName: 'Flow Test Plugin',
    description: 'End-to-end integration test plugin.',
    version: '1.0.0',
    author: 'Integration',
    category: 'Math',
    contentRating: 'educational',
    tools: [],
    userInterface: {
      defaultWidth: 400,
      defaultHeight: 600,
      sandboxPermissions: ['allow-scripts'],
      isPersistent: false,
    },
    authentication: { authType: 'none' },
    capabilities: {
      supportsScreenshot: false,
      supportsVerboseState: false,
      supportsEventLog: false,
    },
    ...overrides,
  }
  const form = new FormData()
  form.set('manifest', JSON.stringify(manifest))
  form.set('bundle', new File([new Uint8Array(512)], 'bundle.zip', { type: 'application/zip' }))
  form.set('screenshot', new File([new Uint8Array(256)], 'shot.png', { type: 'image/png' }))
  return form
}

// ─── Developer submission flow ───────────────────────────────────────────────

describe('developer submission flow', () => {
  it('submit → pending → admin approve → visible in browse', async () => {
    const harness = await createTestHarness({ withSeed: true })

    // 1. Submit a new plugin
    const submit = await send(harness, 'POST', '/marketplace/plugins', {
      form: buildSubmissionForm({ pluginName: 'Integration Math Wiz', category: 'Math' }),
    })
    expect(submit.status).toBe(201)
    const pluginId = (submit.body as { pluginId: string }).pluginId

    // 2. Not visible in public browse (still pending)
    const browseBefore = await send(harness, 'GET', '/marketplace/plugins?limit=100')
    const beforeIds = ((browseBefore.body as { plugins: { pluginId: string }[] }).plugins).map((p) => p.pluginId)
    expect(beforeIds).not.toContain(pluginId)

    // 3. Admin approves
    const approve = await send(harness, 'PUT', `/admin/submissions/${pluginId}/approve`, {
      bearer: 'test-admin-token',
    })
    expect(approve.status).toBe(200)

    // 4. Now visible in browse
    const browseAfter = await send(harness, 'GET', '/marketplace/plugins?limit=100')
    const afterIds = ((browseAfter.body as { plugins: { pluginId: string }[] }).plugins).map((p) => p.pluginId)
    expect(afterIds).toContain(pluginId)

    // 5. Detail endpoint returns full data
    const detail = await send(harness, 'GET', `/marketplace/plugins/${pluginId}`)
    expect(detail.status).toBe(200)
    expect((detail.body as { pluginName: string }).pluginName).toBe('Integration Math Wiz')
  })

  it('admin reject sets rejected status and plugin stays hidden', async () => {
    const harness = await createTestHarness({ withSeed: true })
    const submit = await send(harness, 'POST', '/marketplace/plugins', { form: buildSubmissionForm() })
    const pluginId = (submit.body as { pluginId: string }).pluginId

    const reject = await send(harness, 'PUT', `/admin/submissions/${pluginId}/reject`, {
      bearer: 'test-admin-token',
      body: { rejectionReason: 'Not suitable for K-12' },
    })
    expect(reject.status).toBe(200)

    const browse = await send(harness, 'GET', '/marketplace/plugins?limit=100')
    const ids = ((browse.body as { plugins: { pluginId: string }[] }).plugins).map((p) => p.pluginId)
    expect(ids).not.toContain(pluginId)
  })
})

// ─── Teacher classroom + student polling flow ────────────────────────────────

describe('teacher classroom flow', () => {
  it('register → exchange → add → approve → deploy → student sees plugin', async () => {
    const harness = await createTestHarness({ withSeed: true })

    // 1. Register teacher
    const reg = await send(harness, 'POST', '/teachers/register', {
      body: { teacherName: 'Integration Teacher' },
    })
    expect(reg.status).toBe(201)
    const { teacherId, apiToken, joinCode } = reg.body as {
      teacherId: string
      apiToken: string
      joinCode: string
    }

    // 2. Get exchange code
    const codeRes = await send(harness, 'POST', '/auth/exchange-code', { bearer: apiToken })
    const { code } = codeRes.body as { code: string }

    // 3. Exchange for session
    const exchange = await send(harness, 'POST', '/auth/exchange', { body: { code } })
    expect(exchange.status).toBe(200)
    const session = sessionFromSetCookie(exchange.headers)
    expect(session).toBeTruthy()
    const cookie = `session=${session}`

    // 4. Add chess to classroom
    const add = await send(harness, 'POST', `/teachers/${teacherId}/plugins/chess`, { cookie })
    expect(add.status).toBe(201)

    // 5. Approve
    const approve = await send(harness, 'PUT', `/teachers/${teacherId}/plugins/chess/approve`, { cookie })
    expect(approve.status).toBe(200)

    // 6. Deploy
    const deploy = await send(harness, 'PUT', `/teachers/${teacherId}/plugins/chess/deploy`, { cookie })
    expect(deploy.status).toBe(200)

    // 7. Student polls catalog with the teacher's join code
    const catalog = await send(harness, 'GET', `/catalog/${joinCode}`)
    expect(catalog.status).toBe(200)
    const catalogBody = catalog.body as { plugins: { pluginId: string }[]; joinCode: string }
    expect(catalogBody.joinCode).toBe(joinCode)
    expect(catalogBody.plugins).toHaveLength(1)
    expect(catalogBody.plugins[0].pluginId).toBe('chess')

    // 8. Revoke — catalog should now be empty
    const revoke = await send(harness, 'PUT', `/teachers/${teacherId}/plugins/chess/revoke`, { cookie })
    expect(revoke.status).toBe(200)
    const catalogAfter = await send(harness, 'GET', `/catalog/${joinCode}`)
    expect(((catalogAfter.body as { plugins: unknown[] }).plugins)).toHaveLength(0)
  })

  it('teacher cannot access another teacher\'s plugins', async () => {
    const harness = await createTestHarness({ withSeed: true })
    // Use seed teacher_alice with a pre-made session
    const { createSessionCookie } = await import('../worker/helpers/test-env')
    const aliceCookie = await createSessionCookie(harness, 'teacher_alice')

    // Alice tries to read Bob's plugins
    const response = await send(harness, 'GET', '/teachers/teacher_bob/plugins', { cookie: aliceCookie })
    expect(response.status).toBe(403)
  })
})

// ─── Review and report flow ──────────────────────────────────────────────────

describe('review and report flow', () => {
  it('teacher creates review → aggregate recalculated → updates review', async () => {
    const harness = await createTestHarness({ withSeed: true })
    const { createSessionCookie } = await import('../worker/helpers/test-env')
    const cookie = await createSessionCookie(harness, 'teacher_bob')

    // Bob reviews color-mixer (no existing review)
    const create = await send(harness, 'POST', '/marketplace/plugins/color-mixer/reviews', {
      cookie,
      body: { rating: 5, reviewText: 'Love it' },
    })
    expect(create.status).toBe(201)

    const detail1 = await send(harness, 'GET', '/marketplace/plugins/color-mixer')
    expect((detail1.body as { totalRatings: number }).totalRatings).toBe(1)
    expect((detail1.body as { averageRating: number }).averageRating).toBeCloseTo(5)

    // Bob updates his review
    const update = await send(harness, 'PUT', '/marketplace/plugins/color-mixer/reviews', {
      cookie,
      body: { rating: 3, reviewText: 'Changed mind' },
    })
    expect(update.status).toBe(200)

    const detail2 = await send(harness, 'GET', '/marketplace/plugins/color-mixer')
    expect((detail2.body as { averageRating: number }).averageRating).toBeCloseTo(3)
  })

  it('review → report → admin resolve full lifecycle', async () => {
    const harness = await createTestHarness({ withSeed: true })
    const { createSessionCookie } = await import('../worker/helpers/test-env')
    const cookie = await createSessionCookie(harness, 'teacher_bob')

    // File a report
    const report = await send(harness, 'POST', '/marketplace/plugins/chess/reports', {
      cookie,
      body: { reportReason: 'Broken/non-functional', reportDetails: 'Board freezes' },
    })
    expect(report.status).toBe(201)
    const reportId = (report.body as { reportId: string }).reportId

    // Admin sees it
    const list = await send(harness, 'GET', '/admin/reports?status=open', { bearer: 'test-admin-token' })
    const reportIds = ((list.body as { reports: { reportId: string }[] }).reports).map((r) => r.reportId)
    expect(reportIds).toContain(reportId)

    // Admin resolves
    const resolve = await send(harness, 'PUT', `/admin/reports/${reportId}`, {
      bearer: 'test-admin-token',
      body: { resolution: 'resolved', notes: 'Fixed in v1.1' },
    })
    expect(resolve.status).toBe(200)

    // Report moves to resolved list
    const resolved = await send(harness, 'GET', '/admin/reports?status=resolved', {
      bearer: 'test-admin-token',
    })
    const resolvedIds = ((resolved.body as { reports: { reportId: string }[] }).reports).map((r) => r.reportId)
    expect(resolvedIds).toContain(reportId)
  })
})

// ─── Catalog ETag flow ───────────────────────────────────────────────────────

describe('catalog ETag flow', () => {
  it('304 on unchanged catalog, 200 after deploy adds new plugin', async () => {
    const harness = await createTestHarness({ withSeed: true })
    const { createSessionCookie } = await import('../worker/helpers/test-env')
    const cookie = await createSessionCookie(harness, 'teacher_alice')

    // Seed alice with one deployed plugin
    await send(harness, 'POST', '/teachers/teacher_alice/plugins/chess', { cookie })
    await send(harness, 'PUT', '/teachers/teacher_alice/plugins/chess/approve', { cookie })
    await send(harness, 'PUT', '/teachers/teacher_alice/plugins/chess/deploy', { cookie })

    // First fetch
    const first = await send(harness, 'GET', '/catalog/ALPHA1')
    expect(first.status).toBe(200)
    const etag = first.headers.get('ETag')
    expect(etag).toBeTruthy()

    // Conditional request with matching ETag → 304
    const secondReq = new Request('http://test.local/catalog/ALPHA1', {
      headers: { 'If-None-Match': etag ?? '' },
    })
    const secondRes = await workerHandler.fetch(secondReq, harness.env, createExecutionContext())
    expect(secondRes.status).toBe(304)

    // Deploy another plugin → catalog changes
    await send(harness, 'POST', '/teachers/teacher_alice/plugins/word-weaver', { cookie })
    await send(harness, 'PUT', '/teachers/teacher_alice/plugins/word-weaver/approve', { cookie })
    await send(harness, 'PUT', '/teachers/teacher_alice/plugins/word-weaver/deploy', { cookie })

    const third = await send(harness, 'GET', '/catalog/ALPHA1')
    expect(third.status).toBe(200)
    const newEtag = third.headers.get('ETag')
    expect(newEtag).toBeTruthy()
    expect(newEtag).not.toBe(etag)
  })
})

// ─── Auth edge cases ─────────────────────────────────────────────────────────

describe('auth edge cases', () => {
  it('logout invalidates session so /auth/me returns 401', async () => {
    const harness = await createTestHarness({ withSeed: true })
    const { createSessionCookie } = await import('../worker/helpers/test-env')
    const cookie = await createSessionCookie(harness, 'teacher_alice')

    const meBefore = await send(harness, 'GET', '/auth/me', { cookie })
    expect(meBefore.status).toBe(200)

    const logout = await send(harness, 'POST', '/auth/logout', { cookie })
    expect(logout.status).toBe(200)

    const meAfter = await send(harness, 'GET', '/auth/me', { cookie })
    expect(meAfter.status).toBe(401)
  })
})
