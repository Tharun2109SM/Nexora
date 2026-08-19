-- NEXORA Milestone 7: secure knowledge management built on the original article table.

do $$
declare invalid_ids text;
declare duplicate_slugs text;
begin
  select string_agg(id::text, ', ' order by id) into invalid_ids
  from public.knowledge_base_articles
  where char_length(btrim(title)) not between 3 and 240
     or char_length(btrim(body)) not between 1 and 100000
     or char_length(slug) not between 1 and 180;
  if invalid_ids is not null then
    raise exception 'Milestone 7 preflight: invalid knowledge article content: %', invalid_ids
      using errcode = '23514';
  end if;

  select string_agg(slug, ', ' order by slug) into duplicate_slugs
  from (
    select lower(slug) slug
    from public.knowledge_base_articles
    where organization_id is null
    group by lower(slug)
    having count(*) > 1
  ) duplicates;
  if duplicate_slugs is not null then
    raise exception 'Milestone 7 preflight: duplicate global knowledge article slugs: %', duplicate_slugs
      using errcode = '23505';
  end if;
end $$;

create table public.knowledge_categories (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code = upper(code) and code ~ '^[A-Z][A-Z0-9_]{1,63}$'),
  name text not null check (char_length(btrim(name)) between 2 and 120),
  description text check (description is null or char_length(btrim(description)) between 1 and 1000),
  product_id uuid references public.products(id) on delete restrict,
  is_active boolean not null default true,
  sort_order integer not null default 0 check (sort_order between 0 and 100000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index knowledge_categories_active_order_idx
  on public.knowledge_categories(product_id, sort_order, name, id) where is_active;

alter table public.knowledge_base_articles
  add column article_status text,
  add column audience_mode text,
  add column article_type text not null default 'GUIDE',
  add column category_id uuid references public.knowledge_categories(id) on delete restrict,
  add column external_url text,
  add column reviewed_by uuid references auth.users(id) on delete set null,
  add column published_by uuid references auth.users(id) on delete set null,
  add column archived_at timestamptz,
  add column last_activity_at timestamptz;

update public.knowledge_base_articles
set article_status = status::text,
    audience_mode = case
      when organization_id is not null then 'SELECTED_ORGANIZATION'
      when audience = 'INTERNAL' then 'INTERNAL'
      when product_id is not null then 'PRODUCT_SCOPED'
      else 'ALL_CUSTOMERS'
    end,
    published_at = case when status = 'PUBLISHED' then coalesce(published_at, updated_at) else null end,
    archived_at = case when status = 'ARCHIVED' then updated_at else null end,
    last_activity_at = updated_at;

alter table public.knowledge_base_articles
  alter column article_status set not null,
  alter column audience_mode set not null,
  alter column last_activity_at set default now(),
  alter column last_activity_at set not null,
  add constraint knowledge_article_status_check
    check (article_status in ('DRAFT','IN_REVIEW','PUBLISHED','ARCHIVED')),
  add constraint knowledge_article_audience_check
    check (audience_mode in ('INTERNAL','ALL_CUSTOMERS','PRODUCT_SCOPED','SELECTED_ORGANIZATION')),
  add constraint knowledge_article_type_check
    check (article_type in ('GUIDE','FAQ','REFERENCE','TROUBLESHOOTING','ANNOUNCEMENT')),
  add constraint knowledge_article_title_check check (char_length(btrim(title)) between 3 and 240),
  add constraint knowledge_article_summary_check
    check (summary is null or char_length(btrim(summary)) between 1 and 2000),
  add constraint knowledge_article_body_check check (char_length(btrim(body)) between 1 and 100000),
  add constraint knowledge_article_slug_check check (char_length(slug) between 1 and 180),
  add constraint knowledge_article_external_url_check
    check (external_url is null or (char_length(external_url) <= 2048 and external_url ~* '^https?://')),
  add constraint knowledge_article_audience_scope_check check (
    (audience_mode = 'ALL_CUSTOMERS' and organization_id is null)
    or (audience_mode = 'PRODUCT_SCOPED' and product_id is not null and organization_id is null)
    or (audience_mode = 'SELECTED_ORGANIZATION' and organization_id is not null)
    or (audience_mode = 'INTERNAL' and organization_id is null)
  ),
  add constraint knowledge_article_lifecycle_time_check check (
    (article_status = 'PUBLISHED' and published_at is not null and archived_at is null)
    or (article_status = 'ARCHIVED' and archived_at is not null)
    or (article_status in ('DRAFT','IN_REVIEW') and published_at is null and archived_at is null)
  );

alter table public.knowledge_base_articles
  add column search_document tsvector generated always as (
    to_tsvector('english'::regconfig,
      coalesce(title,'') || ' ' || coalesce(summary,'') || ' ' || coalesce(body,''))
  ) stored;
create index knowledge_articles_search_idx on public.knowledge_base_articles using gin(search_document);
create index knowledge_articles_portfolio_idx
  on public.knowledge_base_articles(article_status, last_activity_at desc, id);
create index knowledge_articles_customer_product_idx
  on public.knowledge_base_articles(product_id, published_at desc, id)
  where article_status = 'PUBLISHED';
create unique index knowledge_articles_global_slug_idx
  on public.knowledge_base_articles(lower(slug)) where organization_id is null;

create table public.knowledge_article_events (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references public.knowledge_base_articles(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  event_type text not null check (event_type in (
    'ARTICLE_CREATED','SUBMITTED_FOR_REVIEW','RETURNED_TO_DRAFT','PUBLISHED',
    'UPDATED','ARCHIVED','AUDIENCE_CHANGED','CATEGORY_CHANGED'
  )),
  customer_visible boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index knowledge_article_events_article_idx
  on public.knowledge_article_events(article_id, created_at, id);

create or replace function private.assert_knowledge_admin()
returns void language plpgsql security definer set search_path = ''
as $$ begin
  if not private.is_beauroi_admin() then
    raise exception 'Knowledge management requires an active Beau Roi administrator' using errcode='42501';
  end if;
end $$;

create or replace function private.can_read_knowledge_article(target_article_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists(
    select 1 from public.knowledge_base_articles article
    where article.id = target_article_id and (
      private.is_beauroi_user()
      or (
        article.article_status = 'PUBLISHED'
        and exists(
          select 1 from public.organization_memberships membership
          join public.organizations organization on organization.id = membership.organization_id
          where membership.user_id = (select auth.uid()) and membership.status = 'ACTIVE'
            and membership.role in ('CUSTOMER_ADMIN','CUSTOMER_MEMBER')
            and organization.organization_type = 'CUSTOMER' and organization.is_active
            and (
              article.audience_mode = 'ALL_CUSTOMERS'
              or (article.audience_mode = 'SELECTED_ORGANIZATION'
                  and article.organization_id = membership.organization_id
                  and (article.product_id is null or exists(
                    select 1 from public.customer_subscriptions subscription
                    where subscription.organization_id = membership.organization_id
                      and subscription.product_id = article.product_id and subscription.status = 'ACTIVE'
                      and (subscription.starts_on is null or subscription.starts_on <= current_date)
                      and (subscription.ends_on is null or subscription.ends_on >= current_date))))
              or (article.audience_mode = 'PRODUCT_SCOPED' and exists(
                select 1 from public.customer_subscriptions subscription
                where subscription.organization_id = membership.organization_id
                  and subscription.product_id = article.product_id and subscription.status = 'ACTIVE'
                  and (subscription.starts_on is null or subscription.starts_on <= current_date)
                  and (subscription.ends_on is null or subscription.ends_on >= current_date)))
            )
        )
      )
    )
  );
$$;

create or replace function private.guard_knowledge_identity()
returns trigger language plpgsql set search_path = ''
as $$ begin
  if new.id <> old.id or new.slug <> old.slug or new.author_user_id is distinct from old.author_user_id
     or new.created_at <> old.created_at then
    raise exception 'Knowledge article identity and authorship are immutable' using errcode='42501';
  end if;
  return new;
end $$;
create trigger knowledge_article_identity_guard before update on public.knowledge_base_articles
for each row execute function private.guard_knowledge_identity();

create or replace function private.guard_knowledge_history()
returns trigger language plpgsql set search_path = ''
as $$ begin raise exception 'Knowledge article history is append-only' using errcode='42501'; end $$;
create trigger knowledge_events_append_only before update on public.knowledge_article_events
for each row execute function private.guard_knowledge_history();

create or replace function public.create_knowledge_category(
  target_code text, target_name text, target_description text default null,
  target_product_id uuid default null, target_sort_order integer default 0
) returns uuid language plpgsql security definer set search_path = ''
as $$ declare new_id uuid; begin
  perform private.assert_knowledge_admin();
  if target_product_id is not null and not exists(select 1 from public.products where id=target_product_id and status='ACTIVE') then
    raise exception 'An active product is required' using errcode='23514';
  end if;
  insert into public.knowledge_categories(code,name,description,product_id,sort_order)
  values(upper(btrim(target_code)),btrim(target_name),nullif(btrim(target_description),''),target_product_id,target_sort_order)
  returning id into new_id;
  return new_id;
end $$;

create or replace function public.set_knowledge_category_active(target_category_id uuid, target_active boolean)
returns void language plpgsql security definer set search_path = ''
as $$ begin
  perform private.assert_knowledge_admin();
  update public.knowledge_categories set is_active=target_active,updated_at=now() where id=target_category_id;
  if not found then raise exception 'Knowledge category unavailable' using errcode='P0001'; end if;
end $$;

create or replace function public.create_knowledge_article(
  target_title text, target_summary text, target_body text, target_article_type text,
  target_category_id uuid, target_product_id uuid, target_audience text,
  target_organization_id uuid default null, target_external_url text default null
) returns uuid language plpgsql security definer set search_path = ''
as $$ declare new_id uuid := gen_random_uuid(); category_product uuid; generated_slug text; begin
  perform private.assert_knowledge_admin();
  if target_product_id is not null and not exists(select 1 from public.products where id=target_product_id and status='ACTIVE') then
    raise exception 'An active product is required' using errcode='23514'; end if;
  if target_category_id is not null then
    select product_id into category_product from public.knowledge_categories where id=target_category_id and is_active;
    if not found or (category_product is not null and category_product is distinct from target_product_id) then
      raise exception 'An active compatible category is required' using errcode='23514'; end if;
  end if;
  if target_organization_id is not null and not exists(select 1 from public.organizations where id=target_organization_id and organization_type='CUSTOMER' and is_active) then
    raise exception 'An active customer organization is required' using errcode='23514'; end if;
  generated_slug := trim(both '-' from regexp_replace(lower(btrim(target_title)),'[^a-z0-9]+','-','g')) || '-' || substr(replace(new_id::text,'-',''),1,8);
  insert into public.knowledge_base_articles(
    id,organization_id,product_id,slug,title,summary,body,status,audience,author_user_id,
    article_status,audience_mode,article_type,category_id,external_url,last_activity_at
  ) values(
    new_id,target_organization_id,target_product_id,generated_slug,btrim(target_title),nullif(btrim(target_summary),''),
    btrim(target_body),'DRAFT',case when target_audience='INTERNAL' then 'INTERNAL' else 'CUSTOMER' end,
    (select auth.uid()),'DRAFT',target_audience,target_article_type,
    target_category_id,nullif(btrim(target_external_url),''),now());
  insert into public.knowledge_article_events(article_id,actor_user_id,event_type)
  values(new_id,(select auth.uid()),'ARTICLE_CREATED');
  insert into public.audit_events(actor_user_id,action,entity_type,entity_id,metadata)
  values((select auth.uid()),'knowledge.created','knowledge_article',new_id,
    jsonb_build_object('article_type',target_article_type,'audience',target_audience,'product_id',target_product_id));
  return new_id;
end $$;

create or replace function public.update_knowledge_article_content(
  target_article_id uuid,target_title text,target_summary text,target_body text,target_external_url text
) returns void language plpgsql security definer set search_path = ''
as $$ declare item public.knowledge_base_articles%rowtype; begin
  perform private.assert_knowledge_admin();
  select * into item from public.knowledge_base_articles where id=target_article_id for update;
  if not found then raise exception 'Knowledge article unavailable' using errcode='P0001'; end if;
  if item.article_status not in ('DRAFT','IN_REVIEW') then
    raise exception 'Published or archived article content is immutable' using errcode='23514'; end if;
  update public.knowledge_base_articles set title=btrim(target_title),summary=nullif(btrim(target_summary),''),
    body=btrim(target_body),external_url=nullif(btrim(target_external_url),''),updated_at=now(),last_activity_at=now()
  where id=target_article_id;
  insert into public.knowledge_article_events(article_id,actor_user_id,event_type)
  values(target_article_id,(select auth.uid()),'UPDATED');
end $$;

create or replace function public.update_knowledge_article_scope(
  target_article_id uuid,target_article_type text,target_category_id uuid,target_product_id uuid,
  target_audience text,target_organization_id uuid default null
) returns void language plpgsql security definer set search_path = ''
as $$ declare item public.knowledge_base_articles%rowtype; category_product uuid; event_name text; begin
  perform private.assert_knowledge_admin();
  select * into item from public.knowledge_base_articles where id=target_article_id for update;
  if not found then raise exception 'Knowledge article unavailable' using errcode='P0001'; end if;
  if item.article_status not in ('DRAFT','IN_REVIEW') then raise exception 'Published article scope is immutable' using errcode='23514'; end if;
  if target_product_id is not null and not exists(select 1 from public.products where id=target_product_id and status='ACTIVE') then raise exception 'An active product is required' using errcode='23514'; end if;
  if target_category_id is not null then
    select product_id into category_product from public.knowledge_categories where id=target_category_id and is_active;
    if not found or (category_product is not null and category_product is distinct from target_product_id) then raise exception 'An active compatible category is required' using errcode='23514'; end if;
  end if;
  if target_organization_id is not null and not exists(select 1 from public.organizations where id=target_organization_id and organization_type='CUSTOMER' and is_active) then raise exception 'An active customer organization is required' using errcode='23514'; end if;
  event_name := case when item.audience_mode is distinct from target_audience or item.organization_id is distinct from target_organization_id then 'AUDIENCE_CHANGED' else 'CATEGORY_CHANGED' end;
  update public.knowledge_base_articles set article_type=target_article_type,category_id=target_category_id,
    product_id=target_product_id,audience_mode=target_audience,organization_id=target_organization_id,
    updated_at=now(),last_activity_at=now() where id=target_article_id;
  insert into public.knowledge_article_events(article_id,actor_user_id,event_type)
  values(target_article_id,(select auth.uid()),event_name);
end $$;

create or replace function public.transition_knowledge_article(target_article_id uuid,target_status text)
returns void language plpgsql security definer set search_path = ''
as $$ declare item public.knowledge_base_articles%rowtype; event_name text; begin
  perform private.assert_knowledge_admin();
  select * into item from public.knowledge_base_articles where id=target_article_id for update;
  if not found then raise exception 'Knowledge article unavailable' using errcode='P0001'; end if;
  if not ((item.article_status='DRAFT' and target_status='IN_REVIEW')
    or (item.article_status='IN_REVIEW' and target_status in ('DRAFT','PUBLISHED'))
    or (item.article_status='PUBLISHED' and target_status='ARCHIVED')) then
    raise exception 'Invalid knowledge article lifecycle transition' using errcode='23514'; end if;
  if target_status='PUBLISHED' and item.audience_mode='PRODUCT_SCOPED' and item.product_id is null then
    raise exception 'Product-scoped publication requires a product' using errcode='23514'; end if;
  update public.knowledge_base_articles set article_status=target_status,
    status=case target_status when 'PUBLISHED' then 'PUBLISHED'::public.article_status when 'ARCHIVED' then 'ARCHIVED'::public.article_status else 'DRAFT'::public.article_status end,
    reviewed_by=case when target_status='IN_REVIEW' then (select auth.uid()) else reviewed_by end,
    published_by=case when target_status='PUBLISHED' then (select auth.uid()) else published_by end,
    published_at=case when target_status='PUBLISHED' then now() else null end,
    archived_at=case when target_status='ARCHIVED' then now() else null end,
    updated_at=now(),last_activity_at=now() where id=target_article_id;
  event_name := case target_status when 'IN_REVIEW' then 'SUBMITTED_FOR_REVIEW' when 'DRAFT' then 'RETURNED_TO_DRAFT' when 'PUBLISHED' then 'PUBLISHED' else 'ARCHIVED' end;
  insert into public.knowledge_article_events(article_id,actor_user_id,event_type,customer_visible)
  values(target_article_id,(select auth.uid()),event_name,target_status in ('PUBLISHED','ARCHIVED'));
  insert into public.audit_events(actor_user_id,action,entity_type,entity_id,metadata)
  values((select auth.uid()),'knowledge.status_changed','knowledge_article',target_article_id,
    jsonb_build_object('before',item.article_status,'after',target_status));
end $$;

create or replace function private.knowledge_publish_notifications()
returns trigger language plpgsql security definer set search_path = ''
as $$ declare item public.knowledge_base_articles%rowtype; recipient record; begin
  if new.event_type <> 'PUBLISHED' then return new; end if;
  select * into item from public.knowledge_base_articles where id=new.article_id;
  if item.audience_mode='INTERNAL' then return new; end if;
  for recipient in
    select distinct membership.organization_id,membership.user_id
    from public.organization_memberships membership
    join public.organizations organization on organization.id=membership.organization_id
    where membership.status='ACTIVE' and membership.role in ('CUSTOMER_ADMIN','CUSTOMER_MEMBER')
      and organization.organization_type='CUSTOMER' and organization.is_active
      and (item.audience_mode='ALL_CUSTOMERS'
        or (item.audience_mode='SELECTED_ORGANIZATION' and item.organization_id=membership.organization_id
          and (item.product_id is null or exists(select 1 from public.customer_subscriptions subscription where subscription.organization_id=membership.organization_id and subscription.product_id=item.product_id and subscription.status='ACTIVE'
            and (subscription.starts_on is null or subscription.starts_on <= current_date)
            and (subscription.ends_on is null or subscription.ends_on >= current_date))))
        or (item.audience_mode='PRODUCT_SCOPED' and exists(select 1 from public.customer_subscriptions subscription where subscription.organization_id=membership.organization_id and subscription.product_id=item.product_id and subscription.status='ACTIVE'
          and (subscription.starts_on is null or subscription.starts_on <= current_date)
          and (subscription.ends_on is null or subscription.ends_on >= current_date))))
  loop
    insert into public.notifications(organization_id,user_id,title,body,category,link_path)
    values(recipient.organization_id,recipient.user_id,'New knowledge article',left(item.title,240),'KNOWLEDGE','/portal/knowledge-base/'||item.id);
  end loop;
  return new;
end $$;
create trigger knowledge_publish_notify after insert on public.knowledge_article_events
for each row execute function private.knowledge_publish_notifications();

alter table public.knowledge_categories enable row level security;
alter table public.knowledge_article_events enable row level security;
drop policy if exists articles_read on public.knowledge_base_articles;
drop policy if exists articles_insert_beauroi on public.knowledge_base_articles;
drop policy if exists articles_update_beauroi on public.knowledge_base_articles;
drop policy if exists articles_delete_beauroi on public.knowledge_base_articles;
create policy knowledge_articles_read on public.knowledge_base_articles for select to authenticated
using(private.can_read_knowledge_article(id));
create policy knowledge_categories_read on public.knowledge_categories for select to authenticated
using(
  private.is_beauroi_user()
  or (
    is_active
    and (
      product_id is null
      or exists (
        select 1
        from public.organization_memberships membership
        join public.customer_subscriptions subscription
          on subscription.organization_id = membership.organization_id
        where membership.user_id = (select auth.uid())
          and membership.status = 'ACTIVE'
          and membership.role in ('CUSTOMER_ADMIN','CUSTOMER_MEMBER')
          and subscription.product_id = knowledge_categories.product_id
          and subscription.status = 'ACTIVE'
          and (subscription.starts_on is null or subscription.starts_on <= current_date)
          and (subscription.ends_on is null or subscription.ends_on >= current_date)
      )
    )
  )
);
create policy knowledge_events_staff_read on public.knowledge_article_events for select to authenticated
using(private.is_beauroi_user());

revoke all on table public.knowledge_base_articles,public.knowledge_categories,public.knowledge_article_events from public,anon,authenticated;
grant select (
  id, organization_id, product_id, slug, title, summary, body, status, audience,
  published_at, created_at, updated_at, article_status, audience_mode, article_type,
  category_id, external_url, archived_at, last_activity_at, search_document
) on public.knowledge_base_articles to authenticated;
grant select on table public.knowledge_categories to authenticated;
grant select on table public.knowledge_article_events to authenticated;
grant all on table public.knowledge_base_articles,public.knowledge_categories,public.knowledge_article_events to service_role;

revoke all on function private.assert_knowledge_admin(),private.can_read_knowledge_article(uuid),
  private.guard_knowledge_identity(),private.guard_knowledge_history(),private.knowledge_publish_notifications()
  from public,anon,authenticated;
grant execute on function private.can_read_knowledge_article(uuid) to authenticated;
revoke all on function public.create_knowledge_category(text,text,text,uuid,integer),
  public.set_knowledge_category_active(uuid,boolean),
  public.create_knowledge_article(text,text,text,text,uuid,uuid,text,uuid,text),
  public.update_knowledge_article_content(uuid,text,text,text,text),
  public.update_knowledge_article_scope(uuid,text,uuid,uuid,text,uuid),
  public.transition_knowledge_article(uuid,text) from public,anon,authenticated;
grant execute on function public.create_knowledge_category(text,text,text,uuid,integer),
  public.set_knowledge_category_active(uuid,boolean),
  public.create_knowledge_article(text,text,text,text,uuid,uuid,text,uuid,text),
  public.update_knowledge_article_content(uuid,text,text,text,text),
  public.update_knowledge_article_scope(uuid,text,uuid,uuid,text,uuid),
  public.transition_knowledge_article(uuid,text) to authenticated;

comment on column public.knowledge_base_articles.search_document is 'Indexed search surface; API searches remain constrained by article RLS.';
comment on table public.knowledge_article_events is 'Append-only staff article history. Bodies are never copied into metadata.';
