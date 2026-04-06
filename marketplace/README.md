# ChatBridge Marketplace

Plugin marketplace and distribution platform for ChatBridge. Lives in this repo as a standalone workspace package — separate build, separate Cloudflare deployment, shared design tokens.

## Stack

- **Frontend:** React 18 + Mantine UI + React Router + Vite
- **Backend:** Cloudflare Workers + D1 (SQLite) + R2 (object storage)
- **Tests:** Vitest with in-memory D1 (sql.js) and R2 adapters
- **Lint/format:** Biome (shared with the main ChatBridge config)

## Repository layout

```
marketplace/
  src/              React frontend (routes, components, hooks, API client)
  worker/           Cloudflare Worker API
    db/             D1 schema, seed data, query helpers
    routes/         Route handlers per domain
    middleware/     CORS, auth, CSRF
    r2/             R2 storage helpers, catalog regeneration
    lib/            JSON response helpers, crypto utilities
  tests/
    ui/             React component + page tests
    worker/         Route and query helper tests
    integration/    End-to-end user flow tests
  scripts/          Migration and deployment scripts
```

## Getting started

```bash
# From the repo root
pnpm install

# Frontend dev server (http://localhost:5174)
pnpm --filter @chatbridge/marketplace dev

# Worker dev server (http://localhost:8787)
pnpm --filter @chatbridge/marketplace worker:dev

# Run tests
pnpm --filter @chatbridge/marketplace test

# Typecheck and build
pnpm --filter @chatbridge/marketplace typecheck
pnpm --filter @chatbridge/marketplace build
```

From the repo root you can also use the shortcut scripts:

```bash
pnpm dev:marketplace     # frontend
pnpm dev:worker          # worker
pnpm test:marketplace    # tests
pnpm build:marketplace   # production build
```

## Local database

```bash
cd marketplace

# Create the local D1 database and apply the schema
./scripts/migrate.sh

# Seed sample data (8 approved plugins, 1 pending, 2 teachers, reviews, reports)
./scripts/seed.sh
```

## Deployment to Cloudflare

One-time setup:

```bash
cd marketplace

# Create the production D1 database
pnpm wrangler d1 create marketplace-db
# Copy the printed database_id into wrangler.toml

# Create the R2 bucket
pnpm wrangler r2 bucket create marketplace-assets

# Set secrets
pnpm wrangler secret put ADMIN_TOKEN
pnpm wrangler secret put SESSION_SECRET

# Apply the schema to production
./scripts/migrate.sh --remote
```

Ongoing deployments:

```bash
./scripts/deploy.sh            # frontend + worker
./scripts/deploy.sh --pages    # frontend only
./scripts/deploy.sh --worker   # worker only
```

## API surface

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/marketplace/plugins` | Browse approved plugins (filters, sort, pagination) |
| `GET` | `/marketplace/plugins/:id` | Plugin detail |
| `GET` | `/marketplace/plugins/:id/image` | Screenshot stream |
| `GET` | `/marketplace/plugins/:id/bundle` | Bundle zip download |
| `GET` | `/marketplace/plugins/:id/reviews` | List reviews |
| `POST` | `/marketplace/plugins/:id/reviews` | Create review (teacher-authed) |
| `PUT` | `/marketplace/plugins/:id/reviews` | Update own review |
| `POST` | `/marketplace/plugins/:id/reports` | File report (teacher-authed) |
| `POST` | `/marketplace/plugins` | Submit new plugin (multipart) |
| `GET` | `/marketplace/categories` | Category counts |
| `POST` | `/teachers/register` | Create teacher account |
| `POST` | `/auth/exchange-code` | ChatBridge → marketplace handoff (apiToken → code) |
| `POST` | `/auth/exchange` | code → HttpOnly session cookie |
| `GET` | `/auth/me` | Current session info |
| `POST` | `/auth/logout` | Clear session |
| `GET` | `/teachers/:id/plugins` | Teacher classroom list |
| `POST` | `/teachers/:id/plugins/:pluginId` | Add to classroom |
| `PUT` | `/teachers/:id/plugins/:pluginId/approve` | pending_review → approved |
| `PUT` | `/teachers/:id/plugins/:pluginId/deploy` | approved → deployed (regens catalog) |
| `PUT` | `/teachers/:id/plugins/:pluginId/revoke` | deployed → revoked |
| `DELETE` | `/teachers/:id/plugins/:pluginId` | Remove from classroom |
| `GET` | `/catalog/:joinCode` | Public student polling (ETag-aware) |
| `GET` | `/admin/submissions` | Pending submissions (admin-authed) |
| `PUT` | `/admin/submissions/:id/approve` | Admin approve |
| `PUT` | `/admin/submissions/:id/reject` | Admin reject with reason |
| `GET` | `/admin/reports` | Reports list |
| `PUT` | `/admin/reports/:id` | Resolve or dismiss |

## Test coverage

- **Worker:** schema enforcement, every query helper, every route, auth lifecycle, CSRF middleware, R2 path traversal rejection
- **UI:** Layout shell, BrowsePage, PluginCard, PluginDetailPage, ClassroomPage, SubmitPage
- **Integration:** 8 end-to-end user flows covering submission → approval, teacher classroom → student polling, review lifecycle, report resolution, catalog ETag round-trip, logout

All 3 review-loop passes (typecheck, test, lint) must be green before merging any phase.

## Design notes

- **D1 uniqueness + CHECK constraints** enforce correctness at the DB layer, not just the app layer (see Quality Gate #17).
- **R2 keys** go through `bundleKey()` / `screenshotKey()` which reject unsafe IDs — path traversal is blocked centrally.
- **Session cookies** are `HttpOnly; Secure; SameSite=Lax` with an 8-hour TTL and a scheduled cleanup handler.
- **CSRF** is enforced via Origin header check on state-changing requests; the `/catalog`, `/teachers/register`, `/auth/exchange-code`, `/auth/exchange`, and `/health` paths are exempt because they are called from the ChatBridge desktop app or are public.
- **Test adapters** (`sql.js` for D1, in-memory map for R2) keep the full test suite under 10s with no native build dependencies.

## Free tier budget

All services run within the Cloudflare free tier (100K worker requests/day, 5M D1 reads/day, 10GB R2 storage). See the masterplan's Appendix B for per-resource estimates.
