begin;

select no_plan();

set local session_replication_role = replica;
insert into auth.users (id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data)
values
  ('31000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'workflow@beauroi.test', 'test', '{"nexora_account_type":"BEAUROI"}', '{"full_name":"Workflow Owner"}'),
  ('31000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'customer-a@test.test', 'test', '{"nexora_account_type":"CUSTOMER"}', '{"full_name":"Customer A"}'),
  ('31000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'customer-b@test.test', 'test', '{"nexora_account_type":"CUSTOMER"}', '{"full_name":"Customer B"}'),
  ('31000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'inactive@beauroi.test', 'test', '{"nexora_account_type":"BEAUROI"}', '{"full_name":"Inactive Owner"}'),
  ('31000000-0000-0000-0000-000000000005', 'authenticated', 'authenticated', 'inactive-customer@test.test', 'test', '{"nexora_account_type":"CUSTOMER"}', '{"full_name":"Inactive Customer"}'),
  ('31000000-0000-0000-0000-000000000006', 'authenticated', 'authenticated', 'facilitator@beauroi.test', 'test', '{"nexora_account_type":"BEAUROI"}', '{"full_name":"Active Facilitator"}'),
  ('31000000-0000-0000-0000-000000000007', 'authenticated', 'authenticated', 'customer-member@test.test', 'test', '{"nexora_account_type":"CUSTOMER"}', '{"full_name":"Customer Member"}'),
  ('31000000-0000-0000-0000-000000000008', 'authenticated', 'authenticated', 'admin@beauroi.test', 'test', '{"nexora_account_type":"BEAUROI"}', '{"full_name":"Workflow Administrator"}'),
  ('31000000-0000-0000-0000-000000000009', 'authenticated', 'authenticated', 'other-org@beauroi.test', 'test', '{"nexora_account_type":"BEAUROI"}', '{"full_name":"Other Organization Assignee"}'),
  ('31000000-0000-0000-0000-000000000010', 'authenticated', 'authenticated', 'other-product@beauroi.test', 'test', '{"nexora_account_type":"BEAUROI"}', '{"full_name":"Other Product Assignee"}'),
  ('31000000-0000-0000-0000-000000000011', 'authenticated', 'authenticated', 'ended-assignment@beauroi.test', 'test', '{"nexora_account_type":"BEAUROI"}', '{"full_name":"Ended Assignment Employee"}');
set local session_replication_role = origin;

insert into public.profiles (id, full_name) values
  ('31000000-0000-0000-0000-000000000001', 'Workflow Owner'),
  ('31000000-0000-0000-0000-000000000002', 'Customer A'),
  ('31000000-0000-0000-0000-000000000003', 'Customer B'),
  ('31000000-0000-0000-0000-000000000004', 'Inactive Owner'),
  ('31000000-0000-0000-0000-000000000005', 'Inactive Customer'),
  ('31000000-0000-0000-0000-000000000006', 'Active Facilitator'),
  ('31000000-0000-0000-0000-000000000007', 'Customer Member'),
  ('31000000-0000-0000-0000-000000000008', 'Workflow Administrator'),
  ('31000000-0000-0000-0000-000000000009', 'Other Organization Assignee'),
  ('31000000-0000-0000-0000-000000000010', 'Other Product Assignee'),
  ('31000000-0000-0000-0000-000000000011', 'Ended Assignment Employee');

insert into public.organizations (id, name, slug, organization_type)
values
  ('32000000-0000-0000-0000-000000000001', 'Beau Roi Test', 'beau-roi-workflow-test', 'BEAUROI'),
  ('32000000-0000-0000-0000-000000000002', 'Customer Alpha', 'customer-alpha-workflow-test', 'CUSTOMER'),
  ('32000000-0000-0000-0000-000000000003', 'Customer Beta', 'customer-beta-workflow-test', 'CUSTOMER');

insert into public.organization_memberships (organization_id, user_id, role, status, joined_at)
values
  ('32000000-0000-0000-0000-000000000001', '31000000-0000-0000-0000-000000000001', 'BEAUROI_EMPLOYEE', 'ACTIVE', now()),
  ('32000000-0000-0000-0000-000000000001', '31000000-0000-0000-0000-000000000004', 'BEAUROI_EMPLOYEE', 'SUSPENDED', now()),
  ('32000000-0000-0000-0000-000000000001', '31000000-0000-0000-0000-000000000006', 'BEAUROI_EMPLOYEE', 'ACTIVE', now()),
  ('32000000-0000-0000-0000-000000000001', '31000000-0000-0000-0000-000000000008', 'BEAUROI_ADMIN', 'ACTIVE', now()),
  ('32000000-0000-0000-0000-000000000001', '31000000-0000-0000-0000-000000000009', 'BEAUROI_EMPLOYEE', 'ACTIVE', now()),
  ('32000000-0000-0000-0000-000000000001', '31000000-0000-0000-0000-000000000010', 'BEAUROI_EMPLOYEE', 'ACTIVE', now()),
  ('32000000-0000-0000-0000-000000000001', '31000000-0000-0000-0000-000000000011', 'BEAUROI_EMPLOYEE', 'ACTIVE', now()),
  ('32000000-0000-0000-0000-000000000002', '31000000-0000-0000-0000-000000000002', 'CUSTOMER_ADMIN', 'ACTIVE', now()),
  ('32000000-0000-0000-0000-000000000002', '31000000-0000-0000-0000-000000000005', 'CUSTOMER_MEMBER', 'SUSPENDED', now()),
  ('32000000-0000-0000-0000-000000000002', '31000000-0000-0000-0000-000000000007', 'CUSTOMER_MEMBER', 'ACTIVE', now()),
  ('32000000-0000-0000-0000-000000000003', '31000000-0000-0000-0000-000000000003', 'CUSTOMER_MEMBER', 'ACTIVE', now());

insert into public.products (id, code, name, status)
values
  ('33000000-0000-0000-0000-000000000001', 'WORKFLOW_TEST', 'Workflow Test Product', 'ACTIVE'),
  ('33000000-0000-0000-0000-000000000002', 'OTHER_WORKFLOW', 'Other Workflow Product', 'ACTIVE');
insert into public.customer_subscriptions (organization_id, product_id, status)
values
  ('32000000-0000-0000-0000-000000000002', '33000000-0000-0000-0000-000000000001', 'ACTIVE'),
  ('32000000-0000-0000-0000-000000000003', '33000000-0000-0000-0000-000000000001', 'ACTIVE');

set local session_replication_role = replica;
insert into public.customer_assignments (
  organization_id, product_id, employee_user_id, assignment_type,
  is_active, assigned_at, ended_at
) values
  ('32000000-0000-0000-0000-000000000002', null, '31000000-0000-0000-0000-000000000001', 'CSM', true, now() - interval '30 days', null),
  ('32000000-0000-0000-0000-000000000002', null, '31000000-0000-0000-0000-000000000001', 'IMPLEMENTATION_ENGINEER', true, now() - interval '30 days', null),
  ('32000000-0000-0000-0000-000000000002', '33000000-0000-0000-0000-000000000001', '31000000-0000-0000-0000-000000000004', 'CSM', true, now() - interval '30 days', null),
  ('32000000-0000-0000-0000-000000000002', '33000000-0000-0000-0000-000000000001', '31000000-0000-0000-0000-000000000004', 'IMPLEMENTATION_ENGINEER', true, now() - interval '30 days', null),
  ('32000000-0000-0000-0000-000000000003', null, '31000000-0000-0000-0000-000000000009', 'CSM', true, now() - interval '30 days', null),
  ('32000000-0000-0000-0000-000000000003', null, '31000000-0000-0000-0000-000000000009', 'IMPLEMENTATION_ENGINEER', true, now() - interval '30 days', null),
  ('32000000-0000-0000-0000-000000000002', '33000000-0000-0000-0000-000000000002', '31000000-0000-0000-0000-000000000010', 'CSM', true, now() - interval '30 days', null),
  ('32000000-0000-0000-0000-000000000002', '33000000-0000-0000-0000-000000000002', '31000000-0000-0000-0000-000000000010', 'IMPLEMENTATION_ENGINEER', true, now() - interval '30 days', null),
  ('32000000-0000-0000-0000-000000000002', null, '31000000-0000-0000-0000-000000000011', 'CSM', false, now() - interval '30 days', now() - interval '1 day'),
  ('32000000-0000-0000-0000-000000000002', null, '31000000-0000-0000-0000-000000000011', 'IMPLEMENTATION_ENGINEER', false, now() - interval '30 days', now() - interval '1 day');
set local session_replication_role = origin;

set local role authenticated;
set local request.jwt.claims = '{"sub":"31000000-0000-0000-0000-000000000001","role":"authenticated"}';

insert into public.onboarding_plans (id, organization_id, product_id, name, owner_user_id, workflow_status, starts_on, target_go_live_on)
values ('34000000-0000-0000-0000-000000000001', '32000000-0000-0000-0000-000000000002', '33000000-0000-0000-0000-000000000001', 'Alpha onboarding', '31000000-0000-0000-0000-000000000001', 'DRAFT', current_date, current_date + 30);
insert into public.onboarding_tasks (id, organization_id, onboarding_plan_id, title, workflow_status, completed_at, sort_order)
values
  ('35000000-0000-0000-0000-000000000001', '32000000-0000-0000-0000-000000000002', '34000000-0000-0000-0000-000000000001', 'Completed setup', 'COMPLETED', now(), 0),
  ('35000000-0000-0000-0000-000000000002', '32000000-0000-0000-0000-000000000002', '34000000-0000-0000-0000-000000000001', 'Remaining setup', 'NOT_STARTED', null, 1),
  ('35000000-0000-0000-0000-000000000003', '32000000-0000-0000-0000-000000000002', '34000000-0000-0000-0000-000000000001', 'Cancelled setup', 'CANCELLED', null, 2);
insert into public.training_sessions (id, organization_id, onboarding_plan_id, title, scheduled_at, duration_minutes, workflow_status, facilitator_user_id)
values ('35500000-0000-0000-0000-000000000001', '32000000-0000-0000-0000-000000000002', '34000000-0000-0000-0000-000000000001', 'Administrator training', now() + interval '1 day', 60, 'SCHEDULED', '31000000-0000-0000-0000-000000000006');
insert into public.requested_documents (id, organization_id, onboarding_plan_id, name, workflow_status, requested_from_user_id)
values ('35600000-0000-0000-0000-000000000001', '32000000-0000-0000-0000-000000000002', '34000000-0000-0000-0000-000000000001', 'Security questionnaire', 'REQUESTED', '31000000-0000-0000-0000-000000000007');

insert into public.implementation_projects (id, organization_id, product_id, name, owner_user_id, workflow_status, phase)
values ('36000000-0000-0000-0000-000000000001', '32000000-0000-0000-0000-000000000002', '33000000-0000-0000-0000-000000000001', 'Alpha implementation', '31000000-0000-0000-0000-000000000001', 'DRAFT', 'DISCOVERY');
insert into public.milestones (id, organization_id, implementation_project_id, title, workflow_status, completed_at, sort_order)
values
  ('37000000-0000-0000-0000-000000000001', '32000000-0000-0000-0000-000000000002', '36000000-0000-0000-0000-000000000001', 'Completed discovery', 'COMPLETED', now(), 0),
  ('37000000-0000-0000-0000-000000000002', '32000000-0000-0000-0000-000000000002', '36000000-0000-0000-0000-000000000001', 'Configuration', 'NOT_STARTED', null, 1),
  ('37000000-0000-0000-0000-000000000003', '32000000-0000-0000-0000-000000000002', '36000000-0000-0000-0000-000000000001', 'Cancelled prototype', 'CANCELLED', null, 2);
insert into public.project_notes (id, organization_id, implementation_project_id, body, visibility)
values
  ('38000000-0000-0000-0000-000000000001', '32000000-0000-0000-0000-000000000002', '36000000-0000-0000-0000-000000000001', 'Customer-safe update', 'SHARED'),
  ('38000000-0000-0000-0000-000000000002', '32000000-0000-0000-0000-000000000002', '36000000-0000-0000-0000-000000000001', 'Internal risk analysis', 'INTERNAL');

select lives_ok($$select public.set_implementation_requirement('36000000-0000-0000-0000-000000000001', 'Internal requirement secret')$$, 'Beau Roi can set internal requirements');
select is(public.get_implementation_requirement('36000000-0000-0000-0000-000000000001'), 'Internal requirement secret', 'Beau Roi can retrieve internal requirements');
select lives_ok($$update public.onboarding_plans set workflow_status = 'NOT_STARTED' where id = '34000000-0000-0000-0000-000000000001'$$, 'assigned employee can manage onboarding');
select lives_ok($$update public.onboarding_tasks set description = 'Assigned onboarding task update' where id = '35000000-0000-0000-0000-000000000002'$$, 'assigned employee can manage onboarding children');
select lives_ok($$update public.implementation_projects set workflow_status = 'NOT_STARTED' where id = '36000000-0000-0000-0000-000000000001'$$, 'assigned employee can manage implementation');
select lives_ok($$update public.milestones set description = 'Assigned milestone update' where id = '37000000-0000-0000-0000-000000000002'$$, 'assigned employee can manage implementation children');

set local request.jwt.claims = '{"sub":"31000000-0000-0000-0000-000000000006","role":"authenticated"}';
select throws_ok($$update public.onboarding_plans set customer_update = 'Unassigned onboarding edit' where id = '34000000-0000-0000-0000-000000000001'$$, '42501', null, 'active but unassigned employee cannot mutate onboarding');
select throws_ok($$update public.implementation_projects set customer_update = 'Unassigned implementation edit' where id = '36000000-0000-0000-0000-000000000001'$$, '42501', null, 'active but unassigned employee cannot mutate implementation');
select throws_ok($$insert into public.project_notes (organization_id, implementation_project_id, body, visibility) values ('32000000-0000-0000-0000-000000000002', '36000000-0000-0000-0000-000000000001', 'Unassigned internal note', 'INTERNAL')$$, '42501', null, 'active but unassigned employee cannot insert project notes');
select throws_ok($$select public.set_implementation_requirement('36000000-0000-0000-0000-000000000001', 'Unassigned requirement')$$, '42501', null, 'active but unassigned employee cannot mutate requirements');

set local request.jwt.claims = '{"sub":"31000000-0000-0000-0000-000000000009","role":"authenticated"}';
select throws_ok($$update public.onboarding_tasks set description = 'Wrong organization edit' where id = '35000000-0000-0000-0000-000000000002'$$, '42501', null, 'employee assigned to a different organization cannot mutate onboarding children');
select throws_ok($$update public.milestones set description = 'Wrong organization edit' where id = '37000000-0000-0000-0000-000000000002'$$, '42501', null, 'employee assigned to a different organization cannot mutate implementation children');

set local request.jwt.claims = '{"sub":"31000000-0000-0000-0000-000000000010","role":"authenticated"}';
select throws_ok($$update public.onboarding_plans set customer_update = 'Wrong product edit' where id = '34000000-0000-0000-0000-000000000001'$$, '42501', null, 'mismatched product assignment cannot mutate onboarding');
select throws_ok($$update public.implementation_projects set customer_update = 'Wrong product edit' where id = '36000000-0000-0000-0000-000000000001'$$, '42501', null, 'mismatched product assignment cannot mutate implementation');

set local request.jwt.claims = '{"sub":"31000000-0000-0000-0000-000000000011","role":"authenticated"}';
select throws_ok($$update public.onboarding_plans set customer_update = 'Ended assignment edit' where id = '34000000-0000-0000-0000-000000000001'$$, '42501', null, 'ended assignment cannot mutate onboarding');
select throws_ok($$update public.implementation_projects set customer_update = 'Ended assignment edit' where id = '36000000-0000-0000-0000-000000000001'$$, '42501', null, 'ended assignment cannot mutate implementation');

set local request.jwt.claims = '{"sub":"31000000-0000-0000-0000-000000000008","role":"authenticated"}';
select lives_ok($$update public.onboarding_plans set customer_update = 'Administrator onboarding review' where id = '34000000-0000-0000-0000-000000000001'$$, 'Beau Roi administrator override can mutate onboarding');
select lives_ok($$update public.implementation_projects set customer_update = 'Administrator implementation review' where id = '36000000-0000-0000-0000-000000000001'$$, 'Beau Roi administrator override can mutate implementation');
select lives_ok($$select public.set_implementation_requirement('36000000-0000-0000-0000-000000000001', 'Internal requirement secret')$$, 'Beau Roi administrator override can mutate requirements');

set local request.jwt.claims = '{"sub":"31000000-0000-0000-0000-000000000001","role":"authenticated"}';
select is((select progress_percent from public.onboarding_portfolio where id = '34000000-0000-0000-0000-000000000001'), 50, 'onboarding progress excludes cancelled tasks');
select is((select progress_percent from public.implementation_portfolio where id = '36000000-0000-0000-0000-000000000001'), 50, 'implementation progress excludes cancelled milestones');
select ok((select count(*) >= 13 from public.audit_events where organization_id = '32000000-0000-0000-0000-000000000002'), 'workflow mutations create audit events');
select ok(not exists (
  select 1 from public.audit_events event
  where event.organization_id = '32000000-0000-0000-0000-000000000002'
    and (event.metadata::text like '%Internal requirement secret%' or event.metadata::text like '%Internal risk analysis%' or event.metadata::text like '%Customer-safe update%')
), 'audit metadata contains no requirement or note body');

select throws_ok($$insert into public.onboarding_plans (organization_id, product_id, name, owner_user_id, workflow_status) values ('32000000-0000-0000-0000-000000000002', '33000000-0000-0000-0000-000000000001', 'Bad owner plan', '31000000-0000-0000-0000-000000000004', 'DRAFT')$$, '23514', null, 'inactive Beau Roi plan owner is rejected');
select throws_ok($$insert into public.onboarding_tasks (organization_id, onboarding_plan_id, title, assigned_user_id, owner_kind, workflow_status) values ('32000000-0000-0000-0000-000000000002', '34000000-0000-0000-0000-000000000001', 'Bad task owner', '31000000-0000-0000-0000-000000000004', 'BEAUROI', 'NOT_STARTED')$$, '23514', null, 'inactive Beau Roi task owner is rejected');
select throws_ok($$insert into public.training_sessions (organization_id, onboarding_plan_id, title, scheduled_at, duration_minutes, facilitator_user_id, workflow_status) values ('32000000-0000-0000-0000-000000000002', '34000000-0000-0000-0000-000000000001', 'Bad facilitator', now(), 60, '31000000-0000-0000-0000-000000000004', 'SCHEDULED')$$, '23514', null, 'inactive Beau Roi facilitator is rejected');
select throws_ok($$insert into public.requested_documents (organization_id, onboarding_plan_id, name, requested_from_user_id, workflow_status) values ('32000000-0000-0000-0000-000000000002', '34000000-0000-0000-0000-000000000001', 'Bad requested user', '31000000-0000-0000-0000-000000000005', 'REQUESTED')$$, '23514', null, 'inactive customer requested user is rejected');
select throws_ok($$insert into public.requested_documents (organization_id, onboarding_plan_id, name, requested_from_user_id, workflow_status) values ('32000000-0000-0000-0000-000000000002', '34000000-0000-0000-0000-000000000001', 'Wrong organization user', '31000000-0000-0000-0000-000000000003', 'REQUESTED')$$, '23514', null, 'cross-organization requested user is rejected');
select throws_ok($$insert into public.onboarding_tasks (organization_id, onboarding_plan_id, title, workflow_status) values ('32000000-0000-0000-0000-000000000003', '34000000-0000-0000-0000-000000000001', 'Wrong parent organization', 'NOT_STARTED')$$, '23514', null, 'task parent and organization mismatch is rejected');
select throws_ok($$insert into public.milestones (organization_id, implementation_project_id, title, workflow_status) values ('32000000-0000-0000-0000-000000000003', '36000000-0000-0000-0000-000000000001', 'Wrong milestone organization', 'NOT_STARTED')$$, '23514', null, 'milestone parent and organization mismatch is rejected');
select throws_ok($$insert into public.training_sessions (organization_id, onboarding_plan_id, title, scheduled_at, duration_minutes, workflow_status) values ('32000000-0000-0000-0000-000000000003', '34000000-0000-0000-0000-000000000001', 'Wrong training organization', now(), 60, 'SCHEDULED')$$, '23514', null, 'training parent and organization mismatch is rejected');
select throws_ok($$insert into public.requested_documents (organization_id, onboarding_plan_id, name, workflow_status) values ('32000000-0000-0000-0000-000000000003', '34000000-0000-0000-0000-000000000001', 'Wrong document organization', 'REQUESTED')$$, '23514', null, 'document parent and organization mismatch is rejected');
select throws_ok($$insert into public.project_notes (organization_id, implementation_project_id, body, visibility) values ('32000000-0000-0000-0000-000000000003', '36000000-0000-0000-0000-000000000001', 'Wrong note organization', 'INTERNAL')$$, '23514', null, 'note parent and organization mismatch is rejected');
select throws_ok($$insert into public.onboarding_plans (organization_id, product_id, name, starts_on, target_go_live_on, workflow_status) values ('32000000-0000-0000-0000-000000000002', '33000000-0000-0000-0000-000000000001', 'Invalid onboarding dates', current_date, current_date - 1, 'DRAFT')$$, '23514', null, 'invalid onboarding dates are rejected');
select throws_ok($$insert into public.onboarding_tasks (organization_id, onboarding_plan_id, title, workflow_status) values ('32000000-0000-0000-0000-000000000002', '34000000-0000-0000-0000-000000000001', 'Invalid complete task', 'COMPLETED')$$, '23514', null, 'completed task requires a completion timestamp');
select throws_ok($$insert into public.training_sessions (organization_id, onboarding_plan_id, title, scheduled_at, duration_minutes, workflow_status) values ('32000000-0000-0000-0000-000000000002', '34000000-0000-0000-0000-000000000001', 'Invalid complete training', now(), 60, 'COMPLETED')$$, '23514', null, 'completed training requires a completion timestamp');
select throws_ok($$insert into public.requested_documents (organization_id, onboarding_plan_id, name, workflow_status) values ('32000000-0000-0000-0000-000000000002', '34000000-0000-0000-0000-000000000001', 'Invalid received document', 'RECEIVED')$$, '23514', null, 'received document requires a submission timestamp');
select throws_ok($$insert into public.implementation_projects (organization_id, product_id, name, workflow_status, phase) values ('32000000-0000-0000-0000-000000000002', '33000000-0000-0000-0000-000000000001', 'Invalid complete project', 'COMPLETED', 'DISCOVERY')$$, '23514', null, 'completed project requires completion phase and date');
select throws_ok($$insert into public.milestones (organization_id, implementation_project_id, title, workflow_status) values ('32000000-0000-0000-0000-000000000002', '36000000-0000-0000-0000-000000000001', 'Invalid complete milestone', 'COMPLETED')$$, '23514', null, 'completion requires a completion timestamp');
select throws_ok($$update public.onboarding_plans set workflow_status = 'LIVE', actual_go_live_on = current_date where id = '34000000-0000-0000-0000-000000000001'$$, '23514', null, 'invalid onboarding lifecycle transition is rejected');

set local request.jwt.claims = '{"sub":"31000000-0000-0000-0000-000000000002","role":"authenticated"}';
select is((select count(*)::integer from public.onboarding_plans), 1, 'customer can read own onboarding plan');
select is((select count(*)::integer from public.onboarding_tasks), 3, 'customer can read own onboarding tasks');
select is((select count(*)::integer from public.training_sessions), 1, 'customer can read own training');
select is((select count(*)::integer from public.requested_documents), 1, 'customer can read own document requests');
select is((select count(*)::integer from public.implementation_projects), 1, 'customer can read own implementation project');
select is((select count(*)::integer from public.milestones), 3, 'customer can read own milestones');
select is((select count(*)::integer from public.project_notes), 1, 'customer receives only shared notes');
select ok(not exists(select 1 from public.project_notes where body = 'Internal risk analysis'), 'internal note body is isolated');
select is((select count(*)::integer from public.profiles where id = '31000000-0000-0000-0000-000000000001'), 1, 'customer can read the safe directory row for an assigned workflow employee');
select throws_ok($$select phone from public.profiles where id = '31000000-0000-0000-0000-000000000002'$$, '42501', null, 'customer cannot select non-directory profile columns');
select throws_ok($$select * from private.implementation_project_requirements$$, '42501', null, 'customer cannot select private requirement storage');
select throws_ok($$select requirement_summary from public.implementation_projects$$, '42703', null, 'customer cannot query requirement content from the public project table');
select throws_ok($$select requirement_summary from public.implementation_portfolio$$, '42703', null, 'customer cannot query requirement content from the portfolio view');
select throws_ok($$select public.get_implementation_requirement('36000000-0000-0000-0000-000000000001')$$, '42501', null, 'customer cannot retrieve requirement through RPC');
select throws_ok($$select public.set_implementation_requirement('36000000-0000-0000-0000-000000000001', 'customer overwrite')$$, '42501', null, 'customer cannot update requirement through RPC');

select throws_ok($$insert into public.onboarding_plans (organization_id, product_id, name) values ('32000000-0000-0000-0000-000000000002', '33000000-0000-0000-0000-000000000001', 'Customer insert plan')$$, '42501', null, 'customer cannot insert plans');
select throws_ok($$insert into public.onboarding_tasks (organization_id, onboarding_plan_id, title) values ('32000000-0000-0000-0000-000000000002', '34000000-0000-0000-0000-000000000001', 'Customer insert task')$$, '42501', null, 'customer cannot insert tasks');
select throws_ok($$insert into public.training_sessions (organization_id, onboarding_plan_id, title, scheduled_at, duration_minutes) values ('32000000-0000-0000-0000-000000000002', '34000000-0000-0000-0000-000000000001', 'Customer insert training', now(), 60)$$, '42501', null, 'customer cannot insert training');
select throws_ok($$insert into public.requested_documents (organization_id, onboarding_plan_id, name) values ('32000000-0000-0000-0000-000000000002', '34000000-0000-0000-0000-000000000001', 'Customer insert document')$$, '42501', null, 'customer cannot insert documents');
select throws_ok($$insert into public.implementation_projects (organization_id, product_id, name) values ('32000000-0000-0000-0000-000000000002', '33000000-0000-0000-0000-000000000001', 'Customer insert project')$$, '42501', null, 'customer cannot insert projects');
select throws_ok($$insert into public.milestones (organization_id, implementation_project_id, title) values ('32000000-0000-0000-0000-000000000002', '36000000-0000-0000-0000-000000000001', 'Customer insert milestone')$$, '42501', null, 'customer cannot insert milestones');
select throws_ok($$insert into public.project_notes (organization_id, implementation_project_id, body) values ('32000000-0000-0000-0000-000000000002', '36000000-0000-0000-0000-000000000001', 'Customer insert note')$$, '42501', null, 'customer cannot insert notes');

select results_eq($$update public.onboarding_plans set name = 'Customer changed plan' returning id$$, array[]::uuid[], 'customer cannot update plans');
select results_eq($$update public.onboarding_tasks set title = 'Customer changed task' returning id$$, array[]::uuid[], 'customer cannot update tasks');
select results_eq($$update public.training_sessions set title = 'Customer changed training' returning id$$, array[]::uuid[], 'customer cannot update training');
select results_eq($$update public.requested_documents set name = 'Customer changed document' returning id$$, array[]::uuid[], 'customer cannot update documents');
select results_eq($$update public.implementation_projects set name = 'Customer changed project' returning id$$, array[]::uuid[], 'customer cannot update projects');
select results_eq($$update public.milestones set title = 'Customer changed milestone' returning id$$, array[]::uuid[], 'customer cannot update milestones');
select throws_ok($$update public.project_notes set body = 'Customer changed note'$$, '42501', null, 'customer cannot update notes');

select throws_ok($$delete from public.onboarding_plans$$, '42501', null, 'customer cannot delete plans');
select throws_ok($$delete from public.onboarding_tasks$$, '42501', null, 'customer cannot delete tasks');
select throws_ok($$delete from public.training_sessions$$, '42501', null, 'customer cannot delete training');
select throws_ok($$delete from public.requested_documents$$, '42501', null, 'customer cannot delete documents');
select throws_ok($$delete from public.implementation_projects$$, '42501', null, 'customer cannot delete projects');
select throws_ok($$delete from public.milestones$$, '42501', null, 'customer cannot delete milestones');
select throws_ok($$delete from public.project_notes$$, '42501', null, 'customer cannot delete notes');

set local request.jwt.claims = '{"sub":"31000000-0000-0000-0000-000000000003","role":"authenticated"}';
select is((select count(*)::integer from public.onboarding_plans), 0, 'cross-organization plans are rejected');
select is((select count(*)::integer from public.onboarding_tasks), 0, 'cross-organization tasks are rejected');
select is((select count(*)::integer from public.training_sessions), 0, 'cross-organization training is rejected');
select is((select count(*)::integer from public.requested_documents), 0, 'cross-organization documents are rejected');
select is((select count(*)::integer from public.implementation_projects), 0, 'cross-organization projects are rejected');
select is((select count(*)::integer from public.milestones), 0, 'cross-organization milestones are rejected');
select is((select count(*)::integer from public.project_notes), 0, 'cross-organization notes are rejected');
select is((select count(*)::integer from public.onboarding_portfolio), 0, 'cross-organization onboarding portfolio is rejected');
select is((select count(*)::integer from public.implementation_portfolio), 0, 'cross-organization implementation portfolio is rejected');

set local request.jwt.claims = '{"sub":"31000000-0000-0000-0000-000000000005","role":"authenticated"}';
select is((select count(*)::integer from public.onboarding_plans), 0, 'inactive customer membership loses workflow access');
set local request.jwt.claims = '{"sub":"31000000-0000-0000-0000-000000000004","role":"authenticated"}';
select is((select count(*)::integer from public.implementation_projects), 0, 'inactive Beau Roi membership loses workflow read access');
select throws_ok($$insert into public.onboarding_plans (organization_id, product_id, name) values ('32000000-0000-0000-0000-000000000002', '33000000-0000-0000-0000-000000000001', 'Inactive staff plan')$$, '42501', null, 'suspended Beau Roi employee cannot use an otherwise active onboarding assignment');
select results_eq($$update public.implementation_projects set customer_update = 'Suspended employee edit' returning id$$, array[]::uuid[], 'suspended Beau Roi employee cannot use an otherwise active implementation assignment');

reset role;
select ok(not exists(select 1 from information_schema.columns where table_schema = 'public' and table_name in ('implementation_projects', 'implementation_portfolio') and column_name = 'requirement_summary'), 'internal requirements are absent from exposed tables and views');
select ok(has_function_privilege('authenticated', 'public.get_implementation_requirement(uuid)', 'EXECUTE'), 'authenticated role can enter the guarded requirement read RPC');
select ok(not has_function_privilege('anon', 'public.get_implementation_requirement(uuid)', 'EXECUTE'), 'anon cannot execute requirement read RPC');
select ok(not has_function_privilege('anon', 'public.set_implementation_requirement(uuid,text)', 'EXECUTE'), 'anon cannot execute requirement write RPC');
select ok(not exists (
  select 1 from pg_proc procedure
  join pg_namespace namespace on namespace.oid = procedure.pronamespace
  cross join lateral aclexplode(coalesce(procedure.proacl, acldefault('f', procedure.proowner))) privilege
  where namespace.nspname = 'private'
    and procedure.proname in ('sync_workflow_compatibility', 'workflow_scope_is_active', 'workflow_actor_has_assignment', 'assert_onboarding_workflow_actor', 'assert_implementation_workflow_actor', 'assert_workflow_scope', 'assert_beauroi_workflow_owner', 'assert_customer_workflow_owner', 'guard_onboarding_plan', 'guard_onboarding_task', 'guard_training_session', 'guard_requested_document', 'guard_implementation_project', 'guard_milestone', 'guard_project_note', 'audit_workflow_change')
    and privilege.grantee = 0 and privilege.privilege_type = 'EXECUTE'
), 'PUBLIC cannot execute any private Milestone 3 helper');
select ok(not exists (
  select 1 from pg_proc procedure join pg_namespace namespace on namespace.oid = procedure.pronamespace
  where namespace.nspname = 'private'
    and procedure.proname in ('sync_workflow_compatibility', 'workflow_scope_is_active', 'workflow_actor_has_assignment', 'assert_onboarding_workflow_actor', 'assert_implementation_workflow_actor', 'assert_workflow_scope', 'assert_beauroi_workflow_owner', 'assert_customer_workflow_owner', 'guard_onboarding_plan', 'guard_onboarding_task', 'guard_training_session', 'guard_requested_document', 'guard_implementation_project', 'guard_milestone', 'guard_project_note', 'audit_workflow_change')
    and (has_function_privilege('anon', procedure.oid, 'EXECUTE') or has_function_privilege('authenticated', procedure.oid, 'EXECUTE'))
), 'anon and authenticated cannot execute private Milestone 3 helpers');
select ok((select bool_and(has_function_privilege(procedure.proowner, procedure.oid, 'EXECUTE'))
  from pg_proc procedure join pg_namespace namespace on namespace.oid = procedure.pronamespace
  where namespace.nspname = 'private' and procedure.proname like '%workflow%'), 'database owners retain internal helper execution');
select ok((select bool_and(relrowsecurity) from pg_class where oid in (
  'public.onboarding_plans'::regclass, 'public.onboarding_tasks'::regclass,
  'public.training_sessions'::regclass, 'public.requested_documents'::regclass,
  'public.implementation_projects'::regclass, 'public.milestones'::regclass,
  'public.project_notes'::regclass
)), 'RLS remains enabled on every exposed workflow table');
select ok(not has_function_privilege('anon', 'public.rls_auto_enable()', 'EXECUTE') and not has_function_privilege('authenticated', 'public.rls_auto_enable()', 'EXECUTE'), 'restricted rls_auto_enable privileges are preserved');

set local role authenticated;
set local request.jwt.claims = '{"sub":"31000000-0000-0000-0000-000000000008","role":"authenticated"}';

insert into public.onboarding_plans (id, organization_id, product_id, name, workflow_status)
values ('34000000-0000-0000-0000-000000000002', '32000000-0000-0000-0000-000000000002', '33000000-0000-0000-0000-000000000001', 'Scope freeze onboarding', 'NOT_STARTED');
insert into public.onboarding_tasks (id, organization_id, onboarding_plan_id, title, workflow_status)
values ('35000000-0000-0000-0000-000000000004', '32000000-0000-0000-0000-000000000002', '34000000-0000-0000-0000-000000000002', 'Scope freeze task', 'NOT_STARTED');
insert into public.training_sessions (id, organization_id, onboarding_plan_id, title, scheduled_at, duration_minutes, workflow_status)
values ('35500000-0000-0000-0000-000000000002', '32000000-0000-0000-0000-000000000002', '34000000-0000-0000-0000-000000000002', 'Scope freeze training', now() + interval '2 days', 60, 'SCHEDULED');
insert into public.requested_documents (id, organization_id, onboarding_plan_id, name, workflow_status)
values ('35600000-0000-0000-0000-000000000002', '32000000-0000-0000-0000-000000000002', '34000000-0000-0000-0000-000000000002', 'Scope freeze document', 'REQUESTED');
insert into public.implementation_projects (id, organization_id, product_id, name, workflow_status, phase)
values ('36000000-0000-0000-0000-000000000002', '32000000-0000-0000-0000-000000000002', '33000000-0000-0000-0000-000000000001', 'Scope freeze implementation', 'NOT_STARTED', 'DISCOVERY');
insert into public.milestones (id, organization_id, implementation_project_id, title, workflow_status)
values ('37000000-0000-0000-0000-000000000004', '32000000-0000-0000-0000-000000000002', '36000000-0000-0000-0000-000000000002', 'Scope freeze milestone', 'NOT_STARTED');

select lives_ok($$update public.onboarding_plans set workflow_status = 'CANCELLED' where id = '34000000-0000-0000-0000-000000000001'$$, 'administrator can cancel onboarding parent while scope is active');
select throws_ok($$update public.onboarding_tasks set title = 'Edit after parent cancellation' where id = '35000000-0000-0000-0000-000000000002'$$, '23514', null, 'task content edits fail after onboarding parent cancellation');
select throws_ok($$update public.onboarding_tasks set workflow_status = 'CANCELLED', title = 'Combined closure edit' where id = '35000000-0000-0000-0000-000000000002'$$, '23514', null, 'task cancellation cannot include unrelated changes');
select lives_ok($$update public.onboarding_tasks set workflow_status = 'CANCELLED' where id = '35000000-0000-0000-0000-000000000002'$$, 'task may be cancelled after onboarding parent cancellation');
select throws_ok($$update public.training_sessions set title = 'Edit after parent cancellation' where id = '35500000-0000-0000-0000-000000000001'$$, '23514', null, 'training content edits fail after onboarding parent cancellation');
select lives_ok($$update public.training_sessions set workflow_status = 'CANCELLED' where id = '35500000-0000-0000-0000-000000000001'$$, 'training may be cancelled after onboarding parent cancellation');
select throws_ok($$update public.requested_documents set name = 'Edit after parent cancellation' where id = '35600000-0000-0000-0000-000000000001'$$, '23514', null, 'document content edits fail after onboarding parent cancellation');
select lives_ok($$update public.requested_documents set workflow_status = 'WAIVED' where id = '35600000-0000-0000-0000-000000000001'$$, 'open document request may be waived after onboarding parent cancellation');

select lives_ok($$update public.implementation_projects set workflow_status = 'CANCELLED' where id = '36000000-0000-0000-0000-000000000001'$$, 'administrator can cancel implementation parent while scope is active');
select throws_ok($$update public.milestones set title = 'Edit after parent cancellation' where id = '37000000-0000-0000-0000-000000000002'$$, '23514', null, 'milestone content edits fail after implementation parent cancellation');
select throws_ok($$update public.milestones set workflow_status = 'CANCELLED', title = 'Combined closure edit' where id = '37000000-0000-0000-0000-000000000002'$$, '23514', null, 'milestone cancellation cannot include unrelated changes');
select lives_ok($$update public.milestones set workflow_status = 'CANCELLED' where id = '37000000-0000-0000-0000-000000000002'$$, 'milestone may be cancelled after implementation parent cancellation');
select throws_ok($$insert into public.project_notes (organization_id, implementation_project_id, body, visibility) values ('32000000-0000-0000-0000-000000000002', '36000000-0000-0000-0000-000000000001', 'Note after parent cancellation', 'INTERNAL')$$, '23514', null, 'project notes are rejected after implementation parent cancellation');
select throws_ok($$select public.set_implementation_requirement('36000000-0000-0000-0000-000000000001', 'late parent change')$$, '23514', null, 'requirements cannot be changed after project cancellation');

reset role;
set local session_replication_role = replica;
update public.customer_subscriptions set status = 'ARCHIVED' where organization_id = '32000000-0000-0000-0000-000000000002';
update public.organizations set is_active = false where id = '32000000-0000-0000-0000-000000000002';
update public.organization_memberships set status = 'SUSPENDED' where user_id = '31000000-0000-0000-0000-000000000001';
set local session_replication_role = origin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"31000000-0000-0000-0000-000000000008","role":"authenticated"}';

select throws_ok($$update public.onboarding_plans set name = 'Edit after deactivation' where id = '34000000-0000-0000-0000-000000000001'$$, '23514', null, 'non-cancellation plan edits fail after scope deactivation');
select throws_ok($$update public.implementation_projects set name = 'Edit after deactivation' where id = '36000000-0000-0000-0000-000000000001'$$, '23514', null, 'non-cancellation project edits fail after scope deactivation');
select throws_ok($$update public.onboarding_tasks set title = 'Task content after deactivation' where id = '35000000-0000-0000-0000-000000000004'$$, '23514', null, 'task content edits fail after scope deactivation');
select throws_ok($$update public.onboarding_tasks set workflow_status = 'CANCELLED', title = 'Task closure edit after deactivation' where id = '35000000-0000-0000-0000-000000000004'$$, '23514', null, 'task scope closure cannot include unrelated changes');
select lives_ok($$update public.onboarding_tasks set workflow_status = 'CANCELLED' where id = '35000000-0000-0000-0000-000000000004'$$, 'task may be cancelled after scope deactivation');
select throws_ok($$update public.training_sessions set title = 'Training content after deactivation' where id = '35500000-0000-0000-0000-000000000002'$$, '23514', null, 'training content edits fail after scope deactivation');
select lives_ok($$update public.training_sessions set workflow_status = 'CANCELLED' where id = '35500000-0000-0000-0000-000000000002'$$, 'training may be cancelled after scope deactivation');
select throws_ok($$update public.requested_documents set name = 'Document content after deactivation' where id = '35600000-0000-0000-0000-000000000002'$$, '23514', null, 'document content edits fail after scope deactivation');
select throws_ok($$update public.requested_documents set workflow_status = 'WAIVED', name = 'Document closure edit after deactivation' where id = '35600000-0000-0000-0000-000000000002'$$, '23514', null, 'document scope closure cannot include unrelated changes');
select lives_ok($$update public.requested_documents set workflow_status = 'WAIVED' where id = '35600000-0000-0000-0000-000000000002'$$, 'document may be waived after scope deactivation');
select throws_ok($$update public.milestones set title = 'Milestone content after deactivation' where id = '37000000-0000-0000-0000-000000000004'$$, '23514', null, 'milestone content edits fail after scope deactivation');
select throws_ok($$update public.milestones set workflow_status = 'CANCELLED', title = 'Milestone closure edit after deactivation' where id = '37000000-0000-0000-0000-000000000004'$$, '23514', null, 'milestone scope closure cannot include unrelated changes');
select lives_ok($$update public.milestones set workflow_status = 'CANCELLED' where id = '37000000-0000-0000-0000-000000000004'$$, 'milestone may be cancelled after scope deactivation');
select throws_ok($$insert into public.project_notes (organization_id, implementation_project_id, body, visibility) values ('32000000-0000-0000-0000-000000000002', '36000000-0000-0000-0000-000000000002', 'Note after scope deactivation', 'INTERNAL')$$, '23514', null, 'project notes are rejected after scope deactivation');
select throws_ok($$insert into public.onboarding_tasks (organization_id, onboarding_plan_id, title, workflow_status) values ('32000000-0000-0000-0000-000000000002', '34000000-0000-0000-0000-000000000002', 'New task after scope deactivation', 'NOT_STARTED')$$, '23514', null, 'new child workflows are rejected after scope deactivation');
select throws_ok($$select public.set_implementation_requirement('36000000-0000-0000-0000-000000000002', 'late scope change')$$, '23514', null, 'requirements cannot be changed after scope deactivation');
select lives_ok($$update public.onboarding_plans set workflow_status = 'CANCELLED' where id = '34000000-0000-0000-0000-000000000002'$$, 'existing onboarding can be cancelled after scope deactivation');
select lives_ok($$update public.implementation_projects set workflow_status = 'CANCELLED' where id = '36000000-0000-0000-0000-000000000002'$$, 'existing implementation can be cancelled after scope deactivation');
select throws_ok($$insert into public.implementation_projects (organization_id, product_id, name) values ('32000000-0000-0000-0000-000000000002', '33000000-0000-0000-0000-000000000001', 'New inactive project')$$, '23514', null, 'new workflows still require active scope');

reset role;
select is((select count(*)::integer from private.implementation_project_requirements where implementation_project_id = '36000000-0000-0000-0000-000000000001'), 1, 'maintenance fixture has one private requirement');
delete from public.implementation_projects where id = '36000000-0000-0000-0000-000000000001';
select is((select count(*)::integer from private.implementation_project_requirements where implementation_project_id = '36000000-0000-0000-0000-000000000001'), 0, 'database-owner cleanup preserves requirement cascade behavior');

select * from finish();
rollback;
