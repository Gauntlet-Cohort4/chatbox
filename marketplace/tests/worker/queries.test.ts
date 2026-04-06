import { beforeEach, describe, expect, it } from 'vitest'
import {
  authQueries,
  pluginQueries,
  reportQueries,
  reviewQueries,
  teacherPluginQueries,
  teacherQueries,
  type PluginRow,
} from '../../worker/db/queries'
import { asD1, createTestD1, loadSqlFile, type FakeD1 } from './helpers/d1-adapter'

const schemaSql = loadSqlFile('worker/db/schema.sql')
const seedSql = loadSqlFile('worker/db/seed.sql')

function makePluginRow(overrides: Partial<PluginRow> = {}): PluginRow {
  return {
    pluginId: 'p_test',
    pluginName: 'Test Plugin',
    description: 'A test plugin',
    version: '1.0.0',
    author: 'Tester',
    authorEmail: null,
    category: 'Math',
    contentRating: 'educational',
    toolDefinitions: '[]',
    userInterfaceConfig: '{}',
    authenticationConfig: '{"authType":"none"}',
    contextPrompt: null,
    capabilities: '{}',
    bundleUrl: 'bundles/p_test/1.0.0/bundle.zip',
    bundleVersion: '1.0.0',
    bundleHash: 'hash',
    bundleSizeBytes: 1000,
    screenshotKey: null,
    submissionStatus: 'approved',
    submittedAt: 1000,
    reviewedAt: 1100,
    reviewedBy: 'admin',
    rejectionReason: null,
    averageRating: 4.5,
    totalRatings: 2,
    totalReports: 0,
    ...overrides,
  }
}

async function freshDb(withSeed = true): Promise<FakeD1> {
  const fake = await createTestD1()
  await fake.exec(schemaSql)
  if (withSeed) {
    await fake.exec(seedSql)
  }
  return fake
}

// ─── schema + seed sanity ────────────────────────────────────────────────────

describe('schema.sql', () => {
  it('executes without errors on a fresh database', async () => {
    const fake = await createTestD1()
    await expect(fake.exec(schemaSql)).resolves.toBeUndefined()
  })

  it('seed.sql inserts all sample data without constraint violations', async () => {
    const fake = await freshDb()
    const { total } = await pluginQueries.listApproved(asD1(fake), { limit: 100 })
    expect(total).toBe(8) // 8 approved plugins in seed
  })

  it('enforces FK constraints on reviews (inserting review for non-existent plugin fails)', async () => {
    const fake = await freshDb(false)
    // Insert teacher but no plugin
    await teacherQueries.register(asD1(fake), {
      teacherId: 't1',
      teacherName: 'T',
      joinCode: 'XXXXXX',
      apiToken: 'tok',
      createdAt: 1,
    })
    await expect(
      reviewQueries.insert(asD1(fake), {
        reviewId: 'r1',
        pluginId: 'nonexistent',
        teacherId: 't1',
        rating: 5,
        reviewText: null,
        createdAt: 1,
      })
    ).rejects.toThrow()
  })

  it('enforces UNIQUE(pluginId, teacherId) on reviews', async () => {
    const fake = await freshDb()
    await reviewQueries.insert(asD1(fake), {
      reviewId: 'r_a',
      pluginId: 'chess',
      teacherId: 'teacher_alice',
      rating: 3,
      reviewText: null,
      createdAt: 5000,
    }).catch(() => {}) // seed already has this combo — second insert should throw
    // Now attempt a duplicate explicitly
    await expect(
      reviewQueries.insert(asD1(fake), {
        reviewId: 'r_dup',
        pluginId: 'chess',
        teacherId: 'teacher_alice',
        rating: 2,
        reviewText: null,
        createdAt: 6000,
      })
    ).rejects.toThrow()
  })

  it('rejects ratings outside 1-5 via CHECK constraint', async () => {
    const fake = await freshDb()
    await expect(
      reviewQueries.insert(asD1(fake), {
        reviewId: 'r_bad',
        pluginId: 'chess',
        teacherId: 'teacher_bob',
        rating: 6,
        reviewText: null,
        createdAt: 1,
      })
    ).rejects.toThrow()
  })
})

// ─── pluginQueries ───────────────────────────────────────────────────────────

