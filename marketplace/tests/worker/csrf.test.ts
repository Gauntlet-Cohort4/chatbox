// @vitest-environment node
import { describe, expect, it } from 'vitest'
import workerHandler from '../../worker/index'
import { createExecutionContext, createSessionCookie, createTestHarness } from './helpers/test-env'

describe('CSRF middleware', () => {
  it('rejects state-changing requests without Origin header (403)', async () => {
    const harness = await createTestHarness()
    const cookie = await createSessionCookie(harness, 'teacher_alice')
    const request = new Request('http://test.local/marketplace/plugins/chess/reviews', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ rating: 5 }),
    })
    const response = await workerHandler.fetch(request, harness.env, createExecutionContext())
    expect(response.status).toBe(403)
  })

  it('rejects state-changing requests from unexpected origin (403)', async () => {
    const harness = await createTestHarness()
    const cookie = await createSessionCookie(harness, 'teacher_alice')
    const request = new Request('http://test.local/marketplace/plugins/chess/reviews', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'http://evil.example',
        Cookie: cookie,
      },
      body: JSON.stringify({ rating: 5 }),
    })
    const response = await workerHandler.fetch(request, harness.env, createExecutionContext())
    expect(response.status).toBe(403)
  })

  it('accepts state-changing requests from allowed origin', async () => {
    const harness = await createTestHarness()
    const cookie = await createSessionCookie(harness, 'teacher_bob')
    const request = new Request('http://test.local/marketplace/plugins/color-mixer/reviews', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'http://localhost:5174',
        Cookie: cookie,
      },
      body: JSON.stringify({ rating: 4, reviewText: 'ok' }),
    })
    const response = await workerHandler.fetch(request, harness.env, createExecutionContext())
    expect(response.status).toBe(201)
  })

  it('exempts GET requests from Origin check', async () => {
    const harness = await createTestHarness()
    const request = new Request('http://test.local/marketplace/plugins')
    const response = await workerHandler.fetch(request, harness.env, createExecutionContext())
    expect(response.status).toBe(200)
  })

  it('exempts /teachers/register from Origin check (called from ChatBridge app)', async () => {
    const harness = await createTestHarness()
    const request = new Request('http://test.local/teachers/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ teacherName: 'No Origin Teacher' }),
    })
    const response = await workerHandler.fetch(request, harness.env, createExecutionContext())
    expect(response.status).toBe(201)
  })

  it('exempts /auth/exchange-code from Origin check', async () => {
    const harness = await createTestHarness()
    // Register first to get a token
    const regReq = new Request('http://test.local/teachers/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ teacherName: 'Exchange Teacher' }),
    })
    const regRes = await workerHandler.fetch(regReq, harness.env, createExecutionContext())
    const { apiToken } = (await regRes.json()) as { apiToken: string }

    const request = new Request('http://test.local/auth/exchange-code', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiToken}` },
    })
    const response = await workerHandler.fetch(request, harness.env, createExecutionContext())
    expect(response.status).toBe(200)
  })
})
