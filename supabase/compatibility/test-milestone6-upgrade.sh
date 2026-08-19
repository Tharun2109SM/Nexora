#!/usr/bin/env bash
set -euo pipefail
repository_root=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
database_container=$(docker ps --format '{{.Names}}' | rg '^supabase_db_' | head -n 1)
[[ -n "$database_container" ]] || { echo 'Local Supabase database container is not running.' >&2; exit 1; }
test_output_dir=$(mktemp -d)
cleanup(){ rm -f "$test_output_dir/case.out"; rmdir "$test_output_dir"; }
trap cleanup EXIT
reset_to_milestone5(){
  pnpm --dir "$repository_root" exec supabase db reset --local --version 20260819064421 --no-seed >/dev/null
  docker exec -i "$database_container" psql -U postgres -d postgres --no-psqlrc --set ON_ERROR_STOP=1 < "$repository_root/supabase/compatibility/milestone5-release-populated.sql" >/dev/null
}
failure(){ local name=$1 sql=$2 expected=$3; reset_to_milestone5; docker exec -i "$database_container" psql -U postgres -d postgres --no-psqlrc --set ON_ERROR_STOP=1 -c "$sql" >/dev/null; if pnpm --dir "$repository_root" exec supabase migration up --local >"$test_output_dir/case.out" 2>&1; then echo "$name unexpectedly passed." >&2; exit 1; fi; rg --fixed-strings "$expected" "$test_output_dir/case.out" >/dev/null; echo "$name preflight passed."; }
failure 'Duplicate product version' "insert into public.product_releases(product_id,version,title,status) values('b7000000-0000-4000-8000-000000000001','1.0.0','Duplicate compatibility release','DRAFT');" 'Duplicate product release versions require review'
failure 'Invalid version' "update public.product_releases set version='invalid version!' where id='c7000000-0000-4000-8000-000000000001';" 'Invalid historical release content requires review'
failure 'Invalid legacy target' "update public.product_releases set organization_id='a7000000-0000-4000-8000-000000000001' where id='c7000000-0000-4000-8000-000000000002';" 'Historical release organization targets lack an active matching subscription'
failure 'Invalid maintenance content' "update public.maintenance_notices set title='x' where id='d7000000-0000-4000-8000-000000000001';" 'Invalid historical maintenance notices require review'
reset_to_milestone5
pnpm --dir "$repository_root" exec supabase migration up --local >/dev/null
docker exec -i "$database_container" psql -U postgres -d postgres --no-psqlrc --set ON_ERROR_STOP=1 < "$repository_root/supabase/compatibility/milestone6-populated.test.sql"
echo 'Milestone 6 populated upgrade and independent release preflights passed.'