describe('pluginQueries', () => {
  let fake: FakeD1

  beforeEach(async () => {
    fake = await freshDb()
  })

  it('listApproved returns only approved plugins', async () => {
    const { rows, total } = await pluginQueries.listApproved(asD1(fake), { limit: 100 })
    expect(total).toBe(8)
    expect(rows.every((r) => r.pluginId !== 'pending-puzzle')).toBe(true)
  })

  it('listApproved filters by category', async () => {
    const { rows } = await pluginQueries.listApproved(asD1(fake), { category: 'Math', limit: 100 })
    expect(rows.length).toBe(2)
    expect(rows.every((r) => r.category === 'Math')).toBe(true)
  })

  it('listApproved filters by case-insensitive search', async () => {
    const { rows } = await pluginQueries.listApproved(asD1(fake), { search: 'WEATHER', limit: 100 })
    expect(rows.length).toBe(1)
    expect(rows[0].pluginId).toBe('weather-explorer')
  })

  it('listApproved sorts by newest', async () => {
    const { rows } = await pluginQueries.listApproved(asD1(fake), { sort: 'newest', limit: 100 })
    expect(rows[0].pluginId).toBe('code-sandbox') // latest submittedAt in seed
  })

  it('listApproved sorts by name', async () => {
    const { rows } = await pluginQueries.listApproved(asD1(fake), { sort: 'name', limit: 100 })
    const names = rows.map((r) => r.pluginName)
    const sorted = [...names].sort((a, b) => a.localeCompare(b))
    expect(names).toEqual(sorted)
  })

  it('listApproved paginates', async () => {
    const page1 = await pluginQueries.listApproved(asD1(fake), { page: 1, limit: 3 })
    const page2 = await pluginQueries.listApproved(asD1(fake), { page: 2, limit: 3 })
    expect(page1.rows.length).toBe(3)
    expect(page2.rows.length).toBe(3)
    expect(page1.total).toBe(8)
    expect(page1.rows[0].pluginId).not.toBe(page2.rows[0].pluginId)
  })

  it('getApprovedById returns null for pending plugin', async () => {
    const row = await pluginQueries.getApprovedById(asD1(fake), 'pending-puzzle')
    expect(row).toBeNull()
  })

  it('getApprovedById returns full row for approved plugin', async () => {
    const row = await pluginQueries.getApprovedById(asD1(fake), 'chess')
    expect(row).not.toBeNull()
    expect(row?.pluginName).toBe('Chess Tutor')
  })

  it('insert adds a new plugin', async () => {
    await pluginQueries.insert(asD1(fake), makePluginRow({ pluginId: 'new_plugin' }))
    const row = await pluginQueries.getById(asD1(fake), 'new_plugin')
    expect(row?.pluginName).toBe('Test Plugin')
  })

  it('updateStatus changes submission status', async () => {
    await pluginQueries.updateStatus(asD1(fake), 'pending-puzzle', 'approved', { reviewedBy: 'admin' })
    const row = await pluginQueries.getById(asD1(fake), 'pending-puzzle')
    expect(row?.submissionStatus).toBe('approved')
    expect(row?.reviewedBy).toBe('admin')
  })

  it('listPending returns only pending plugins', async () => {
    const rows = await pluginQueries.listPending(asD1(fake))
    expect(rows.length).toBe(1)
    expect(rows[0].pluginId).toBe('pending-puzzle')
  })

  it('categoryCounts returns counts for approved plugins only', async () => {
    const counts = await pluginQueries.categoryCounts(asD1(fake))
    const map = Object.fromEntries(counts.map((c) => [c.category, c.count]))
    expect(map.Math).toBe(2)
    expect(map.Misc).toBeUndefined() // pending-puzzle excluded
  })

  it('updateAggregateRating recalculates from reviews', async () => {
    await pluginQueries.updateAggregateRating(asD1(fake), 'chess')
    const row = await pluginQueries.getById(asD1(fake), 'chess')
    // Seed has 2 reviews for chess: ratings 5, 4 → avg 4.5
    expect(row?.averageRating).toBeCloseTo(4.5)
    expect(row?.totalRatings).toBe(2)
  })

  it('incrementReportCount increments totalReports', async () => {
    await pluginQueries.incrementReportCount(asD1(fake), 'chess')
    const row = await pluginQueries.getById(asD1(fake), 'chess')
    expect(row?.totalReports).toBe(1)
  })
})

// ─── reviewQueries ───────────────────────────────────────────────────────────

