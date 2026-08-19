begin;
select plan(26);

insert into auth.users(id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data) values
('98000000-0000-4000-8000-000000000001','authenticated','authenticated','analytics-admin@test','x','{"nexora_account_type":"BEAUROI"}','{"full_name":"Analytics Admin"}'),
('98000000-0000-4000-8000-000000000002','authenticated','authenticated','analytics-unassigned@test','x','{"nexora_account_type":"BEAUROI"}','{"full_name":"Analytics Unassigned"}'),
('98000000-0000-4000-8000-000000000003','authenticated','authenticated','analytics-a@test','x','{"nexora_account_type":"BEAUROI"}','{"full_name":"Analytics Customer A"}'),
('98000000-0000-4000-8000-000000000004','authenticated','authenticated','analytics-b@test','x','{"nexora_account_type":"BEAUROI"}','{"full_name":"Analytics Customer B"}');
insert into public.organizations(id,name,slug,organization_type,lifecycle_status) values
('a8000000-0000-4000-8000-000000000001','Analytics Beau Roi','analytics-beau-roi','BEAUROI','ACTIVE'),
('a8000000-0000-4000-8000-000000000002','Analytics Customer A','analytics-customer-a','CUSTOMER','ACTIVE'),
('a8000000-0000-4000-8000-000000000003','Analytics Customer B','analytics-customer-b','CUSTOMER','ACTIVE');
insert into public.organization_memberships(organization_id,user_id,role,status,is_primary,joined_at) values
('a8000000-0000-4000-8000-000000000001','98000000-0000-4000-8000-000000000001','BEAUROI_ADMIN','ACTIVE',true,now()),
('a8000000-0000-4000-8000-000000000002','98000000-0000-4000-8000-000000000003','CUSTOMER_ADMIN','ACTIVE',true,now()),
('a8000000-0000-4000-8000-000000000003','98000000-0000-4000-8000-000000000004','CUSTOMER_MEMBER','ACTIVE',true,now());
insert into public.products(id,code,name,status) values
('b8000000-0000-4000-8000-000000000001','ANALYTICS_ONE','Analytics Product One','ACTIVE'),
('b8000000-0000-4000-8000-000000000002','ANALYTICS_TWO','Analytics Product Two','ACTIVE');
insert into public.customer_subscriptions(organization_id,product_id,status) values
('a8000000-0000-4000-8000-000000000002','b8000000-0000-4000-8000-000000000001','ACTIVE'),
('a8000000-0000-4000-8000-000000000003','b8000000-0000-4000-8000-000000000002','ACTIVE');

set session_replication_role=replica;
insert into public.onboarding_plans(id,organization_id,product_id,name,status,workflow_status,target_completion_on,created_at)
values('c8000000-0000-4000-8000-000000000001','a8000000-0000-4000-8000-000000000002','b8000000-0000-4000-8000-000000000001','Real onboarding','ACTIVE','IN_PROGRESS',current_date-1,now()-interval '2 days');
insert into public.onboarding_tasks(organization_id,onboarding_plan_id,title,status,workflow_status,owner_kind,assigned_user_id,due_at)
values('a8000000-0000-4000-8000-000000000002','c8000000-0000-4000-8000-000000000001','Overdue action','ACTIVE','IN_PROGRESS','CUSTOMER','98000000-0000-4000-8000-000000000003',now()-interval '1 day');
insert into public.health_score_history(organization_id,score,reason,source,calculated_at)
values
('a8000000-0000-4000-8000-000000000002',65,'Initial customer assessment','MANUAL',now()-interval '20 days'),
('a8000000-0000-4000-8000-000000000002',72,'Current customer assessment','MANUAL',now()-interval '2 days');
set session_replication_role=origin;

