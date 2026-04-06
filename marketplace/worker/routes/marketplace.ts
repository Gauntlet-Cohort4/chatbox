/**
 * Public marketplace routes: browse, detail, submission, images, bundles, categories.
 */
import { nanoid } from 'nanoid'
import type { z } from 'zod'
import { pluginQueries, type PluginRow, type PluginSortKey } from '../db/queries'
import { badRequest, conflict, json, notFound, serverError } from '../lib/responses'
import { getBundle, getScreenshot, putBundle, putScreenshot, UnsafeKeyError } from '../r2/storage'
import { PluginSubmissionSchema } from '../schemas/submission'
import type { Env } from '../types'

const MAX_BUNDLE_BYTES = 5 * 1024 * 1024 // 5 MB
const MAX_SCREENSHOT_BYTES = 2 * 1024 * 1024 // 2 MB
const DEFAULT_LIMIT = 24
const MAX_LIMIT = 100

const SORT_VALUES = new Set<PluginSortKey>(['rating', 'popular', 'newest', 'name'])

function parseSort(value: string | null): PluginSortKey {
  if (value && (SORT_VALUES as Set<string>).has(value)) return value as PluginSortKey
  return 'rating'
}

// GET /marketplace/plugins
export async function listPlugins(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url)
  const category = url.searchParams.get('category') ?? undefined
  const search = url.searchParams.get('search') ?? undefined
  const sort = parseSort(url.searchParams.get('sort'))
  const page = Math.max(1, Number.parseInt(url.searchParams.get('page') ?? '1', 10) || 1)
  const limit = Math.min(
    MAX_LIMIT,
    Math.max(1, Number.parseInt(url.searchParams.get('limit') ?? String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT)
  )

  const { rows, total } = await pluginQueries.listApproved(env.DB, { category, search, sort, page, limit })
  return json({ plugins: rows, total, page, limit })
}

// GET /marketplace/plugins/:pluginId
export async function getPluginDetail(
  _request: Request,
  env: Env,
  params: { pluginId: string }
): Promise<Response> {
  const row = await pluginQueries.getApprovedById(env.DB, params.pluginId)
  if (!row) return notFound('Plugin not found')
  return json(row)
}

// GET /marketplace/plugins/:pluginId/image
export async function getPluginImage(
  _request: Request,
  env: Env,
  params: { pluginId: string }
): Promise<Response> {
  const row = await pluginQueries.getApprovedById(env.DB, params.pluginId)
  if (!row || !row.screenshotKey) return notFound('Screenshot not found')

  let result: { body: ReadableStream; contentType: string } | null
  try {
    result = await getScreenshot(env, params.pluginId)
  } catch (err) {
    if (err instanceof UnsafeKeyError) return badRequest('Invalid plugin id')
    throw err
  }
  if (!result) return notFound('Screenshot asset missing')

  const headers = new Headers()
  headers.set('Content-Type', result.contentType)
  headers.set('Cache-Control', 'public, max-age=86400')
  return new Response(result.body, { headers })
}

// GET /marketplace/plugins/:pluginId/bundle
export async function getPluginBundle(
  _request: Request,
  env: Env,
  params: { pluginId: string }
): Promise<Response> {
  const row = await pluginQueries.getApprovedById(env.DB, params.pluginId)
  if (!row) return notFound('Plugin not found')

  let object: R2ObjectBody | null
  try {
    object = await getBundle(env, row.pluginId, row.bundleVersion)
  } catch (err) {
    if (err instanceof UnsafeKeyError) return badRequest('Invalid plugin id or version')
    throw err
  }
  if (!object) return notFound('Bundle asset missing')

  const headers = new Headers()
  headers.set('Content-Type', 'application/zip')
  headers.set('Content-Disposition', `attachment; filename="${row.pluginId}-${row.bundleVersion}.zip"`)
  headers.set('Cache-Control', 'public, max-age=3600')
  if (row.bundleSizeBytes) headers.set('Content-Length', String(row.bundleSizeBytes))
  return new Response(object.body, { headers })
}

