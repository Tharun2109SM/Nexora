begin;

select plan(80);

insert into auth.users (id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data)
values
  ('91000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'support-admin@example.test', 'test', '{"nexora_account_type":"BEAUROI"}', '{"full_name":"Support Admin"}'),
  ('91000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'assigned-support@example.test', 'test', '{"nexora_account_type":"BEAUROI"}', '{"full_name":"Assigned Support"}'),
  ('91000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'unassigned-support@example.test', 'test', '{"nexora_account_type":"BEAUROI"}', '{"full_name":"Unassigned Support"}'),
  ('91000000-0000-4000-8000-000000000004', 'authenticated', 'authenticated', 'wrong-org-support@example.test', 'test', '{"nexora_account_type":"BEAUROI"}', '{"full_name":"Wrong Organization Support"}'),
  ('91000000-0000-4000-8000-000000000005', 'authenticated', 'authenticated', 'wrong-product-support@example.test', 'test', '{"nexora_account_type":"BEAUROI"}', '{"full_name":"Wrong Product Support"}'),
  ('91000000-0000-4000-8000-000000000006', 'authenticated', 'authenticated', 'ended-support@example.test', 'test', '{"nexora_account_type":"BEAUROI"}', '{"full_name":"Ended Support"}'),
  ('91000000-0000-4000-8000-000000000007', 'authenticated', 'authenticated', 'suspended-support@example.test', 'test', '{"nexora_account_type":"BEAUROI"}', '{"full_name":"Suspended Support"}'),
  ('91000000-0000-4000-8000-000000000008', 'authenticated', 'authenticated', 'customer-admin-a@example.test', 'test', '{"nexora_account_type":"BEAUROI"}', '{"full_name":"Customer Admin A"}'),
  ('91000000-0000-4000-8000-000000000009', 'authenticated', 'authenticated', 'customer-member-a@example.test', 'test', '{"nexora_account_type":"BEAUROI"}', '{"full_name":"Customer Member A"}'),
  ('91000000-0000-4000-8000-00000000000a', 'authenticated', 'authenticated', 'customer-member-b@example.test', 'test', '{"nexora_account_type":"BEAUROI"}', '{"full_name":"Customer Member B"}');

insert into public.organizations (id, name, slug, organization_type)
values
  ('a1000000-0000-4000-8000-000000000001', 'Beau Roi Support', 'beau-roi-support', 'BEAUROI'),
  ('a2000000-0000-4000-8000-000000000001', 'Support Customer A', 'support-customer-a', 'CUSTOMER'),
  ('a3000000-0000-4000-8000-000000000001', 'Support Customer B', 'support-customer-b', 'CUSTOMER');

insert into public.organization_memberships (organization_id, user_id, role, status, is_primary, joined_at)
values
  ('a1000000-0000-4000-8000-000000000001', '91000000-0000-4000-8000-000000000001', 'BEAUROI_ADMIN', 'ACTIVE', true, now()),
  ('a1000000-0000-4000-8000-000000000001', '91000000-0000-4000-8000-000000000002', 'BEAUROI_EMPLOYEE', 'ACTIVE', true, now()),
  ('a1000000-0000-4000-8000-000000000001', '91000000-0000-4000-8000-000000000003', 'BEAUROI_EMPLOYEE', 'ACTIVE', true, now()),
  ('a1000000-0000-4000-8000-000000000001', '91000000-0000-4000-8000-000000000004', 'BEAUROI_EMPLOYEE', 'ACTIVE', true, now()),
  ('a1000000-0000-4000-8000-000000000001', '91000000-0000-4000-8000-000000000005', 'BEAUROI_EMPLOYEE', 'ACTIVE', true, now()),
  ('a1000000-0000-4000-8000-000000000001', '91000000-0000-4000-8000-000000000006', 'BEAUROI_EMPLOYEE', 'ACTIVE', true, now()),
  ('a1000000-0000-4000-8000-000000000001', '91000000-0000-4000-8000-000000000007', 'BEAUROI_EMPLOYEE', 'SUSPENDED', true, null),
  ('a2000000-0000-4000-8000-000000000001', '91000000-0000-4000-8000-000000000008', 'CUSTOMER_ADMIN', 'ACTIVE', true, now()),
  ('a2000000-0000-4000-8000-000000000001', '91000000-0000-4000-8000-000000000009', 'CUSTOMER_MEMBER', 'ACTIVE', true, now()),
  ('a3000000-0000-4000-8000-000000000001', '91000000-0000-4000-8000-00000000000a', 'CUSTOMER_MEMBER', 'ACTIVE', true, now());

insert into public.products (id, code, name, status)
values
  ('b1000000-0000-4000-8000-000000000001', 'SUPPORT_ONE', 'Support Product One', 'ACTIVE'),
  ('b2000000-0000-4000-8000-000000000001', 'SUPPORT_TWO', 'Support Product Two', 'ACTIVE');

insert into public.customer_subscriptions (organization_id, product_id, status)
values
  ('a2000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000001', 'ACTIVE'),
  ('a2000000-0000-4000-8000-000000000001', 'b2000000-0000-4000-8000-000000000001', 'ACTIVE'),
  ('a3000000-0000-4000-8000-000000000001', 'b2000000-0000-4000-8000-000000000001', 'ACTIVE');

insert into public.support_categories (id, code, name, product_id, sort_order)
values
  ('c1000000-0000-4000-8000-000000000001', 'TEST_GENERAL', 'Test general support', null, 10),
  ('c2000000-0000-4000-8000-000000000001', 'TEST_PRODUCT_ONE', 'Test product one', 'b1000000-0000-4000-8000-000000000001', 20),
  ('c3000000-0000-4000-8000-000000000001', 'TEST_PRODUCT_TWO', 'Test product two', 'b2000000-0000-4000-8000-000000000001', 30);

insert into public.sla_policies (
  id, organization_id, product_id, name, priority, first_response_minutes, resolution_minutes
)
values
  ('d1000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000001', null, 'Test organization medium', 'MEDIUM', 120, 1440),
  ('d2000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000001', 'Test product medium', 'MEDIUM', 60, 720);

set session_replication_role = replica;
insert into public.customer_assignments (
  id, organization_id, product_id, employee_user_id, assignment_type,
  is_active, assigned_at, ended_at
)
values
  ('d3000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000001', '91000000-0000-4000-8000-000000000002', 'SUPPORT_LEAD', true, now(), null),
  ('d3000000-0000-4000-8000-000000000002', 'a3000000-0000-4000-8000-000000000001', null, '91000000-0000-4000-8000-000000000004', 'SUPPORT_LEAD', true, now(), null),
  ('d3000000-0000-4000-8000-000000000003', 'a2000000-0000-4000-8000-000000000001', 'b2000000-0000-4000-8000-000000000001', '91000000-0000-4000-8000-000000000005', 'SUPPORT_LEAD', true, now(), null),
  ('d3000000-0000-4000-8000-000000000004', 'a2000000-0000-4000-8000-000000000001', null, '91000000-0000-4000-8000-000000000006', 'SUPPORT_LEAD', false, now() - interval '2 days', now() - interval '1 day'),
  ('d3000000-0000-4000-8000-000000000005', 'a2000000-0000-4000-8000-000000000001', null, '91000000-0000-4000-8000-000000000007', 'SUPPORT_LEAD', true, now(), null);
set session_replication_role = origin;

insert into public.support_tickets (
  id, organization_id, product_id, category_id, subject, description, status,
  priority, created_by, last_activity_at
)
values
  ('e1000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000001', 'c2000000-0000-4000-8000-000000000001', 'Customer A support fixture', 'Customer A ticket description', 'OPEN', 'MEDIUM', '91000000-0000-4000-8000-000000000008', now()),
  ('e2000000-0000-4000-8000-000000000001', 'a3000000-0000-4000-8000-000000000001', 'b2000000-0000-4000-8000-000000000001', 'c3000000-0000-4000-8000-000000000001', 'Customer B support fixture', 'Customer B ticket description', 'OPEN', 'MEDIUM', '91000000-0000-4000-8000-00000000000a', now()),
  ('e3000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000001', 'c2000000-0000-4000-8000-000000000001', 'First response fixture', 'First response ticket description', 'OPEN', 'MEDIUM', '91000000-0000-4000-8000-000000000008', now()),
  ('e4000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000001', 'c2000000-0000-4000-8000-000000000001', 'Lifecycle fixture', 'Lifecycle ticket description', 'OPEN', 'MEDIUM', '91000000-0000-4000-8000-000000000008', now()),
  ('e5000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000001', 'c2000000-0000-4000-8000-000000000001', 'Controlled close fixture', 'Controlled close description', 'OPEN', 'MEDIUM', '91000000-0000-4000-8000-000000000008', now());

insert into public.ticket_messages (id, organization_id, ticket_id, author_user_id, body, is_internal)
values
  ('f1000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000001', 'e1000000-0000-4000-8000-000000000001', '91000000-0000-4000-8000-000000000008', 'Visible customer fixture message', false),
  ('f2000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000001', 'e1000000-0000-4000-8000-000000000001', '91000000-0000-4000-8000-000000000002', 'Internal fixture note', true),
  ('f3000000-0000-4000-8000-000000000001', 'a3000000-0000-4000-8000-000000000001', 'e2000000-0000-4000-8000-000000000001', '91000000-0000-4000-8000-00000000000a', 'Other organization fixture message', false);

insert into public.support_ticket_events (
  id, organization_id, ticket_id, event_type, actor_user_id, customer_visible, metadata
)
values
  ('f4000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000001', 'e1000000-0000-4000-8000-000000000001', 'TICKET_CREATED', '91000000-0000-4000-8000-000000000008', true, '{}'),
  ('f5000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000001', 'e1000000-0000-4000-8000-000000000001', 'INTERNAL_NOTE_ADDED', '91000000-0000-4000-8000-000000000002', false, '{}'),
  ('f6000000-0000-4000-8000-000000000001', 'a3000000-0000-4000-8000-000000000001', 'e2000000-0000-4000-8000-000000000001', 'TICKET_CREATED', '91000000-0000-4000-8000-00000000000a', true, '{}');

insert into public.attachments (
  id, organization_id, uploaded_by, entity_type, entity_id, object_key,
  original_filename, content_type, size_bytes
)
values
  ('11000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000001', '91000000-0000-4000-8000-000000000008', 'TICKET', 'e1000000-0000-4000-8000-000000000001', 'private/a/ticket.txt', 'ticket.txt', 'text/plain', 10),
  ('11000000-0000-4000-8000-000000000002', 'a2000000-0000-4000-8000-000000000001', '91000000-0000-4000-8000-000000000002', 'TICKET_MESSAGE', 'f2000000-0000-4000-8000-000000000001', 'private/a/internal.txt', 'internal.txt', 'text/plain', 10),
  ('11000000-0000-4000-8000-000000000003', 'a3000000-0000-4000-8000-000000000001', '91000000-0000-4000-8000-00000000000a', 'TICKET', 'e2000000-0000-4000-8000-000000000001', 'private/b/ticket.txt', 'other.txt', 'text/plain', 10);

insert into public.notifications (
  id, organization_id, user_id, title, body, category, status, read_at
)
values
  ('12000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000001', '91000000-0000-4000-8000-000000000008', 'Test notification', 'Test body', 'SUPPORT', 'UNREAD', null),
  ('12000000-0000-4000-8000-000000000002', 'a2000000-0000-4000-8000-000000000001', '91000000-0000-4000-8000-000000000009', 'Other recipient', 'Other body', 'SUPPORT', 'UNREAD', null);

select ok(not has_table_privilege('authenticated', 'public.support_tickets', 'INSERT'), 'authenticated cannot directly insert support tickets');
select ok(not has_table_privilege('authenticated', 'public.support_tickets', 'DELETE'), 'authenticated cannot delete support tickets');
select ok(not has_table_privilege('authenticated', 'public.ticket_messages', 'INSERT'), 'authenticated cannot directly insert ticket messages');
select ok(not has_table_privilege('authenticated', 'public.ticket_messages', 'UPDATE'), 'ticket message history cannot be updated');
select ok(not has_table_privilege('authenticated', 'public.ticket_messages', 'DELETE'), 'ticket message history cannot be deleted');
select ok(not has_table_privilege('authenticated', 'public.support_ticket_events', 'INSERT'), 'authenticated cannot forge support events');
select ok(not has_table_privilege('authenticated', 'public.support_ticket_events', 'UPDATE'), 'support event history cannot be updated');
select ok(not has_table_privilege('authenticated', 'public.support_ticket_events', 'DELETE'), 'support event history cannot be deleted');
select ok(not has_column_privilege('authenticated', 'public.attachments', 'object_key', 'SELECT'), 'attachment object keys are not selectable');
select ok(not has_table_privilege('authenticated', 'public.attachments', 'INSERT'), 'authenticated cannot directly insert attachment metadata');
select ok(not has_table_privilege('authenticated', 'public.notifications', 'INSERT'), 'authenticated cannot forge notifications');
select ok(not has_column_privilege('authenticated', 'public.notifications', 'title', 'UPDATE'), 'notification title is immutable to authenticated users');
select ok(not has_function_privilege('authenticated', 'private.support_actor_has_assignment(uuid,uuid)', 'EXECUTE'), 'private support authorization helper is not exposed');
select ok(has_function_privilege('authenticated', 'public.create_support_ticket(uuid,uuid,uuid,text,text)', 'EXECUTE'), 'customer ticket creation RPC has explicit execute permission');
select ok(has_function_privilege('authenticated', 'public.add_support_ticket_message(uuid,text,boolean)', 'EXECUTE'), 'ticket message RPC has explicit execute permission');

set local role authenticated;
set local request.jwt.claims = '{"sub":"91000000-0000-4000-8000-000000000008","role":"authenticated"}';

select is((select count(*)::integer from public.support_tickets), 4, 'customer A sees only its own tickets');
select ok(not exists(select 1 from public.support_tickets where id = 'e2000000-0000-4000-8000-000000000001'), 'customer A cannot read customer B ticket');
select is((select count(*)::integer from public.ticket_messages), 1, 'customer admin sees only own customer-visible messages');
select ok(not exists(select 1 from public.ticket_messages where id = 'f2000000-0000-4000-8000-000000000001'), 'customer admin cannot read internal note');
select ok(not exists(select 1 from public.ticket_messages where id = 'f3000000-0000-4000-8000-000000000001'), 'customer A cannot read customer B messages');
select is((select count(*)::integer from public.support_ticket_events), 1, 'customer sees only own customer-visible events');
select ok(not exists(select 1 from public.support_ticket_events where id = 'f5000000-0000-4000-8000-000000000001'), 'customer cannot read internal event');
select is((select count(id)::integer from public.attachments), 1, 'customer sees only safe ticket attachment metadata');
select ok(not exists(select 1 from public.attachments where id = '11000000-0000-4000-8000-000000000002'), 'internal-note attachment is invisible to customer');
select throws_ok(
  $$select object_key from public.attachments where id = '11000000-0000-4000-8000-000000000001'$$,
  '42501', null, 'customer cannot select private attachment object key'
);
select throws_ok(
  $$select public.create_support_ticket('a3000000-0000-4000-8000-000000000001', 'b2000000-0000-4000-8000-000000000001', 'c3000000-0000-4000-8000-000000000001', 'Forged organization ticket', 'This must be rejected')$$,
  '42501', 'Active customer organization membership is required', 'customer cannot create for another organization'
);
select throws_ok(
  $$select public.add_support_ticket_message('e1000000-0000-4000-8000-000000000001', 'Forged internal note', true)$$,
  '42501', 'Customer users cannot create internal support messages', 'customer cannot create an internal message'
);
select set_config('nexora.support_message_insert', 'on', true);
select throws_ok(
  $$insert into public.ticket_messages (organization_id, ticket_id, author_user_id, body, is_internal)
    values ('a2000000-0000-4000-8000-000000000001', 'e1000000-0000-4000-8000-000000000001', '91000000-0000-4000-8000-000000000008', 'Spoofed guarded message', false)$$,
  '42501', null, 'customer cannot spoof the internal message workflow marker'
);
select set_config('nexora.support_message_insert', '', true);
select lives_ok(
  $$select public.add_support_ticket_message('e1000000-0000-4000-8000-000000000001', 'Customer visible reply', false)$$,
  'customer can add an own-organization visible reply'
);
select is(
  (select count(*)::integer from public.ticket_messages where ticket_id = 'e1000000-0000-4000-8000-000000000001'),
  2,
  'customer-visible reply is persisted without revealing the internal note'
);
select results_eq(
  $$update public.support_tickets set status = 'IN_PROGRESS'
    where id = 'e1000000-0000-4000-8000-000000000001' returning id$$,
  array[]::uuid[],
  'customer cannot directly mutate ticket lifecycle'
);

reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"91000000-0000-4000-8000-000000000009","role":"authenticated"}';
select ok(not exists(select 1 from public.ticket_messages where is_internal), 'customer member cannot read internal notes');

reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"91000000-0000-4000-8000-00000000000a","role":"authenticated"}';
select is((select count(*)::integer from public.support_tickets), 1, 'customer B sees only its own ticket');
select is((select count(id)::integer from public.attachments), 1, 'customer B sees only its own attachment metadata');

reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"91000000-0000-4000-8000-000000000008","role":"authenticated"}';
select lives_ok(
  $$select public.create_support_ticket('a2000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000001', 'c2000000-0000-4000-8000-000000000001', 'RPC product ticket', 'Secure customer ticket creation')$$,
  'customer ticket creation workflow succeeds for own active subscription'
);
select is(
  (select status::text from public.support_tickets where subject = 'RPC product ticket'),
  'OPEN',
  'customer-created ticket always starts OPEN'
);
select is(
  (select created_by from public.support_tickets where subject = 'RPC product ticket'),
  '91000000-0000-4000-8000-000000000008'::uuid,
  'customer-created ticket derives created_by from auth.uid'
);
select is(
  (select organization_id from public.support_tickets where subject = 'RPC product ticket'),
  'a2000000-0000-4000-8000-000000000001'::uuid,
  'customer-created ticket remains in the authorized organization'
);
select is(
  (select sla_policy_id from public.support_tickets where subject = 'RPC product ticket'),
  'd2000000-0000-4000-8000-000000000001'::uuid,
  'product-specific SLA deterministically overrides organization-wide policy'
);
select ok(
  (select first_response_due_at is not null and resolution_due_at is not null
   from public.support_tickets where subject = 'RPC product ticket'),
  'selected SLA deadlines are snapshotted on the ticket'
);
select throws_ok(
  $$select public.create_support_ticket('a2000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000001', 'c3000000-0000-4000-8000-000000000001', 'Wrong category product', 'Mismatched category must fail')$$,
  '23514', 'An active support category applicable to the ticket product is required', 'mismatched product category is rejected'
);

reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"91000000-0000-4000-8000-00000000000a","role":"authenticated"}';
select throws_ok(
  $$select public.create_support_ticket('a3000000-0000-4000-8000-000000000001', null, 'c1000000-0000-4000-8000-000000000001', 'General no policy ticket', 'Null product remains schema-compatible but is not customer-enabled')$$,
  '23514', 'Customer ticket creation requires an active subscribed product', 'null-product customer workflow remains disabled pending approval'
);
select lives_ok(
  $$select public.create_support_ticket('a3000000-0000-4000-8000-000000000001', 'b2000000-0000-4000-8000-000000000001', 'c3000000-0000-4000-8000-000000000001', 'Subscribed no policy ticket', 'No policy must not invent deadlines')$$,
  'subscribed product remains usable when no SLA policy exists'
);
select ok(
  (select sla_policy_id is null and first_response_due_at is null and resolution_due_at is null
   from public.support_tickets where subject = 'Subscribed no policy ticket'),
  'no-policy path creates no invented SLA deadlines'
);

reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"91000000-0000-4000-8000-000000000003","role":"authenticated"}';
select throws_ok(
  $$update public.support_tickets set priority = 'HIGH'
    where id = 'e1000000-0000-4000-8000-000000000001'$$,
  '42501', 'An active support assignment is required',
  'active but unassigned Beau Roi employee cannot mutate ticket'
);
select throws_ok(
  $$select public.add_support_ticket_message('e1000000-0000-4000-8000-000000000001', 'Unassigned staff reply', false)$$,
  '42501', 'Ticket message access is unavailable', 'unassigned employee cannot reply'
);

reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"91000000-0000-4000-8000-000000000004","role":"authenticated"}';
select throws_ok(
  $$update public.support_tickets set priority = 'HIGH'
    where id = 'e1000000-0000-4000-8000-000000000001'$$,
  '42501', 'An active support assignment is required',
  'employee assigned to another organization cannot mutate ticket'
);

reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"91000000-0000-4000-8000-000000000005","role":"authenticated"}';
select throws_ok(
  $$update public.support_tickets set priority = 'HIGH'
    where id = 'e1000000-0000-4000-8000-000000000001'$$,
  '42501', 'An active support assignment is required',
  'mismatched product support assignment cannot mutate ticket'
);

reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"91000000-0000-4000-8000-000000000006","role":"authenticated"}';
select throws_ok(
  $$update public.support_tickets set priority = 'HIGH'
    where id = 'e1000000-0000-4000-8000-000000000001'$$,
  '42501', 'An active support assignment is required',
  'ended support assignment cannot mutate ticket'
);

reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"91000000-0000-4000-8000-000000000007","role":"authenticated"}';
select results_eq(
  $$update public.support_tickets set priority = 'HIGH'
    where id = 'e1000000-0000-4000-8000-000000000001' returning id$$,
  array[]::uuid[],
  'suspended support employee cannot mutate ticket'
);

reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"91000000-0000-4000-8000-000000000002","role":"authenticated"}';
select set_config('nexora.support_internal_update', 'on', true);
select throws_ok(
  $$update public.support_tickets set priority = 'HIGH' where id = 'e1000000-0000-4000-8000-000000000001'$$,
  '42501', null, 'assigned employee cannot spoof the internal ticket-update marker'
);
select set_config('nexora.support_internal_update', '', true);
select lives_ok(
  $$update public.support_tickets set priority = 'HIGH' where id = 'e1000000-0000-4000-8000-000000000001'$$,
  'correctly assigned support employee can mutate matching ticket'
);
select is((select priority::text from public.support_tickets where id = 'e1000000-0000-4000-8000-000000000001'), 'HIGH', 'assigned support mutation persists');
select lives_ok(
  $$select public.add_support_ticket_message('e3000000-0000-4000-8000-000000000001', 'Internal note before response', true)$$,
  'assigned employee can add internal note'
);
select ok((select first_responded_at is null from public.support_tickets where id = 'e3000000-0000-4000-8000-000000000001'), 'internal note does not set first response');
select lives_ok(
  $$select public.add_support_ticket_message('e3000000-0000-4000-8000-000000000001', 'First customer-visible staff response', false)$$,
  'assigned employee can add customer-visible response'
);
select ok((select first_responded_at is not null from public.support_tickets where id = 'e3000000-0000-4000-8000-000000000001'), 'first visible staff response sets first_responded_at');
create temporary table first_response_snapshot as
select first_responded_at from public.support_tickets where id = 'e3000000-0000-4000-8000-000000000001';
select public.add_support_ticket_message('e3000000-0000-4000-8000-000000000001', 'Second customer-visible staff response', false);
select is(
  (select first_responded_at from public.support_tickets where id = 'e3000000-0000-4000-8000-000000000001'),
  (select first_responded_at from first_response_snapshot),
  'later visible staff response does not overwrite first response timestamp'
);

