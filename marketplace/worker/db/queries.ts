/**
 * Prepared statement helpers for all D1 tables.
 *
 * Every function accepts a `D1Database` binding as its first argument and
 * returns typed results. Groupings mirror the domain routes.
 */

// ─── Row types ───────────────────────────────────────────────────────────────

export interface PluginRow {
  pluginId: string
  pluginName: string
  description: string
  version: string
  author: string
  authorEmail: string | null
  category: string
  contentRating: string
  toolDefinitions: string
  userInterfaceConfig: string
  authenticationConfig: string
  contextPrompt: string | null
  capabilities: string
  bundleUrl: string
  bundleVersion: string
  bundleHash: string
  bundleSizeBytes: number | null
  screenshotKey: string | null
  submissionStatus: string
  submittedAt: number
  reviewedAt: number | null
  reviewedBy: string | null
  rejectionReason: string | null
  averageRating: number
  totalRatings: number
  totalReports: number
}

export interface PluginListRow {
  pluginId: string
  pluginName: string
  description: string
  author: string
  category: string
  contentRating: string
  version: string
  averageRating: number
  totalRatings: number
  screenshotKey: string | null
  bundleSizeBytes: number | null
}

export interface ReviewRow {
  reviewId: string
  pluginId: string
  teacherId: string
  rating: number
  reviewText: string | null
  createdAt: number
  updatedAt: number | null
}

export interface ReviewWithTeacherRow extends ReviewRow {
  teacherName: string
}

export interface ReportRow {
  reportId: string
  pluginId: string
  reporterId: string
  reportReason: string
  reportDetails: string | null
  reportStatus: string
  createdAt: number
  resolvedAt: number | null
  resolvedBy: string | null
  resolutionNotes: string | null
}

export interface TeacherRow {
  teacherId: string
  teacherName: string
  joinCode: string
  apiToken: string
  createdAt: number
}

export interface TeacherPluginRow {
  teacherId: string
  pluginId: string
  status: string
  addedAt: number
  approvedAt: number | null
  deployedAt: number | null
  revokedAt: number | null
}

export interface ExchangeCodeRow {
  code: string
  teacherId: string
  expiresAt: number
  used: number
}

export interface SessionRow {
  sessionId: string
  teacherId: string
  expiresAt: number
}

// ─── plugin queries ──────────────────────────────────────────────────────────

const LIST_COLS =
  'pluginId, pluginName, description, author, category, contentRating, version, averageRating, totalRatings, screenshotKey, bundleSizeBytes'

export type PluginSortKey = 'rating' | 'popular' | 'newest' | 'name'

