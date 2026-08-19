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
  rm -f "$test_output_dir/first.out" "$test_output_dir/second.out"
  rmdir "$test_output_dir"
}
trap cleanup EXIT

pnpm --dir "$repository_root" exec supabase db reset --local --no-seed >/dev/null
docker exec -i "$database_container" psql -U postgres -d postgres --no-psqlrc --set ON_ERROR_STOP=1 \
  < "$repository_root/supabase/compatibility/milestone4-concurrent-first-response.sql" >/dev/null

reply_sql="set role authenticated; set request.jwt.claims = '{\"sub\":\"61000000-0000-4000-8000-000000000001\",\"role\":\"authenticated\"}'; select public.add_support_ticket_message('66000000-0000-4000-8000-000000000001', 'Concurrent visible response', false);"

docker exec "$database_container" psql -U postgres -d postgres --no-psqlrc --set ON_ERROR_STOP=1 \
  -c "$reply_sql" >"$test_output_dir/first.out" 2>&1 &
first_pid=$!
docker exec "$database_container" psql -U postgres -d postgres --no-psqlrc --set ON_ERROR_STOP=1 \
  -c "$reply_sql" >"$test_output_dir/second.out" 2>&1 &
second_pid=$!

wait "$first_pid"
wait "$second_pid"

docker exec "$database_container" psql -U postgres -d postgres --no-psqlrc --set ON_ERROR_STOP=1 <<'SQL'
do $$
begin
  if (select count(*) from public.ticket_messages where ticket_id = '66000000-0000-4000-8000-000000000001') <> 2 then
    raise exception 'Concurrent response failure: both replies were not preserved';
  end if;
  if (select first_responded_at from public.support_tickets where id = '66000000-0000-4000-8000-000000000001')
      is distinct from
     (select min(created_at) from public.ticket_messages where ticket_id = '66000000-0000-4000-8000-000000000001') then
    raise exception 'Concurrent response failure: first response timestamp is not deterministic';
  end if;
  if (select count(*) from public.support_ticket_events where ticket_id = '66000000-0000-4000-8000-000000000001' and event_type = 'STAFF_REPLIED') <> 2 then
    raise exception 'Concurrent response failure: reply event history is incomplete';
  end if;
end;
$$;
SQL

echo 'Concurrent first-response locking and immutable reply history passed.'
