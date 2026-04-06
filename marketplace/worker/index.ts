/**
 * Cloudflare Worker entry point for the ChatBridge Marketplace API.
 */
import { handlePreflight, withCors } from './middleware/cors'
import { enforceCsrf } from './middleware/csrf'
import { notFound, serverError } from './lib/responses'
import { Router } from './router'
import {
  approveSubmission,
  listPendingSubmissions,
  listReports,
  rejectSubmission,
  resolveReport,
} from './routes/admin'
import { exchangeCode, generateExchangeCode, getMe, logout } from './routes/auth'
import { getCatalog } from './routes/catalog'
import {
  addTeacherPlugin,
  approveTeacherPlugin,
  deployTeacherPlugin,
  listTeacherPlugins,
  removeTeacherPlugin,
  revokeTeacherPlugin,
} from './routes/teacher-plugins'
import {
  getPluginBundle,
  getPluginDetail,
  getPluginImage,
  listCategories,
  listPlugins,
  submitPlugin,
} from './routes/marketplace'
import { createReport } from './routes/reports'
import { createReview, listReviews, updateReview } from './routes/reviews'
import { registerTeacher } from './routes/teachers'
import { authQueries } from './db/queries'
import type { Env } from './types'

export function buildRouter(): Router {
  const router = new Router()

  // Health
  router.get('/health', () =>
    new Response(JSON.stringify({ status: 'ok', timestamp: Date.now() }), {
      headers: { 'Content-Type': 'application/json' },
    })
  )

  // Marketplace public routes
  router.get('/marketplace/plugins', (request, env) => listPlugins(request, env))
  router.get('/marketplace/plugins/:pluginId', (request, env, params) =>
    getPluginDetail(request, env, { pluginId: params.pluginId })
  )
  router.get('/marketplace/plugins/:pluginId/image', (request, env, params) =>
    getPluginImage(request, env, { pluginId: params.pluginId })
  )
  router.get('/marketplace/plugins/:pluginId/bundle', (request, env, params) =>
    getPluginBundle(request, env, { pluginId: params.pluginId })
  )
  router.post('/marketplace/plugins', (request, env) => submitPlugin(request, env))
  router.get('/marketplace/categories', (request, env) => listCategories(request, env))

  // Review routes
  router.get('/marketplace/plugins/:pluginId/reviews', (request, env, params) =>
    listReviews(request, env, { pluginId: params.pluginId })
  )
  router.post('/marketplace/plugins/:pluginId/reviews', (request, env, params) =>
    createReview(request, env, { pluginId: params.pluginId })
  )
  router.put('/marketplace/plugins/:pluginId/reviews', (request, env, params) =>
    updateReview(request, env, { pluginId: params.pluginId })
  )

  // Report routes
  router.post('/marketplace/plugins/:pluginId/reports', (request, env, params) =>
    createReport(request, env, { pluginId: params.pluginId })
  )

  // Admin routes
  router.get('/admin/submissions', (request, env) => listPendingSubmissions(request, env))
  router.put('/admin/submissions/:pluginId/approve', (request, env, params) =>
    approveSubmission(request, env, { pluginId: params.pluginId })
  )
  router.put('/admin/submissions/:pluginId/reject', (request, env, params) =>
    rejectSubmission(request, env, { pluginId: params.pluginId })
  )
  router.get('/admin/reports', (request, env) => listReports(request, env))
  router.put('/admin/reports/:reportId', (request, env, params) =>
    resolveReport(request, env, { reportId: params.reportId })
  )

  // Teacher registration + auth routes
  router.post('/teachers/register', (request, env) => registerTeacher(request, env))
  router.post('/auth/exchange-code', (request, env) => generateExchangeCode(request, env))
  router.post('/auth/exchange', (request, env) => exchangeCode(request, env))
  router.get('/auth/me', (request, env) => getMe(request, env))
  router.post('/auth/logout', (request, env) => logout(request, env))

  // Teacher classroom plugin routes
  router.get('/teachers/:teacherId/plugins', (request, env, params) =>
    listTeacherPlugins(request, env, { teacherId: params.teacherId })
  )
  router.post('/teachers/:teacherId/plugins/:pluginId', (request, env, params) =>
    addTeacherPlugin(request, env, { teacherId: params.teacherId, pluginId: params.pluginId })
  )
  router.put('/teachers/:teacherId/plugins/:pluginId/approve', (request, env, params) =>
    approveTeacherPlugin(request, env, { teacherId: params.teacherId, pluginId: params.pluginId })
  )
  router.put('/teachers/:teacherId/plugins/:pluginId/deploy', (request, env, params) =>
    deployTeacherPlugin(request, env, { teacherId: params.teacherId, pluginId: params.pluginId })
  )
  router.put('/teachers/:teacherId/plugins/:pluginId/revoke', (request, env, params) =>
    revokeTeacherPlugin(request, env, { teacherId: params.teacherId, pluginId: params.pluginId })
  )
  router.delete('/teachers/:teacherId/plugins/:pluginId', (request, env, params) =>
    removeTeacherPlugin(request, env, { teacherId: params.teacherId, pluginId: params.pluginId })
  )

  // Public student catalog endpoint
  router.get('/catalog/:joinCode', (request, env, params) =>
    getCatalog(request, env, { joinCode: params.joinCode })
  )

  return router
}

const router = buildRouter()

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    // Preflight
    const preflight = handlePreflight(request, env)
    if (preflight) return preflight

    // CSRF: reject state-changing requests from unexpected origins
    const csrfRejection = enforceCsrf(request, env)
    if (csrfRejection) return withCors(csrfRejection, request, env)

    let response: Response
    try {
      const match = await router.handle(request, env, ctx)
      response = match ?? notFound()
    } catch (err) {
      console.error('[worker] unhandled error', err)
      response = serverError()
    }

    return withCors(response, request, env)
  },

  /** Scheduled cleanup: remove expired sessions and exchange codes daily. */
  async scheduled(_event: ScheduledController, env: Env, _ctx: ExecutionContext): Promise<void> {
    const now = Date.now()
    await authQueries.deleteExpiredSessions(env.DB, now)
    await authQueries.deleteExpiredCodes(env.DB, now)
  },
} satisfies ExportedHandler<Env>
