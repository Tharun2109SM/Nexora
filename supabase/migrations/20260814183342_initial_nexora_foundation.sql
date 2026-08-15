-- NEXORA initial secure foundation
-- Core tenancy, identity, extensible product-operations entities, and RLS.

create extension if not exists pgcrypto with schema extensions;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create type public.app_role as enum (
  'BEAUROI_ADMIN',
  'BEAUROI_EMPLOYEE',
  'CUSTOMER_ADMIN',
  'CUSTOMER_MEMBER'
);

create type public.organization_type as enum ('BEAUROI', 'CUSTOMER');
create type public.membership_status as enum ('INVITED', 'ACTIVE', 'SUSPENDED', 'REMOVED');
create type public.lifecycle_status as enum ('DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED', 'ARCHIVED');
create type public.ticket_status as enum ('OPEN', 'IN_PROGRESS', 'WAITING_ON_CUSTOMER', 'RESOLVED', 'CLOSED');
create type public.ticket_priority as enum ('LOW', 'MEDIUM', 'HIGH', 'URGENT');
create type public.feedback_status as enum ('SUBMITTED', 'UNDER_REVIEW', 'PLANNED', 'IN_PROGRESS', 'SHIPPED', 'DECLINED');
create type public.article_status as enum ('DRAFT', 'PUBLISHED', 'ARCHIVED');
create type public.notification_status as enum ('UNREAD', 'READ', 'ARCHIVED');

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 160),
  slug text not null unique check (slug = lower(slug) and slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  organization_type public.organization_type not null default 'CUSTOMER',
  website text,
  industry text,
  company_size text check (company_size is null or company_size in ('1-10', '11-50', '51-200', '201-500', '501-1000', '1000+')),
  country text,
  logo_object_key text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null check (char_length(full_name) between 2 and 120),
  designation text,
  phone text,
  avatar_object_key text,
  timezone text not null default 'Asia/Kolkata',
  locale text not null default 'en-IN',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.role_definitions (
  role public.app_role primary key,
  portal text not null check (portal in ('beauroi', 'customer')),
  display_name text not null,
  description text not null,
  permissions text[] not null default '{}',
  created_at timestamptz not null default now()
);

create table public.organization_memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  status public.membership_status not null default 'INVITED',
  is_primary boolean not null default false,
  invited_by uuid references auth.users(id) on delete set null,
  joined_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

create unique index organization_memberships_one_primary_idx
  on public.organization_memberships (user_id)
  where is_primary and status = 'ACTIVE';
create index organization_memberships_organization_id_idx on public.organization_memberships (organization_id);
create index organization_memberships_user_id_idx on public.organization_memberships (user_id);
create index organization_memberships_active_user_idx on public.organization_memberships (user_id, status, role);

insert into public.role_definitions (role, portal, display_name, description, permissions)
values
  ('BEAUROI_ADMIN', 'beauroi', 'Beau Roi administrator', 'Full platform administration for authorized Beau Roi leaders.', array['platform:admin', 'customers:manage', 'users:manage']),
  ('BEAUROI_EMPLOYEE', 'beauroi', 'Beau Roi employee', 'Customer operations access assigned to Beau Roi staff.', array['customers:read', 'operations:manage']),
  ('CUSTOMER_ADMIN', 'customer', 'Customer administrator', 'Organization administration and customer workspace access.', array['organization:manage', 'members:manage', 'workspace:use']),
  ('CUSTOMER_MEMBER', 'customer', 'Customer member', 'Standard customer workspace access.', array['workspace:use']);

-- Product and customer portfolio foundation.
create table public.products (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code = upper(code)),
  name text not null,
  description text,
  status public.lifecycle_status not null default 'DRAFT',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.customer_subscriptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  status public.lifecycle_status not null default 'ACTIVE',
  starts_on date,
  ends_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, product_id),
  check (ends_on is null or starts_on is null or ends_on >= starts_on)
);
create index customer_subscriptions_organization_id_idx on public.customer_subscriptions (organization_id);
create index customer_subscriptions_product_id_idx on public.customer_subscriptions (product_id);

