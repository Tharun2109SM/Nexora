-- NEXORA Milestone 8: caller-authorized, deterministic operational analytics.

create index if not exists onboarding_plans_analytics_idx
  on public.onboarding_plans(organization_id, workflow_status, created_at, product_id);
create index if not exists onboarding_tasks_analytics_idx
  on public.onboarding_tasks(organization_id, workflow_status, due_at);
create index if not exists implementation_projects_analytics_idx
  on public.implementation_projects(organization_id, workflow_status, created_at, product_id);
create index if not exists milestones_analytics_idx
  on public.milestones(organization_id, workflow_status, due_on);
create index if not exists feedback_analytics_idx
  on public.feedback(organization_id, status, category, created_at, product_id);

create or replace function private.raise_invalid_window(target_window text)
returns timestamptz language plpgsql immutable set search_path = ''
as $$ begin
  perform target_window;
  raise exception 'Analytics window must be 7D, 30D, 90D, or ALL' using errcode='22023';
end $$;

create or replace function private.analytics_cutoff(target_window text)
returns timestamptz language plpgsql stable set search_path = ''
as $$ begin
  return case target_window
    when '7D' then now() - interval '7 days'
    when '30D' then now() - interval '30 days'
    when '90D' then now() - interval '90 days'
    when 'ALL' then '-infinity'::timestamptz
    else private.raise_invalid_window(target_window)
  end;
end $$;

create or replace function private.analytics_active_subscription(
  target_organization_id uuid, target_product_id uuid
) returns boolean language sql stable security definer set search_path = ''
as $$
  select exists(
    select 1 from public.customer_subscriptions subscription
    where subscription.organization_id=target_organization_id
      and subscription.product_id=target_product_id and subscription.status='ACTIVE'
      and (subscription.starts_on is null or subscription.starts_on<=current_date)
      and (subscription.ends_on is null or subscription.ends_on>=current_date)
  );
$$;

create or replace function private.analytics_release_visible(
  target_release_id uuid, target_organization_id uuid
) returns boolean language sql stable security definer set search_path = ''
as $$
  select exists(
    select 1 from public.product_releases release
    where release.id=target_release_id and release.customer_visible
      and private.analytics_active_subscription(target_organization_id,release.product_id)
      and (release.audience_mode='ALL_SUBSCRIBERS' or exists(
        select 1 from public.release_targets target
        where target.release_id=release.id and target.organization_id=target_organization_id
      ))
  );
$$;

create or replace function private.analytics_maintenance_visible(
  target_notice_id uuid, target_organization_id uuid
) returns boolean language sql stable security definer set search_path = ''
as $$
  select exists(
    select 1 from public.maintenance_notices notice
    where notice.id=target_notice_id and notice.customer_visible
      and private.analytics_active_subscription(target_organization_id,notice.product_id)
      and (notice.audience_mode='ALL_SUBSCRIBERS' or exists(
        select 1 from public.maintenance_targets target
        where target.notice_id=notice.id and target.organization_id=target_organization_id
      ))
  );
$$;

create or replace function private.analytics_knowledge_visible(
  target_article_id uuid, target_organization_id uuid
) returns boolean language sql stable security definer set search_path = ''
as $$
  select exists(
    select 1 from public.knowledge_base_articles article
    where article.id=target_article_id and article.article_status='PUBLISHED'
      and article.audience_mode<>'INTERNAL'
      and (
        article.audience_mode='ALL_CUSTOMERS'
        or (article.audience_mode='PRODUCT_SCOPED'
          and private.analytics_active_subscription(target_organization_id,article.product_id))
        or (article.audience_mode='SELECTED_ORGANIZATION'
          and article.organization_id=target_organization_id
          and (article.product_id is null
            or private.analytics_active_subscription(target_organization_id,article.product_id)))
      )
  );
$$;

