-- Seed only after `supabase db reset --version 20260815143152 --no-seed`.
-- Representative populated Milestone 2 data, including every legacy lifecycle status.
set session_replication_role = replica;
insert into auth.users (id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data)
values
  ('81000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'legacy-workflow-staff@example.test', 'test', '{"nexora_account_type":"BEAUROI"}', '{"full_name":"Legacy Workflow Staff"}'),
  ('81000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'legacy-workflow-customer@example.test', 'test', '{"nexora_account_type":"CUSTOMER"}', '{"full_name":"Legacy Workflow Customer"}');
set session_replication_role = origin;

insert into public.profiles (id, full_name) values
  ('81000000-0000-4000-8000-000000000001', 'Legacy Workflow Staff'),
  ('81000000-0000-4000-8000-000000000002', 'Legacy Workflow Customer');
insert into public.organizations (id, name, slug, organization_type) values
  ('82000000-0000-4000-8000-000000000001', 'Legacy Workflow Beau Roi', 'legacy-workflow-beau-roi', 'BEAUROI'),
  ('82000000-0000-4000-8000-000000000002', 'Legacy Workflow Customer', 'legacy-workflow-customer', 'CUSTOMER');
insert into public.organization_memberships (organization_id, user_id, role, status, joined_at) values
  ('82000000-0000-4000-8000-000000000001', '81000000-0000-4000-8000-000000000001', 'BEAUROI_EMPLOYEE', 'ACTIVE', '2026-01-01 00:00:00+00'),
  ('82000000-0000-4000-8000-000000000002', '81000000-0000-4000-8000-000000000002', 'CUSTOMER_ADMIN', 'ACTIVE', '2026-01-01 00:00:00+00');
insert into public.products (id, code, name, status)
values ('83000000-0000-4000-8000-000000000001', 'LEGACY_WORKFLOW', 'Legacy Workflow Product', 'ACTIVE');
insert into public.customer_subscriptions (organization_id, product_id, status)
values ('82000000-0000-4000-8000-000000000002', '83000000-0000-4000-8000-000000000001', 'ACTIVE');

set session_replication_role = replica;
insert into public.customer_assignments (
  organization_id, product_id, employee_user_id, assignment_type,
  is_active, assigned_at, ended_at
) values
  ('82000000-0000-4000-8000-000000000002', null, '81000000-0000-4000-8000-000000000001', 'CSM', true, '2026-01-01 00:00:00+00', null),
  ('82000000-0000-4000-8000-000000000002', null, '81000000-0000-4000-8000-000000000001', 'IMPLEMENTATION_LEAD', true, '2026-01-01 00:00:00+00', null);
set session_replication_role = origin;

insert into public.onboarding_plans (id, organization_id, product_id, name, status, starts_on, target_completion_on, owner_user_id) values
  ('84000000-0000-4000-8000-000000000001', '82000000-0000-4000-8000-000000000002', '83000000-0000-4000-8000-000000000001', 'Legacy onboarding draft', 'DRAFT', '2026-01-01', '2026-02-01', '81000000-0000-4000-8000-000000000001'),
  ('84000000-0000-4000-8000-000000000002', '82000000-0000-4000-8000-000000000002', '83000000-0000-4000-8000-000000000001', 'Legacy onboarding active', 'ACTIVE', '2026-01-01', '2026-02-02', '81000000-0000-4000-8000-000000000001'),
  ('84000000-0000-4000-8000-000000000003', '82000000-0000-4000-8000-000000000002', '83000000-0000-4000-8000-000000000001', 'Legacy onboarding paused', 'PAUSED', '2026-01-01', '2026-02-03', '81000000-0000-4000-8000-000000000001'),
  ('84000000-0000-4000-8000-000000000004', '82000000-0000-4000-8000-000000000002', '83000000-0000-4000-8000-000000000001', 'Legacy onboarding completed', 'COMPLETED', '2026-01-01', '2026-02-04', '81000000-0000-4000-8000-000000000001'),
  ('84000000-0000-4000-8000-000000000005', '82000000-0000-4000-8000-000000000002', '83000000-0000-4000-8000-000000000001', 'Legacy onboarding archived', 'ARCHIVED', '2026-01-01', '2026-02-05', '81000000-0000-4000-8000-000000000001');

insert into public.onboarding_tasks (id, organization_id, onboarding_plan_id, title, status, assigned_user_id, completed_at, sort_order) values
  ('85000000-0000-4000-8000-000000000001', '82000000-0000-4000-8000-000000000002', '84000000-0000-4000-8000-000000000001', 'Legacy task draft', 'DRAFT', '81000000-0000-4000-8000-000000000001', null, 1),
  ('85000000-0000-4000-8000-000000000002', '82000000-0000-4000-8000-000000000002', '84000000-0000-4000-8000-000000000001', 'Legacy task active', 'ACTIVE', '81000000-0000-4000-8000-000000000002', null, 2),
  ('85000000-0000-4000-8000-000000000003', '82000000-0000-4000-8000-000000000002', '84000000-0000-4000-8000-000000000001', 'Legacy task paused', 'PAUSED', null, null, 3),
  ('85000000-0000-4000-8000-000000000004', '82000000-0000-4000-8000-000000000002', '84000000-0000-4000-8000-000000000001', 'Legacy task completed', 'COMPLETED', null, '2026-01-15 00:00:00+00', 4),
  ('85000000-0000-4000-8000-000000000005', '82000000-0000-4000-8000-000000000002', '84000000-0000-4000-8000-000000000001', 'Legacy task archived', 'ARCHIVED', null, null, 5);

insert into public.training_sessions (id, organization_id, onboarding_plan_id, title, scheduled_at, duration_minutes, status, facilitator_user_id) values
  ('86000000-0000-4000-8000-000000000001', '82000000-0000-4000-8000-000000000002', '84000000-0000-4000-8000-000000000001', 'Legacy training draft', '2026-01-10 00:00:00+00', 60, 'DRAFT', '81000000-0000-4000-8000-000000000001'),
  ('86000000-0000-4000-8000-000000000002', '82000000-0000-4000-8000-000000000002', '84000000-0000-4000-8000-000000000001', 'Legacy training active', '2026-01-11 00:00:00+00', 60, 'ACTIVE', null),
  ('86000000-0000-4000-8000-000000000003', '82000000-0000-4000-8000-000000000002', '84000000-0000-4000-8000-000000000001', 'Legacy training paused', '2026-01-12 00:00:00+00', 60, 'PAUSED', null),
  ('86000000-0000-4000-8000-000000000004', '82000000-0000-4000-8000-000000000002', '84000000-0000-4000-8000-000000000001', 'Legacy training completed', '2026-01-13 00:00:00+00', 60, 'COMPLETED', null),
  ('86000000-0000-4000-8000-000000000005', '82000000-0000-4000-8000-000000000002', '84000000-0000-4000-8000-000000000001', 'Legacy training archived', '2026-01-14 00:00:00+00', 60, 'ARCHIVED', null);

insert into public.requested_documents (id, organization_id, onboarding_plan_id, name, status, requested_from_user_id, submitted_at) values
  ('87000000-0000-4000-8000-000000000001', '82000000-0000-4000-8000-000000000002', '84000000-0000-4000-8000-000000000001', 'Legacy document draft', 'DRAFT', '81000000-0000-4000-8000-000000000002', null),
  ('87000000-0000-4000-8000-000000000002', '82000000-0000-4000-8000-000000000002', '84000000-0000-4000-8000-000000000001', 'Legacy document active', 'ACTIVE', null, '2026-01-15 00:00:00+00'),
  ('87000000-0000-4000-8000-000000000003', '82000000-0000-4000-8000-000000000002', '84000000-0000-4000-8000-000000000001', 'Legacy document paused', 'PAUSED', null, '2026-01-16 00:00:00+00'),
  ('87000000-0000-4000-8000-000000000004', '82000000-0000-4000-8000-000000000002', '84000000-0000-4000-8000-000000000001', 'Legacy document completed', 'COMPLETED', null, '2026-01-17 00:00:00+00'),
  ('87000000-0000-4000-8000-000000000005', '82000000-0000-4000-8000-000000000002', '84000000-0000-4000-8000-000000000001', 'Legacy document archived', 'ARCHIVED', null, null);

insert into public.implementation_projects (id, organization_id, product_id, name, status, owner_user_id, starts_on, target_go_live_on, actual_go_live_on) values
  ('88000000-0000-4000-8000-000000000001', '82000000-0000-4000-8000-000000000002', '83000000-0000-4000-8000-000000000001', 'Legacy implementation draft', 'DRAFT', '81000000-0000-4000-8000-000000000001', '2026-01-01', '2026-03-01', null),
  ('88000000-0000-4000-8000-000000000002', '82000000-0000-4000-8000-000000000002', '83000000-0000-4000-8000-000000000001', 'Legacy implementation active', 'ACTIVE', '81000000-0000-4000-8000-000000000001', '2026-01-01', '2026-03-02', null),
  ('88000000-0000-4000-8000-000000000003', '82000000-0000-4000-8000-000000000002', '83000000-0000-4000-8000-000000000001', 'Legacy implementation paused', 'PAUSED', '81000000-0000-4000-8000-000000000001', '2026-01-01', '2026-03-03', null),
  ('88000000-0000-4000-8000-000000000004', '82000000-0000-4000-8000-000000000002', '83000000-0000-4000-8000-000000000001', 'Legacy implementation completed', 'COMPLETED', '81000000-0000-4000-8000-000000000001', '2026-01-01', '2026-03-04', '2026-03-04'),
  ('88000000-0000-4000-8000-000000000005', '82000000-0000-4000-8000-000000000002', '83000000-0000-4000-8000-000000000001', 'Legacy implementation archived', 'ARCHIVED', '81000000-0000-4000-8000-000000000001', '2026-01-01', '2026-03-05', null);

insert into public.milestones (id, organization_id, implementation_project_id, title, status, completed_at, sort_order) values
  ('89000000-0000-4000-8000-000000000001', '82000000-0000-4000-8000-000000000002', '88000000-0000-4000-8000-000000000001', 'Legacy milestone draft', 'DRAFT', null, 1),
  ('89000000-0000-4000-8000-000000000002', '82000000-0000-4000-8000-000000000002', '88000000-0000-4000-8000-000000000001', 'Legacy milestone active', 'ACTIVE', null, 2),
  ('89000000-0000-4000-8000-000000000003', '82000000-0000-4000-8000-000000000002', '88000000-0000-4000-8000-000000000001', 'Legacy milestone paused', 'PAUSED', null, 3),
  ('89000000-0000-4000-8000-000000000004', '82000000-0000-4000-8000-000000000002', '88000000-0000-4000-8000-000000000001', 'Legacy milestone completed', 'COMPLETED', '2026-02-01 00:00:00+00', 4),
  ('89000000-0000-4000-8000-000000000005', '82000000-0000-4000-8000-000000000002', '88000000-0000-4000-8000-000000000001', 'Legacy milestone archived', 'ARCHIVED', null, 5);

insert into public.project_notes (organization_id, implementation_project_id, author_user_id, body, visibility)
values ('82000000-0000-4000-8000-000000000002', '88000000-0000-4000-8000-000000000001', '81000000-0000-4000-8000-000000000001', 'Legacy shared implementation note', 'SHARED');
