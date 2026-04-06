/**
 * Minimal path-pattern router for the marketplace worker.
 *
 * Supports `:param` placeholders and passes extracted params to the handler.
 * Intentionally dependency-free so the worker bundle stays small and tests
 * can exercise handlers without any router framework setup.
 */
import type { Env } from './types'

export type RouteHandler = (
  request: Request,
  env: Env,
  params: Record<string, string>,
  ctx: ExecutionContext
) => Promise<Response> | Response

interface Route {
  method: string
  pattern: RegExp
  paramNames: string[]
  handler: RouteHandler
}

function compilePath(path: string): { pattern: RegExp; paramNames: string[] } {
  const paramNames: string[] = []
  const regex = path.replace(/:(\w+)/g, (_, name) => {
    paramNames.push(name)
    return '([^/]+)'
  })
  return { pattern: new RegExp(`^${regex}/?$`), paramNames }
}

export class Router {
  private routes: Route[] = []

  add(method: string, path: string, handler: RouteHandler): this {
    const { pattern, paramNames } = compilePath(path)
    this.routes.push({ method: method.toUpperCase(), pattern, paramNames, handler })
    return this
  }

  get(path: string, handler: RouteHandler) { return this.add('GET', path, handler) }
  post(path: string, handler: RouteHandler) { return this.add('POST', path, handler) }
  put(path: string, handler: RouteHandler) { return this.add('PUT', path, handler) }
  delete(path: string, handler: RouteHandler) { return this.add('DELETE', path, handler) }

  handle(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> | Response | null {
    const url = new URL(request.url)
    const method = request.method.toUpperCase()
    for (const route of this.routes) {
      if (route.method !== method) continue
      const match = url.pathname.match(route.pattern)
      if (!match) continue
      const params: Record<string, string> = {}
      for (let i = 0; i < route.paramNames.length; i++) {
        params[route.paramNames[i]] = decodeURIComponent(match[i + 1])
      }
      return route.handler(request, env, params, ctx)
    }
    return null
  }
}