create table public.customer_assignments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  product_id uuid references public.products(id) on delete cascade,
  employee_user_id uuid not null references auth.users(id) on delete cascade,
  assignment_type text not null check (assignment_type in ('ACCOUNT_OWNER', 'IMPLEMENTATION_LEAD', 'SUPPORT_LEAD', 'CSM')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (organization_id, product_id, employee_user_id, assignment_type)
);
create index customer_assignments_organization_id_idx on public.customer_assignments (organization_id);
create index customer_assignments_employee_user_id_idx on public.customer_assignments (employee_user_id);

-- Onboarding and implementation foundation.
create table public.onboarding_plans (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  name text not null,
  status public.lifecycle_status not null default 'DRAFT',
  starts_on date,
  target_completion_on date,
  owner_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index onboarding_plans_organization_id_idx on public.onboarding_plans (organization_id);
create index onboarding_plans_product_id_idx on public.onboarding_plans (product_id);

create table public.onboarding_tasks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  onboarding_plan_id uuid not null references public.onboarding_plans(id) on delete cascade,
  title text not null,
  description text,
  status public.lifecycle_status not null default 'DRAFT',
  assigned_user_id uuid references auth.users(id) on delete set null,
  due_at timestamptz,
  sort_order integer not null default 0 check (sort_order >= 0),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index onboarding_tasks_organization_id_idx on public.onboarding_tasks (organization_id);
create index onboarding_tasks_plan_id_idx on public.onboarding_tasks (onboarding_plan_id);

create table public.training_sessions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  onboarding_plan_id uuid references public.onboarding_plans(id) on delete cascade,
  title text not null,
  scheduled_at timestamptz not null,
  duration_minutes integer not null check (duration_minutes between 15 and 1440),
  meeting_url text,
  status public.lifecycle_status not null default 'ACTIVE',
  facilitator_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index training_sessions_organization_id_idx on public.training_sessions (organization_id);

create table public.requested_documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  onboarding_plan_id uuid references public.onboarding_plans(id) on delete cascade,
  name text not null,
  description text,
  requested_from_user_id uuid references auth.users(id) on delete set null,
  due_at timestamptz,
  submitted_at timestamptz,
  status public.lifecycle_status not null default 'ACTIVE',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index requested_documents_organization_id_idx on public.requested_documents (organization_id);

create table public.implementation_projects (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  name text not null,
  status public.lifecycle_status not null default 'DRAFT',
  owner_user_id uuid references auth.users(id) on delete set null,
  starts_on date,
  target_go_live_on date,
  actual_go_live_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index implementation_projects_organization_id_idx on public.implementation_projects (organization_id);

create table public.milestones (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  implementation_project_id uuid not null references public.implementation_projects(id) on delete cascade,
  title text not null,
  description text,
  status public.lifecycle_status not null default 'DRAFT',
  due_on date,
  completed_at timestamptz,
  sort_order integer not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index milestones_organization_id_idx on public.milestones (organization_id);
create index milestones_project_id_idx on public.milestones (implementation_project_id);

create table public.project_notes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  implementation_project_id uuid not null references public.implementation_projects(id) on delete cascade,
  author_user_id uuid references auth.users(id) on delete set null,
  body text not null check (char_length(body) between 1 and 20000),
  visibility text not null default 'SHARED' check (visibility in ('INTERNAL', 'SHARED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index project_notes_organization_id_idx on public.project_notes (organization_id);
create index project_notes_project_id_idx on public.project_notes (implementation_project_id);

-- Support foundation.
create table public.sla_policies (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  product_id uuid references public.products(id) on delete cascade,
  name text not null,
  priority public.ticket_priority not null,
  first_response_minutes integer not null check (first_response_minutes > 0),
  resolution_minutes integer check (resolution_minutes is null or resolution_minutes > 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index sla_policies_organization_id_idx on public.sla_policies (organization_id);

create table public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  ticket_number bigint generated always as identity unique,
  subject text not null check (char_length(subject) between 3 and 240),
  description text not null,
  status public.ticket_status not null default 'OPEN',
  priority public.ticket_priority not null default 'MEDIUM',
  created_by uuid not null references auth.users(id) on delete restrict,
  assigned_to uuid references auth.users(id) on delete set null,
  sla_policy_id uuid references public.sla_policies(id) on delete set null,
  first_response_due_at timestamptz,
  resolution_due_at timestamptz,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index support_tickets_organization_id_idx on public.support_tickets (organization_id);
create index support_tickets_status_idx on public.support_tickets (organization_id, status, created_at desc);

create table public.ticket_messages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  author_user_id uuid not null references auth.users(id) on delete restrict,
  body text not null check (char_length(body) between 1 and 30000),
  is_internal boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index ticket_messages_organization_id_idx on public.ticket_messages (organization_id);
create index ticket_messages_ticket_id_idx on public.ticket_messages (ticket_id, created_at);

-- Feedback, defects, and feature requests.
create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  submitted_by uuid not null references auth.users(id) on delete restrict,
  title text not null check (char_length(title) between 3 and 240),
  description text not null,
  category text not null check (category in ('GENERAL', 'BUG', 'FEATURE_REQUEST')),
  status public.feedback_status not null default 'SUBMITTED',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index feedback_organization_id_idx on public.feedback (organization_id);

create table public.bug_reports (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  feedback_id uuid unique references public.feedback(id) on delete cascade,
  severity text not null check (severity in ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  reproduction_steps text,
  environment text,
  affected_version text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index bug_reports_organization_id_idx on public.bug_reports (organization_id);

create table public.feature_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  feedback_id uuid unique references public.feedback(id) on delete cascade,
  problem_statement text not null,
  desired_outcome text,
  status public.feedback_status not null default 'SUBMITTED',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index feature_requests_organization_id_idx on public.feature_requests (organization_id);

create table public.feature_votes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  feature_request_id uuid not null references public.feature_requests(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (feature_request_id, user_id)
);
create index feature_votes_organization_id_idx on public.feature_votes (organization_id);

-- Releases and content. Organization ID is nullable only for Beau Roi-owned global content.
create table public.product_releases (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  version text not null,
  title text not null,
  summary text,
  release_notes text,
  status public.lifecycle_status not null default 'DRAFT',
  released_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, version, organization_id)
);
create index product_releases_organization_id_idx on public.product_releases (organization_id);
create index product_releases_product_id_idx on public.product_releases (product_id);

create table public.maintenance_notices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  title text not null,
  description text not null,
  starts_at timestamptz not null,
  ends_at timestamptz,
  status public.lifecycle_status not null default 'DRAFT',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or ends_at > starts_at)
);
create index maintenance_notices_organization_id_idx on public.maintenance_notices (organization_id);

create table public.knowledge_base_articles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  product_id uuid references public.products(id) on delete cascade,
  slug text not null,
  title text not null,
  summary text,
  body text not null,
  status public.article_status not null default 'DRAFT',
  audience text not null default 'CUSTOMER' check (audience in ('INTERNAL', 'CUSTOMER', 'ALL')),
  author_user_id uuid references auth.users(id) on delete set null,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, slug)
);
create index knowledge_base_articles_organization_id_idx on public.knowledge_base_articles (organization_id);
create index knowledge_base_articles_product_id_idx on public.knowledge_base_articles (product_id);

-- Files, notifications, health, and audit.
create table public.attachments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  uploaded_by uuid not null references auth.users(id) on delete restrict,
  entity_type text not null check (entity_type in ('ORGANIZATION', 'ONBOARDING_TASK', 'REQUESTED_DOCUMENT', 'PROJECT_NOTE', 'TICKET', 'TICKET_MESSAGE', 'FEEDBACK', 'ARTICLE')),
  entity_id uuid not null,
  object_key text not null unique,
  original_filename text not null,
  content_type text not null,
  size_bytes bigint not null check (size_bytes > 0),
  checksum_sha256 text,
  created_at timestamptz not null default now()
);
create index attachments_organization_id_idx on public.attachments (organization_id);
create index attachments_entity_idx on public.attachments (entity_type, entity_id);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  body text not null,
  category text not null,
  link_path text,
  status public.notification_status not null default 'UNREAD',
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_organization_id_idx on public.notifications (organization_id);
create index notifications_user_unread_idx on public.notifications (user_id, created_at desc) where status = 'UNREAD';

create table public.health_score_history (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  score numeric(5,2) not null check (score between 0 and 100),
  factors jsonb not null default '{}'::jsonb,
  calculated_at timestamptz not null default now(),
  calculated_by uuid references auth.users(id) on delete set null
);
create index health_score_history_organization_id_idx on public.health_score_history (organization_id, calculated_at desc);

create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete set null,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  request_id text,
  ip_address inet,
  user_agent text,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);
create index audit_events_organization_id_idx on public.audit_events (organization_id, occurred_at desc);
create index audit_events_actor_user_id_idx on public.audit_events (actor_user_id, occurred_at desc);

-- Security-definer functions are kept outside exposed schemas and always bind checks to auth.uid().
create or replace function private.is_beauroi_user()
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
      and membership.status = 'ACTIVE'
      and membership.role in ('BEAUROI_ADMIN', 'BEAUROI_EMPLOYEE')
      and organization.organization_type = 'BEAUROI'
      and organization.is_active
  );
$$;

create or replace function private.is_beauroi_admin()
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
      and membership.status = 'ACTIVE'
      and membership.role = 'BEAUROI_ADMIN'
      and organization.organization_type = 'BEAUROI'
      and organization.is_active
  );