select ok(not has_function_privilege('authenticated','private.analytics_cutoff(text)','EXECUTE'),'analytics cutoff helper is private');
select ok(not has_function_privilege('authenticated','private.raise_invalid_window(text)','EXECUTE'),'invalid-window helper is private');
select ok(not has_function_privilege('authenticated','private.analytics_knowledge_visible(uuid,uuid)','EXECUTE'),'organization delivery helper is private');
select ok(has_function_privilege('authenticated','public.get_staff_analytics(text,uuid,uuid)','EXECUTE'),'staff aggregate RPC is exposed');
select ok(has_function_privilege('authenticated','public.get_customer_success_portfolio(integer,text,text,uuid,uuid)','EXECUTE'),'portfolio RPC is exposed');
select ok(has_function_privilege('authenticated','public.get_customer_analytics_summary(text)','EXECUTE'),'customer summary RPC is exposed');

set local role authenticated;
set local request.jwt.claims='{"sub":"98000000-0000-4000-8000-000000000003","role":"authenticated"}';
select throws_ok($$select public.get_staff_analytics('30D',null,null)$$,'42501','Beau Roi analytics access is required','customer cannot read staff aggregates');
select throws_ok($$select public.get_customer_success_portfolio(25,null,null,null,null)$$,'42501','Beau Roi analytics access is required','customer cannot read portfolio counts');
select is(((select public.get_customer_analytics_summary('30D'))->>'onboardingActive')::integer,1,'customer A sees its real active onboarding count');
select is(((select public.get_customer_analytics_summary('30D'))->>'pendingActions')::integer,1,'customer A sees its pending action count');
select is(jsonb_array_length((select public.get_customer_analytics_summary('30D'))->'healthHistory'),2,'customer A sees only its health history');
select is(((select public.get_customer_analytics_summary('30D'))->'healthHistory'->0->>'score')::numeric,65::numeric,'health history is ordered oldest to newest');
select is((select count(*)::integer from public.health_score_history),2,'customer A direct health read remains organization scoped');

reset role; set local role authenticated;
set local request.jwt.claims='{"sub":"98000000-0000-4000-8000-000000000004","role":"authenticated"}';
select is(((select public.get_customer_analytics_summary('30D'))->>'onboardingActive')::integer,0,'customer B cannot infer customer A onboarding');
select is(jsonb_array_length((select public.get_customer_analytics_summary('30D'))->'healthHistory'),0,'customer B cannot infer customer A health history');
select is((select count(*)::integer from public.health_score_history),0,'direct health reads reject cross-organization data');

reset role; set local role authenticated;
set local request.jwt.claims='{"sub":"98000000-0000-4000-8000-000000000002","role":"authenticated"}';
select throws_ok($$select public.get_staff_analytics('30D',null,null)$$,'42501','Beau Roi analytics access is required','unassigned authenticated user cannot read analytics');

reset role; set local role authenticated;
set local request.jwt.claims='{"sub":"98000000-0000-4000-8000-000000000001","role":"authenticated"}';
select throws_ok($$select public.get_staff_analytics('1Y',null,null)$$,'22023','Analytics window must be 7D, 30D, 90D, or ALL','unsupported date window is rejected');
select is(((select public.get_staff_analytics('30D',null,null))->'customers'->>'active')::integer,2,'staff aggregate counts active customers');
select is(((select public.get_staff_analytics('30D',null,null))->'onboarding'->>'active')::integer,1,'staff aggregate counts real active onboarding');
select is(((select public.get_staff_analytics('30D',null,'b8000000-0000-4000-8000-000000000002'))->'onboarding'->>'active')::integer,0,'product filter excludes other-product onboarding');
select is(((select public.get_staff_analytics('30D',null,'b8000000-0000-4000-8000-000000000001'))->'customers'->>'active')::integer,1,'product filter counts only subscribed active customers');
select is(jsonb_array_length((select public.get_customer_success_portfolio(25,null,null,null,null))->'data'),2,'portfolio returns both active customers');
select is(((select public.get_customer_success_portfolio(25,'Analytics Customer A',null,null,null))->'data'->0->>'healthScore')::numeric,72::numeric,'portfolio uses the latest real health score');
select is(((select public.get_staff_analytics('30D',null,null))->'support'->'averageFirstResponseMinutes')::text,'null','empty averages remain null instead of fabricated zero');

reset role;
select ok(has_function_privilege('postgres','private.analytics_cutoff(text)','EXECUTE'),'database owner retains private helper ownership');

select * from finish();
rollback;
