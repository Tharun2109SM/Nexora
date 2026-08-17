-- NEXORA Milestone 3: governed product onboarding and implementation workflows.
-- Existing Milestone 1 tables are evolved in place; progress is always derived.

create type public.onboarding_status as enum (
  'DRAFT',
  'NOT_STARTED',
  'IN_PROGRESS',
  'BLOCKED',
  'READY_FOR_GO_LIVE',
  'LIVE',
  'CANCELLED'
);
create type public.workflow_item_status as enum (
  'NOT_STARTED',
  'IN_PROGRESS',
  'BLOCKED',
  'COMPLETED',
  'CANCELLED'
);
create type public.training_status as enum ('SCHEDULED', 'COMPLETED', 'CANCELLED');
create type public.training_delivery_method as enum ('REMOTE', 'ONSITE', 'HYBRID');
create type public.document_request_status as enum (
  'REQUESTED',
  'RECEIVED',
  'ACCEPTED',
  'REJECTED',
  'WAIVED'
);
create type public.implementation_status as enum (
  'DRAFT',
  'NOT_STARTED',
  'IN_PROGRESS',
  'BLOCKED',
  'COMPLETED',
  'CANCELLED'
);
create type public.implementation_phase as enum (
  'DISCOVERY',
  'REQUIREMENTS',
  'CONFIGURATION',
  'INTEGRATION',
  'VALIDATION',
  'GO_LIVE',
  'STABILIZATION',
  'COMPLETE'
);
create type public.workflow_owner_kind as enum ('BEAUROI', 'CUSTOMER');

alter table public.onboarding_plans
  add column workflow_status public.onboarding_status,
  add column target_go_live_on date,
  add column actual_go_live_on date,
  add column readiness_confirmed_at timestamptz,
  add column customer_update text;

alter table public.onboarding_tasks
  add column workflow_status public.workflow_item_status,
  add column owner_kind public.workflow_owner_kind;

alter table public.training_sessions
  add column workflow_status public.training_status,
  add column description text,
  add column delivery_method public.training_delivery_method not null default 'REMOTE',
  add column meeting_location text,
  add column completed_at timestamptz;

alter table public.requested_documents
  add column workflow_status public.document_request_status;

alter table public.implementation_projects
  add column workflow_status public.implementation_status,
  add column target_completion_on date,
  add column actual_completion_on date,
  add column phase public.implementation_phase not null default 'DISCOVERY',
  add column customer_update text;

alter table public.milestones
  add column workflow_status public.workflow_item_status;

-- Preflight populated databases before imposing stricter Milestone 3 invariants. The
-- transaction aborts with a reviewable error instead of guessing at ambiguous ownership
-- or discarding legacy timestamps/content.
do $$
declare
  invalid_count bigint;
  invalid_summary text;
begin
  select count(*), string_agg(plan.id::text || ':' || plan.owner_user_id::text, ', ' order by plan.id)
    into invalid_count, invalid_summary
  from public.onboarding_plans plan
  where plan.owner_user_id is not null
    and (
      not exists (
        select 1
        from public.organization_memberships membership
        join public.organizations organization on organization.id = membership.organization_id
        where membership.user_id = plan.owner_user_id
          and membership.status = 'ACTIVE'
          and membership.role in ('BEAUROI_ADMIN', 'BEAUROI_EMPLOYEE')
          and organization.organization_type = 'BEAUROI'
          and organization.is_active
      )
      or exists (
        select 1
        from public.organization_memberships membership
        join public.organizations organization on organization.id = membership.organization_id
        where membership.user_id = plan.owner_user_id
          and membership.status = 'ACTIVE'
          and membership.role in ('CUSTOMER_ADMIN', 'CUSTOMER_MEMBER')
          and organization.organization_type = 'CUSTOMER'
      )
    );
  if invalid_count > 0 then
    raise exception using
      errcode = '23514',
      message = format('Milestone 3 preflight: %s onboarding_plans.owner_user_id value(s) are invalid, inactive, or ambiguous', invalid_count),
      detail = invalid_summary,
      hint = 'Every non-null onboarding plan owner must be an active Beau Roi user and must not also be an active customer user.';
  end if;

  select count(*), string_agg(task.id::text || ':' || task.assigned_user_id::text, ', ' order by task.id)
    into invalid_count, invalid_summary
  from public.onboarding_tasks task
  where task.assigned_user_id is not null
    and (
      exists (
        select 1
        from public.organization_memberships membership
        join public.organizations organization on organization.id = membership.organization_id
        where membership.user_id = task.assigned_user_id
          and membership.status = 'ACTIVE'
          and membership.role in ('BEAUROI_ADMIN', 'BEAUROI_EMPLOYEE')
          and organization.organization_type = 'BEAUROI'
          and organization.is_active
      ) = exists (
        select 1
        from public.organization_memberships membership
        where membership.user_id = task.assigned_user_id
          and membership.organization_id = task.organization_id
          and membership.status = 'ACTIVE'
          and membership.role in ('CUSTOMER_ADMIN', 'CUSTOMER_MEMBER')
      )
    );
  if invalid_count > 0 then
    raise exception using
      errcode = '23514',
      message = format('Milestone 3 preflight: %s onboarding_tasks.assigned_user_id value(s) cannot receive an unambiguous owner_kind', invalid_count),
      detail = invalid_summary,
      hint = 'Each assigned task user must be exactly one of: an active Beau Roi user, or an active member of the task organization.';
  end if;

  select count(*), string_agg(session.id::text || ':' || session.facilitator_user_id::text, ', ' order by session.id)
    into invalid_count, invalid_summary
  from public.training_sessions session
  where session.facilitator_user_id is not null
    and (
      not exists (
        select 1
        from public.organization_memberships membership
        join public.organizations organization on organization.id = membership.organization_id
        where membership.user_id = session.facilitator_user_id
          and membership.status = 'ACTIVE'
          and membership.role in ('BEAUROI_ADMIN', 'BEAUROI_EMPLOYEE')
          and organization.organization_type = 'BEAUROI'
          and organization.is_active
      )
      or exists (
        select 1
        from public.organization_memberships membership
        join public.organizations organization on organization.id = membership.organization_id
        where membership.user_id = session.facilitator_user_id
          and membership.status = 'ACTIVE'
          and membership.role in ('CUSTOMER_ADMIN', 'CUSTOMER_MEMBER')
          and organization.organization_type = 'CUSTOMER'
      )
    );
  if invalid_count > 0 then
    raise exception using
      errcode = '23514',
      message = format('Milestone 3 preflight: %s training_sessions.facilitator_user_id value(s) are invalid, inactive, or ambiguous', invalid_count),
      detail = invalid_summary,
      hint = 'Every non-null facilitator must be an active Beau Roi user and must not also be an active customer user.';
  end if;

  select count(*), string_agg(document.id::text || ':' || document.requested_from_user_id::text, ', ' order by document.id)
    into invalid_count, invalid_summary
  from public.requested_documents document
  where document.requested_from_user_id is not null
    and (
      not exists (
        select 1
        from public.organization_memberships membership
        where membership.user_id = document.requested_from_user_id
          and membership.organization_id = document.organization_id
          and membership.status = 'ACTIVE'
          and membership.role in ('CUSTOMER_ADMIN', 'CUSTOMER_MEMBER')
      )
      or exists (
        select 1
        from public.organization_memberships membership
        join public.organizations organization on organization.id = membership.organization_id
        where membership.user_id = document.requested_from_user_id
          and membership.status = 'ACTIVE'
          and membership.role in ('BEAUROI_ADMIN', 'BEAUROI_EMPLOYEE')
          and organization.organization_type = 'BEAUROI'
          and organization.is_active
      )
    );
  if invalid_count > 0 then
    raise exception using
      errcode = '23514',
      message = format('Milestone 3 preflight: %s requested_documents.requested_from_user_id value(s) are invalid, inactive, cross-organization, or ambiguous', invalid_count),
      detail = invalid_summary,
      hint = 'Every non-null requested-from user must be an active customer member of the document organization and must not also be an active Beau Roi user.';
  end if;

  select count(*), string_agg(project.id::text || ':' || project.owner_user_id::text, ', ' order by project.id)
    into invalid_count, invalid_summary
  from public.implementation_projects project
  where project.owner_user_id is not null
    and (
      not exists (
        select 1
        from public.organization_memberships membership
        join public.organizations organization on organization.id = membership.organization_id
        where membership.user_id = project.owner_user_id
          and membership.status = 'ACTIVE'
          and membership.role in ('BEAUROI_ADMIN', 'BEAUROI_EMPLOYEE')
          and organization.organization_type = 'BEAUROI'
          and organization.is_active
      )
      or exists (
        select 1
        from public.organization_memberships membership
        join public.organizations organization on organization.id = membership.organization_id
        where membership.user_id = project.owner_user_id
          and membership.status = 'ACTIVE'
          and membership.role in ('CUSTOMER_ADMIN', 'CUSTOMER_MEMBER')
          and organization.organization_type = 'CUSTOMER'
      )
    );
  if invalid_count > 0 then
    raise exception using
      errcode = '23514',
      message = format('Milestone 3 preflight: %s implementation_projects.owner_user_id value(s) are invalid, inactive, or ambiguous', invalid_count),
      detail = invalid_summary,
      hint = 'Every non-null implementation project owner must be an active Beau Roi user and must not also be an active customer user.';
  end if;

  select count(*) into invalid_count from (
    select 1 from public.onboarding_plans where char_length(btrim(name)) not between 2 and 160
    union all select 1 from public.onboarding_tasks where char_length(btrim(title)) not between 2 and 200 or char_length(description) > 5000
    union all select 1 from public.training_sessions where char_length(btrim(title)) not between 2 and 200 or char_length(meeting_url) > 2048
    union all select 1 from public.requested_documents where char_length(btrim(name)) not between 2 and 200 or char_length(description) > 5000
    union all select 1 from public.implementation_projects where char_length(btrim(name)) not between 2 and 160
    union all select 1 from public.milestones where char_length(btrim(title)) not between 2 and 200 or char_length(description) > 5000
    union all select 1 from public.project_notes where char_length(btrim(body)) not between 1 and 20000
  ) invalid_content;
  if invalid_count > 0 then
    raise exception 'Milestone 3 preflight: % legacy workflow row(s) violate bounded content requirements', invalid_count
      using errcode = '23514';
  end if;

  select count(*) into invalid_count from (
    select 1 from public.onboarding_plans
      where starts_on is not null and target_completion_on is not null and target_completion_on < starts_on
    union all select 1 from public.implementation_projects
      where starts_on is not null and target_go_live_on is not null and target_go_live_on < starts_on
    union all select 1 from public.implementation_projects
      where starts_on is not null and actual_go_live_on is not null and actual_go_live_on < starts_on
    union all select 1 from public.onboarding_tasks where status <> 'COMPLETED' and completed_at is not null
    union all select 1 from public.milestones where status <> 'COMPLETED' and completed_at is not null
  ) invalid_relationship;
  if invalid_count > 0 then
    raise exception 'Milestone 3 preflight: % legacy workflow row(s) have incompatible dates or completion history', invalid_count
      using errcode = '23514';
  end if;
