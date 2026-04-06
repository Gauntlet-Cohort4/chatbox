#!/usr/bin/env bash
# Apply the D1 schema to the local or remote marketplace database.
# Usage:
#   ./scripts/migrate.sh          # local
#   ./scripts/migrate.sh --remote # remote
set -euo pipefail
cd "$(dirname "$0")/.."
TARGET="${1:---local}"
pnpm wrangler d1 execute marketplace-db "$TARGET" --file=./worker/db/schema.sql
