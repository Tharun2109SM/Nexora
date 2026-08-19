begin;
select plan(48);

insert into auth.users (id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data) values
('95000000-0000-4000-8000-000000000001','authenticated','authenticated','feedback-admin@test','x','{"nexora_account_type":"BEAUROI"}','{"full_name":"Feedback Admin"}'),
('95000000-0000-4000-8000-000000000002','authenticated','authenticated','feedback-csm@test','x','{"nexora_account_type":"BEAUROI"}','{"full_name":"Assigned CSM"}'),
('95000000-0000-4000-8000-000000000003','authenticated','authenticated','feedback-unassigned@test','x','{"nexora_account_type":"BEAUROI"}','{"full_name":"Unassigned Staff"}'),
('95000000-0000-4000-8000-000000000004','authenticated','authenticated','feedback-wrong@test','x','{"nexora_account_type":"BEAUROI"}','{"full_name":"Wrong Scope Staff"}'),
('95000000-0000-4000-8000-000000000005','authenticated','authenticated','feedback-a@test','x','{"nexora_account_type":"BEAUROI"}','{"full_name":"Customer A"}'),
('95000000-0000-4000-8000-000000000006','authenticated','authenticated','feedback-b@test','x','{"nexora_account_type":"BEAUROI"}','{"full_name":"Customer B"}');

insert into public.organizations(id,name,slug,organization_type) values
('a5000000-0000-4000-8000-000000000001','Feedback Beau Roi','feedback-beau-roi','BEAUROI'),
('a5000000-0000-4000-8000-000000000002','Feedback Customer A','feedback-customer-a','CUSTOMER'),
('a5000000-0000-4000-8000-000000000003','Feedback Customer B','feedback-customer-b','CUSTOMER');
insert into public.organization_memberships(organization_id,user_id,role,status,is_primary,joined_at) values
('a5000000-0000-4000-8000-000000000001','95000000-0000-4000-8000-000000000001','BEAUROI_ADMIN','ACTIVE',true,now()),
('a5000000-0000-4000-8000-000000000001','95000000-0000-4000-8000-000000000002','BEAUROI_EMPLOYEE','ACTIVE',true,now()),
('a5000000-0000-4000-8000-000000000001','95000000-0000-4000-8000-000000000003','BEAUROI_EMPLOYEE','ACTIVE',true,now()),
('a5000000-0000-4000-8000-000000000001','95000000-0000-4000-8000-000000000004','BEAUROI_EMPLOYEE','ACTIVE',true,now()),
('a5000000-0000-4000-8000-000000000002','95000000-0000-4000-8000-000000000005','CUSTOMER_ADMIN','ACTIVE',true,now()),
('a5000000-0000-4000-8000-000000000003','95000000-0000-4000-8000-000000000006','CUSTOMER_MEMBER','ACTIVE',true,now());
insert into public.products(id,code,name,status) values
('b5000000-0000-4000-8000-000000000001','FEEDBACK_ONE','Feedback Product One','ACTIVE'),
('b5000000-0000-4000-8000-000000000002','FEEDBACK_TWO','Feedback Product Two','ACTIVE');
insert into public.customer_subscriptions(organization_id,product_id,status) values
('a5000000-0000-4000-8000-000000000002','b5000000-0000-4000-8000-000000000001','ACTIVE'),
('a5000000-0000-4000-8000-000000000003','b5000000-0000-4000-8000-000000000001','ACTIVE'),
('a5000000-0000-4000-8000-000000000003','b5000000-0000-4000-8000-000000000002','ACTIVE');
set session_replication_role=replica;
insert into public.customer_assignments(id,organization_id,product_id,employee_user_id,assignment_type,is_active,assigned_at,ended_at) values
('c5000000-0000-4000-8000-000000000001','a5000000-0000-4000-8000-000000000002','b5000000-0000-4000-8000-000000000001','95000000-0000-4000-8000-000000000002','CSM',true,now(),null),
('c5000000-0000-4000-8000-000000000002','a5000000-0000-4000-8000-000000000003',null,'95000000-0000-4000-8000-000000000004','CSM',true,now(),null);
set session_replication_role=origin;