$$;

create or replace function private.is_organization_member(target_organization_id uuid)
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
      and organization.is_active
  );
$$;

create or replace function private.can_administer_organization(target_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null and (
    (select private.is_beauroi_admin())
    or exists (
      select 1
      from public.organization_memberships membership
      where membership.user_id = (select auth.uid())
        and membership.organization_id = target_organization_id
        and membership.status = 'ACTIVE'
        and membership.role = 'CUSTOMER_ADMIN'
    )
  );
$$;

create or replace function private.can_access_organization(target_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and ((select private.is_beauroi_user()) or (select private.is_organization_member(target_organization_id)));
$$;

revoke all on all functions in schema private from public, anon, authenticated;
grant usage on schema private to authenticated;
grant execute on function private.is_beauroi_user() to authenticated;
grant execute on function private.is_beauroi_admin() to authenticated;
grant execute on function private.is_organization_member(uuid) to authenticated;
grant execute on function private.can_administer_organization(uuid) to authenticated;
grant execute on function private.can_access_organization(uuid) to authenticated;

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'organizations', 'profiles', 'organization_memberships', 'products', 'customer_subscriptions',
    'onboarding_plans', 'onboarding_tasks', 'training_sessions', 'requested_documents',
    'implementation_projects', 'milestones', 'project_notes', 'sla_policies', 'support_tickets',
    'ticket_messages', 'feedback', 'bug_reports', 'feature_requests', 'product_releases',
    'maintenance_notices', 'knowledge_base_articles'
  ] loop
    execute format(
      'create trigger %I before update on public.%I for each row execute function private.set_updated_at()',
      table_name || '_set_updated_at',
      table_name
    );
  end loop;
end;
$$;

-- Signup trigger: public signup always creates a CUSTOMER organization and CUSTOMER_ADMIN.
-- User metadata is copied into business records only at account creation; it is never used for authorization.
create or replace function private.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_organization_id uuid;
  company_name text;
  generated_slug text;
  account_type text;
begin
  account_type := new.raw_app_meta_data ->> 'nexora_account_type';

  if account_type = 'BEAUROI' then
    insert into public.profiles (id, full_name, designation, phone)
    values (
      new.id,
      coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), 'Beau Roi user'),
      nullif(trim(new.raw_user_meta_data ->> 'designation'), ''),
      nullif(trim(new.raw_user_meta_data ->> 'phone'), '')
    );
    return new;
  end if;

  company_name := nullif(trim(new.raw_user_meta_data ->> 'company_name'), '');
  if company_name is null or char_length(company_name) < 2 then
    raise exception 'A valid organization name is required for customer registration';
  end if;

  generated_slug := trim(both '-' from regexp_replace(lower(company_name), '[^a-z0-9]+', '-', 'g'))
    || '-' || substr(replace(new.id::text, '-', ''), 1, 8);

  insert into public.organizations (
    name,
    slug,
    organization_type,
    website,
    industry,
    company_size,
    country
  )
  values (
    company_name,
    generated_slug,
    'CUSTOMER',
    nullif(trim(new.raw_user_meta_data ->> 'company_website'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'industry'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'company_size'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'country'), '')
  )
  returning id into new_organization_id;

  insert into public.profiles (id, full_name, designation, phone)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), 'Customer administrator'),
    nullif(trim(new.raw_user_meta_data ->> 'designation'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'phone'), '')
  );

  insert into public.organization_memberships (
    organization_id,
    user_id,
    role,
    status,
    is_primary,
    joined_at
  )
  values (new_organization_id, new.id, 'CUSTOMER_ADMIN', 'ACTIVE', true, now());

  return new;
