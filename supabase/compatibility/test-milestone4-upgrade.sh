#!/usr/bin/env bash
set -euo pipefail

repository_root=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
database_container=$(docker ps --format '{{.Names}}' | rg '^supabase_db_' | head -n 1)
if [[ -z "$database_container" ]]; then
  echo 'Local Supabase database container is not running.' >&2
  exit 1
fi

test_output_dir=$(mktemp -d)
cleanup() {
  rm -f "$test_output_dir/case.out"
  rmdir "$test_output_dir"
}
trap cleanup EXIT

reset_to_milestone3() {
  pnpm --dir "$repository_root" exec supabase db reset --local --version 20260818095628 --no-seed >/dev/null
  docker exec -i "$database_container" psql -U postgres -d postgres --no-psqlrc --set ON_ERROR_STOP=1 \
    < "$repository_root/supabase/compatibility/milestone3-support-populated.sql" >/dev/null
}

run_failure_case() {
  local case_name=$1
  local mutation_sql=$2
  local expected_message=$3

  reset_to_milestone3
  docker exec -i "$database_container" psql -U postgres -d postgres --no-psqlrc --set ON_ERROR_STOP=1 \
    -c "$mutation_sql" >/dev/null
  if pnpm --dir "$repository_root" exec supabase migration up --local >"$test_output_dir/case.out" 2>&1; then
    echo "$case_name unexpectedly passed the Milestone 4 preflight." >&2
    exit 1
  fi
  rg --fixed-strings "$expected_message" "$test_output_dir/case.out" >/dev/null
  echo "$case_name preflight passed."
}

run_failure_case \
  'Duplicate active SLA policy' \
  "insert into public.sla_policies (organization_id, product_id, name, priority, first_response_minutes) values ('72000000-0000-4000-8000-000000000002', '73000000-0000-4000-8000-000000000001', 'Duplicate legacy policy', 'MEDIUM', 30);" \
  'duplicate active SLA policies require review'

run_failure_case \
  'Ticket message organization mismatch' \
  "set session_replication_role = replica; update public.ticket_messages set organization_id = '72000000-0000-4000-8000-000000000001' where id = '76000000-0000-4000-8000-000000000001'; set session_replication_role = origin;" \
  'ticket message organization mismatch requires review'

run_failure_case \
  'Support attachment parent mismatch' \
  "set session_replication_role = replica; update public.attachments set organization_id = '72000000-0000-4000-8000-000000000001' where id = '77000000-0000-4000-8000-000000000001'; set session_replication_role = origin;" \
  'support attachment parent mismatch requires review'

run_failure_case \
  'Resolved legacy ticket without reviewable summary' \
  "set session_replication_role = replica; update public.support_tickets set status = 'RESOLVED', resolved_at = now() where id = '75000000-0000-4000-8000-000000000001'; set session_replication_role = origin;" \
  'resolved or closed legacy tickets require resolution-summary review'

run_failure_case \
  'Notification state mismatch' \
  "set session_replication_role = replica; update public.notifications set read_at = now() where id = '78000000-0000-4000-8000-000000000001'; set session_replication_role = origin;" \
  'notification status/read timestamp mismatch requires review'

reset_to_milestone3
pnpm --dir "$repository_root" exec supabase migration up --local >/dev/null
docker exec -i "$database_container" psql -U postgres -d postgres --no-psqlrc --set ON_ERROR_STOP=1 \
  < "$repository_root/supabase/compatibility/milestone4-populated.test.sql"

echo 'Milestone 4 populated upgrade and every independent support preflight passed.'
