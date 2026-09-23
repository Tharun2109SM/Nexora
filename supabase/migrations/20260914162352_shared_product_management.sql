-- Extend the existing catalog and customer_subscriptions; preserve historical rows.
alter table public.products add column updated_by uuid references auth.users(id) on delete set null;
alter table public.customer_subscriptions
  add column created_by uuid references auth.users(id) on delete set null,
  add column updated_by uuid references auth.users(id) on delete set null;
alter table public.customer_subscriptions
  alter column created_by set default auth.uid(),
  alter column updated_by set default auth.uid();
create index if not exists customer_subscriptions_organization_status_idx
  on public.customer_subscriptions (organization_id, status, product_id);

-- Historical workflows may not have a catalog link. A new link always requires
-- an active organization, active product, and active customer assignment.
alter table public.onboarding_plans alter column product_id drop not null;
alter table public.implementation_projects alter column product_id drop not null;

create or replace function private.workflow_product_is_eligible(target_organization_id uuid, target_product_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select target_product_id is not null
    and exists (select 1 from public.organizations o where o.id=target_organization_id
      and o.organization_type='CUSTOMER' and o.is_active)
    and exists (select 1 from public.products p
      join public.customer_subscriptions s on s.product_id=p.id
      where p.id=target_product_id and p.status='ACTIVE'
        and s.organization_id=target_organization_id and s.status='ACTIVE');
$$;

create or replace function private.assert_workflow_scope(target_organization_id uuid, target_product_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.workflow_product_is_eligible(target_organization_id,target_product_id) then
    raise exception 'An active product assignment for this customer is required' using errcode='23514';
  end if;
end;
$$;

-- This predicate is used by progress/child guards. Product archival is not a
-- cancellation of already-created work; organization deactivation still is.
create or replace function private.workflow_scope_is_active(target_organization_id uuid, target_product_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.organizations o where o.id=target_organization_id
    and o.organization_type='CUSTOMER' and o.is_active);
$$;

create or replace function private.guard_onboarding_plan()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform private.assert_onboarding_workflow_actor(new.organization_id,new.product_id);
  if tg_op='UPDATE' and (new.id,new.organization_id,new.created_at)
      is distinct from (old.id,old.organization_id,old.created_at) then
    raise exception 'Onboarding plan identity and organization are immutable' using errcode='23514';
  end if;
  if tg_op='INSERT' or (tg_op='UPDATE' and new.product_id is distinct from old.product_id) then
    perform private.assert_workflow_scope(new.organization_id,new.product_id);
  end if;
  if tg_op='UPDATE' and not private.workflow_scope_is_active(new.organization_id,new.product_id) then
    if new.workflow_status <> 'CANCELLED' or old.workflow_status='CANCELLED'
      or (new.name,new.starts_on,new.target_go_live_on,new.actual_go_live_on,
          new.readiness_confirmed_at,new.customer_update,new.owner_user_id,new.product_id)
         is distinct from
         (old.name,old.starts_on,old.target_go_live_on,old.actual_go_live_on,
          old.readiness_confirmed_at,old.customer_update,old.owner_user_id,old.product_id) then
      raise exception 'Only cancellation is permitted after organization deactivation' using errcode='23514';
    end if;
  end if;
  if tg_op='INSERT' or new.owner_user_id is distinct from old.owner_user_id then
    perform private.assert_beauroi_workflow_owner(new.owner_user_id);
  end if;
  if tg_op='UPDATE' and new.workflow_status <> old.workflow_status and not (
    (old.workflow_status='DRAFT' and new.workflow_status in ('NOT_STARTED','IN_PROGRESS','CANCELLED')) or
    (old.workflow_status='NOT_STARTED' and new.workflow_status in ('IN_PROGRESS','BLOCKED','CANCELLED')) or
    (old.workflow_status='IN_PROGRESS' and new.workflow_status in ('BLOCKED','READY_FOR_GO_LIVE','CANCELLED')) or
    (old.workflow_status='BLOCKED' and new.workflow_status in ('IN_PROGRESS','CANCELLED')) or
    (old.workflow_status='READY_FOR_GO_LIVE' and new.workflow_status in ('IN_PROGRESS','LIVE','CANCELLED'))
  ) then raise exception 'Invalid onboarding status transition' using errcode='23514'; end if;
  return new;
end;
$$;

create or replace function private.guard_implementation_project()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform private.assert_implementation_workflow_actor(new.organization_id,new.product_id);
  if tg_op='UPDATE' and (new.id,new.organization_id,new.created_at)
      is distinct from (old.id,old.organization_id,old.created_at) then
    raise exception 'Implementation project identity and organization are immutable' using errcode='23514';
  end if;
  if tg_op='INSERT' or (tg_op='UPDATE' and new.product_id is distinct from old.product_id) then
    perform private.assert_workflow_scope(new.organization_id,new.product_id);
  end if;
  if tg_op='UPDATE' and not private.workflow_scope_is_active(new.organization_id,new.product_id) then
    if new.workflow_status <> 'CANCELLED' or old.workflow_status='CANCELLED'
      or (new.name,new.starts_on,new.target_completion_on,new.actual_completion_on,
          new.phase,new.customer_update,new.owner_user_id,new.product_id)
         is distinct from
         (old.name,old.starts_on,old.target_completion_on,old.actual_completion_on,
          old.phase,old.customer_update,old.owner_user_id,old.product_id) then
      raise exception 'Only cancellation is permitted after organization deactivation' using errcode='23514';
    end if;
  end if;
  if tg_op='INSERT' or new.owner_user_id is distinct from old.owner_user_id then
    perform private.assert_beauroi_workflow_owner(new.owner_user_id);
  end if;
  if tg_op='UPDATE' and new.workflow_status <> old.workflow_status and not (
    (old.workflow_status='DRAFT' and new.workflow_status in ('NOT_STARTED','IN_PROGRESS','CANCELLED')) or
    (old.workflow_status='NOT_STARTED' and new.workflow_status in ('IN_PROGRESS','BLOCKED','CANCELLED')) or
    (old.workflow_status='IN_PROGRESS' and new.workflow_status in ('BLOCKED','COMPLETED','CANCELLED')) or
    (old.workflow_status='BLOCKED' and new.workflow_status in ('IN_PROGRESS','CANCELLED'))
  ) then raise exception 'Invalid implementation status transition' using errcode='23514'; end if;
  return new;
end;
$$;

-- Both portfolio views must retain rows whose legacy product_id is NULL.
create or replace view public.onboarding_portfolio with (security_invoker=true) as
select plan.id,plan.organization_id,plan.product_id,plan.name,plan.workflow_status as status,
  plan.starts_on,plan.target_go_live_on,plan.actual_go_live_on,plan.readiness_confirmed_at,
  plan.customer_update,plan.owner_user_id,plan.created_at,plan.updated_at,
  organization.name as organization_name,coalesce(product.name,'No product linked') as product_name,
  (select profile.full_name from public.profiles profile where profile.id=plan.owner_user_id) as owner_name,
  coalesce(t.progress_percent,0)::integer as progress_percent,
  coalesce(t.blocked_count,0)::integer as blocked_count,
  coalesce(t.overdue_count,0)::integer as overdue_count,
  coalesce(t.item_count,0)::integer as task_count
from public.onboarding_plans plan
join public.organizations organization on organization.id=plan.organization_id
left join public.products product on product.id=plan.product_id
left join lateral (
  select count(*) filter (where task.workflow_status <> 'CANCELLED') as item_count,
    case when count(*) filter (where task.workflow_status <> 'CANCELLED')=0 then 0
      else round(100.0*count(*) filter (where task.workflow_status='COMPLETED')/
        count(*) filter (where task.workflow_status <> 'CANCELLED')) end as progress_percent,
    count(*) filter (where task.workflow_status='BLOCKED') as blocked_count,
    count(*) filter (where task.workflow_status not in ('COMPLETED','CANCELLED') and task.due_at<now()) as overdue_count
  from public.onboarding_tasks task where task.onboarding_plan_id=plan.id
) t on true;

create or replace view public.implementation_portfolio with (security_invoker=true) as
select project.id,project.organization_id,project.product_id,project.name,
  project.workflow_status as status,project.owner_user_id,project.starts_on,
  project.target_completion_on,project.actual_completion_on,project.phase,
  project.customer_update,project.created_at,project.updated_at,
  organization.name as organization_name,coalesce(product.name,'No product linked') as product_name,
  (select profile.full_name from public.profiles profile where profile.id=project.owner_user_id) as owner_name,
  coalesce(m.progress_percent,0)::integer as progress_percent,
  coalesce(m.blocked_count,0)::integer as blocked_count,
  coalesce(m.overdue_count,0)::integer as overdue_count,
  coalesce(m.item_count,0)::integer as milestone_count
from public.implementation_projects project
join public.organizations organization on organization.id=project.organization_id
left join public.products product on product.id=project.product_id
left join lateral (
  select count(*) filter (where milestone.workflow_status <> 'CANCELLED') as item_count,
    case when count(*) filter (where milestone.workflow_status <> 'CANCELLED')=0 then 0
      else round(100.0*count(*) filter (where milestone.workflow_status='COMPLETED')/
        count(*) filter (where milestone.workflow_status <> 'CANCELLED')) end as progress_percent,
    count(*) filter (where milestone.workflow_status='BLOCKED') as blocked_count,
    count(*) filter (where milestone.workflow_status not in ('COMPLETED','CANCELLED') and milestone.due_on<current_date) as overdue_count
  from public.milestones milestone where milestone.implementation_project_id=project.id
) m on true;

-- Customers may inspect their own historical assignment and its catalog name,
-- but these policies do not expose any other organization's products.
drop policy products_read on public.products;
create policy products_read on public.products for select to authenticated using (
  (select private.is_beauroi_user()) or exists (
    select 1 from public.customer_subscriptions s where s.product_id=products.id
      and (select private.is_organization_member(s.organization_id))
  )
);

create or replace function public.update_product(
  target_product_id uuid, product_name text, product_description text
) returns uuid language plpgsql security definer set search_path='' as $$
declare old_product public.products%rowtype;
begin
  if not (select private.is_beauroi_admin()) then
    raise exception 'Product administration requires an active Beau Roi administrator' using errcode='42501';
  end if;
  select * into old_product from public.products where id=target_product_id for update;
  if not found then raise exception 'Product not found' using errcode='P0002'; end if;
  if product_name is null or btrim(product_name)<>product_name or char_length(product_name) not between 2 and 160
    or (product_description is not null and char_length(product_description)>2000) then
    raise exception 'Invalid product details' using errcode='23514';
  end if;
  update public.products set name=product_name,description=nullif(btrim(product_description),''),
    updated_at=now(),updated_by=(select auth.uid()) where id=target_product_id;
  insert into public.audit_events(actor_user_id,action,entity_type,entity_id,metadata)
    values((select auth.uid()),'PRODUCT_UPDATED','product',target_product_id,
      jsonb_build_object('name_before',old_product.name,'name_after',product_name));
  return target_product_id;
end;
$$;

create or replace function public.set_product_archived(target_product_id uuid, archive_product boolean)
returns uuid language plpgsql security definer set search_path='' as $$
declare prior_status public.lifecycle_status;
begin
  if not (select private.is_beauroi_admin()) then
    raise exception 'Product administration requires an active Beau Roi administrator' using errcode='42501';
  end if;
  select status into prior_status from public.products where id=target_product_id for update;
  if not found then raise exception 'Product not found' using errcode='P0002'; end if;
  if prior_status not in ('ACTIVE','ARCHIVED') then
    raise exception 'Only active or archived products can change archival state' using errcode='23514';
  end if;
  if (archive_product and prior_status <> 'ARCHIVED') or
     (not archive_product and prior_status <> 'ACTIVE') then
    update public.products set status=case when archive_product then 'ARCHIVED'::public.lifecycle_status else 'ACTIVE'::public.lifecycle_status end,
      updated_at=now(),updated_by=(select auth.uid()) where id=target_product_id;
    insert into public.audit_events(actor_user_id,action,entity_type,entity_id,metadata)
      values((select auth.uid()),case when archive_product then 'PRODUCT_ARCHIVED' else 'PRODUCT_RESTORED' end,
        'product',target_product_id,'{}'::jsonb);
  end if;
  return target_product_id;
end;
$$;

create or replace function public.set_customer_product_active(
  target_organization_id uuid,target_product_id uuid,make_active boolean
) returns uuid language plpgsql security definer set search_path='' as $$
declare record_id uuid; prior_status public.lifecycle_status;
begin
  if not (select private.is_beauroi_admin()) then
    raise exception 'Customer product administration requires an active Beau Roi administrator' using errcode='42501';
  end if;
  select id,status into record_id,prior_status from public.customer_subscriptions
    where organization_id=target_organization_id and product_id=target_product_id for update;
  if not found then
    if not make_active then raise exception 'Customer product assignment not found' using errcode='P0002'; end if;
    if not exists (select 1 from public.organizations o where o.id=target_organization_id
        and o.organization_type='CUSTOMER' and o.is_active)
      or not exists(select 1 from public.products p where p.id=target_product_id and p.status='ACTIVE') then
      raise exception 'An active customer organization and product are required' using errcode='23514';
    end if;
    insert into public.customer_subscriptions(organization_id,product_id,status,starts_on,created_by,updated_by)
      values(target_organization_id,target_product_id,'ACTIVE',current_date,(select auth.uid()),(select auth.uid()))
      returning id into record_id;
  else
    if make_active and not exists(select 1 from public.products p where p.id=target_product_id and p.status='ACTIVE') then
      raise exception 'Archived products cannot be assigned' using errcode='23514';
    end if;
    if make_active and not exists(select 1 from public.organizations o where o.id=target_organization_id
      and o.organization_type='CUSTOMER' and o.is_active) then
      raise exception 'An active customer organization is required' using errcode='23514';
    end if;
    if (make_active and prior_status <> 'ACTIVE') or
       (not make_active and prior_status <> 'ARCHIVED') then
      update public.customer_subscriptions set status=case when make_active then 'ACTIVE'::public.lifecycle_status else 'ARCHIVED'::public.lifecycle_status end,
        ends_on=case when make_active then null else current_date end,
        starts_on=case when make_active then current_date else starts_on end,
        updated_at=now(),updated_by=(select auth.uid()) where id=record_id;
    end if;
  end if;
  insert into public.audit_events(organization_id,actor_user_id,action,entity_type,entity_id,metadata)
    values(target_organization_id,(select auth.uid()),case when make_active then 'CUSTOMER_PRODUCT_ACTIVATED' else 'CUSTOMER_PRODUCT_DEACTIVATED' end,
      'customer_subscription',record_id,jsonb_build_object('product_id',target_product_id));
  return record_id;
end;
$$;

revoke all on function private.workflow_product_is_eligible(uuid,uuid) from public,anon,authenticated;
revoke all on function public.update_product(uuid,text,text) from public,anon,authenticated;
revoke all on function public.set_product_archived(uuid,boolean) from public,anon,authenticated;
revoke all on function public.set_customer_product_active(uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function public.update_product(uuid,text,text) to authenticated;
grant execute on function public.set_product_archived(uuid,boolean) to authenticated;
grant execute on function public.set_customer_product_active(uuid,uuid,boolean) to authenticated;
