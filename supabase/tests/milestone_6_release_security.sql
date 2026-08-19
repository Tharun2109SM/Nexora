begin;
select plan(47);

insert into auth.users(id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data) values
('96000000-0000-4000-8000-000000000001','authenticated','authenticated','release-admin@test','x','{"nexora_account_type":"BEAUROI"}','{"full_name":"Release Admin"}'),
('96000000-0000-4000-8000-000000000002','authenticated','authenticated','release-employee@test','x','{"nexora_account_type":"BEAUROI"}','{"full_name":"Release Employee"}'),
('96000000-0000-4000-8000-000000000003','authenticated','authenticated','release-a@test','x','{"nexora_account_type":"BEAUROI"}','{"full_name":"Release Customer A"}'),
('96000000-0000-4000-8000-000000000004','authenticated','authenticated','release-b@test','x','{"nexora_account_type":"BEAUROI"}','{"full_name":"Release Customer B"}');
insert into public.organizations(id,name,slug,organization_type) values
('a6000000-0000-4000-8000-000000000001','Release Beau Roi','release-beau-roi','BEAUROI'),
('a6000000-0000-4000-8000-000000000002','Release Customer A','release-customer-a','CUSTOMER'),
('a6000000-0000-4000-8000-000000000003','Release Customer B','release-customer-b','CUSTOMER');
insert into public.organization_memberships(organization_id,user_id,role,status,is_primary,joined_at) values
('a6000000-0000-4000-8000-000000000001','96000000-0000-4000-8000-000000000001','BEAUROI_ADMIN','ACTIVE',true,now()),
('a6000000-0000-4000-8000-000000000001','96000000-0000-4000-8000-000000000002','BEAUROI_EMPLOYEE','ACTIVE',true,now()),
('a6000000-0000-4000-8000-000000000002','96000000-0000-4000-8000-000000000003','CUSTOMER_ADMIN','ACTIVE',true,now()),
('a6000000-0000-4000-8000-000000000003','96000000-0000-4000-8000-000000000004','CUSTOMER_MEMBER','ACTIVE',true,now());
insert into public.products(id,code,name,status) values
('b6000000-0000-4000-8000-000000000001','RELEASE_ONE','Release Product One','ACTIVE'),
('b6000000-0000-4000-8000-000000000002','RELEASE_TWO','Release Product Two','ACTIVE');
insert into public.customer_subscriptions(organization_id,product_id,status) values
('a6000000-0000-4000-8000-000000000002','b6000000-0000-4000-8000-000000000001','ACTIVE'),
('a6000000-0000-4000-8000-000000000003','b6000000-0000-4000-8000-000000000001','ACTIVE'),
('a6000000-0000-4000-8000-000000000003','b6000000-0000-4000-8000-000000000002','ACTIVE');
insert into public.feedback(id,organization_id,product_id,submitted_by,title,description,category,status,is_public)
values
('f6000000-0000-4000-8000-000000000001','a6000000-0000-4000-8000-000000000002','b6000000-0000-4000-8000-000000000001','96000000-0000-4000-8000-000000000003','Planned release feature','Approved customer capability','FEATURE_REQUEST','PLANNED',true),
('f6000000-0000-4000-8000-000000000002','a6000000-0000-4000-8000-000000000003','b6000000-0000-4000-8000-000000000002','96000000-0000-4000-8000-000000000004','Other product feature','Approved for another product','FEATURE_REQUEST','PLANNED',true);
insert into public.feature_requests(organization_id,feedback_id,problem_statement,desired_outcome,status)
values
('a6000000-0000-4000-8000-000000000002','f6000000-0000-4000-8000-000000000001','A product gap','Ship the planned capability','PLANNED'),
('a6000000-0000-4000-8000-000000000003','f6000000-0000-4000-8000-000000000002','Another product gap','Ship elsewhere','PLANNED');

