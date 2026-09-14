begin;
select plan(32);

insert into auth.users(id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data) values
('99000000-0000-4000-8000-000000000001','authenticated','authenticated','product-admin@test','x','{"nexora_account_type":"BEAUROI"}','{"full_name":"Product Admin"}'),
('99000000-0000-4000-8000-000000000002','authenticated','authenticated','product-employee@test','x','{"nexora_account_type":"BEAUROI"}','{"full_name":"Product Employee"}'),
('99000000-0000-4000-8000-000000000003','authenticated','authenticated','product-customer@test','x','{}','{"full_name":"Product Customer"}'),
('99000000-0000-4000-8000-000000000004','authenticated','authenticated','product-unassigned@test','x','{}','{"full_name":"Unassigned User"}');

insert into public.organizations(id,name,slug,organization_type) values
('a9000000-0000-4000-8000-000000000001','Product Beau Roi','product-beau-roi','BEAUROI'),
('a9000000-0000-4000-8000-000000000002','Product Customer','product-customer','CUSTOMER');

insert into public.organization_memberships(organization_id,user_id,role,status,is_primary,joined_at) values
('a9000000-0000-4000-8000-000000000001','99000000-0000-4000-8000-000000000001','BEAUROI_ADMIN','ACTIVE',true,now()),
('a9000000-0000-4000-8000-000000000001','99000000-0000-4000-8000-000000000002','BEAUROI_EMPLOYEE','ACTIVE',true,now()),
('a9000000-0000-4000-8000-000000000002','99000000-0000-4000-8000-000000000003','CUSTOMER_ADMIN','ACTIVE',true,now());

select ok(not has_table_privilege('authenticated','public.products','INSERT'),'authenticated direct product insert is revoked');
select ok(not has_table_privilege('authenticated','public.products','UPDATE'),'authenticated direct product update is revoked');
select ok(not has_table_privilege('authenticated','public.products','DELETE'),'authenticated direct product delete is revoked');
select ok(not has_function_privilege('anon','public.create_product(text,text,text)','EXECUTE'),'anon cannot call product creation');
select ok(has_function_privilege('authenticated','public.create_product(text,text,text)','EXECUTE'),'authenticated can reach the guarded product RPC');
select ok(not has_table_privilege('authenticated','public.customer_subscriptions','INSERT'),'direct subscription insert is revoked');
select ok(not has_table_privilege('authenticated','public.customer_subscriptions','UPDATE'),'direct subscription update is revoked');
select ok(not has_function_privilege('anon','public.activate_customer_product(uuid,uuid)','EXECUTE'),'anon cannot provision customer products');

set local role authenticated;
set local request.jwt.claims='{"sub":"99000000-0000-4000-8000-000000000002","role":"authenticated"}';
select throws_ok($$select public.create_product('EMPLOYEE_PRODUCT','Employee product',null)$$,'42501','Product creation requires an active Beau Roi administrator','ordinary Beau Roi employee cannot create a product');
select throws_ok($$select public.activate_customer_product('a9000000-0000-4000-8000-000000000002','b7000000-0000-4000-8000-000000000001')$$,'42501','Customer product provisioning requires an active Beau Roi administrator','ordinary employee cannot provision a product');

reset role; set local role authenticated;
set local request.jwt.claims='{"sub":"99000000-0000-4000-8000-000000000003","role":"authenticated"}';
select throws_ok($$select public.create_product('CUSTOMER_PRODUCT','Customer product',null)$$,'42501','Product creation requires an active Beau Roi administrator','customer administrator cannot create a product');
select throws_ok($$select public.activate_customer_product('a9000000-0000-4000-8000-000000000002','b7000000-0000-4000-8000-000000000001')$$,'42501','Customer product provisioning requires an active Beau Roi administrator','customer administrator cannot provision a product');

