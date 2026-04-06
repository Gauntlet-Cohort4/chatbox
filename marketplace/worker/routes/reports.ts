/**
 * Report submission routes.
 */
import { nanoid } from 'nanoid'
import { z } from 'zod'
import { pluginQueries, reportQueries } from '../db/queries'
import { badRequest, json, notFound } from '../lib/responses'
import { requireTeacher } from '../middleware/auth'
import type { Env } from '../types'

const ReportBodySchema = z.object({
  reportReason: z.string().min(1).max(200),
  reportDetails: z.string().max(2000).optional(),
})

// POST /marketplace/plugins/:pluginId/reports
export async function createReport(
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
  const parsed = ReportBodySchema.safeParse(bodyJson)
  if (!parsed.success) return badRequest('Invalid report', flattenZod(parsed.error))

  const reportId = `report_${nanoid(12)}`
  await reportQueries.insert(env.DB, {
    reportId,
    pluginId: params.pluginId,
    reporterId: auth.teacher.teacherId,
    reportReason: parsed.data.reportReason,
    reportDetails: parsed.data.reportDetails ?? null,
    reportStatus: 'open',
    createdAt: Date.now(),
  })
  await pluginQueries.incrementReportCount(env.DB, params.pluginId)

  return json({ reportId, status: 'submitted' }, { status: 201 })
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
