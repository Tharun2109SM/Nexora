-- NEXORA Milestone 2: customer management and organization administration.
-- This migration is additive and preserves the Milestone 1 tenancy model.

create type public.invitation_status as enum ('PENDING', 'ACCEPTED', 'REVOKED');

alter table public.organizations
  add column lifecycle_status public.lifecycle_status not null default 'ACTIVE';

alter table public.customer_assignments
  add column assigned_by uuid references auth.users(id) on delete set null,
  add column assigned_at timestamptz not null default now(),
  add column ended_at timestamptz;

alter table public.customer_assignments
  drop constraint customer_assignments_assignment_type_check,
  add constraint customer_assignments_assignment_type_check
    check (assignment_type in ('ACCOUNT_OWNER', 'IMPLEMENTATION_LEAD', 'IMPLEMENTATION_ENGINEER', 'SUPPORT_LEAD', 'CSM')),
  add constraint customer_assignments_dates_check
    check ((is_active and ended_at is null) or (not is_active and ended_at is not null));

do $$
declare
  constraint_name name;
begin
  select constraint_definition.conname into constraint_name
  from pg_constraint constraint_definition
  where constraint_definition.conrelid = 'public.customer_assignments'::regclass
    and constraint_definition.contype = 'u';
  if constraint_name is not null then
    execute format('alter table public.customer_assignments drop constraint %I', constraint_name);
  end if;
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
  check (normalized_email = lower(btrim(normalized_email))),
  check (normalized_email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  check (intended_role in ('CUSTOMER_ADMIN', 'CUSTOMER_MEMBER')),
  check (expires_at > created_at),
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
security definer
set search_path = ''
as $$
declare
  beauroi boolean := (select private.is_beauroi_user());
  customer_admin boolean := exists (
    select 1 from public.organization_memberships membership
    where membership.user_id = (select auth.uid())
      and membership.organization_id = old.id
      and membership.status = 'ACTIVE'
      and membership.role = 'CUSTOMER_ADMIN'
  );
begin
  if not beauroi and not customer_admin then
    raise exception 'Organization update is not permitted';
  end if;
  if new.id <> old.id or new.organization_type <> old.organization_type or new.slug <> old.slug
     or new.is_active <> old.is_active or new.created_at <> old.created_at then
    raise exception 'Protected organization fields cannot be changed';
  end if;
  if not beauroi and new.lifecycle_status <> old.lifecycle_status then
    raise exception 'Only Beau Roi staff may change lifecycle status';
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
  if tg_op = 'INSERT' then
    new.assigned_by = (select auth.uid());
    new.assigned_at = now();
  elsif old.organization_id <> new.organization_id
    or old.assignment_type <> new.assignment_type
    or old.employee_user_id <> new.employee_user_id
    or old.assigned_by is distinct from new.assigned_by
    or old.assigned_at <> new.assigned_at
    or old.product_id is distinct from new.product_id then
    raise exception 'Assignment history fields are immutable';
  end if;
  if not new.is_active and new.ended_at is null then new.ended_at = now(); end if;
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
security definer
set search_path = ''
as $$
declare
  beauroi_admin boolean := (select private.is_beauroi_admin());
  customer_admin boolean := exists (
    select 1 from public.organization_memberships membership
    where membership.user_id = (select auth.uid())
      and membership.organization_id = old.organization_id
      and membership.status = 'ACTIVE'
      and membership.role = 'CUSTOMER_ADMIN'
  );
  invitation_acceptance boolean := exists (
    select 1 from public.organization_invitations invitation
    where invitation.organization_id = old.organization_id
      and invitation.normalized_email = lower(btrim(coalesce((select auth.jwt()) ->> 'email', '')))
      and invitation.intended_role = new.role
      and invitation.status = 'PENDING'
      and invitation.expires_at > now()
  ) and old.user_id = (select auth.uid()) and new.user_id = old.user_id
    and new.status = 'ACTIVE';
begin
  if not beauroi_admin and not customer_admin and not invitation_acceptance then
    raise exception 'Membership update is not permitted';
  end if;
  if new.id <> old.id or new.organization_id <> old.organization_id or new.user_id <> old.user_id
     or new.invited_by is distinct from old.invited_by or new.created_at <> old.created_at
     or new.is_primary <> old.is_primary then
    raise exception 'Protected membership fields cannot be changed';
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

create or replace function private.accept_organization_invitation(invitation_token_hash text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  invitation public.organization_invitations%rowtype;
  authenticated_email text := lower(btrim(coalesce((select auth.jwt()) ->> 'email', '')));
  membership_id uuid;
begin
  if (select auth.uid()) is null or authenticated_email = '' then
    raise exception 'The invitation is invalid or unavailable';
  end if;
  select * into invitation
  from public.organization_invitations candidate
  where candidate.token_hash = invitation_token_hash
    and candidate.normalized_email = authenticated_email
  for update;
  if not found or invitation.status <> 'PENDING' or invitation.expires_at <= now() then
    raise exception 'The invitation is invalid or unavailable';
  end if;
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
  update public.organization_invitations
  set status = 'ACCEPTED', accepted_at = now(), accepted_by = (select auth.uid())
  where id = invitation.id;
  return invitation.organization_id;
end;
$$;

create or replace function public.accept_organization_invitation(invitation_token_hash text)
returns uuid
language sql
volatile
security invoker
set search_path = ''
as $$
  select private.accept_organization_invitation(invitation_token_hash);
$$;

create or replace function private.replace_customer_assignment(
  assignment_organization_id uuid,
  assignment_type_value text,
  assignment_employee_user_id uuid,
  assignment_internal_note text default null
)
returns uuid
language plpgsql
security definer
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
security invoker
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
security definer
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
security invoker
set search_path = ''
as $$
  select * from private.get_customer_assignment_notes(target_organization_id);
$$;

revoke all on function private.current_actor_context() from public, anon, authenticated;
revoke all on function private.request_id() from public, anon, authenticated;
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
revoke all on function private.accept_organization_invitation(text) from public, anon;
grant execute on function private.accept_organization_invitation(text) to authenticated;
revoke all on function public.accept_organization_invitation(text) from public, anon;
grant execute on function public.accept_organization_invitation(text) to authenticated;
revoke all on function private.replace_customer_assignment(uuid, text, uuid, text) from public, anon;
grant execute on function private.replace_customer_assignment(uuid, text, uuid, text) to authenticated;
revoke all on function public.replace_customer_assignment(uuid, text, uuid, text) from public, anon;
grant execute on function public.replace_customer_assignment(uuid, text, uuid, text) to authenticated;
revoke all on function private.get_customer_assignment_notes(uuid) from public, anon;
grant execute on function private.get_customer_assignment_notes(uuid) to authenticated;
revoke all on function public.get_customer_assignment_notes(uuid) from public, anon;
grant execute on function public.get_customer_assignment_notes(uuid) to authenticated;

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

create policy invitations_read on public.organization_invitations
  for select to authenticated
  using (
    (select private.can_administer_organization(organization_id))
    or (
      normalized_email = lower(btrim(coalesce((select auth.jwt()) ->> 'email', '')))
      and status = 'PENDING'
    )
  );
create policy invitations_insert on public.organization_invitations
  for insert to authenticated
  with check ((select private.can_administer_organization(organization_id)));
create policy invitations_revoke on public.organization_invitations
  for update to authenticated
  using ((select private.can_administer_organization(organization_id)))
  with check ((select private.can_administer_organization(organization_id)));

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
grant select, insert, update on public.organization_invitations to authenticated;
grant all on public.organization_invitations to service_role;
revoke update, delete on public.health_score_history from authenticated;
grant select, insert on public.health_score_history to authenticated;
revoke delete on public.customer_assignments from authenticated;
grant select, insert, update on public.customer_assignments to authenticated;
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