select ok(not has_table_privilege('authenticated','public.feedback','INSERT'),'direct feedback insert is revoked');
select ok(not has_table_privilege('authenticated','public.feedback','UPDATE'),'direct feedback update is revoked');
select ok(not has_table_privilege('authenticated','public.feedback','DELETE'),'feedback deletion is revoked');
select ok(not has_table_privilege('authenticated','public.feedback_messages','INSERT'),'direct message insert is revoked');
select ok(not has_table_privilege('authenticated','public.feedback_events','INSERT'),'event forgery is revoked');
select ok(not has_table_privilege('authenticated','public.feature_votes','SELECT'),'raw voter identities are not selectable');
select ok(not has_table_privilege('authenticated','public.feature_votes','INSERT'),'direct vote insert is revoked');
select ok(has_function_privilege('authenticated','public.create_feedback(uuid,uuid,text,text,text,text,text,text,text)','EXECUTE'),'creation RPC is exposed narrowly');
select ok(has_function_privilege('authenticated','public.vote_feature_request(uuid)','EXECUTE'),'vote RPC is exposed narrowly');
select ok(not has_function_privilege('authenticated','private.cast_feature_vote(uuid,boolean)','EXECUTE'),'private vote helper is hidden');
select ok(not has_function_privilege('authenticated','private.create_feedback_event_notifications()','EXECUTE'),'private notification trigger is hidden');

set local role authenticated;
set local request.jwt.claims='{"sub":"95000000-0000-4000-8000-000000000005","role":"authenticated"}';
select lives_ok($$select public.create_feedback('a5000000-0000-4000-8000-000000000002','b5000000-0000-4000-8000-000000000001','GENERAL','General feedback','General feedback detail')$$,'customer creates general feedback');
select lives_ok($$select public.create_feedback('a5000000-0000-4000-8000-000000000002','b5000000-0000-4000-8000-000000000001','BUG','Bug feedback','Bug feedback detail','Steps','Browser',null,null)$$,'customer creates bug without trusted severity input');
select lives_ok($$select public.create_feedback('a5000000-0000-4000-8000-000000000002','b5000000-0000-4000-8000-000000000001','FEATURE_REQUEST','Feature feedback','Feature feedback detail',null,null,'Manual workflow is slow','Automate workflow')$$,'customer creates feature request');
select is((select count(*)::integer from public.feedback),3,'customer reads its three submissions');
select is((select severity from public.bug_reports limit 1),'MEDIUM','customer bug receives safe default severity');
select ok(not exists(select 1 from public.feedback where is_public),'new feature request is private by default');
select throws_ok($$select public.create_feedback('a5000000-0000-4000-8000-000000000003','b5000000-0000-4000-8000-000000000001','GENERAL','Forged feedback','No access')$$,'42501','Active customer organization membership is required','organization spoofing is rejected');
select throws_ok($$select public.create_feedback('a5000000-0000-4000-8000-000000000002','b5000000-0000-4000-8000-000000000002','GENERAL','Wrong product','No subscription')$$,'23514','Feedback requires an active subscribed product','product scope spoofing is rejected');
select throws_ok($$select public.add_feedback_message((select id from public.feedback where category='GENERAL'),'Forged internal',true)$$,'42501','Customer users cannot create internal notes','customer cannot add internal notes');
select lives_ok($$select public.add_feedback_message((select id from public.feedback where category='GENERAL'),'Customer follow-up',false)$$,'customer adds visible response');
select throws_ok($$select public.update_feedback_status((select id from public.feedback where category='GENERAL'),'UNDER_REVIEW')$$,'42501','An active feedback assignment is required','customer cannot change workflow status');

reset role; set local role authenticated;
set local request.jwt.claims='{"sub":"95000000-0000-4000-8000-000000000006","role":"authenticated"}';
select is((select count(*)::integer from public.feedback),0,'other customer cannot read private feedback');
select throws_ok($$select public.vote_feature_request((select id from public.feedback where category='FEATURE_REQUEST'))$$,'P0001','Feature request is unavailable','other customer cannot vote on private request');

reset role; set local role authenticated;
set local request.jwt.claims='{"sub":"95000000-0000-4000-8000-000000000003","role":"authenticated"}';
select throws_ok($$select public.update_feedback_status((select id from public.feedback where category='GENERAL'),'UNDER_REVIEW')$$,'42501','An active feedback assignment is required','unassigned employee cannot mutate feedback');
select throws_ok($$select public.add_feedback_message((select id from public.feedback where category='GENERAL'),'Unassigned note',true)$$,'42501','Feedback access is unavailable','unassigned employee cannot add internal note');

