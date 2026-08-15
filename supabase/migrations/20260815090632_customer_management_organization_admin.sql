-- NEXORA Milestone 2: customer management and organization administration.
-- This migration is additive and preserves the Milestone 1 tenancy model.

create type public.invitation_status as enum ('PENDING', 'ACCEPTED', 'REVOKED');

alter table public.organizations
  add column lifecycle_status public.lifecycle_status not null default 'ACTIVE';

alter table public.customer_assignments
  add column assigned_by uuid references auth.users(id) on delete set null,
  add column assigned_at timestamptz,
  add column ended_at timestamptz;

-- Preserve Milestone 1 history before enforcing the new active/ended invariant.
-- created_at is the only trustworthy legacy assignment timestamp.
update public.customer_assignments
set assigned_at = created_at;

update public.customer_assignments
set ended_at = coalesce(ended_at, assigned_at)
where not is_active;

alter table public.customer_assignments
  alter column assigned_at set default now(),
  alter column assigned_at set not null;

alter table public.customer_assignments
  drop constraint customer_assignments_assignment_type_check,
  add constraint customer_assignments_assignment_type_check
    check (assignment_type in ('ACCOUNT_OWNER', 'IMPLEMENTATION_LEAD', 'IMPLEMENTATION_ENGINEER', 'SUPPORT_LEAD', 'CSM')),
  add constraint customer_assignments_dates_check
    check (
      (is_active and ended_at is null)
      or (not is_active and ended_at is not null and ended_at >= assigned_at)
    );

create or replace function private.assert_no_duplicate_active_customer_assignments()
returns void
language plpgsql
set search_path = ''
as $$
declare
  duplicate_summary text;
begin
  select string_agg(
    format('%s/%s (%s active rows)', duplicate.organization_id, duplicate.assignment_type, duplicate.assignment_count),
    ', ' order by duplicate.organization_id, duplicate.assignment_type
  ) into duplicate_summary
  from (
    select assignment.organization_id, assignment.assignment_type, count(*) as assignment_count
    from public.customer_assignments assignment
    where assignment.is_active
      and assignment.product_id is null
      and assignment.assignment_type in ('CSM', 'IMPLEMENTATION_ENGINEER')
    group by assignment.organization_id, assignment.assignment_type
    having count(*) > 1
  ) duplicate;

  if duplicate_summary is not null then
    raise exception using
      message = 'Milestone 2 preflight failed: duplicate active customer assignments require review',
      detail = duplicate_summary,
      hint = 'End all but one assignment per organization/type explicitly; do not delete assignment history.';
  end if;
end;
$$;
revoke all on function private.assert_no_duplicate_active_customer_assignments() from public, anon, authenticated;

select private.assert_no_duplicate_active_customer_assignments();

-- Milestone 1 created this exact generated constraint name. Its definition is
-- asserted only after the duplicate-active preflight has succeeded, and before
-- removal, so schema drift cannot drop an unrelated UNIQUE constraint.
do $$
declare
  actual_definition text;
begin
  select pg_get_constraintdef(constraint_definition.oid) into actual_definition
  from pg_constraint constraint_definition
  where constraint_definition.conrelid = 'public.customer_assignments'::regclass
    and constraint_definition.conname = 'customer_assignments_organization_id_product_id_employee_us_key'
    and constraint_definition.contype = 'u';

  if actual_definition is null then
    raise exception 'Milestone 2 preflight failed: expected Milestone 1 customer assignment constraint is missing';
  end if;
  if actual_definition <> 'UNIQUE (organization_id, product_id, employee_user_id, assignment_type)' then
    raise exception using
      message = 'Milestone 2 preflight failed: the Milestone 1 customer assignment constraint has an unexpected definition',
      detail = actual_definition;
  end if;

  alter table public.customer_assignments
    drop constraint customer_assignments_organization_id_product_id_employee_us_key;
end;
$$;

create unique index customer_assignments_one_active_type_idx
  on public.customer_assignments (organization_id, assignment_type)
  where is_active and product_id is null
    and assignment_type in ('CSM', 'IMPLEMENTATION_ENGINEER');
create index customer_assignments_active_org_type_idx
  on public.customer_assignments (organization_id, assignment_type, assigned_at desc, id)
  where is_active;
create index customer_assignments_assigned_by_idx
  on public.customer_assignments (assigned_by)
  where assigned_by is not null;

create table private.customer_assignment_notes (
  assignment_id uuid primary key references public.customer_assignments(id) on delete cascade,
  note text not null check (char_length(note) between 1 and 1000),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);
create index customer_assignment_notes_created_by_idx
  on private.customer_assignment_notes (created_by);
revoke all on private.customer_assignment_notes from public, anon, authenticated;

alter table public.health_score_history
  add column reason text,
  add column source text;

update public.health_score_history
set reason = 'Imported from the initial health-score history', source = 'SYSTEM'
where reason is null or source is null;

alter table public.health_score_history
  alter column reason set not null,
  alter column source set not null,
  add constraint health_score_reason_length_check check (char_length(reason) between 3 and 1000),
  add constraint health_score_source_check check (source in ('MANUAL', 'SYSTEM', 'IMPORT'));

