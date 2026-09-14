-- Product creation is a platform-governance operation. Existing authenticated
-- write policies were broader than the product-management contract, so direct
-- Data API writes are removed in favour of one narrowly scoped RPC.

do $$
begin
  if exists (
    select 1
    from public.products
    where code !~ '^[A-Z][A-Z0-9_-]{1,39}$'
       or name <> btrim(name)
       or char_length(name) not between 2 and 160
       or (description is not null and char_length(description) > 2000)
  ) then
    raise exception 'Existing products must satisfy the product code, name, and description contract before this migration can continue';
  end if;
end;
$$;

alter table public.products
  add constraint products_code_format_check
    check (code ~ '^[A-Z][A-Z0-9_-]{1,39}$'),
  add constraint products_name_format_check
    check (name = btrim(name) and char_length(name) between 2 and 160),
  add constraint products_description_length_check
    check (description is null or char_length(description) <= 2000);

drop policy if exists products_insert_beauroi on public.products;
drop policy if exists products_update_beauroi on public.products;
drop policy if exists products_delete_beauroi on public.products;

revoke insert, update, delete on table public.products from authenticated;

create or replace function public.create_product(
  product_code text,
  product_name text,
  product_description text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  created_product_id uuid;
  normalized_code text := upper(btrim(product_code));
  normalized_name text := btrim(product_name);
  normalized_description text := nullif(btrim(product_description), '');
begin
  if not (select private.is_beauroi_admin()) then
    raise exception 'Product creation requires an active Beau Roi administrator'
      using errcode = '42501';
  end if;

  if normalized_code is null or normalized_code !~ '^[A-Z][A-Z0-9_-]{1,39}$' then
    raise exception 'Product code must be 2 to 40 characters using letters, numbers, hyphens, or underscores'
      using errcode = '23514';
  end if;

  if normalized_name is null or char_length(normalized_name) not between 2 and 160 then
    raise exception 'Product name must be between 2 and 160 characters'
      using errcode = '23514';
  end if;

  if normalized_description is not null and char_length(normalized_description) > 2000 then
    raise exception 'Product description must not exceed 2000 characters'
      using errcode = '23514';
  end if;

  insert into public.products (code, name, description, status, created_by)
  values (normalized_code, normalized_name, normalized_description, 'ACTIVE', actor_id)
  returning id into created_product_id;

  insert into public.audit_events (
    actor_user_id,
    action,
    entity_type,
    entity_id,
    metadata
  ) values (
    actor_id,
    'PRODUCT_CREATED',
    'product',
    created_product_id,
    jsonb_build_object('code', normalized_code, 'name', normalized_name, 'status', 'ACTIVE')
  );

  return created_product_id;
end;
$$;

revoke all on function public.create_product(text, text, text) from public, anon;
grant execute on function public.create_product(text, text, text) to authenticated;

-- A workflow is intentionally scoped to an active customer subscription.
-- Provisioning that relationship is also an administrator action; retain the
-- existing read policy for staff and the subscribing customer.
drop policy if exists beauroi_insert on public.customer_subscriptions;
drop policy if exists beauroi_update on public.customer_subscriptions;
drop policy if exists beauroi_delete on public.customer_subscriptions;
revoke insert, update, delete on table public.customer_subscriptions from authenticated;

create or replace function public.activate_customer_product(
  target_organization_id uuid,
  target_product_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  subscription_id uuid;
begin
  if not (select private.is_beauroi_admin()) then
    raise exception 'Customer product provisioning requires an active Beau Roi administrator'
      using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.organizations o
    where o.id = target_organization_id
      and o.organization_type = 'CUSTOMER'
      and o.is_active
  ) or not exists (
    select 1 from public.products p
    where p.id = target_product_id and p.status = 'ACTIVE'
  ) then
    raise exception 'An active customer organization and product are required'
      using errcode = '23514';
  end if;

  insert into public.customer_subscriptions (
    organization_id, product_id, status, starts_on
  ) values (
    target_organization_id, target_product_id, 'ACTIVE', current_date
  ) returning id into subscription_id;

  insert into public.audit_events (
    organization_id, actor_user_id, action, entity_type, entity_id, metadata
  ) values (
    target_organization_id, (select auth.uid()), 'CUSTOMER_PRODUCT_ACTIVATED',
    'customer_subscription', subscription_id,
    jsonb_build_object('product_id', target_product_id)
  );

  return subscription_id;
end;
$$;

revoke all on function public.activate_customer_product(uuid, uuid) from public, anon;
grant execute on function public.activate_customer_product(uuid, uuid) to authenticated;