end;
$$;

-- Deterministic expand-and-contract backfills. Legacy columns remain available and are
-- synchronized below so the previously deployed application can coexist during rollout.
update public.onboarding_plans set
  workflow_status = case status::text
    when 'DRAFT' then 'DRAFT' when 'ACTIVE' then 'IN_PROGRESS' when 'PAUSED' then 'BLOCKED'
    when 'COMPLETED' then 'LIVE' when 'ARCHIVED' then 'CANCELLED'
  end::public.onboarding_status,
  target_go_live_on = target_completion_on;
update public.onboarding_plans set
  actual_go_live_on = coalesce(target_go_live_on, starts_on, created_at::date),
  readiness_confirmed_at = coalesce(readiness_confirmed_at, updated_at)
where workflow_status = 'LIVE';

update public.onboarding_tasks set
  workflow_status = case status::text
    when 'DRAFT' then 'NOT_STARTED' when 'ACTIVE' then 'IN_PROGRESS' when 'PAUSED' then 'BLOCKED'
    when 'COMPLETED' then 'COMPLETED' when 'ARCHIVED' then 'CANCELLED'
  end::public.workflow_item_status,
  owner_kind = case when assigned_user_id is null then null
    when exists (
      select 1 from public.organization_memberships membership
      join public.organizations organization on organization.id = membership.organization_id
      where membership.user_id = onboarding_tasks.assigned_user_id
        and membership.status = 'ACTIVE'
        and membership.role in ('BEAUROI_ADMIN', 'BEAUROI_EMPLOYEE')
        and organization.organization_type = 'BEAUROI' and organization.is_active
    ) then 'BEAUROI'::public.workflow_owner_kind
    else 'CUSTOMER'::public.workflow_owner_kind end;
update public.onboarding_tasks set completed_at = coalesce(completed_at, updated_at)
where workflow_status = 'COMPLETED';

update public.training_sessions set
  workflow_status = case status::text
    when 'DRAFT' then 'SCHEDULED' when 'ACTIVE' then 'SCHEDULED' when 'PAUSED' then 'CANCELLED'
    when 'COMPLETED' then 'COMPLETED' when 'ARCHIVED' then 'CANCELLED'
  end::public.training_status;
update public.training_sessions set completed_at = coalesce(completed_at, updated_at)
where workflow_status = 'COMPLETED';

update public.requested_documents set workflow_status = case
  when status = 'DRAFT' then 'REQUESTED'
  when status = 'ACTIVE' and submitted_at is null then 'REQUESTED'
  when status = 'ACTIVE' and submitted_at is not null then 'RECEIVED'
  when status = 'PAUSED' and submitted_at is null then 'REQUESTED'
  when status = 'PAUSED' and submitted_at is not null then 'REJECTED'
  when status = 'COMPLETED' then 'ACCEPTED'
  when status = 'ARCHIVED' and submitted_at is null then 'WAIVED'
  when status = 'ARCHIVED' and submitted_at is not null then 'ACCEPTED'
end::public.document_request_status;
update public.requested_documents set submitted_at = coalesce(submitted_at, updated_at)
where workflow_status in ('RECEIVED', 'ACCEPTED', 'REJECTED');

update public.implementation_projects set
  workflow_status = case status::text
    when 'DRAFT' then 'DRAFT' when 'ACTIVE' then 'IN_PROGRESS' when 'PAUSED' then 'BLOCKED'
    when 'COMPLETED' then 'COMPLETED' when 'ARCHIVED' then 'CANCELLED'
  end::public.implementation_status,
  target_completion_on = target_go_live_on,
  actual_completion_on = actual_go_live_on;
update public.implementation_projects set
  actual_completion_on = coalesce(actual_completion_on, target_completion_on, starts_on, created_at::date),
  actual_go_live_on = coalesce(actual_go_live_on, target_completion_on, starts_on, created_at::date),
  phase = 'COMPLETE'
where workflow_status = 'COMPLETED';

update public.milestones set workflow_status = case status::text
  when 'DRAFT' then 'NOT_STARTED' when 'ACTIVE' then 'IN_PROGRESS' when 'PAUSED' then 'BLOCKED'
  when 'COMPLETED' then 'COMPLETED' when 'ARCHIVED' then 'CANCELLED'
end::public.workflow_item_status;
update public.milestones set completed_at = coalesce(completed_at, updated_at)
where workflow_status = 'COMPLETED';

alter table public.onboarding_plans alter column workflow_status set not null;
alter table public.onboarding_tasks alter column workflow_status set not null;
alter table public.training_sessions alter column workflow_status set not null;
alter table public.requested_documents alter column workflow_status set not null;
alter table public.implementation_projects alter column workflow_status set not null;
alter table public.milestones alter column workflow_status set not null;

alter table public.onboarding_plans
  add constraint onboarding_plans_name_length_check check (char_length(btrim(name)) between 2 and 160) not valid,
  add constraint onboarding_plans_customer_update_length_check check (customer_update is null or char_length(customer_update) <= 4000) not valid,
  add constraint onboarding_plans_dates_check check ((starts_on is null or target_go_live_on is null or target_go_live_on >= starts_on) and (starts_on is null or actual_go_live_on is null or actual_go_live_on >= starts_on)) not valid,
  add constraint onboarding_plans_live_date_check check ((workflow_status = 'LIVE' and actual_go_live_on is not null) or (workflow_status <> 'LIVE' and actual_go_live_on is null)) not valid,
  add constraint onboarding_plans_readiness_check check (readiness_confirmed_at is null or workflow_status in ('READY_FOR_GO_LIVE', 'LIVE')) not valid;
