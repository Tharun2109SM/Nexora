\set ON_ERROR_STOP on

do $$
begin
  if (select count(*) from public.support_tickets where id = '75000000-0000-4000-8000-000000000001') <> 1
     or (select count(*) from public.ticket_messages where ticket_id = '75000000-0000-4000-8000-000000000001') <> 2
     or (select count(*) from public.attachments where organization_id = '72000000-0000-4000-8000-000000000002') <> 2 then
    raise exception 'Compatibility failure: legacy support history was not preserved';
  end if;
  if not exists (
    select 1 from public.support_tickets ticket
    where ticket.id = '75000000-0000-4000-8000-000000000001'
      and ticket.category_id is null
      and ticket.first_responded_at is null
      and ticket.last_activity_at = (
        select max(message.created_at) from public.ticket_messages message
        where message.ticket_id = ticket.id
      )
  ) then
    raise exception 'Compatibility failure: safe legacy ticket backfill changed';
  end if;
  if not exists (
    select 1 from pg_indexes
    where schemaname = 'public' and indexname = 'sla_policies_one_active_product_priority_idx'
  ) or not exists (
    select 1 from pg_constraint
    where conrelid = 'public.support_tickets'::regclass
      and conname = 'support_tickets_lifecycle_consistency_check'
      and convalidated
  ) then
    raise exception 'Compatibility failure: Milestone 4 constraints or indexes are missing';
  end if;
  if (select array_agg(version order by version) from supabase_migrations.schema_migrations)
      <> array[
        '20260814183342','20260815090632','20260815143152','20260815145547',
        '20260818095628','20260818171437'
      ]::text[] then
    raise exception 'Compatibility failure: migration history changed unexpectedly';
  end if;
end;
$$;

set role authenticated;
set request.jwt.claims = '{"sub":"71000000-0000-4000-8000-000000000002","role":"authenticated"}';
do $$
begin
  if (select count(*) from public.support_tickets) <> 1
     or (select count(*) from public.ticket_messages) <> 1
     or (select count(id) from public.attachments) <> 1 then
    raise exception 'Compatibility failure: customer-safe support visibility is incorrect';
  end if;
  if exists (select 1 from public.ticket_messages where is_internal)
     or exists (select 1 from public.attachments where id = '77000000-0000-4000-8000-000000000002') then
    raise exception 'Compatibility failure: legacy internal content is customer-visible';
  end if;
end;
$$;
reset role;

select 'Populated Milestone 3 support upgrade passed.' as result;