create or replace function public.get_staff_analytics(
  target_window text default '30D', target_organization_id uuid default null,
  target_product_id uuid default null
) returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare cutoff timestamptz; result jsonb;
begin
  if not private.is_beauroi_user() then
    raise exception 'Beau Roi analytics access is required' using errcode='42501';
  end if;
  cutoff := private.analytics_cutoff(target_window);
  if target_organization_id is not null and not exists(
    select 1 from public.organizations where id=target_organization_id and organization_type='CUSTOMER'
  ) then raise exception 'Customer organization unavailable' using errcode='P0001'; end if;
  if target_product_id is not null and not exists(select 1 from public.products where id=target_product_id) then
    raise exception 'Product unavailable' using errcode='P0001'; end if;

  select jsonb_build_object(
    'window', target_window,
    'generatedAt', now(),
    'customers', jsonb_build_object(
      'active', (select count(*) from public.organizations o where o.organization_type='CUSTOMER' and o.is_active and (target_organization_id is null or o.id=target_organization_id) and (target_product_id is null or private.analytics_active_subscription(o.id,target_product_id))),
      'lifecycle', coalesce((select jsonb_object_agg(x.lifecycle_status,x.total) from (
        select o.lifecycle_status::text lifecycle_status,count(*) total from public.organizations o
        where o.organization_type='CUSTOMER' and o.is_active and (target_organization_id is null or o.id=target_organization_id) and (target_product_id is null or private.analytics_active_subscription(o.id,target_product_id))
        group by o.lifecycle_status) x),'{}'::jsonb)
    ),
    'onboarding', jsonb_build_object(
      'active', (select count(*) from public.onboarding_plans p where p.workflow_status in ('NOT_STARTED','IN_PROGRESS','BLOCKED','READY_FOR_GO_LIVE') and p.created_at>=cutoff and (target_organization_id is null or p.organization_id=target_organization_id) and (target_product_id is null or p.product_id=target_product_id)),
      'completed', (select count(*) from public.onboarding_plans p where p.workflow_status='LIVE' and p.created_at>=cutoff and (target_organization_id is null or p.organization_id=target_organization_id) and (target_product_id is null or p.product_id=target_product_id)),
      'eligible', (select count(*) from public.onboarding_plans p where p.workflow_status<>'CANCELLED' and p.created_at>=cutoff and (target_organization_id is null or p.organization_id=target_organization_id) and (target_product_id is null or p.product_id=target_product_id)),
      'overduePlans', (select count(*) from public.onboarding_plans p where p.target_completion_on<current_date and p.workflow_status not in ('LIVE','CANCELLED') and (target_organization_id is null or p.organization_id=target_organization_id) and (target_product_id is null or p.product_id=target_product_id)),
      'overdueTasks', (select count(*) from public.onboarding_tasks t join public.onboarding_plans p on p.id=t.onboarding_plan_id where t.due_at<now() and t.workflow_status not in ('COMPLETED','CANCELLED') and (target_organization_id is null or t.organization_id=target_organization_id) and (target_product_id is null or p.product_id=target_product_id))
    ),
    'implementation', jsonb_build_object(
      'active', (select count(*) from public.implementation_projects p where p.workflow_status in ('NOT_STARTED','IN_PROGRESS','BLOCKED') and p.created_at>=cutoff and (target_organization_id is null or p.organization_id=target_organization_id) and (target_product_id is null or p.product_id=target_product_id)),
      'completed', (select count(*) from public.implementation_projects p where p.workflow_status='COMPLETED' and p.created_at>=cutoff and (target_organization_id is null or p.organization_id=target_organization_id) and (target_product_id is null or p.product_id=target_product_id)),
      'overdueMilestones', (select count(*) from public.milestones m join public.implementation_projects p on p.id=m.implementation_project_id where m.due_on<current_date and m.workflow_status not in ('COMPLETED','CANCELLED') and (target_organization_id is null or m.organization_id=target_organization_id) and (target_product_id is null or p.product_id=target_product_id))
    ),
    'support', jsonb_build_object(
      'active', (select count(*) from public.support_tickets t where t.status in ('OPEN','IN_PROGRESS','WAITING_ON_CUSTOMER') and t.created_at>=cutoff and (target_organization_id is null or t.organization_id=target_organization_id) and (target_product_id is null or t.product_id=target_product_id)),
      'breached', (select count(*) from public.support_tickets t where ((t.first_response_due_at<coalesce(t.first_responded_at,now())) or (t.resolution_due_at<coalesce(t.resolved_at,t.closed_at,now()))) and t.created_at>=cutoff and (target_organization_id is null or t.organization_id=target_organization_id) and (target_product_id is null or t.product_id=target_product_id)),
      'averageFirstResponseMinutes', (select round(avg(extract(epoch from (t.first_responded_at-t.created_at))/60)::numeric,1) from public.support_tickets t where t.first_responded_at is not null and t.created_at>=cutoff and (target_organization_id is null or t.organization_id=target_organization_id) and (target_product_id is null or t.product_id=target_product_id)),
      'averageResolutionMinutes', (select round(avg(extract(epoch from (coalesce(t.resolved_at,t.closed_at)-t.created_at))/60)::numeric,1) from public.support_tickets t where coalesce(t.resolved_at,t.closed_at) is not null and t.created_at>=cutoff and (target_organization_id is null or t.organization_id=target_organization_id) and (target_product_id is null or t.product_id=target_product_id)),
      'firstResponseEligible', (select count(*) from public.support_tickets t where t.first_response_due_at is not null and t.first_responded_at is not null and t.created_at>=cutoff and (target_organization_id is null or t.organization_id=target_organization_id) and (target_product_id is null or t.product_id=target_product_id)),
      'firstResponseMet', (select count(*) from public.support_tickets t where t.first_response_due_at is not null and t.first_responded_at<=t.first_response_due_at and t.created_at>=cutoff and (target_organization_id is null or t.organization_id=target_organization_id) and (target_product_id is null or t.product_id=target_product_id)),
      'resolutionEligible', (select count(*) from public.support_tickets t where t.resolution_due_at is not null and coalesce(t.resolved_at,t.closed_at) is not null and t.created_at>=cutoff and (target_organization_id is null or t.organization_id=target_organization_id) and (target_product_id is null or t.product_id=target_product_id)),
      'resolutionMet', (select count(*) from public.support_tickets t where t.resolution_due_at is not null and coalesce(t.resolved_at,t.closed_at)<=t.resolution_due_at and t.created_at>=cutoff and (target_organization_id is null or t.organization_id=target_organization_id) and (target_product_id is null or t.product_id=target_product_id)),
      'statuses', coalesce((select jsonb_object_agg(x.status,x.total) from (select t.status::text status,count(*) total from public.support_tickets t where t.created_at>=cutoff and (target_organization_id is null or t.organization_id=target_organization_id) and (target_product_id is null or t.product_id=target_product_id) group by t.status) x),'{}'::jsonb),
      'priorities', coalesce((select jsonb_object_agg(x.priority,x.total) from (select t.priority::text priority,count(*) total from public.support_tickets t where t.created_at>=cutoff and (target_organization_id is null or t.organization_id=target_organization_id) and (target_product_id is null or t.product_id=target_product_id) group by t.priority) x),'{}'::jsonb)
    ),
    'feedback', jsonb_build_object(
      'total', (select count(*) from public.feedback f where f.created_at>=cutoff and (target_organization_id is null or f.organization_id=target_organization_id) and (target_product_id is null or f.product_id=target_product_id)),
      'publishedFeatures', (select count(*) from public.feedback f where f.category='FEATURE_REQUEST' and f.is_public and f.created_at>=cutoff and (target_organization_id is null or f.organization_id=target_organization_id) and (target_product_id is null or f.product_id=target_product_id)),
      'votes', (select count(*) from public.feature_votes v join public.feedback f on f.id=(select fr.feedback_id from public.feature_requests fr where fr.id=v.feature_request_id) where v.created_at>=cutoff and (target_organization_id is null or v.organization_id=target_organization_id) and (target_product_id is null or f.product_id=target_product_id)),
      'types', coalesce((select jsonb_object_agg(x.category,x.total) from (select f.category,count(*) total from public.feedback f where f.created_at>=cutoff and (target_organization_id is null or f.organization_id=target_organization_id) and (target_product_id is null or f.product_id=target_product_id) group by f.category) x),'{}'::jsonb),
      'statuses', coalesce((select jsonb_object_agg(x.status,x.total) from (select f.status::text status,count(*) total from public.feedback f where f.created_at>=cutoff and (target_organization_id is null or f.organization_id=target_organization_id) and (target_product_id is null or f.product_id=target_product_id) group by f.status) x),'{}'::jsonb)
    ),
    'delivery', jsonb_build_object(
      'publishedReleases', (select count(*) from public.product_releases r where r.release_status='PUBLISHED' and r.published_at>=cutoff and (target_product_id is null or r.product_id=target_product_id) and (target_organization_id is null or private.analytics_release_visible(r.id,target_organization_id))),
      'scheduledReleases', (select count(*) from public.product_releases r where r.release_status='SCHEDULED' and r.scheduled_for>=now() and (target_product_id is null or r.product_id=target_product_id) and (target_organization_id is null or private.analytics_release_visible(r.id,target_organization_id))),
      'maintenance', (select count(*) from public.maintenance_notices n where n.maintenance_status in ('SCHEDULED','ACTIVE') and (target_product_id is null or n.product_id=target_product_id) and (target_organization_id is null or private.analytics_maintenance_visible(n.id,target_organization_id))),
      'publishedArticles', (select count(*) from public.knowledge_base_articles a where a.article_status='PUBLISHED' and a.published_at>=cutoff and (target_product_id is null or a.product_id=target_product_id) and (target_organization_id is null or private.analytics_knowledge_visible(a.id,target_organization_id))),
      'articleTypes', coalesce((select jsonb_object_agg(x.article_type,x.total) from (select a.article_type,count(*) total from public.knowledge_base_articles a where a.article_status='PUBLISHED' and a.published_at>=cutoff and (target_product_id is null or a.product_id=target_product_id) and (target_organization_id is null or private.analytics_knowledge_visible(a.id,target_organization_id)) group by a.article_type) x),'{}'::jsonb)
    )
  ) into result;
  return result;
