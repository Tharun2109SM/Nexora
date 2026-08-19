-- Milestone 6: secure product release and maintenance management.
-- Existing lifecycle_status columns remain as compatibility mirrors for deployed views.

do $$
declare details text;
begin
  select string_agg(product_id::text || '/' || normalized_version, ', ' order by product_id, normalized_version)
  into details
  from (
    select product_id, lower(version) as normalized_version
    from public.product_releases
    group by product_id, lower(version)
    having count(*) > 1
  ) duplicate;
  if details is not null then
    raise exception 'Duplicate product release versions require review before Milestone 6: %', details;
  end if;

  select string_agg(id::text, ', ' order by id) into details
  from public.product_releases
  where version !~ '^[A-Za-z0-9][A-Za-z0-9._+\-]{0,63}$'
     or char_length(title) not between 3 and 240
     or summary is not null and char_length(summary) > 2000
     or release_notes is not null and char_length(release_notes) > 50000;
  if details is not null then
    raise exception 'Invalid historical release content requires review: %', details;
  end if;

  select string_agg(r.id::text, ', ' order by r.id) into details
  from public.product_releases r
  where r.organization_id is not null and not exists (
    select 1 from public.customer_subscriptions s
    join public.organizations o on o.id=s.organization_id
    where s.organization_id=r.organization_id and s.product_id=r.product_id
      and s.status='ACTIVE' and o.organization_type='CUSTOMER' and o.is_active
  );
  if details is not null then
    raise exception 'Historical release organization targets lack an active matching subscription: %', details;
  end if;

  select string_agg(id::text, ', ' order by id) into details
  from public.maintenance_notices
  where char_length(title) not between 3 and 240
     or char_length(description) not between 1 and 30000
     or ends_at is not null and ends_at <= starts_at;
  if details is not null then
    raise exception 'Invalid historical maintenance notices require review: %', details;
  end if;
end $$;

alter table public.product_releases
  add column release_status text not null default 'DRAFT',
  add column audience_mode text not null default 'ALL_SUBSCRIBERS',
  add column customer_visible boolean not null default false,
  add column scheduled_for timestamptz,
  add column published_at timestamptz,
  add column archived_at timestamptz,
  add column last_activity_at timestamptz not null default now(),
  add constraint product_releases_version_format_check
    check (version ~ '^[A-Za-z0-9][A-Za-z0-9._+\-]{0,63}$'),
  add constraint product_releases_title_length_check check (char_length(title) between 3 and 240),
  add constraint product_releases_summary_length_check
    check (summary is null or char_length(summary) <= 2000),
  add constraint product_releases_notes_length_check
    check (release_notes is null or char_length(release_notes) <= 50000),
  add constraint product_releases_release_status_check
    check (release_status in ('DRAFT','SCHEDULED','PUBLISHED','ARCHIVED')),
  add constraint product_releases_audience_mode_check
    check (audience_mode in ('ALL_SUBSCRIBERS','SELECTED_ORGANIZATIONS')),
  add constraint product_releases_lifecycle_consistency_check check (
    (release_status='DRAFT' and scheduled_for is null and published_at is null and archived_at is null and not customer_visible)
    or (release_status='SCHEDULED' and scheduled_for is not null and published_at is null and archived_at is null)
    or (release_status='PUBLISHED' and published_at is not null and archived_at is null and customer_visible)
    or (release_status='ARCHIVED' and published_at is not null and archived_at is not null and customer_visible)
  ) not valid;

update public.product_releases
set release_status=case status
      when 'DRAFT' then 'DRAFT'
      when 'PAUSED' then 'SCHEDULED'
      when 'ARCHIVED' then 'ARCHIVED'
      else 'PUBLISHED' end,
    audience_mode=case when organization_id is null then 'ALL_SUBSCRIBERS' else 'SELECTED_ORGANIZATIONS' end,
    customer_visible=status in ('ACTIVE','COMPLETED','ARCHIVED'),
    scheduled_for=case when status='PAUSED' then coalesce(released_at,updated_at) end,
    published_at=case when status in ('ACTIVE','COMPLETED','ARCHIVED') then coalesce(released_at,created_at) end,
    archived_at=case when status='ARCHIVED' then updated_at end,
    last_activity_at=updated_at;

alter table public.product_releases validate constraint product_releases_lifecycle_consistency_check;
create unique index product_releases_product_version_unique_idx
  on public.product_releases(product_id,lower(version));
create index product_releases_queue_idx
  on public.product_releases(last_activity_at desc,id desc);
create index product_releases_customer_idx
  on public.product_releases(product_id,release_status,customer_visible,published_at desc,id desc);

