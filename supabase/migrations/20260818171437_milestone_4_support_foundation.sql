-- NEXORA Milestone 4A + 4B: Product Support domain and security foundation.
-- This migration is additive. It does not enable a frontend or Express support workflow.

-- Fail before changing support objects when historical rows need human review.
do $$
declare
  duplicate_policies text;
  mismatched_messages text;
  mismatched_attachments text;
  hardened_lifecycle_rows text;
  inconsistent_notifications text;
begin
  select string_agg(
    format('%s/%s/%s (%s active policies)', organization_id, coalesce(product_id::text, 'ALL_PRODUCTS'), priority, policy_count),
    ', ' order by organization_id, product_id nulls first, priority
  ) into duplicate_policies
  from (
    select organization_id, product_id, priority, count(*) policy_count
    from public.sla_policies
    where is_active
    group by organization_id, product_id, priority
    having count(*) > 1
  ) duplicate;

  if duplicate_policies is not null then
    raise exception using
      message = 'Milestone 4 preflight failed: duplicate active SLA policies require review',
      detail = duplicate_policies,
      hint = 'Deactivate superseded policies explicitly; do not delete historical policy rows.';
  end if;

  select string_agg(message.id::text, ', ' order by message.id) into mismatched_messages
  from public.ticket_messages message
  join public.support_tickets ticket on ticket.id = message.ticket_id
  where message.organization_id <> ticket.organization_id;

  if mismatched_messages is not null then
    raise exception using
      message = 'Milestone 4 preflight failed: ticket message organization mismatch requires review',
      detail = mismatched_messages;
  end if;

  select string_agg(attachment.id::text, ', ' order by attachment.id) into mismatched_attachments
  from public.attachments attachment
  left join public.support_tickets ticket
    on attachment.entity_type = 'TICKET' and ticket.id = attachment.entity_id
  left join public.ticket_messages message
    on attachment.entity_type = 'TICKET_MESSAGE' and message.id = attachment.entity_id
  where (attachment.entity_type = 'TICKET'
      and (ticket.id is null or ticket.organization_id <> attachment.organization_id))
     or (attachment.entity_type = 'TICKET_MESSAGE'
      and (message.id is null or message.organization_id <> attachment.organization_id));

  if mismatched_attachments is not null then
    raise exception using
      message = 'Milestone 4 preflight failed: support attachment parent mismatch requires review',
      detail = mismatched_attachments;
  end if;

  select string_agg(ticket.id::text, ', ' order by ticket.id) into hardened_lifecycle_rows
  from public.support_tickets ticket
  where ticket.status in ('RESOLVED', 'CLOSED');

  if hardened_lifecycle_rows is not null then
    raise exception using
      message = 'Milestone 4 preflight failed: resolved or closed legacy tickets require resolution-summary review',
      detail = hardened_lifecycle_rows,
      hint = 'Review each historical resolution before applying Milestone 4; the migration never invents resolution history.';
  end if;

  select string_agg(notification.id::text, ', ' order by notification.id) into inconsistent_notifications
  from public.notifications notification
  where (notification.status = 'UNREAD' and notification.read_at is not null)
     or (notification.status in ('READ', 'ARCHIVED') and notification.read_at is null);

  if inconsistent_notifications is not null then
    raise exception using
      message = 'Milestone 4 preflight failed: notification status/read timestamp mismatch requires review',
      detail = inconsistent_notifications;
  end if;
end;
$$;