select ok(not has_table_privilege('authenticated','public.product_releases','INSERT'),'direct release insert is revoked');
select ok(not has_table_privilege('authenticated','public.product_releases','UPDATE'),'direct release update is revoked');
select ok(not has_table_privilege('authenticated','public.product_releases','DELETE'),'release deletion is revoked');
select ok(not has_table_privilege('authenticated','public.release_targets','INSERT'),'direct target mutation is revoked');
select ok(not has_table_privilege('authenticated','public.release_events','INSERT'),'release event forgery is revoked');
select ok(not has_table_privilege('authenticated','public.maintenance_notices','INSERT'),'direct maintenance insert is revoked');
select ok(not has_function_privilege('authenticated','private.assert_release_admin()','EXECUTE'),'private admin helper is hidden');
select ok(not has_function_privilege('authenticated','private.release_event_notifications()','EXECUTE'),'private notification helper is hidden');
select ok(has_function_privilege('authenticated','public.create_release_draft(uuid,text,text,text,text)','EXECUTE'),'narrow release RPC is exposed');
select ok(has_function_privilege('authenticated','public.transition_maintenance(uuid,text)','EXECUTE'),'narrow maintenance RPC is exposed');

set local role authenticated;
set local request.jwt.claims='{"sub":"96000000-0000-4000-8000-000000000002","role":"authenticated"}';
select throws_ok($$select public.create_release_draft('b6000000-0000-4000-8000-000000000001','1.0.0','Employee draft',null,null)$$,'42501','Release management requires an active Beau Roi administrator','ordinary Beau Roi employee cannot create releases');

reset role; set local role authenticated;
set local request.jwt.claims='{"sub":"96000000-0000-4000-8000-000000000001","role":"authenticated"}';
select lives_ok($$select public.create_release_draft('b6000000-0000-4000-8000-000000000001','1.0.0','Secure release','Release summary','General notes')$$,'administrator creates release draft');
select is((select release_status from public.product_releases where version='1.0.0'),'DRAFT','release begins as draft');
select lives_ok($$select public.upsert_release_section((select id from public.product_releases where version='1.0.0'),null,'NEW_FEATURE','New capability','A safe structured section',0)$$,'administrator adds structured notes');
select throws_ok($$select public.set_release_audience((select id from public.product_releases where version='1.0.0'),'SELECTED_ORGANIZATIONS',array['a6000000-0000-4000-8000-000000000001']::uuid[])$$,'23514','Audience contains ineligible organizations: a6000000-0000-4000-8000-000000000001','non-customer target is rejected');
select lives_ok($$select public.set_release_audience((select id from public.product_releases where version='1.0.0'),'SELECTED_ORGANIZATIONS',array['a6000000-0000-4000-8000-000000000002']::uuid[])$$,'administrator sets selected audience');
select lives_ok($$select public.transition_release((select id from public.product_releases where version='1.0.0'),'SCHEDULED',now()+interval '2 days')$$,'administrator schedules release');
select lives_ok($$select public.link_release_feedback((select id from public.product_releases where version='1.0.0'),'f6000000-0000-4000-8000-000000000001')$$,'administrator links an accepted feature request for the same product');
select throws_ok($$select public.link_release_feedback((select id from public.product_releases where version='1.0.0'),'f6000000-0000-4000-8000-000000000002')$$,'23514','An accepted feature request for this product is required','cross-product feature link is rejected');
select is((select status from public.product_releases where version='1.0.0'),'PAUSED','legacy release lifecycle mirror remains compatible');
reset role; set local role authenticated;
set local request.jwt.claims='{"sub":"96000000-0000-4000-8000-000000000003","role":"authenticated"}';
select is((select count(*)::integer from public.product_releases),1,'targeted customer sees scheduled release');
select is((select count(*)::integer from public.release_note_sections),1,'targeted customer sees structured release notes');
select is((select count(*)::integer from public.release_targets),0,'customer cannot inspect private rollout targets');
select ok(exists(select 1 from public.notifications where category='RELEASE'),'eligible customer receives scheduled notification');
select throws_ok($$insert into public.product_releases(product_id,version,title) values('b6000000-0000-4000-8000-000000000001','9.9.9','Forged')$$,'42501',null,'customer cannot bypass release RPC');

reset role; set local role authenticated;
set local request.jwt.claims='{"sub":"96000000-0000-4000-8000-000000000004","role":"authenticated"}';
select is((select count(*)::integer from public.product_releases),0,'non-target subscriber cannot see selected release');
select is((select count(*)::integer from public.notifications),0,'ineligible customer receives no release notification');

