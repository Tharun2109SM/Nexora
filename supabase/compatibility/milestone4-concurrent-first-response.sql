\set ON_ERROR_STOP on

insert into auth.users (id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data)
values
  ('61000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'concurrent-support@example.test', 'test', '{"nexora_account_type":"BEAUROI"}', '{"full_name":"Concurrent Support"}'),
  ('61000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'concurrent-customer@example.test', 'test', '{"nexora_account_type":"BEAUROI"}', '{"full_name":"Concurrent Customer"}');

insert into public.organizations (id, name, slug, organization_type)
values
  ('62000000-0000-4000-8000-000000000001', 'Concurrent Beau Roi', 'concurrent-beau-roi', 'BEAUROI'),
  ('62000000-0000-4000-8000-000000000002', 'Concurrent Customer', 'concurrent-customer', 'CUSTOMER');

insert into public.organization_memberships (organization_id, user_id, role, status, is_primary, joined_at)
values
  ('62000000-0000-4000-8000-000000000001', '61000000-0000-4000-8000-000000000001', 'BEAUROI_EMPLOYEE', 'ACTIVE', true, now()),
  ('62000000-0000-4000-8000-000000000002', '61000000-0000-4000-8000-000000000002', 'CUSTOMER_ADMIN', 'ACTIVE', true, now());

insert into public.products (id, code, name, status)
values ('63000000-0000-4000-8000-000000000001', 'CONCURRENT_SUPPORT', 'Concurrent Support Product', 'ACTIVE');
insert into public.customer_subscriptions (organization_id, product_id, status)
values ('62000000-0000-4000-8000-000000000002', '63000000-0000-4000-8000-000000000001', 'ACTIVE');
insert into public.support_categories (id, code, name, product_id)
values ('64000000-0000-4000-8000-000000000001', 'TEST_CONCURRENT', 'Test concurrent response', '63000000-0000-4000-8000-000000000001');

set session_replication_role = replica;
insert into public.customer_assignments (
  id, organization_id, product_id, employee_user_id, assignment_type,
  is_active, assigned_at, ended_at
)
values (
  '65000000-0000-4000-8000-000000000001',
  '62000000-0000-4000-8000-000000000002',
  '63000000-0000-4000-8000-000000000001',
  '61000000-0000-4000-8000-000000000001',
  'SUPPORT_LEAD', true, now(), null
);
set session_replication_role = origin;

insert into public.support_tickets (
  id, organization_id, product_id, category_id, subject, description,
  status, priority, created_by, last_activity_at
)
values (
  '66000000-0000-4000-8000-000000000001',
  '62000000-0000-4000-8000-000000000002',
  '63000000-0000-4000-8000-000000000001',
  '64000000-0000-4000-8000-000000000001',
  'Concurrent response ticket', 'Concurrent response verification',
  'OPEN', 'MEDIUM', '61000000-0000-4000-8000-000000000002', now()
);
