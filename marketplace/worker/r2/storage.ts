/**
 * Centralized R2 storage helpers.
 *
 * All R2 key construction and validation lives here so that path-traversal
 * and malformed-id concerns are handled in exactly one place.
 */
import type { Env } from '../types'

const SAFE_ID_PATTERN = /^[A-Za-z0-9_\-.]+$/
const SAFE_VERSION_PATTERN = /^[A-Za-z0-9_\-.+]+$/

export class UnsafeKeyError extends Error {
  constructor(value: string, kind: string) {
    super(`Unsafe ${kind}: ${value}`)
    this.name = 'UnsafeKeyError'
  }
}

function assertSafeId(id: string, kind: string): void {
  if (!SAFE_ID_PATTERN.test(id)) throw new UnsafeKeyError(id, kind)
}

function assertSafeVersion(version: string): void {
  if (!SAFE_VERSION_PATTERN.test(version)) throw new UnsafeKeyError(version, 'version')
}

// ─── Key constructors ────────────────────────────────────────────────────────

export function bundleKey(pluginId: string, version: string): string {
  assertSafeId(pluginId, 'pluginId')
  assertSafeVersion(version)
  return `bundles/${pluginId}/${version}/bundle.zip`
}

export function screenshotKey(pluginId: string): string {
  assertSafeId(pluginId, 'pluginId')
  return `screenshots/${pluginId}/screenshot.png`
}

// ─── Bundle operations ───────────────────────────────────────────────────────

export async function putBundle(
  env: Env,
  pluginId: string,
  version: string,
  data: ArrayBuffer
): Promise<string> {
  const key = bundleKey(pluginId, version)
  await env.BUCKET.put(key, data, {
    httpMetadata: { contentType: 'application/zip' },
  })
  return key
}

export async function getBundle(env: Env, pluginId: string, version: string): Promise<R2ObjectBody | null> {
  const obj = await env.BUCKET.get(bundleKey(pluginId, version))
  return obj ?? null
}

// ─── Screenshot operations ───────────────────────────────────────────────────

export async function putScreenshot(
  env: Env,
  pluginId: string,
  data: ArrayBuffer,
  contentType: string
): Promise<string> {
  const key = screenshotKey(pluginId)
  await env.BUCKET.put(key, data, { httpMetadata: { contentType } })
  return key
}

export async function getScreenshot(
  env: Env,
  pluginId: string
): Promise<{ body: ReadableStream; contentType: string } | null> {
  assertSafeId(pluginId, 'pluginId')
  const object = await env.BUCKET.get(screenshotKey(pluginId))
  if (!object) return null
  return {
    body: object.body,
    contentType: object.httpMetadata?.contentType ?? 'image/png',
  }
}

// ─── Cleanup ─────────────────────────────────────────────────────────────────

export async function deletePluginAssets(env: Env, pluginId: string, version: string): Promise<void> {
  await env.BUCKET.delete(bundleKey(pluginId, version))
  await env.BUCKET.delete(screenshotKey(pluginId))
}