alter table public.onboarding_tasks
  add constraint onboarding_tasks_title_length_check check (char_length(btrim(title)) between 2 and 200) not valid,
  add constraint onboarding_tasks_description_length_check check (description is null or char_length(description) <= 5000) not valid,
  add constraint onboarding_tasks_completion_check check ((workflow_status = 'COMPLETED' and completed_at is not null) or (workflow_status <> 'COMPLETED' and completed_at is null)) not valid,
  add constraint onboarding_tasks_owner_check check ((assigned_user_id is null and owner_kind is null) or (assigned_user_id is not null and owner_kind is not null)) not valid;
alter table public.training_sessions
  add constraint training_sessions_title_length_check check (char_length(btrim(title)) between 2 and 200) not valid,
  add constraint training_sessions_description_length_check check (description is null or char_length(description) <= 5000) not valid,
  add constraint training_sessions_location_length_check check (meeting_location is null or char_length(meeting_location) <= 500) not valid,
  add constraint training_sessions_url_length_check check (meeting_url is null or char_length(meeting_url) <= 2048) not valid,
  add constraint training_sessions_completion_check check ((workflow_status = 'COMPLETED' and completed_at is not null) or (workflow_status <> 'COMPLETED' and completed_at is null)) not valid;
alter table public.requested_documents
  add constraint requested_documents_name_length_check check (char_length(btrim(name)) between 2 and 200) not valid,
  add constraint requested_documents_description_length_check check (description is null or char_length(description) <= 5000) not valid,
  add constraint requested_documents_submission_check check ((workflow_status in ('RECEIVED', 'ACCEPTED', 'REJECTED') and submitted_at is not null) or (workflow_status in ('REQUESTED', 'WAIVED') and submitted_at is null)) not valid;
alter table public.implementation_projects
  add constraint implementation_projects_name_length_check check (char_length(btrim(name)) between 2 and 160) not valid,
  add constraint implementation_projects_customer_update_length_check check (customer_update is null or char_length(customer_update) <= 4000) not valid,
  add constraint implementation_projects_dates_check check ((starts_on is null or target_completion_on is null or target_completion_on >= starts_on) and (starts_on is null or actual_completion_on is null or actual_completion_on >= starts_on)) not valid,
  add constraint implementation_projects_completion_check check ((workflow_status = 'COMPLETED' and actual_completion_on is not null and phase = 'COMPLETE') or (workflow_status <> 'COMPLETED' and actual_completion_on is null)) not valid;
alter table public.milestones
  add constraint milestones_title_length_check check (char_length(btrim(title)) between 2 and 200) not valid,
  add constraint milestones_description_length_check check (description is null or char_length(description) <= 5000) not valid,
  add constraint milestones_completion_check check ((workflow_status = 'COMPLETED' and completed_at is not null) or (workflow_status <> 'COMPLETED' and completed_at is null)) not valid;
alter table public.project_notes add constraint project_notes_body_length_check check (char_length(btrim(body)) between 1 and 20000) not valid;

alter table public.onboarding_plans validate constraint onboarding_plans_dates_check;
alter table public.onboarding_plans validate constraint onboarding_plans_live_date_check;
alter table public.onboarding_plans validate constraint onboarding_plans_readiness_check;
alter table public.onboarding_tasks validate constraint onboarding_tasks_completion_check;
alter table public.onboarding_tasks validate constraint onboarding_tasks_owner_check;
alter table public.training_sessions validate constraint training_sessions_completion_check;
alter table public.requested_documents validate constraint requested_documents_submission_check;
alter table public.implementation_projects validate constraint implementation_projects_dates_check;
alter table public.implementation_projects validate constraint implementation_projects_completion_check;
alter table public.milestones validate constraint milestones_completion_check;
alter table public.onboarding_plans validate constraint onboarding_plans_name_length_check;
alter table public.onboarding_plans validate constraint onboarding_plans_customer_update_length_check;
alter table public.onboarding_tasks validate constraint onboarding_tasks_title_length_check;
alter table public.onboarding_tasks validate constraint onboarding_tasks_description_length_check;
alter table public.training_sessions validate constraint training_sessions_title_length_check;
alter table public.training_sessions validate constraint training_sessions_description_length_check;
alter table public.training_sessions validate constraint training_sessions_location_length_check;
alter table public.training_sessions validate constraint training_sessions_url_length_check;
alter table public.requested_documents validate constraint requested_documents_name_length_check;
alter table public.requested_documents validate constraint requested_documents_description_length_check;
alter table public.implementation_projects validate constraint implementation_projects_name_length_check;
alter table public.implementation_projects validate constraint implementation_projects_customer_update_length_check;
alter table public.milestones validate constraint milestones_title_length_check;
alter table public.milestones validate constraint milestones_description_length_check;
alter table public.project_notes validate constraint project_notes_body_length_check;

