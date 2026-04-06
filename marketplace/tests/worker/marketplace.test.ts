// @vitest-environment node
import { beforeEach, describe, expect, it } from 'vitest'
import workerHandler from '../../worker/index'
import { createExecutionContext, createTestHarness, type TestHarness } from './helpers/test-env'

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue }

async function fetchJson<T = JsonValue>(
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

interface PluginListItemShape {
  pluginId: string
  pluginName: string
  category: string
}
interface PluginListResponseShape {
  plugins: PluginListItemShape[]
  total: number
  page: number
  limit: number
}
interface SubmissionResponseShape {
  pluginId: string
  status: string
}
interface ErrorResponseShape {
  error: string
  details?: Record<string, string[]>
}
interface CategoryResponseShape {
  categories: { name: string; count: number }[]
}

function validSubmission(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    pluginName: 'New Plugin',
    description: 'A brand new plugin.',
    version: '1.0.0',
    author: 'Tester',
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
}

function makeFormData(submission: Record<string, unknown>, opts: { bundleBytes?: number; includeScreenshot?: boolean; screenshotBytes?: number } = {}): FormData {
  const bundleSize = opts.bundleBytes ?? 1024
  const bundle = new File([new Uint8Array(bundleSize)], 'bundle.zip', { type: 'application/zip' })
  const form = new FormData()
  form.set('manifest', JSON.stringify(submission))
  form.set('bundle', bundle)
  if (opts.includeScreenshot !== false) {
    const screenshotSize = opts.screenshotBytes ?? 2048
    const screenshot = new File([new Uint8Array(screenshotSize)], 'screenshot.png', { type: 'image/png' })
    form.set('screenshot', screenshot)
  }
  return form
}

// ─── CORS ────────────────────────────────────────────────────────────────────

describe('CORS', () => {
  it('preflight OPTIONS returns 204 with allow-origin for known origin', async () => {
    const harness = await createTestHarness()
    const request = new Request('http://test.local/marketplace/plugins', {
      method: 'OPTIONS',
      headers: { Origin: 'http://localhost:5174' },
    })
    const response = await workerHandler.fetch(request, harness.env, createExecutionContext())
    expect(response.status).toBe(204)
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:5174')
    expect(response.headers.get('Access-Control-Allow-Credentials')).toBe('true')
  })

  it('omits allow-origin for unknown origin', async () => {
    const harness = await createTestHarness()
    const request = new Request('http://test.local/marketplace/plugins', {
      method: 'OPTIONS',
      headers: { Origin: 'http://evil.example' },
    })
    const response = await workerHandler.fetch(request, harness.env, createExecutionContext())
    expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull()
  })
})

// ─── GET /marketplace/plugins ────────────────────────────────────────────────

describe('GET /marketplace/plugins', () => {
  let harness: TestHarness
  beforeEach(async () => { harness = await createTestHarness() })

  it('returns only approved plugins', async () => {
    const { status, body } = await fetchJson<PluginListResponseShape>(harness, '/marketplace/plugins?limit=100')
    expect(status).toBe(200)
    expect(body.total).toBe(8)
    expect(body.plugins.every((p) => p.pluginId !== 'pending-puzzle')).toBe(true)
  })

  it('filters by category', async () => {
    const { body } = await fetchJson<PluginListResponseShape>(harness, '/marketplace/plugins?category=Math&limit=100')
    expect(body.plugins.length).toBe(2)
    expect(body.plugins.every((p) => p.category === 'Math')).toBe(true)
  })

  it('filters by case-insensitive search', async () => {
    const { body } = await fetchJson<PluginListResponseShape>(harness, '/marketplace/plugins?search=CHESS')
    expect(body.plugins.length).toBe(1)
    expect(body.plugins[0].pluginId).toBe('chess')
  })

  it('sorts by newest', async () => {
    const { body } = await fetchJson<PluginListResponseShape>(harness, '/marketplace/plugins?sort=newest&limit=100')
    expect(body.plugins[0].pluginId).toBe('code-sandbox')
  })

  it('sorts by name A-Z', async () => {
    const { body } = await fetchJson<PluginListResponseShape>(harness, '/marketplace/plugins?sort=name&limit=100')
    const names = body.plugins.map((p) => p.pluginName)
    const sorted = [...names].sort((a, b) => a.localeCompare(b))
    expect(names).toEqual(sorted)
  })

  it('paginates', async () => {
    const page1 = await fetchJson<PluginListResponseShape>(harness, '/marketplace/plugins?page=1&limit=3')
    const page2 = await fetchJson<PluginListResponseShape>(harness, '/marketplace/plugins?page=2&limit=3')
    expect(page1.body.plugins.length).toBe(3)
    expect(page2.body.plugins.length).toBe(3)
    expect(page1.body.total).toBe(8)
    expect(page1.body.plugins[0].pluginId).not.toBe(page2.body.plugins[0].pluginId)
  })

  it('caps limit at 100', async () => {
    const { body } = await fetchJson<PluginListResponseShape>(harness, '/marketplace/plugins?limit=9999')
    expect(body.limit).toBe(100)
  })
})

// ─── GET /marketplace/plugins/:pluginId ──────────────────────────────────────

describe('GET /marketplace/plugins/:pluginId', () => {
  it('returns full plugin details for approved plugin', async () => {
    const harness = await createTestHarness()
    const { status, body } = await fetchJson<{ pluginName: string; toolDefinitions: string }>(
      harness,
      '/marketplace/plugins/chess'
    )
    expect(status).toBe(200)
    expect(body.pluginName).toBe('Chess Tutor')
    expect(body.toolDefinitions).toBeDefined()
  })

  it('returns 404 for pending plugin', async () => {
    const harness = await createTestHarness()
    const { status } = await fetchJson(harness, '/marketplace/plugins/pending-puzzle')
    expect(status).toBe(404)
  })

  it('returns 404 for non-existent plugin', async () => {
    const harness = await createTestHarness()
    const { status } = await fetchJson(harness, '/marketplace/plugins/nonexistent')
    expect(status).toBe(404)
  })
})

// ─── GET /marketplace/plugins/:pluginId/image ────────────────────────────────

describe('GET /marketplace/plugins/:pluginId/image', () => {
  it('serves screenshot from R2 with correct content type', async () => {
    const harness = await createTestHarness()
    // Seed pluginId 'chess' has screenshotKey 'screenshots/chess/screenshot.png'
    await harness.env.BUCKET.put('screenshots/chess/screenshot.png', new Uint8Array([1, 2, 3]), {
      httpMetadata: { contentType: 'image/png' },
    })
    const request = new Request('http://test.local/marketplace/plugins/chess/image')
    const response = await workerHandler.fetch(request, harness.env, createExecutionContext())
    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toBe('image/png')
    expect(response.headers.get('Cache-Control')).toContain('max-age=86400')
  })

  it('returns 404 when screenshot asset is missing from R2', async () => {
    const harness = await createTestHarness()
    const { status } = await fetchJson(harness, '/marketplace/plugins/chess/image')
    expect(status).toBe(404)
  })

  it('returns 404 for pending plugin', async () => {
    const harness = await createTestHarness()
    const { status } = await fetchJson(harness, '/marketplace/plugins/pending-puzzle/image')
    expect(status).toBe(404)
  })
})

// ─── POST /marketplace/plugins ───────────────────────────────────────────────

describe('POST /marketplace/plugins', () => {
  it('accepts valid submission and stores assets in R2', async () => {
    const harness = await createTestHarness()
    const form = makeFormData(validSubmission())
    const { status, body } = await fetchJson<SubmissionResponseShape>(harness, '/marketplace/plugins', {
      method: 'POST',
      body: form,
    })
    expect(status).toBe(201)
    expect(body.status).toBe('pending')
    expect(body.pluginId).toMatch(/^plugin_/)
    // Bundle stored in R2
    const bundleKey = `bundles/${body.pluginId}/1.0.0/bundle.zip`
    const bundleObj = await harness.env.BUCKET.get(bundleKey)
    expect(bundleObj).not.toBeNull()
    // Screenshot stored
    const shotObj = await harness.env.BUCKET.get(`screenshots/${body.pluginId}/screenshot.png`)
    expect(shotObj).not.toBeNull()
  })

  it('rejects missing manifest field', async () => {
    const harness = await createTestHarness()
    const form = new FormData()
    form.set('bundle', new File([new Uint8Array(10)], 'bundle.zip', { type: 'application/zip' }))
    const { status, body } = await fetchJson<ErrorResponseShape>(harness, '/marketplace/plugins', {
      method: 'POST',
      body: form,
    })
    expect(status).toBe(400)
    expect(body.error).toMatch(/manifest/)
  })

  it('rejects invalid manifest JSON', async () => {
    const harness = await createTestHarness()
    const form = makeFormData(validSubmission({ pluginName: '' }))
    const { status, body } = await fetchJson<ErrorResponseShape>(harness, '/marketplace/plugins', {
      method: 'POST',
      body: form,
    })
    expect(status).toBe(400)
    expect(body.details).toBeDefined()
    expect(body.details?.pluginName).toBeDefined()
  })

  it('rejects oversized bundle (>5MB)', async () => {
    const harness = await createTestHarness()
    const form = makeFormData(validSubmission(), { bundleBytes: 6 * 1024 * 1024 })
    const { status, body } = await fetchJson<ErrorResponseShape>(harness, '/marketplace/plugins', {
      method: 'POST',
      body: form,
    })
    expect(status).toBe(400)
    expect(body.error).toMatch(/bundle/i)
  })

  it('rejects oversized screenshot (>2MB)', async () => {
    const harness = await createTestHarness()
    const form = makeFormData(validSubmission(), { screenshotBytes: 3 * 1024 * 1024 })
    const { status, body } = await fetchJson<ErrorResponseShape>(harness, '/marketplace/plugins', {
      method: 'POST',
      body: form,
    })
    expect(status).toBe(400)
    expect(body.error).toMatch(/screenshot/i)
  })

  it('accepts submission without screenshot (optional)', async () => {
    const harness = await createTestHarness()
    const form = makeFormData(validSubmission(), { includeScreenshot: false })
    const { status, body } = await fetchJson<SubmissionResponseShape>(harness, '/marketplace/plugins', {
      method: 'POST',
      body: form,
    })
    expect(status).toBe(201)
    expect(body.pluginId).toMatch(/^plugin_/)
  })

  it('inserted plugin is not returned by GET /marketplace/plugins (pending)', async () => {
    const harness = await createTestHarness()
    const form = makeFormData(validSubmission())
    const submit = await fetchJson<SubmissionResponseShape>(harness, '/marketplace/plugins', { method: 'POST', body: form })
    const list = await fetchJson<PluginListResponseShape>(harness, '/marketplace/plugins?limit=100')
    expect(list.body.plugins.some((p) => p.pluginId === submit.body.pluginId)).toBe(false)
  })

  it('rejects non-multipart Content-Type', async () => {
    const harness = await createTestHarness()
    const { status } = await fetchJson(harness, '/marketplace/plugins', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    expect(status).toBe(400)
  })
})

// ─── GET /marketplace/categories ─────────────────────────────────────────────

describe('GET /marketplace/categories', () => {
  it('returns category counts for approved plugins only', async () => {
    const harness = await createTestHarness()
    const { status, body } = await fetchJson<CategoryResponseShape>(harness, '/marketplace/categories')
    expect(status).toBe(200)
    const map = Object.fromEntries(body.categories.map((c) => [c.name, c.count]))
    expect(map.Math).toBe(2)
    expect(map.Misc).toBeUndefined() // pending-puzzle excluded
  })
})

// ─── Health ──────────────────────────────────────────────────────────────────

describe('GET /health', () => {
  it('returns ok status', async () => {
    const harness = await createTestHarness()
    const { status, body } = await fetchJson<{ status: string }>(harness, '/health')
    expect(status).toBe(200)
    expect(body.status).toBe('ok')
  })
})

// ─── 404 ─────────────────────────────────────────────────────────────────────

describe('unknown route', () => {
  it('returns 404', async () => {
    const harness = await createTestHarness()
    const { status } = await fetchJson(harness, '/unknown/path')
    expect(status).toBe(404)
  })
})
