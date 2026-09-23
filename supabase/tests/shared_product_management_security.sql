begin;
select no_plan();

insert into auth.users(id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data) values
('9a000000-0000-4000-8000-000000000001','authenticated','authenticated','shared-admin@test','x','{"nexora_account_type":"BEAUROI"}','{"full_name":"Shared Admin"}'),
('9a000000-0000-4000-8000-000000000002','authenticated','authenticated','shared-employee@test','x','{"nexora_account_type":"BEAUROI"}','{"full_name":"Shared Employee"}'),
('9a000000-0000-4000-8000-000000000003','authenticated','authenticated','shared-customer-a@test','x','{}','{"full_name":"Customer A"}'),
('9a000000-0000-4000-8000-000000000004','authenticated','authenticated','shared-customer-b@test','x','{}','{"full_name":"Customer B"}');
insert into public.organizations(id,name,slug,organization_type) values
('9b000000-0000-4000-8000-000000000001','Shared Beau Roi','shared-beau-roi','BEAUROI'),
('9b000000-0000-4000-8000-000000000002','Shared Customer A','shared-customer-a','CUSTOMER'),
('9b000000-0000-4000-8000-000000000003','Shared Customer B','shared-customer-b','CUSTOMER');
insert into public.organization_memberships(organization_id,user_id,role,status,joined_at) values
('9b000000-0000-4000-8000-000000000001','9a000000-0000-4000-8000-000000000001','BEAUROI_ADMIN','ACTIVE',now()),
('9b000000-0000-4000-8000-000000000001','9a000000-0000-4000-8000-000000000002','BEAUROI_EMPLOYEE','ACTIVE',now()),
('9b000000-0000-4000-8000-000000000002','9a000000-0000-4000-8000-000000000003','CUSTOMER_ADMIN','ACTIVE',now()),
('9b000000-0000-4000-8000-000000000003','9a000000-0000-4000-8000-000000000004','CUSTOMER_ADMIN','ACTIVE',now());

select ok(not has_table_privilege('authenticated','public.products','UPDATE'),'catalog still denies direct update');
select ok(not has_table_privilege('authenticated','public.customer_subscriptions','UPDATE'),'assignments still deny direct update');
select ok(not has_function_privilege('anon','public.update_product(uuid,text,text)','EXECUTE'),'anon cannot edit catalog');
select ok(not has_function_privilege('anon','public.set_product_archived(uuid,boolean)','EXECUTE'),'anon cannot archive catalog');
select ok(not has_function_privilege('anon','public.set_customer_product_active(uuid,uuid,boolean)','EXECUTE'),'anon cannot alter assignment');

set local role authenticated;
set local request.jwt.claims='{"sub":"9a000000-0000-4000-8000-000000000002","role":"authenticated"}';
select throws_ok($$select public.update_product('9c000000-0000-4000-8000-000000000001','Unauthorized',null)$$,'42501',null,'employee cannot edit product');
select throws_ok($$select public.set_product_archived('9c000000-0000-4000-8000-000000000001',true)$$,'42501',null,'employee cannot archive product');
select throws_ok($$select public.set_customer_product_active('9b000000-0000-4000-8000-000000000002','9c000000-0000-4000-8000-000000000001',true)$$,'42501',null,'employee cannot assign product');

set local request.jwt.claims='{"sub":"9a000000-0000-4000-8000-000000000001","role":"authenticated"}';
select lives_ok($$select public.create_product('SHARED_A','Shared Product A',null)$$,'admin creates catalog product');
select lives_ok($$select public.create_product('SHARED_B','Shared Product B',null)$$,'admin creates second catalog product');
select lives_ok($$select public.update_product((select id from public.products where code='SHARED_A'),'Shared Product A Updated','Shared description')$$,'admin edits catalog product');
select is((select updated_by from public.products where code='SHARED_A'),'9a000000-0000-4000-8000-000000000001'::uuid,'update actor is recorded');
select lives_ok($$select public.activate_customer_product('9b000000-0000-4000-8000-000000000002',(select id from public.products where code='SHARED_A'))$$,'admin assigns product to customer A');
select throws_ok($$select public.activate_customer_product('9b000000-0000-4000-8000-000000000002',(select id from public.products where code='SHARED_A'))$$,'23505',null,'duplicate customer-product pair is rejected');
select throws_ok($$insert into public.onboarding_plans(organization_id,product_id,name) values('9b000000-0000-4000-8000-000000000003',(select id from public.products where code='SHARED_A'),'Wrong org')$$,'23514',null,'wrong-organization onboarding product is rejected');
select throws_ok($$insert into public.implementation_projects(organization_id,product_id,name) values('9b000000-0000-4000-8000-000000000003',(select id from public.products where code='SHARED_A'),'Wrong org')$$,'23514',null,'wrong-organization implementation product is rejected');
select lives_ok($$insert into public.onboarding_plans(organization_id,product_id,name) values('9b000000-0000-4000-8000-000000000002',(select id from public.products where code='SHARED_A'),'Shared onboarding')$$,'eligible onboarding creation works');
select lives_ok($$insert into public.implementation_projects(organization_id,product_id,name) values('9b000000-0000-4000-8000-000000000002',(select id from public.products where code='SHARED_A'),'Shared implementation')$$,'eligible implementation creation works');

