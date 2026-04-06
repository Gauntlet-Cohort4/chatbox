/**
 * Catalog generation: builds the deployed-plugin JSON manifest for a teacher
 * and stores it in R2 under `catalogs/{joinCode}/catalog.json`.
 *
 * The student-facing ChatBridge app polls this endpoint every ~60s via the
 * student's teacher join code; the shape matches the PluginManifest array
 * consumed by the existing plugin bootstrap.
 */
import { teacherPluginQueries, teacherQueries, type PluginRow } from '../db/queries'
import type { Env } from '../types'

export interface CatalogJson {
  catalogVersion: string
  joinCode: string
  plugins: CatalogPlugin[]
}

export interface CatalogPlugin {
  pluginId: string
  pluginName: string
  description: string
  version: string
  author: string
  category: string
  contentRating: string
  tools: unknown
  userInterface: unknown
  authentication: unknown
  contextPrompt: string | null
  capabilities: unknown
  bundle: {
    bundleUrl: string
    bundleVersion: string
    bundleHash: string
    entryFile: string
  }
}

function safeParse(raw: string, fallback: unknown): unknown {
  try {
    return JSON.parse(raw)
  } catch {
    return fallback
  }
}

function toCatalogPlugin(row: PluginRow): CatalogPlugin {
  return {
    pluginId: row.pluginId,
    pluginName: row.pluginName,
    description: row.description,
    version: row.version,
    author: row.author,
    category: row.category,
    contentRating: row.contentRating,
    tools: safeParse(row.toolDefinitions, []),
    userInterface: safeParse(row.userInterfaceConfig, {}),
    authentication: safeParse(row.authenticationConfig, { authType: 'none' }),
    contextPrompt: row.contextPrompt,
    capabilities: safeParse(row.capabilities, {}),
    bundle: {
      bundleUrl: row.bundleUrl,
      bundleVersion: row.bundleVersion,
      bundleHash: row.bundleHash,
      entryFile: 'index.html',
    },
  }
}

export function catalogKey(joinCode: string): string {
  return `catalogs/${joinCode}/catalog.json`
}

/**
 * Regenerate a teacher's catalog from the current set of deployed plugins
 * and persist it to R2. No-op if the teacher does not exist.
 */
export async function regenerateCatalog(env: Env, teacherId: string): Promise<CatalogJson | null> {
  const teacher = await teacherQueries.getById(env.DB, teacherId)
  if (!teacher) return null

  const deployedRows = await teacherPluginQueries.listDeployed(env.DB, teacherId)
  const catalog: CatalogJson = {
    catalogVersion: new Date().toISOString(),
    joinCode: teacher.joinCode,
    plugins: deployedRows.map(toCatalogPlugin),
  }

  const body = JSON.stringify(catalog)
  await env.BUCKET.put(catalogKey(teacher.joinCode), body, {
    httpMetadata: { contentType: 'application/json' },
  })

  return catalog
}
