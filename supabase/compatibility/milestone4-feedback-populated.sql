\set ON_ERROR_STOP on
insert into auth.users(id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data) values
('81000000-0000-4000-8000-000000000001','authenticated','authenticated','legacy-feedback@test','x','{"nexora_account_type":"BEAUROI"}','{"full_name":"Legacy Feedback User"}');
insert into public.organizations(id,name,slug,organization_type) values
('82000000-0000-4000-8000-000000000001','Legacy Feedback Customer','legacy-feedback-customer','CUSTOMER');
insert into public.organization_memberships(organization_id,user_id,role,status,is_primary,joined_at) values
('82000000-0000-4000-8000-000000000001','81000000-0000-4000-8000-000000000001','CUSTOMER_ADMIN','ACTIVE',true,now());
insert into public.products(id,code,name,status) values
('83000000-0000-4000-8000-000000000001','LEGACY_FEEDBACK','Legacy Feedback Product','ACTIVE');
insert into public.customer_subscriptions(organization_id,product_id,status) values
('82000000-0000-4000-8000-000000000001','83000000-0000-4000-8000-000000000001','ACTIVE');
insert into public.feedback(id,organization_id,product_id,submitted_by,title,description,category,status,created_at,updated_at) values
('84000000-0000-4000-8000-000000000001','82000000-0000-4000-8000-000000000001','83000000-0000-4000-8000-000000000001','81000000-0000-4000-8000-000000000001','Legacy general feedback','Legacy general description','GENERAL','SUBMITTED',now()-interval '3 days',now()-interval '3 days'),
('84000000-0000-4000-8000-000000000002','82000000-0000-4000-8000-000000000001','83000000-0000-4000-8000-000000000001','81000000-0000-4000-8000-000000000001','Legacy bug feedback','Legacy bug description','BUG','UNDER_REVIEW',now()-interval '2 days',now()-interval '2 days'),
('84000000-0000-4000-8000-000000000003','82000000-0000-4000-8000-000000000001','83000000-0000-4000-8000-000000000001','81000000-0000-4000-8000-000000000001','Legacy feature feedback','Legacy feature description','FEATURE_REQUEST','PLANNED',now()-interval '1 day',now()-interval '1 day');
insert into public.bug_reports(id,organization_id,feedback_id,severity,reproduction_steps) values
('85000000-0000-4000-8000-000000000001','82000000-0000-4000-8000-000000000001','84000000-0000-4000-8000-000000000002','HIGH','Legacy steps');
insert into public.feature_requests(id,organization_id,feedback_id,problem_statement,desired_outcome,status) values
('86000000-0000-4000-8000-000000000001','82000000-0000-4000-8000-000000000001','84000000-0000-4000-8000-000000000003','Legacy problem','Legacy outcome','PLANNED');
insert into public.feature_votes(id,organization_id,feature_request_id,user_id) values
('87000000-0000-4000-8000-000000000001','82000000-0000-4000-8000-000000000001','86000000-0000-4000-8000-000000000001','81000000-0000-4000-8000-000000000001');
