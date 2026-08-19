insert into auth.users(id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data) values
('97000000-0000-4000-8000-000000000001','authenticated','authenticated','compat-release-admin@test','x','{"nexora_account_type":"BEAUROI"}','{"full_name":"Compatibility Admin"}');
insert into public.organizations(id,name,slug,organization_type) values
('a7000000-0000-4000-8000-000000000001','Compatibility Beau Roi','compat-release-beau','BEAUROI'),
('a7000000-0000-4000-8000-000000000002','Compatibility Customer','compat-release-customer','CUSTOMER');
insert into public.organization_memberships(organization_id,user_id,role,status,is_primary,joined_at) values
('a7000000-0000-4000-8000-000000000001','97000000-0000-4000-8000-000000000001','BEAUROI_ADMIN','ACTIVE',true,now());
insert into public.products(id,code,name,status) values
('b7000000-0000-4000-8000-000000000001','COMPAT_RELEASE','Compatibility Release Product','ACTIVE');
insert into public.customer_subscriptions(organization_id,product_id,status) values
('a7000000-0000-4000-8000-000000000002','b7000000-0000-4000-8000-000000000001','ACTIVE');
insert into public.product_releases(id,organization_id,product_id,version,title,summary,release_notes,status,released_at,created_by) values
('c7000000-0000-4000-8000-000000000001',null,'b7000000-0000-4000-8000-000000000001','1.0.0','Published compatibility release','Published summary','Published notes','ACTIVE',now()-interval '7 days','97000000-0000-4000-8000-000000000001'),
('c7000000-0000-4000-8000-000000000002','a7000000-0000-4000-8000-000000000002','b7000000-0000-4000-8000-000000000001','1.1.0','Scheduled compatibility release','Scheduled summary','Scheduled notes','PAUSED',now()+interval '7 days','97000000-0000-4000-8000-000000000001');
insert into public.maintenance_notices(id,organization_id,product_id,title,description,starts_at,ends_at,status,created_by) values
('d7000000-0000-4000-8000-000000000001','a7000000-0000-4000-8000-000000000002','b7000000-0000-4000-8000-000000000001','Compatibility maintenance','Existing customer maintenance notice',now()+interval '2 days',now()+interval '2 days 1 hour','ACTIVE','97000000-0000-4000-8000-000000000001');
