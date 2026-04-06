/**
 * Cloudflare Worker entry point for the ChatBridge Marketplace API.
 */
import { handlePreflight, withCors } from './middleware/cors'
import { notFound, serverError } from './lib/responses'
import { Router } from './router'
import {
  approveSubmission,
  listPendingSubmissions,
  listReports,
  rejectSubmission,
  resolveReport,
} from './routes/admin'
import {
  getPluginDetail,
  getPluginImage,
  listCategories,
  listPlugins,
  submitPlugin,
} from './routes/marketplace'
import { createReport } from './routes/reports'
import { createReview, listReviews, updateReview } from './routes/reviews'
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

  return router
}

const router = buildRouter()

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    // Preflight
    const preflight = handlePreflight(request, env)
    if (preflight) return preflight

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
} satisfies ExportedHandler<Env>