-- Categories are Beau Roi-global, optionally product-specific. Customer-specific
-- behavior belongs in ticket/SLA scope; a global taxonomy avoids duplicating the
-- same category for every customer and remains configurable without migrations.
create table public.support_categories (
  id uuid primary key default gen_random_uuid(),
  code text not null unique
    check (code = upper(code) and code ~ '^[A-Z][A-Z0-9_]{1,63}$'),
  name text not null check (char_length(btrim(name)) between 2 and 120),
  description text check (description is null or char_length(description) <= 1000),
  product_id uuid references public.products(id) on delete restrict,
  is_active boolean not null default true,
  sort_order integer not null default 0 check (sort_order between 0 and 100000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index support_categories_active_product_order_idx
  on public.support_categories (product_id, sort_order, name, id)
  where is_active;

alter table public.support_tickets
  add column category_id uuid references public.support_categories(id) on delete restrict,
  add column first_responded_at timestamptz,
  add column closed_at timestamptz,
  add column resolution_summary text,
  add column last_activity_at timestamptz;

-- updated_at and message history are trustworthy legacy activity sources.
update public.support_tickets ticket
set last_activity_at = greatest(
  ticket.updated_at,
  coalesce((
    select max(message.created_at)
    from public.ticket_messages message
    where message.ticket_id = ticket.id
  ), ticket.updated_at)
);

alter table public.support_tickets
  alter column last_activity_at set default now(),
  alter column last_activity_at set not null,
  add constraint support_tickets_resolution_summary_length_check
    check (resolution_summary is null or char_length(btrim(resolution_summary)) between 2 and 10000),
  add constraint support_tickets_lifecycle_consistency_check
    check (
      (status = 'RESOLVED' and resolved_at is not null and closed_at is null and resolution_summary is not null)
      or (status = 'CLOSED' and closed_at is not null and resolution_summary is not null)
      or (status not in ('RESOLVED', 'CLOSED') and resolved_at is null and closed_at is null and resolution_summary is null)
    ),
  add constraint support_tickets_activity_order_check
    check (
      last_activity_at >= created_at
      and (first_responded_at is null or first_responded_at >= created_at)
      and (resolved_at is null or resolved_at >= created_at)
      and (closed_at is null or closed_at >= created_at)
    );

create index support_tickets_queue_idx
  on public.support_tickets (status, priority, last_activity_at desc, id);
create index support_tickets_assigned_queue_idx
  on public.support_tickets (assigned_to, status, last_activity_at desc, id)
  where assigned_to is not null and status <> 'CLOSED';
create index support_tickets_product_queue_idx
  on public.support_tickets (product_id, status, last_activity_at desc, id)
  where product_id is not null;
create index support_tickets_category_idx
  on public.support_tickets (category_id, status, last_activity_at desc, id)
  where category_id is not null;

create unique index sla_policies_one_active_product_priority_idx
  on public.sla_policies (organization_id, product_id, priority)
  where is_active and product_id is not null;
create unique index sla_policies_one_active_org_priority_idx
  on public.sla_policies (organization_id, priority)
  where is_active and product_id is null;
create index sla_policies_selection_idx
  on public.sla_policies (organization_id, priority, product_id, created_at desc, id)
  where is_active;

create table public.support_ticket_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  event_type text not null check (event_type in (
    'TICKET_CREATED', 'STATUS_CHANGED', 'PRIORITY_CHANGED', 'CATEGORY_CHANGED',
    'ASSIGNED', 'CUSTOMER_REPLIED', 'STAFF_REPLIED', 'INTERNAL_NOTE_ADDED',
    'RESOLVED', 'CLOSED'
  )),
  actor_user_id uuid references auth.users(id) on delete set null,
  customer_visible boolean not null default true,
  metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metadata) = 'object' and octet_length(metadata::text) <= 8192),
  created_at timestamptz not null default now()
);
create index support_ticket_events_ticket_time_idx
  on public.support_ticket_events (ticket_id, created_at, id);
create index support_ticket_events_customer_timeline_idx
  on public.support_ticket_events (organization_id, ticket_id, created_at, id)
  where customer_visible;

alter table public.notifications
  add constraint notifications_status_read_at_check
  check (
    (status = 'UNREAD' and read_at is null)
    or (status in ('READ', 'ARCHIVED') and read_at is not null)
  );