create table private.implementation_project_requirements (
  implementation_project_id uuid primary key references public.implementation_projects(id) on delete cascade,
  requirement_summary text not null check (char_length(btrim(requirement_summary)) between 1 and 20000),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index implementation_project_requirements_created_by_idx
  on private.implementation_project_requirements (created_by) where created_by is not null;
create index implementation_project_requirements_updated_by_idx
  on private.implementation_project_requirements (updated_by) where updated_by is not null;
revoke all on table private.implementation_project_requirements from public, anon, authenticated;

create index customer_assignments_workflow_authorization_idx
  on public.customer_assignments (employee_user_id, organization_id, assignment_type, product_id)
  where is_active and ended_at is null;

create index onboarding_plans_portfolio_idx
  on public.onboarding_plans (workflow_status, target_go_live_on, organization_id, id);
create index onboarding_plans_owner_user_id_idx
  on public.onboarding_plans (owner_user_id) where owner_user_id is not null;
create index onboarding_tasks_plan_status_order_idx
  on public.onboarding_tasks (onboarding_plan_id, workflow_status, sort_order, id);
create index onboarding_tasks_assigned_user_id_idx
  on public.onboarding_tasks (assigned_user_id) where assigned_user_id is not null;
create index onboarding_tasks_overdue_idx
  on public.onboarding_tasks (due_at, onboarding_plan_id)
  where due_at is not null and workflow_status not in ('COMPLETED', 'CANCELLED');
create index training_sessions_plan_schedule_idx
  on public.training_sessions (onboarding_plan_id, scheduled_at, id);
create index training_sessions_facilitator_user_id_idx
  on public.training_sessions (facilitator_user_id) where facilitator_user_id is not null;
create index requested_documents_plan_status_due_idx
  on public.requested_documents (onboarding_plan_id, workflow_status, due_at, id);
create index requested_documents_requested_from_user_id_idx
  on public.requested_documents (requested_from_user_id) where requested_from_user_id is not null;
create index implementation_projects_portfolio_idx
  on public.implementation_projects (workflow_status, phase, target_completion_on, organization_id, id);
create index implementation_projects_product_id_idx
  on public.implementation_projects (product_id);
create index implementation_projects_owner_user_id_idx
  on public.implementation_projects (owner_user_id) where owner_user_id is not null;
create index milestones_project_status_order_idx
  on public.milestones (implementation_project_id, workflow_status, sort_order, id);
create index milestones_overdue_idx
  on public.milestones (due_on, implementation_project_id)
  where due_on is not null and workflow_status not in ('COMPLETED', 'CANCELLED');
create index project_notes_project_visibility_created_idx
  on public.project_notes (implementation_project_id, visibility, created_at desc, id);
create index project_notes_author_user_id_idx
  on public.project_notes (author_user_id) where author_user_id is not null;

-- All writes remain caller-scoped. These private trigger helpers add relationship,
-- lifecycle and history invariants that RLS alone cannot express.
create or replace function private.sync_workflow_compatibility()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_table_name = 'onboarding_plans' then
    if tg_op = 'INSERT' or new.workflow_status is null then
      if new.workflow_status is null then
        new.workflow_status := case new.status::text
          when 'DRAFT' then 'DRAFT' when 'ACTIVE' then 'IN_PROGRESS' when 'PAUSED' then 'BLOCKED'
          when 'COMPLETED' then 'LIVE' when 'ARCHIVED' then 'CANCELLED'
        end::public.onboarding_status;
      else
        new.status := case new.workflow_status
          when 'DRAFT' then 'DRAFT' when 'NOT_STARTED' then 'DRAFT' when 'IN_PROGRESS' then 'ACTIVE'
          when 'BLOCKED' then 'PAUSED' when 'READY_FOR_GO_LIVE' then 'ACTIVE'
          when 'LIVE' then 'COMPLETED' when 'CANCELLED' then 'ARCHIVED'
        end::public.lifecycle_status;
      end if;
      new.target_go_live_on := coalesce(new.target_go_live_on, new.target_completion_on);
      new.target_completion_on := coalesce(new.target_completion_on, new.target_go_live_on);
    else
      if new.workflow_status is distinct from old.workflow_status then
        new.status := case new.workflow_status
          when 'DRAFT' then 'DRAFT' when 'NOT_STARTED' then 'DRAFT' when 'IN_PROGRESS' then 'ACTIVE'
          when 'BLOCKED' then 'PAUSED' when 'READY_FOR_GO_LIVE' then 'ACTIVE'
          when 'LIVE' then 'COMPLETED' when 'CANCELLED' then 'ARCHIVED'
        end::public.lifecycle_status;
      elsif new.status is distinct from old.status then
        new.workflow_status := case new.status::text
          when 'DRAFT' then 'DRAFT' when 'ACTIVE' then 'IN_PROGRESS' when 'PAUSED' then 'BLOCKED'
          when 'COMPLETED' then 'LIVE' when 'ARCHIVED' then 'CANCELLED'
        end::public.onboarding_status;
      end if;
      if new.target_go_live_on is distinct from old.target_go_live_on then
        new.target_completion_on := new.target_go_live_on;
      elsif new.target_completion_on is distinct from old.target_completion_on then
        new.target_go_live_on := new.target_completion_on;
      end if;
    end if;
  elsif tg_table_name in ('onboarding_tasks', 'milestones') then
    if tg_op = 'INSERT' or new.workflow_status is null then
      if new.workflow_status is null then
        new.workflow_status := case new.status::text
          when 'DRAFT' then 'NOT_STARTED' when 'ACTIVE' then 'IN_PROGRESS' when 'PAUSED' then 'BLOCKED'
          when 'COMPLETED' then 'COMPLETED' when 'ARCHIVED' then 'CANCELLED'
        end::public.workflow_item_status;
      else
        new.status := case new.workflow_status
          when 'NOT_STARTED' then 'DRAFT' when 'IN_PROGRESS' then 'ACTIVE' when 'BLOCKED' then 'PAUSED'
          when 'COMPLETED' then 'COMPLETED' when 'CANCELLED' then 'ARCHIVED'
        end::public.lifecycle_status;
      end if;
    elsif new.workflow_status is distinct from old.workflow_status then
      new.status := case new.workflow_status
        when 'NOT_STARTED' then 'DRAFT' when 'IN_PROGRESS' then 'ACTIVE' when 'BLOCKED' then 'PAUSED'
        when 'COMPLETED' then 'COMPLETED' when 'CANCELLED' then 'ARCHIVED'
      end::public.lifecycle_status;
    elsif new.status is distinct from old.status then
      new.workflow_status := case new.status::text
        when 'DRAFT' then 'NOT_STARTED' when 'ACTIVE' then 'IN_PROGRESS' when 'PAUSED' then 'BLOCKED'
        when 'COMPLETED' then 'COMPLETED' when 'ARCHIVED' then 'CANCELLED'
      end::public.workflow_item_status;
    end if;
  elsif tg_table_name = 'training_sessions' then
    if tg_op = 'INSERT' or new.workflow_status is null then
      if new.workflow_status is null then
        new.workflow_status := case new.status::text
          when 'DRAFT' then 'SCHEDULED' when 'ACTIVE' then 'SCHEDULED' when 'PAUSED' then 'CANCELLED'
          when 'COMPLETED' then 'COMPLETED' when 'ARCHIVED' then 'CANCELLED'
        end::public.training_status;
      else
        new.status := case new.workflow_status when 'SCHEDULED' then 'ACTIVE' when 'COMPLETED' then 'COMPLETED' when 'CANCELLED' then 'ARCHIVED' end::public.lifecycle_status;
      end if;
    elsif new.workflow_status is distinct from old.workflow_status then
      new.status := case new.workflow_status when 'SCHEDULED' then 'ACTIVE' when 'COMPLETED' then 'COMPLETED' when 'CANCELLED' then 'ARCHIVED' end::public.lifecycle_status;
    elsif new.status is distinct from old.status then
      new.workflow_status := case new.status::text when 'DRAFT' then 'SCHEDULED' when 'ACTIVE' then 'SCHEDULED' when 'PAUSED' then 'CANCELLED' when 'COMPLETED' then 'COMPLETED' when 'ARCHIVED' then 'CANCELLED' end::public.training_status;
    end if;
  elsif tg_table_name = 'requested_documents' then
    if tg_op = 'INSERT' or new.workflow_status is null then
      if new.workflow_status is null then
        new.workflow_status := case new.status::text
          when 'DRAFT' then 'REQUESTED' when 'ACTIVE' then 'REQUESTED' when 'PAUSED' then 'REQUESTED'
          when 'COMPLETED' then 'ACCEPTED' when 'ARCHIVED' then 'WAIVED'
        end::public.document_request_status;
      else
        new.status := case new.workflow_status when 'REQUESTED' then 'ACTIVE' when 'RECEIVED' then 'ACTIVE' when 'ACCEPTED' then 'COMPLETED' when 'REJECTED' then 'PAUSED' when 'WAIVED' then 'ARCHIVED' end::public.lifecycle_status;
      end if;
    elsif new.workflow_status is distinct from old.workflow_status then
      new.status := case new.workflow_status when 'REQUESTED' then 'ACTIVE' when 'RECEIVED' then 'ACTIVE' when 'ACCEPTED' then 'COMPLETED' when 'REJECTED' then 'PAUSED' when 'WAIVED' then 'ARCHIVED' end::public.lifecycle_status;
    elsif new.status is distinct from old.status then
      new.workflow_status := case new.status::text when 'DRAFT' then 'REQUESTED' when 'ACTIVE' then 'REQUESTED' when 'PAUSED' then 'REJECTED' when 'COMPLETED' then 'ACCEPTED' when 'ARCHIVED' then 'WAIVED' end::public.document_request_status;
    end if;
  elsif tg_table_name = 'implementation_projects' then
    if tg_op = 'INSERT' or new.workflow_status is null then
      if new.workflow_status is null then
        new.workflow_status := case new.status::text
          when 'DRAFT' then 'DRAFT' when 'ACTIVE' then 'IN_PROGRESS' when 'PAUSED' then 'BLOCKED'
          when 'COMPLETED' then 'COMPLETED' when 'ARCHIVED' then 'CANCELLED'
        end::public.implementation_status;
      else
        new.status := case new.workflow_status when 'DRAFT' then 'DRAFT' when 'NOT_STARTED' then 'DRAFT' when 'IN_PROGRESS' then 'ACTIVE' when 'BLOCKED' then 'PAUSED' when 'COMPLETED' then 'COMPLETED' when 'CANCELLED' then 'ARCHIVED' end::public.lifecycle_status;
      end if;
      new.target_completion_on := coalesce(new.target_completion_on, new.target_go_live_on);
      new.target_go_live_on := coalesce(new.target_go_live_on, new.target_completion_on);
      new.actual_completion_on := coalesce(new.actual_completion_on, new.actual_go_live_on);
      new.actual_go_live_on := coalesce(new.actual_go_live_on, new.actual_completion_on);
    else
      if new.workflow_status is distinct from old.workflow_status then
        new.status := case new.workflow_status when 'DRAFT' then 'DRAFT' when 'NOT_STARTED' then 'DRAFT' when 'IN_PROGRESS' then 'ACTIVE' when 'BLOCKED' then 'PAUSED' when 'COMPLETED' then 'COMPLETED' when 'CANCELLED' then 'ARCHIVED' end::public.lifecycle_status;
      elsif new.status is distinct from old.status then
        new.workflow_status := case new.status::text when 'DRAFT' then 'DRAFT' when 'ACTIVE' then 'IN_PROGRESS' when 'PAUSED' then 'BLOCKED' when 'COMPLETED' then 'COMPLETED' when 'ARCHIVED' then 'CANCELLED' end::public.implementation_status;
      end if;
      if new.target_completion_on is distinct from old.target_completion_on then new.target_go_live_on := new.target_completion_on;
      elsif new.target_go_live_on is distinct from old.target_go_live_on then new.target_completion_on := new.target_go_live_on; end if;
      if new.actual_completion_on is distinct from old.actual_completion_on then new.actual_go_live_on := new.actual_completion_on;
      elsif new.actual_go_live_on is distinct from old.actual_go_live_on then new.actual_completion_on := new.actual_go_live_on; end if;
    end if;
  end if;
  return new;
end;
$$;

create or replace function private.workflow_actor_has_assignment(
  target_organization_id uuid,
  target_product_id uuid,
  approved_assignment_types text[]
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
            and assignment.assignment_type = any (approved_assignment_types)
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

create or replace function private.assert_onboarding_workflow_actor(
  target_organization_id uuid,
  target_product_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.workflow_actor_has_assignment(
    target_organization_id,
    target_product_id,
    array['CSM', 'ACCOUNT_OWNER']::text[]
  ) then
    raise exception 'An active onboarding assignment is required' using errcode = '42501';
  end if;
end;
$$;

create or replace function private.assert_implementation_workflow_actor(
  target_organization_id uuid,
  target_product_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.workflow_actor_has_assignment(
    target_organization_id,
    target_product_id,
    array['IMPLEMENTATION_LEAD', 'IMPLEMENTATION_ENGINEER']::text[]
  ) then
    raise exception 'An active implementation assignment is required' using errcode = '42501';
  end if;
end;
$$;

create or replace function private.workflow_scope_is_active(
  target_organization_id uuid,
  target_product_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.organizations organization
    where organization.id = target_organization_id
      and organization.organization_type = 'CUSTOMER'
      and organization.is_active
  ) and exists (
    select 1 from public.products product
    join public.customer_subscriptions subscription
      on subscription.product_id = product.id
     and subscription.organization_id = target_organization_id
      and subscription.status = 'ACTIVE'
    where product.id = target_product_id and product.status = 'ACTIVE'
  );
$$;

create or replace function private.assert_workflow_scope(
  target_organization_id uuid,
  target_product_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.workflow_scope_is_active(target_organization_id, target_product_id) then
    raise exception 'An active customer product subscription is required' using errcode = '23514';
  end if;
end;
$$;

create or replace function private.assert_beauroi_workflow_owner(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if target_user_id is not null and not exists (
    select 1
    from public.organization_memberships membership
    join public.organizations organization on organization.id = membership.organization_id
    where membership.user_id = target_user_id
      and membership.status = 'ACTIVE'
      and membership.role in ('BEAUROI_ADMIN', 'BEAUROI_EMPLOYEE')
      and organization.organization_type = 'BEAUROI'
      and organization.is_active
  ) then
    raise exception 'An active Beau Roi assignee is required' using errcode = '23514';
  end if;
end;
$$;

create or replace function private.assert_customer_workflow_owner(
  target_user_id uuid,
  target_organization_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if target_user_id is not null and not exists (
    select 1 from public.organization_memberships membership
    where membership.user_id = target_user_id
      and membership.organization_id = target_organization_id
      and membership.status = 'ACTIVE'
      and membership.role in ('CUSTOMER_ADMIN', 'CUSTOMER_MEMBER')
  ) then
    raise exception 'An active customer organization member is required' using errcode = '23514';
  end if;
end;
$$;

create or replace function private.guard_onboarding_plan()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.assert_onboarding_workflow_actor(new.organization_id, new.product_id);
  if tg_op = 'UPDATE' and (new.id, new.organization_id, new.product_id, new.created_at)
      is distinct from (old.id, old.organization_id, old.product_id, old.created_at) then
    raise exception 'Onboarding plan identity and scope are immutable' using errcode = '23514';
  end if;
  if tg_op = 'INSERT' then
    perform private.assert_workflow_scope(new.organization_id, new.product_id);
    perform private.assert_beauroi_workflow_owner(new.owner_user_id);
  elsif not private.workflow_scope_is_active(new.organization_id, new.product_id) then
    if new.workflow_status <> 'CANCELLED' or old.workflow_status = 'CANCELLED'
      or (new.name, new.starts_on, new.target_go_live_on, new.actual_go_live_on,
          new.readiness_confirmed_at, new.customer_update, new.owner_user_id)
         is distinct from
         (old.name, old.starts_on, old.target_go_live_on, old.actual_go_live_on,
          old.readiness_confirmed_at, old.customer_update, old.owner_user_id) then
      raise exception 'Only cancellation is permitted after workflow scope deactivation' using errcode = '23514';
    end if;
  end if;
  if tg_op = 'INSERT' or new.owner_user_id is distinct from old.owner_user_id then
    perform private.assert_beauroi_workflow_owner(new.owner_user_id);
  end if;

  if tg_op = 'UPDATE' and new.workflow_status <> old.workflow_status and not (
    (old.workflow_status = 'DRAFT' and new.workflow_status in ('NOT_STARTED', 'IN_PROGRESS', 'CANCELLED')) or
    (old.workflow_status = 'NOT_STARTED' and new.workflow_status in ('IN_PROGRESS', 'BLOCKED', 'CANCELLED')) or
    (old.workflow_status = 'IN_PROGRESS' and new.workflow_status in ('BLOCKED', 'READY_FOR_GO_LIVE', 'CANCELLED')) or
    (old.workflow_status = 'BLOCKED' and new.workflow_status in ('IN_PROGRESS', 'CANCELLED')) or
    (old.workflow_status = 'READY_FOR_GO_LIVE' and new.workflow_status in ('IN_PROGRESS', 'LIVE', 'CANCELLED'))
  ) then
    raise exception 'Invalid onboarding status transition' using errcode = '23514';
  end if;
  return new;
end;
$$;

create or replace function private.guard_onboarding_task()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  parent_org uuid;
  parent_product uuid;
  parent_status public.onboarding_status;
begin
  if tg_op = 'UPDATE' and (new.id, new.organization_id, new.onboarding_plan_id, new.created_at)
      is distinct from (old.id, old.organization_id, old.onboarding_plan_id, old.created_at) then
    raise exception 'Onboarding task identity and parent are immutable' using errcode = '23514';
  end if;
  select plan.organization_id, plan.product_id, plan.workflow_status
    into parent_org, parent_product, parent_status
  from public.onboarding_plans plan where plan.id = new.onboarding_plan_id;
  if parent_org is null or parent_org <> new.organization_id then
    raise exception 'Onboarding task organization must match its plan' using errcode = '23514';
  end if;
  perform private.assert_onboarding_workflow_actor(parent_org, parent_product);
  if parent_status = 'CANCELLED' or not private.workflow_scope_is_active(parent_org, parent_product) then
    if tg_op = 'INSERT' then
      raise exception 'New onboarding tasks are not permitted for an inactive workflow' using errcode = '23514';
    end if;
    if new.workflow_status <> 'CANCELLED' or old.workflow_status = 'CANCELLED'
      or (new.title, new.description, new.assigned_user_id, new.owner_kind,
          new.due_at, new.sort_order, new.completed_at)
         is distinct from
         (old.title, old.description, old.assigned_user_id, old.owner_kind,
          old.due_at, old.sort_order, old.completed_at) then
      raise exception 'Only task cancellation without unrelated changes is permitted after parent or scope deactivation'
        using errcode = '23514';
    end if;
    return new;
  end if;
  if tg_op = 'INSERT' or (new.assigned_user_id, new.owner_kind) is distinct from (old.assigned_user_id, old.owner_kind) then
    if new.owner_kind = 'BEAUROI' then
      perform private.assert_beauroi_workflow_owner(new.assigned_user_id);
    elsif new.owner_kind = 'CUSTOMER' then
      perform private.assert_customer_workflow_owner(new.assigned_user_id, new.organization_id);
    end if;
  end if;
  if tg_op = 'UPDATE' and new.workflow_status <> old.workflow_status and not (
    (old.workflow_status = 'NOT_STARTED' and new.workflow_status in ('IN_PROGRESS', 'BLOCKED', 'COMPLETED', 'CANCELLED')) or
    (old.workflow_status = 'IN_PROGRESS' and new.workflow_status in ('NOT_STARTED', 'BLOCKED', 'COMPLETED', 'CANCELLED')) or
    (old.workflow_status = 'BLOCKED' and new.workflow_status in ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'))
  ) then
    raise exception 'Invalid task status transition' using errcode = '23514';
  end if;
  return new;
end;
$$;

create or replace function private.guard_training_session()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  parent_org uuid;
  parent_product uuid;
  parent_status public.onboarding_status;
  scope_is_active boolean;
begin
  if tg_op = 'UPDATE' and (new.id, new.organization_id, new.onboarding_plan_id, new.created_at)
      is distinct from (old.id, old.organization_id, old.onboarding_plan_id, old.created_at) then
    raise exception 'Training identity and parent are immutable' using errcode = '23514';
  end if;
  if new.onboarding_plan_id is not null then
    select plan.organization_id, plan.product_id, plan.workflow_status
      into parent_org, parent_product, parent_status
    from public.onboarding_plans plan where plan.id = new.onboarding_plan_id;
    if parent_org is null or parent_org <> new.organization_id then
      raise exception 'Training organization must match its plan' using errcode = '23514';
    end if;
    scope_is_active := private.workflow_scope_is_active(parent_org, parent_product);
  else
    parent_org := new.organization_id;
    scope_is_active := exists (
      select 1 from public.organizations organization
      where organization.id = new.organization_id
        and organization.organization_type = 'CUSTOMER'
        and organization.is_active
    );
  end if;
  perform private.assert_onboarding_workflow_actor(parent_org, parent_product);
  if coalesce(parent_status = 'CANCELLED', false) or not scope_is_active then
    if tg_op = 'INSERT' then
      raise exception 'New training sessions are not permitted for an inactive workflow' using errcode = '23514';
    end if;
    if new.workflow_status <> 'CANCELLED' or old.workflow_status = 'CANCELLED'
      or (new.title, new.description, new.scheduled_at, new.duration_minutes,
          new.delivery_method, new.meeting_location, new.meeting_url,
          new.facilitator_user_id, new.completed_at)
         is distinct from
         (old.title, old.description, old.scheduled_at, old.duration_minutes,
          old.delivery_method, old.meeting_location, old.meeting_url,
          old.facilitator_user_id, old.completed_at) then
      raise exception 'Only training cancellation without unrelated changes is permitted after parent or scope deactivation'
        using errcode = '23514';
    end if;
    return new;
  end if;
  if tg_op = 'INSERT' or new.facilitator_user_id is distinct from old.facilitator_user_id then
    perform private.assert_beauroi_workflow_owner(new.facilitator_user_id);
  end if;
  if tg_op = 'UPDATE' and new.workflow_status <> old.workflow_status and not (
    (old.workflow_status = 'SCHEDULED' and new.workflow_status in ('COMPLETED', 'CANCELLED'))
  ) then
    raise exception 'Invalid training status transition' using errcode = '23514';
  end if;
  return new;
end;
$$;

create or replace function private.guard_requested_document()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  parent_org uuid;
  parent_product uuid;
  parent_status public.onboarding_status;
  scope_is_active boolean;
begin
  if tg_op = 'UPDATE' and (new.id, new.organization_id, new.onboarding_plan_id, new.created_at)
      is distinct from (old.id, old.organization_id, old.onboarding_plan_id, old.created_at) then
    raise exception 'Document request identity and parent are immutable' using errcode = '23514';
  end if;
  if new.onboarding_plan_id is not null then
    select plan.organization_id, plan.product_id, plan.workflow_status
      into parent_org, parent_product, parent_status
    from public.onboarding_plans plan where plan.id = new.onboarding_plan_id;
    if parent_org is null or parent_org <> new.organization_id then
      raise exception 'Document request organization must match its plan' using errcode = '23514';
    end if;
    scope_is_active := private.workflow_scope_is_active(parent_org, parent_product);
  else
    parent_org := new.organization_id;
    scope_is_active := exists (
      select 1 from public.organizations organization
      where organization.id = new.organization_id
        and organization.organization_type = 'CUSTOMER'
        and organization.is_active
    );
  end if;
  perform private.assert_onboarding_workflow_actor(parent_org, parent_product);
  if coalesce(parent_status = 'CANCELLED', false) or not scope_is_active then
    if tg_op = 'INSERT' then
      raise exception 'New document requests are not permitted for an inactive workflow' using errcode = '23514';
    end if;
    if new.workflow_status <> 'WAIVED' or old.workflow_status <> 'REQUESTED'
      or (new.name, new.description, new.requested_from_user_id,
          new.due_at, new.submitted_at)
         is distinct from
         (old.name, old.description, old.requested_from_user_id,
          old.due_at, old.submitted_at) then
      raise exception 'Only waiving an open document request without unrelated changes is permitted after parent or scope deactivation'
        using errcode = '23514';
    end if;
    return new;
  end if;
  if tg_op = 'INSERT' or new.requested_from_user_id is distinct from old.requested_from_user_id then
    perform private.assert_customer_workflow_owner(new.requested_from_user_id, new.organization_id);
  end if;
  if tg_op = 'UPDATE' and new.workflow_status <> old.workflow_status and not (
    (old.workflow_status = 'REQUESTED' and new.workflow_status in ('RECEIVED', 'WAIVED')) or
    (old.workflow_status = 'RECEIVED' and new.workflow_status in ('ACCEPTED', 'REJECTED')) or
    (old.workflow_status = 'REJECTED' and new.workflow_status = 'RECEIVED')
  ) then
    raise exception 'Invalid document status transition' using errcode = '23514';
  end if;
  return new;
end;
$$;

create or replace function private.guard_implementation_project()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.assert_implementation_workflow_actor(new.organization_id, new.product_id);
  if tg_op = 'UPDATE' and (new.id, new.organization_id, new.product_id, new.created_at)
      is distinct from (old.id, old.organization_id, old.product_id, old.created_at) then
    raise exception 'Implementation project identity and scope are immutable' using errcode = '23514';
  end if;
  if tg_op = 'INSERT' then
    perform private.assert_workflow_scope(new.organization_id, new.product_id);
    perform private.assert_beauroi_workflow_owner(new.owner_user_id);
  elsif not private.workflow_scope_is_active(new.organization_id, new.product_id) then
    if new.workflow_status <> 'CANCELLED' or old.workflow_status = 'CANCELLED'
      or (new.name, new.starts_on, new.target_completion_on, new.actual_completion_on,
          new.phase, new.customer_update, new.owner_user_id)
         is distinct from
         (old.name, old.starts_on, old.target_completion_on, old.actual_completion_on,
          old.phase, old.customer_update, old.owner_user_id) then
      raise exception 'Only cancellation is permitted after workflow scope deactivation' using errcode = '23514';
    end if;
  end if;
  if tg_op = 'INSERT' or new.owner_user_id is distinct from old.owner_user_id then
    perform private.assert_beauroi_workflow_owner(new.owner_user_id);
  end if;
  if tg_op = 'UPDATE' and new.workflow_status <> old.workflow_status and not (
    (old.workflow_status = 'DRAFT' and new.workflow_status in ('NOT_STARTED', 'IN_PROGRESS', 'CANCELLED')) or
    (old.workflow_status = 'NOT_STARTED' and new.workflow_status in ('IN_PROGRESS', 'BLOCKED', 'CANCELLED')) or
    (old.workflow_status = 'IN_PROGRESS' and new.workflow_status in ('BLOCKED', 'COMPLETED', 'CANCELLED')) or
    (old.workflow_status = 'BLOCKED' and new.workflow_status in ('IN_PROGRESS', 'CANCELLED'))
  ) then
    raise exception 'Invalid implementation status transition' using errcode = '23514';
  end if;
  return new;
end;
$$;

create or replace function private.guard_milestone()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  parent_org uuid;
  parent_product uuid;
  parent_status public.implementation_status;
begin
  if tg_op = 'UPDATE' and (new.id, new.organization_id, new.implementation_project_id, new.created_at)
      is distinct from (old.id, old.organization_id, old.implementation_project_id, old.created_at) then
    raise exception 'Milestone identity and parent are immutable' using errcode = '23514';
  end if;
  select project.organization_id, project.product_id, project.workflow_status
    into parent_org, parent_product, parent_status
  from public.implementation_projects project where project.id = new.implementation_project_id;
  if parent_org is null or parent_org <> new.organization_id then
    raise exception 'Milestone organization must match its project' using errcode = '23514';
  end if;
  perform private.assert_implementation_workflow_actor(parent_org, parent_product);
  if parent_status = 'CANCELLED' or not private.workflow_scope_is_active(parent_org, parent_product) then
    if tg_op = 'INSERT' then
      raise exception 'New milestones are not permitted for an inactive workflow' using errcode = '23514';
    end if;
    if new.workflow_status <> 'CANCELLED' or old.workflow_status = 'CANCELLED'
      or (new.title, new.description, new.due_on, new.sort_order, new.completed_at)
         is distinct from
         (old.title, old.description, old.due_on, old.sort_order, old.completed_at) then
      raise exception 'Only milestone cancellation without unrelated changes is permitted after parent or scope deactivation'
        using errcode = '23514';
    end if;
    return new;
  end if;
  if tg_op = 'UPDATE' and new.workflow_status <> old.workflow_status and not (
    (old.workflow_status = 'NOT_STARTED' and new.workflow_status in ('IN_PROGRESS', 'BLOCKED', 'COMPLETED', 'CANCELLED')) or
    (old.workflow_status = 'IN_PROGRESS' and new.workflow_status in ('NOT_STARTED', 'BLOCKED', 'COMPLETED', 'CANCELLED')) or
    (old.workflow_status = 'BLOCKED' and new.workflow_status in ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'))
  ) then
    raise exception 'Invalid milestone status transition' using errcode = '23514';
  end if;
  return new;
end;
$$;

create or replace function private.guard_project_note()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  parent_org uuid;
  parent_product uuid;
  parent_status public.implementation_status;
begin
  select project.organization_id, project.product_id, project.workflow_status
    into parent_org, parent_product, parent_status
  from public.implementation_projects project where project.id = new.implementation_project_id;
  if parent_org is null or parent_org <> new.organization_id then
    raise exception 'Project note organization must match its project' using errcode = '23514';
  end if;
  perform private.assert_implementation_workflow_actor(parent_org, parent_product);
  if parent_status = 'CANCELLED' or not private.workflow_scope_is_active(parent_org, parent_product) then
    raise exception 'Project notes are not permitted after parent or scope deactivation' using errcode = '23514';
  end if;
  if new.author_user_id is null then new.author_user_id := (select auth.uid()); end if;
  if new.author_user_id <> (select auth.uid()) then
    raise exception 'Project note author must be the authenticated caller' using errcode = '42501';
  end if;
  return new;
end;
$$;

create or replace function private.audit_workflow_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  row_value record;
  safe_metadata jsonb;
begin
  row_value := new;
  safe_metadata := jsonb_build_object('operation', tg_op, 'status', to_jsonb(new) ->> 'workflow_status');
  if tg_table_name = 'project_notes' then
    safe_metadata := jsonb_build_object('operation', tg_op, 'visibility', new.visibility);
  end if;
  perform private.write_audit_event(
    row_value.organization_id,
    upper(tg_table_name || '_' || tg_op),
    tg_table_name,
    row_value.id,
    safe_metadata
  );
  return new;
end;
$$;

-- Requirement content is deliberately outside the exposed public schema. These are the
-- only caller-facing paths and both re-authorize the JWT inside PostgreSQL.
create or replace function public.get_implementation_requirement(target_project_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare result text;
begin
  if (select auth.uid()) is null or not (select private.is_beauroi_user()) then
    raise exception 'Implementation requirement access is not permitted' using errcode = '42501';
  end if;
  if not exists (select 1 from public.implementation_projects project where project.id = target_project_id) then
    raise exception 'Implementation project is unavailable' using errcode = 'P0002';
  end if;
  select requirement.requirement_summary into result
  from private.implementation_project_requirements requirement
  where requirement.implementation_project_id = target_project_id;
  return result;
end;
$$;

create or replace function public.set_implementation_requirement(
  target_project_id uuid,
  target_requirement_summary text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_organization_id uuid;
  target_product_id uuid;
  target_status public.implementation_status;
begin
  if (select auth.uid()) is null or not (select private.is_beauroi_user()) then
    raise exception 'Implementation requirement access is not permitted' using errcode = '42501';
  end if;
  if target_requirement_summary is not null
    and char_length(btrim(target_requirement_summary)) not between 1 and 20000 then
    raise exception 'Implementation requirement must contain between 1 and 20000 characters' using errcode = '23514';
  end if;
  select project.organization_id, project.product_id, project.workflow_status
    into target_organization_id, target_product_id, target_status
  from public.implementation_projects project where project.id = target_project_id;
  if target_organization_id is null then
    raise exception 'Implementation project is unavailable' using errcode = 'P0002';
  end if;
  perform private.assert_implementation_workflow_actor(target_organization_id, target_product_id);
  if target_status = 'CANCELLED'
    or not private.workflow_scope_is_active(target_organization_id, target_product_id) then
    raise exception 'Implementation requirements cannot be changed for an inactive workflow' using errcode = '23514';
  end if;

  if target_requirement_summary is null then
    delete from private.implementation_project_requirements
    where implementation_project_id = target_project_id;
  else
    insert into private.implementation_project_requirements (
      implementation_project_id, requirement_summary, created_by, updated_by
    ) values (
      target_project_id, btrim(target_requirement_summary), (select auth.uid()), (select auth.uid())
    ) on conflict (implementation_project_id) do update set
      requirement_summary = excluded.requirement_summary,
      updated_by = (select auth.uid()),
      updated_at = now();
  end if;
  perform private.write_audit_event(
    target_organization_id,
    'IMPLEMENTATION_REQUIREMENT_UPDATED',
    'implementation_projects',
    target_project_id,
    jsonb_build_object('operation', case when target_requirement_summary is null then 'CLEAR' else 'SET' end)
  );
end;
$$;

revoke all on function public.get_implementation_requirement(uuid) from public, anon, authenticated;
revoke all on function public.set_implementation_requirement(uuid, text) from public, anon, authenticated;
grant execute on function public.get_implementation_requirement(uuid) to authenticated;
grant execute on function public.set_implementation_requirement(uuid, text) to authenticated;

create trigger aa_onboarding_plans_compatibility before insert or update on public.onboarding_plans
  for each row execute function private.sync_workflow_compatibility();
create trigger aa_onboarding_tasks_compatibility before insert or update on public.onboarding_tasks
  for each row execute function private.sync_workflow_compatibility();
create trigger aa_training_sessions_compatibility before insert or update on public.training_sessions
  for each row execute function private.sync_workflow_compatibility();
create trigger aa_requested_documents_compatibility before insert or update on public.requested_documents
  for each row execute function private.sync_workflow_compatibility();
create trigger aa_implementation_projects_compatibility before insert or update on public.implementation_projects
  for each row execute function private.sync_workflow_compatibility();
create trigger aa_milestones_compatibility before insert or update on public.milestones
  for each row execute function private.sync_workflow_compatibility();

create trigger onboarding_plans_guard before insert or update on public.onboarding_plans
  for each row execute function private.guard_onboarding_plan();
create trigger onboarding_tasks_guard before insert or update on public.onboarding_tasks
  for each row execute function private.guard_onboarding_task();
create trigger training_sessions_guard before insert or update on public.training_sessions
  for each row execute function private.guard_training_session();
create trigger requested_documents_guard before insert or update on public.requested_documents
  for each row execute function private.guard_requested_document();
create trigger implementation_projects_guard before insert or update on public.implementation_projects
  for each row execute function private.guard_implementation_project();
create trigger milestones_guard before insert or update on public.milestones
  for each row execute function private.guard_milestone();
create trigger project_notes_guard before insert on public.project_notes
  for each row execute function private.guard_project_note();

create trigger onboarding_plans_audit after insert or update on public.onboarding_plans
  for each row execute function private.audit_workflow_change();
create trigger onboarding_tasks_audit after insert or update on public.onboarding_tasks
  for each row execute function private.audit_workflow_change();
create trigger training_sessions_audit after insert or update on public.training_sessions
  for each row execute function private.audit_workflow_change();
create trigger requested_documents_audit after insert or update on public.requested_documents
  for each row execute function private.audit_workflow_change();
create trigger implementation_projects_audit after insert or update on public.implementation_projects
  for each row execute function private.audit_workflow_change();
create trigger milestones_audit after insert or update on public.milestones
  for each row execute function private.audit_workflow_change();
create trigger project_notes_audit after insert on public.project_notes
  for each row execute function private.audit_workflow_change();

-- Progress and exception counts are derived from RLS-filtered child records.
create view public.onboarding_portfolio
with (security_invoker = true)
as
select
  plan.id,
  plan.organization_id,
  plan.product_id,
  plan.name,
  plan.workflow_status as status,
  plan.starts_on,
  plan.target_go_live_on,
  plan.actual_go_live_on,
  plan.readiness_confirmed_at,
  plan.customer_update,
  plan.owner_user_id,
  plan.created_at,
  plan.updated_at,
  organization.name as organization_name,
  product.name as product_name,
  (select profile.full_name from public.profiles profile where profile.id = plan.owner_user_id) as owner_name,
  coalesce(task_totals.progress_percent, 0)::integer as progress_percent,
  coalesce(task_totals.blocked_count, 0)::integer as blocked_count,
  coalesce(task_totals.overdue_count, 0)::integer as overdue_count,
  coalesce(task_totals.item_count, 0)::integer as task_count
from public.onboarding_plans plan
join public.organizations organization on organization.id = plan.organization_id
join public.products product on product.id = plan.product_id
left join lateral (
  select
    count(*) filter (where task.workflow_status <> 'CANCELLED') as item_count,
    case when count(*) filter (where task.workflow_status <> 'CANCELLED') = 0 then 0
      else round(100.0 * count(*) filter (where task.workflow_status = 'COMPLETED') /
        count(*) filter (where task.workflow_status <> 'CANCELLED')) end as progress_percent,
    count(*) filter (where task.workflow_status = 'BLOCKED') as blocked_count,
    count(*) filter (where task.workflow_status not in ('COMPLETED', 'CANCELLED') and task.due_at < now()) as overdue_count
  from public.onboarding_tasks task where task.onboarding_plan_id = plan.id
) task_totals on true;

create view public.implementation_portfolio
with (security_invoker = true)
as
select
  project.id,
  project.organization_id,
  project.product_id,
  project.name,
  project.workflow_status as status,
  project.owner_user_id,
  project.starts_on,
  project.target_completion_on,
  project.actual_completion_on,
  project.phase,
  project.customer_update,
  project.created_at,
  project.updated_at,
  organization.name as organization_name,
  product.name as product_name,
  (select profile.full_name from public.profiles profile where profile.id = project.owner_user_id) as owner_name,
  coalesce(milestone_totals.progress_percent, 0)::integer as progress_percent,
  coalesce(milestone_totals.blocked_count, 0)::integer as blocked_count,
  coalesce(milestone_totals.overdue_count, 0)::integer as overdue_count,
  coalesce(milestone_totals.item_count, 0)::integer as milestone_count
from public.implementation_projects project
join public.organizations organization on organization.id = project.organization_id
join public.products product on product.id = project.product_id
left join lateral (
  select
    count(*) filter (where milestone.workflow_status <> 'CANCELLED') as item_count,
    case when count(*) filter (where milestone.workflow_status <> 'CANCELLED') = 0 then 0
      else round(100.0 * count(*) filter (where milestone.workflow_status = 'COMPLETED') /
        count(*) filter (where milestone.workflow_status <> 'CANCELLED')) end as progress_percent,
    count(*) filter (where milestone.workflow_status = 'BLOCKED') as blocked_count,
    count(*) filter (where milestone.workflow_status not in ('COMPLETED', 'CANCELLED') and milestone.due_on < current_date) as overdue_count
  from public.milestones milestone where milestone.implementation_project_id = project.id
) milestone_totals on true;

-- Customers receive only shared notes; all workflow writes are Beau Roi-only.
drop policy if exists tenant_read on public.project_notes;
create policy project_notes_read on public.project_notes for select to authenticated
  using (
    (select private.is_beauroi_user())
    or (visibility = 'SHARED' and (select private.is_organization_member(organization_id)))
  );

drop policy if exists beauroi_update on public.project_notes;
drop policy if exists beauroi_delete on public.project_notes;

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'onboarding_plans', 'onboarding_tasks', 'training_sessions', 'requested_documents',
    'implementation_projects', 'milestones', 'project_notes'
  ] loop
    execute format('drop policy if exists beauroi_delete on public.%I', table_name);
    execute format('revoke delete on public.%I from authenticated', table_name);
  end loop;
end;
$$;

revoke update on public.project_notes from authenticated;
grant select, insert, update on public.onboarding_plans to authenticated;
grant select, insert, update on public.onboarding_tasks to authenticated;
grant select, insert, update on public.training_sessions to authenticated;
grant select, insert, update on public.requested_documents to authenticated;
grant select, insert, update on public.implementation_projects to authenticated;
grant select, insert, update on public.milestones to authenticated;
grant select, insert on public.project_notes to authenticated;
grant select on public.onboarding_portfolio, public.implementation_portfolio to authenticated;

-- Customer-visible directory use requires only a name and designation. Column grants
-- prevent every authenticated Data API caller from selecting phone, locale, object keys,
-- timestamps, or future profile fields even when a row-level policy permits the row.
revoke select on public.profiles from authenticated;
grant select (id, full_name, designation) on public.profiles to authenticated;

-- Assigned Beau Roi staff profile names are customer-visible for their own active workflows.
drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles for select to authenticated using (
  id = (select auth.uid())
  or (select private.is_beauroi_user())
  or exists (
    select 1 from public.organization_memberships own_membership
    join public.organization_memberships target_membership
      on target_membership.organization_id = own_membership.organization_id
    where own_membership.user_id = (select auth.uid())
      and own_membership.status = 'ACTIVE'
      and target_membership.user_id = profiles.id
      and target_membership.status = 'ACTIVE'
  )
  or exists (
    select 1 from public.customer_assignments assignment
    where assignment.employee_user_id = profiles.id and assignment.is_active
      and (select private.is_organization_member(assignment.organization_id))
  )
);

comment on view public.onboarding_portfolio is
  'RLS-aware onboarding portfolio with calculated progress and exception counts.';
comment on view public.implementation_portfolio is
  'RLS-aware implementation portfolio with calculated progress and exception counts.';
comment on column public.project_notes.body is
  'Never include INTERNAL note bodies in customer-facing API responses or audit metadata.';
comment on table private.implementation_project_requirements is
  'Beau Roi-only implementation requirements. A later contract migration may remove synchronized legacy workflow columns after the rolling deployment window.';

revoke all on function private.sync_workflow_compatibility() from public, anon, authenticated;
revoke all on function private.workflow_scope_is_active(uuid, uuid) from public, anon, authenticated;
revoke all on function private.workflow_actor_has_assignment(uuid, uuid, text[]) from public, anon, authenticated;
revoke all on function private.assert_onboarding_workflow_actor(uuid, uuid) from public, anon, authenticated;
revoke all on function private.assert_implementation_workflow_actor(uuid, uuid) from public, anon, authenticated;
revoke all on function private.assert_workflow_scope(uuid, uuid) from public, anon, authenticated;
revoke all on function private.assert_beauroi_workflow_owner(uuid) from public, anon, authenticated;
revoke all on function private.assert_customer_workflow_owner(uuid, uuid) from public, anon, authenticated;
revoke all on function private.guard_onboarding_plan() from public, anon, authenticated;
revoke all on function private.guard_onboarding_task() from public, anon, authenticated;
revoke all on function private.guard_training_session() from public, anon, authenticated;
revoke all on function private.guard_requested_document() from public, anon, authenticated;
revoke all on function private.guard_implementation_project() from public, anon, authenticated;
revoke all on function private.guard_milestone() from public, anon, authenticated;
revoke all on function private.guard_project_note() from public, anon, authenticated;
revoke all on function private.audit_workflow_change() from public, anon, authenticated;