end;
$$;

revoke all on function private.handle_new_auth_user() from public, anon, authenticated;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_auth_user();

-- Least-privilege Data API grants. RLS remains the final authorization boundary.
revoke all on all tables in schema public from anon;
grant usage on schema public to authenticated;
grant select on public.role_definitions to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;

-- Enable RLS on every exposed table.
do $$
declare
  table_name text;
begin
  for table_name in
    select tablename from pg_tables where schemaname = 'public'
  loop
    execute format('alter table public.%I enable row level security', table_name);
  end loop;
end;
$$;

create policy role_definitions_read on public.role_definitions
  for select to authenticated using ((select auth.uid()) is not null);

create policy organizations_read on public.organizations
  for select to authenticated
  using ((select private.can_access_organization(id)));
create policy organizations_update on public.organizations
  for update to authenticated
  using ((select private.can_administer_organization(id)))
  with check ((select private.can_administer_organization(id)));

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
  );
create policy profiles_update_self on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy memberships_read on public.organization_memberships
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or (select private.is_beauroi_user())
    or (select private.can_administer_organization(organization_id))
  );
create policy memberships_insert_admin on public.organization_memberships
  for insert to authenticated
  with check ((select private.can_administer_organization(organization_id)));
create policy memberships_update_admin on public.organization_memberships
  for update to authenticated
  using ((select private.can_administer_organization(organization_id)))
  with check ((select private.can_administer_organization(organization_id)));