select lives_ok(
  $$update public.support_tickets set status = 'IN_PROGRESS' where id = 'e4000000-0000-4000-8000-000000000001'$$,
  'OPEN to IN_PROGRESS succeeds'
);
select throws_ok(
  $$update public.support_tickets set status = 'CLOSED', resolution_summary = 'Invalid direct close' where id = 'e4000000-0000-4000-8000-000000000001'$$,
  '23514', 'Invalid support ticket status transition: IN_PROGRESS -> CLOSED', 'invalid IN_PROGRESS to CLOSED transition fails'
);
select throws_ok(
  $$update public.support_tickets set status = 'RESOLVED' where id = 'e4000000-0000-4000-8000-000000000001'$$,
  '23514', 'Resolved and closed tickets require a resolution summary', 'RESOLVED requires summary'
);
select lives_ok(
  $$update public.support_tickets set status = 'WAITING_ON_CUSTOMER' where id = 'e4000000-0000-4000-8000-000000000001'$$,
  'IN_PROGRESS to WAITING_ON_CUSTOMER succeeds'
);
select lives_ok(
  $$update public.support_tickets set status = 'RESOLVED', resolution_summary = 'Verified test resolution' where id = 'e4000000-0000-4000-8000-000000000001'$$,
  'WAITING_ON_CUSTOMER to RESOLVED succeeds with summary'
);
select ok(
  (select resolved_at is not null and closed_at is null and resolution_summary = 'Verified test resolution'
   from public.support_tickets where id = 'e4000000-0000-4000-8000-000000000001'),
  'RESOLVED timestamps and summary are consistent'
);
select lives_ok(
  $$update public.support_tickets set status = 'IN_PROGRESS' where id = 'e4000000-0000-4000-8000-000000000001'$$,
  'RESOLVED ticket can reopen to IN_PROGRESS'
);
select ok(
  (select resolved_at is null and resolution_summary is null
   from public.support_tickets where id = 'e4000000-0000-4000-8000-000000000001'),
  'reopening clears protected resolution state'
);
select lives_ok(
  $$update public.support_tickets set status = 'CLOSED', resolution_summary = 'Controlled invalid-ticket closure' where id = 'e5000000-0000-4000-8000-000000000001'$$,
  'controlled OPEN to CLOSED succeeds with summary'
);
select ok((select closed_at is not null from public.support_tickets where id = 'e5000000-0000-4000-8000-000000000001'), 'CLOSED timestamp is database-controlled');
select throws_ok(
  $$update public.support_tickets set priority = 'URGENT' where id = 'e5000000-0000-4000-8000-000000000001'$$,
  '23514', 'Closed support tickets are immutable', 'CLOSED is terminal for normal roles'
);

reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"91000000-0000-4000-8000-000000000001","role":"authenticated"}';
select lives_ok(
  $$update public.support_tickets set priority = 'URGENT' where id = 'e2000000-0000-4000-8000-000000000001'$$,
  'Beau Roi administrator override can mutate any customer ticket'
);
select throws_ok(
  $$insert into public.sla_policies (organization_id, product_id, name, priority, first_response_minutes) values ('a2000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000001', 'Duplicate active test', 'MEDIUM', 30)$$,
  '23505', null, 'duplicate active product SLA policy is rejected'
);
create temporary table ticket_deadline_snapshot as
select first_response_due_at, resolution_due_at
from public.support_tickets where subject = 'RPC product ticket';
update public.sla_policies
set first_response_minutes = 90, resolution_minutes = 900
where id = 'd2000000-0000-4000-8000-000000000001';
select ok(
  (select row(ticket.first_response_due_at, ticket.resolution_due_at)
      is not distinct from row(snapshot.first_response_due_at, snapshot.resolution_due_at)
   from public.support_tickets ticket cross join ticket_deadline_snapshot snapshot
   where ticket.subject = 'RPC product ticket'),
  'policy edits do not alter historical ticket deadline snapshots'
);
select ok(
  (select count(*) >= 1 from public.audit_events where action = 'SUPPORT_TICKET_STATUS_CHANGED'),
  'ticket lifecycle changes create audit events'
);
select ok(
  not exists (
    select 1 from public.audit_events
    where metadata::text like '%First customer-visible staff response%'
       or metadata::text like '%Internal note before response%'
       or metadata::text like '%private/%'
  ),
  'audit metadata excludes message bodies, internal-note content, and private object keys'
);

reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"91000000-0000-4000-8000-000000000008","role":"authenticated"}';
select lives_ok(
  $$update public.notifications set status = 'READ', read_at = '2000-01-01T00:00:00Z' where id = '12000000-0000-4000-8000-000000000001'$$,
  'notification recipient can mark own notification read'
);
select ok(
  (select status = 'READ' and read_at > '2026-01-01T00:00:00Z'
   from public.notifications where id = '12000000-0000-4000-8000-000000000001'),
  'notification read timestamp is database-controlled'
);
select results_eq(
  $$update public.notifications set status = 'READ'
    where id = '12000000-0000-4000-8000-000000000002' returning id$$,
  array[]::uuid[],
  'user cannot mutate another recipient notification'
);
select lives_ok(
  $$update public.notifications set status = 'ARCHIVED' where id = '12000000-0000-4000-8000-000000000001'$$,
  'notification recipient can archive a read notification'
);
select throws_ok(
  $$update public.notifications set status = 'READ' where id = '12000000-0000-4000-8000-000000000001'$$,
  '23514', 'Archived notifications cannot be restored', 'archived notification state is terminal'
);

reset role;
select throws_ok(
  $$insert into public.attachments (organization_id, uploaded_by, entity_type, entity_id, object_key, original_filename, content_type, size_bytes) values ('a3000000-0000-4000-8000-000000000001', '91000000-0000-4000-8000-000000000001', 'TICKET', 'e1000000-0000-4000-8000-000000000001', 'private/mismatch', 'mismatch.txt', 'text/plain', 1)$$,
  '23514', 'Ticket attachment organization must match its parent ticket', 'attachment parent organization mismatch is rejected'
);

select * from finish();
rollback;