end $$;

create or replace function public.get_customer_success_portfolio(
  target_limit integer default 25,target_search text default null,target_after_name text default null,
  target_after_id uuid default null,target_product_id uuid default null
) returns jsonb language plpgsql stable security definer set search_path = ''
as $$ declare result jsonb; begin
  if not private.is_beauroi_user() then raise exception 'Beau Roi analytics access is required' using errcode='42501'; end if;
  if target_limit not between 1 and 100 then raise exception 'Portfolio limit must be between 1 and 100' using errcode='22023'; end if;
  with eligible as (
    select o.id,o.name,o.lifecycle_status,
      h.score health_score,h.calculated_at health_calculated_at,
      (select count(*) from public.onboarding_plans p where p.organization_id=o.id and p.workflow_status in ('NOT_STARTED','IN_PROGRESS','BLOCKED','READY_FOR_GO_LIVE') and (target_product_id is null or p.product_id=target_product_id)) onboarding_active,
      exists(select 1 from public.onboarding_plans p where p.organization_id=o.id and p.target_completion_on<current_date and p.workflow_status not in ('LIVE','CANCELLED') and (target_product_id is null or p.product_id=target_product_id)) onboarding_overdue,
      (select count(*) from public.implementation_projects p where p.organization_id=o.id and p.workflow_status in ('NOT_STARTED','IN_PROGRESS','BLOCKED') and (target_product_id is null or p.product_id=target_product_id)) implementation_active,
      (select count(*) from public.support_tickets t where t.organization_id=o.id and t.status in ('OPEN','IN_PROGRESS','WAITING_ON_CUSTOMER') and (target_product_id is null or t.product_id=target_product_id)) active_tickets,
      (select count(*) from public.support_tickets t where t.organization_id=o.id and t.status in ('OPEN','IN_PROGRESS','WAITING_ON_CUSTOMER') and t.priority in ('HIGH','URGENT') and (target_product_id is null or t.product_id=target_product_id)) urgent_tickets,
      (select count(*) from public.support_tickets t where t.organization_id=o.id and t.status in ('OPEN','IN_PROGRESS','WAITING_ON_CUSTOMER') and ((t.first_response_due_at<coalesce(t.first_responded_at,now())) or t.resolution_due_at<now()) and (target_product_id is null or t.product_id=target_product_id)) sla_breaches,
      (select count(*) from public.feedback f where f.organization_id=o.id and f.status not in ('SHIPPED','DECLINED') and (target_product_id is null or f.product_id=target_product_id)) open_feedback,
      csm.full_name csm_name
    from public.organizations o
    left join lateral (select score,calculated_at from public.health_score_history h where h.organization_id=o.id order by calculated_at desc,id desc limit 1) h on true
    left join lateral (select p.full_name from public.customer_assignments a join public.profiles p on p.id=a.employee_user_id where a.organization_id=o.id and a.is_active and a.assignment_type in ('CSM','ACCOUNT_OWNER') and (target_product_id is null or a.product_id is null or a.product_id=target_product_id) order by a.assigned_at desc,a.id desc limit 1) csm on true
    where o.organization_type='CUSTOMER' and o.is_active
      and (target_search is null or o.name ilike '%'||replace(target_search,'%','')||'%')
      and (target_product_id is null or private.analytics_active_subscription(o.id,target_product_id))
      and (target_after_name is null or (o.name,o.id)>(target_after_name,target_after_id))
    order by o.name,o.id limit target_limit+1
  ), page as (select * from eligible order by name,id limit target_limit), last_row as (select * from page order by name desc,id desc limit 1)
  select jsonb_build_object(
    'data',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name,'lifecycleStatus',lifecycle_status,
      'healthScore',health_score,'healthCalculatedAt',health_calculated_at,'onboardingActive',onboarding_active,
      'onboardingOverdue',onboarding_overdue,'implementationActive',implementation_active,'activeTickets',active_tickets,
      'urgentTickets',urgent_tickets,'slaBreaches',sla_breaches,'openFeedback',open_feedback,'csmName',csm_name) order by name,id) from page),'[]'::jsonb),
    'next',case when (select count(*) from eligible)>target_limit then (select jsonb_build_object('name',name,'id',id) from last_row) else null end
  ) into result;
  return result;
