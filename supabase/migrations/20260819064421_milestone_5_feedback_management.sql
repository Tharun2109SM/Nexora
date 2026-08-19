-- Milestone 5: secure feedback, bug-report and feature-request workflows.
-- The legacy tables remain the source of record; this migration adds guarded
-- workflow operations, private/customer-visible conversations, history and voting.

do $$
declare invalid_ids text;
begin
  select string_agg(f.id::text, ', ' order by f.id) into invalid_ids
  from public.feedback f
  left join public.organizations o on o.id = f.organization_id
  left join public.organization_memberships m
    on m.organization_id = f.organization_id and m.user_id = f.submitted_by
  where o.id is null or o.organization_type <> 'CUSTOMER'
     or m.id is null or m.status <> 'ACTIVE'
     or m.role not in ('CUSTOMER_ADMIN', 'CUSTOMER_MEMBER');
  if invalid_ids is not null then
    raise exception 'Milestone 5 preflight: feedback has invalid or historical requesters'
      using detail = invalid_ids;
  end if;

  select string_agg(f.id::text, ', ' order by f.id) into invalid_ids
  from public.feedback f
  where (f.category = 'BUG') <> exists (
      select 1 from public.bug_reports b where b.feedback_id = f.id
    )
     or (f.category = 'FEATURE_REQUEST') <> exists (
      select 1 from public.feature_requests r where r.feedback_id = f.id
    );
  if invalid_ids is not null then
    raise exception 'Milestone 5 preflight: feedback subtype records are inconsistent'
      using detail = invalid_ids;
  end if;

  select string_agg(f.id::text, ', ' order by f.id) into invalid_ids
  from public.feedback f
  where f.product_id is null or not exists (
    select 1 from public.customer_subscriptions s
    where s.organization_id = f.organization_id and s.product_id = f.product_id
      and s.status = 'ACTIVE'
  );
  if invalid_ids is not null then
    raise exception 'Milestone 5 preflight: feedback product scope requires review'
      using detail = invalid_ids;
  end if;

  select string_agg(f.id::text, ', ' order by f.id) into invalid_ids
  from public.feedback f
  left join public.bug_reports b on b.feedback_id = f.id
  left join public.feature_requests r on r.feedback_id = f.id
  where (b.id is not null and b.organization_id <> f.organization_id)
     or (r.id is not null and r.organization_id <> f.organization_id);
  if invalid_ids is not null then
    raise exception 'Milestone 5 preflight: feedback subtype organization mismatch requires review'
      using detail = invalid_ids;
  end if;

  select string_agg(v.id::text, ', ' order by v.id) into invalid_ids
  from public.feature_votes v
  join public.feature_requests r on r.id = v.feature_request_id
  join public.feedback f on f.id = r.feedback_id
  left join public.organization_memberships m
    on m.organization_id = v.organization_id and m.user_id = v.user_id
  where v.organization_id <> f.organization_id
     or m.id is null or m.status <> 'ACTIVE'
     or m.role not in ('CUSTOMER_ADMIN', 'CUSTOMER_MEMBER');
  if invalid_ids is not null then
    raise exception 'Milestone 5 preflight: feature votes have invalid ownership'
      using detail = invalid_ids;
  end if;
end;
$$;

alter table public.feedback
  add column is_public boolean not null default false,
  add column priority public.ticket_priority,
  add column last_activity_at timestamptz not null default now(),
  add column completed_at timestamptz,
  add constraint feedback_description_length_check
    check (char_length(btrim(description)) between 1 and 30000),
  add constraint feedback_public_type_check
    check (not is_public or category = 'FEATURE_REQUEST'),
  add constraint feedback_completed_at_check
    check ((status = 'SHIPPED') = (completed_at is not null));
create index feedback_product_id_idx on public.feedback(product_id);
create index feedback_submitted_by_idx on public.feedback(submitted_by);
create index feedback_queue_activity_idx on public.feedback(last_activity_at desc,id desc);

