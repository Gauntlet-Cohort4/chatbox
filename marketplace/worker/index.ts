/**
 * Cloudflare Worker entry point for the ChatBridge Marketplace API.
 *
 * Uses itty-router for routing. D1 for database, R2 for asset storage.
 */
import { AutoRouter, cors, error, json } from 'itty-router'
import type { Env } from './types'

const { preflight, corsify } = cors({
  origin: '*', // Tightened per-environment in production
  credentials: true,
})

const router = AutoRouter({
  before: [preflight],
  finally: [corsify],
})

// Health check
router.get('/health', () => json({ status: 'ok', timestamp: Date.now() }))

// Catch-all 404
router.all('*', () => error(404, 'Not found'))

export default {
  fetch: (request: Request, env: Env, ctx: ExecutionContext) => router.fetch(request, env, ctx),

  // Scheduled handler for session/code cleanup (Phase 4)
  // async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) { ... }
} satisfies ExportedHandler<Env>