create policy products_read on public.products
  for select to authenticated
  using (
    (select private.is_beauroi_user())
    or exists (
      select 1
      from public.customer_subscriptions subscription
      where subscription.product_id = products.id
        and subscription.status = 'ACTIVE'
        and (select private.is_organization_member(subscription.organization_id))
    )
  );
create policy products_insert_beauroi on public.products
  for insert to authenticated with check ((select private.is_beauroi_user()));
create policy products_update_beauroi on public.products
  for update to authenticated
  using ((select private.is_beauroi_user()))
  with check ((select private.is_beauroi_user()));
create policy products_delete_beauroi on public.products
  for delete to authenticated using ((select private.is_beauroi_user()));

-- Standard tenant policy: tenant members may read their data; Beau Roi staff may manage it.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'customer_subscriptions', 'customer_assignments', 'onboarding_plans', 'onboarding_tasks',
    'training_sessions', 'requested_documents', 'implementation_projects', 'milestones',
    'project_notes', 'sla_policies', 'support_tickets', 'ticket_messages', 'feedback',
    'bug_reports', 'feature_requests', 'feature_votes', 'attachments', 'health_score_history'
  ] loop
    execute format(
      'create policy tenant_read on public.%I for select to authenticated using ((select private.can_access_organization(organization_id)))',
      table_name
    );
    execute format(
      'create policy beauroi_insert on public.%I for insert to authenticated with check ((select private.is_beauroi_user()))',
      table_name
    );
    execute format(
      'create policy beauroi_update on public.%I for update to authenticated using ((select private.is_beauroi_user())) with check ((select private.is_beauroi_user()))',
      table_name
    );
    execute format(
      'create policy beauroi_delete on public.%I for delete to authenticated using ((select private.is_beauroi_user()))',
      table_name
    );
  end loop;
