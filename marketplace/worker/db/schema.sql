-- ChatBridge Marketplace D1 Schema
-- All timestamps are stored as INTEGER (Unix ms epoch).

-- plugins: marketplace catalog entries, submission lifecycle, and aggregates
CREATE TABLE IF NOT EXISTS plugins (
  pluginId TEXT PRIMARY KEY,
  pluginName TEXT NOT NULL,
  description TEXT NOT NULL,
  version TEXT NOT NULL,
  author TEXT NOT NULL,
  authorEmail TEXT,
  category TEXT NOT NULL,
  contentRating TEXT NOT NULL,
  toolDefinitions TEXT NOT NULL,
  userInterfaceConfig TEXT NOT NULL,
  authenticationConfig TEXT NOT NULL,
  contextPrompt TEXT,
  capabilities TEXT NOT NULL,
  bundleUrl TEXT NOT NULL,
  bundleVersion TEXT NOT NULL,
  bundleHash TEXT NOT NULL,
  bundleSizeBytes INTEGER,
  screenshotKey TEXT,
  submissionStatus TEXT NOT NULL DEFAULT 'pending',
  submittedAt INTEGER NOT NULL,
  reviewedAt INTEGER,
  reviewedBy TEXT,
  rejectionReason TEXT,
  averageRating REAL NOT NULL DEFAULT 0,
  totalRatings INTEGER NOT NULL DEFAULT 0,
  totalReports INTEGER NOT NULL DEFAULT 0
);

-- reviews: teacher ratings and comments
CREATE TABLE IF NOT EXISTS reviews (
  reviewId TEXT PRIMARY KEY,
  pluginId TEXT NOT NULL,
  teacherId TEXT NOT NULL,
  rating INTEGER NOT NULL CHECK(rating >= 1 AND rating <= 5),
  reviewText TEXT,
  createdAt INTEGER NOT NULL,
  updatedAt INTEGER,
  FOREIGN KEY (pluginId) REFERENCES plugins(pluginId),
  UNIQUE(pluginId, teacherId)
);

-- reports: abuse/quality reports filed against plugins
CREATE TABLE IF NOT EXISTS reports (
  reportId TEXT PRIMARY KEY,
  pluginId TEXT NOT NULL,
  reporterId TEXT NOT NULL,
  reportReason TEXT NOT NULL,
  reportDetails TEXT,
  reportStatus TEXT NOT NULL DEFAULT 'open',
  createdAt INTEGER NOT NULL,
  resolvedAt INTEGER,
  resolvedBy TEXT,
  resolutionNotes TEXT,
  FOREIGN KEY (pluginId) REFERENCES plugins(pluginId)
);

-- teachers: registered teacher accounts (join codes + api tokens)
CREATE TABLE IF NOT EXISTS teachers (
  teacherId TEXT PRIMARY KEY,
  teacherName TEXT NOT NULL,
  joinCode TEXT NOT NULL UNIQUE,
  apiToken TEXT NOT NULL,
  createdAt INTEGER NOT NULL
);

-- teacher_plugins: junction table for teacher classroom lifecycle
-- status transitions: pending_review -> approved -> deployed -> revoked (re-deploy allowed)
CREATE TABLE IF NOT EXISTS teacher_plugins (
  teacherId TEXT NOT NULL,
  pluginId TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending_review',
  addedAt INTEGER NOT NULL,
  approvedAt INTEGER,
  deployedAt INTEGER,
  revokedAt INTEGER,
  PRIMARY KEY (teacherId, pluginId),
  FOREIGN KEY (teacherId) REFERENCES teachers(teacherId),
  FOREIGN KEY (pluginId) REFERENCES plugins(pluginId)
);

-- exchange_codes: ephemeral one-time codes for ChatBridge -> marketplace auth
CREATE TABLE IF NOT EXISTS exchange_codes (
  code TEXT PRIMARY KEY,
  teacherId TEXT NOT NULL,
  expiresAt INTEGER NOT NULL,
  used INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (teacherId) REFERENCES teachers(teacherId)
);

-- sessions: HttpOnly cookie-backed teacher sessions
CREATE TABLE IF NOT EXISTS sessions (
  sessionId TEXT PRIMARY KEY,
  teacherId TEXT NOT NULL,
  expiresAt INTEGER NOT NULL,
  FOREIGN KEY (teacherId) REFERENCES teachers(teacherId)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_plugins_status ON plugins(submissionStatus);
CREATE INDEX IF NOT EXISTS idx_plugins_category ON plugins(category);
CREATE INDEX IF NOT EXISTS idx_plugins_rating ON plugins(averageRating);
CREATE INDEX IF NOT EXISTS idx_reviews_plugin ON reviews(pluginId);
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(reportStatus);
CREATE INDEX IF NOT EXISTS idx_teacher_plugins_teacher ON teacher_plugins(teacherId);
CREATE INDEX IF NOT EXISTS idx_teacher_plugins_status ON teacher_plugins(status);
CREATE INDEX IF NOT EXISTS idx_exchange_codes_expires ON exchange_codes(expiresAt);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expiresAt);
