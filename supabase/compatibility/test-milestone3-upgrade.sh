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

reset_to_milestone2() {
  pnpm --dir "$repository_root" exec supabase db reset --local --version 20260815143152 --no-seed >/dev/null
  docker exec -i "$database_container" psql -U postgres -d postgres --no-psqlrc --set ON_ERROR_STOP=1 \
    < "$repository_root/supabase/compatibility/milestone2-workflows-populated.sql" >/dev/null
}

run_failure_case() {
  local case_name=$1
  local mutation_sql=$2
  local expected_message=$3

  reset_to_milestone2
  docker exec -i "$database_container" psql -U postgres -d postgres --no-psqlrc --set ON_ERROR_STOP=1 \
    -c "$mutation_sql" >/dev/null
  if pnpm --dir "$repository_root" exec supabase migration up --local >"$test_output_dir/case.out" 2>&1; then
    echo "$case_name unexpectedly passed the Milestone 3 preflight." >&2
    exit 1
  fi
  rg --fixed-strings "$expected_message" "$test_output_dir/case.out" >/dev/null
  echo "$case_name preflight passed."
}

run_failure_case \
  'Invalid onboarding plan owner' \
  "update public.onboarding_plans set owner_user_id = '81000000-0000-4000-8000-000000000002' where id = '84000000-0000-4000-8000-000000000001';" \
  'onboarding_plans.owner_user_id value(s) are invalid, inactive, or ambiguous'

run_failure_case \
  'Inactive onboarding task assignee' \
  "set session_replication_role = replica; insert into auth.users (id, aud, role, email, encrypted_password) values ('91000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'inactive-task@example.test', 'test'); insert into public.organization_memberships (organization_id, user_id, role, status, joined_at) values ('82000000-0000-4000-8000-000000000001', '91000000-0000-4000-8000-000000000001', 'BEAUROI_EMPLOYEE', 'SUSPENDED', now()); update public.onboarding_tasks set assigned_user_id = '91000000-0000-4000-8000-000000000001' where id = '85000000-0000-4000-8000-000000000001'; set session_replication_role = origin;" \
  'onboarding_tasks.assigned_user_id value(s) cannot receive an unambiguous owner_kind'

run_failure_case \
  'Ambiguous onboarding task assignee' \
  "set session_replication_role = replica; insert into auth.users (id, aud, role, email, encrypted_password) values ('91000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'ambiguous-task@example.test', 'test'); insert into public.organization_memberships (organization_id, user_id, role, status, joined_at) values ('82000000-0000-4000-8000-000000000001', '91000000-0000-4000-8000-000000000002', 'BEAUROI_EMPLOYEE', 'ACTIVE', now()), ('82000000-0000-4000-8000-000000000002', '91000000-0000-4000-8000-000000000002', 'CUSTOMER_MEMBER', 'ACTIVE', now()); update public.onboarding_tasks set assigned_user_id = '91000000-0000-4000-8000-000000000002' where id = '85000000-0000-4000-8000-000000000001'; set session_replication_role = origin;" \
  'onboarding_tasks.assigned_user_id value(s) cannot receive an unambiguous owner_kind'

run_failure_case \
  'Invalid training facilitator' \
  "update public.training_sessions set facilitator_user_id = '81000000-0000-4000-8000-000000000002' where id = '86000000-0000-4000-8000-000000000001';" \
  'training_sessions.facilitator_user_id value(s) are invalid, inactive, or ambiguous'

run_failure_case \
  'Cross-organization requested-document assignee' \
  "set session_replication_role = replica; insert into auth.users (id, aud, role, email, encrypted_password) values ('91000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'cross-document@example.test', 'test'); insert into public.organizations (id, name, slug, organization_type) values ('92000000-0000-4000-8000-000000000001', 'Other legacy customer', 'other-legacy-customer', 'CUSTOMER'); insert into public.organization_memberships (organization_id, user_id, role, status, joined_at) values ('92000000-0000-4000-8000-000000000001', '91000000-0000-4000-8000-000000000003', 'CUSTOMER_MEMBER', 'ACTIVE', now()); update public.requested_documents set requested_from_user_id = '91000000-0000-4000-8000-000000000003' where id = '87000000-0000-4000-8000-000000000001'; set session_replication_role = origin;" \
  'requested_documents.requested_from_user_id value(s) are invalid, inactive, cross-organization, or ambiguous'

run_failure_case \
  'Ambiguous requested-document assignee' \
  "set session_replication_role = replica; insert into public.organization_memberships (organization_id, user_id, role, status, joined_at) values ('82000000-0000-4000-8000-000000000002', '81000000-0000-4000-8000-000000000001', 'CUSTOMER_MEMBER', 'ACTIVE', now()); update public.requested_documents set requested_from_user_id = '81000000-0000-4000-8000-000000000001' where id = '87000000-0000-4000-8000-000000000001'; set session_replication_role = origin;" \
  'requested_documents.requested_from_user_id value(s) are invalid, inactive, cross-organization, or ambiguous'

run_failure_case \
  'Invalid implementation project owner' \
  "update public.implementation_projects set owner_user_id = '81000000-0000-4000-8000-000000000002' where id = '88000000-0000-4000-8000-000000000001';" \
  'implementation_projects.owner_user_id value(s) are invalid, inactive, or ambiguous'

reset_to_milestone2
pnpm --dir "$repository_root" exec supabase migration up --local >/dev/null
docker exec -i "$database_container" psql -U postgres -d postgres --no-psqlrc --set ON_ERROR_STOP=1 \
  < "$repository_root/supabase/compatibility/milestone3-populated.test.sql"

echo 'Milestone 3 populated upgrade and every independent historical-assignee preflight passed.'