create table public.organization_invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  normalized_email text not null,
  intended_role public.app_role not null,
  invited_by uuid not null references auth.users(id) on delete restrict,
  token_hash text not null unique,
  status public.invitation_status not null default 'PENDING',
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  accepted_at timestamptz,
  accepted_by uuid references auth.users(id) on delete set null,
  revoked_at timestamptz,
  revoked_by uuid references auth.users(id) on delete set null,
  constraint organization_invitations_email_normalized_check
    check (normalized_email = lower(btrim(normalized_email))),
  constraint organization_invitations_email_format_check
    check (normalized_email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  constraint organization_invitations_customer_role_check
    check (intended_role in ('CUSTOMER_ADMIN', 'CUSTOMER_MEMBER')),
  constraint organization_invitations_token_hash_check
    check (token_hash ~ '^[0-9a-f]{64}$'),
  constraint organization_invitations_lifetime_check
    check (expires_at > created_at and expires_at <= created_at + interval '30 days'),
  check (
    (status = 'PENDING' and accepted_at is null and accepted_by is null and revoked_at is null and revoked_by is null)
    or (status = 'ACCEPTED' and accepted_at is not null and accepted_by is not null and revoked_at is null and revoked_by is null)
    or (status = 'REVOKED' and accepted_at is null and accepted_by is null and revoked_at is not null and revoked_by is not null)
  )
);

create unique index organization_invitations_one_pending_email_idx
  on public.organization_invitations (organization_id, normalized_email)
  where status = 'PENDING';
create index organization_invitations_organization_created_idx
  on public.organization_invitations (organization_id, created_at desc, id);
create index organization_invitations_invited_by_idx on public.organization_invitations (invited_by);
create index organization_invitations_accepted_by_idx on public.organization_invitations (accepted_by)
  where accepted_by is not null;
create index organization_invitations_revoked_by_idx on public.organization_invitations (revoked_by)
  where revoked_by is not null;
create index organization_invitations_pending_expiry_idx on public.organization_invitations (expires_at)
  where status = 'PENDING';

alter table public.audit_events
  add column actor_organization_id uuid references public.organizations(id) on delete set null,
  add column actor_role public.app_role;
create index audit_events_actor_organization_id_idx
  on public.audit_events (actor_organization_id, occurred_at desc)
  where actor_organization_id is not null;

create index organizations_customer_list_idx
  on public.organizations (lifecycle_status, name, id)
  where organization_type = 'CUSTOMER';
create index organizations_customer_country_idx
  on public.organizations (country, name, id)
  where organization_type = 'CUSTOMER';
create index organizations_customer_industry_idx
  on public.organizations (industry, name, id)
  where organization_type = 'CUSTOMER';
create index support_tickets_open_organization_idx
  on public.support_tickets (organization_id, created_at desc)
  where status in ('OPEN', 'IN_PROGRESS', 'WAITING_ON_CUSTOMER');

create or replace function private.current_actor_context()
returns table (organization_id uuid, role public.app_role)
language sql
stable
security definer
set search_path = ''
as $$
  select membership.organization_id, membership.role
  from public.organization_memberships membership
  where membership.user_id = (select auth.uid())
    and membership.status = 'ACTIVE'
  order by membership.is_primary desc, membership.created_at
  limit 1;
$$;

create or replace function private.request_id()
returns text
language sql
stable
set search_path = ''
as $$
  select left(coalesce(
    nullif((nullif(current_setting('request.headers', true), '')::jsonb ->> 'x-request-id'), ''),
    nullif(current_setting('application_name', true), '')
  ), 128);
$$;

-- Custom transaction settings are only workflow markers, never capabilities.
-- Guard triggers call this invoker function when a marker is present. Its ACL
-- means an authenticated direct-table caller cannot turn a spoofed setting into
-- permission; the approved public SECURITY DEFINER RPCs execute as the owner.
create or replace function private.assert_internal_workflow()
returns void
language plpgsql
set search_path = ''
as $$
begin
  return;
end;
$$;

