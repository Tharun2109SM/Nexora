insert into auth.users(id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data)
values('99000000-0000-4000-8000-000000000001','authenticated','authenticated','compat-knowledge-admin@test','x','{"nexora_account_type":"BEAUROI"}','{"full_name":"Compatibility Admin"}');
insert into public.organizations(id,name,slug,organization_type) values
('a9000000-0000-4000-8000-000000000001','Compatibility Beau Roi','compat-knowledge-beau','BEAUROI'),
('a9000000-0000-4000-8000-000000000002','Compatibility Customer','compat-knowledge-customer','CUSTOMER');
insert into public.organization_memberships(organization_id,user_id,role,status,is_primary,joined_at)
values('a9000000-0000-4000-8000-000000000001','99000000-0000-4000-8000-000000000001','BEAUROI_ADMIN','ACTIVE',true,now());
insert into public.products(id,code,name,status)
values('b9000000-0000-4000-8000-000000000001','COMPAT_KNOWLEDGE','Compatibility Knowledge Product','ACTIVE');
insert into public.customer_subscriptions(organization_id,product_id,status)
values('a9000000-0000-4000-8000-000000000002','b9000000-0000-4000-8000-000000000001','ACTIVE');
insert into public.knowledge_base_articles(id,organization_id,product_id,slug,title,summary,body,status,audience,author_user_id,published_at) values
('c9000000-0000-4000-8000-000000000001',null,'b9000000-0000-4000-8000-000000000001','compat-published','Compatibility published article','Existing approved summary','Existing searchable content','PUBLISHED','CUSTOMER','99000000-0000-4000-8000-000000000001',now()-interval '2 days'),
('c9000000-0000-4000-8000-000000000002','a9000000-0000-4000-8000-000000000002',null,'compat-targeted','Compatibility targeted article',null,'Existing targeted content','DRAFT','INTERNAL','99000000-0000-4000-8000-000000000001',null);
