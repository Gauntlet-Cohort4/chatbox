/**
 * Public marketplace routes: browse, detail, submission, images, categories.
 */
import { nanoid } from 'nanoid'
import type { z } from 'zod'
import { pluginQueries, type PluginRow, type PluginSortKey } from '../db/queries'
import { badRequest, conflict, json, notFound, serverError } from '../lib/responses'
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

  const object = await env.BUCKET.get(row.screenshotKey)
  if (!object) return notFound('Screenshot asset missing')

  const headers = new Headers()
  headers.set('Content-Type', object.httpMetadata?.contentType ?? 'image/png')
  headers.set('Cache-Control', 'public, max-age=86400')
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
  if (!isSafeR2Key(pluginId)) return serverError('pluginId generation produced unsafe key')

  const bundleBytes = await bundleFile.arrayBuffer()
  const bundleHash = await computeSha256Hex(bundleBytes)
  const bundleVersion = manifest.version
  const bundleUrl = `bundles/${pluginId}/${bundleVersion}/bundle.zip`

  try {
    await env.BUCKET.put(bundleUrl, bundleBytes, {
      httpMetadata: { contentType: 'application/zip' },
    })
  } catch {
    return serverError('Failed to store bundle')
  }

  let screenshotKey: string | null = null
  if (screenshotFile instanceof File) {
    screenshotKey = `screenshots/${pluginId}/screenshot.png`
    const screenshotBytes = await screenshotFile.arrayBuffer()
    try {
      await env.BUCKET.put(screenshotKey, screenshotBytes, {
        httpMetadata: { contentType: screenshotFile.type || 'image/png' },
      })
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
    screenshotKey,
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

const SAFE_KEY_PATTERN = /^[A-Za-z0-9_\-.]+$/
function isSafeR2Key(id: string): boolean {
  return SAFE_KEY_PATTERN.test(id)
}
