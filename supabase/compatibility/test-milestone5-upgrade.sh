#!/usr/bin/env bash
set -euo pipefail
repository_root=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
database_container=$(docker ps --format '{{.Names}}' | rg '^supabase_db_' | head -n 1)
[[ -n "$database_container" ]] || { echo 'Local Supabase database container is not running.' >&2; exit 1; }
test_output_dir=$(mktemp -d)
cleanup(){ rm -f "$test_output_dir/case.out"; rmdir "$test_output_dir"; }
trap cleanup EXIT
reset_to_milestone4(){
  pnpm --dir "$repository_root" exec supabase db reset --local --version 20260819053724 --no-seed >/dev/null
  docker exec -i "$database_container" psql -U postgres -d postgres --no-psqlrc --set ON_ERROR_STOP=1 < "$repository_root/supabase/compatibility/milestone4-feedback-populated.sql" >/dev/null
}
failure(){ local name=$1 sql=$2 expected=$3; reset_to_milestone4; docker exec -i "$database_container" psql -U postgres -d postgres --no-psqlrc --set ON_ERROR_STOP=1 -c "$sql" >/dev/null; if pnpm --dir "$repository_root" exec supabase migration up --local >"$test_output_dir/case.out" 2>&1; then echo "$name unexpectedly passed." >&2; exit 1; fi; rg --fixed-strings "$expected" "$test_output_dir/case.out" >/dev/null; echo "$name preflight passed."; }
failure 'Inactive historical requester' "set session_replication_role=replica; update public.organization_memberships set status='SUSPENDED' where user_id='81000000-0000-4000-8000-000000000001'; set session_replication_role=origin;" 'feedback has invalid or historical requesters'
failure 'Missing bug subtype' "delete from public.bug_reports where feedback_id='84000000-0000-4000-8000-000000000002';" 'feedback subtype records are inconsistent'
failure 'Feedback without product scope' "update public.feedback set product_id=null where id='84000000-0000-4000-8000-000000000001';" 'feedback product scope requires review'
failure 'Subtype organization mismatch' "set session_replication_role=replica; update public.bug_reports set organization_id='00000000-0000-4000-8000-000000000001' where feedback_id='84000000-0000-4000-8000-000000000002'; set session_replication_role=origin;" 'feedback subtype organization mismatch requires review'
failure 'Mismatched vote ownership' "set session_replication_role=replica; update public.feature_votes set organization_id='00000000-0000-4000-8000-000000000001'; set session_replication_role=origin;" 'feature votes have invalid ownership'
reset_to_milestone4
pnpm --dir "$repository_root" exec supabase migration up --local >/dev/null
docker exec -i "$database_container" psql -U postgres -d postgres --no-psqlrc --set ON_ERROR_STOP=1 < "$repository_root/supabase/compatibility/milestone5-populated.test.sql"
echo 'Milestone 5 populated upgrade and independent feedback preflights passed.'
