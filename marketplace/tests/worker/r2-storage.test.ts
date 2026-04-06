// @vitest-environment node
import { beforeEach, describe, expect, it } from 'vitest'
import workerHandler from '../../worker/index'
import {
  bundleKey,
  deletePluginAssets,
  getBundle,
  getScreenshot,
  putBundle,
  putScreenshot,
  screenshotKey,
  UnsafeKeyError,
} from '../../worker/r2/storage'
import { createExecutionContext, createTestHarness, type TestHarness } from './helpers/test-env'

describe('R2 key construction', () => {
  it('bundleKey rejects path traversal attempts', () => {
    expect(() => bundleKey('../etc/passwd', '1.0.0')).toThrow(UnsafeKeyError)
    expect(() => bundleKey('plugin/id', '1.0.0')).toThrow(UnsafeKeyError)
    expect(() => bundleKey('plugin\\id', '1.0.0')).toThrow(UnsafeKeyError)
  })

  it('bundleKey rejects unsafe version strings', () => {
    expect(() => bundleKey('chess', '../1.0.0')).toThrow(UnsafeKeyError)
    expect(() => bundleKey('chess', '1.0.0/hack')).toThrow(UnsafeKeyError)
  })

  it('bundleKey accepts valid ids and versions', () => {
    expect(bundleKey('chess', '1.0.0')).toBe('bundles/chess/1.0.0/bundle.zip')
    expect(bundleKey('plugin_abc123', '2.1.0+build.4')).toBe('bundles/plugin_abc123/2.1.0+build.4/bundle.zip')
  })

  it('screenshotKey rejects path traversal', () => {
    expect(() => screenshotKey('../etc')).toThrow(UnsafeKeyError)
    expect(() => screenshotKey('plugin/id')).toThrow(UnsafeKeyError)
  })

  it('screenshotKey constructs correct path', () => {
    expect(screenshotKey('chess')).toBe('screenshots/chess/screenshot.png')
  })
})

describe('R2 storage helpers', () => {
  let harness: TestHarness
  beforeEach(async () => { harness = await createTestHarness({ withSeed: false }) })

  it('putBundle + getBundle round-trip', async () => {
    const data = new TextEncoder().encode('fake-zip-content').buffer as ArrayBuffer
    const key = await putBundle(harness.env, 'chess', '1.0.0', data)
    expect(key).toBe('bundles/chess/1.0.0/bundle.zip')

    const fetched = await getBundle(harness.env, 'chess', '1.0.0')
    expect(fetched).not.toBeNull()
    const text = await fetched?.text()
    expect(text).toBe('fake-zip-content')
  })

  it('getBundle returns null for missing bundle', async () => {
    const fetched = await getBundle(harness.env, 'chess', '1.0.0')
    expect(fetched).toBeNull()
  })

  it('putScreenshot + getScreenshot round-trip', async () => {
    const data = new Uint8Array([0x89, 0x50, 0x4e, 0x47]).buffer as ArrayBuffer
    await putScreenshot(harness.env, 'chess', data, 'image/png')

    const fetched = await getScreenshot(harness.env, 'chess')
    expect(fetched).not.toBeNull()
    expect(fetched?.contentType).toBe('image/png')
  })

  it('getScreenshot throws UnsafeKeyError for bad id', async () => {
    await expect(getScreenshot(harness.env, '../etc')).rejects.toThrow(UnsafeKeyError)
  })

  it('deletePluginAssets removes both bundle and screenshot', async () => {
    const data = new TextEncoder().encode('x').buffer as ArrayBuffer
    await putBundle(harness.env, 'chess', '1.0.0', data)
    await putScreenshot(harness.env, 'chess', data, 'image/png')

    await deletePluginAssets(harness.env, 'chess', '1.0.0')

    expect(await getBundle(harness.env, 'chess', '1.0.0')).toBeNull()
    expect(await getScreenshot(harness.env, 'chess')).toBeNull()
  })
})

describe('GET /marketplace/plugins/:pluginId/bundle', () => {
  it('serves bundle with zip content type and disposition', async () => {
    const harness = await createTestHarness()
    // Seed does not put actual bundle bytes in R2; do that here
    const data = new TextEncoder().encode('fake-zip').buffer as ArrayBuffer
    await putBundle(harness.env, 'chess', '1.0.0', data)

    const request = new Request('http://test.local/marketplace/plugins/chess/bundle')
    const response = await workerHandler.fetch(request, harness.env, createExecutionContext())
    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toBe('application/zip')
    expect(response.headers.get('Content-Disposition')).toContain('attachment')
    expect(response.headers.get('Content-Disposition')).toContain('chess-1.0.0.zip')
  })

  it('returns 404 for pending plugin', async () => {
    const harness = await createTestHarness()
    const request = new Request('http://test.local/marketplace/plugins/pending-puzzle/bundle')
    const response = await workerHandler.fetch(request, harness.env, createExecutionContext())
    expect(response.status).toBe(404)
  })

  it('returns 404 when bundle not uploaded to R2', async () => {
    const harness = await createTestHarness()
    // chess is approved in seed but no bundle bytes in R2
    const request = new Request('http://test.local/marketplace/plugins/chess/bundle')
    const response = await workerHandler.fetch(request, harness.env, createExecutionContext())
    expect(response.status).toBe(404)
  })
})