alter table public.bug_reports
  alter column severity set default 'MEDIUM',
  add constraint bug_reports_feedback_required check (feedback_id is not null);

alter table public.feature_requests
  add constraint feature_requests_feedback_required check (feedback_id is not null);

create table public.feedback_messages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  feedback_id uuid not null references public.feedback(id) on delete cascade,
  author_user_id uuid not null references auth.users(id) on delete restrict,
  body text not null check (char_length(btrim(body)) between 1 and 30000),
  is_internal boolean not null default false,
  created_at timestamptz not null default now()
);
create index feedback_messages_feedback_time_idx
  on public.feedback_messages (feedback_id, created_at, id);
create index feedback_messages_organization_id_idx on public.feedback_messages(organization_id);
create index feedback_messages_author_user_id_idx on public.feedback_messages(author_user_id);

create table public.feedback_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  feedback_id uuid not null references public.feedback(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  event_type text not null check (event_type in (
    'SUBMITTED', 'STATUS_CHANGED', 'TRIAGE_UPDATED', 'INTERNAL_NOTE_ADDED',
    'CUSTOMER_RESPONSE_ADDED', 'PUBLISHED', 'UNPUBLISHED', 'VOTED', 'VOTE_REMOVED'
  )),
  customer_visible boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index feedback_events_feedback_time_idx
  on public.feedback_events (feedback_id, created_at, id);
create index feedback_events_actor_user_id_idx on public.feedback_events(actor_user_id);
create index feedback_events_customer_timeline_idx
  on public.feedback_events (organization_id, feedback_id, created_at, id)
  where customer_visible;
create index feature_votes_user_id_idx on public.feature_votes(user_id);

create or replace function private.feedback_actor_has_assignment(
  target_organization_id uuid,
  target_product_id uuid
)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select (select auth.uid()) is not null and (
    (select private.is_beauroi_admin())
    or (
      exists (
        select 1 from public.organization_memberships m
        join public.organizations o on o.id = m.organization_id
        where m.user_id = (select auth.uid()) and m.status = 'ACTIVE'
          and m.role = 'BEAUROI_EMPLOYEE' and o.organization_type = 'BEAUROI'
          and o.is_active
      )
      and exists (
        select 1 from public.customer_assignments a
        where a.employee_user_id = (select auth.uid())
          and a.organization_id = target_organization_id
          and a.assignment_type in ('CSM', 'ACCOUNT_OWNER')
          and a.is_active and a.ended_at is null
          and (a.product_id is null or a.product_id = target_product_id)
      )
    )
  );
$$;

create or replace function private.can_read_feedback(target_feedback_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.feedback f
    where f.id = target_feedback_id and (
      (select private.is_beauroi_user())
      or (select private.is_active_customer_member(f.organization_id))
      or (
        f.category = 'FEATURE_REQUEST' and f.is_public
        and exists (
          select 1 from public.organization_memberships m
          where m.user_id = (select auth.uid()) and m.status = 'ACTIVE'
            and m.role in ('CUSTOMER_ADMIN', 'CUSTOMER_MEMBER')
        )
        and exists (
          select 1 from public.customer_subscriptions s
          where s.organization_id in (
            select m.organization_id from public.organization_memberships m
            where m.user_id = (select auth.uid()) and m.status = 'ACTIVE'
          ) and s.product_id = f.product_id and s.status = 'ACTIVE'
        )
      )
    )
  );
$$;

create or replace function private.assert_feedback_product_scope(
  target_organization_id uuid, target_product_id uuid
)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if target_product_id is null or not exists (
    select 1 from public.customer_subscriptions s
    join public.products p on p.id = s.product_id
    join public.organizations o on o.id = s.organization_id
    where s.organization_id = target_organization_id and s.product_id = target_product_id
      and s.status = 'ACTIVE' and p.status = 'ACTIVE' and o.is_active
  ) then
    raise exception 'Feedback requires an active subscribed product' using errcode = '23514';
  end if;
end;
$$;

create or replace function private.create_feedback(
  target_organization_id uuid, target_product_id uuid, feedback_type text,
  feedback_title text, feedback_description text,
  bug_reproduction_steps text default null, bug_environment text default null,
  feature_problem_statement text default null, feature_desired_outcome text default null
)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare created_id uuid;
begin
  if not private.is_active_customer_member(target_organization_id) then
    raise exception 'Active customer organization membership is required' using errcode = '42501';
  end if;
  if feedback_type not in ('GENERAL', 'BUG', 'FEATURE_REQUEST') then
    raise exception 'Unsupported feedback type' using errcode = '22023';
  end if;
  if char_length(btrim(feedback_title)) not between 3 and 240
     or char_length(btrim(feedback_description)) not between 1 and 30000 then
    raise exception 'Feedback title or description is invalid' using errcode = '22023';
  end if;
  perform private.assert_feedback_product_scope(target_organization_id, target_product_id);
  insert into public.feedback (
    organization_id, product_id, submitted_by, title, description, category,
    status, last_activity_at
  ) values (
    target_organization_id, target_product_id, (select auth.uid()), btrim(feedback_title),
    btrim(feedback_description), feedback_type, 'SUBMITTED', now()
  ) returning id into created_id;
  if feedback_type = 'BUG' then
    insert into public.bug_reports (
      organization_id, feedback_id, severity, reproduction_steps, environment
    ) values (
      target_organization_id, created_id, 'MEDIUM', nullif(btrim(bug_reproduction_steps), ''),
      nullif(btrim(bug_environment), '')
    );
  elsif feedback_type = 'FEATURE_REQUEST' then
    if char_length(btrim(coalesce(feature_problem_statement, ''))) < 1 then
      raise exception 'A feature problem statement is required' using errcode = '22023';
    end if;
    insert into public.feature_requests (
      organization_id, feedback_id, problem_statement, desired_outcome, status
    ) values (
      target_organization_id, created_id, btrim(feature_problem_statement),
      nullif(btrim(feature_desired_outcome), ''), 'SUBMITTED'
    );
  end if;
  insert into public.feedback_events (
    organization_id, feedback_id, actor_user_id, event_type, customer_visible
  ) values (target_organization_id, created_id, (select auth.uid()), 'SUBMITTED', true);
  return created_id;
end;
$$;

create or replace function public.create_feedback(
  target_organization_id uuid, target_product_id uuid, feedback_type text,
  feedback_title text, feedback_description text,
  bug_reproduction_steps text default null, bug_environment text default null,
  feature_problem_statement text default null, feature_desired_outcome text default null
)
returns uuid language sql volatile security definer set search_path = ''
as $$ select private.create_feedback(
  target_organization_id, target_product_id, feedback_type, feedback_title,
  feedback_description, bug_reproduction_steps, bug_environment,
  feature_problem_statement, feature_desired_outcome
); $$;

create or replace function private.add_feedback_message(
  target_feedback_id uuid, message_body text, internal_message boolean
)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare item public.feedback%rowtype; created_id uuid; customer_actor boolean; staff_actor boolean;
begin
  select * into item from public.feedback where id = target_feedback_id for update;
  if not found then raise exception 'Feedback is unavailable' using errcode = 'P0001'; end if;
  customer_actor := private.is_active_customer_member(item.organization_id);
  staff_actor := private.feedback_actor_has_assignment(item.organization_id, item.product_id);
  if not customer_actor and not staff_actor then
    raise exception 'Feedback access is unavailable' using errcode = '42501';
  end if;
  if customer_actor and internal_message then
    raise exception 'Customer users cannot create internal notes' using errcode = '42501';
  end if;
  if char_length(btrim(message_body)) not between 1 and 30000 then
    raise exception 'Feedback message is invalid' using errcode = '22023';
  end if;
  insert into public.feedback_messages (
    organization_id, feedback_id, author_user_id, body, is_internal
  ) values (item.organization_id, item.id, (select auth.uid()), btrim(message_body), internal_message)
  returning id into created_id;
  update public.feedback set last_activity_at = now() where id = item.id;
  insert into public.feedback_events (
    organization_id, feedback_id, actor_user_id, event_type, customer_visible
  ) values (
    item.organization_id, item.id, (select auth.uid()),
    case when internal_message then 'INTERNAL_NOTE_ADDED' else 'CUSTOMER_RESPONSE_ADDED' end,
    not internal_message
  );
  return created_id;
end;
$$;

create or replace function public.add_feedback_message(
  target_feedback_id uuid, message_body text, internal_message boolean default false
)
returns uuid language sql volatile security definer set search_path = ''
as $$ select private.add_feedback_message(target_feedback_id, message_body, internal_message); $$;

create or replace function private.update_feedback_status(
  target_feedback_id uuid, target_status public.feedback_status
)
returns void language plpgsql security definer set search_path = ''
as $$
declare item public.feedback%rowtype;
begin
  select * into item from public.feedback where id = target_feedback_id for update;
  if not found then raise exception 'Feedback is unavailable' using errcode = 'P0001'; end if;
  if not private.feedback_actor_has_assignment(item.organization_id, item.product_id) then
    raise exception 'An active feedback assignment is required' using errcode = '42501';
  end if;
  if item.status = 'SHIPPED' or item.status = 'DECLINED' then
    raise exception 'Terminal feedback cannot change status' using errcode = '23514';
  end if;
  if not (case item.status
    when 'SUBMITTED' then target_status in ('UNDER_REVIEW', 'DECLINED')
    when 'UNDER_REVIEW' then target_status in ('PLANNED', 'IN_PROGRESS', 'DECLINED')
    when 'PLANNED' then target_status in ('IN_PROGRESS', 'DECLINED')
    when 'IN_PROGRESS' then target_status in ('SHIPPED', 'DECLINED')
    else false end) then
    raise exception 'Invalid feedback status transition' using errcode = '23514';
  end if;
  update public.feedback set status = target_status,
    completed_at = case when target_status = 'SHIPPED' then now() else null end,
    last_activity_at = now() where id = item.id;
  update public.feature_requests set status = target_status where feedback_id = item.id;
  insert into public.feedback_events (
    organization_id, feedback_id, actor_user_id, event_type, customer_visible,
    metadata
  ) values (
    item.organization_id, item.id, (select auth.uid()), 'STATUS_CHANGED', true,
    jsonb_build_object('from', item.status, 'to', target_status)
  );
end;
$$;

create or replace function public.update_feedback_status(
  target_feedback_id uuid, target_status public.feedback_status
)
returns void language sql volatile security definer set search_path = ''
as $$ select private.update_feedback_status(target_feedback_id, target_status); $$;

create or replace function private.update_feedback_triage(
  target_feedback_id uuid, target_priority public.ticket_priority,
  target_severity text, target_public boolean
)
returns void language plpgsql security definer set search_path = ''
as $$
declare item public.feedback%rowtype; publication_changed boolean;
begin
  select * into item from public.feedback where id = target_feedback_id for update;
  if not found then raise exception 'Feedback is unavailable' using errcode = 'P0001'; end if;
  if not private.feedback_actor_has_assignment(item.organization_id, item.product_id) then
    raise exception 'An active feedback assignment is required' using errcode = '42501';
  end if;
  if target_public and item.category <> 'FEATURE_REQUEST' then
    raise exception 'Only feature requests may be published' using errcode = '23514';
  end if;
  if target_severity is not null and target_severity not in ('LOW','MEDIUM','HIGH','CRITICAL') then
    raise exception 'Invalid bug severity' using errcode = '22023';
  end if;
  if item.category <> 'BUG' and target_severity is not null then
    raise exception 'Severity applies only to bug reports' using errcode = '23514';
  end if;
  publication_changed := item.is_public is distinct from target_public;
  update public.feedback set priority = target_priority, is_public = target_public,
    last_activity_at = now() where id = item.id;
  if item.category = 'BUG' and target_severity is not null then
    update public.bug_reports set severity = target_severity where feedback_id = item.id;
  end if;
  insert into public.feedback_events (
    organization_id, feedback_id, actor_user_id, event_type, customer_visible
  ) values (item.organization_id, item.id, (select auth.uid()), 'TRIAGE_UPDATED', false);
  if publication_changed then
    insert into public.feedback_events (
      organization_id, feedback_id, actor_user_id, event_type, customer_visible
    ) values (
      item.organization_id, item.id, (select auth.uid()),
      case when target_public then 'PUBLISHED' else 'UNPUBLISHED' end, true
    );
  end if;
end;
$$;

create or replace function public.update_feedback_triage(
  target_feedback_id uuid, target_priority public.ticket_priority,
  target_severity text, target_public boolean
)
returns void language sql volatile security definer set search_path = ''
as $$ select private.update_feedback_triage(
  target_feedback_id, target_priority, target_severity, target_public
); $$;

create or replace function private.cast_feature_vote(target_feedback_id uuid, remove_vote boolean)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare item public.feedback%rowtype; request_id uuid; voter_organization uuid; changed boolean := false;
begin
  select * into item from public.feedback where id = target_feedback_id for update;
  if not found or item.category <> 'FEATURE_REQUEST' then
    raise exception 'Feature request is unavailable' using errcode = 'P0001';
  end if;
  select m.organization_id into voter_organization
  from public.organization_memberships m
  join public.organizations o on o.id = m.organization_id
  where m.user_id = (select auth.uid()) and m.status = 'ACTIVE'
    and m.role in ('CUSTOMER_ADMIN','CUSTOMER_MEMBER') and o.is_active
  order by m.is_primary desc, m.id limit 1;
  if voter_organization is null then
    raise exception 'Active customer membership is required' using errcode = '42501';
  end if;
  if voter_organization <> item.organization_id and not item.is_public then
    raise exception 'Feature request is unavailable' using errcode = 'P0001';
  end if;
  perform private.assert_feedback_product_scope(voter_organization, item.product_id);
  select id into request_id from public.feature_requests where feedback_id = item.id;
  if remove_vote then
    delete from public.feature_votes where feature_request_id = request_id
      and user_id = (select auth.uid());
    changed := found;
  else
    insert into public.feature_votes (organization_id, feature_request_id, user_id)
    values (voter_organization, request_id, (select auth.uid()))
    on conflict (feature_request_id, user_id) do nothing;
    changed := found;
  end if;
  if changed then
    insert into public.feedback_events (
      organization_id, feedback_id, actor_user_id, event_type, customer_visible
    ) values (
      item.organization_id, item.id, (select auth.uid()),
      case when remove_vote then 'VOTE_REMOVED' else 'VOTED' end, false
    );
  end if;
  return changed;
end;
$$;

create or replace function public.vote_feature_request(target_feedback_id uuid)
returns boolean language sql volatile security definer set search_path = ''
as $$ select private.cast_feature_vote(target_feedback_id, false); $$;
create or replace function public.unvote_feature_request(target_feedback_id uuid)
returns boolean language sql volatile security definer set search_path = ''
as $$ select private.cast_feature_vote(target_feedback_id, true); $$;

create or replace function public.get_feature_vote_summary(target_feedback_id uuid)
returns table(vote_count bigint, has_voted boolean)
language sql stable security definer set search_path = ''
as $$
  select count(v.id), coalesce(bool_or(v.user_id = (select auth.uid())), false)
  from public.feedback f
  join public.feature_requests r on r.feedback_id = f.id
  left join public.feature_votes v on v.feature_request_id = r.id
  where f.id = target_feedback_id and private.can_read_feedback(f.id);
$$;

create or replace function private.guard_feedback_identity()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if (new.id, new.organization_id, new.product_id, new.submitted_by,
      new.title, new.description, new.category, new.created_at)
    is distinct from (old.id, old.organization_id, old.product_id, old.submitted_by,
      old.title, old.description, old.category, old.created_at) then
    raise exception 'Feedback identity and submitted content are immutable' using errcode='42501';
  end if;
  return new;
end;
$$;
create trigger feedback_guard_identity before update on public.feedback
  for each row execute function private.guard_feedback_identity();

create or replace function private.guard_feedback_child_identity()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if (new.id, new.organization_id, new.feedback_id, new.created_at)
    is distinct from (old.id, old.organization_id, old.feedback_id, old.created_at) then
    raise exception 'Feedback subtype identity is immutable' using errcode='42501';
  end if;
  return new;
end;
$$;
create trigger bug_reports_guard_identity before update on public.bug_reports
  for each row execute function private.guard_feedback_child_identity();
create trigger feature_requests_guard_identity before update on public.feature_requests
  for each row execute function private.guard_feedback_child_identity();

create or replace function private.guard_feedback_append_only()
returns trigger language plpgsql set search_path = ''
as $$ begin raise exception 'Feedback history is append-only' using errcode='42501'; end; $$;
create trigger feedback_messages_append_only before update on public.feedback_messages
  for each row execute function private.guard_feedback_append_only();
create trigger feedback_events_append_only before update on public.feedback_events
  for each row execute function private.guard_feedback_append_only();

create or replace function private.create_feedback_event_notifications()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare item public.feedback%rowtype; recipient record; notification_title text; target_path text;
begin
  if not new.customer_visible or new.event_type in ('VOTED','VOTE_REMOVED') then return new; end if;
  select * into item from public.feedback where id = new.feedback_id;
  if new.event_type = 'SUBMITTED' then
    notification_title := 'New customer feedback';
    target_path := '/beauroi/feedback/' || new.feedback_id;
    for recipient in
      select distinct m.user_id from public.organization_memberships m
      join public.organizations o on o.id = m.organization_id
      where m.status='ACTIVE' and o.organization_type='BEAUROI' and o.is_active
        and (m.role='BEAUROI_ADMIN' or exists (
          select 1 from public.customer_assignments a
          where a.employee_user_id=m.user_id and a.organization_id=item.organization_id
            and a.assignment_type in ('CSM','ACCOUNT_OWNER') and a.is_active and a.ended_at is null
            and (a.product_id is null or a.product_id=item.product_id)
        ))
    loop
      insert into public.notifications (organization_id,user_id,category,title,body,link_path)
      values (item.organization_id,recipient.user_id,'FEEDBACK',notification_title,
        left(item.title,240),target_path);
    end loop;
  elsif new.event_type in ('STATUS_CHANGED','CUSTOMER_RESPONSE_ADDED','PUBLISHED') then
    notification_title := case new.event_type
      when 'STATUS_CHANGED' then 'Feedback status updated'
      when 'PUBLISHED' then 'Feature request published'
      else 'Beau Roi responded to your feedback' end;
    target_path := '/portal/feedback/' || new.feedback_id;
    for recipient in
      select m.user_id from public.organization_memberships m
      where m.organization_id=item.organization_id and m.status='ACTIVE'
        and m.role in ('CUSTOMER_ADMIN','CUSTOMER_MEMBER')
    loop
      insert into public.notifications (organization_id,user_id,category,title,body,link_path)
      values (item.organization_id,recipient.user_id,'FEEDBACK',notification_title,
        left(item.title,240),target_path);
    end loop;
  end if;
  return new;
end;
$$;
create trigger feedback_events_create_notifications after insert on public.feedback_events
  for each row execute function private.create_feedback_event_notifications();

alter table public.feedback_messages enable row level security;
alter table public.feedback_events enable row level security;

drop policy if exists tenant_read on public.feedback;
drop policy if exists beauroi_insert on public.feedback;
drop policy if exists beauroi_update on public.feedback;
drop policy if exists beauroi_delete on public.feedback;
create policy feedback_read on public.feedback for select to authenticated
  using (private.can_read_feedback(id));

drop policy if exists tenant_read on public.bug_reports;
drop policy if exists beauroi_insert on public.bug_reports;
drop policy if exists beauroi_update on public.bug_reports;
drop policy if exists beauroi_delete on public.bug_reports;
create policy bug_reports_read on public.bug_reports for select to authenticated
  using (private.can_read_feedback(feedback_id));

drop policy if exists tenant_read on public.feature_requests;
drop policy if exists beauroi_insert on public.feature_requests;
drop policy if exists beauroi_update on public.feature_requests;
drop policy if exists beauroi_delete on public.feature_requests;
create policy feature_requests_read on public.feature_requests for select to authenticated
  using (private.can_read_feedback(feedback_id));

drop policy if exists tenant_read on public.feature_votes;
drop policy if exists beauroi_insert on public.feature_votes;
drop policy if exists beauroi_update on public.feature_votes;
drop policy if exists beauroi_delete on public.feature_votes;

create policy feedback_messages_read on public.feedback_messages for select to authenticated
  using (private.can_read_feedback(feedback_id) and (
    not is_internal or private.is_beauroi_user()
  ));
create policy feedback_events_read on public.feedback_events for select to authenticated
  using (private.can_read_feedback(feedback_id) and (
    customer_visible or private.is_beauroi_user()
  ));

revoke all on table public.feedback, public.bug_reports, public.feature_requests,
  public.feature_votes, public.feedback_messages, public.feedback_events
  from public, anon, authenticated;
grant select on table public.feedback, public.bug_reports, public.feature_requests,
  public.feedback_messages, public.feedback_events to authenticated;
grant all on table public.feedback, public.bug_reports, public.feature_requests,
  public.feature_votes, public.feedback_messages, public.feedback_events to service_role;

revoke all on function private.feedback_actor_has_assignment(uuid,uuid),
  private.can_read_feedback(uuid), private.assert_feedback_product_scope(uuid,uuid),
  private.create_feedback(uuid,uuid,text,text,text,text,text,text,text),
  private.add_feedback_message(uuid,text,boolean),
  private.update_feedback_status(uuid,public.feedback_status),
  private.update_feedback_triage(uuid,public.ticket_priority,text,boolean),
  private.cast_feature_vote(uuid,boolean), private.guard_feedback_identity(),
  private.guard_feedback_child_identity(), private.guard_feedback_append_only(),
  private.create_feedback_event_notifications()
  from public, anon, authenticated;

revoke all on function public.create_feedback(uuid,uuid,text,text,text,text,text,text,text),
  public.add_feedback_message(uuid,text,boolean),
  public.update_feedback_status(uuid,public.feedback_status),
  public.update_feedback_triage(uuid,public.ticket_priority,text,boolean),
  public.vote_feature_request(uuid), public.unvote_feature_request(uuid),
  public.get_feature_vote_summary(uuid)
  from public, anon, authenticated;
grant execute on function public.create_feedback(uuid,uuid,text,text,text,text,text,text,text),
  public.add_feedback_message(uuid,text,boolean),
  public.update_feedback_status(uuid,public.feedback_status),
  public.update_feedback_triage(uuid,public.ticket_priority,text,boolean),
  public.vote_feature_request(uuid), public.unvote_feature_request(uuid),
  public.get_feature_vote_summary(uuid)
  to authenticated;

-- Required only because authenticated RLS policies invoke this boolean helper.
-- It discloses no row data and returns true only when the caller can already read.
grant execute on function private.can_read_feedback(uuid) to authenticated;

comment on column public.feedback.is_public is
  'False by default. Only approved feature requests may be discovered across customer organizations.';
comment on table public.feedback_messages is
  'Append-only customer-visible responses and isolated Beau Roi internal triage notes.';
comment on table public.feedback_events is
  'Immutable feedback workflow history; customer-visible rows exclude private triage content.';