set local request.jwt.claims='{"sub":"9a000000-0000-4000-8000-000000000003","role":"authenticated"}';
select is((select count(*)::integer from public.products where code='SHARED_A'),1,'customer A can read assigned product');
select is((select count(*)::integer from public.products where code='SHARED_B'),0,'customer A cannot read unassigned product');
set local request.jwt.claims='{"sub":"9a000000-0000-4000-8000-000000000004","role":"authenticated"}';
select is((select count(*)::integer from public.products where code='SHARED_A'),0,'customer B cannot read customer A product');
select is((select count(*)::integer from public.onboarding_plans where name='Shared onboarding'),0,'customer B cannot read customer A onboarding');

set local request.jwt.claims='{"sub":"9a000000-0000-4000-8000-000000000001","role":"authenticated"}';
select lives_ok($$select public.set_product_archived((select id from public.products where code='SHARED_A'),true)$$,'admin archives product');
select throws_ok($$insert into public.onboarding_plans(organization_id,product_id,name) values('9b000000-0000-4000-8000-000000000002',(select id from public.products where code='SHARED_A'),'New archived onboarding')$$,'23514',null,'archived product cannot start onboarding');
select throws_ok($$insert into public.implementation_projects(organization_id,product_id,name) values('9b000000-0000-4000-8000-000000000002',(select id from public.products where code='SHARED_A'),'New archived implementation')$$,'23514',null,'archived product cannot start implementation');
select lives_ok($$update public.onboarding_plans set customer_update='Progress continues' where name='Shared onboarding'$$,'existing onboarding remains editable after archival');
select lives_ok($$update public.implementation_projects set customer_update='Delivery continues' where name='Shared implementation'$$,'existing implementation remains editable after archival');
select throws_ok($$select public.set_customer_product_active('9b000000-0000-4000-8000-000000000002',(select id from public.products where code='SHARED_A'),true)$$,'23514',null,'archived product cannot be reactivated for customer');
select lives_ok($$select public.set_product_archived((select id from public.products where code='SHARED_A'),false)$$,'admin restores product');
select lives_ok($$select public.set_customer_product_active('9b000000-0000-4000-8000-000000000002',(select id from public.products where code='SHARED_A'),false)$$,'admin deactivates customer assignment');
select throws_ok($$insert into public.onboarding_plans(organization_id,product_id,name) values('9b000000-0000-4000-8000-000000000002',(select id from public.products where code='SHARED_A'),'New inactive onboarding')$$,'23514',null,'inactive assignment blocks new onboarding');
select lives_ok($$update public.onboarding_plans set customer_update='Progress after deactivation' where name='Shared onboarding'$$,'existing onboarding remains editable after assignment deactivation');
select lives_ok($$select public.set_customer_product_active('9b000000-0000-4000-8000-000000000002',(select id from public.products where code='SHARED_A'),true)$$,'admin reactivates preserved assignment');
select is((select count(*)::integer from public.customer_subscriptions where organization_id='9b000000-0000-4000-8000-000000000002'),1,'reactivation does not duplicate assignment');

reset role;
set local session_replication_role=replica;
insert into public.onboarding_plans(organization_id,product_id,name,workflow_status) values('9b000000-0000-4000-8000-000000000002',null,'Legacy onboarding without product','DRAFT');
insert into public.implementation_projects(organization_id,product_id,name,workflow_status,phase) values('9b000000-0000-4000-8000-000000000002',null,'Legacy implementation without product','DRAFT','DISCOVERY');
set local session_replication_role=origin;
select is((select product_name from public.onboarding_portfolio where name='Legacy onboarding without product'),'No product linked','legacy onboarding stays visible');
select is((select product_name from public.implementation_portfolio where name='Legacy implementation without product'),'No product linked','legacy implementation stays visible');
set local role authenticated;
set local request.jwt.claims='{"sub":"9a000000-0000-4000-8000-000000000001","role":"authenticated"}';
select lives_ok($$update public.onboarding_plans set customer_update='Legacy unrelated edit' where name='Legacy onboarding without product'$$,'legacy onboarding unrelated edit remains possible');
select lives_ok($$update public.implementation_projects set customer_update='Legacy unrelated edit' where name='Legacy implementation without product'$$,'legacy implementation unrelated edit remains possible');

select * from finish();
rollback;