describe('reviewQueries', () => {
  it('listByPlugin returns reviews with teacher name', async () => {
    const fake = await freshDb()
    const { rows, total } = await reviewQueries.listByPlugin(asD1(fake), 'chess')
    expect(total).toBe(2)
    expect(rows[0].teacherName).toBeTruthy()
  })

  it('getByTeacherAndPlugin returns existing review', async () => {
    const fake = await freshDb()
    const row = await reviewQueries.getByTeacherAndPlugin(asD1(fake), 'chess', 'teacher_alice')
    expect(row?.rating).toBe(5)
  })

  it('insert + update changes rating and sets updatedAt', async () => {
    const fake = await freshDb()
    await reviewQueries.update(asD1(fake), 'review_1', { rating: 3, reviewText: 'Changed my mind' })
    const row = await reviewQueries.getByTeacherAndPlugin(asD1(fake), 'chess', 'teacher_alice')
    expect(row?.rating).toBe(3)
    expect(row?.updatedAt).toBeGreaterThan(0)
  })

  it('ratingDistribution returns counts per star level', async () => {
    const fake = await freshDb()
    const dist = await reviewQueries.ratingDistribution(asD1(fake), 'chess')
    expect(dist[5]).toBe(1)
    expect(dist[4]).toBe(1)
    expect(dist[1]).toBe(0)
  })
})

// ─── reportQueries ───────────────────────────────────────────────────────────

describe('reportQueries', () => {
  it('listByStatus returns reports filtered by status', async () => {
    const fake = await freshDb()
    const open = await reportQueries.listByStatus(asD1(fake), 'open')
    expect(open.length).toBe(1)
    expect(open[0].pluginName).toBe('Color Mixer')
  })

  it('resolve sets reportStatus and resolution notes', async () => {
    const fake = await freshDb()
    await reportQueries.resolve(asD1(fake), 'report_1', {
      resolution: 'resolved',
      resolvedBy: 'admin',
      notes: 'Fixed in v0.6',
    })
    const resolved = await reportQueries.listByStatus(asD1(fake), 'resolved')
    expect(resolved.length).toBe(1)
    expect(resolved[0].resolutionNotes).toBe('Fixed in v0.6')
  })
})

// ─── teacherQueries ──────────────────────────────────────────────────────────

describe('teacherQueries', () => {
  it('register + getByToken round-trips', async () => {
    const fake = await freshDb(false)
    await teacherQueries.register(asD1(fake), {
      teacherId: 'new_t',
      teacherName: 'New Teacher',
      joinCode: 'ZZZZZZ',
      apiToken: 'tok_xyz',
      createdAt: Date.now(),
    })
    const row = await teacherQueries.getByToken(asD1(fake), 'tok_xyz')
    expect(row?.teacherName).toBe('New Teacher')
  })

  it('getByJoinCode finds teacher', async () => {
    const fake = await freshDb()
    const row = await teacherQueries.getByJoinCode(asD1(fake), 'ALPHA1')
    expect(row?.teacherId).toBe('teacher_alice')
  })

  it('joinCode UNIQUE constraint prevents duplicates', async () => {
    const fake = await freshDb()
    await expect(
      teacherQueries.register(asD1(fake), {
        teacherId: 'dup_t',
        teacherName: 'Dup',
        joinCode: 'ALPHA1', // already taken
        apiToken: 'tok_dup',
        createdAt: 1,
      })
    ).rejects.toThrow()
  })
})

// ─── teacherPluginQueries ────────────────────────────────────────────────────

