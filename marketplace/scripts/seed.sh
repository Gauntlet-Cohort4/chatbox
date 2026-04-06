#!/usr/bin/env bash
# Seed the local or remote marketplace database with sample data.
# Usage:
#   ./scripts/seed.sh          # local
#   ./scripts/seed.sh --remote # remote
set -euo pipefail
cd "$(dirname "$0")/.."
TARGET="${1:---local}"
pnpm wrangler d1 execute marketplace-db "$TARGET" --file=./worker/db/seed.sql
