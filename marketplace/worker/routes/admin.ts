/**
 * Admin routes: submission review and report resolution.
 */
import { z } from 'zod'
import { pluginQueries, reportQueries } from '../db/queries'
import { badRequest, json, notFound } from '../lib/responses'
import { requireAdmin } from '../middleware/auth'
import type { Env } from '../types'

// GET /admin/submissions
export function listPendingSubmissions(request: Request, env: Env): Promise<Response> | Response {
  const auth = requireAdmin(request, env)
  if (!auth.ok) return auth.response
  return pluginQueries.listPending(env.DB).then((rows) => json({ submissions: rows }))
}

// PUT /admin/submissions/:pluginId/approve
export async function approveSubmission(
  request: Request,
  env: Env,
  params: { pluginId: string }
): Promise<Response> {
  const auth = requireAdmin(request, env)
  if (!auth.ok) return auth.response

  const existing = await pluginQueries.getById(env.DB, params.pluginId)
  if (!existing) return notFound('Plugin not found')

  await pluginQueries.updateStatus(env.DB, params.pluginId, 'approved', { reviewedBy: 'admin' })
  return json({ pluginId: params.pluginId, status: 'approved' })
}

// PUT /admin/submissions/:pluginId/reject
const RejectBodySchema = z.object({
  rejectionReason: z.string().min(1).max(1000),
})

export async function rejectSubmission(
  request: Request,
  env: Env,
  params: { pluginId: string }
): Promise<Response> {
  const auth = requireAdmin(request, env)
  if (!auth.ok) return auth.response

  const existing = await pluginQueries.getById(env.DB, params.pluginId)
  if (!existing) return notFound('Plugin not found')

  const bodyJson = await readJson(request)
  if (bodyJson == null) return badRequest('Body must be JSON')
  const parsed = RejectBodySchema.safeParse(bodyJson)
  if (!parsed.success) return badRequest('rejectionReason is required')

  await pluginQueries.updateStatus(env.DB, params.pluginId, 'rejected', {
    reviewedBy: 'admin',
    rejectionReason: parsed.data.rejectionReason,
  })
  return json({ pluginId: params.pluginId, status: 'rejected' })
}

// GET /admin/reports
export async function listReports(request: Request, env: Env): Promise<Response> {
  const auth = requireAdmin(request, env)
  if (!auth.ok) return auth.response

  const url = new URL(request.url)
  const statusParam = url.searchParams.get('status')
  const status = statusParam === 'open' || statusParam === 'resolved' ? statusParam : undefined
  const rows = await reportQueries.listByStatus(env.DB, status)
  return json({ reports: rows })
}

// PUT /admin/reports/:reportId
const ResolveBodySchema = z.object({
  resolution: z.enum(['resolved', 'dismissed']),
  notes: z.string().max(2000).optional(),
})

export async function resolveReport(
  request: Request,
  env: Env,
  params: { reportId: string }
): Promise<Response> {
  const auth = requireAdmin(request, env)
  if (!auth.ok) return auth.response

  const bodyJson = await readJson(request)
  if (bodyJson == null) return badRequest('Body must be JSON')
  const parsed = ResolveBodySchema.safeParse(bodyJson)
  if (!parsed.success) return badRequest('Invalid resolution payload')

  // Check existence via list (cheaper than a dedicated query — reports table is small)
  const all = await reportQueries.listByStatus(env.DB)
  const existing = all.find((r) => r.reportId === params.reportId)
  if (!existing) return notFound('Report not found')

  await reportQueries.resolve(env.DB, params.reportId, {
    resolution: parsed.data.resolution,
    resolvedBy: 'admin',
    notes: parsed.data.notes ?? null,
  })
  return json({ reportId: params.reportId, status: parsed.data.resolution })
}

async function readJson(request: Request): Promise<unknown | null> {
  try {
    return await request.json()
  } catch {
    return null
  }
}