describe('teacherPluginQueries', () => {
  it('add -> approve -> deploy -> revoke lifecycle', async () => {
    const fake = await freshDb()
    await teacherPluginQueries.add(asD1(fake), 'teacher_alice', 'chess')
    let row = await teacherPluginQueries.get(asD1(fake), 'teacher_alice', 'chess')
    expect(row?.status).toBe('pending_review')

    await teacherPluginQueries.approve(asD1(fake), 'teacher_alice', 'chess')
    row = await teacherPluginQueries.get(asD1(fake), 'teacher_alice', 'chess')
    expect(row?.status).toBe('approved')
    expect(row?.approvedAt).toBeGreaterThan(0)

    await teacherPluginQueries.deploy(asD1(fake), 'teacher_alice', 'chess')
    row = await teacherPluginQueries.get(asD1(fake), 'teacher_alice', 'chess')
    expect(row?.status).toBe('deployed')

    await teacherPluginQueries.revoke(asD1(fake), 'teacher_alice', 'chess')
    row = await teacherPluginQueries.get(asD1(fake), 'teacher_alice', 'chess')
    expect(row?.status).toBe('revoked')
  })

  it('remove deletes the junction row', async () => {
    const fake = await freshDb()
    await teacherPluginQueries.add(asD1(fake), 'teacher_alice', 'chess')
    await teacherPluginQueries.remove(asD1(fake), 'teacher_alice', 'chess')
    const row = await teacherPluginQueries.get(asD1(fake), 'teacher_alice', 'chess')
    expect(row).toBeNull()
  })

  it('listByTeacher returns joined plugin metadata', async () => {
    const fake = await freshDb()
    await teacherPluginQueries.add(asD1(fake), 'teacher_alice', 'chess')
    await teacherPluginQueries.add(asD1(fake), 'teacher_alice', 'word-weaver')
    const rows = await teacherPluginQueries.listByTeacher(asD1(fake), 'teacher_alice')
    expect(rows.length).toBe(2)
    expect(rows.every((r) => r.pluginName != null)).toBe(true)
  })

  it('listDeployed returns only deployed plugins for that teacher', async () => {
    const fake = await freshDb()
    await teacherPluginQueries.add(asD1(fake), 'teacher_alice', 'chess')
    await teacherPluginQueries.add(asD1(fake), 'teacher_alice', 'word-weaver')
    await teacherPluginQueries.approve(asD1(fake), 'teacher_alice', 'chess')
    await teacherPluginQueries.deploy(asD1(fake), 'teacher_alice', 'chess')
    const deployed = await teacherPluginQueries.listDeployed(asD1(fake), 'teacher_alice')
    expect(deployed.length).toBe(1)
    expect(deployed[0].pluginId).toBe('chess')
  })
})

// ─── authQueries ─────────────────────────────────────────────────────────────

describe('authQueries', () => {
  it('createCode + consumeCode marks as used', async () => {
    const fake = await freshDb()
    await authQueries.createCode(asD1(fake), 'C1', 'teacher_alice', Date.now() + 60_000)
    const row = await authQueries.consumeCode(asD1(fake), 'C1')
    expect(row?.used).toBe(0) // returns pre-update state
    // Now the row should be marked used
    const after = await asD1(fake).prepare('SELECT * FROM exchange_codes WHERE code = ?').bind('C1').first<{ used: number }>()
    expect(after?.used).toBe(1)
  })

  it('consumeCode returns null for unknown code', async () => {
    const fake = await freshDb()
    const row = await authQueries.consumeCode(asD1(fake), 'UNKNOWN')
    expect(row).toBeNull()
  })

  it('createSession + getSession round-trip', async () => {
    const fake = await freshDb()
    await authQueries.createSession(asD1(fake), 'sess1', 'teacher_alice', Date.now() + 1000)
    const row = await authQueries.getSession(asD1(fake), 'sess1')
    expect(row?.teacherId).toBe('teacher_alice')
  })

  it('deleteExpiredSessions removes only expired', async () => {
    const fake = await freshDb()
    await authQueries.createSession(asD1(fake), 'old', 'teacher_alice', 1)
    await authQueries.createSession(asD1(fake), 'new', 'teacher_alice', Date.now() + 60_000)
    await authQueries.deleteExpiredSessions(asD1(fake), Date.now())
    expect(await authQueries.getSession(asD1(fake), 'old')).toBeNull()
    expect(await authQueries.getSession(asD1(fake), 'new')).not.toBeNull()
  })

  it('deleteExpiredCodes removes only expired', async () => {
    const fake = await freshDb()
    await authQueries.createCode(asD1(fake), 'expired', 'teacher_alice', 1)
    await authQueries.createCode(asD1(fake), 'valid', 'teacher_alice', Date.now() + 60_000)
    await authQueries.deleteExpiredCodes(asD1(fake), Date.now())
    const expired = await asD1(fake).prepare('SELECT * FROM exchange_codes WHERE code = ?').bind('expired').first()
    const valid = await asD1(fake).prepare('SELECT * FROM exchange_codes WHERE code = ?').bind('valid').first()
    expect(expired).toBeNull()
    expect(valid).not.toBeNull()
  })
})
