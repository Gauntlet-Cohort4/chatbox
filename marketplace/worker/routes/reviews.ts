/**
 * Review routes (list, create, update) scoped to a plugin.
 */
import { nanoid } from 'nanoid'
import { z } from 'zod'
import { pluginQueries, reviewQueries } from '../db/queries'
import { badRequest, conflict, forbidden, json, notFound } from '../lib/responses'
import { requireTeacher } from '../middleware/auth'
import type { Env } from '../types'

const ReviewBodySchema = z.object({
  rating: z.number().int().min(1).max(5),
  reviewText: z.string().max(2000).optional(),
})

// GET /marketplace/plugins/:pluginId/reviews
export async function listReviews(
  request: Request,
  env: Env,
  params: { pluginId: string }
): Promise<Response> {
  const url = new URL(request.url)
  const page = Math.max(1, Number.parseInt(url.searchParams.get('page') ?? '1', 10) || 1)
  const limit = Math.min(100, Math.max(1, Number.parseInt(url.searchParams.get('limit') ?? '20', 10) || 20))

  const { rows, total } = await reviewQueries.listByPlugin(env.DB, params.pluginId, { page, limit })
  return json({
    reviews: rows.map((r) => ({
      reviewId: r.reviewId,
      teacherName: r.teacherName,
      rating: r.rating,
      reviewText: r.reviewText,
      createdAt: r.createdAt,
    })),
    total,
  })
}

// POST /marketplace/plugins/:pluginId/reviews
export async function createReview(
  request: Request,
  env: Env,
  params: { pluginId: string }
): Promise<Response> {
  const auth = await requireTeacher(request, env)
  if (!auth.ok) return auth.response

  const plugin = await pluginQueries.getApprovedById(env.DB, params.pluginId)
  if (!plugin) return notFound('Plugin not found')

  const bodyJson = await readJson(request)
  if (bodyJson == null) return badRequest('Body must be JSON')
  const parsed = ReviewBodySchema.safeParse(bodyJson)
  if (!parsed.success) return badRequest('Invalid review', flattenZod(parsed.error))

  const existing = await reviewQueries.getByTeacherAndPlugin(env.DB, params.pluginId, auth.teacher.teacherId)
  if (existing) return conflict('You have already reviewed this plugin')

  const reviewId = `review_${nanoid(12)}`
  await reviewQueries.insert(env.DB, {
    reviewId,
    pluginId: params.pluginId,
    teacherId: auth.teacher.teacherId,
    rating: parsed.data.rating,
    reviewText: parsed.data.reviewText ?? null,
    createdAt: Date.now(),
  })
  await pluginQueries.updateAggregateRating(env.DB, params.pluginId)

  return json({ reviewId, status: 'created' }, { status: 201 })
}

// PUT /marketplace/plugins/:pluginId/reviews
export async function updateReview(
  request: Request,
  env: Env,
  params: { pluginId: string }
): Promise<Response> {
  const auth = await requireTeacher(request, env)
  if (!auth.ok) return auth.response

  const existing = await reviewQueries.getByTeacherAndPlugin(env.DB, params.pluginId, auth.teacher.teacherId)
  if (!existing) return notFound('Review not found')
  if (existing.teacherId !== auth.teacher.teacherId) return forbidden('Cannot edit another teacher\'s review')

  const bodyJson = await readJson(request)
  if (bodyJson == null) return badRequest('Body must be JSON')
  const parsed = ReviewBodySchema.safeParse(bodyJson)
  if (!parsed.success) return badRequest('Invalid review', flattenZod(parsed.error))

  await reviewQueries.update(env.DB, existing.reviewId, {
    rating: parsed.data.rating,
    reviewText: parsed.data.reviewText ?? null,
  })
  await pluginQueries.updateAggregateRating(env.DB, params.pluginId)

  return json({ reviewId: existing.reviewId, status: 'updated' })
}

async function readJson(request: Request): Promise<unknown | null> {
  try {
    return await request.json()
  } catch {
    return null
  }
}

function flattenZod(error: z.ZodError): Record<string, string[]> {
  const flat = error.flatten()
  const details: Record<string, string[]> = {}
  for (const [key, messages] of Object.entries(flat.fieldErrors)) {
    if (messages) details[key] = messages
  }
  if (flat.formErrors.length > 0) details._form = flat.formErrors
  return details
}
