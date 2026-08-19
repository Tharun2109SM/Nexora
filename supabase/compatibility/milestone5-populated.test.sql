\set ON_ERROR_STOP on
do $$ begin
  if (select count(*) from public.feedback where organization_id='82000000-0000-4000-8000-000000000001')<>3
     or (select count(*) from public.bug_reports where feedback_id='84000000-0000-4000-8000-000000000002')<>1
     or (select count(*) from public.feature_requests where feedback_id='84000000-0000-4000-8000-000000000003')<>1
     or (select count(*) from public.feature_votes where feature_request_id='86000000-0000-4000-8000-000000000001')<>1 then
    raise exception 'Compatibility failure: legacy feedback history was not preserved';
  end if;
  if exists(select 1 from public.feedback where is_public or priority is not null or completed_at is not null)
     or exists(select 1 from public.feedback where last_activity_at is null) then
    raise exception 'Compatibility failure: legacy feedback defaults are unsafe';
  end if;
  if (select array_agg(version order by version) from supabase_migrations.schema_migrations)<>array[
    '20260814183342','20260815090632','20260815143152','20260815145547','20260818095628',
    '20260818171437','20260819053724','20260819064421'
  ]::text[] then raise exception 'Compatibility failure: migration history changed unexpectedly'; end if;
end $$;
set role authenticated;
set request.jwt.claims='{"sub":"81000000-0000-4000-8000-000000000001","role":"authenticated"}';
do $$ begin
  if (select count(*) from public.feedback)<>3 then raise exception 'Compatibility failure: legacy customer feedback visibility changed'; end if;
  if has_table_privilege('authenticated','public.feature_votes','SELECT') then raise exception 'Compatibility failure: raw votes became exposed'; end if;
end $$;
reset role;
select 'Populated Milestone 4 feedback upgrade passed.' as result;
