#!/usr/bin/env bash
set -euo pipefail
repository_root=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
database_container=$(docker ps --format '{{.Names}}' | rg '^supabase_db_' | head -n 1)
[[ -n "$database_container" ]] || { echo 'Local Supabase database container is not running.' >&2; exit 1; }
test_output_dir=$(mktemp -d)
cleanup(){ rm -f "$test_output_dir/case.out"; rmdir "$test_output_dir"; }
trap cleanup EXIT
reset_to_milestone6(){
  pnpm --dir "$repository_root" exec supabase db reset --local --version 20260819150707 --no-seed >/dev/null
  docker exec -i "$database_container" psql -U postgres -d postgres --no-psqlrc --set ON_ERROR_STOP=1 < "$repository_root/supabase/compatibility/milestone6-knowledge-analytics-populated.sql" >/dev/null
}
failure(){ local name=$1 sql=$2 expected=$3; reset_to_milestone6; docker exec -i "$database_container" psql -U postgres -d postgres --no-psqlrc --set ON_ERROR_STOP=1 -c "$sql" >/dev/null; if pnpm --dir "$repository_root" exec supabase migration up --local >"$test_output_dir/case.out" 2>&1; then echo "$name unexpectedly passed." >&2; exit 1; fi; rg --fixed-strings "$expected" "$test_output_dir/case.out" >/dev/null; echo "$name preflight passed."; }
failure 'Invalid article content' "update public.knowledge_base_articles set title='x' where id='c9000000-0000-4000-8000-000000000001';" 'Milestone 7 preflight: invalid knowledge article content'
failure 'Duplicate global slug' "insert into public.knowledge_base_articles(organization_id,product_id,slug,title,body,status,audience) values(null,null,'compat-published','Duplicate compatibility article','Duplicate body','DRAFT','INTERNAL');" 'Milestone 7 preflight: duplicate global knowledge article slugs'
reset_to_milestone6
pnpm --dir "$repository_root" exec supabase migration up --local >/dev/null
docker exec -i "$database_container" psql -U postgres -d postgres --no-psqlrc --set ON_ERROR_STOP=1 < "$repository_root/supabase/compatibility/milestone8-populated.test.sql"
echo 'Milestones 7 and 8 populated upgrade and independent knowledge preflights passed.'
