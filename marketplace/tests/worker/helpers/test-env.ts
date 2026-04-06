/**
 * Shared test harness: fresh D1 + R2 + Env for worker route tests.
 */
import { asD1, createTestD1, loadSqlFile, type FakeD1 } from './d1-adapter'
import { asR2Bucket, createTestR2, type FakeR2 } from './r2-adapter'
import type { Env } from '../../../worker/types'

const schemaSql = loadSqlFile('worker/db/schema.sql')
const seedSql = loadSqlFile('worker/db/seed.sql')

export interface TestHarness {
  env: Env
  db: FakeD1
  bucket: FakeR2
}

export async function createTestHarness(opts: { withSeed?: boolean } = {}): Promise<TestHarness> {
  const db = await createTestD1()
  await db.exec(schemaSql)
  if (opts.withSeed !== false) {
    await db.exec(seedSql)
  }
  const bucket = createTestR2()
  const env: Env = {
    DB: asD1(db),
    BUCKET: asR2Bucket(bucket),
    ADMIN_TOKEN: 'test-admin-token',
    SESSION_SECRET: 'test-session-secret',
    ENVIRONMENT: 'test',
    ALLOWED_ORIGINS: 'http://localhost:5174,http://localhost:5175',
  }
  return { env, db, bucket }
}

export function createExecutionContext(): ExecutionContext {
  return {
    waitUntil() {},
    passThroughOnException() {},
    props: {},
  } as unknown as ExecutionContext
}
