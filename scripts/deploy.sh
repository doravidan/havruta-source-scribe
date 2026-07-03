#!/usr/bin/env bash
# Build and deploy the Cloudflare Worker bundle produced by Vite/Nitro.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

echo "Building..."
npm run build

if [[ -z "${CLOUDFLARE_API_TOKEN:-}" ]]; then
  echo "warn: CLOUDFLARE_API_TOKEN not set — build succeeded; skipping wrangler deploy."
  echo "      Lovable deploys on push to main, or set CLOUDFLARE_API_TOKEN and re-run."
  exit 0
fi

echo "Deploying to Cloudflare..."
npx wrangler deploy --config .output/server/wrangler.json

echo "Deploy complete."
