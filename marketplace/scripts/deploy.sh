#!/usr/bin/env bash
# ChatBridge Marketplace production deployment.
#
# Prerequisites:
#   - Wrangler authenticated: `wrangler login`
#   - D1 database created: `wrangler d1 create marketplace-db` (copy id into wrangler.toml)
#   - R2 bucket created: `wrangler r2 bucket create marketplace-assets`
#   - Secrets set:
#       wrangler secret put ADMIN_TOKEN
#       wrangler secret put SESSION_SECRET
#
# Usage:
#   ./scripts/deploy.sh           # deploy frontend + worker
#   ./scripts/deploy.sh --worker  # deploy only worker
#   ./scripts/deploy.sh --pages   # deploy only pages frontend

set -euo pipefail
cd "$(dirname "$0")/.."

MODE="${1:-all}"

if [[ "$MODE" == "all" || "$MODE" == "--pages" ]]; then
  echo "==> Running review loop"
  pnpm typecheck
  pnpm test
  pnpm lint

  echo "==> Building marketplace frontend"
  pnpm build

  echo "==> Deploying to Cloudflare Pages"
  # `wrangler pages deploy` is the preferred CLI path
  pnpm wrangler pages deploy dist --project-name chatbridge-marketplace
fi

if [[ "$MODE" == "all" || "$MODE" == "--worker" ]]; then
  echo "==> Deploying worker"
  pnpm wrangler deploy
fi

echo "==> Deployment complete"