reset role; set local role authenticated;
set local request.jwt.claims='{"sub":"96000000-0000-4000-8000-000000000001","role":"authenticated"}';
select lives_ok($$select public.transition_release((select id from public.product_releases where version='1.0.0'),'PUBLISHED',null)$$,'administrator explicitly publishes release');
select throws_ok($$select public.update_release_content((select id from public.product_releases where version='1.0.0'),'Rewritten published title',null,null)$$,'23514','Published release content is immutable','published release content is protected');
select throws_ok($$select public.set_release_audience((select id from public.product_releases where version='1.0.0'),'ALL_SUBSCRIBERS','{}')$$,'23514','Published release audience is immutable','published audience is protected');
select lives_ok($$select public.create_maintenance_draft('b6000000-0000-4000-8000-000000000001','Planned maintenance','Database maintenance',now()+interval '3 days',now()+interval '3 days 2 hours')$$,'administrator creates maintenance draft');
select lives_ok($$select public.set_maintenance_audience((select id from public.maintenance_notices where title='Planned maintenance'),'SELECTED_ORGANIZATIONS',array['a6000000-0000-4000-8000-000000000002']::uuid[])$$,'administrator targets maintenance');
select lives_ok($$select public.transition_maintenance((select id from public.maintenance_notices where title='Planned maintenance'),'SCHEDULED')$$,'administrator schedules maintenance');
select lives_ok($$select public.update_maintenance_content((select id from public.maintenance_notices where title='Planned maintenance'),'Planned maintenance','Updated database maintenance',now()+interval '3 days',now()+interval '3 days 3 hours')$$,'administrator can update scheduled maintenance content');
reset role;
select ok(exists(select 1 from public.notifications where title='Maintenance updated' and organization_id='a6000000-0000-4000-8000-000000000002'),'eligible customer receives maintenance update notification');
set local role authenticated;
set local request.jwt.claims='{"sub":"96000000-0000-4000-8000-000000000001","role":"authenticated"}';
select ok(exists(select 1 from public.audit_events where action='release.status_changed'),'release status mutation is audited');
select ok(exists(select 1 from public.audit_events where action='maintenance.status_changed'),'maintenance status mutation is audited');

reset role; set local role authenticated;
set local request.jwt.claims='{"sub":"96000000-0000-4000-8000-000000000003","role":"authenticated"}';
select is((select count(*)::integer from public.maintenance_notices),1,'eligible customer sees scheduled maintenance');
select ok(not exists(select 1 from public.release_events where not customer_visible),'customer cannot read private release history');

reset role; set local role authenticated;
set local request.jwt.claims='{"sub":"96000000-0000-4000-8000-000000000004","role":"authenticated"}';
select is((select count(*)::integer from public.maintenance_notices),0,'ineligible customer cannot see targeted maintenance');

reset role; set local role authenticated;
set local request.jwt.claims='{"sub":"96000000-0000-4000-8000-000000000001","role":"authenticated"}';
select lives_ok($$select public.transition_maintenance((select id from public.maintenance_notices where title='Planned maintenance'),'ACTIVE')$$,'maintenance can become active');
select lives_ok($$select public.transition_maintenance((select id from public.maintenance_notices where title='Planned maintenance'),'COMPLETED')$$,'active maintenance can complete');
select throws_ok($$select public.transition_release((select id from public.product_releases where version='1.0.0'),'DRAFT',null)$$,'23514','Invalid release lifecycle transition','published release cannot return to draft');
select throws_ok($$update public.release_events set event_type='ARCHIVED'$$,'42501',null,'authenticated caller cannot alter release history');
select lives_ok($$select public.transition_release((select id from public.product_releases where version='1.0.0'),'ARCHIVED',null)$$,'published release can be archived');

reset role;
select lives_ok($$delete from public.product_releases where product_id='b6000000-0000-4000-8000-000000000001'$$,'database owner cleanup and cascades remain operational');
select is((select count(*)::integer from public.product_releases where product_id='b6000000-0000-4000-8000-000000000001'),0,'trusted cascade removes release records');

select * from finish();
rollback;