export const pluginQueries = {
  async listApproved(
    db: D1Database,
    opts: {
      category?: string
      search?: string
      sort?: PluginSortKey
      page?: number
      limit?: number
    } = {}
  ): Promise<{ rows: PluginListRow[]; total: number }> {
    const page = Math.max(1, opts.page ?? 1)
    const limit = Math.min(100, Math.max(1, opts.limit ?? 24))
    const offset = (page - 1) * limit

    const where: string[] = ["submissionStatus = 'approved'"]
    const params: unknown[] = []

    if (opts.category && opts.category !== 'All') {
      where.push('category = ?')
      params.push(opts.category)
    }

    if (opts.search) {
      where.push('(LOWER(pluginName) LIKE ? OR LOWER(description) LIKE ?)')
      const needle = `%${opts.search.toLowerCase()}%`
      params.push(needle, needle)
    }

    const whereClause = `WHERE ${where.join(' AND ')}`
    const orderClause = orderByForSort(opts.sort ?? 'rating')

    const listStmt = db.prepare(
      `SELECT ${LIST_COLS} FROM plugins ${whereClause} ${orderClause} LIMIT ? OFFSET ?`
    )
    const countStmt = db.prepare(`SELECT COUNT(*) AS total FROM plugins ${whereClause}`)

    const listResult = await listStmt.bind(...params, limit, offset).all<PluginListRow>()
    const countResult = await countStmt.bind(...params).first<{ total: number }>()

    return {
      rows: listResult.results ?? [],
      total: countResult?.total ?? 0,
    }
  },

  async getById(db: D1Database, pluginId: string): Promise<PluginRow | null> {
    const row = await db.prepare('SELECT * FROM plugins WHERE pluginId = ?').bind(pluginId).first<PluginRow>()
    return row ?? null
  },

  async getApprovedById(db: D1Database, pluginId: string): Promise<PluginRow | null> {
    const row = await db
      .prepare("SELECT * FROM plugins WHERE pluginId = ? AND submissionStatus = 'approved'")
      .bind(pluginId)
      .first<PluginRow>()
    return row ?? null
  },

  async insert(db: D1Database, row: PluginRow): Promise<void> {
    await db
      .prepare(
        `INSERT INTO plugins (
          pluginId, pluginName, description, version, author, authorEmail,
          category, contentRating, toolDefinitions, userInterfaceConfig,
          authenticationConfig, contextPrompt, capabilities,
          bundleUrl, bundleVersion, bundleHash, bundleSizeBytes, screenshotKey,
          submissionStatus, submittedAt, reviewedAt, reviewedBy, rejectionReason,
          averageRating, totalRatings, totalReports
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
      )
      .bind(
        row.pluginId,
        row.pluginName,
        row.description,
        row.version,
        row.author,
        row.authorEmail,
        row.category,
        row.contentRating,
        row.toolDefinitions,
        row.userInterfaceConfig,
        row.authenticationConfig,
        row.contextPrompt,
        row.capabilities,
        row.bundleUrl,
        row.bundleVersion,
        row.bundleHash,
        row.bundleSizeBytes,
        row.screenshotKey,
        row.submissionStatus,
        row.submittedAt,
        row.reviewedAt,
        row.reviewedBy,
        row.rejectionReason,
        row.averageRating,
        row.totalRatings,
        row.totalReports
      )
      .run()
  },

  async updateStatus(
    db: D1Database,
    pluginId: string,
    status: 'approved' | 'rejected',
    opts: { reviewedBy: string; rejectionReason?: string | null }
  ): Promise<void> {
    await db
      .prepare(
        'UPDATE plugins SET submissionStatus = ?, reviewedAt = ?, reviewedBy = ?, rejectionReason = ? WHERE pluginId = ?'
      )
      .bind(status, Date.now(), opts.reviewedBy, opts.rejectionReason ?? null, pluginId)
      .run()
  },

  async updateAggregateRating(db: D1Database, pluginId: string): Promise<void> {
    await db
      .prepare(
        `UPDATE plugins
         SET averageRating = COALESCE((SELECT AVG(rating) FROM reviews WHERE pluginId = ?), 0),
             totalRatings = (SELECT COUNT(*) FROM reviews WHERE pluginId = ?)
         WHERE pluginId = ?`
      )
      .bind(pluginId, pluginId, pluginId)
      .run()
  },

  async incrementReportCount(db: D1Database, pluginId: string): Promise<void> {
    await db
      .prepare('UPDATE plugins SET totalReports = totalReports + 1 WHERE pluginId = ?')
      .bind(pluginId)
      .run()
  },

  async listPending(db: D1Database): Promise<PluginRow[]> {
    const result = await db
      .prepare("SELECT * FROM plugins WHERE submissionStatus = 'pending' ORDER BY submittedAt ASC")
      .all<PluginRow>()
    return result.results ?? []
  },

  async listByCategory(db: D1Database, category: string, excludeId?: string, limit = 6): Promise<PluginListRow[]> {
    const excludeClause = excludeId ? 'AND pluginId != ?' : ''
    const stmt = db.prepare(
      `SELECT ${LIST_COLS} FROM plugins
       WHERE submissionStatus = 'approved' AND category = ? ${excludeClause}
       ORDER BY averageRating DESC LIMIT ?`
    )
    const bound = excludeId ? stmt.bind(category, excludeId, limit) : stmt.bind(category, limit)
    const result = await bound.all<PluginListRow>()
    return result.results ?? []
  },

  async categoryCounts(db: D1Database): Promise<{ category: string; count: number }[]> {
    const result = await db
      .prepare(
        "SELECT category, COUNT(*) AS count FROM plugins WHERE submissionStatus = 'approved' GROUP BY category"
      )
      .all<{ category: string; count: number }>()
    return result.results ?? []
  },
}

function orderByForSort(sort: PluginSortKey): string {
  switch (sort) {
    case 'rating':
      return 'ORDER BY averageRating DESC, totalRatings DESC'
    case 'popular':
      return 'ORDER BY totalRatings DESC, averageRating DESC'
    case 'newest':
      return 'ORDER BY submittedAt DESC'
    case 'name':
      return 'ORDER BY pluginName COLLATE NOCASE ASC'
  }
}

// ─── review queries ──────────────────────────────────────────────────────────

export const reviewQueries = {
  async listByPlugin(
    db: D1Database,
    pluginId: string,
    opts: { page?: number; limit?: number } = {}
  ): Promise<{ rows: ReviewWithTeacherRow[]; total: number }> {
    const page = Math.max(1, opts.page ?? 1)
    const limit = Math.min(100, Math.max(1, opts.limit ?? 20))
    const offset = (page - 1) * limit

    const listResult = await db
      .prepare(
        `SELECT r.reviewId, r.pluginId, r.teacherId, r.rating, r.reviewText,
                r.createdAt, r.updatedAt, t.teacherName
         FROM reviews r
         JOIN teachers t ON t.teacherId = r.teacherId
         WHERE r.pluginId = ?
         ORDER BY r.createdAt DESC
         LIMIT ? OFFSET ?`
      )
      .bind(pluginId, limit, offset)
      .all<ReviewWithTeacherRow>()

    const countResult = await db
      .prepare('SELECT COUNT(*) AS total FROM reviews WHERE pluginId = ?')
      .bind(pluginId)
      .first<{ total: number }>()

    return { rows: listResult.results ?? [], total: countResult?.total ?? 0 }
  },

  async getByTeacherAndPlugin(
    db: D1Database,
    pluginId: string,
    teacherId: string
  ): Promise<ReviewRow | null> {
    const row = await db
      .prepare('SELECT * FROM reviews WHERE pluginId = ? AND teacherId = ?')
      .bind(pluginId, teacherId)
      .first<ReviewRow>()
    return row ?? null
  },

  async insert(db: D1Database, row: Omit<ReviewRow, 'updatedAt'>): Promise<void> {
    await db
      .prepare(
        'INSERT INTO reviews (reviewId, pluginId, teacherId, rating, reviewText, createdAt) VALUES (?,?,?,?,?,?)'
      )
      .bind(row.reviewId, row.pluginId, row.teacherId, row.rating, row.reviewText, row.createdAt)
      .run()
  },

  async update(
    db: D1Database,
    reviewId: string,
    changes: { rating: number; reviewText: string | null }
  ): Promise<void> {
    await db
      .prepare('UPDATE reviews SET rating = ?, reviewText = ?, updatedAt = ? WHERE reviewId = ?')
      .bind(changes.rating, changes.reviewText, Date.now(), reviewId)
      .run()
  },

  async ratingDistribution(db: D1Database, pluginId: string): Promise<Record<number, number>> {
    const result = await db
      .prepare('SELECT rating, COUNT(*) AS count FROM reviews WHERE pluginId = ? GROUP BY rating')
      .bind(pluginId)
      .all<{ rating: number; count: number }>()
    const distribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
    for (const row of result.results ?? []) {
      distribution[row.rating] = row.count
    }
    return distribution
  },
}

// ─── report queries ──────────────────────────────────────────────────────────

export const reportQueries = {
  async insert(db: D1Database, row: Omit<ReportRow, 'resolvedAt' | 'resolvedBy' | 'resolutionNotes'>): Promise<void> {
    await db
      .prepare(
        `INSERT INTO reports (reportId, pluginId, reporterId, reportReason, reportDetails, reportStatus, createdAt)
         VALUES (?,?,?,?,?,?,?)`
      )
      .bind(row.reportId, row.pluginId, row.reporterId, row.reportReason, row.reportDetails, row.reportStatus, row.createdAt)
      .run()
  },

  async listByStatus(db: D1Database, status?: 'open' | 'resolved'): Promise<(ReportRow & { pluginName: string })[]> {
    const where = status ? 'WHERE r.reportStatus = ?' : ''
    const stmt = db.prepare(
      `SELECT r.*, p.pluginName FROM reports r
       JOIN plugins p ON p.pluginId = r.pluginId
       ${where}
       ORDER BY r.createdAt DESC`
    )
    const bound = status ? stmt.bind(status) : stmt
    const result = await bound.all<ReportRow & { pluginName: string }>()
    return result.results ?? []
  },

  async resolve(
    db: D1Database,
    reportId: string,
    opts: { resolution: 'resolved' | 'dismissed'; resolvedBy: string; notes?: string | null }
  ): Promise<void> {
    await db
      .prepare(
        'UPDATE reports SET reportStatus = ?, resolvedAt = ?, resolvedBy = ?, resolutionNotes = ? WHERE reportId = ?'
      )
      .bind(opts.resolution, Date.now(), opts.resolvedBy, opts.notes ?? null, reportId)
      .run()
  },
}

// ─── teacher queries ─────────────────────────────────────────────────────────

export const teacherQueries = {
  async register(db: D1Database, row: TeacherRow): Promise<void> {
    await db
      .prepare(
        'INSERT INTO teachers (teacherId, teacherName, joinCode, apiToken, createdAt) VALUES (?,?,?,?,?)'
      )
      .bind(row.teacherId, row.teacherName, row.joinCode, row.apiToken, row.createdAt)
      .run()
  },

  async getById(db: D1Database, teacherId: string): Promise<TeacherRow | null> {
    const row = await db
      .prepare('SELECT * FROM teachers WHERE teacherId = ?')
      .bind(teacherId)
      .first<TeacherRow>()
    return row ?? null
  },

  async getByToken(db: D1Database, apiToken: string): Promise<TeacherRow | null> {
    const row = await db
      .prepare('SELECT * FROM teachers WHERE apiToken = ?')
      .bind(apiToken)
      .first<TeacherRow>()
    return row ?? null
  },

  async getByJoinCode(db: D1Database, joinCode: string): Promise<TeacherRow | null> {
    const row = await db
      .prepare('SELECT * FROM teachers WHERE joinCode = ?')
      .bind(joinCode)
      .first<TeacherRow>()
    return row ?? null
  },
}

// ─── teacher_plugin queries ──────────────────────────────────────────────────

export type TeacherPluginStatus = 'pending_review' | 'approved' | 'deployed' | 'revoked'

export const teacherPluginQueries = {
  async add(db: D1Database, teacherId: string, pluginId: string): Promise<void> {
    await db
      .prepare(
        "INSERT INTO teacher_plugins (teacherId, pluginId, status, addedAt) VALUES (?, ?, 'pending_review', ?)"
      )
      .bind(teacherId, pluginId, Date.now())
      .run()
  },

  async get(db: D1Database, teacherId: string, pluginId: string): Promise<TeacherPluginRow | null> {
    const row = await db
      .prepare('SELECT * FROM teacher_plugins WHERE teacherId = ? AND pluginId = ?')
      .bind(teacherId, pluginId)
      .first<TeacherPluginRow>()
    return row ?? null
  },

  async approve(db: D1Database, teacherId: string, pluginId: string): Promise<void> {
    await db
      .prepare(
        "UPDATE teacher_plugins SET status = 'approved', approvedAt = ? WHERE teacherId = ? AND pluginId = ?"
      )
      .bind(Date.now(), teacherId, pluginId)
      .run()
  },

  async deploy(db: D1Database, teacherId: string, pluginId: string): Promise<void> {
    await db
      .prepare(
        "UPDATE teacher_plugins SET status = 'deployed', deployedAt = ? WHERE teacherId = ? AND pluginId = ?"
      )
      .bind(Date.now(), teacherId, pluginId)
      .run()
  },

  async revoke(db: D1Database, teacherId: string, pluginId: string): Promise<void> {
    await db
      .prepare(
        "UPDATE teacher_plugins SET status = 'revoked', revokedAt = ? WHERE teacherId = ? AND pluginId = ?"
      )
      .bind(Date.now(), teacherId, pluginId)
      .run()
  },

  async remove(db: D1Database, teacherId: string, pluginId: string): Promise<void> {
    await db
      .prepare('DELETE FROM teacher_plugins WHERE teacherId = ? AND pluginId = ?')
      .bind(teacherId, pluginId)
      .run()
  },

  async listByTeacher(
    db: D1Database,
    teacherId: string
  ): Promise<(TeacherPluginRow & Pick<PluginRow, 'pluginName' | 'description' | 'author' | 'category' | 'averageRating' | 'screenshotKey'>)[]> {
    const result = await db
      .prepare(
        `SELECT tp.*, p.pluginName, p.description, p.author, p.category, p.averageRating, p.screenshotKey
         FROM teacher_plugins tp
         JOIN plugins p ON p.pluginId = tp.pluginId
         WHERE tp.teacherId = ?
         ORDER BY tp.addedAt DESC`
      )
      .bind(teacherId)
      .all<TeacherPluginRow & Pick<PluginRow, 'pluginName' | 'description' | 'author' | 'category' | 'averageRating' | 'screenshotKey'>>()
    return result.results ?? []
  },

  async listDeployed(db: D1Database, teacherId: string): Promise<PluginRow[]> {
    const result = await db
      .prepare(
        `SELECT p.* FROM teacher_plugins tp
         JOIN plugins p ON p.pluginId = tp.pluginId
         WHERE tp.teacherId = ? AND tp.status = 'deployed'`
      )
      .bind(teacherId)
      .all<PluginRow>()
    return result.results ?? []
  },
}

// ─── auth queries ────────────────────────────────────────────────────────────

export const authQueries = {
  async createCode(db: D1Database, code: string, teacherId: string, expiresAt: number): Promise<void> {
    await db
      .prepare('INSERT INTO exchange_codes (code, teacherId, expiresAt, used) VALUES (?, ?, ?, 0)')
      .bind(code, teacherId, expiresAt)
      .run()
  },

  async consumeCode(db: D1Database, code: string): Promise<ExchangeCodeRow | null> {
    const row = await db
      .prepare('SELECT * FROM exchange_codes WHERE code = ?')
      .bind(code)
      .first<ExchangeCodeRow>()
    if (!row) return null
    await db.prepare('UPDATE exchange_codes SET used = 1 WHERE code = ?').bind(code).run()
    return row
  },

  async createSession(db: D1Database, sessionId: string, teacherId: string, expiresAt: number): Promise<void> {
    await db
      .prepare('INSERT INTO sessions (sessionId, teacherId, expiresAt) VALUES (?, ?, ?)')
      .bind(sessionId, teacherId, expiresAt)
      .run()
  },

  async getSession(db: D1Database, sessionId: string): Promise<SessionRow | null> {
    const row = await db
      .prepare('SELECT * FROM sessions WHERE sessionId = ?')
      .bind(sessionId)
      .first<SessionRow>()
    return row ?? null
  },

  async deleteSession(db: D1Database, sessionId: string): Promise<void> {
    await db.prepare('DELETE FROM sessions WHERE sessionId = ?').bind(sessionId).run()
  },

  async deleteExpiredSessions(db: D1Database, now = Date.now()): Promise<void> {
    await db.prepare('DELETE FROM sessions WHERE expiresAt < ?').bind(now).run()
  },

  async deleteExpiredCodes(db: D1Database, now = Date.now()): Promise<void> {
    await db.prepare('DELETE FROM exchange_codes WHERE expiresAt < ?').bind(now).run()
  },
}