end $$;

create or replace function public.get_customer_analytics_summary(target_window text default '30D')
returns jsonb language plpgsql stable security definer set search_path = ''
as $$ declare org_id uuid; cutoff timestamptz; result jsonb; begin
  select m.organization_id into org_id from public.organization_memberships m join public.organizations o on o.id=m.organization_id
  where m.user_id=(select auth.uid()) and m.status='ACTIVE' and m.role in ('CUSTOMER_ADMIN','CUSTOMER_MEMBER')
    and o.organization_type='CUSTOMER' and o.is_active order by m.is_primary desc,m.created_at limit 1;
  if org_id is null then raise exception 'Active customer membership is required' using errcode='42501'; end if;
  cutoff:=private.analytics_cutoff(target_window);
  select jsonb_build_object(
    'window',target_window,'generatedAt',now(),
    'onboardingActive',(select count(*) from public.onboarding_plans p where p.organization_id=org_id and p.workflow_status in ('NOT_STARTED','IN_PROGRESS','BLOCKED','READY_FOR_GO_LIVE')),
    'pendingActions',(select count(*) from public.onboarding_tasks t where t.organization_id=org_id and t.workflow_status not in ('COMPLETED','CANCELLED')),
    'implementationActive',(select count(*) from public.implementation_projects p where p.organization_id=org_id and p.workflow_status in ('NOT_STARTED','IN_PROGRESS','BLOCKED')),
    'activeTickets',(select count(*) from public.support_tickets t where t.organization_id=org_id and t.status in ('OPEN','IN_PROGRESS','WAITING_ON_CUSTOMER')),
    'openFeedback',(select count(*) from public.feedback f where f.organization_id=org_id and f.status not in ('SHIPPED','DECLINED')),
    'recentReleases',(select count(distinct r.id) from public.product_releases r join public.customer_subscriptions s on s.product_id=r.product_id and s.organization_id=org_id and s.status='ACTIVE' where r.release_status in ('PUBLISHED','ARCHIVED') and r.published_at>=cutoff and private.can_read_release(r.id)),
    'maintenanceNotices',(select count(distinct n.id) from public.maintenance_notices n join public.customer_subscriptions s on s.product_id=n.product_id and s.organization_id=org_id and s.status='ACTIVE' where n.maintenance_status in ('SCHEDULED','ACTIVE') and private.can_read_maintenance(n.id)),
    'publishedArticles',(select count(*) from public.knowledge_base_articles a where a.published_at>=cutoff and private.can_read_knowledge_article(a.id)),
    'healthHistory',coalesce((select jsonb_agg(jsonb_build_object('score',h.score,'calculatedAt',h.calculated_at,'reason',h.reason) order by h.calculated_at,h.id) from public.health_score_history h where h.organization_id=org_id and h.calculated_at>=cutoff),'[]'::jsonb)
  ) into result;
  return result;
end $$;

revoke all on function private.analytics_cutoff(text),private.raise_invalid_window(text),
  private.analytics_active_subscription(uuid,uuid),private.analytics_release_visible(uuid,uuid),
  private.analytics_maintenance_visible(uuid,uuid),private.analytics_knowledge_visible(uuid,uuid)
  from public,anon,authenticated;
revoke all on function public.get_staff_analytics(text,uuid,uuid),
  public.get_customer_success_portfolio(integer,text,text,uuid,uuid),
  public.get_customer_analytics_summary(text) from public,anon,authenticated;
grant execute on function public.get_staff_analytics(text,uuid,uuid),
  public.get_customer_success_portfolio(integer,text,text,uuid,uuid),
  public.get_customer_analytics_summary(text) to authenticated;

comment on function public.get_staff_analytics(text,uuid,uuid) is 'Real operational aggregates only; null averages mean insufficient observations.';
comment on function public.get_customer_analytics_summary(text) is 'Caller-derived organization summary; never accepts a browser organization identifier.';
