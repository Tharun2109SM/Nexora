-- Seed used to verify the Milestone 2 migration fails clearly rather than deleting history.
insert into auth.users (id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data)
values
  ('61000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'duplicate-one@beauroi.test', 'test', '{"nexora_account_type":"BEAUROI"}', '{}'),
  ('61000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'duplicate-two@beauroi.test', 'test', '{"nexora_account_type":"BEAUROI"}', '{}');

insert into public.organizations (id, name, slug, organization_type)
values ('62000000-0000-4000-8000-000000000001', 'Duplicate Customer', 'duplicate-customer', 'CUSTOMER');

insert into public.customer_assignments (
  organization_id, employee_user_id, assignment_type, is_active
) values
  ('62000000-0000-4000-8000-000000000001', '61000000-0000-4000-8000-000000000001', 'CSM', true),
  ('62000000-0000-4000-8000-000000000001', '61000000-0000-4000-8000-000000000002', 'CSM', true);