reset role; set local role authenticated;
set local request.jwt.claims='{"sub":"95000000-0000-4000-8000-000000000004","role":"authenticated"}';
select throws_ok($$select public.update_feedback_status((select id from public.feedback where category='GENERAL'),'UNDER_REVIEW')$$,'42501','An active feedback assignment is required','wrong-organization employee cannot mutate feedback');

reset role; set local role authenticated;
set local request.jwt.claims='{"sub":"95000000-0000-4000-8000-000000000002","role":"authenticated"}';
select lives_ok($$select public.update_feedback_status((select id from public.feedback where category='GENERAL'),'UNDER_REVIEW')$$,'assigned CSM can progress feedback');
select lives_ok($$select public.add_feedback_message((select id from public.feedback where category='GENERAL'),'PRIVATE TRIAGE NOTE',true)$$,'assigned CSM adds internal note');
select lives_ok($$select public.add_feedback_message((select id from public.feedback where category='GENERAL'),'Customer-visible staff update',false)$$,'assigned CSM publishes visible response');
select lives_ok($$select public.update_feedback_triage((select id from public.feedback where category='FEATURE_REQUEST'),'HIGH',null,true)$$,'assigned CSM publishes feature request');
select ok(exists(select 1 from public.notifications where category='FEEDBACK' and link_path like '/beauroi/feedback/%'),'safe staff feedback notifications are generated');
select ok(not exists(select 1 from public.notifications where body like '%PRIVATE TRIAGE%' or title like '%PRIVATE TRIAGE%'),'internal note content never enters notifications');

reset role; set local role authenticated;
set local request.jwt.claims='{"sub":"95000000-0000-4000-8000-000000000006","role":"authenticated"}';
select is((select count(*)::integer from public.feedback),1,'eligible other customer discovers only published feature request');
select lives_ok($$select public.vote_feature_request((select id from public.feedback where category='FEATURE_REQUEST'))$$,'eligible customer votes on public feature');
select is((select vote_count::integer from public.get_feature_vote_summary((select id from public.feedback where category='FEATURE_REQUEST'))),1,'vote count is server-derived');
select is((select public.vote_feature_request((select id from public.feedback where category='FEATURE_REQUEST'))),false,'duplicate vote is idempotently ignored');
select throws_ok($$select count(*) from public.feature_votes$$,'42501',null,'raw vote table remains unreadable to authenticated caller');
select lives_ok($$select public.unvote_feature_request((select id from public.feedback where category='FEATURE_REQUEST'))$$,'customer removes own vote');
select is((select vote_count::integer from public.get_feature_vote_summary((select id from public.feedback where category='FEATURE_REQUEST'))),0,'vote count returns to zero');

reset role; set local role authenticated;
set local request.jwt.claims='{"sub":"95000000-0000-4000-8000-000000000005","role":"authenticated"}';
select is((select count(*)::integer from public.feedback_messages where body='PRIVATE TRIAGE NOTE'),0,'customer cannot read internal triage note');
select is((select count(*)::integer from public.feedback_messages where body='Customer-visible staff update'),1,'customer reads staff customer-visible response');
select ok(not exists(select 1 from public.feedback_events where not customer_visible),'customer cannot read private events');

reset role; set local role authenticated;
set local request.jwt.claims='{"sub":"95000000-0000-4000-8000-000000000001","role":"authenticated"}';
select lives_ok($$select public.update_feedback_status((select id from public.feedback where category='BUG'),'UNDER_REVIEW')$$,'Beau Roi administrator override works');
select lives_ok($$select public.update_feedback_triage((select id from public.feedback where category='BUG'),'URGENT','CRITICAL',false)$$,'administrator triages bug severity');
select is((select severity from public.bug_reports where feedback_id=(select id from public.feedback where category='BUG')),'CRITICAL','staff severity persists');

reset role;
select lives_ok($$delete from public.organizations where id='a5000000-0000-4000-8000-000000000002'$$,'database owner cleanup and foreign-key cascades remain operational');
select is((select count(*)::integer from public.feedback where organization_id='a5000000-0000-4000-8000-000000000002'),0,'trusted cascade removes dependent feedback records');

select * from finish();
rollback;
