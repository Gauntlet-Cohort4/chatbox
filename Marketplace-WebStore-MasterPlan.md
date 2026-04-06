# Marketplace WebStore MasterPlan

> **Project**: ChatBridge Marketplace WebStore
> **Format**: Phased build plan with TDD, file lists, context requirements, and review loops
> **Stack**: Cloudflare Pages + Workers + D1 + R2 · React 18 · Mantine UI · Tailwind CSS
> **Repo**: Same repo as ChatBridge — `/marketplace` directory, separate build (`pnpm run build:marketplace`)

---

## Table of Contents

- [Phase 0 — Project Scaffolding & Build Pipeline](#phase-0--project-scaffolding--build-pipeline)
- [Phase 1 — D1 Schema & Migrations](#phase-1--d1-schema--migrations)
- [Phase 2 — Worker API: Core CRUD](#phase-2--worker-api-core-crud)
- [Phase 3 — Worker API: Reviews, Reports & Admin](#phase-3--worker-api-reviews-reports--admin)
- [Phase 4 — Worker API: Teacher Accounts & Auth Flow](#phase-4--worker-api-teacher-accounts--auth-flow)
- [Phase 5 — Worker API: Teacher Catalog & Student Polling](#phase-5--worker-api-teacher-catalog--student-polling)
- [Phase 6 — R2 Integration: Bundles, Screenshots & Catalog JSON](#phase-6--r2-integration-bundles-screenshots--catalog-json)
- [Phase 7 — Marketplace Frontend: Shell, Routing & Layout](#phase-7--marketplace-frontend-shell-routing--layout)
- [Phase 8 — Screen 1: Browse / Home](#phase-8--screen-1-browse--home)
- [Phase 9 — Screen 2: Plugin Detail](#phase-9--screen-2-plugin-detail)
- [Phase 10 — Screen 3: My Classroom Dashboard](#phase-10--screen-3-my-classroom-dashboard)
- [Phase 11 — Screen 4: Developer Submission Form](#phase-11--screen-4-developer-submission-form)
- [Phase 12 — Screen 5: Admin Panel](#phase-12--screen-5-admin-panel)
- [Phase 13 — Auth Session Flow & Route Guards](#phase-13--auth-session-flow--route-guards)
- [Phase 14 — Integration Tests & End-to-End Flows](#phase-14--integration-tests--end-to-end-flows)
- [Phase 15 — Polish, Accessibility & Deployment](#phase-15--polish-accessibility--deployment)
- [Review Loop Protocol](#review-loop-protocol)
- [Appendix A — ChatBridge App Changes](#appendix-a--chatbridge-app-changes)
- [Appendix B — Cloudflare Free Tier Budget](#appendix-b--cloudflare-free-tier-budget)

---

## Phase 0 — Project Scaffolding & Build Pipeline

### Goal
Stand up the `/marketplace` directory with its own Vite + React build, independent from the ChatBridge app build, sharing design tokens and a Mantine/Tailwind config.

### Context Requirements
- Existing repo root `package.json` and `pnpm-workspace.yaml`
- Existing `--chatbox-*` CSS variable definitions
- Existing Tailwind and Mantine configs from `/src`

### Tasks

**0.1 — Directory structure**

```
/marketplace
├── src/
│   ├── main.tsx                  # React entry
│   ├── App.tsx                   # Router shell
│   ├── index.html                # HTML entry
│   ├── styles/
│   │   └── global.css            # Tailwind directives + chatbox token imports
│   ├── components/               # Shared UI components
│   ├── pages/                    # Route-level pages
│   ├── hooks/                    # Custom React hooks
│   ├── api/                      # API client functions
│   ├── types/                    # Shared TypeScript types
│   └── utils/                    # Utilities
├── worker/
│   ├── index.ts                  # Worker entry (itty-router)
│   ├── routes/                   # Route handlers by domain
│   │   ├── marketplace.ts        # Browse, detail, categories
│   │   ├── reviews.ts            # Review CRUD
│   │   ├── reports.ts            # Report CRUD
│   │   ├── admin.ts              # Admin endpoints
│   │   ├── teachers.ts           # Teacher account + catalog
│   │   └── auth.ts               # Exchange code flow
│   ├── middleware/
│   │   ├── auth.ts               # Session cookie + admin token validation
│   │   └── cors.ts               # CORS headers
│   ├── db/
│   │   ├── schema.sql            # D1 migration
│   │   └── queries.ts            # Prepared statement helpers
│   ├── r2/
│   │   └── storage.ts            # R2 put/get helpers
│   └── types.ts                  # Worker-side types (Env bindings, etc.)
├── tests/
│   ├── worker/                   # Worker unit/integration tests
│   └── ui/                       # Component tests
├── vite.config.ts                # Frontend build config
├── wrangler.toml                 # Worker + D1 + R2 bindings
├── tsconfig.json
└── package.json                  # Workspace package
```

**0.2 — Workspace integration**

Add `marketplace` to `pnpm-workspace.yaml`. Create `marketplace/package.json` with workspace dependencies.

**0.3 — Vite config**

Configure `marketplace/vite.config.ts` for React SPA build. Output to `marketplace/dist/`. Configure path aliases: `@marketplace/*` → `marketplace/src/*`.

**0.4 — Wrangler config**

Create `marketplace/wrangler.toml` with:
- D1 binding: `DB` → database name `marketplace-db`
- R2 binding: `BUCKET` → bucket name `marketplace-assets`
- Environment variables: `ADMIN_TOKEN` (secret), `SESSION_SECRET` (secret)
- Routes and compatibility flags

**0.5 — Build scripts**

Add to root `package.json`:
```json
{
  "build:marketplace": "pnpm --filter marketplace build",
  "dev:marketplace": "pnpm --filter marketplace dev",
  "dev:worker": "pnpm --filter marketplace worker:dev",
  "test:marketplace": "pnpm --filter marketplace test"
}
```

**0.6 — Shared types package**

Create `marketplace/src/types/plugin.ts` that re-exports the `PluginManifestSchema` Zod schema from the ChatBridge shared types (or duplicates the subset needed). This is the single source of truth for manifest shape across worker and frontend.

### Tests (TDD)
- `build:marketplace` completes without errors
- `dev:marketplace` starts Vite dev server
- TypeScript compilation passes with strict mode
- Tailwind processes `--chatbox-*` variables correctly

### Files Created
```
marketplace/package.json
marketplace/tsconfig.json
marketplace/vite.config.ts
marketplace/wrangler.toml
marketplace/src/main.tsx
marketplace/src/App.tsx
marketplace/src/index.html
marketplace/src/styles/global.css
marketplace/src/types/plugin.ts
marketplace/src/types/api.ts
marketplace/src/api/client.ts
marketplace/worker/index.ts
marketplace/worker/types.ts
```

---

## Phase 1 — D1 Schema & Migrations

### Goal
Create the D1 database schema, seed data, and query helper layer.

### Context Requirements
- Phase 0 complete (wrangler.toml with D1 binding)
- Database schema from handoff document

### Tasks

**1.1 — Migration SQL**

Create `marketplace/worker/db/schema.sql` with the full schema:

```sql
-- plugins table
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
  averageRating REAL DEFAULT 0,
  totalRatings INTEGER DEFAULT 0,
  totalReports INTEGER DEFAULT 0
);

-- reviews table
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

-- reports table
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

-- teachers table
CREATE TABLE IF NOT EXISTS teachers (
  teacherId TEXT PRIMARY KEY,
  teacherName TEXT NOT NULL,
  joinCode TEXT NOT NULL UNIQUE,
  apiToken TEXT NOT NULL,
  createdAt INTEGER NOT NULL
);

-- teacher_plugins junction table
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

-- exchange_codes table (ephemeral, for auth flow)
CREATE TABLE IF NOT EXISTS exchange_codes (
  code TEXT PRIMARY KEY,
  teacherId TEXT NOT NULL,
  expiresAt INTEGER NOT NULL,
  used INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (teacherId) REFERENCES teachers(teacherId)
);

-- sessions table (HttpOnly cookie sessions)
CREATE TABLE IF NOT EXISTS sessions (
  sessionId TEXT PRIMARY KEY,
  teacherId TEXT NOT NULL,
  expiresAt INTEGER NOT NULL,
  FOREIGN KEY (teacherId) REFERENCES teachers(teacherId)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_plugins_status ON plugins(submissionStatus);
CREATE INDEX IF NOT EXISTS idx_plugins_category ON plugins(category);
CREATE INDEX IF NOT EXISTS idx_reviews_plugin ON reviews(pluginId);
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(reportStatus);
CREATE INDEX IF NOT EXISTS idx_teacher_plugins_teacher ON teacher_plugins(teacherId);
CREATE INDEX IF NOT EXISTS idx_exchange_codes_expires ON exchange_codes(expiresAt);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expiresAt);
```

**1.2 — Query helpers**

Create `marketplace/worker/db/queries.ts` with prepared statement wrappers for every table. Each function accepts the D1 binding and returns typed results. Group by domain:

- `pluginQueries`: `listApproved`, `getById`, `insert`, `updateStatus`, `updateRating`, `listPending`, `listByCategory`
- `reviewQueries`: `listByPlugin`, `insert`, `update`, `getByTeacherAndPlugin`
- `reportQueries`: `insert`, `listOpen`, `resolve`
- `teacherQueries`: `register`, `getByToken`, `getById`, `getByJoinCode`
- `teacherPluginQueries`: `add`, `approve`, `deploy`, `revoke`, `remove`, `listByTeacher`, `listDeployed`
- `authQueries`: `createCode`, `consumeCode`, `createSession`, `getSession`, `deleteExpiredSessions`, `deleteExpiredCodes`

**1.3 — Seed data script**

Create `marketplace/worker/db/seed.sql` with 6–8 sample plugins across categories (Math, Science, CS, Art, Music, etc.) in `approved` status, plus one `pending` plugin. Include 2 sample teachers with join codes, a few reviews, and one open report. This enables frontend development without waiting for real submissions.

**1.4 — Migration runner**

Add script `marketplace/scripts/migrate.sh` that runs `wrangler d1 execute marketplace-db --file=./worker/db/schema.sql` for local and remote. Add `marketplace/scripts/seed.sh` for seed data.

### Tests (TDD)
- `schema.sql` executes without errors on a fresh D1 database (local via `wrangler d1 execute --local`)
- `seed.sql` inserts all sample data without constraint violations
- Each query helper returns correctly typed results against seeded data
- Foreign key constraints enforced (e.g., inserting a review for a non-existent pluginId fails)
- `UNIQUE(pluginId, teacherId)` constraint on reviews prevents duplicate reviews

### Files Created
```
marketplace/worker/db/schema.sql
marketplace/worker/db/seed.sql
marketplace/worker/db/queries.ts
marketplace/scripts/migrate.sh
marketplace/scripts/seed.sh
```

---

## Phase 2 — Worker API: Core CRUD

### Goal
Implement the public marketplace endpoints for browsing, searching, and plugin submission.

### Context Requirements
- Phase 1 complete (D1 schema + query helpers)
- Plugin manifest Zod schema from shared types
- itty-router installed

### Tasks

**2.1 — Worker entry & router**

Set up `marketplace/worker/index.ts` with itty-router. Wire up CORS middleware (allow marketplace origin + ChatBridge origin). Define `Env` type with D1, R2, and secret bindings.

**2.2 — CORS middleware**

`marketplace/worker/middleware/cors.ts` — handles preflight OPTIONS and adds headers. Allow credentials for session cookies.

**2.3 — GET /marketplace/plugins**

Returns paginated list of approved plugins. Query params: `category` (optional filter), `search` (optional full-text against `pluginName` + `description`), `sort` (`rating` | `popular` | `newest` | `name`), `page` (default 1), `limit` (default 24, max 100). Response includes total count for pagination.

Response shape:
```typescript
{
  plugins: PluginListItem[],
  total: number,
  page: number,
  limit: number
}
```

`PluginListItem` is a projection: `pluginId`, `pluginName`, `description`, `author`, `category`, `contentRating`, `version`, `averageRating`, `totalRatings`, `screenshotKey`, `bundleSizeBytes`.

**2.4 — GET /marketplace/plugins/:pluginId**

Returns full plugin details for an approved plugin. Includes everything from the `plugins` table. If the plugin is not approved, returns 404 (public users can't see pending/rejected plugins).

**2.5 — GET /marketplace/plugins/:pluginId/image**

Serves the screenshot image from R2. Reads `screenshotKey` from the plugin record, fetches from R2, streams with correct `Content-Type` and cache headers (`Cache-Control: public, max-age=86400`).

**2.6 — POST /marketplace/plugins**

Developer submission endpoint. Accepts `multipart/form-data` with:
- JSON fields matching the manifest schema (validated with Zod)
- `bundle` file (`.zip`, max 5MB)
- `screenshot` file (`.png` / `.jpg`, max 2MB)

Processing:
1. Validate manifest fields with Zod
2. Generate `pluginId` (nanoid)
3. Compute SHA-256 hash of bundle
4. Upload bundle to R2: `bundles/{pluginId}/{bundleVersion}/bundle.zip`
5. Upload screenshot to R2: `screenshots/{pluginId}/screenshot.png`
6. Insert into `plugins` table with `submissionStatus: 'pending'`
7. Return `{ pluginId, status: 'pending' }`

**2.7 — GET /marketplace/categories**

Returns the static category list with counts of approved plugins per category.

```typescript
{
  categories: { name: string, count: number }[]
}
```

### Tests (TDD)
- `GET /marketplace/plugins` returns only approved plugins (pending/rejected excluded)
- Category filter returns correct subset
- Search matches against name and description (case-insensitive)
- Sort orders work correctly (rating desc, newest desc, name asc)
- Pagination returns correct total and page window
- `GET /marketplace/plugins/:pluginId` returns 404 for pending plugin
- `GET /marketplace/plugins/:pluginId` returns full details for approved plugin
- `POST /marketplace/plugins` validates manifest fields (rejects invalid Zod input)
- `POST /marketplace/plugins` rejects oversized bundles (>5MB)
- `POST /marketplace/plugins` stores bundle and screenshot in R2
- `GET /marketplace/categories` returns counts only for approved plugins
- CORS preflight returns correct headers

### Files Created
```
marketplace/worker/index.ts          (updated)
marketplace/worker/middleware/cors.ts
marketplace/worker/routes/marketplace.ts
marketplace/tests/worker/marketplace.test.ts
```

---

## Phase 3 — Worker API: Reviews, Reports & Admin

### Goal
Implement review CRUD, report submission/resolution, and admin approval workflow.

### Context Requirements
- Phase 2 complete (core routes, router wired)
- Auth middleware not yet built — admin endpoints use `Authorization: Bearer {ADMIN_TOKEN}` header for now; teacher endpoints use session cookie (built in Phase 4, stub with middleware placeholder)

### Tasks

**3.1 — Auth middleware stubs**

Create `marketplace/worker/middleware/auth.ts` with:
- `requireAdmin(req, env)`: validates `Authorization: Bearer {ADMIN_TOKEN}` against `env.ADMIN_TOKEN`
- `requireTeacher(req, env)`: placeholder that reads session cookie, looks up session in D1, attaches `teacherId` to request. Returns 401 if invalid/expired. (Full implementation in Phase 4.)

**3.2 — GET /marketplace/plugins/:pluginId/reviews**

Returns paginated reviews for a plugin. Sorted newest first. Includes `teacherName` via join. Response shape:
```typescript
{
  reviews: { reviewId, teacherName, rating, reviewText, createdAt }[],
  total: number
}
```

**3.3 — POST /marketplace/plugins/:pluginId/reviews**

Teacher-authed. Body: `{ rating: 1-5, reviewText?: string }`. Validates rating range (Zod). Creates review with `reviewId` (nanoid). Recalculates plugin's `averageRating` and `totalRatings` via SQL aggregation and updates the `plugins` row. Returns 409 if teacher already reviewed this plugin.

**3.4 — PUT /marketplace/plugins/:pluginId/reviews**

Teacher-authed. Updates an existing review. Only the original teacher can update. Recalculates averages.

**3.5 — POST /marketplace/plugins/:pluginId/reports**

Teacher-authed. Body: `{ reportReason: string, reportDetails?: string }`. Creates report with `reportId` (nanoid). Increments `totalReports` on the plugin.

**3.6 — GET /admin/submissions**

Admin-authed. Returns all plugins with `submissionStatus: 'pending'`, sorted by `submittedAt` ascending (oldest first).

**3.7 — PUT /admin/submissions/:pluginId/approve**

Admin-authed. Sets `submissionStatus: 'approved'`, `reviewedAt: Date.now()`, `reviewedBy: 'admin'`.

**3.8 — PUT /admin/submissions/:pluginId/reject**

Admin-authed. Body: `{ rejectionReason: string }`. Sets `submissionStatus: 'rejected'`, `reviewedAt`, `reviewedBy`, `rejectionReason`.

**3.9 — GET /admin/reports**

Admin-authed. Returns all reports, optionally filtered by `status` query param (`open` | `resolved`). Includes plugin name via join.

**3.10 — PUT /admin/reports/:reportId**

Admin-authed. Body: `{ resolution: 'resolved' | 'dismissed', notes?: string }`. Sets `reportStatus`, `resolvedAt`, `resolvedBy`, `resolutionNotes`.

### Tests (TDD)
- Review creation returns 401 without valid session
- Review creation returns 409 for duplicate teacher+plugin
- Rating validation rejects 0 and 6
- Average rating recalculated correctly after insert/update
- Report creation increments `totalReports`
- Admin endpoints return 401 without admin token
- Admin endpoints return 401 with wrong admin token
- Approve changes status to `approved`
- Reject requires `rejectionReason`
- Report resolution sets all fields correctly

### Files Created
```
marketplace/worker/middleware/auth.ts
marketplace/worker/routes/reviews.ts
marketplace/worker/routes/reports.ts
marketplace/worker/routes/admin.ts
marketplace/tests/worker/reviews.test.ts
marketplace/tests/worker/admin.test.ts
```

---

## Phase 4 — Worker API: Teacher Accounts & Auth Flow

### Goal
Implement teacher registration, the exchange-code auth flow, and session management.

### Context Requirements
- Phase 3 complete (auth middleware stubs)
- Auth flow spec from handoff document

### Tasks

**4.1 — POST /teachers/register**

Body: `{ teacherName: string }`. Generates:
- `teacherId`: nanoid
- `joinCode`: 6-character uppercase alphanumeric, collision-checked against DB
- `apiToken`: 64-character crypto random hex

Inserts into `teachers` table. Returns `{ teacherId, joinCode, apiToken }`.

Note: In the ChatBridge app, this is called from the teacher's settings panel. The response is stored locally. The `apiToken` is never shown again — teacher must re-register if lost.

**4.2 — POST /auth/exchange-code**

Authed by `Authorization: Bearer {apiToken}`. Looks up teacher by token. Generates a one-time `code` (32-char crypto random), stores in `exchange_codes` with `expiresAt: Date.now() + 60_000` (60 seconds). Returns `{ code }`.

**4.3 — POST /auth/exchange**

Body: `{ code: string }`. Looks up code in `exchange_codes`:
- If not found or `used === 1`: return 401
- If `expiresAt < Date.now()`: delete code, return 401
- Otherwise: mark `used = 1`, create session in `sessions` table (`sessionId`: 64-char random, `expiresAt`: 8 hours from now), return `Set-Cookie: session={sessionId}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=28800`.

Delete the consumed code. Clean up any expired codes/sessions (background, non-blocking).

**4.4 — Complete auth middleware**

Flesh out `requireTeacher`:
1. Read `session` cookie from request
2. Look up in `sessions` table
3. If not found or expired: return 401 with `Set-Cookie` that clears the cookie
4. Attach `teacherId` to request context
5. Optionally refresh session expiry on each valid request (sliding window)

**4.5 — Session cleanup worker**

Add a scheduled handler (cron trigger, daily) to `marketplace/worker/index.ts`:
- Delete expired sessions from `sessions`
- Delete expired exchange codes from `exchange_codes`

### Tests (TDD)
- Registration generates unique join codes (run 100 registrations, no collisions)
- Registration returns all three identifiers
- Exchange code creation requires valid apiToken (401 otherwise)
- Exchange code expires after 60 seconds
- Exchange code can only be used once
- Session cookie is HttpOnly and Secure
- Session expires after 8 hours
- Expired session returns 401 and clears cookie
- Invalid session ID returns 401
- Cleanup deletes only expired records

### Files Created
```
marketplace/worker/routes/auth.ts
marketplace/worker/routes/teachers.ts
marketplace/worker/middleware/auth.ts    (updated)
marketplace/tests/worker/auth.test.ts
marketplace/tests/worker/teachers.test.ts
```

---

## Phase 5 — Worker API: Teacher Catalog & Student Polling

### Goal
Implement the teacher's plugin management lifecycle (add → approve → deploy → revoke) and the student-facing catalog endpoint.

### Context Requirements
- Phase 4 complete (teacher auth working)
- R2 bindings configured
- Teacher-to-student workflow from handoff document

### Tasks

**5.1 — GET /teachers/:teacherId/plugins**

Teacher-authed (session cookie). Validates that the session's `teacherId` matches the URL param (403 otherwise). Returns all plugins in `teacher_plugins` for that teacher, joined with `plugins` table for name/description/category/rating. Grouped by status: `pending_review`, `approved`, `deployed`, `revoked`.

**5.2 — POST /teachers/:teacherId/plugins/:pluginId**

Teacher-authed. Adds a plugin from the marketplace to the teacher's classroom. Inserts into `teacher_plugins` with `status: 'pending_review'`, `addedAt: Date.now()`. Returns 409 if already added. Returns 404 if pluginId doesn't exist or isn't approved.

**5.3 — PUT /teachers/:teacherId/plugins/:pluginId/approve**

Teacher-authed. Updates `status` to `approved`, sets `approvedAt`. Returns 400 if current status isn't `pending_review`.

**5.4 — PUT /teachers/:teacherId/plugins/:pluginId/deploy**

Teacher-authed. Updates `status` to `deployed`, sets `deployedAt`. Returns 400 if current status isn't `approved` and isn't `revoked` (re-deploy is allowed). Triggers catalog regeneration (Task 5.7).

**5.5 — PUT /teachers/:teacherId/plugins/:pluginId/revoke**

Teacher-authed. Updates `status` to `revoked`, sets `revokedAt`. Returns 400 if current status isn't `deployed`. Triggers catalog regeneration.

**5.6 — DELETE /teachers/:teacherId/plugins/:pluginId**

Teacher-authed. Removes the row entirely from `teacher_plugins`. If it was `deployed`, triggers catalog regeneration.

**5.7 — Catalog regeneration helper**

`marketplace/worker/r2/catalog.ts` — `regenerateCatalog(env, teacherId)`:

1. Look up teacher's `joinCode`
2. Query all `teacher_plugins` with `status: 'deployed'` joined with `plugins`
3. Build catalog JSON matching the ChatBridge plugin manifest array format:
```typescript
{
  catalogVersion: string,  // ISO timestamp
  joinCode: string,
  plugins: PluginManifest[]  // Full manifests for deployed plugins
}
```
4. Upload to R2: `catalogs/{joinCode}/catalog.json`
5. If no deployed plugins, upload an empty catalog (`plugins: []`)

**5.8 — GET /catalog/:joinCode**

Public endpoint (no auth). Fetches `catalogs/{joinCode}/catalog.json` from R2. Returns with `ETag` header from R2 object metadata. Supports `If-None-Match` → returns 304 if unchanged. Returns 404 if join code doesn't exist.

`Cache-Control: public, max-age=30` — student polls every 60s, 30s cache is fine.

### Tests (TDD)
- Teacher can only access their own plugins (403 for other teacherId)
- Status transitions enforce valid state machine:
  - `pending_review` → `approved` ✓
  - `approved` → `deployed` ✓
  - `deployed` → `revoked` ✓
  - `revoked` → `deployed` ✓ (re-deploy)
  - `pending_review` → `deployed` ✗ (400)
  - `approved` → `revoked` ✗ (400)
- Deploy generates correct catalog JSON in R2
- Revoke updates catalog (plugin removed)
- Delete of deployed plugin updates catalog
- `GET /catalog/:joinCode` returns 304 with matching ETag
- `GET /catalog/:joinCode` returns 404 for unknown join code
- Catalog JSON matches `PluginManifest[]` shape

### Files Created
```
marketplace/worker/routes/teachers.ts   (updated)
marketplace/worker/r2/catalog.ts
marketplace/tests/worker/teachers-catalog.test.ts
marketplace/tests/worker/student-polling.test.ts
```

---

## Phase 6 — R2 Integration: Bundles, Screenshots & Catalog JSON

### Goal
Implement the R2 storage abstraction layer and wire it into submission and image-serving endpoints.

### Context Requirements
- Phase 2 complete (submission endpoint uses R2)
- Phase 5 complete (catalog regeneration uses R2)
- R2 bucket bound as `BUCKET` in wrangler.toml

### Tasks

**6.1 — R2 storage helpers**

`marketplace/worker/r2/storage.ts`:

```typescript
// Bundle operations
putBundle(env, pluginId, version, file: ArrayBuffer): Promise<void>
getBundle(env, pluginId, version): Promise<R2ObjectBody | null>

// Screenshot operations
putScreenshot(env, pluginId, file: ArrayBuffer, contentType: string): Promise<void>
getScreenshot(env, pluginId): Promise<{ body: ReadableStream, contentType: string } | null>

// Catalog operations (already in catalog.ts, but re-export here)
putCatalog(env, joinCode, catalog: CatalogJSON): Promise<void>
getCatalog(env, joinCode): Promise<{ body: string, etag: string } | null>

// Cleanup
deletePluginAssets(env, pluginId): Promise<void>  // removes bundle + screenshot
```

**6.2 — Wire into POST /marketplace/plugins**

Update the submission route to use `putBundle` and `putScreenshot`. Set `bundleUrl` in the DB record to the R2 key path (not a full URL — the serving endpoint constructs the URL).

**6.3 — Wire into GET /marketplace/plugins/:pluginId/image**

Use `getScreenshot` to serve the image. Return 404 if no screenshot.

**6.4 — Bundle download endpoint**

Add `GET /marketplace/plugins/:pluginId/bundle` — serves the bundle zip from R2. Only for approved plugins. Streams the response. Sets `Content-Type: application/zip` and `Content-Disposition: attachment`.

**6.5 — R2 key validation**

Ensure all R2 keys are sanitized: `pluginId` and `joinCode` are validated as alphanumeric/nanoid format before constructing R2 paths. Prevents path traversal.

### Tests (TDD)
- `putBundle` stores at correct R2 key
- `getBundle` retrieves matching file
- `putScreenshot` stores at correct key
- `getScreenshot` returns correct content type
- `putCatalog` stores valid JSON
- `getCatalog` returns parsed JSON with etag
- `deletePluginAssets` removes both bundle and screenshot
- Path traversal attempts in pluginId rejected
- Bundle download returns 404 for pending plugins
- Bundle download streams correct content type

### Files Created
```
marketplace/worker/r2/storage.ts
marketplace/worker/routes/marketplace.ts   (updated)
marketplace/tests/worker/r2.test.ts
```

---

## Phase 7 — Marketplace Frontend: Shell, Routing & Layout

### Goal
Build the app shell with navigation, routing, auth state management, and responsive layout. This is the skeleton into which all 5 screens plug.

### Context Requirements
- Phase 0 complete (Vite build, Mantine/Tailwind config)
- All worker API endpoints defined (Phases 2–6)
- Auth flow spec (exchange code → session cookie)

### Tasks

**7.1 — API client**

`marketplace/src/api/client.ts` — fetch wrapper with:
- Base URL from env var (`VITE_API_URL`)
- `credentials: 'include'` for session cookies
- JSON request/response helpers
- Error handling: 401 → redirect to auth error page
- TypeScript response types for every endpoint

**7.2 — Auth state hook**

`marketplace/src/hooks/useAuth.ts`:
- On mount: call a lightweight `GET /auth/me` endpoint (add to worker — returns `{ teacherId, teacherName }` or 401)
- Stores auth state: `{ isAuthenticated, teacher: { teacherId, teacherName } | null, isLoading }`
- `logout()`: calls `POST /auth/logout` (clears session), resets state

Add `GET /auth/me` and `POST /auth/logout` to the worker auth routes.

**7.3 — Router setup**

`marketplace/src/App.tsx` using React Router v6:

```
/                         → Browse/Home (public)
/plugin/:pluginId         → Plugin Detail (public)
/classroom                → My Classroom Dashboard (teacher-authed)
/submit                   → Developer Submission Form (public)
/admin                    → Admin Panel (admin-authed)
```

**7.4 — Layout shell**

`marketplace/src/components/Layout.tsx`:
- Top navigation bar with: logo/title ("ChatBridge Marketplace"), nav links (Browse, Submit Plugin), auth-conditional links (My Classroom — teacher only, Admin — admin only), dark mode toggle
- Uses `--chatbox-*` CSS variables for colors
- Responsive: hamburger menu on mobile
- Sticky header, scrollable content area
- Footer: "Powered by TutorMeAI · ChatBridge"

**7.5 — Route guards**

`marketplace/src/components/AuthGuard.tsx`:
- Wraps authed routes
- Shows loading spinner during auth check
- Redirects to `/` with toast message if not authenticated
- `AdminGuard` variant checks for admin role (admin is identified by a separate mechanism — simplest: admin token entered in the admin page itself, stored in sessionStorage)

**7.6 — Toast/notification system**

Set up Mantine `Notifications` provider for success/error messages across the app.

**7.7 — Dark mode**

Read `--chatbox-*` dark mode variables. Add toggle in header. Persist preference in localStorage.

### Tests (TDD)
- API client includes credentials in requests
- API client redirects on 401
- Auth hook correctly identifies authenticated/unauthenticated states
- Route guard prevents access to `/classroom` when unauthenticated
- Route guard allows access to `/classroom` when authenticated
- Layout renders all nav links
- Dark mode toggle switches CSS variables
- Mobile layout shows hamburger menu

### Files Created
```
marketplace/src/App.tsx                    (updated)
marketplace/src/api/client.ts              (updated)
marketplace/src/hooks/useAuth.ts
marketplace/src/components/Layout.tsx
marketplace/src/components/AuthGuard.tsx
marketplace/src/components/AdminGuard.tsx
marketplace/worker/routes/auth.ts          (updated: /auth/me, /auth/logout)
marketplace/tests/ui/Layout.test.tsx
marketplace/tests/ui/AuthGuard.test.tsx
```

---

## Phase 8 — Screen 1: Browse / Home

### Goal
Build the marketplace browse page with search, category filtering, sorting, and a responsive plugin card grid. This is the landing page — it must feel polished and professional.

### Context Requirements
- Phase 7 complete (shell, router, API client)
- `GET /marketplace/plugins` endpoint (Phase 2)
- `GET /marketplace/categories` endpoint (Phase 2)
- Design spec from handoff document

### Tasks

**8.1 — Search bar component**

`marketplace/src/components/SearchBar.tsx`:
- Full-width, prominent, with search icon and clear button
- Debounced input (300ms) triggers re-fetch
- Placeholder: "Search educational plugins..."
- Focus ring uses `--chatbox-tint` color

**8.2 — Category pills component**

`marketplace/src/components/CategoryPills.tsx`:
- Horizontal scrollable row of pill buttons
- "All" pill selected by default
- Active pill uses `--chatbox-tint` fill with white text
- Inactive pills use subtle background
- Shows count badge on each pill: "Math (12)"
- Categories: All, Math, Science, English/Language Arts, History/Social Studies, Art, Music, Physical Education, Computer Science, Foreign Languages, Misc

**8.3 — Sort dropdown**

`marketplace/src/components/SortDropdown.tsx`:
- Mantine Select component
- Options: Highest Rated, Most Popular, Newest, Name A-Z
- Default: Highest Rated

**8.4 — Plugin card component**

`marketplace/src/components/PluginCard.tsx`:
- Screenshot image (top, 16:9 ratio, with fallback placeholder gradient)
- Plugin name (truncated to 1 line, bold)
- Author name (subtle text)
- Category badge (colored pill)
- Star rating display (filled/empty stars + numeric average + count)
- One-line description (truncated with ellipsis)
- "Add to Classroom" button (only shows if teacher is authenticated; otherwise "View Details")
- Hover: subtle elevation/shadow increase
- Click anywhere (except button) navigates to `/plugin/:pluginId`

**8.5 — Plugin grid**

`marketplace/src/components/PluginGrid.tsx`:
- CSS Grid: 3 columns desktop (>1024px), 2 columns tablet (>640px), 1 column mobile
- Gap spacing uses `--chatbox-spacing` tokens
- "Showing X plugins" count above grid
- Empty state: "No plugins found. Try a different search or category."

**8.6 — Browse page assembly**

`marketplace/src/pages/BrowsePage.tsx`:
- Composes: SearchBar → CategoryPills → SortDropdown + count → PluginGrid
- Manages state: `search`, `category`, `sort`, `page`
- Fetches from `GET /marketplace/plugins` with current filters
- URL query params sync: changing filters updates URL (`?category=Math&sort=newest`), loading page reads from URL
- Infinite scroll or pagination (pagination preferred for education context — teachers want to know how many pages)
- Loading skeleton cards while fetching

**8.7 — Star rating display component**

`marketplace/src/components/StarRating.tsx`:
- Renders 1–5 stars (SVG)
- Supports half-star display
- Shows numeric average and count: "★★★★☆ 4.2 (18 reviews)"

### Tests (TDD)
- Browse page renders grid of plugins
- Search filters results (debounced)
- Category filter updates grid
- Sort changes order
- Pagination shows correct page count
- Plugin card renders all fields
- Plugin card shows "Add to Classroom" for authenticated teachers
- Plugin card shows "View Details" for unauthenticated users
- Empty state renders when no results match
- URL query params sync with filter state
- Responsive layout at all breakpoints (3/2/1 columns)

### Files Created
```
marketplace/src/pages/BrowsePage.tsx
marketplace/src/components/SearchBar.tsx
marketplace/src/components/CategoryPills.tsx
marketplace/src/components/SortDropdown.tsx
marketplace/src/components/PluginCard.tsx
marketplace/src/components/PluginGrid.tsx
marketplace/src/components/StarRating.tsx
marketplace/tests/ui/BrowsePage.test.tsx
marketplace/tests/ui/PluginCard.test.tsx
```

---

## Phase 9 — Screen 2: Plugin Detail

### Goal
Build the full plugin detail page with screenshot, metadata, tabbed content (overview, reviews, technical), and action buttons.

### Context Requirements
- Phase 8 complete (browse page links here)
- `GET /marketplace/plugins/:pluginId` endpoint
- `GET /marketplace/plugins/:pluginId/reviews` endpoint
- Review/report POST endpoints (Phase 3)
- Auth state hook

### Tasks

**9.1 — Plugin detail page layout**

`marketplace/src/pages/PluginDetailPage.tsx`:
- Two-column layout on desktop: large screenshot (left, ~60%), metadata panel (right, ~40%)
- Single column on mobile: screenshot on top, metadata below
- Fetches plugin data on mount

**9.2 — Metadata panel**

`marketplace/src/components/PluginMetadata.tsx`:
- Plugin name (H1)
- Author name
- Version badge
- Category badge (colored)
- Content rating badge
- Star rating with distribution bars (5 bars showing count per star level)
- "Add to Classroom" button (teacher-authed, full width, prominent)
- "Report Plugin" text link (teacher-authed, subtle, below button)
- Bundle size display (formatted: "2.3 MB")

**9.3 — Rating distribution bars**

`marketplace/src/components/RatingDistribution.tsx`:
- 5 rows: "5 ★ ███████████ 42", "4 ★ ██████ 18", etc.
- Horizontal bar chart using CSS widths
- Percentage-based bar widths relative to max count

Note: This requires a new endpoint or extending the reviews endpoint to return rating counts per star level. Add `GET /marketplace/plugins/:pluginId/rating-distribution` to the worker (returns `{ distribution: { [1-5]: number } }`), or compute from reviews client-side if the review count is small enough (paginate all reviews). Recommended: add to the plugin detail endpoint response as `ratingDistribution`.

**9.4 — Tabbed content**

Three tabs using Mantine Tabs:

**Overview tab**: Full description (markdown rendered), tools list (name + description from `toolDefinitions`), capabilities summary (screenshot support, verbose state, event log), authentication requirements.

**Reviews tab**: Paginated review list. Each review shows teacher name, star rating, review text, date. "Write a Review" form at top (only for authenticated teachers who haven't reviewed yet): star selector (interactive 1–5) + text area + submit button.

**Technical tab**: Bundle size, sandbox permissions list, context prompt (code block), full manifest JSON (collapsible `<details>` block).

**9.5 — Similar plugins row**

`marketplace/src/components/SimilarPlugins.tsx`:
- Horizontal scrollable row of PluginCards
- Same category, excluding current plugin
- "Similar Plugins" heading
- Fetches from `GET /marketplace/plugins?category={currentCategory}&limit=6`

**9.6 — Report dialog**

`marketplace/src/components/ReportDialog.tsx`:
- Mantine Modal
- Report reason dropdown: "Inappropriate content", "Not educational", "Broken/non-functional", "Security concern", "Other"
- Details textarea (optional)
- Submit button → `POST /marketplace/plugins/:pluginId/reports`
- Success toast + dialog close

**9.7 — Review form**

`marketplace/src/components/ReviewForm.tsx`:
- Interactive star selector (hover highlights, click selects)
- Review text textarea (optional, max 500 chars, character count)
- Submit → `POST /marketplace/plugins/:pluginId/reviews`
- After submit: review appears in list, form hides
- Edit mode: if teacher already reviewed, show their review with "Edit" button

### Tests (TDD)
- Detail page fetches and renders plugin data
- 404 page shown for non-existent pluginId
- Screenshot renders with correct aspect ratio
- All three tabs render correct content
- Review form submits and adds review to list
- Review form hidden for unauthenticated users
- Star selector works (hover + click)
- Report dialog opens and submits
- Similar plugins shows correct category matches
- Rating distribution bars render proportionally
- Mobile layout stacks columns vertically

### Files Created
```
marketplace/src/pages/PluginDetailPage.tsx
marketplace/src/components/PluginMetadata.tsx
marketplace/src/components/RatingDistribution.tsx
marketplace/src/components/SimilarPlugins.tsx
marketplace/src/components/ReportDialog.tsx
marketplace/src/components/ReviewForm.tsx
marketplace/src/components/ReviewList.tsx
marketplace/src/components/PluginTabs.tsx
marketplace/tests/ui/PluginDetailPage.test.tsx
marketplace/tests/ui/ReviewForm.test.tsx
```

---

## Phase 10 — Screen 3: My Classroom Dashboard

### Goal
Build the teacher's classroom management page where they manage their plugin lifecycle: pending review → approved → deployed → revoked.

### Context Requirements
- Phase 7 complete (auth guard, teacher session)
- Phase 5 complete (teacher catalog endpoints)
- Teacher-to-student workflow from handoff document

### Tasks

**10.1 — Dashboard page**

`marketplace/src/pages/ClassroomPage.tsx`:
- Protected by AuthGuard
- Fetches `GET /teachers/:teacherId/plugins` on mount
- Organizes plugins into 4 status sections

**10.2 — Join code display**

`marketplace/src/components/JoinCodeDisplay.tsx`:
- Prominent card at top of dashboard
- Shows: "Share this code with your students"
- Large monospace code display: "ABC123"
- Copy button (copies to clipboard, shows "Copied!" toast)
- Subtle info text: "Students enter this code once in their ChatBridge app to receive your deployed plugins."

**10.3 — Status sections**

`marketplace/src/components/ClassroomSection.tsx`:
- Reusable section component with title, count badge, and plugin list
- Sections in order:
  1. **Pending Review** (⏳) — "Download and inspect these plugins before approving"
  2. **Approved** (✓) — "Ready to deploy to students"
  3. **Deployed** (🟢) — "Live and available to students"
  4. **Revoked** (⛔) — "Removed from students. Re-deploy or delete."

**10.4 — Classroom plugin card**

`marketplace/src/components/ClassroomPluginCard.tsx`:
- Compact horizontal card (not the browse grid card)
- Shows: screenshot thumbnail, name, author, category badge, status badge
- Action buttons vary by status:
  - `pending_review`: "Approve" (green), "Remove" (red text)
  - `approved`: "Deploy to Students" (primary), "Remove"
  - `deployed`: "Revoke" (warning/orange)
  - `revoked`: "Re-deploy" (primary), "Remove"
- Confirmation dialog for destructive actions (Revoke, Remove)
- Loading state on buttons during API call

**10.5 — Status transitions**

Wire each action button to the corresponding API endpoint:
- Approve → `PUT /teachers/:teacherId/plugins/:pluginId/approve`
- Deploy → `PUT /teachers/:teacherId/plugins/:pluginId/deploy`
- Revoke → `PUT /teachers/:teacherId/plugins/:pluginId/revoke`
- Remove → `DELETE /teachers/:teacherId/plugins/:pluginId`

After each action: refetch the plugin list to update the UI. Show success/error toast.

**10.6 — Empty state**

If no plugins at all: "Your classroom is empty. Browse the marketplace to find plugins for your students." with a link to `/`.

**10.7 — Revoked countdown**

For revoked plugins: show "Auto-deletes from student devices in X days" based on `revokedAt + 30 days`. This is informational only — the actual cleanup happens client-side in ChatBridge.

### Tests (TDD)
- Dashboard redirects to `/` if unauthenticated
- Dashboard fetches teacher's plugins on mount
- Plugins organized into correct sections by status
- Join code displays and copy works
- Approve button transitions from pending_review → approved
- Deploy button transitions from approved → deployed
- Revoke button transitions from deployed → revoked
- Re-deploy button transitions from revoked → deployed
- Remove button deletes plugin from list
- Confirmation dialog shown for destructive actions
- Empty state renders with marketplace link
- Error toast shown on API failure

### Files Created
```
marketplace/src/pages/ClassroomPage.tsx
marketplace/src/components/JoinCodeDisplay.tsx
marketplace/src/components/ClassroomSection.tsx
marketplace/src/components/ClassroomPluginCard.tsx
marketplace/src/components/ConfirmDialog.tsx
marketplace/tests/ui/ClassroomPage.test.tsx
marketplace/tests/ui/ClassroomPluginCard.test.ts
```

---

## Phase 11 — Screen 4: Developer Submission Form

### Goal
Build the plugin submission form with file upload, manifest field entry, and client-side validation.

### Context Requirements
- Phase 6 complete (R2 upload via submission endpoint)
- Plugin manifest Zod schema
- `POST /marketplace/plugins` endpoint (Phase 2)

### Tasks

**11.1 — Submission page**

`marketplace/src/pages/SubmitPage.tsx`:
- Public page (no auth required — any developer can submit)
- Multi-section form with validation
- Submit button at bottom

**11.2 — Plugin info section**

Form fields:
- Plugin name (text input, required, max 80 chars)
- Description (textarea, required, max 2000 chars, character count)
- Category (select dropdown with all 10 categories, required)
- Content rating (radio group: Safe, Educational, General — with descriptions)

**11.3 — Technical section**

- Context prompt (textarea, optional, max 1000 chars — "System prompt instructions for the AI when your plugin is active")
- Tool definitions (structured form or JSON editor):
  - Option A (recommended for UX): Structured form with "Add Tool" button. Each tool: name (input), description (textarea), parameters (JSON schema editor or simplified key/type/required fields)
  - Option B: Raw JSON editor with Zod validation and live error display
  - Default to Option B with a "Switch to form view" toggle
- Capabilities checkboxes: "Supports Screenshot", "Supports Verbose State", "Supports Event Log"
- UI config: default width (number), default height (number), sandbox permissions (multi-select from known list: `allow-scripts`, `allow-forms`, `allow-popups`, `allow-same-origin`), isPersistent (checkbox)

**11.4 — File upload section**

- Bundle upload (drag & drop zone or click-to-browse):
  - Accepts `.zip` only
  - Max 5MB (client-side check + server-side validation)
  - Shows file name, size, and progress bar during upload
  - Validates: file exists, correct extension, under size limit
- Screenshot upload (drag & drop zone or click-to-browse):
  - Accepts `.png`, `.jpg`, `.jpeg`
  - Max 2MB
  - Shows image preview after selection
  - Recommended: "1280x720 or similar 16:9 ratio"

**11.5 — Auth config section**

- Auth type radio: None, API Key, OAuth2 PKCE
- Conditional fields:
  - API Key: key header name (input), instructions text (textarea)
  - OAuth2 PKCE: authorization URL, token URL, scopes (comma-separated), client ID (input)

**11.6 — Author info section**

- Author name (text input, required)
- Author email (email input, optional — "For review communication only, not displayed publicly")

**11.7 — Client-side validation**

Validate entire form against the `PluginManifestSchema` (Zod) before submission. Show inline field errors. Disable submit button until all required fields valid.

**11.8 — Submission flow**

1. Client builds `FormData` with JSON fields + file uploads
2. POST to `/marketplace/plugins`
3. Show progress overlay during upload
4. On success: navigate to confirmation page showing pluginId and "Your plugin has been submitted for review. You'll receive an email when it's approved."
5. On error: show error toast with server message, keep form populated

**11.9 — Confirmation page**

`marketplace/src/pages/SubmitConfirmationPage.tsx`:
- Success illustration/icon
- "Plugin Submitted!" heading
- Plugin name and ID
- Status: "Pending Review"
- "Submit Another" button, "Browse Marketplace" link

### Tests (TDD)
- Form validates required fields (name, description, category, content rating, author, bundle)
- Form rejects bundle over 5MB
- Form rejects non-zip bundle
- Form rejects screenshot over 2MB
- Auth config fields shown/hidden based on auth type selection
- Tool definition JSON validates against Zod schema
- Form submission sends correct FormData
- Confirmation page shows on success
- Error handling shows server error message
- File upload shows preview (screenshot) and file info (bundle)

### Files Created
```
marketplace/src/pages/SubmitPage.tsx
marketplace/src/pages/SubmitConfirmationPage.tsx
marketplace/src/components/FileUploadZone.tsx
marketplace/src/components/ToolDefinitionEditor.tsx
marketplace/src/components/AuthConfigFields.tsx
marketplace/src/components/SubmissionForm.tsx
marketplace/tests/ui/SubmitPage.test.tsx
marketplace/tests/ui/FileUploadZone.test.tsx
```

---

## Phase 12 — Screen 5: Admin Panel

### Goal
Build the admin panel with submission review and report management.

### Context Requirements
- Phase 3 complete (admin API endpoints)
- Admin auth: admin token entered on the admin page, stored in sessionStorage, sent as `Authorization: Bearer` header

### Tasks

**12.1 — Admin page**

`marketplace/src/pages/AdminPage.tsx`:
- Protected by AdminGuard
- If no admin token in sessionStorage: show token entry form (password input + "Enter" button)
- Once authenticated: two tabs — "Pending Submissions" and "Reports"

**12.2 — Admin auth**

Simple approach: admin enters the `ADMIN_TOKEN` value into a password field. Stored in sessionStorage (cleared on tab close). The API client sends it as `Authorization: Bearer` header for admin routes.

Validate on entry by calling `GET /admin/submissions` — if 401, show "Invalid token". If 200, store and show panel.

**12.3 — Submissions tab**

`marketplace/src/components/AdminSubmissions.tsx`:
- Table of pending submissions: plugin name, author, category, submitted date, bundle size
- Click row to expand inline detail panel (not a new page):
  - Full description
  - Tool definitions (formatted)
  - Capabilities
  - Auth config
  - Context prompt
  - Screenshot preview (loaded from R2)
  - Bundle download link
  - Sandboxed preview iframe (loads plugin bundle in a sandboxed iframe with `sandbox="allow-scripts"` — read-only preview, no postMessage bridge)
- Action buttons in expanded view:
  - "Approve" (green) — calls `PUT /admin/submissions/:pluginId/approve`, removes from list
  - "Reject" (red) — opens rejection reason modal (required text input), calls `PUT /admin/submissions/:pluginId/reject`, removes from list

**12.4 — Reports tab**

`marketplace/src/components/AdminReports.tsx`:
- Table of reports: plugin name, reporter, reason, date, status
- Filter by status: All, Open, Resolved
- Click row to expand:
  - Full report details
  - Link to plugin detail page
  - Resolution buttons:
    - "Resolve" — requires resolution notes textarea
    - "Dismiss" — optional notes
  - After action: report updates in table (don't remove — show new status)

**12.5 — Admin stats summary**

At the top of the admin page: quick stats cards showing "Pending Submissions: X", "Open Reports: X", "Total Approved Plugins: X", "Total Teachers: X". Fetched from a new `GET /admin/stats` endpoint.

Add `GET /admin/stats` to the worker: queries counts from all tables.

### Tests (TDD)
- Admin page shows token entry when no token stored
- Invalid token shows error
- Valid token shows admin panel
- Submissions table lists all pending plugins
- Row expand shows full details
- Approve removes from pending list
- Reject requires reason text
- Reports table lists reports
- Status filter works
- Resolve requires notes
- Dismiss works with optional notes
- Stats cards show correct counts

### Files Created
```
marketplace/src/pages/AdminPage.tsx
marketplace/src/components/AdminSubmissions.tsx
marketplace/src/components/AdminReports.tsx
marketplace/src/components/AdminStats.tsx
marketplace/src/components/AdminTokenEntry.tsx
marketplace/worker/routes/admin.ts             (updated: /admin/stats)
marketplace/tests/ui/AdminPage.test.tsx
marketplace/tests/worker/admin-stats.test.ts
```

---

## Phase 13 — Auth Session Flow & Route Guards

### Goal
Wire the complete exchange-code auth flow end-to-end, from the ChatBridge app trigger through to authenticated marketplace session.

### Context Requirements
- Phase 4 complete (worker auth endpoints)
- Phase 7 complete (auth hook, route guards)
- Auth flow spec from handoff document

### Tasks

**13.1 — Code exchange on page load**

`marketplace/src/hooks/useCodeExchange.ts`:
1. On app mount, check URL for `?code=TEMP123` query param
2. If present: call `POST /auth/exchange` with `{ code }`
3. On success: session cookie is set automatically (HttpOnly), remove code from URL via `history.replaceState`, trigger auth state refresh
4. On error (expired/invalid code): show toast "Session expired. Please try again from ChatBridge." and redirect to `/`
5. If no code param: skip (normal page load)

**13.2 — Auth state persistence**

The auth state (`useAuth` hook) relies on the session cookie. On page load:
1. First check for exchange code (13.1)
2. Then call `GET /auth/me` to verify session
3. If valid: populate teacher state
4. If 401: remain unauthenticated (public browsing is fine)

**13.3 — Session expiry handling**

If any API call returns 401 during an authenticated session:
1. Clear local auth state
2. Show toast: "Your session has expired. Please open the marketplace again from ChatBridge."
3. Keep current page (don't redirect — the page may still be useful in read-only mode)
4. Hide teacher-only UI elements (Add to Classroom buttons, Review form, etc.)

**13.4 — Logout**

Add "Sign out" option in header dropdown (teacher name → dropdown → Sign out):
1. Call `POST /auth/logout`
2. Server clears session cookie and deletes session from D1
3. Clear local auth state
4. Redirect to `/`

**13.5 — CSRF protection**

For all state-changing POST/PUT/DELETE requests from the marketplace frontend:
- Worker checks `Origin` header matches expected marketplace domain
- Rejects requests from unexpected origins
- This is sufficient because the session cookie is `SameSite=Lax`

### Tests (TDD)
- Code exchange sets session and clears URL param
- Expired code shows error toast
- Auth state populated after successful exchange
- 401 during session clears auth state
- Logout clears cookie and state
- CSRF: request from wrong origin rejected
- Public pages accessible without auth
- Teacher-only UI hidden when unauthenticated
- Multiple rapid exchanges don't create race conditions

### Files Created
```
marketplace/src/hooks/useCodeExchange.ts
marketplace/src/hooks/useAuth.ts            (updated)
marketplace/src/api/client.ts               (updated: 401 handling)
marketplace/worker/middleware/csrf.ts
marketplace/tests/ui/auth-flow.test.tsx
marketplace/tests/worker/csrf.test.ts
```

---

## Phase 14 — Integration Tests & End-to-End Flows

### Goal
Comprehensive integration tests covering all critical user journeys end-to-end.

### Context Requirements
- All phases 1–13 complete
- Vitest + testing-library configured
- Miniflare for local Worker testing

### Tasks

**14.1 — Test infrastructure**

Set up Miniflare-based test harness for Worker integration tests:
- In-memory D1 database with schema applied
- In-memory R2 bucket
- Helper to seed test data
- Helper to create authenticated sessions

**14.2 — Developer submission flow**

Test the complete journey:
1. Developer fills form and uploads bundle + screenshot
2. `POST /marketplace/plugins` succeeds → plugin in `pending` status
3. Plugin does NOT appear in `GET /marketplace/plugins` (approved only)
4. Admin approves → plugin appears in browse results
5. Plugin detail page loads with all data

**14.3 — Teacher classroom flow**

Test the complete journey:
1. Teacher registers → gets joinCode + apiToken
2. Teacher exchanges code → gets session
3. Teacher browses marketplace → adds plugin to classroom
4. Plugin appears in "Pending Review" section
5. Teacher approves → moves to "Approved"
6. Teacher deploys → moves to "Deployed"
7. Catalog JSON generated in R2 with correct manifest
8. Student polls `GET /catalog/{joinCode}` → receives deployed plugin
9. Teacher revokes → plugin removed from catalog
10. Student polls → gets updated catalog without plugin

**14.4 — Review and report flow**

1. Teacher writes review → average rating updated
2. Teacher updates review → average recalculated
3. Teacher reports plugin → report appears in admin panel
4. Admin resolves report → status changes

**14.5 — Auth edge cases**

1. Expired exchange code (>60s) → 401
2. Reused exchange code → 401
3. Expired session (>8h) → 401, cookie cleared
4. Concurrent sessions → both valid
5. Logout → session deleted, cookie cleared

**14.6 — Catalog ETag flow**

1. First request → 200 with ETag
2. Subsequent request with `If-None-Match` matching ETag → 304
3. Deploy new plugin → catalog regenerated → new ETag → 200

**14.7 — R2 asset flow**

1. Plugin submitted with bundle + screenshot
2. Bundle downloadable at correct endpoint
3. Screenshot served at correct endpoint
4. Plugin assets deleted when appropriate

**14.8 — Error handling**

1. Invalid Zod input → 400 with field errors
2. Non-existent pluginId → 404
3. Invalid status transition → 400
4. Teacher accessing another teacher's plugins → 403
5. Unauthenticated access to protected endpoint → 401
6. Rate limiting behavior (if implemented)

### Tests (TDD)
All of the above scenarios are the tests. Each task (14.2–14.8) produces a test file.

### Files Created
```
marketplace/tests/integration/setup.ts
marketplace/tests/integration/submission-flow.test.ts
marketplace/tests/integration/classroom-flow.test.ts
marketplace/tests/integration/review-report-flow.test.ts
marketplace/tests/integration/auth-edge-cases.test.ts
marketplace/tests/integration/catalog-etag.test.ts
marketplace/tests/integration/r2-assets.test.ts
marketplace/tests/integration/error-handling.test.ts
```

---

## Phase 15 — Polish, Accessibility & Deployment

### Goal
Final production polish: accessibility audit, performance optimization, responsive testing, and Cloudflare deployment.

### Context Requirements
- All phases 1–14 complete and passing
- Cloudflare account with Pages and Workers configured

### Tasks

**15.1 — Accessibility audit**

- All interactive elements have visible focus indicators
- Color contrast meets WCAG 2.1 AA (4.5:1 text, 3:1 UI)
- All images have alt text (screenshots: "Screenshot of {pluginName}")
- Form fields have associated labels
- Star rating is keyboard-navigable (arrow keys)
- Category pills navigable with keyboard
- Screen reader announcements for: status transitions, toast notifications, loading states
- Skip-to-content link
- Aria landmarks: banner, main, navigation, contentinfo

**15.2 — Performance optimization**

- Route-based code splitting with `React.lazy` + `Suspense`
- Screenshot images: lazy loading (`loading="lazy"`)
- Plugin list: virtual scrolling if >100 items (or rely on pagination)
- API responses: appropriate `Cache-Control` headers
  - Browse results: `max-age=60` (1 minute)
  - Plugin detail: `max-age=300` (5 minutes)
  - Categories: `max-age=3600` (1 hour)
  - Screenshots: `max-age=86400` (1 day)
- Bundle size audit: ensure Vite tree-shaking removes unused Mantine components

**15.3 — SEO & metadata**

- Page titles per route: "ChatBridge Marketplace", "{pluginName} — ChatBridge Marketplace", etc.
- Meta description tags
- Open Graph tags for plugin detail pages (shareable links)
- `robots.txt` allowing indexing of public pages

**15.4 — Error boundaries**

- Root error boundary with "Something went wrong" fallback
- Per-page error boundaries with retry buttons
- 404 page for unknown routes

**15.5 — Loading states**

- Skeleton screens for: plugin grid (cards), plugin detail, classroom dashboard
- Spinner for: form submissions, status transitions
- Progress bar for: file uploads

**15.6 — Responsive final pass**

Test all 5 screens at:
- Desktop: 1440px, 1280px, 1024px
- Tablet: 768px
- Mobile: 375px, 320px

Verify: no horizontal overflow, touch targets ≥44px, text readable, forms usable.

**15.7 — Cloudflare deployment**

Marketplace frontend (Cloudflare Pages):
- Build command: `cd marketplace && pnpm build`
- Output directory: `marketplace/dist`
- Custom domain or `marketplace-chatbridge.pages.dev`

Worker (Cloudflare Workers):
- `cd marketplace && npx wrangler deploy`
- Set secrets: `npx wrangler secret put ADMIN_TOKEN`, `npx wrangler secret put SESSION_SECRET`
- Create D1 database: `npx wrangler d1 create marketplace-db`
- Run migration: `npx wrangler d1 execute marketplace-db --file=./worker/db/schema.sql`
- Create R2 bucket: `npx wrangler r2 bucket create marketplace-assets`

**15.8 — Deployment verification**

Post-deploy checklist:
- [ ] Browse page loads with seed data
- [ ] Plugin detail page renders
- [ ] Developer submission form submits
- [ ] Exchange code flow works (test with ChatBridge)
- [ ] Teacher can manage classroom
- [ ] Student polling returns catalog
- [ ] Admin panel accessible with correct token
- [ ] Dark mode works
- [ ] Mobile layout works
- [ ] HTTPS enforced
- [ ] Session cookies are Secure + HttpOnly

### Tests (TDD)
- Lighthouse accessibility score ≥90
- All pages render at all breakpoints without overflow
- Error boundaries catch and display errors
- 404 page renders for unknown routes
- Code-split chunks load on navigation

### Files Created
```
marketplace/src/components/ErrorBoundary.tsx
marketplace/src/components/SkeletonCard.tsx
marketplace/src/components/SkeletonDetail.tsx
marketplace/src/pages/NotFoundPage.tsx
marketplace/public/robots.txt
marketplace/scripts/deploy.sh
```

---

## Review Loop Protocol

After completing each phase, run the **3x Review Loop** before proceeding:

### Pass 1 — Lint, Typecheck, Test
```bash
cd marketplace
pnpm run lint          # Biome
pnpm run typecheck     # tsc --noEmit
pnpm run test          # Vitest
```
All three must pass with zero errors. Fix any issues before Pass 2.

### Pass 2 — Data Flow Walkthrough

For each phase, trace a real user action through all layers:

**Worker phases (1–6)**: Trace from HTTP request → route handler → query helper → D1/R2 → response. Verify types match at every boundary. Verify error cases return correct status codes.

**Frontend phases (7–13)**: Trace from user interaction → component state → API call → response → state update → re-render. Verify loading/error/empty states all handled.

### Pass 3 — Integration Sanity

After the data flow walkthrough, run the specific phase's tests one more time and verify:
- No console errors in dev tools
- No TypeScript `any` escapes in new code
- No hardcoded URLs (use env vars)
- No leftover `console.log` statements
- All new components exported and imported correctly

### Phase Gate

A phase is complete when:
1. All three passes succeed
2. All files listed in the phase are created
3. Tests from the Tests (TDD) section all pass
4. No regressions in previous phases' tests

---

## Appendix A — ChatBridge App Changes

These are small changes to the ChatBridge app (`/src`), NOT part of the marketplace build. They should be implemented as a separate ticket after the marketplace is deployed.

**A.1 — "Browse Marketplace" button**

Location: Teacher's settings panel or app store tab.

Behavior:
1. Calls `POST /auth/exchange-code` with `Authorization: Bearer {apiToken}` (apiToken stored locally from registration)
2. Receives `{ code }`
3. Opens `https://marketplace-chatbridge.pages.dev/?code={code}` in system browser
4. Button shows spinner during code generation

**A.2 — Join code entry (student)**

Location: First launch flow or settings panel.

Behavior:
1. Text input: "Enter your teacher's code"
2. Validates format (6 chars, uppercase alphanumeric)
3. Stores in IndexedDB as `joinCode`
4. Immediately starts polling `GET /catalog/{joinCode}`
5. Shows "Connected to teacher's classroom" confirmation
6. Can be changed later in settings

**A.3 — Catalog polling**

Update the existing plugin system to:
1. Read `joinCode` from IndexedDB
2. Poll `GET /catalog/{joinCode}` every 60 seconds
3. Cache `ETag` — send as `If-None-Match`
4. On 304: no action
5. On 200: compare `catalogVersion`, if newer → download new/updated plugin bundles → update local plugin store
6. Handle removed plugins: mark as disabled, auto-delete after 30 days continuous disabled

---

## Appendix B — Cloudflare Free Tier Budget

| Resource | Free Tier Limit | Estimated Usage (200K users) | Headroom |
|----------|----------------|------------------------------|----------|
| Workers requests | 100,000/day | ~20,000/day (polling) | 5x |
| D1 rows read | 5,000,000/day | ~50,000/day (catalog + browse) | 100x |
| D1 rows written | 100,000/day | ~500/day (reviews, reports) | 200x |
| D1 storage | 5 GB | ~10 MB (metadata) | 500x |
| R2 storage | 10 GB | ~2 GB (bundles + screenshots) | 5x |
| R2 Class B reads | 10,000,000/mo | ~600,000/mo (catalog polling) | 16x |
| R2 Class A writes | 1,000,000/mo | ~1,000/mo (submissions) | 1000x |
| Pages requests | Unlimited | N/A | ∞ |

All within free tier. No credit card required. Zero egress fees on R2.

---

*End of Marketplace WebStore MasterPlan*
