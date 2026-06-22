#!/usr/bin/env bash
# Automated DB check for the chavruta_* tables and RPCs.
# Validates:
#   1. All expected tables exist
#   2. RLS is enabled on every chavruta_* table
#   3. Expected RLS policies exist (per table)
#   4. Required GRANTs exist for authenticated + service_role
#   5. anon has NO privileges (auth-only tables)
#   6. Expected RPC functions exist and are SECURITY DEFINER
#   7. Helper indexes / FKs exist
#
# Exits non-zero on any failure. Designed for CI and local runs.
#
# Usage: ./scripts/check_chavruta_db.sh

set -euo pipefail

if [[ -z "${PGHOST:-}" ]]; then
  echo "❌ PGHOST not set — need Supabase managed DB env vars (PGHOST/PGUSER/PGPASSWORD/PGDATABASE)."
  exit 2
fi

PSQL=(psql -X -A -t -v ON_ERROR_STOP=1)

fail=0
pass=0

ok()   { echo "  ✅ $*"; pass=$((pass+1)); }
bad()  { echo "  ❌ $*"; fail=$((fail+1)); }
hdr()  { echo; echo "── $* ──"; }

q() { "${PSQL[@]}" -c "$1"; }

TABLES=(
  chavruta_profiles
  chavruta_contact_info
  chavruta_availability
  chavruta_matches
  chavruta_messages
)

RPCS=(
  propose_chavruta_match
  accept_chavruta_match
  get_chavruta_match_contact
)

hdr "1. Tables exist"
for t in "${TABLES[@]}"; do
  exists=$(q "select count(*) from information_schema.tables where table_schema='public' and table_name='$t';")
  [[ "$exists" == "1" ]] && ok "public.$t exists" || bad "public.$t MISSING"
done

hdr "2. RLS enabled on every table"
for t in "${TABLES[@]}"; do
  rls=$(q "select relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='$t';")
  [[ "$rls" == "t" ]] && ok "RLS enabled on $t" || bad "RLS DISABLED on $t"
done

hdr "3. RLS policies present (>=1 per table)"
for t in "${TABLES[@]}"; do
  n=$(q "select count(*) from pg_policies where schemaname='public' and tablename='$t';")
  if [[ "$n" -ge 1 ]]; then ok "$t has $n policy(ies)"; else bad "$t has NO policies"; fi
done

hdr "4. GRANTs for authenticated + service_role"
for t in "${TABLES[@]}"; do
  for priv in SELECT INSERT UPDATE DELETE; do
    a=$(q "select has_table_privilege('authenticated','public.$t','$priv');")
    s=$(q "select has_table_privilege('service_role','public.$t','$priv');")
    [[ "$a" == "t" ]] && ok "authenticated $priv on $t" || bad "authenticated MISSING $priv on $t"
    [[ "$s" == "t" ]] && ok "service_role $priv on $t" || bad "service_role MISSING $priv on $t"
  done
done

hdr "5. anon has NO table privileges (auth-only tables)"
for t in "${TABLES[@]}"; do
  any="f"
  for priv in SELECT INSERT UPDATE DELETE; do
    p=$(q "select has_table_privilege('anon','public.$t','$priv');")
    [[ "$p" == "t" ]] && any="t"
  done
  [[ "$any" == "f" ]] && ok "anon has no access to $t" || bad "anon has access to $t (should be none)"
done


hdr "6. RPCs exist & are SECURITY DEFINER"
for fn in "${RPCS[@]}"; do
  row=$(q "select count(*)||':'||coalesce(bool_or(prosecdef)::text,'f') from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='$fn';")
  cnt="${row%%:*}"; sd="${row##*:}"
  if [[ "$cnt" -ge 1 && "$sd" == "t" ]]; then
    ok "$fn exists and is SECURITY DEFINER"
  elif [[ "$cnt" -ge 1 ]]; then
    bad "$fn exists but is NOT SECURITY DEFINER"
  else
    bad "$fn MISSING"
  fi
done

hdr "7. RPC EXECUTE granted to authenticated"
for fn in "${RPCS[@]}"; do
  n=$(q "select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='$fn' and has_function_privilege('authenticated', p.oid, 'EXECUTE');")
  [[ "$n" -ge 1 ]] && ok "authenticated can EXECUTE $fn" || bad "authenticated CANNOT EXECUTE $fn"
done


hdr "8. FK chavruta_messages.match_id → chavruta_matches.id"
fk=$(q "select count(*) from information_schema.table_constraints tc join information_schema.key_column_usage k using (constraint_schema,constraint_name) where tc.table_schema='public' and tc.table_name='chavruta_messages' and tc.constraint_type='FOREIGN KEY' and k.column_name='match_id';")
[[ "$fk" -ge 1 ]] && ok "FK present" || bad "FK missing"

echo
echo "──────────────────────────────"
echo "Passed: $pass    Failed: $fail"
echo "──────────────────────────────"
exit $(( fail > 0 ? 1 : 0 ))