create or replace function private.write_audit_event(
  target_organization_id uuid,
  event_action text,
  target_entity_type text,
  target_entity_id uuid,
  safe_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor record;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication is required';
  end if;
  select * into actor from private.current_actor_context();
  insert into public.audit_events (
    organization_id, actor_user_id, actor_organization_id, actor_role,
    action, entity_type, entity_id, request_id, metadata
  ) values (
    target_organization_id, (select auth.uid()), actor.organization_id, actor.role,
    event_action, target_entity_type, target_entity_id, private.request_id(), coalesce(safe_metadata, '{}'::jsonb)
  );
end;
$$;

create or replace function private.guard_organization_update()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  beauroi boolean := (select private.is_beauroi_user());
  allowed_fields text[] := array['name', 'website', 'industry', 'company_size', 'country', 'updated_at'];
  logo_workflow boolean := false;
  customer_admin boolean := exists (
    select 1 from public.organization_memberships membership
    where membership.user_id = (select auth.uid())
      and membership.organization_id = old.id
      and membership.status = 'ACTIVE'
      and membership.role = 'CUSTOMER_ADMIN'
  );
begin
  if current_setting('nexora.logo_update', true) = 'on' then
    perform private.assert_internal_workflow();
    logo_workflow := true;
  end if;

  if not beauroi and not customer_admin then
    raise exception 'Organization update is not permitted';
  end if;

  if beauroi then
    allowed_fields := allowed_fields || array['lifecycle_status'];
  end if;
  if logo_workflow then
    allowed_fields := allowed_fields || array['logo_object_key'];
  end if;

  if (to_jsonb(new) - allowed_fields) is distinct from (to_jsonb(old) - allowed_fields) then
    raise exception 'Only approved organization profile fields may be changed';
  end if;

  return new;
end;
$$;

create or replace function private.audit_organization_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.lifecycle_status is distinct from old.lifecycle_status then
    perform private.write_audit_event(new.id, 'CUSTOMER_LIFECYCLE_CHANGED', 'organization', new.id,
      jsonb_build_object('before', old.lifecycle_status, 'after', new.lifecycle_status));
  end if;
  if new.logo_object_key is distinct from old.logo_object_key then
    perform private.write_audit_event(new.id, 'ORGANIZATION_LOGO_CHANGED', 'organization', new.id,
      jsonb_build_object('had_logo_before', old.logo_object_key is not null, 'has_logo_after', new.logo_object_key is not null));
  end if;
  if row(new.name, new.website, new.industry, new.company_size, new.country)
     is distinct from row(old.name, old.website, old.industry, old.company_size, old.country) then
    perform private.write_audit_event(new.id, 'CUSTOMER_PROFILE_UPDATED', 'organization', new.id,
      jsonb_build_object(
        'before', jsonb_build_object('name', old.name, 'website', old.website, 'industry', old.industry, 'company_size', old.company_size, 'country', old.country),
        'after', jsonb_build_object('name', new.name, 'website', new.website, 'industry', new.industry, 'company_size', new.company_size, 'country', new.country)
      ));
  end if;
  return new;
end;
$$;

create or replace function private.guard_assignment_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (select private.is_beauroi_user()) then
    raise exception 'Only Beau Roi staff may manage assignments';
  end if;

  if tg_op = 'INSERT' then
    if not new.is_active or new.ended_at is not null then
      raise exception 'New assignments must start active and without an end timestamp';
    end if;
    if not exists (
      select 1
      from public.organization_memberships membership
      join public.organizations organization on organization.id = membership.organization_id
      where membership.user_id = new.employee_user_id
        and membership.status = 'ACTIVE'
        and membership.role in ('BEAUROI_ADMIN', 'BEAUROI_EMPLOYEE')
        and organization.organization_type = 'BEAUROI'
        and organization.is_active
    ) then
      raise exception 'The assignee must be an active Beau Roi user';
    end if;
    new.assigned_by = (select auth.uid());
    new.assigned_at = now();
    return new;
  end if;

  -- Only the one-way state transition fields may ever change. Comparing the
  -- complete row minus this allowlist also protects the id and future columns.
  if (to_jsonb(new) - array['is_active', 'ended_at'])
     is distinct from
     (to_jsonb(old) - array['is_active', 'ended_at']) then
    raise exception 'Assignment history fields are immutable';
  end if;

  if not old.is_active then
    if new.is_active then
      raise exception 'Ended assignments cannot be reactivated';
    end if;
    if new.ended_at is distinct from old.ended_at then
      raise exception 'An ended assignment timestamp is immutable';
    end if;
    return new;
  end if;

  if new.is_active then
    if new.ended_at is not null then
      raise exception 'An active assignment cannot have an end timestamp';
    end if;
    return new;
  end if;

  if new.ended_at is null then new.ended_at = now(); end if;
  if new.ended_at < old.assigned_at then
    raise exception 'An assignment cannot end before it was assigned';
  end if;
  return new;
end;
$$;

create or replace function private.audit_assignment_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.write_audit_event(new.organization_id,
    case when tg_op = 'INSERT' then 'CUSTOMER_ASSIGNMENT_CREATED' else 'CUSTOMER_ASSIGNMENT_ENDED' end,
    'customer_assignment', new.id,
    jsonb_build_object('assignment_type', new.assignment_type, 'employee_user_id', new.employee_user_id,
      'is_active', new.is_active));
  return new;
end;
$$;

create or replace function private.guard_health_score()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (select private.is_beauroi_user()) then
    raise exception 'Only Beau Roi staff may record health scores';
  end if;
  new.calculated_by = (select auth.uid());
  new.calculated_at = now();
  return new;
end;
$$;

create or replace function private.audit_health_score()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.write_audit_event(new.organization_id, 'HEALTH_SCORE_RECORDED', 'health_score', new.id,
    jsonb_build_object('score', new.score, 'reason', new.reason, 'source', new.source));
  return new;
end;
$$;

create or replace function private.guard_membership_update()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  beauroi_admin boolean := (select private.is_beauroi_admin());
  allowed_fields text[] := array['role', 'status', 'updated_at'];
  customer_admin boolean := exists (
    select 1 from public.organization_memberships membership
    where membership.user_id = (select auth.uid())
      and membership.organization_id = old.organization_id
      and membership.status = 'ACTIVE'
      and membership.role = 'CUSTOMER_ADMIN'
  );
  invitation_acceptance boolean := false;
begin
  if current_setting('nexora.invitation_acceptance', true) = 'on' then
    perform private.assert_internal_workflow();
    invitation_acceptance := exists (
      select 1 from public.organization_invitations invitation
      where invitation.organization_id = old.organization_id
        and invitation.normalized_email = lower(btrim(coalesce((select auth.jwt()) ->> 'email', '')))
        and invitation.intended_role = new.role
        and invitation.status = 'PENDING'
        and invitation.expires_at > now()
    ) and old.user_id = (select auth.uid()) and new.user_id = old.user_id
      and new.status = 'ACTIVE';
  end if;

  if not beauroi_admin and not customer_admin and not invitation_acceptance then
    raise exception 'Membership update is not permitted';
  end if;
  if invitation_acceptance then
    allowed_fields := allowed_fields || array['joined_at'];
    if old.joined_at is not null and new.joined_at is distinct from old.joined_at then
      raise exception 'Membership join history is immutable';
    end if;
  end if;
  if (to_jsonb(new) - allowed_fields) is distinct from (to_jsonb(old) - allowed_fields) then
    raise exception 'Membership identity and history fields are immutable';
  end if;
  if (customer_admin or invitation_acceptance) and (old.role not in ('CUSTOMER_ADMIN', 'CUSTOMER_MEMBER')
     or new.role not in ('CUSTOMER_ADMIN', 'CUSTOMER_MEMBER')) then
    raise exception 'Customer administrators may only manage customer roles';
  end if;
  if customer_admin and old.user_id = (select auth.uid()) and (new.role <> old.role or new.status <> old.status) then
    raise exception 'Administrators cannot change their own membership';
  end if;
  if old.role = 'CUSTOMER_ADMIN' and old.status = 'ACTIVE'
     and (new.role <> 'CUSTOMER_ADMIN' or new.status <> 'ACTIVE') then
    perform pg_advisory_xact_lock(hashtextextended(old.organization_id::text || ':customer-admin', 0));
    if not exists (
       select 1 from public.organization_memberships other
       where other.organization_id = old.organization_id and other.id <> old.id
         and other.role = 'CUSTOMER_ADMIN' and other.status = 'ACTIVE'
     ) then
      raise exception 'The last active customer administrator cannot be removed';
    end if;
  end if;
  return new;
end;
$$;

create or replace function private.audit_membership_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.role <> old.role then
    perform private.write_audit_event(new.organization_id, 'MEMBER_ROLE_CHANGED', 'organization_membership', new.id,
      jsonb_build_object('user_id', new.user_id, 'before', old.role, 'after', new.role));
  end if;
  if new.status <> old.status then
    perform private.write_audit_event(new.organization_id, 'MEMBER_STATUS_CHANGED', 'organization_membership', new.id,
      jsonb_build_object('user_id', new.user_id, 'before', old.status, 'after', new.status));
  end if;
  return new;
end;
$$;

create or replace function private.guard_invitation_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if not (select private.can_administer_organization(new.organization_id)) then
      raise exception 'Invitation creation is not permitted';
    end if;
    if new.invited_by <> (select auth.uid()) or new.intended_role not in ('CUSTOMER_ADMIN', 'CUSTOMER_MEMBER') then
      raise exception 'Invalid invitation actor or role';
    end if;
    if not exists (select 1 from public.organizations organization where organization.id = new.organization_id and organization.organization_type = 'CUSTOMER') then
      raise exception 'Invitations are only available for customer organizations';
    end if;
  else
    if new.status = 'ACCEPTED' then
      if old.status <> 'PENDING' or new.accepted_by <> (select auth.uid()) or new.accepted_at is null
         or old.normalized_email <> lower(btrim(coalesce((select auth.jwt()) ->> 'email', '')))
         or row(new.organization_id, new.normalized_email, new.intended_role, new.invited_by, new.token_hash,
                new.created_at, new.expires_at, new.revoked_at, new.revoked_by)
            is distinct from
            row(old.organization_id, old.normalized_email, old.intended_role, old.invited_by, old.token_hash,
                old.created_at, old.expires_at, old.revoked_at, old.revoked_by) then
        raise exception 'Only the matching user may accept a pending invitation';
      end if;
    else
      if not (select private.can_administer_organization(old.organization_id)) then
        raise exception 'Invitation update is not permitted';
      end if;
      if old.status <> 'PENDING' or new.status <> 'REVOKED'
         or new.revoked_by <> (select auth.uid()) or new.revoked_at is null
         or row(new.organization_id, new.normalized_email, new.intended_role, new.invited_by, new.token_hash,
                new.created_at, new.expires_at, new.accepted_at, new.accepted_by)
            is distinct from
            row(old.organization_id, old.normalized_email, old.intended_role, old.invited_by, old.token_hash,
                old.created_at, old.expires_at, old.accepted_at, old.accepted_by) then
        raise exception 'Only a pending invitation may be revoked';
      end if;
    end if;
  end if;
  return new;
end;
$$;

create or replace function private.audit_invitation_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.write_audit_event(new.organization_id,
    case when tg_op = 'INSERT' then 'INVITATION_CREATED'
         when new.status = 'ACCEPTED' then 'INVITATION_ACCEPTED'
         else 'INVITATION_REVOKED' end,
    'organization_invitation', new.id,
    jsonb_build_object('normalized_email', new.normalized_email, 'intended_role', new.intended_role,
      'expires_at', new.expires_at, 'status', new.status));
  return new;
end;
$$;

create or replace function private.list_organization_invitations(target_organization_id uuid)
returns table (
  id uuid,
  normalized_email text,
  intended_role public.app_role,
  status public.invitation_status,
  created_at timestamptz,
  expires_at timestamptz,
  accepted_at timestamptz,
  revoked_at timestamptz
)
language plpgsql
stable
set search_path = ''
as $$
begin
  if not (select private.can_administer_organization(target_organization_id)) then
    raise exception 'Invitation administration is not permitted';
  end if;
  return query
    select invitation.id, invitation.normalized_email, invitation.intended_role,
      invitation.status, invitation.created_at, invitation.expires_at,
      invitation.accepted_at, invitation.revoked_at
    from public.organization_invitations invitation
    where invitation.organization_id = target_organization_id
    order by invitation.created_at desc, invitation.id desc;
end;
$$;

create or replace function private.create_organization_invitation(
  target_organization_id uuid,
  invited_email text,
  invitation_role public.app_role,
  invitation_token_hash text,
  invitation_expires_at timestamptz
)
returns table (
  id uuid,
  normalized_email text,
  intended_role public.app_role,
  status public.invitation_status,
  created_at timestamptz,
  expires_at timestamptz
)
language plpgsql
set search_path = ''
as $$
declare
  normalized_invited_email text := lower(btrim(invited_email));
begin
  if not (select private.can_administer_organization(target_organization_id)) then
    raise exception 'Invitation creation is not permitted';
  end if;
  if invitation_role not in ('CUSTOMER_ADMIN', 'CUSTOMER_MEMBER') then
    raise exception 'Invalid invitation role';
  end if;
  if invitation_token_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid invitation credential';
  end if;
  if invitation_expires_at <= now() or invitation_expires_at > now() + interval '30 days' then
    raise exception 'Invitation expiry must be between one moment and 30 days';
  end if;

  return query
    insert into public.organization_invitations (
      organization_id, normalized_email, intended_role, invited_by, token_hash, expires_at
    ) values (
      target_organization_id, normalized_invited_email, invitation_role,
      (select auth.uid()), invitation_token_hash, invitation_expires_at
    )
    returning organization_invitations.id, organization_invitations.normalized_email,
      organization_invitations.intended_role, organization_invitations.status,
      organization_invitations.created_at, organization_invitations.expires_at;
end;
$$;

create or replace function private.revoke_organization_invitation(
  target_organization_id uuid,
  target_invitation_id uuid
)
returns table (id uuid, status public.invitation_status)
language plpgsql
set search_path = ''
as $$
begin
  if not (select private.can_administer_organization(target_organization_id)) then
    raise exception 'The invitation is invalid or unavailable';
  end if;
  return query
    update public.organization_invitations invitation
    set status = 'REVOKED', revoked_at = now(), revoked_by = (select auth.uid())
    where invitation.id = target_invitation_id
      and invitation.organization_id = target_organization_id
      and invitation.status = 'PENDING'
    returning invitation.id, invitation.status;
  if not found then
    raise exception 'The invitation is invalid or unavailable';
  end if;
end;
$$;

create or replace function private.accept_organization_invitation(invitation_token text)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  invitation public.organization_invitations%rowtype;
  authenticated_email text := lower(btrim(coalesce((select auth.jwt()) ->> 'email', '')));
  invitation_token_hash text;
  membership_id uuid;
  previous_acceptance_marker text := current_setting('nexora.invitation_acceptance', true);
begin
  if (select auth.uid()) is null or authenticated_email = ''
     or char_length(invitation_token) < 32 or char_length(invitation_token) > 512 then
    raise exception 'The invitation is invalid or unavailable';
  end if;
  invitation_token_hash := encode(
    extensions.digest(convert_to(invitation_token, 'UTF8'), 'sha256'),
    'hex'
  );
  select * into invitation
  from public.organization_invitations candidate
  where candidate.token_hash = invitation_token_hash
    and candidate.normalized_email = authenticated_email
  for update;
  if not found or invitation.status <> 'PENDING' or invitation.expires_at <= now() then
    raise exception 'The invitation is invalid or unavailable';
  end if;
  perform set_config('nexora.invitation_acceptance', 'on', true);
  insert into public.organization_memberships (
    organization_id, user_id, role, status, is_primary, invited_by, joined_at
  ) values (
    invitation.organization_id, (select auth.uid()), invitation.intended_role, 'ACTIVE',
    not exists (select 1 from public.organization_memberships where user_id = (select auth.uid()) and status = 'ACTIVE'),
    invitation.invited_by, now()
  )
  on conflict (organization_id, user_id) do update
    set role = excluded.role, status = 'ACTIVE', joined_at = coalesce(public.organization_memberships.joined_at, now()), updated_at = now()
    where public.organization_memberships.status <> 'ACTIVE'
  returning id into membership_id;
  if membership_id is null then raise exception 'The invitation is invalid or unavailable'; end if;
  perform set_config(
    'nexora.invitation_acceptance',
    coalesce(nullif(previous_acceptance_marker, ''), 'off'),
    true
  );
  update public.organization_invitations
  set status = 'ACCEPTED', accepted_at = now(), accepted_by = (select auth.uid())
  where id = invitation.id;
  return invitation.organization_id;
end;
$$;

create or replace function public.list_organization_invitations(target_organization_id uuid)
returns table (
  id uuid,
  normalized_email text,
  intended_role public.app_role,
  status public.invitation_status,
  created_at timestamptz,
  expires_at timestamptz,
  accepted_at timestamptz,
  revoked_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select * from private.list_organization_invitations(target_organization_id);
$$;

create or replace function public.create_organization_invitation(
  target_organization_id uuid,
  invited_email text,
  invitation_role public.app_role,
  invitation_token_hash text,
  invitation_expires_at timestamptz
)
returns table (
  id uuid,
  normalized_email text,
  intended_role public.app_role,
  status public.invitation_status,
  created_at timestamptz,
  expires_at timestamptz
)
language sql
volatile
security definer
set search_path = ''
as $$
  select * from private.create_organization_invitation(
    target_organization_id, invited_email, invitation_role,
    invitation_token_hash, invitation_expires_at
  );
$$;

create or replace function public.revoke_organization_invitation(
  target_organization_id uuid,
  target_invitation_id uuid
)
returns table (id uuid, status public.invitation_status)
language sql
volatile
security definer
set search_path = ''
as $$
  select * from private.revoke_organization_invitation(
    target_organization_id, target_invitation_id
  );
$$;

create or replace function public.accept_organization_invitation(invitation_token text)
returns uuid
language sql
volatile
security definer
set search_path = ''
as $$
  select private.accept_organization_invitation(invitation_token);
$$;

create or replace function private.replace_customer_assignment(
  assignment_organization_id uuid,
  assignment_type_value text,
  assignment_employee_user_id uuid,
  assignment_internal_note text default null
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  assignment_id uuid;
begin
  if not (select private.is_beauroi_user()) then raise exception 'Assignment is not permitted'; end if;
  if assignment_type_value not in ('CSM', 'IMPLEMENTATION_ENGINEER') then raise exception 'Invalid assignment type'; end if;
  if not exists (
    select 1 from public.organizations organization
    where organization.id = assignment_organization_id and organization.organization_type = 'CUSTOMER'
  ) then raise exception 'Customer not found'; end if;
  perform pg_advisory_xact_lock(hashtextextended(assignment_organization_id::text || assignment_type_value, 0));
  update public.customer_assignments
  set is_active = false, ended_at = now()
  where organization_id = assignment_organization_id and assignment_type = assignment_type_value
    and product_id is null and is_active;
  insert into public.customer_assignments (
    organization_id, employee_user_id, assignment_type, assigned_by, assigned_at
  ) values (
    assignment_organization_id, assignment_employee_user_id, assignment_type_value,
    (select auth.uid()), now()
  ) returning id into assignment_id;
  if nullif(btrim(assignment_internal_note), '') is not null then
    insert into private.customer_assignment_notes (assignment_id, note, created_by)
    values (assignment_id, btrim(assignment_internal_note), (select auth.uid()));
  end if;
  return assignment_id;
end;
$$;

create or replace function public.replace_customer_assignment(
  assignment_organization_id uuid,
  assignment_type_value text,
  assignment_employee_user_id uuid,
  assignment_internal_note text default null
)
returns uuid
language sql
volatile
security definer
set search_path = ''
as $$
  select private.replace_customer_assignment(
    assignment_organization_id, assignment_type_value, assignment_employee_user_id, assignment_internal_note
  );
$$;

create or replace function private.get_customer_assignment_notes(target_organization_id uuid)
returns table (assignment_id uuid, note text)
language plpgsql
stable
set search_path = ''
as $$
begin
  if not (select private.is_beauroi_user()) then raise exception 'Beau Roi access is required'; end if;
  return query
    select assignment_note.assignment_id, assignment_note.note
    from private.customer_assignment_notes assignment_note
    join public.customer_assignments assignment on assignment.id = assignment_note.assignment_id
    where assignment.organization_id = target_organization_id;
end;
$$;

create or replace function public.get_customer_assignment_notes(target_organization_id uuid)
returns table (assignment_id uuid, note text)
language sql
stable
security definer
set search_path = ''
as $$
  select * from private.get_customer_assignment_notes(target_organization_id);
$$;

create or replace function private.set_organization_logo_object_key(
  target_organization_id uuid,
  new_logo_object_key text
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  previous_logo_marker text := current_setting('nexora.logo_update', true);
begin
  if not (select private.can_administer_organization(target_organization_id)) then
    raise exception 'Organization logo update is not permitted';
  end if;
  if new_logo_object_key is not null and (
    new_logo_object_key not like 'organizations/' || target_organization_id::text || '/logos/%'
    or new_logo_object_key !~ '/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|png|webp)$'
  ) then
    raise exception 'Invalid organization logo object key';
  end if;
  perform set_config('nexora.logo_update', 'on', true);
  update public.organizations
  set logo_object_key = new_logo_object_key
  where id = target_organization_id;
  if not found then raise exception 'Organization not found'; end if;
  perform set_config(
    'nexora.logo_update',
    coalesce(nullif(previous_logo_marker, ''), 'off'),
    true
  );
  return target_organization_id;
end;
$$;

create or replace function public.set_organization_logo_object_key(
  target_organization_id uuid,
  new_logo_object_key text
)
returns uuid
language sql
volatile
security definer
set search_path = ''
as $$
  select private.set_organization_logo_object_key(target_organization_id, new_logo_object_key);
$$;

revoke all on function private.current_actor_context() from public, anon, authenticated;
revoke all on function private.request_id() from public, anon, authenticated;
revoke all on function private.assert_internal_workflow() from public, anon, authenticated;
revoke all on function private.write_audit_event(uuid, text, text, uuid, jsonb) from public, anon, authenticated;
revoke all on function private.guard_organization_update() from public, anon, authenticated;
revoke all on function private.audit_organization_update() from public, anon, authenticated;
revoke all on function private.guard_assignment_write() from public, anon, authenticated;
revoke all on function private.audit_assignment_change() from public, anon, authenticated;
revoke all on function private.guard_health_score() from public, anon, authenticated;
revoke all on function private.audit_health_score() from public, anon, authenticated;
revoke all on function private.guard_membership_update() from public, anon, authenticated;
revoke all on function private.audit_membership_update() from public, anon, authenticated;
revoke all on function private.guard_invitation_write() from public, anon, authenticated;
revoke all on function private.audit_invitation_change() from public, anon, authenticated;
revoke all on function private.list_organization_invitations(uuid) from public, anon, authenticated;
revoke all on function private.create_organization_invitation(uuid, text, public.app_role, text, timestamptz) from public, anon, authenticated;
revoke all on function private.revoke_organization_invitation(uuid, uuid) from public, anon, authenticated;
revoke all on function private.accept_organization_invitation(text) from public, anon, authenticated;
revoke all on function public.list_organization_invitations(uuid) from public, anon, authenticated;
revoke all on function public.create_organization_invitation(uuid, text, public.app_role, text, timestamptz) from public, anon, authenticated;
revoke all on function public.revoke_organization_invitation(uuid, uuid) from public, anon, authenticated;
revoke all on function public.accept_organization_invitation(text) from public, anon, authenticated;
grant execute on function public.list_organization_invitations(uuid) to authenticated;
grant execute on function public.create_organization_invitation(uuid, text, public.app_role, text, timestamptz) to authenticated;
grant execute on function public.revoke_organization_invitation(uuid, uuid) to authenticated;
grant execute on function public.accept_organization_invitation(text) to authenticated;
revoke all on function private.replace_customer_assignment(uuid, text, uuid, text) from public, anon, authenticated;
revoke all on function public.replace_customer_assignment(uuid, text, uuid, text) from public, anon, authenticated;
grant execute on function public.replace_customer_assignment(uuid, text, uuid, text) to authenticated;
revoke all on function private.get_customer_assignment_notes(uuid) from public, anon, authenticated;
revoke all on function public.get_customer_assignment_notes(uuid) from public, anon, authenticated;
grant execute on function public.get_customer_assignment_notes(uuid) to authenticated;
revoke all on function private.set_organization_logo_object_key(uuid, text) from public, anon, authenticated;
revoke all on function public.set_organization_logo_object_key(uuid, text) from public, anon, authenticated;
grant execute on function public.set_organization_logo_object_key(uuid, text) to authenticated;

create trigger organizations_guard_update
  before update on public.organizations for each row execute function private.guard_organization_update();
create trigger organizations_audit_update
  after update on public.organizations for each row execute function private.audit_organization_update();
create trigger assignments_guard_write
  before insert or update on public.customer_assignments for each row execute function private.guard_assignment_write();
create trigger assignments_audit_insert
  after insert on public.customer_assignments for each row execute function private.audit_assignment_change();
create trigger assignments_audit_end
  after update of is_active on public.customer_assignments for each row
  when (old.is_active and not new.is_active) execute function private.audit_assignment_change();
create trigger health_scores_guard_insert
  before insert on public.health_score_history for each row execute function private.guard_health_score();
create trigger health_scores_audit_insert
  after insert on public.health_score_history for each row execute function private.audit_health_score();
create trigger memberships_guard_update
  before update on public.organization_memberships for each row execute function private.guard_membership_update();
create trigger memberships_audit_update
  after update on public.organization_memberships for each row execute function private.audit_membership_update();
create trigger invitations_guard_write
  before insert or update on public.organization_invitations for each row execute function private.guard_invitation_write();
create trigger invitations_audit_write
  after insert or update on public.organization_invitations for each row execute function private.audit_invitation_change();

alter table public.organization_invitations enable row level security;

drop policy if exists organizations_update on public.organizations;
create policy organizations_update on public.organizations
  for update to authenticated
  using (
    (select private.is_beauroi_user())
    or (select private.can_administer_organization(id))
  )
  with check (
    (select private.is_beauroi_user())
    or (select private.can_administer_organization(id))
  );

drop policy if exists memberships_read on public.organization_memberships;
create policy memberships_read on public.organization_memberships
  for select to authenticated
  using ((select private.can_access_organization(organization_id)));
drop policy if exists memberships_insert_admin on public.organization_memberships;
create policy memberships_insert_beauroi_admin on public.organization_memberships
  for insert to authenticated with check ((select private.is_beauroi_admin()));

drop policy if exists tenant_read on public.customer_assignments;
create policy assignments_read on public.customer_assignments
  for select to authenticated
  using (
    (select private.is_beauroi_user())
    or (is_active and (select private.is_organization_member(organization_id)))
  );
drop policy if exists beauroi_delete on public.customer_assignments;

drop policy if exists beauroi_update on public.health_score_history;
drop policy if exists beauroi_delete on public.health_score_history;

drop policy if exists audit_events_read_beauroi on public.audit_events;
drop policy if exists audit_events_insert_authenticated on public.audit_events;
create policy audit_events_read_beauroi on public.audit_events
  for select to authenticated using ((select private.is_beauroi_user()));

drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles
  for select to authenticated
  using (
    id = (select auth.uid())
    or (select private.is_beauroi_user())
    or exists (
      select 1
      from public.organization_memberships own_membership
      join public.organization_memberships target_membership
        on target_membership.organization_id = own_membership.organization_id
      where own_membership.user_id = (select auth.uid())
        and own_membership.status = 'ACTIVE'
        and target_membership.user_id = profiles.id
        and target_membership.status = 'ACTIVE'
    )
    or exists (
      select 1
      from public.customer_assignments assignment
      where assignment.employee_user_id = profiles.id
        and assignment.is_active
        and (select private.is_organization_member(assignment.organization_id))
    )
  );

revoke all on public.organization_invitations from anon, authenticated;
grant all on public.organization_invitations to service_role;
revoke insert, update, delete on public.organizations from authenticated;
grant update (name, website, industry, company_size, country, lifecycle_status)
  on public.organizations to authenticated;
revoke insert, update, delete on public.organization_memberships from authenticated;
grant update (role, status) on public.organization_memberships to authenticated;
revoke delete on public.organization_memberships from authenticated;
revoke update, delete on public.health_score_history from authenticated;
grant select, insert on public.health_score_history to authenticated;
revoke insert, update, delete on public.customer_assignments from authenticated;
grant select on public.customer_assignments to authenticated;
revoke insert, update, delete on public.audit_events from authenticated;
grant select on public.audit_events to authenticated;

create or replace view public.customer_management_summary
with (security_invoker = true)
as
select
  organization.id,
  organization.name,
  organization.logo_object_key,
  organization.industry,
  organization.country,
  organization.company_size,
  organization.lifecycle_status,
  organization.created_at,
  health.score as health_score,
  csm.employee_user_id as csm_user_id,
  csm_profile.full_name as csm_name,
  engineer.employee_user_id as implementation_engineer_user_id,
  engineer_profile.full_name as implementation_engineer_name,
  release.version as current_product_version,
  coalesce(tickets.open_ticket_count, 0)::bigint as open_ticket_count,
  greatest(organization.updated_at, activity.last_activity_at) as last_activity_at
from public.organizations organization
left join lateral (
  select history.score
  from public.health_score_history history
  where history.organization_id = organization.id
  order by history.calculated_at desc, history.id desc
  limit 1
) health on true
left join lateral (
  select assignment.employee_user_id
  from public.customer_assignments assignment
  where assignment.organization_id = organization.id and assignment.assignment_type = 'CSM'
    and assignment.is_active and assignment.product_id is null
  order by assignment.assigned_at desc, assignment.id desc limit 1
) csm on true
left join public.profiles csm_profile on csm_profile.id = csm.employee_user_id
left join lateral (
  select assignment.employee_user_id
  from public.customer_assignments assignment
  where assignment.organization_id = organization.id and assignment.assignment_type = 'IMPLEMENTATION_ENGINEER'
    and assignment.is_active and assignment.product_id is null
  order by assignment.assigned_at desc, assignment.id desc limit 1
) engineer on true
left join public.profiles engineer_profile on engineer_profile.id = engineer.employee_user_id
left join lateral (
  select product_release.version
  from public.customer_subscriptions subscription
  join public.product_releases product_release on product_release.product_id = subscription.product_id
  where subscription.organization_id = organization.id
    and subscription.status = 'ACTIVE' and product_release.status = 'ACTIVE'
  order by product_release.released_at desc nulls last, product_release.created_at desc
  limit 1
) release on true
left join lateral (
  select count(*) as open_ticket_count
  from public.support_tickets ticket
  where ticket.organization_id = organization.id
    and ticket.status in ('OPEN', 'IN_PROGRESS', 'WAITING_ON_CUSTOMER')
) tickets on true
left join lateral (
  select max(event.occurred_at) as last_activity_at
  from public.audit_events event where event.organization_id = organization.id
) activity on true
where organization.organization_type = 'CUSTOMER';

revoke all on public.customer_management_summary from public, anon;
grant select on public.customer_management_summary to authenticated, service_role;

comment on table public.organization_invitations is 'Single-use customer invitations. Only SHA-256 token hashes are persisted.';
comment on table private.customer_assignment_notes is 'Beau Roi-only assignment notes, separated from customer-readable assignment rows.';
comment on view public.customer_management_summary is 'RLS-aware portfolio projection for keyset-paginated customer management.';
