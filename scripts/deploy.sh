#!/usr/bin/env bash
# C-Net containerless deploy: pull -> build -> migrate -> restart.
# Run by the self-hosted GitHub Actions runner (or manually on the box).
# Usage: scripts/deploy.sh [git-ref]   (default ref: main)
set -euo pipefail

REPO_DIR="/opt/cnet"
REF="${1:-main}"
cd "$REPO_DIR"

# Export all env (incl. NEXT_PUBLIC_* which Next.js inlines at BUILD time) for build + migrate.
set -a
# shellcheck disable=SC1091
source "$REPO_DIR/.env"
set +a

echo "==> Fetching $REF"
git fetch origin
git checkout "$REF"
git pull --ff-only

echo "==> Installing dependencies"
bun install --frozen-lockfile

echo "==> Building"
bunx turbo build

echo "==> Applying DB migrations"
bun run db:migrate

echo "==> Restarting services"
sudo systemctl restart cnet-web cnet-api cnet-realtime cnet-workers

echo "==> Deployed $(git rev-parse --short HEAD)"
