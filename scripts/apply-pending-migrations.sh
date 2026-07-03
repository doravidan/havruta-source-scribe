#!/usr/bin/env bash
# Apply pending Supabase migrations to the linked remote project.
# Requires: SUPABASE_ACCESS_TOKEN, SUPABASE_DB_PASSWORD (or pass -p), optional SUPABASE_PROJECT_ID.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

PROJECT_REF="${SUPABASE_PROJECT_ID:-mfqpoclgxuxbnnexzxoq}"
PASSWORD="${SUPABASE_DB_PASSWORD:-}"

while getopts "p:" opt; do
  case "$opt" in
    p) PASSWORD="$OPTARG" ;;
    *) exit 1 ;;
  esac
done

if [[ -z "${SUPABASE_ACCESS_TOKEN:-}" ]]; then
  echo "error: set SUPABASE_ACCESS_TOKEN (Supabase dashboard → Account → Access tokens)" >&2
  exit 1
fi

if [[ -z "$PASSWORD" ]]; then
  echo "error: set SUPABASE_DB_PASSWORD or pass -p <database-password>" >&2
  exit 1
fi

echo "Linking project ${PROJECT_REF}..."
npx supabase link --project-ref "$PROJECT_REF" --password "$PASSWORD" --yes

echo "Pushing migrations..."
npx supabase db push --linked --yes

echo "Done. Pending migrations applied."