create table public.release_targets (
  release_id uuid not null references public.product_releases(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (release_id,organization_id)
);
create index release_targets_organization_idx on public.release_targets(organization_id,release_id);

insert into public.release_targets(release_id,organization_id,created_by,created_at)
select id,organization_id,created_by,created_at from public.product_releases
where organization_id is not null;

create table public.release_note_sections (
  id uuid primary key default gen_random_uuid(),
  release_id uuid not null references public.product_releases(id) on delete cascade,
  category text not null check (category in ('NEW_FEATURE','IMPROVEMENT','BUG_FIX','SECURITY','DEPRECATION','IMPORTANT_CHANGE')),
  title text not null check (char_length(title) between 2 and 160),
  body text not null check (char_length(body) between 1 and 10000),
  sort_order integer not null default 0 check (sort_order between 0 and 10000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index release_note_sections_release_idx on public.release_note_sections(release_id,sort_order,id);

create table public.release_events (
  id uuid primary key default gen_random_uuid(),
  release_id uuid not null references public.product_releases(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  event_type text not null check (event_type in (
    'DRAFT_CREATED','CONTENT_UPDATED','AUDIENCE_UPDATED','SECTION_UPDATED',
    'SCHEDULED','UNSCHEDULED','PUBLISHED','ARCHIVED','FEEDBACK_LINKED'
  )),
  customer_visible boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index release_events_release_idx on public.release_events(release_id,created_at,id);

create table public.release_feedback_links (
  release_id uuid not null references public.product_releases(id) on delete cascade,
  feedback_id uuid not null references public.feedback(id) on delete restrict,
  linked_by uuid references auth.users(id) on delete set null,
  linked_at timestamptz not null default now(),
  primary key(release_id,feedback_id)
);
create index release_feedback_links_feedback_idx on public.release_feedback_links(feedback_id,release_id);

alter table public.maintenance_notices
  add column maintenance_status text not null default 'DRAFT',
  add column audience_mode text not null default 'ALL_SUBSCRIBERS',
  add column customer_visible boolean not null default false,
  add column published_at timestamptz,
  add column completed_at timestamptz,
  add column cancelled_at timestamptz,
  add column last_activity_at timestamptz not null default now(),
  add constraint maintenance_title_length_check check (char_length(title) between 3 and 240),
  add constraint maintenance_description_length_check check (char_length(description) between 1 and 30000),
  add constraint maintenance_status_check
    check (maintenance_status in ('DRAFT','SCHEDULED','ACTIVE','COMPLETED','CANCELLED')),
  add constraint maintenance_audience_mode_check
    check (audience_mode in ('ALL_SUBSCRIBERS','SELECTED_ORGANIZATIONS')),
  add constraint maintenance_lifecycle_consistency_check check (
    (maintenance_status='DRAFT' and published_at is null and completed_at is null and cancelled_at is null and not customer_visible)
    or (maintenance_status in ('SCHEDULED','ACTIVE') and published_at is not null and completed_at is null and cancelled_at is null and customer_visible)
    or (maintenance_status='COMPLETED' and published_at is not null and completed_at is not null and cancelled_at is null and customer_visible)
    or (maintenance_status='CANCELLED' and published_at is not null and completed_at is null and cancelled_at is not null and customer_visible)
  ) not valid;

update public.maintenance_notices
set maintenance_status=case status
      when 'DRAFT' then 'DRAFT'
      when 'PAUSED' then 'SCHEDULED'
      when 'ACTIVE' then 'ACTIVE'
      when 'COMPLETED' then 'COMPLETED'
      else 'CANCELLED' end,
    audience_mode=case when organization_id is null then 'ALL_SUBSCRIBERS' else 'SELECTED_ORGANIZATIONS' end,
    customer_visible=status <> 'DRAFT',
    published_at=case when status <> 'DRAFT' then created_at end,
    completed_at=case when status='COMPLETED' then coalesce(ends_at,updated_at) end,
    cancelled_at=case when status='ARCHIVED' then updated_at end,
    last_activity_at=updated_at;
alter table public.maintenance_notices validate constraint maintenance_lifecycle_consistency_check;
create index maintenance_queue_idx on public.maintenance_notices(last_activity_at desc,id desc);
create index maintenance_customer_idx
  on public.maintenance_notices(product_id,maintenance_status,customer_visible,starts_at desc,id desc);

create table public.maintenance_targets (
  notice_id uuid not null references public.maintenance_notices(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key(notice_id,organization_id)
);
create index maintenance_targets_organization_idx on public.maintenance_targets(organization_id,notice_id);
insert into public.maintenance_targets(notice_id,organization_id,created_by,created_at)
select id,organization_id,created_by,created_at from public.maintenance_notices
where organization_id is not null;

create table public.maintenance_events (
  id uuid primary key default gen_random_uuid(),
  notice_id uuid not null references public.maintenance_notices(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  event_type text not null check (event_type in (
    'DRAFT_CREATED','CONTENT_UPDATED','AUDIENCE_UPDATED','SCHEDULED','UNSCHEDULED',
    'ACTIVATED','COMPLETED','CANCELLED'
  )),
  customer_visible boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index maintenance_events_notice_idx on public.maintenance_events(notice_id,created_at,id);

create or replace function private.release_customer_eligible(
  target_product_id uuid,target_audience_mode text,target_release_id uuid
) returns boolean language sql stable security definer set search_path=''
as $$
  select exists (
    select 1 from public.organization_memberships m
    join public.organizations o on o.id=m.organization_id
    join public.customer_subscriptions s on s.organization_id=m.organization_id
    where m.user_id=(select auth.uid()) and m.status='ACTIVE'
      and m.role in ('CUSTOMER_ADMIN','CUSTOMER_MEMBER')
      and o.organization_type='CUSTOMER' and o.is_active
      and s.product_id=target_product_id and s.status='ACTIVE'
      and (s.starts_on is null or s.starts_on<=current_date)
      and (s.ends_on is null or s.ends_on>=current_date)
      and (target_audience_mode='ALL_SUBSCRIBERS' or exists (
        select 1 from public.release_targets t
        where t.release_id=target_release_id and t.organization_id=m.organization_id
      ))
  );
$$;

create or replace function private.maintenance_customer_eligible(
  target_product_id uuid,target_audience_mode text,target_notice_id uuid
) returns boolean language sql stable security definer set search_path=''
as $$
  select exists (
    select 1 from public.organization_memberships m
    join public.organizations o on o.id=m.organization_id
    join public.customer_subscriptions s on s.organization_id=m.organization_id
    where m.user_id=(select auth.uid()) and m.status='ACTIVE'
      and m.role in ('CUSTOMER_ADMIN','CUSTOMER_MEMBER')
      and o.organization_type='CUSTOMER' and o.is_active
      and s.product_id=target_product_id and s.status='ACTIVE'
      and (s.starts_on is null or s.starts_on<=current_date)
      and (s.ends_on is null or s.ends_on>=current_date)
      and (target_audience_mode='ALL_SUBSCRIBERS' or exists (
        select 1 from public.maintenance_targets t
        where t.notice_id=target_notice_id and t.organization_id=m.organization_id
      ))
  );
$$;

create or replace function private.can_read_release(target_release_id uuid)
returns boolean language sql stable security definer set search_path=''
as $$
  select private.is_beauroi_user() or exists (
    select 1 from public.product_releases r
    where r.id=target_release_id and r.customer_visible
      and r.release_status in ('SCHEDULED','PUBLISHED','ARCHIVED')
      and private.release_customer_eligible(r.product_id,r.audience_mode,r.id)
  );
$$;

create or replace function private.can_read_maintenance(target_notice_id uuid)
returns boolean language sql stable security definer set search_path=''
as $$
  select private.is_beauroi_user() or exists (
    select 1 from public.maintenance_notices n
    where n.id=target_notice_id and n.customer_visible
      and n.maintenance_status in ('SCHEDULED','ACTIVE','COMPLETED','CANCELLED')
      and private.maintenance_customer_eligible(n.product_id,n.audience_mode,n.id)
  );
$$;

create or replace function private.assert_release_admin()
returns void language plpgsql stable security definer set search_path=''
as $$ begin
  if not private.is_beauroi_admin() then
    raise exception 'Release management requires an active Beau Roi administrator' using errcode='42501';
  end if;
end $$;

create or replace function public.create_release_draft(
  target_product_id uuid,target_version text,target_title text,target_summary text,target_notes text
) returns uuid language plpgsql security definer set search_path=''
as $$
declare new_id uuid;
begin
  perform private.assert_release_admin();
  if not exists(select 1 from public.products p where p.id=target_product_id and p.status='ACTIVE') then
    raise exception 'An active product is required' using errcode='P0001';
  end if;
  insert into public.product_releases(
    organization_id,product_id,version,title,summary,release_notes,status,release_status,
    audience_mode,customer_visible,created_by,last_activity_at
  ) values (
    null,target_product_id,trim(target_version),trim(target_title),nullif(trim(target_summary),''),
    nullif(trim(target_notes),''),'DRAFT','DRAFT','ALL_SUBSCRIBERS',false,(select auth.uid()),now()
  ) returning id into new_id;
  insert into public.release_events(release_id,actor_user_id,event_type)
  values(new_id,(select auth.uid()),'DRAFT_CREATED');
  insert into public.audit_events(actor_user_id,action,entity_type,entity_id,metadata)
  values((select auth.uid()),'release.created','product_release',new_id,jsonb_build_object('product_id',target_product_id,'version',trim(target_version)));
  return new_id;
end $$;

create or replace function public.update_release_content(
  target_release_id uuid,target_title text,target_summary text,target_notes text
) returns void language plpgsql security definer set search_path=''
as $$
declare item public.product_releases%rowtype;
begin
  perform private.assert_release_admin();
  select * into item from public.product_releases where id=target_release_id for update;
  if not found then raise exception 'Release unavailable' using errcode='P0001'; end if;
  if item.release_status not in ('DRAFT','SCHEDULED') then
    raise exception 'Published release content is immutable' using errcode='23514';
  end if;
  update public.product_releases set title=trim(target_title),summary=nullif(trim(target_summary),''),
    release_notes=nullif(trim(target_notes),''),updated_at=now(),last_activity_at=now()
  where id=target_release_id;
  insert into public.release_events(release_id,actor_user_id,event_type)
  values(target_release_id,(select auth.uid()),'CONTENT_UPDATED');
  insert into public.audit_events(actor_user_id,action,entity_type,entity_id)
  values((select auth.uid()),'release.content_updated','product_release',target_release_id);
end $$;

create or replace function public.set_release_audience(
  target_release_id uuid,target_mode text,target_organization_ids uuid[] default '{}'
) returns void language plpgsql security definer set search_path=''
as $$
declare item public.product_releases%rowtype; invalid_targets text;
begin
  perform private.assert_release_admin();
  select * into item from public.product_releases where id=target_release_id for update;
  if not found then raise exception 'Release unavailable' using errcode='P0001'; end if;
  if item.release_status not in ('DRAFT','SCHEDULED') then
    raise exception 'Published release audience is immutable' using errcode='23514';
  end if;
  if target_mode not in ('ALL_SUBSCRIBERS','SELECTED_ORGANIZATIONS') then
    raise exception 'Invalid release audience' using errcode='23514';
  end if;
  if target_mode='SELECTED_ORGANIZATIONS' and cardinality(target_organization_ids)=0 then
    raise exception 'Selected audience requires at least one organization' using errcode='23514';
  end if;
  select string_agg(x::text,', ' order by x) into invalid_targets
  from unnest(coalesce(target_organization_ids,'{}')) x
  where not exists(
    select 1 from public.customer_subscriptions s join public.organizations o on o.id=s.organization_id
    where s.organization_id=x and s.product_id=item.product_id and s.status='ACTIVE'
      and o.organization_type='CUSTOMER' and o.is_active
  );
  if invalid_targets is not null then
    raise exception 'Audience contains ineligible organizations: %',invalid_targets using errcode='23514';
  end if;
  delete from public.release_targets where release_id=target_release_id;
  if target_mode='SELECTED_ORGANIZATIONS' then
    insert into public.release_targets(release_id,organization_id,created_by)
    select target_release_id,x,(select auth.uid()) from unnest(target_organization_ids) x;
  end if;
  update public.product_releases set audience_mode=target_mode,organization_id=null,
    updated_at=now(),last_activity_at=now() where id=target_release_id;
  insert into public.release_events(release_id,actor_user_id,event_type,metadata)
  values(target_release_id,(select auth.uid()),'AUDIENCE_UPDATED',jsonb_build_object('mode',target_mode,'target_count',cardinality(target_organization_ids)));
  insert into public.audit_events(actor_user_id,action,entity_type,entity_id,metadata)
  values((select auth.uid()),'release.audience_updated','product_release',target_release_id,jsonb_build_object('mode',target_mode));
end $$;

create or replace function public.upsert_release_section(
  target_release_id uuid,target_section_id uuid,target_category text,target_title text,target_body text,target_sort_order integer
) returns uuid language plpgsql security definer set search_path=''
as $$
declare item public.product_releases%rowtype; result_id uuid;
begin
  perform private.assert_release_admin();
  select * into item from public.product_releases where id=target_release_id for update;
  if not found then raise exception 'Release unavailable' using errcode='P0001'; end if;
  if item.release_status not in ('DRAFT','SCHEDULED') then raise exception 'Published release sections are immutable' using errcode='23514'; end if;
  if target_section_id is null then
    insert into public.release_note_sections(release_id,category,title,body,sort_order)
    values(target_release_id,target_category,trim(target_title),trim(target_body),target_sort_order) returning id into result_id;
  else
    update public.release_note_sections set category=target_category,title=trim(target_title),body=trim(target_body),
      sort_order=target_sort_order,updated_at=now()
    where id=target_section_id and release_id=target_release_id returning id into result_id;
    if result_id is null then raise exception 'Release section unavailable' using errcode='P0001'; end if;
  end if;
  update public.product_releases set updated_at=now(),last_activity_at=now() where id=target_release_id;
  insert into public.release_events(release_id,actor_user_id,event_type)
  values(target_release_id,(select auth.uid()),'SECTION_UPDATED');
  return result_id;
end $$;

create or replace function public.transition_release(
  target_release_id uuid,target_status text,target_scheduled_for timestamptz default null
) returns void language plpgsql security definer set search_path=''
as $$
declare item public.product_releases%rowtype; event_name text;
begin
  perform private.assert_release_admin();
  select * into item from public.product_releases where id=target_release_id for update;
  if not found then raise exception 'Release unavailable' using errcode='P0001'; end if;
  if not ((item.release_status='DRAFT' and target_status in ('SCHEDULED','PUBLISHED'))
       or (item.release_status='SCHEDULED' and target_status in ('DRAFT','PUBLISHED'))
       or (item.release_status='PUBLISHED' and target_status='ARCHIVED')) then
    raise exception 'Invalid release lifecycle transition' using errcode='23514';
  end if;
  if target_status='SCHEDULED' and (target_scheduled_for is null or target_scheduled_for<=now()) then
    raise exception 'A future release schedule is required' using errcode='23514';
  end if;
  if target_status='SCHEDULED' then
    update public.product_releases set release_status='SCHEDULED',status='PAUSED',customer_visible=true,
      scheduled_for=target_scheduled_for,published_at=null,archived_at=null,released_at=target_scheduled_for,
      updated_at=now(),last_activity_at=now() where id=target_release_id;
    event_name='SCHEDULED';
  elsif target_status='DRAFT' then
    update public.product_releases set release_status='DRAFT',status='DRAFT',customer_visible=false,
      scheduled_for=null,published_at=null,archived_at=null,released_at=null,
      updated_at=now(),last_activity_at=now() where id=target_release_id;
    event_name='UNSCHEDULED';
  elsif target_status='PUBLISHED' then
    update public.product_releases set release_status='PUBLISHED',status='ACTIVE',customer_visible=true,
      scheduled_for=null,published_at=now(),archived_at=null,released_at=now(),
      updated_at=now(),last_activity_at=now() where id=target_release_id;
    event_name='PUBLISHED';
  else
    update public.product_releases set release_status='ARCHIVED',status='ARCHIVED',customer_visible=true,
      archived_at=now(),updated_at=now(),last_activity_at=now() where id=target_release_id;
    event_name='ARCHIVED';
  end if;
  insert into public.release_events(release_id,actor_user_id,event_type,customer_visible)
  values(target_release_id,(select auth.uid()),event_name,target_status in ('SCHEDULED','PUBLISHED','ARCHIVED'));
  insert into public.audit_events(actor_user_id,action,entity_type,entity_id,metadata)
  values((select auth.uid()),'release.status_changed','product_release',target_release_id,
    jsonb_build_object('before',item.release_status,'after',target_status));
end $$;

create or replace function public.link_release_feedback(target_release_id uuid,target_feedback_id uuid)
returns void language plpgsql security definer set search_path=''
as $$
declare item public.product_releases%rowtype;
begin
  perform private.assert_release_admin();
  select * into item from public.product_releases where id=target_release_id for update;
  if not found or item.release_status not in ('DRAFT','SCHEDULED') then
    raise exception 'Only draft or scheduled releases can receive feedback links' using errcode='23514';
  end if;
  if not exists(select 1 from public.feedback f where f.id=target_feedback_id and f.product_id=item.product_id
    and f.category='FEATURE_REQUEST' and f.status in ('PLANNED','IN_PROGRESS','SHIPPED')) then
    raise exception 'An accepted feature request for this product is required' using errcode='23514';
  end if;
  insert into public.release_feedback_links(release_id,feedback_id,linked_by)
  values(target_release_id,target_feedback_id,(select auth.uid())) on conflict do nothing;
  insert into public.release_events(release_id,actor_user_id,event_type)
  values(target_release_id,(select auth.uid()),'FEEDBACK_LINKED');
end $$;

create or replace function public.create_maintenance_draft(
  target_product_id uuid,target_title text,target_description text,target_starts_at timestamptz,target_ends_at timestamptz
) returns uuid language plpgsql security definer set search_path=''
as $$
declare new_id uuid;
begin
  perform private.assert_release_admin();
  if not exists(select 1 from public.products where id=target_product_id and status='ACTIVE') then
    raise exception 'An active product is required' using errcode='P0001';
  end if;
  insert into public.maintenance_notices(
    organization_id,product_id,title,description,starts_at,ends_at,status,maintenance_status,
    audience_mode,customer_visible,created_by,last_activity_at
  ) values(null,target_product_id,trim(target_title),trim(target_description),target_starts_at,target_ends_at,
    'DRAFT','DRAFT','ALL_SUBSCRIBERS',false,(select auth.uid()),now()) returning id into new_id;
  insert into public.maintenance_events(notice_id,actor_user_id,event_type)
  values(new_id,(select auth.uid()),'DRAFT_CREATED');
  insert into public.audit_events(actor_user_id,action,entity_type,entity_id,metadata)
  values((select auth.uid()),'maintenance.created','maintenance_notice',new_id,jsonb_build_object('product_id',target_product_id));
  return new_id;
end $$;

create or replace function public.update_maintenance_content(
  target_notice_id uuid,target_title text,target_description text,target_starts_at timestamptz,target_ends_at timestamptz
) returns void language plpgsql security definer set search_path=''
as $$
declare item public.maintenance_notices%rowtype;
begin
  perform private.assert_release_admin();
  select * into item from public.maintenance_notices where id=target_notice_id for update;
  if not found then raise exception 'Maintenance notice unavailable' using errcode='P0001'; end if;
  if item.maintenance_status not in ('DRAFT','SCHEDULED') then
    raise exception 'Active or completed maintenance content is immutable' using errcode='23514';
  end if;
  update public.maintenance_notices set title=trim(target_title),description=trim(target_description),
    starts_at=target_starts_at,ends_at=target_ends_at,updated_at=now(),last_activity_at=now()
  where id=target_notice_id;
  insert into public.maintenance_events(notice_id,actor_user_id,event_type,customer_visible)
  values(target_notice_id,(select auth.uid()),'CONTENT_UPDATED',item.maintenance_status='SCHEDULED');
end $$;

create or replace function public.set_maintenance_audience(
  target_notice_id uuid,target_mode text,target_organization_ids uuid[] default '{}'
) returns void language plpgsql security definer set search_path=''
as $$
declare item public.maintenance_notices%rowtype; invalid_targets text;
begin
  perform private.assert_release_admin();
  select * into item from public.maintenance_notices where id=target_notice_id for update;
  if not found then raise exception 'Maintenance notice unavailable' using errcode='P0001'; end if;
  if item.maintenance_status not in ('DRAFT','SCHEDULED') then raise exception 'Maintenance audience is immutable after activation' using errcode='23514'; end if;
  if target_mode not in ('ALL_SUBSCRIBERS','SELECTED_ORGANIZATIONS') then raise exception 'Invalid maintenance audience' using errcode='23514'; end if;
  if target_mode='SELECTED_ORGANIZATIONS' and cardinality(target_organization_ids)=0 then raise exception 'Selected audience requires at least one organization' using errcode='23514'; end if;
  select string_agg(x::text,', ' order by x) into invalid_targets from unnest(coalesce(target_organization_ids,'{}')) x
  where not exists(select 1 from public.customer_subscriptions s join public.organizations o on o.id=s.organization_id
    where s.organization_id=x and s.product_id=item.product_id and s.status='ACTIVE' and o.organization_type='CUSTOMER' and o.is_active);
  if invalid_targets is not null then raise exception 'Audience contains ineligible organizations: %',invalid_targets using errcode='23514'; end if;
  delete from public.maintenance_targets where notice_id=target_notice_id;
  if target_mode='SELECTED_ORGANIZATIONS' then
    insert into public.maintenance_targets(notice_id,organization_id,created_by)
    select target_notice_id,x,(select auth.uid()) from unnest(target_organization_ids) x;
  end if;
  update public.maintenance_notices set audience_mode=target_mode,organization_id=null,
    updated_at=now(),last_activity_at=now() where id=target_notice_id;
  insert into public.maintenance_events(notice_id,actor_user_id,event_type,metadata)
  values(target_notice_id,(select auth.uid()),'AUDIENCE_UPDATED',jsonb_build_object('mode',target_mode,'target_count',cardinality(target_organization_ids)));
end $$;

create or replace function public.transition_maintenance(target_notice_id uuid,target_status text)
returns void language plpgsql security definer set search_path=''
as $$
declare item public.maintenance_notices%rowtype; event_name text;
begin
  perform private.assert_release_admin();
  select * into item from public.maintenance_notices where id=target_notice_id for update;
  if not found then raise exception 'Maintenance notice unavailable' using errcode='P0001'; end if;
  if not ((item.maintenance_status='DRAFT' and target_status='SCHEDULED')
       or (item.maintenance_status='SCHEDULED' and target_status in ('DRAFT','ACTIVE','CANCELLED'))
       or (item.maintenance_status='ACTIVE' and target_status in ('COMPLETED','CANCELLED'))) then
    raise exception 'Invalid maintenance lifecycle transition' using errcode='23514';
  end if;
  if target_status='SCHEDULED' and item.starts_at<=now() then raise exception 'Scheduled maintenance must start in the future' using errcode='23514'; end if;
  if target_status='DRAFT' then
    update public.maintenance_notices set maintenance_status='DRAFT',status='DRAFT',customer_visible=false,
      published_at=null,completed_at=null,cancelled_at=null,updated_at=now(),last_activity_at=now() where id=target_notice_id;
    event_name='UNSCHEDULED';
  elsif target_status='SCHEDULED' then
    update public.maintenance_notices set maintenance_status='SCHEDULED',status='PAUSED',customer_visible=true,
      published_at=now(),updated_at=now(),last_activity_at=now() where id=target_notice_id;
    event_name='SCHEDULED';
  elsif target_status='ACTIVE' then
    update public.maintenance_notices set maintenance_status='ACTIVE',status='ACTIVE',customer_visible=true,
      published_at=coalesce(published_at,now()),updated_at=now(),last_activity_at=now() where id=target_notice_id;
    event_name='ACTIVATED';
  elsif target_status='COMPLETED' then
    update public.maintenance_notices set maintenance_status='COMPLETED',status='COMPLETED',customer_visible=true,
      completed_at=now(),updated_at=now(),last_activity_at=now() where id=target_notice_id;
    event_name='COMPLETED';
  else
    update public.maintenance_notices set maintenance_status='CANCELLED',status='ARCHIVED',customer_visible=true,
      cancelled_at=now(),updated_at=now(),last_activity_at=now() where id=target_notice_id;
    event_name='CANCELLED';
  end if;
  insert into public.maintenance_events(notice_id,actor_user_id,event_type,customer_visible)
  values(target_notice_id,(select auth.uid()),event_name,target_status<>'DRAFT');
  insert into public.audit_events(actor_user_id,action,entity_type,entity_id,metadata)
  values((select auth.uid()),'maintenance.status_changed','maintenance_notice',target_notice_id,
    jsonb_build_object('before',item.maintenance_status,'after',target_status));
end $$;

create or replace function private.guard_release_history()
returns trigger language plpgsql set search_path=''
as $$ begin raise exception 'Release history is append-only' using errcode='42501'; end $$;
create trigger release_events_append_only before update on public.release_events
for each row execute function private.guard_release_history();
create trigger maintenance_events_append_only before update on public.maintenance_events
for each row execute function private.guard_release_history();

create or replace function private.release_event_notifications()
returns trigger language plpgsql security definer set search_path=''
as $$
declare item public.product_releases%rowtype; recipient record; heading text;
begin
  if not new.customer_visible or new.event_type not in ('SCHEDULED','PUBLISHED') then return new; end if;
  select * into item from public.product_releases where id=new.release_id;
  heading=case new.event_type when 'SCHEDULED' then 'Upcoming product release' else 'Product release published' end;
  for recipient in
    select distinct m.organization_id,m.user_id from public.organization_memberships m
    join public.organizations o on o.id=m.organization_id
    join public.customer_subscriptions s on s.organization_id=m.organization_id
    where m.status='ACTIVE' and m.role in ('CUSTOMER_ADMIN','CUSTOMER_MEMBER')
      and o.organization_type='CUSTOMER' and o.is_active and s.product_id=item.product_id and s.status='ACTIVE'
      and (s.starts_on is null or s.starts_on<=current_date) and (s.ends_on is null or s.ends_on>=current_date)
      and (item.audience_mode='ALL_SUBSCRIBERS' or exists(select 1 from public.release_targets t where t.release_id=item.id and t.organization_id=m.organization_id))
  loop
    insert into public.notifications(organization_id,user_id,title,body,category,link_path)
    values(recipient.organization_id,recipient.user_id,heading,left(item.title,240),'RELEASE','/portal/releases/'||item.id);
  end loop;
  return new;
end $$;
create trigger release_events_notify after insert on public.release_events
for each row execute function private.release_event_notifications();

create or replace function private.maintenance_event_notifications()
returns trigger language plpgsql security definer set search_path=''
as $$
declare item public.maintenance_notices%rowtype; recipient record; heading text;
begin
  if not new.customer_visible or new.event_type not in ('SCHEDULED','CONTENT_UPDATED','ACTIVATED','COMPLETED','CANCELLED') then return new; end if;
  select * into item from public.maintenance_notices where id=new.notice_id;
  heading=case new.event_type when 'SCHEDULED' then 'Maintenance scheduled' when 'CONTENT_UPDATED' then 'Maintenance updated' when 'ACTIVATED' then 'Maintenance started'
    when 'COMPLETED' then 'Maintenance completed' else 'Maintenance cancelled' end;
  for recipient in
    select distinct m.organization_id,m.user_id from public.organization_memberships m
    join public.organizations o on o.id=m.organization_id
    join public.customer_subscriptions s on s.organization_id=m.organization_id
    where m.status='ACTIVE' and m.role in ('CUSTOMER_ADMIN','CUSTOMER_MEMBER')
      and o.organization_type='CUSTOMER' and o.is_active and s.product_id=item.product_id and s.status='ACTIVE'
      and (s.starts_on is null or s.starts_on<=current_date) and (s.ends_on is null or s.ends_on>=current_date)
      and (item.audience_mode='ALL_SUBSCRIBERS' or exists(select 1 from public.maintenance_targets t where t.notice_id=item.id and t.organization_id=m.organization_id))
  loop
    insert into public.notifications(organization_id,user_id,title,body,category,link_path)
    values(recipient.organization_id,recipient.user_id,heading,left(item.title,240),'RELEASE','/portal/releases');
  end loop;
  return new;
end $$;
create trigger maintenance_events_notify after insert on public.maintenance_events
for each row execute function private.maintenance_event_notifications();

alter table public.release_targets enable row level security;
alter table public.release_note_sections enable row level security;
alter table public.release_events enable row level security;
alter table public.release_feedback_links enable row level security;
alter table public.maintenance_targets enable row level security;
alter table public.maintenance_events enable row level security;

drop policy if exists releases_read on public.product_releases;
drop policy if exists releases_insert_beauroi on public.product_releases;
drop policy if exists releases_update_beauroi on public.product_releases;
drop policy if exists releases_delete_beauroi on public.product_releases;
create policy releases_read on public.product_releases for select to authenticated
using(private.can_read_release(id));

drop policy if exists maintenance_read on public.maintenance_notices;
drop policy if exists maintenance_insert_beauroi on public.maintenance_notices;
drop policy if exists maintenance_update_beauroi on public.maintenance_notices;
drop policy if exists maintenance_delete_beauroi on public.maintenance_notices;
create policy maintenance_read on public.maintenance_notices for select to authenticated
using(private.can_read_maintenance(id));

create policy release_sections_read on public.release_note_sections for select to authenticated
using(private.can_read_release(release_id));
create policy release_events_read on public.release_events for select to authenticated
using(private.can_read_release(release_id) and (customer_visible or private.is_beauroi_user()));
create policy maintenance_events_read on public.maintenance_events for select to authenticated
using(private.can_read_maintenance(notice_id) and (customer_visible or private.is_beauroi_user()));
create policy release_targets_staff_read on public.release_targets for select to authenticated
using(private.is_beauroi_user());
create policy maintenance_targets_staff_read on public.maintenance_targets for select to authenticated
using(private.is_beauroi_user());
create policy release_feedback_links_staff_read on public.release_feedback_links for select to authenticated
using(private.is_beauroi_user());

revoke all on table public.product_releases,public.release_targets,public.release_note_sections,
  public.release_events,public.release_feedback_links,public.maintenance_notices,
  public.maintenance_targets,public.maintenance_events from public,anon,authenticated;
grant select on table public.product_releases,public.release_note_sections,public.release_events,
  public.maintenance_notices,public.maintenance_events to authenticated;
grant select on table public.release_targets,public.release_feedback_links,public.maintenance_targets to authenticated;
grant all on table public.product_releases,public.release_targets,public.release_note_sections,
  public.release_events,public.release_feedback_links,public.maintenance_notices,
  public.maintenance_targets,public.maintenance_events to service_role;

revoke all on function private.release_customer_eligible(uuid,text,uuid),
  private.maintenance_customer_eligible(uuid,text,uuid),private.can_read_release(uuid),
  private.can_read_maintenance(uuid),private.assert_release_admin(),private.guard_release_history(),
  private.release_event_notifications(),private.maintenance_event_notifications()
  from public,anon,authenticated;
grant execute on function private.can_read_release(uuid),private.can_read_maintenance(uuid) to authenticated;

revoke all on function public.create_release_draft(uuid,text,text,text,text),
  public.update_release_content(uuid,text,text,text),public.set_release_audience(uuid,text,uuid[]),
  public.upsert_release_section(uuid,uuid,text,text,text,integer),
  public.transition_release(uuid,text,timestamptz),public.link_release_feedback(uuid,uuid),
  public.create_maintenance_draft(uuid,text,text,timestamptz,timestamptz),
  public.update_maintenance_content(uuid,text,text,timestamptz,timestamptz),
  public.set_maintenance_audience(uuid,text,uuid[]),public.transition_maintenance(uuid,text)
  from public,anon,authenticated;
grant execute on function public.create_release_draft(uuid,text,text,text,text),
  public.update_release_content(uuid,text,text,text),public.set_release_audience(uuid,text,uuid[]),
  public.upsert_release_section(uuid,uuid,text,text,text,integer),
  public.transition_release(uuid,text,timestamptz),public.link_release_feedback(uuid,uuid),
  public.create_maintenance_draft(uuid,text,text,timestamptz,timestamptz),
  public.update_maintenance_content(uuid,text,text,timestamptz,timestamptz),
  public.set_maintenance_audience(uuid,text,uuid[]),public.transition_maintenance(uuid,text)
  to authenticated;

comment on table public.release_targets is 'Private relational rollout targeting. Customer roles never receive target rows.';
comment on table public.release_events is 'Append-only release history. Only explicitly customer-visible events cross the customer RLS boundary.';
comment on table public.release_feedback_links is 'Staff-only foundation connecting accepted feature requests to future releases.';
comment on column public.product_releases.status is 'Legacy lifecycle mirror retained for deployed views; release_status is authoritative.';
comment on column public.maintenance_notices.status is 'Legacy lifecycle mirror retained for deployed compatibility; maintenance_status is authoritative.';
