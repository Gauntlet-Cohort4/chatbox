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

interface ReviewListShape {
  reviews: { reviewId: string; teacherName: string; rating: number; reviewText: string | null; createdAt: number }[]
  total: number
}

interface ReviewCreateShape {
  reviewId: string
  status: string
}

describe('GET /marketplace/plugins/:pluginId/reviews', () => {
  let harness: TestHarness
  beforeEach(async () => { harness = await createTestHarness() })

  it('returns reviews with teacher name', async () => {
    const { status, body } = await fetchJson<ReviewListShape>(harness, '/marketplace/plugins/chess/reviews')
    expect(status).toBe(200)
    expect(body.total).toBe(2)
    expect(body.reviews[0].teacherName).toBeTruthy()
  })

  it('returns empty list for plugin with no reviews', async () => {
    const { body } = await fetchJson<ReviewListShape>(harness, '/marketplace/plugins/color-mixer/reviews')
    expect(body.total).toBe(0)
    expect(body.reviews).toEqual([])
  })
})

describe('POST /marketplace/plugins/:pluginId/reviews', () => {
  let harness: TestHarness
  beforeEach(async () => { harness = await createTestHarness() })

  it('returns 401 without session', async () => {
    const { status } = await fetchJson(harness, '/marketplace/plugins/color-mixer/reviews', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rating: 5 }),
    })
    expect(status).toBe(401)
  })

  it('creates a review and updates aggregate rating', async () => {
    const cookie = await createSessionCookie(harness, 'teacher_bob')
    const { status, body } = await fetchJson<ReviewCreateShape>(
      harness,
      '/marketplace/plugins/color-mixer/reviews',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: cookie },
        body: JSON.stringify({ rating: 5, reviewText: 'Excellent!' }),
      }
    )
    expect(status).toBe(201)
    expect(body.reviewId).toMatch(/^review_/)

    // Check aggregate updated
    const detail = await fetchJson<{ averageRating: number; totalRatings: number }>(
      harness,
      '/marketplace/plugins/color-mixer'
    )
    expect(detail.body.totalRatings).toBe(1)
    expect(detail.body.averageRating).toBeCloseTo(5)
  })

  it('rejects rating out of range', async () => {
    const cookie = await createSessionCookie(harness, 'teacher_bob')
    const { status } = await fetchJson(harness, '/marketplace/plugins/color-mixer/reviews', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ rating: 6 }),
    })
    expect(status).toBe(400)
  })

  it('rejects rating below 1', async () => {
    const cookie = await createSessionCookie(harness, 'teacher_bob')
    const { status } = await fetchJson(harness, '/marketplace/plugins/color-mixer/reviews', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ rating: 0 }),
    })
    expect(status).toBe(400)
  })

  it('returns 409 for duplicate review by same teacher', async () => {
    const cookie = await createSessionCookie(harness, 'teacher_alice')
    // Alice already reviewed chess in the seed
    const { status } = await fetchJson(harness, '/marketplace/plugins/chess/reviews', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ rating: 3 }),
    })
    expect(status).toBe(409)
  })

  it('returns 404 for non-existent plugin', async () => {
    const cookie = await createSessionCookie(harness, 'teacher_bob')
    const { status } = await fetchJson(harness, '/marketplace/plugins/nonexistent/reviews', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ rating: 5 }),
    })
    expect(status).toBe(404)
  })

  it('returns 401 for expired session', async () => {
    const cookie = await createSessionCookie(harness, 'teacher_bob', { expiresAt: 1 })
    const { status } = await fetchJson(harness, '/marketplace/plugins/color-mixer/reviews', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ rating: 5 }),
    })
    expect(status).toBe(401)
  })
})

describe('PUT /marketplace/plugins/:pluginId/reviews', () => {
  it('updates an existing review and recalculates aggregate', async () => {
    const harness = await createTestHarness()
    const cookie = await createSessionCookie(harness, 'teacher_alice')
    // Alice has review_1 on chess with rating 5; update to 3
    const { status } = await fetchJson(harness, '/marketplace/plugins/chess/reviews', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ rating: 3, reviewText: 'Downgraded' }),
    })
    expect(status).toBe(200)

    // Recompute: now ratings are 3, 4 → avg 3.5
    const detail = await fetchJson<{ averageRating: number }>(harness, '/marketplace/plugins/chess')
    expect(detail.body.averageRating).toBeCloseTo(3.5)
  })

  it('returns 404 when no review exists for this teacher', async () => {
    const harness = await createTestHarness()
    const cookie = await createSessionCookie(harness, 'teacher_bob')
    const { status } = await fetchJson(harness, '/marketplace/plugins/color-mixer/reviews', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ rating: 4 }),
    })
    expect(status).toBe(404)
  })
})
