-- Seed used only with `supabase db reset --version 20260814183342`.
-- It proves the unapplied Milestone 2 migration upgrades populated Milestone 1 history.
insert into auth.users (id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data)
values (
  '51000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated',
  'legacy-staff@beauroi.test', 'test', '{"nexora_account_type":"BEAUROI"}',
  '{"full_name":"Legacy Staff"}'
);

insert into public.organizations (id, name, slug, organization_type)
values
  ('52000000-0000-4000-8000-000000000001', 'Legacy Beau Roi', 'legacy-beau-roi', 'BEAUROI'),
  ('52000000-0000-4000-8000-000000000002', 'Legacy Customer', 'legacy-customer', 'CUSTOMER');

insert into public.organization_memberships (
  id, organization_id, user_id, role, status, is_primary, joined_at
) values (
  '53000000-0000-4000-8000-000000000001', '52000000-0000-4000-8000-000000000001',
  '51000000-0000-4000-8000-000000000001', 'BEAUROI_EMPLOYEE', 'ACTIVE', true,
  '2025-01-01 00:00:00+00'
);

insert into public.customer_assignments (
  id, organization_id, employee_user_id, assignment_type, is_active, created_at
) values (
  '54000000-0000-4000-8000-000000000001', '52000000-0000-4000-8000-000000000002',
  '51000000-0000-4000-8000-000000000001', 'CSM', false,
  '2025-02-03 04:05:06+00'
);
