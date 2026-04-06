/**
 * Public student-facing catalog endpoint.
 *
 * GET /catalog/:joinCode
 *
 * Returns the deployed-plugin catalog JSON for a teacher identified by join
 * code. Supports ETag-based conditional requests (If-None-Match → 304).
 * Short cache to cap request load while still feeling fresh to students.
 */
import { notFound } from '../lib/responses'
import { catalogKey } from '../r2/catalog'
import type { Env } from '../types'

export async function getCatalog(
  request: Request,
  env: Env,
  params: { joinCode: string }
): Promise<Response> {
  const object = await env.BUCKET.get(catalogKey(params.joinCode))
  if (!object) return notFound('Catalog not found')

  const etag = object.etag
  const ifNoneMatch = request.headers.get('If-None-Match')
  if (ifNoneMatch && ifNoneMatch === etag) {
    return new Response(null, {
      status: 304,
      headers: {
        ETag: etag,
        'Cache-Control': 'public, max-age=30',
      },
    })
  }

  return new Response(object.body, {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ETag: etag,
      'Cache-Control': 'public, max-age=30',
    },
  })
}