create or replace function private.support_actor_has_assignment(
  target_organization_id uuid,
  target_product_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and (
      (select private.is_beauroi_admin())
      or (
        exists (
          select 1
          from public.organization_memberships membership
          join public.organizations organization on organization.id = membership.organization_id
          where membership.user_id = (select auth.uid())
            and membership.status = 'ACTIVE'
            and membership.role = 'BEAUROI_EMPLOYEE'
            and organization.organization_type = 'BEAUROI'
            and organization.is_active
        )
        and exists (
          select 1
          from public.customer_assignments assignment
          where assignment.employee_user_id = (select auth.uid())
            and assignment.organization_id = target_organization_id
            and assignment.assignment_type = 'SUPPORT_LEAD'
            and assignment.is_active
            and assignment.ended_at is null
            and (
              assignment.product_id is null
              or (target_product_id is not null and assignment.product_id = target_product_id)
            )
        )
      )
    );
$$;

create or replace function private.is_active_customer_member(target_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null and exists (
    select 1
    from public.organization_memberships membership
    join public.organizations organization on organization.id = membership.organization_id
    where membership.user_id = (select auth.uid())
      and membership.organization_id = target_organization_id
      and membership.status = 'ACTIVE'
      and membership.role in ('CUSTOMER_ADMIN', 'CUSTOMER_MEMBER')
      and organization.organization_type = 'CUSTOMER'
      and organization.is_active
  );
$$;

create or replace function private.assert_support_category(
  target_category_id uuid,
  target_product_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if target_category_id is null or not exists (
    select 1
    from public.support_categories category
    where category.id = target_category_id
      and category.is_active
      and (category.product_id is null or category.product_id = target_product_id)
  ) then
    raise exception 'An active support category applicable to the ticket product is required'
      using errcode = '23514';
  end if;
end;
$$;

create or replace function private.assert_support_product_scope(
  target_organization_id uuid,
  target_product_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Null-product tickets remain possible for a later approved general-support workflow.
  if target_product_id is not null and not exists (
    select 1
    from public.customer_subscriptions subscription
    join public.products product on product.id = subscription.product_id
    where subscription.organization_id = target_organization_id
      and subscription.product_id = target_product_id
      and subscription.status = 'ACTIVE'
      and product.status = 'ACTIVE'
  ) then
    raise exception 'The ticket product must have an active customer subscription'
      using errcode = '23514';
  end if;
end;
$$;

create or replace function private.write_support_ticket_event(
  target_organization_id uuid,
  target_ticket_id uuid,
  target_event_type text,
  visible_to_customer boolean,
  safe_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  metadata_key text;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication is required' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.support_tickets ticket
    where ticket.id = target_ticket_id and ticket.organization_id = target_organization_id
  ) then
    raise exception 'Support event scope does not match its ticket' using errcode = '23514';
  end if;
  if jsonb_typeof(coalesce(safe_metadata, '{}'::jsonb)) <> 'object' then
    raise exception 'Support event metadata must be an object' using errcode = '23514';
  end if;
  for metadata_key in select jsonb_object_keys(coalesce(safe_metadata, '{}'::jsonb)) loop
    if metadata_key in (
      'body', 'description', 'subject', 'internal_note', 'message_body', 'object_key',
      'token', 'token_hash', 'secret', 'authorization', 'cookie'
    ) then
      raise exception 'Sensitive support event metadata key is not permitted' using errcode = '23514';
    end if;
  end loop;
  insert into public.support_ticket_events (
    organization_id, ticket_id, event_type, actor_user_id, customer_visible, metadata
  ) values (
    target_organization_id, target_ticket_id, target_event_type,
    (select auth.uid()), visible_to_customer, coalesce(safe_metadata, '{}'::jsonb)
  );
end;
$$;

create or replace function private.guard_support_category()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select auth.uid()) is not null and not (select private.is_beauroi_admin()) then
    raise exception 'Only Beau Roi administrators may manage support categories' using errcode = '42501';
  end if;
  if tg_op = 'UPDATE' and
     (to_jsonb(new) - array['code', 'name', 'description', 'is_active', 'sort_order', 'updated_at'])
       is distinct from
     (to_jsonb(old) - array['code', 'name', 'description', 'is_active', 'sort_order', 'updated_at']) then
    raise exception 'Support category identity and product scope are immutable';
  end if;
  return new;
end;
$$;

create or replace function private.audit_support_category()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is not null then
    perform private.write_audit_event(
      null,
      case when tg_op = 'INSERT' then 'SUPPORT_CATEGORY_CREATED' else 'SUPPORT_CATEGORY_UPDATED' end,
      'support_category', new.id,
      jsonb_build_object('code', new.code, 'product_id', new.product_id, 'is_active', new.is_active)
    );
  end if;
  return new;
end;
$$;

create or replace function private.guard_sla_policy()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select auth.uid()) is not null and not (select private.is_beauroi_admin()) then
    raise exception 'Only Beau Roi administrators may manage SLA policies' using errcode = '42501';
  end if;
  if tg_op = 'INSERT' and not exists (
    select 1 from public.organizations organization
    where organization.id = new.organization_id
      and organization.organization_type = 'CUSTOMER'
  ) then
    raise exception 'SLA policies require a customer organization' using errcode = '23514';
  end if;
  if tg_op = 'UPDATE' and
     (to_jsonb(new) - array['name', 'first_response_minutes', 'resolution_minutes', 'is_active', 'updated_at'])
       is distinct from
     (to_jsonb(old) - array['name', 'first_response_minutes', 'resolution_minutes', 'is_active', 'updated_at']) then
    raise exception 'SLA policy identity, scope, and priority are immutable';
  end if;
  return new;
end;
$$;

create or replace function private.audit_sla_policy()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is not null then
    perform private.write_audit_event(
      new.organization_id,
      case when tg_op = 'INSERT' then 'SLA_POLICY_CREATED' else 'SLA_POLICY_UPDATED' end,
      'sla_policy', new.id,
      jsonb_build_object(
        'priority', new.priority, 'product_id', new.product_id,
        'first_response_minutes', new.first_response_minutes,
        'resolution_minutes', new.resolution_minutes, 'is_active', new.is_active
      )
    );
  end if;
  return new;
end;
$$;

create or replace function private.guard_support_ticket()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  internal_update boolean := false;
begin
  if current_setting('nexora.support_internal_update', true) = 'on' then
    perform private.assert_internal_workflow();
    internal_update := true;
  end if;

  if tg_op = 'INSERT' then
    if (select auth.uid()) is not null and not internal_update then
      raise exception 'Support tickets must be created through the approved workflow' using errcode = '42501';
    end if;
    if new.status <> 'OPEN' or new.assigned_to is not null
       or new.first_responded_at is not null or new.resolved_at is not null
       or new.closed_at is not null or new.resolution_summary is not null then
      raise exception 'New support tickets must start in the protected OPEN state' using errcode = '23514';
    end if;
    if (select auth.uid()) is not null and new.created_by <> (select auth.uid()) then
      raise exception 'Support ticket creator identity cannot be forged' using errcode = '42501';
    end if;
    if not exists (
      select 1 from public.organizations organization
      where organization.id = new.organization_id
        and organization.organization_type = 'CUSTOMER'
        and organization.is_active
    ) then
      raise exception 'Support tickets require an active customer organization' using errcode = '23514';
    end if;
    perform private.assert_support_product_scope(new.organization_id, new.product_id);
    if (select auth.uid()) is not null then
      perform private.assert_support_category(new.category_id, new.product_id);
    end if;
    if new.sla_policy_id is not null and not exists (
      select 1 from public.sla_policies policy
      where policy.id = new.sla_policy_id
        and policy.organization_id = new.organization_id
        and policy.priority = new.priority
        and policy.is_active
        and (policy.product_id is null or policy.product_id = new.product_id)
    ) then
      raise exception 'The selected SLA policy is not applicable to this ticket' using errcode = '23514';
    end if;
    new.last_activity_at := coalesce(new.last_activity_at, new.created_at, now());
    return new;
  end if;

  if internal_update then
    if (to_jsonb(new) - array['first_responded_at', 'last_activity_at', 'updated_at'])
       is distinct from
       (to_jsonb(old) - array['first_responded_at', 'last_activity_at', 'updated_at']) then
      raise exception 'Internal support updates may change only activity timestamps';
    end if;
    return new;
  end if;

  -- Inline the assignment check so the private reusable helper does not need an
  -- authenticated EXECUTE grant merely for a direct-table trigger path.
  if not (
    (select private.is_beauroi_admin())
    or (
      exists (
        select 1
        from public.organization_memberships membership
        join public.organizations organization on organization.id = membership.organization_id
        where membership.user_id = (select auth.uid())
          and membership.status = 'ACTIVE'
          and membership.role = 'BEAUROI_EMPLOYEE'
          and organization.organization_type = 'BEAUROI'
          and organization.is_active
      )
      and exists (
        select 1
        from public.customer_assignments assignment
        where assignment.employee_user_id = (select auth.uid())
          and assignment.organization_id = old.organization_id
          and assignment.assignment_type = 'SUPPORT_LEAD'
          and assignment.is_active
          and assignment.ended_at is null
          and (
            assignment.product_id is null
            or (old.product_id is not null and assignment.product_id = old.product_id)
          )
      )
    )
  ) then
    raise exception 'An active support assignment is required' using errcode = '42501';
  end if;
  if old.status = 'CLOSED' then
    raise exception 'Closed support tickets are immutable' using errcode = '23514';
  end if;
  if (to_jsonb(new) - array[
      'category_id', 'status', 'priority', 'assigned_to', 'resolution_summary',
      'resolved_at', 'closed_at', 'last_activity_at', 'updated_at'
    ]) is distinct from
    (to_jsonb(old) - array[
      'category_id', 'status', 'priority', 'assigned_to', 'resolution_summary',
      'resolved_at', 'closed_at', 'last_activity_at', 'updated_at'
    ]) then
    raise exception 'Only approved support triage fields may be changed';
  end if;

  if new.category_id is null or not exists (
    select 1 from public.support_categories category
    where category.id = new.category_id
      and category.is_active
      and (category.product_id is null or category.product_id = old.product_id)
  ) then
    raise exception 'An active support category applicable to the ticket product is required'
      using errcode = '23514';
  end if;
  if new.assigned_to is not null and not exists (
    select 1
    from public.organization_memberships membership
    join public.organizations organization on organization.id = membership.organization_id
    where membership.user_id = new.assigned_to
      and membership.status = 'ACTIVE'
      and membership.role in ('BEAUROI_ADMIN', 'BEAUROI_EMPLOYEE')
      and organization.organization_type = 'BEAUROI'
      and organization.is_active
  ) then
    raise exception 'The support assignee must be an active Beau Roi user'
      using errcode = '23514';
  end if;

  if new.status is distinct from old.status and not (
    (old.status = 'OPEN' and new.status in ('IN_PROGRESS', 'CLOSED'))
    or (old.status = 'IN_PROGRESS' and new.status in ('WAITING_ON_CUSTOMER', 'RESOLVED'))
    or (old.status = 'WAITING_ON_CUSTOMER' and new.status in ('IN_PROGRESS', 'RESOLVED'))
    or (old.status = 'RESOLVED' and new.status in ('IN_PROGRESS', 'CLOSED'))
  ) then
    raise exception 'Invalid support ticket status transition: % -> %', old.status, new.status
      using errcode = '23514';
  end if;

  if new.status in ('RESOLVED', 'CLOSED') then
    new.resolution_summary := nullif(btrim(new.resolution_summary), '');
    if new.resolution_summary is null then
      raise exception 'Resolved and closed tickets require a resolution summary' using errcode = '23514';
    end if;
  else
    new.resolution_summary := null;
  end if;

  if new.status = 'RESOLVED' and old.status <> 'RESOLVED' then
    new.resolved_at := now();
  elsif new.status = 'IN_PROGRESS' and old.status = 'RESOLVED' then
    new.resolved_at := null;
  elsif new.status not in ('RESOLVED', 'CLOSED') then
    new.resolved_at := null;
  end if;
  if new.status = 'CLOSED' and old.status <> 'CLOSED' then
    new.closed_at := now();
  else
    new.closed_at := null;
  end if;
  new.last_activity_at := now();
  return new;
end;
$$;

create or replace function private.audit_support_ticket()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  status_event text;
begin
  if (select auth.uid()) is null then
    return new;
  end if;
  if tg_op = 'INSERT' then
    perform private.write_support_ticket_event(
      new.organization_id, new.id, 'TICKET_CREATED', true,
      jsonb_build_object('priority', new.priority, 'product_id', new.product_id, 'category_id', new.category_id)
    );
    perform private.write_audit_event(
      new.organization_id, 'SUPPORT_TICKET_CREATED', 'support_ticket', new.id,
      jsonb_build_object('priority', new.priority, 'product_id', new.product_id, 'category_id', new.category_id)
    );
    return new;
  end if;

  if new.status is distinct from old.status then
    status_event := case new.status when 'RESOLVED' then 'RESOLVED' when 'CLOSED' then 'CLOSED' else 'STATUS_CHANGED' end;
    perform private.write_support_ticket_event(
      new.organization_id, new.id, status_event, true,
      jsonb_build_object('before', old.status, 'after', new.status)
    );
    perform private.write_audit_event(
      new.organization_id, 'SUPPORT_TICKET_STATUS_CHANGED', 'support_ticket', new.id,
      jsonb_build_object('before', old.status, 'after', new.status)
    );
  end if;
  if new.priority is distinct from old.priority then
    perform private.write_support_ticket_event(
      new.organization_id, new.id, 'PRIORITY_CHANGED', true,
      jsonb_build_object('before', old.priority, 'after', new.priority)
    );
    perform private.write_audit_event(
      new.organization_id, 'SUPPORT_TICKET_PRIORITY_CHANGED', 'support_ticket', new.id,
      jsonb_build_object('before', old.priority, 'after', new.priority)
    );
  end if;
  if new.category_id is distinct from old.category_id then
    perform private.write_support_ticket_event(
      new.organization_id, new.id, 'CATEGORY_CHANGED', true,
      jsonb_build_object('before', old.category_id, 'after', new.category_id)
    );
    perform private.write_audit_event(
      new.organization_id, 'SUPPORT_TICKET_CATEGORY_CHANGED', 'support_ticket', new.id,
      jsonb_build_object('before', old.category_id, 'after', new.category_id)
    );
  end if;
  if new.assigned_to is distinct from old.assigned_to then
    perform private.write_support_ticket_event(
      new.organization_id, new.id, 'ASSIGNED', true,
      jsonb_build_object('before', old.assigned_to, 'after', new.assigned_to)
    );
    perform private.write_audit_event(
      new.organization_id, 'SUPPORT_TICKET_ASSIGNED', 'support_ticket', new.id,
      jsonb_build_object('before', old.assigned_to, 'after', new.assigned_to)
    );
  end if;
  return new;
end;
$$;

create or replace function private.guard_ticket_message()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select auth.uid()) is not null then
    if current_setting('nexora.support_message_insert', true) <> 'on' then
      raise exception 'Ticket messages must be created through the approved workflow' using errcode = '42501';
    end if;
    perform private.assert_internal_workflow();
    if new.author_user_id <> (select auth.uid()) then
      raise exception 'Ticket message author identity cannot be forged' using errcode = '42501';
    end if;
  end if;
  if not exists (
    select 1 from public.support_tickets ticket
    where ticket.id = new.ticket_id and ticket.organization_id = new.organization_id
  ) then
    raise exception 'Ticket message organization must match its parent ticket' using errcode = '23514';
  end if;
  return new;
end;
$$;

create or replace function private.after_ticket_message_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  staff_actor boolean;
  prior_marker text := current_setting('nexora.support_internal_update', true);
begin
  if (select auth.uid()) is null then
    return new;
  end if;
  staff_actor := (select private.is_beauroi_user());
  perform set_config('nexora.support_internal_update', 'on', true);
  update public.support_tickets
  set first_responded_at = case
        when staff_actor and not new.is_internal then coalesce(first_responded_at, new.created_at)
        else first_responded_at
      end,
      last_activity_at = greatest(last_activity_at, new.created_at)
  where id = new.ticket_id;
  perform set_config('nexora.support_internal_update', coalesce(prior_marker, ''), true);

  perform private.write_support_ticket_event(
    new.organization_id,
    new.ticket_id,
    case
      when staff_actor and new.is_internal then 'INTERNAL_NOTE_ADDED'
      when staff_actor then 'STAFF_REPLIED'
      else 'CUSTOMER_REPLIED'
    end,
    not new.is_internal,
    jsonb_build_object('message_id', new.id)
  );
  perform private.write_audit_event(
    new.organization_id,
    case
      when staff_actor and new.is_internal then 'SUPPORT_INTERNAL_NOTE_ADDED'
      when staff_actor then 'SUPPORT_STAFF_REPLIED'
      else 'SUPPORT_CUSTOMER_REPLIED'
    end,
    'ticket_message', new.id,
    jsonb_build_object('ticket_id', new.ticket_id, 'customer_visible', not new.is_internal)
  );
  return new;
exception when others then
  perform set_config('nexora.support_internal_update', coalesce(prior_marker, ''), true);
  raise;
end;
$$;

create or replace function private.guard_support_attachment()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.entity_type = 'TICKET' and not exists (
    select 1 from public.support_tickets ticket
    where ticket.id = new.entity_id and ticket.organization_id = new.organization_id
  ) then
    raise exception 'Ticket attachment organization must match its parent ticket' using errcode = '23514';
  end if;
  if new.entity_type = 'TICKET_MESSAGE' and not exists (
    select 1 from public.ticket_messages message
    where message.id = new.entity_id and message.organization_id = new.organization_id
  ) then
    raise exception 'Message attachment organization must match its parent message' using errcode = '23514';
  end if;
  return new;
end;
$$;

create or replace function private.guard_notification_state()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select auth.uid()) is not null then
    if old.user_id <> (select auth.uid()) then
      raise exception 'Only the notification recipient may change its state' using errcode = '42501';
    end if;
    if (to_jsonb(new) - array['status', 'read_at'])
       is distinct from
       (to_jsonb(old) - array['status', 'read_at']) then
      raise exception 'Notification content and ownership are immutable';
    end if;
    if old.status = 'ARCHIVED' and new.status <> 'ARCHIVED' then
      raise exception 'Archived notifications cannot be restored' using errcode = '23514';
    end if;
    new.read_at := case when new.status = 'UNREAD' then null else coalesce(old.read_at, now()) end;
  end if;
  return new;