// POST /marketplace/plugins
export async function submitPlugin(request: Request, env: Env): Promise<Response> {
  const contentType = request.headers.get('Content-Type') ?? ''
  if (!contentType.includes('multipart/form-data')) {
    return badRequest('Expected multipart/form-data')
  }

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return badRequest('Invalid multipart body')
  }

  const manifestRaw = formData.get('manifest')
  if (typeof manifestRaw !== 'string') {
    return badRequest('manifest field is required')
  }

  let manifestJson: unknown
  try {
    manifestJson = JSON.parse(manifestRaw)
  } catch {
    return badRequest('manifest is not valid JSON')
  }

  const parseResult = PluginSubmissionSchema.safeParse(manifestJson)
  if (!parseResult.success) {
    return badRequest('Invalid submission', flattenZodErrors(parseResult.error))
  }
  const manifest = parseResult.data

  const bundleFile = formData.get('bundle')
  if (!(bundleFile instanceof File)) {
    return badRequest('bundle file is required')
  }
  if (bundleFile.size === 0) {
    return badRequest('bundle file is empty')
  }
  if (bundleFile.size > MAX_BUNDLE_BYTES) {
    return badRequest(`bundle exceeds maximum size of ${MAX_BUNDLE_BYTES} bytes`)
  }

  const screenshotFile = formData.get('screenshot')
  if (screenshotFile != null && !(screenshotFile instanceof File)) {
    return badRequest('screenshot must be a file if provided')
  }
  if (screenshotFile instanceof File && screenshotFile.size > MAX_SCREENSHOT_BYTES) {
    return badRequest(`screenshot exceeds maximum size of ${MAX_SCREENSHOT_BYTES} bytes`)
  }

  const pluginId = `plugin_${nanoid(10)}`
  const bundleBytes = await bundleFile.arrayBuffer()
  const bundleHash = await computeSha256Hex(bundleBytes)
  const bundleVersion = manifest.version

  let bundleUrl: string
  try {
    bundleUrl = await putBundle(env, pluginId, bundleVersion, bundleBytes)
  } catch (err) {
    if (err instanceof UnsafeKeyError) return badRequest('Invalid bundle version format')
    return serverError('Failed to store bundle')
  }

  let screenshotStorageKey: string | null = null
  if (screenshotFile instanceof File) {
    const screenshotBytes = await screenshotFile.arrayBuffer()
    try {
      screenshotStorageKey = await putScreenshot(
        env,
        pluginId,
        screenshotBytes,
        screenshotFile.type || 'image/png'
      )
    } catch {
      return serverError('Failed to store screenshot')
    }
  }

  const row: PluginRow = {
    pluginId,
    pluginName: manifest.pluginName,
    description: manifest.description,
    version: manifest.version,
    author: manifest.author,
    authorEmail: manifest.authorEmail ?? null,
    category: manifest.category,
    contentRating: manifest.contentRating,
    toolDefinitions: JSON.stringify(manifest.tools),
    userInterfaceConfig: JSON.stringify(manifest.userInterface),
    authenticationConfig: JSON.stringify(manifest.authentication),
    contextPrompt: manifest.contextPrompt ?? null,
    capabilities: JSON.stringify(manifest.capabilities),
    bundleUrl,
    bundleVersion,
    bundleHash,
    bundleSizeBytes: bundleFile.size,
    screenshotKey: screenshotStorageKey,
    submissionStatus: 'pending',
    submittedAt: Date.now(),
    reviewedAt: null,
    reviewedBy: null,
    rejectionReason: null,
    averageRating: 0,
    totalRatings: 0,
    totalReports: 0,
  }

  try {
    await pluginQueries.insert(env.DB, row)
  } catch (err) {
    if (String(err).includes('UNIQUE')) return conflict('Plugin with this ID already exists')
    return serverError('Failed to insert plugin')
  }

  return json({ pluginId, status: 'pending' }, { status: 201 })
}

// GET /marketplace/categories
export async function listCategories(_request: Request, env: Env): Promise<Response> {
  const counts = await pluginQueries.categoryCounts(env.DB)
  return json({ categories: counts.map((c) => ({ name: c.category, count: c.count })) })
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function flattenZodErrors(error: z.ZodError): Record<string, string[]> {
  const flat = error.flatten()
  const details: Record<string, string[]> = {}
  for (const [key, messages] of Object.entries(flat.fieldErrors)) {
    if (messages) details[key] = messages
  }
  if (flat.formErrors.length > 0) details._form = flat.formErrors
  return details
}

async function computeSha256Hex(bytes: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', bytes)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}
