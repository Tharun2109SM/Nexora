#!/usr/bin/env bash
set -euo pipefail

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

claims='{"sub":"71000000-0000-4000-8000-000000000002","role":"authenticated","email":"concurrency-invitee@example.test"}'
token='concurrent-token-aaaaaaaaaaaaaaaaaaaaaaaa'

docker exec -i "$database_container" psql -U postgres -d postgres --no-psqlrc --set ON_ERROR_STOP=1 --tuples-only --no-align \
  -c "set request.jwt.claims = '$claims'; with accepted as materialized (select public.accept_organization_invitation('$token') as organization_id) select accepted.organization_id from accepted, lateral pg_sleep(1);" \
  >"$test_output_dir/first.out" 2>&1 &
first_pid=$!

sleep 0.1
set +e
docker exec -i "$database_container" psql -U postgres -d postgres --no-psqlrc --set ON_ERROR_STOP=1 --tuples-only --no-align \
  -c "set request.jwt.claims = '$claims'; select public.accept_organization_invitation('$token');" \
  >"$test_output_dir/second.out" 2>&1 &
second_pid=$!
wait "$first_pid"
first_status=$?
wait "$second_pid"
second_status=$?
set -e

if [[ "$first_status" -ne 0 ]]; then
  echo 'The lock-holding acceptance failed unexpectedly.' >&2
  exit 1
fi
if [[ "$second_status" -eq 0 ]]; then
  echo 'Both concurrent invitation acceptances succeeded.' >&2
  exit 1
fi
if ! rg --fixed-strings 'The invitation is invalid or unavailable' "$test_output_dir/second.out" >/dev/null; then
  echo 'The concurrent loser did not receive the generic unavailable error.' >&2
  exit 1
fi
if ! rg --fixed-strings '72000000-0000-4000-8000-000000000001' "$test_output_dir/first.out" >/dev/null; then
  echo 'The winning acceptance returned an unexpected organization.' >&2
  exit 1
fi

echo 'Concurrent invitation acceptance preserved single-use behavior.'