end;
$$;

create or replace function private.create_support_ticket(
  target_organization_id uuid,
  target_product_id uuid,
  target_category_id uuid,
  ticket_subject text,
  ticket_description text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  created_ticket_id uuid;
  selected_policy public.sla_policies%rowtype;
  operation_time timestamptz := now();
  prior_marker text := current_setting('nexora.support_internal_update', true);
begin
  if not private.is_active_customer_member(target_organization_id) then
    raise exception 'Active customer organization membership is required' using errcode = '42501';
  end if;
  if char_length(btrim(ticket_subject)) not between 3 and 240 then
    raise exception 'Ticket subject must contain between 3 and 240 characters' using errcode = '22023';
  end if;
  if char_length(btrim(ticket_description)) not between 1 and 20000 then
    raise exception 'Ticket description must contain between 1 and 20000 characters' using errcode = '22023';
  end if;
  if target_product_id is null then
    raise exception 'Customer ticket creation requires an active subscribed product'
      using errcode = '23514';
  end if;
  perform private.assert_support_product_scope(target_organization_id, target_product_id);
  perform private.assert_support_category(target_category_id, target_product_id);

  select policy.* into selected_policy
  from public.sla_policies policy
  where policy.organization_id = target_organization_id
    and policy.priority = 'MEDIUM'
    and policy.is_active
    and (policy.product_id is null or policy.product_id = target_product_id)
  order by (policy.product_id is not null) desc, policy.created_at desc, policy.id
  limit 1;

  perform set_config('nexora.support_internal_update', 'on', true);
  insert into public.support_tickets (
    organization_id, product_id, category_id, subject, description,
    status, priority, created_by, sla_policy_id,
    first_response_due_at, resolution_due_at, created_at, updated_at, last_activity_at
  ) values (
    target_organization_id, target_product_id, target_category_id,
    btrim(ticket_subject), btrim(ticket_description), 'OPEN', 'MEDIUM', (select auth.uid()),
    selected_policy.id,
    case when selected_policy.id is null then null
      else operation_time + make_interval(mins => selected_policy.first_response_minutes) end,
    case when selected_policy.resolution_minutes is null then null
      else operation_time + make_interval(mins => selected_policy.resolution_minutes) end,
    operation_time, operation_time, operation_time
  ) returning id into created_ticket_id;
  perform set_config('nexora.support_internal_update', coalesce(prior_marker, ''), true);
  return created_ticket_id;
exception when others then
  perform set_config('nexora.support_internal_update', coalesce(prior_marker, ''), true);
  raise;
end;
$$;

create or replace function public.create_support_ticket(
  target_organization_id uuid,
  target_product_id uuid,
  target_category_id uuid,
  ticket_subject text,
  ticket_description text
)
returns uuid
language sql
volatile
security definer
set search_path = ''
as $$
  select private.create_support_ticket(
    target_organization_id, target_product_id, target_category_id,
    ticket_subject, ticket_description
  );
$$;

create or replace function private.add_support_ticket_message(
  target_ticket_id uuid,
  message_body text,
  internal_message boolean
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_ticket public.support_tickets%rowtype;
  created_message_id uuid;
  customer_actor boolean;
  staff_actor boolean;
  prior_marker text := current_setting('nexora.support_message_insert', true);
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication is required' using errcode = '42501';
  end if;
  select * into target_ticket
  from public.support_tickets ticket
  where ticket.id = target_ticket_id
  for update;
  if not found then
    raise exception 'Support ticket is unavailable' using errcode = 'P0001';
  end if;
  if target_ticket.status = 'CLOSED' then
    raise exception 'Closed support tickets do not accept new messages' using errcode = '23514';
  end if;
  if char_length(btrim(message_body)) not between 1 and 30000 then
    raise exception 'Ticket message must contain between 1 and 30000 characters' using errcode = '22023';
  end if;

  customer_actor := private.is_active_customer_member(target_ticket.organization_id);
  staff_actor := private.support_actor_has_assignment(target_ticket.organization_id, target_ticket.product_id);
  if not customer_actor and not staff_actor then
    raise exception 'Ticket message access is unavailable' using errcode = '42501';
  end if;
  if customer_actor and internal_message then
    raise exception 'Customer users cannot create internal support messages' using errcode = '42501';
  end if;

  perform set_config('nexora.support_message_insert', 'on', true);
  insert into public.ticket_messages (
    organization_id, ticket_id, author_user_id, body, is_internal
  ) values (
    target_ticket.organization_id, target_ticket.id, (select auth.uid()),
    btrim(message_body), internal_message
  ) returning id into created_message_id;
  perform set_config('nexora.support_message_insert', coalesce(prior_marker, ''), true);
  return created_message_id;
exception when others then
  perform set_config('nexora.support_message_insert', coalesce(prior_marker, ''), true);
  raise;
end;
$$;

create or replace function public.add_support_ticket_message(
  target_ticket_id uuid,
  message_body text,
  internal_message boolean default false
)
returns uuid
language sql
volatile
security definer
set search_path = ''
as $$
  select private.add_support_ticket_message(target_ticket_id, message_body, internal_message);
$$;

create trigger support_categories_guard_write
  before insert or update on public.support_categories
  for each row execute function private.guard_support_category();
create trigger support_categories_set_updated_at
  before update on public.support_categories
  for each row execute function private.set_updated_at();
create trigger support_categories_audit_write
  after insert or update on public.support_categories
  for each row execute function private.audit_support_category();

create trigger sla_policies_guard_write
  before insert or update on public.sla_policies
  for each row execute function private.guard_sla_policy();
create trigger sla_policies_audit_write
  after insert or update on public.sla_policies
  for each row execute function private.audit_sla_policy();

create trigger support_tickets_guard_write
  before insert or update on public.support_tickets
  for each row execute function private.guard_support_ticket();
create trigger support_tickets_audit_write
  after insert or update on public.support_tickets
  for each row execute function private.audit_support_ticket();

create trigger ticket_messages_guard_insert
  before insert on public.ticket_messages
  for each row execute function private.guard_ticket_message();
create trigger ticket_messages_after_insert
  after insert on public.ticket_messages
  for each row execute function private.after_ticket_message_insert();

create trigger attachments_guard_support_parent
  before insert or update on public.attachments
  for each row execute function private.guard_support_attachment();
create trigger notifications_guard_state
  before update on public.notifications
  for each row execute function private.guard_notification_state();

alter table public.support_categories enable row level security;
alter table public.support_ticket_events enable row level security;

create policy support_categories_read on public.support_categories
  for select to authenticated
  using (
    (select private.is_beauroi_user())
    or (
      is_active and (
        product_id is null
        or exists (
          select 1 from public.customer_subscriptions subscription
          where subscription.product_id = support_categories.product_id
            and subscription.status = 'ACTIVE'
            and (select private.is_organization_member(subscription.organization_id))
        )
      )
    )
  );
create policy support_categories_insert_admin on public.support_categories
  for insert to authenticated with check ((select private.is_beauroi_admin()));
create policy support_categories_update_admin on public.support_categories
  for update to authenticated
  using ((select private.is_beauroi_admin()))
  with check ((select private.is_beauroi_admin()));

drop policy if exists tenant_read on public.sla_policies;
drop policy if exists beauroi_insert on public.sla_policies;
drop policy if exists beauroi_update on public.sla_policies;
drop policy if exists beauroi_delete on public.sla_policies;
create policy sla_policies_read on public.sla_policies
  for select to authenticated
  using (
    (select private.is_beauroi_user())
    or (select private.is_organization_member(organization_id))
  );
create policy sla_policies_insert_admin on public.sla_policies
  for insert to authenticated with check ((select private.is_beauroi_admin()));
create policy sla_policies_update_admin on public.sla_policies
  for update to authenticated
  using ((select private.is_beauroi_admin()))
  with check ((select private.is_beauroi_admin()));

drop policy if exists tenant_read on public.support_tickets;
drop policy if exists beauroi_insert on public.support_tickets;
drop policy if exists beauroi_update on public.support_tickets;
drop policy if exists beauroi_delete on public.support_tickets;
create policy support_tickets_read on public.support_tickets
  for select to authenticated
  using (
    (select private.is_beauroi_user())
    or (select private.is_organization_member(organization_id))
  );
create policy support_tickets_update_assigned_staff on public.support_tickets
  for update to authenticated
  using ((select private.is_beauroi_user()))
  with check ((select private.is_beauroi_user()));

drop policy if exists tenant_read on public.ticket_messages;
drop policy if exists beauroi_insert on public.ticket_messages;
drop policy if exists beauroi_update on public.ticket_messages;
drop policy if exists beauroi_delete on public.ticket_messages;
create policy ticket_messages_read on public.ticket_messages
  for select to authenticated
  using (
    (select private.is_beauroi_user())
    or (
      not is_internal
      and (select private.is_organization_member(organization_id))
      and exists (
        select 1 from public.support_tickets ticket
        where ticket.id = ticket_messages.ticket_id
          and ticket.organization_id = ticket_messages.organization_id
      )
    )
  );

create policy support_ticket_events_read on public.support_ticket_events
  for select to authenticated
  using (
    (select private.is_beauroi_user())
    or (
      customer_visible
      and (select private.is_organization_member(organization_id))
      and exists (
        select 1 from public.support_tickets ticket
        where ticket.id = support_ticket_events.ticket_id
          and ticket.organization_id = support_ticket_events.organization_id
      )
    )
  );

drop policy if exists tenant_read on public.attachments;
drop policy if exists beauroi_insert on public.attachments;
drop policy if exists beauroi_update on public.attachments;
drop policy if exists beauroi_delete on public.attachments;
create policy attachments_safe_read on public.attachments
  for select to authenticated
  using (
    (select private.is_beauroi_user())
    or (
      entity_type = 'TICKET'
      and (select private.is_organization_member(organization_id))
      and exists (
        select 1 from public.support_tickets ticket
        where ticket.id = attachments.entity_id
          and ticket.organization_id = attachments.organization_id
      )
    )
    or (
      entity_type = 'TICKET_MESSAGE'
      and (select private.is_organization_member(organization_id))
      and exists (
        select 1 from public.ticket_messages message
        where message.id = attachments.entity_id
          and message.organization_id = attachments.organization_id
          and not message.is_internal
      )
    )
    or (
      entity_type not in ('TICKET', 'TICKET_MESSAGE')
      and (select private.can_access_organization(organization_id))
    )
  );

drop policy if exists notifications_update_own on public.notifications;
drop policy if exists notifications_insert_beauroi on public.notifications;
drop policy if exists notifications_delete_beauroi on public.notifications;
create policy notifications_update_own_state on public.notifications
  for update to authenticated
  using (user_id = (select auth.uid()) and (select private.can_access_organization(organization_id)))
  with check (user_id = (select auth.uid()) and (select private.can_access_organization(organization_id)));

revoke all on table public.support_categories from public, anon, authenticated;
grant select, insert, update on table public.support_categories to authenticated;
grant all on table public.support_categories to service_role;

revoke insert, update, delete on table public.sla_policies from authenticated;
grant select, insert, update on table public.sla_policies to authenticated;

revoke insert, update, delete on table public.support_tickets from authenticated;
grant select on table public.support_tickets to authenticated;
grant update (category_id, status, priority, assigned_to, resolution_summary)
  on table public.support_tickets to authenticated;

revoke insert, update, delete on table public.ticket_messages from authenticated;
grant select on table public.ticket_messages to authenticated;

revoke all on table public.support_ticket_events from public, anon, authenticated;
grant select on table public.support_ticket_events to authenticated;
grant all on table public.support_ticket_events to service_role;

revoke select, insert, update, delete on table public.attachments from authenticated;
grant select (
  id, organization_id, uploaded_by, entity_type, entity_id,
  original_filename, content_type, size_bytes, checksum_sha256, created_at
) on table public.attachments to authenticated;

revoke insert, delete, update on table public.notifications from authenticated;
grant update (status, read_at) on table public.notifications to authenticated;

revoke all on function private.support_actor_has_assignment(uuid, uuid) from public, anon, authenticated;
revoke all on function private.is_active_customer_member(uuid) from public, anon, authenticated;
revoke all on function private.assert_support_category(uuid, uuid) from public, anon, authenticated;
revoke all on function private.assert_support_product_scope(uuid, uuid) from public, anon, authenticated;
revoke all on function private.write_support_ticket_event(uuid, uuid, text, boolean, jsonb) from public, anon, authenticated;
revoke all on function private.guard_support_category() from public, anon, authenticated;
revoke all on function private.audit_support_category() from public, anon, authenticated;
revoke all on function private.guard_sla_policy() from public, anon, authenticated;
revoke all on function private.audit_sla_policy() from public, anon, authenticated;
revoke all on function private.guard_support_ticket() from public, anon, authenticated;
revoke all on function private.audit_support_ticket() from public, anon, authenticated;
revoke all on function private.guard_ticket_message() from public, anon, authenticated;
revoke all on function private.after_ticket_message_insert() from public, anon, authenticated;
revoke all on function private.guard_support_attachment() from public, anon, authenticated;
revoke all on function private.guard_notification_state() from public, anon, authenticated;
revoke all on function private.create_support_ticket(uuid, uuid, uuid, text, text) from public, anon, authenticated;
revoke all on function public.create_support_ticket(uuid, uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.create_support_ticket(uuid, uuid, uuid, text, text) to authenticated;
revoke all on function private.add_support_ticket_message(uuid, text, boolean) from public, anon, authenticated;
revoke all on function public.add_support_ticket_message(uuid, text, boolean) from public, anon, authenticated;
grant execute on function public.add_support_ticket_message(uuid, text, boolean) to authenticated;

comment on table public.support_categories is
  'Beau Roi-managed global/product support taxonomy. No production categories are seeded by migrations.';
comment on column public.support_tickets.category_id is
  'Nullable only for pre-Milestone-4 history; approved customer creation requires an active applicable category.';
comment on column public.support_tickets.first_responded_at is
  'Set atomically by the first customer-visible Beau Roi reply; internal notes never count.';
comment on column public.support_tickets.product_id is
  'Nullable by design so a future approved general-support workflow does not require a destructive schema change.';
comment on table public.support_ticket_events is
  'Immutable customer-safe support history. Internal audit details remain in protected audit_events.';
comment on column public.attachments.object_key is
  'Private R2 object key. Authenticated Data API roles have no SELECT privilege on this column.';
comment on table public.sla_policies is
  'Durations use elapsed minutes only in this foundation. Business calendars, holidays, timezones, and waiting pauses are deferred.';
