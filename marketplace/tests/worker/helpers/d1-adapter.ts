/**
 * Minimal D1Database adapter over sql.js for fast in-memory tests.
 *
 * Implements just the surface area of the D1 API that our query helpers use:
 *   db.prepare(sql).bind(...).all<T>() / first<T>() / run()
 *
 * This is NOT a full D1 shim — it supports positional (?) parameters only,
 * which is all our prepared statements use.
 */
import type { Database as SqlJsDatabase, SqlJsStatic } from 'sql.js'
import initSqlJs from 'sql.js'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const adapterDir = dirname(fileURLToPath(import.meta.url))

/**
 * Walk upward looking for a node_modules/sql.js/dist directory.
 * This handles both the package-local node_modules and the pnpm-hoisted
 * workspace root node_modules.
 */
function resolveSqlJsDist(): string {
  let dir = adapterDir
  for (let i = 0; i < 10; i++) {
    const candidate = join(dir, 'node_modules', 'sql.js', 'dist')
    if (existsSync(candidate)) return candidate
    const parent = dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  throw new Error('Could not locate sql.js dist directory')
}

const sqlJsDist = resolveSqlJsDist()

let sqlJsReady: Promise<SqlJsStatic> | null = null

function getSqlJs(): Promise<SqlJsStatic> {
  if (!sqlJsReady) {
    sqlJsReady = initSqlJs({
      locateFile: (file: string) => join(sqlJsDist, file),
    }) as unknown as Promise<SqlJsStatic>
  }
  return sqlJsReady
}

interface PreparedLike {
  sql: string
  params: unknown[]
}

function runPrepared(raw: SqlJsDatabase, stmt: PreparedLike): { columns: string[]; rows: unknown[][] } {
  const prepared = raw.prepare(stmt.sql)
  try {
    prepared.bind(stmt.params.map(normalizeParam) as never)
    const columns: string[] = prepared.getColumnNames()
    const rows: unknown[][] = []
    while (prepared.step()) {
      rows.push(prepared.get() as unknown[])
    }
    return { columns, rows }
  } finally {
    prepared.free()
  }
}

function normalizeParam(value: unknown): unknown {
  if (value === undefined) return null
  if (typeof value === 'boolean') return value ? 1 : 0
  return value
}

function rowToObject(columns: string[], row: unknown[]): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (let i = 0; i < columns.length; i++) {
    out[columns[i]] = row[i]
  }
  return out
}

class FakeStatement {
  constructor(
    private readonly raw: SqlJsDatabase,
    private readonly sql: string,
    private readonly params: unknown[] = []
  ) {}

  bind(...params: unknown[]): FakeStatement {
    return new FakeStatement(this.raw, this.sql, params)
  }

  first<T = unknown>(): Promise<T | null> {
    const { columns, rows } = runPrepared(this.raw, { sql: this.sql, params: this.params })
    if (rows.length === 0) return Promise.resolve(null)
    return Promise.resolve(rowToObject(columns, rows[0]) as T)
  }

  all<T = unknown>(): Promise<{ results: T[]; success: true; meta: Record<string, unknown> }> {
    const { columns, rows } = runPrepared(this.raw, { sql: this.sql, params: this.params })
    const results = rows.map((r) => rowToObject(columns, r) as T)
    return Promise.resolve({ results, success: true, meta: {} })
  }

  run(): Promise<{ success: true; meta: Record<string, unknown> }> {
    runPrepared(this.raw, { sql: this.sql, params: this.params })
    return Promise.resolve({ success: true, meta: {} })
  }
}

export interface FakeD1 {
  prepare(sql: string): FakeStatement
  exec(sql: string): Promise<void>
  _raw: SqlJsDatabase
}

export async function createTestD1(): Promise<FakeD1> {
  const SQL = await getSqlJs()
  const raw = new SQL.Database()
  // Ensure foreign key enforcement matches D1's default posture
  raw.exec('PRAGMA foreign_keys = ON;')
  return {
    prepare(sql: string) {
      return new FakeStatement(raw, sql)
    },
    exec(sql: string) {
      raw.exec(sql)
      return Promise.resolve()
    },
    _raw: raw,
  }
}

export function loadSqlFile(relativePath: string): string {
  const base = dirname(fileURLToPath(import.meta.url))
  const full = join(base, '..', '..', '..', relativePath)
  return readFileSync(full, 'utf-8')
}

/**
 * Type assertion helper: the FakeD1 implements enough of D1Database for
 * our query helpers. Cast at the call site.
 */
export function asD1(fake: FakeD1): D1Database {
  return fake as unknown as D1Database
}
