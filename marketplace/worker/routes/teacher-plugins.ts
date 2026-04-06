/**
 * Teacher classroom plugin management routes.
 *
 * State machine: pending_review → approved → deployed → revoked (re-deploy allowed).
 */
import { pluginQueries, teacherPluginQueries, type TeacherPluginStatus } from '../db/queries'
import { badRequest, conflict, forbidden, json, notFound } from '../lib/responses'
import { requireTeacher } from '../middleware/auth'
import { regenerateCatalog } from '../r2/catalog'
import type { Env } from '../types'

function teacherIdMatchesOrForbidden(
  sessionTeacherId: string,
  urlTeacherId: string
): Response | null {
  if (sessionTeacherId !== urlTeacherId) return forbidden('Cannot access another teacher\'s classroom')
  return null
}

// GET /teachers/:teacherId/plugins
export async function listTeacherPlugins(
  request: Request,
  env: Env,
  params: { teacherId: string }
): Promise<Response> {
  const auth = await requireTeacher(request, env)
  if (!auth.ok) return auth.response
  const guard = teacherIdMatchesOrForbidden(auth.teacher.teacherId, params.teacherId)
  if (guard) return guard

  const rows = await teacherPluginQueries.listByTeacher(env.DB, params.teacherId)
  return json({
    plugins: rows,
    joinCode: auth.teacher.joinCode,
  })
}

// POST /teachers/:teacherId/plugins/:pluginId
export async function addTeacherPlugin(
  request: Request,
  env: Env,
  params: { teacherId: string; pluginId: string }
): Promise<Response> {
  const auth = await requireTeacher(request, env)
  if (!auth.ok) return auth.response
  const guard = teacherIdMatchesOrForbidden(auth.teacher.teacherId, params.teacherId)
  if (guard) return guard

  const plugin = await pluginQueries.getApprovedById(env.DB, params.pluginId)
  if (!plugin) return notFound('Plugin not found or not approved')

  const existing = await teacherPluginQueries.get(env.DB, params.teacherId, params.pluginId)
  if (existing) return conflict('Plugin already in classroom')

  await teacherPluginQueries.add(env.DB, params.teacherId, params.pluginId)
  return json({ status: 'pending_review' }, { status: 201 })
}

// PUT /teachers/:teacherId/plugins/:pluginId/approve
export function approveTeacherPlugin(
  request: Request,
  env: Env,
  params: { teacherId: string; pluginId: string }
): Promise<Response> {
  return transitionStatus(request, env, params, {
    required: ['pending_review'],
    action: () => teacherPluginQueries.approve(env.DB, params.teacherId, params.pluginId),
    nextStatus: 'approved',
  })
}

// PUT /teachers/:teacherId/plugins/:pluginId/deploy
export function deployTeacherPlugin(
  request: Request,
  env: Env,
  params: { teacherId: string; pluginId: string }
): Promise<Response> {
  return transitionStatus(request, env, params, {
    required: ['approved', 'revoked'], // re-deploy allowed
    action: async () => {
      await teacherPluginQueries.deploy(env.DB, params.teacherId, params.pluginId)
      await regenerateCatalog(env, params.teacherId)
    },
    nextStatus: 'deployed',
  })
}

// PUT /teachers/:teacherId/plugins/:pluginId/revoke
export function revokeTeacherPlugin(
  request: Request,
  env: Env,
  params: { teacherId: string; pluginId: string }
): Promise<Response> {
  return transitionStatus(request, env, params, {
    required: ['deployed'],
    action: async () => {
      await teacherPluginQueries.revoke(env.DB, params.teacherId, params.pluginId)
      await regenerateCatalog(env, params.teacherId)
    },
    nextStatus: 'revoked',
  })
}

// DELETE /teachers/:teacherId/plugins/:pluginId
export async function removeTeacherPlugin(
  request: Request,
  env: Env,
  params: { teacherId: string; pluginId: string }
): Promise<Response> {
  const auth = await requireTeacher(request, env)
  if (!auth.ok) return auth.response
  const guard = teacherIdMatchesOrForbidden(auth.teacher.teacherId, params.teacherId)
  if (guard) return guard

  const existing = await teacherPluginQueries.get(env.DB, params.teacherId, params.pluginId)
  if (!existing) return notFound('Plugin not in classroom')

  await teacherPluginQueries.remove(env.DB, params.teacherId, params.pluginId)

  // If it was deployed, regenerate so students stop seeing it
  if (existing.status === 'deployed') {
    await regenerateCatalog(env, params.teacherId)
  }

  return json({ status: 'removed' })
}

// ─── shared transition helper ────────────────────────────────────────────────

async function transitionStatus(
  request: Request,
  env: Env,
  params: { teacherId: string; pluginId: string },
  opts: {
    required: TeacherPluginStatus[]
    action: () => Promise<void>
    nextStatus: TeacherPluginStatus
  }
): Promise<Response> {
  const auth = await requireTeacher(request, env)
  if (!auth.ok) return auth.response
  const guard = teacherIdMatchesOrForbidden(auth.teacher.teacherId, params.teacherId)
  if (guard) return guard

  const existing = await teacherPluginQueries.get(env.DB, params.teacherId, params.pluginId)
  if (!existing) return notFound('Plugin not in classroom')
  if (!opts.required.includes(existing.status as TeacherPluginStatus)) {
    return badRequest(
      `Invalid transition from '${existing.status}' to '${opts.nextStatus}'. Required: ${opts.required.join(' or ')}`
    )
  }

  await opts.action()
  return json({ status: opts.nextStatus })
}
