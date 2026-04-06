// @vitest-environment node
import { beforeEach, describe, expect, it } from 'vitest'
import workerHandler from '../../worker/index'
import { createExecutionContext, createSessionCookie, createTestHarness, type TestHarness } from './helpers/test-env'

async function fetchJson<T = unknown>(
  harness: TestHarness,
  path: string,
  init: RequestInit = {}
): Promise<{ status: number; body: T }> {
  const headers = new Headers(init.headers)
  if (!headers.has('Origin')) headers.set('Origin', 'http://localhost:5174')
  const request = new Request(`http://test.local${path}`, { ...init, headers })
  const response = await workerHandler.fetch(request, harness.env, createExecutionContext())
  const text = await response.text()
  let body: unknown = null
  try {
    body = text ? JSON.parse(text) : null
  } catch {
    body = text
  }
  return { status: response.status, body: body as T }
}

describe('POST /marketplace/plugins/:pluginId/reports', () => {
  let harness: TestHarness
  beforeEach(async () => { harness = await createTestHarness() })

  it('creates a report and increments totalReports', async () => {
    const cookie = await createSessionCookie(harness, 'teacher_bob')
    const { status, body } = await fetchJson<{ reportId: string; status: string }>(
      harness,
      '/marketplace/plugins/chess/reports',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: cookie },
        body: JSON.stringify({ reportReason: 'Inappropriate content', reportDetails: 'Details here' }),
      }
    )
    expect(status).toBe(201)
    expect(body.reportId).toMatch(/^report_/)

    // Verify totalReports incremented
    const detail = await fetchJson<{ totalReports: number }>(harness, '/marketplace/plugins/chess')
    expect(detail.body.totalReports).toBe(1)
  })

  it('requires authentication', async () => {
    const { status } = await fetchJson(harness, '/marketplace/plugins/chess/reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reportReason: 'Broken' }),
    })
    expect(status).toBe(401)
  })

  it('rejects empty reportReason', async () => {
    const cookie = await createSessionCookie(harness, 'teacher_bob')
    const { status } = await fetchJson(harness, '/marketplace/plugins/chess/reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ reportReason: '' }),
    })
    expect(status).toBe(400)
  })

  it('returns 404 for pending plugin', async () => {
    const cookie = await createSessionCookie(harness, 'teacher_bob')
    const { status } = await fetchJson(harness, '/marketplace/plugins/pending-puzzle/reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ reportReason: 'Broken' }),
    })
    expect(status).toBe(404)
  })
})