end;
$$;

create policy notifications_read_own on public.notifications
  for select to authenticated
  using (
    (user_id = (select auth.uid()) and (select private.can_access_organization(organization_id)))
    or (select private.is_beauroi_user())
  );
create policy notifications_update_own on public.notifications
  for update to authenticated
  using (user_id = (select auth.uid()) or (select private.is_beauroi_user()))
  with check (
    (user_id = (select auth.uid()) and (select private.can_access_organization(organization_id)))
    or (select private.is_beauroi_user())
  );
create policy notifications_insert_beauroi on public.notifications
  for insert to authenticated with check ((select private.is_beauroi_user()));
create policy notifications_delete_beauroi on public.notifications
  for delete to authenticated using ((select private.is_beauroi_user()));

create policy releases_read on public.product_releases
  for select to authenticated
  using (
    (select private.is_beauroi_user())
    or (
      status = 'ACTIVE'
      and (organization_id is null or (select private.is_organization_member(organization_id)))
      and exists (
        select 1 from public.customer_subscriptions subscription
        where subscription.product_id = product_releases.product_id
          and subscription.status = 'ACTIVE'
          and (select private.is_organization_member(subscription.organization_id))
      )
    )
  );
create policy releases_insert_beauroi on public.product_releases
  for insert to authenticated with check ((select private.is_beauroi_user()));
create policy releases_update_beauroi on public.product_releases
  for update to authenticated
  using ((select private.is_beauroi_user()))
  with check ((select private.is_beauroi_user()));
create policy releases_delete_beauroi on public.product_releases
  for delete to authenticated using ((select private.is_beauroi_user()));

create policy maintenance_read on public.maintenance_notices
  for select to authenticated
  using (
    (select private.is_beauroi_user())
    or (
      status = 'ACTIVE'
      and (organization_id is null or (select private.is_organization_member(organization_id)))
      and exists (
        select 1 from public.customer_subscriptions subscription
        where subscription.product_id = maintenance_notices.product_id
          and subscription.status = 'ACTIVE'
          and (select private.is_organization_member(subscription.organization_id))
      )
    )
  );
create policy maintenance_insert_beauroi on public.maintenance_notices
  for insert to authenticated with check ((select private.is_beauroi_user()));
create policy maintenance_update_beauroi on public.maintenance_notices
  for update to authenticated
  using ((select private.is_beauroi_user()))
  with check ((select private.is_beauroi_user()));
create policy maintenance_delete_beauroi on public.maintenance_notices
  for delete to authenticated using ((select private.is_beauroi_user()));

create policy articles_read on public.knowledge_base_articles
  for select to authenticated
  using (
    (select private.is_beauroi_user())
    or (
      status = 'PUBLISHED'
      and audience in ('CUSTOMER', 'ALL')
      and (organization_id is null or (select private.is_organization_member(organization_id)))
    )
  );
create policy articles_insert_beauroi on public.knowledge_base_articles
  for insert to authenticated with check ((select private.is_beauroi_user()));
create policy articles_update_beauroi on public.knowledge_base_articles
  for update to authenticated
  using ((select private.is_beauroi_user()))
  with check ((select private.is_beauroi_user()));
create policy articles_delete_beauroi on public.knowledge_base_articles
  for delete to authenticated using ((select private.is_beauroi_user()));

create policy audit_events_read_beauroi on public.audit_events
  for select to authenticated using ((select private.is_beauroi_admin()));
create policy audit_events_insert_authenticated on public.audit_events
  for insert to authenticated
  with check (
    actor_user_id = (select auth.uid())
    and (organization_id is null or (select private.can_access_organization(organization_id)))
  );

comment on schema private is 'Non-exposed authorization and trigger functions for NEXORA.';
comment on column public.attachments.object_key is 'Private Cloudflare R2 object key; never a public bucket URL.';
comment on column public.organizations.logo_object_key is 'Private Cloudflare R2 key resolved through an authorized API response.';
