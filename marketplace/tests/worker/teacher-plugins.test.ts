// @vitest-environment node
import { beforeEach, describe, expect, it } from 'vitest'
import workerHandler from '../../worker/index'
import { createExecutionContext, createSessionCookie, createTestHarness, type TestHarness } from './helpers/test-env'

async function fetchJson<T = unknown>(
  harness: TestHarness,
  path: string,
  init: RequestInit = {}
): Promise<{ status: number; body: T }> {
  const request = new Request(`http://test.local${path}`, init)
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

describe('teacher plugin lifecycle', () => {
  let harness: TestHarness
  let cookie: string

  beforeEach(async () => {
    harness = await createTestHarness()
    cookie = await createSessionCookie(harness, 'teacher_alice')
  })

  describe('GET /teachers/:teacherId/plugins', () => {
    it('returns empty list for new teacher', async () => {
      const { status, body } = await fetchJson<{ plugins: unknown[]; joinCode: string }>(
        harness,
        '/teachers/teacher_alice/plugins',
        { headers: { Cookie: cookie } }
      )
      expect(status).toBe(200)
      expect(body.plugins).toEqual([])
      expect(body.joinCode).toBe('ALPHA1')
    })

    it('requires authentication', async () => {
      const { status } = await fetchJson(harness, '/teachers/teacher_alice/plugins')
      expect(status).toBe(401)
    })

    it('forbids accessing another teacher\'s plugins', async () => {
      const { status } = await fetchJson(harness, '/teachers/teacher_bob/plugins', {
        headers: { Cookie: cookie },
      })
      expect(status).toBe(403)
    })
  })

  describe('POST /teachers/:teacherId/plugins/:pluginId (add)', () => {
    it('adds a plugin with pending_review status', async () => {
      const { status, body } = await fetchJson<{ status: string }>(
        harness,
        '/teachers/teacher_alice/plugins/chess',
        { method: 'POST', headers: { Cookie: cookie } }
      )
      expect(status).toBe(201)
      expect(body.status).toBe('pending_review')
    })

    it('rejects adding a pending (unapproved) plugin', async () => {
      const { status } = await fetchJson(harness, '/teachers/teacher_alice/plugins/pending-puzzle', {
        method: 'POST',
        headers: { Cookie: cookie },
      })
      expect(status).toBe(404)
    })

    it('rejects duplicate add (409)', async () => {
      await fetchJson(harness, '/teachers/teacher_alice/plugins/chess', {
        method: 'POST',
        headers: { Cookie: cookie },
      })
      const { status } = await fetchJson(harness, '/teachers/teacher_alice/plugins/chess', {
        method: 'POST',
        headers: { Cookie: cookie },
      })
      expect(status).toBe(409)
    })
  })

  describe('state transitions', () => {
    async function addPlugin(pluginId: string): Promise<void> {
      await fetchJson(harness, `/teachers/teacher_alice/plugins/${pluginId}`, {
        method: 'POST',
        headers: { Cookie: cookie },
      })
    }

    it('pending_review → approved', async () => {
      await addPlugin('chess')
      const { status, body } = await fetchJson<{ status: string }>(
        harness,
        '/teachers/teacher_alice/plugins/chess/approve',
        { method: 'PUT', headers: { Cookie: cookie } }
      )
      expect(status).toBe(200)
      expect(body.status).toBe('approved')
    })

    it('rejects pending_review → deployed (must go through approved)', async () => {
      await addPlugin('chess')
      const { status } = await fetchJson(harness, '/teachers/teacher_alice/plugins/chess/deploy', {
        method: 'PUT',
        headers: { Cookie: cookie },
      })
      expect(status).toBe(400)
    })

    it('approved → deployed triggers catalog regeneration', async () => {
      await addPlugin('chess')
      await fetchJson(harness, '/teachers/teacher_alice/plugins/chess/approve', {
        method: 'PUT',
        headers: { Cookie: cookie },
      })
      const { status } = await fetchJson(harness, '/teachers/teacher_alice/plugins/chess/deploy', {
        method: 'PUT',
        headers: { Cookie: cookie },
      })
      expect(status).toBe(200)

      // Catalog should now exist in R2
      const catalogObj = await harness.env.BUCKET.get('catalogs/ALPHA1/catalog.json')
      expect(catalogObj).not.toBeNull()
      const text = await catalogObj?.text()
      const catalog = JSON.parse(text ?? '{}')
      expect(catalog.plugins).toHaveLength(1)
      expect(catalog.plugins[0].pluginId).toBe('chess')
      expect(catalog.joinCode).toBe('ALPHA1')
    })

    it('deployed → revoked removes plugin from catalog', async () => {
      await addPlugin('chess')
      await fetchJson(harness, '/teachers/teacher_alice/plugins/chess/approve', { method: 'PUT', headers: { Cookie: cookie } })
      await fetchJson(harness, '/teachers/teacher_alice/plugins/chess/deploy', { method: 'PUT', headers: { Cookie: cookie } })
      const { status } = await fetchJson(harness, '/teachers/teacher_alice/plugins/chess/revoke', {
        method: 'PUT',
        headers: { Cookie: cookie },
      })
      expect(status).toBe(200)

      const catalogObj = await harness.env.BUCKET.get('catalogs/ALPHA1/catalog.json')
      const catalog = JSON.parse((await catalogObj?.text()) ?? '{}')
      expect(catalog.plugins).toHaveLength(0)
    })

    it('revoked → deployed (re-deploy allowed)', async () => {
      await addPlugin('chess')
      await fetchJson(harness, '/teachers/teacher_alice/plugins/chess/approve', { method: 'PUT', headers: { Cookie: cookie } })
      await fetchJson(harness, '/teachers/teacher_alice/plugins/chess/deploy', { method: 'PUT', headers: { Cookie: cookie } })
      await fetchJson(harness, '/teachers/teacher_alice/plugins/chess/revoke', { method: 'PUT', headers: { Cookie: cookie } })
      const { status } = await fetchJson(harness, '/teachers/teacher_alice/plugins/chess/deploy', {
        method: 'PUT',
        headers: { Cookie: cookie },
      })
      expect(status).toBe(200)

      const catalogObj = await harness.env.BUCKET.get('catalogs/ALPHA1/catalog.json')
      const catalog = JSON.parse((await catalogObj?.text()) ?? '{}')
      expect(catalog.plugins).toHaveLength(1)
    })

    it('approved → revoked is rejected (must be deployed first)', async () => {
      await addPlugin('chess')
      await fetchJson(harness, '/teachers/teacher_alice/plugins/chess/approve', { method: 'PUT', headers: { Cookie: cookie } })
      const { status } = await fetchJson(harness, '/teachers/teacher_alice/plugins/chess/revoke', {
        method: 'PUT',
        headers: { Cookie: cookie },
      })
      expect(status).toBe(400)
    })
  })

  describe('DELETE /teachers/:teacherId/plugins/:pluginId', () => {
    it('removes a plugin from classroom', async () => {
      await fetchJson(harness, '/teachers/teacher_alice/plugins/chess', { method: 'POST', headers: { Cookie: cookie } })
      const { status } = await fetchJson(harness, '/teachers/teacher_alice/plugins/chess', {
        method: 'DELETE',
        headers: { Cookie: cookie },
      })
      expect(status).toBe(200)

      const list = await fetchJson<{ plugins: unknown[] }>(harness, '/teachers/teacher_alice/plugins', {
        headers: { Cookie: cookie },
      })
      expect(list.body.plugins).toHaveLength(0)
    })

    it('delete of deployed plugin regenerates catalog', async () => {
      await fetchJson(harness, '/teachers/teacher_alice/plugins/chess', { method: 'POST', headers: { Cookie: cookie } })
      await fetchJson(harness, '/teachers/teacher_alice/plugins/chess/approve', { method: 'PUT', headers: { Cookie: cookie } })
      await fetchJson(harness, '/teachers/teacher_alice/plugins/chess/deploy', { method: 'PUT', headers: { Cookie: cookie } })

      await fetchJson(harness, '/teachers/teacher_alice/plugins/chess', {
        method: 'DELETE',
        headers: { Cookie: cookie },
      })

      const catalogObj = await harness.env.BUCKET.get('catalogs/ALPHA1/catalog.json')
      const catalog = JSON.parse((await catalogObj?.text()) ?? '{}')
      expect(catalog.plugins).toHaveLength(0)
    })

    it('returns 404 for plugin not in classroom', async () => {
      const { status } = await fetchJson(harness, '/teachers/teacher_alice/plugins/chess', {
        method: 'DELETE',
        headers: { Cookie: cookie },
      })
      expect(status).toBe(404)
    })
  })
})

describe('GET /catalog/:joinCode', () => {
  it('returns 404 for unknown join code', async () => {
    const harness = await createTestHarness()
    const request = new Request('http://test.local/catalog/NOPE99')
    const response = await workerHandler.fetch(request, harness.env, createExecutionContext())
    expect(response.status).toBe(404)
  })

  it('returns catalog JSON with ETag', async () => {
    const harness = await createTestHarness()
    const cookie = await createSessionCookie(harness, 'teacher_alice')
    await fetchJson(harness, '/teachers/teacher_alice/plugins/chess', { method: 'POST', headers: { Cookie: cookie } })
    await fetchJson(harness, '/teachers/teacher_alice/plugins/chess/approve', { method: 'PUT', headers: { Cookie: cookie } })
    await fetchJson(harness, '/teachers/teacher_alice/plugins/chess/deploy', { method: 'PUT', headers: { Cookie: cookie } })

    const request = new Request('http://test.local/catalog/ALPHA1')
    const response = await workerHandler.fetch(request, harness.env, createExecutionContext())
    expect(response.status).toBe(200)
    expect(response.headers.get('ETag')).toBeTruthy()
    expect(response.headers.get('Cache-Control')).toContain('max-age=30')
    const body = JSON.parse(await response.text())
    expect(body.plugins).toHaveLength(1)
    expect(body.plugins[0].pluginId).toBe('chess')
  })

  it('returns 304 for matching If-None-Match', async () => {
    const harness = await createTestHarness()
    const cookie = await createSessionCookie(harness, 'teacher_alice')
    await fetchJson(harness, '/teachers/teacher_alice/plugins/chess', { method: 'POST', headers: { Cookie: cookie } })
    await fetchJson(harness, '/teachers/teacher_alice/plugins/chess/approve', { method: 'PUT', headers: { Cookie: cookie } })
    await fetchJson(harness, '/teachers/teacher_alice/plugins/chess/deploy', { method: 'PUT', headers: { Cookie: cookie } })

    const first = await workerHandler.fetch(new Request('http://test.local/catalog/ALPHA1'), harness.env, createExecutionContext())
    const etag = first.headers.get('ETag')
    expect(etag).toBeTruthy()

    const second = await workerHandler.fetch(
      new Request('http://test.local/catalog/ALPHA1', { headers: { 'If-None-Match': etag ?? '' } }),
      harness.env,
      createExecutionContext()
    )
    expect(second.status).toBe(304)
  })
})