reset role; set local role authenticated;
set local request.jwt.claims='{"sub":"99000000-0000-4000-8000-000000000004","role":"authenticated"}';
select throws_ok($$select public.create_product('UNASSIGNED_PRODUCT','Unassigned product',null)$$,'42501','Product creation requires an active Beau Roi administrator','unassigned user cannot create a product');

reset role; set local role authenticated;
set local request.jwt.claims='{"sub":"99000000-0000-4000-8000-000000000001","role":"authenticated"}';
select lives_ok($$select public.create_product(' nexora_ops ',' Nexora Operations ','  Governed product operations  ')$$,'Beau Roi administrator creates a product');
select is((select code from public.products where name='Nexora Operations'),'NEXORA_OPS','product code is normalized to uppercase');
select is((select description from public.products where code='NEXORA_OPS'),'Governed product operations','product description is normalized');
select is((select status::text from public.products where code='NEXORA_OPS'),'ACTIVE','new product is immediately selectable');
select is((select created_by from public.products where code='NEXORA_OPS'),'99000000-0000-4000-8000-000000000001'::uuid,'creator identity comes from auth.uid');
select ok(exists(select 1 from public.audit_events where entity_type='product' and action='PRODUCT_CREATED' and entity_id=(select id from public.products where code='NEXORA_OPS')),'product creation is audited');
select throws_ok($$select public.create_product('NEXORA_OPS','Duplicate product',null)$$,'23505',null,'duplicate product code is rejected');
select throws_ok($$insert into public.products(code,name,status) values('DIRECT_WRITE','Direct write','ACTIVE')$$,'42501',null,'administrator cannot bypass the RPC with a direct insert');

reset role; set local role authenticated;
set local request.jwt.claims='{"sub":"99000000-0000-4000-8000-000000000003","role":"authenticated"}';
select is((select count(*)::integer from public.products where code='NEXORA_OPS'),0,'unsubscribed customer cannot read the new product');

reset role; set local role authenticated;
set local request.jwt.claims='{"sub":"99000000-0000-4000-8000-000000000001","role":"authenticated"}';
select lives_ok($$select public.activate_customer_product('a9000000-0000-4000-8000-000000000002',(select id from public.products where code='NEXORA_OPS'))$$,'administrator makes the product available to a customer');
select is((select status::text from public.customer_subscriptions where organization_id='a9000000-0000-4000-8000-000000000002'),'ACTIVE','new subscription is active for workflow scope');
select throws_ok($$select public.activate_customer_product('a9000000-0000-4000-8000-000000000002',(select id from public.products where code='NEXORA_OPS'))$$,'23505',null,'duplicate customer-product provisioning is rejected');
select throws_ok($$select public.activate_customer_product('a9000000-0000-4000-8000-000000000001',(select id from public.products where code='NEXORA_OPS'))$$,'23514','An active customer organization and product are required','Beau Roi organization cannot be provisioned as a customer');
select throws_ok($$insert into public.customer_subscriptions(organization_id,product_id,status) values('a9000000-0000-4000-8000-000000000002',(select id from public.products where code='NEXORA_OPS'),'ACTIVE')$$,'42501',null,'administrator cannot bypass provisioning RPC');
select ok(exists(select 1 from public.audit_events where action='CUSTOMER_PRODUCT_ACTIVATED' and organization_id='a9000000-0000-4000-8000-000000000002'),'customer product activation is audited');

reset role; set local role authenticated;
set local request.jwt.claims='{"sub":"99000000-0000-4000-8000-000000000003","role":"authenticated"}';
select is((select count(*)::integer from public.products where code='NEXORA_OPS'),1,'subscribed customer can read only their provisioned product');

reset role;
select throws_ok($$delete from public.products where code='NEXORA_OPS'$$,'23503',null,'product with an active subscription is protected by its foreign key');
select lives_ok($$delete from public.customer_subscriptions where organization_id='a9000000-0000-4000-8000-000000000002'$$,'database owner may clean up a subscription');
select lives_ok($$delete from public.products where code='NEXORA_OPS'$$,'database owner may clean up an unreferenced product');

select * from finish();
rollback;
