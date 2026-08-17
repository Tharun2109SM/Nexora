\set ON_ERROR_STOP on

do $$
begin
  if (select string_agg(workflow_status::text, ',' order by id) from public.onboarding_plans where id::text like '84000000-%')
      <> 'DRAFT,IN_PROGRESS,BLOCKED,LIVE,CANCELLED' then
    raise exception 'Compatibility failure: onboarding status mappings changed';
  end if;
  if (select string_agg(workflow_status::text, ',' order by id) from public.onboarding_tasks where id::text like '85000000-%')
      <> 'NOT_STARTED,IN_PROGRESS,BLOCKED,COMPLETED,CANCELLED' then
    raise exception 'Compatibility failure: task status mappings changed';
  end if;
  if (select string_agg(workflow_status::text, ',' order by id) from public.training_sessions where id::text like '86000000-%')
      <> 'SCHEDULED,SCHEDULED,CANCELLED,COMPLETED,CANCELLED' then
    raise exception 'Compatibility failure: training status mappings changed';
  end if;
  if (select string_agg(workflow_status::text, ',' order by id) from public.requested_documents where id::text like '87000000-%')
      <> 'REQUESTED,RECEIVED,REJECTED,ACCEPTED,WAIVED' then
    raise exception 'Compatibility failure: document status mappings changed';
  end if;
  if (select string_agg(workflow_status::text, ',' order by id) from public.implementation_projects where id::text like '88000000-%')
      <> 'DRAFT,IN_PROGRESS,BLOCKED,COMPLETED,CANCELLED' then
    raise exception 'Compatibility failure: implementation status mappings changed';
  end if;
  if (select string_agg(workflow_status::text, ',' order by id) from public.milestones where id::text like '89000000-%')
      <> 'NOT_STARTED,IN_PROGRESS,BLOCKED,COMPLETED,CANCELLED' then
    raise exception 'Compatibility failure: milestone status mappings changed';
  end if;
  if (select string_agg(coalesce(owner_kind::text, 'NONE'), ',' order by id) from public.onboarding_tasks where id::text like '85000000-%')
      <> 'BEAUROI,CUSTOMER,NONE,NONE,NONE' then
    raise exception 'Compatibility failure: task owner kinds were not deterministically backfilled';
  end if;
  if exists (
    select 1 from public.onboarding_plans where target_completion_on is distinct from target_go_live_on
  ) or exists (
    select 1 from public.implementation_projects where target_go_live_on is distinct from target_completion_on
      or actual_go_live_on is distinct from actual_completion_on
  ) then
    raise exception 'Compatibility failure: legacy and expanded dates differ after backfill';
  end if;
  if (select count(*) from public.onboarding_tasks where id::text like '85000000-%') <> 5
    or (select count(*) from public.implementation_projects where id::text like '88000000-%') <> 5
    or (select count(*) from public.project_notes where body = 'Legacy shared implementation note') <> 1 then
    raise exception 'Compatibility failure: legacy workflow history was not preserved';
  end if;
  if (select format_type(attribute.atttypid, attribute.atttypmod)
      from pg_attribute attribute
      where attribute.attrelid = 'public.onboarding_plans'::regclass and attribute.attname = 'status')
      <> 'lifecycle_status' then
    raise exception 'Compatibility failure: legacy status column type changed';
  end if;
  if not exists (
    select 1 from pg_constraint constraint_record
    where constraint_record.conrelid = 'public.onboarding_tasks'::regclass
      and constraint_record.conname = 'onboarding_tasks_owner_check'
      and constraint_record.convalidated
  ) then
    raise exception 'Compatibility failure: task owner constraint is not validated';
  end if;
  if (select array_agg(version order by version) from supabase_migrations.schema_migrations)
      <> array['20260814183342','20260815090632','20260815143152','20260815145547']::text[] then
    raise exception 'Compatibility failure: migration history was changed';
  end if;
end;
$$;

set role authenticated;
set request.jwt.claims = '{"sub":"81000000-0000-4000-8000-000000000001","role":"authenticated"}';
update public.onboarding_plans set status = 'ACTIVE' where id = '84000000-0000-4000-8000-000000000001';
update public.implementation_projects set status = 'ACTIVE' where id = '88000000-0000-4000-8000-000000000001';
do $$
begin
  if (select workflow_status from public.onboarding_plans where id = '84000000-0000-4000-8000-000000000001') <> 'IN_PROGRESS'
    or (select workflow_status from public.implementation_projects where id = '88000000-0000-4000-8000-000000000001') <> 'IN_PROGRESS' then
    raise exception 'Compatibility failure: legacy status writes are not synchronized';
  end if;
end;
$$;
reset role;

set role authenticated;
set request.jwt.claims = '{"sub":"81000000-0000-4000-8000-000000000002","role":"authenticated"}';
do $$
begin
  if (select count(*) from public.onboarding_plans) <> 5
    or (select count(*) from public.implementation_projects) <> 5
    or (select count(*) from public.onboarding_portfolio) <> 5
    or (select count(*) from public.implementation_portfolio) <> 5 then
    raise exception 'Compatibility failure: customer read access changed';
  end if;
end;
$$;
reset role;

select 'Populated Milestone 2 workflow upgrade passed.' as result;
