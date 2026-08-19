do $$ begin
  if (select release_status from public.product_releases where version='1.0.0') <> 'PUBLISHED' then raise exception 'published release mapping failed'; end if;
  if (select release_status from public.product_releases where version='1.1.0') <> 'SCHEDULED' then raise exception 'scheduled release mapping failed'; end if;
  if not exists(select 1 from public.release_targets where release_id='c7000000-0000-4000-8000-000000000002' and organization_id='a7000000-0000-4000-8000-000000000002') then raise exception 'legacy release target backfill failed'; end if;
  if (select maintenance_status from public.maintenance_notices where id='d7000000-0000-4000-8000-000000000001') <> 'ACTIVE' then raise exception 'maintenance mapping failed'; end if;
  if not exists(select 1 from public.maintenance_targets where notice_id='d7000000-0000-4000-8000-000000000001') then raise exception 'maintenance target backfill failed'; end if;
  if not exists(select 1 from pg_indexes where schemaname='public' and indexname='product_releases_product_version_unique_idx') then raise exception 'release uniqueness index missing'; end if;
end $$;
select 'Populated Milestone 5 release upgrade passed.' as result;
