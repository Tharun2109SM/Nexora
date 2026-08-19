\set ON_ERROR_STOP on

insert into auth.users (id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data)
values
  ('71000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'legacy-support@example.test', 'test', '{"nexora_account_type":"BEAUROI"}', '{"full_name":"Legacy Support"}'),
  ('71000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'legacy-customer@example.test', 'test', '{"nexora_account_type":"BEAUROI"}', '{"full_name":"Legacy Customer"}');

insert into public.organizations (id, name, slug, organization_type)
values
  ('72000000-0000-4000-8000-000000000001', 'Legacy Beau Roi Support', 'legacy-beau-roi-support', 'BEAUROI'),
  ('72000000-0000-4000-8000-000000000002', 'Legacy Support Customer', 'legacy-support-customer', 'CUSTOMER');

insert into public.organization_memberships (organization_id, user_id, role, status, is_primary, joined_at)
values
  ('72000000-0000-4000-8000-000000000001', '71000000-0000-4000-8000-000000000001', 'BEAUROI_ADMIN', 'ACTIVE', true, now()),
  ('72000000-0000-4000-8000-000000000002', '71000000-0000-4000-8000-000000000002', 'CUSTOMER_ADMIN', 'ACTIVE', true, now());

insert into public.products (id, code, name, status)
values ('73000000-0000-4000-8000-000000000001', 'LEGACY_SUPPORT', 'Legacy Support Product', 'ACTIVE');

insert into public.customer_subscriptions (organization_id, product_id, status)
values ('72000000-0000-4000-8000-000000000002', '73000000-0000-4000-8000-000000000001', 'ACTIVE');

insert into public.sla_policies (
  id, organization_id, product_id, name, priority, first_response_minutes, resolution_minutes
)
values (
  '74000000-0000-4000-8000-000000000001',
  '72000000-0000-4000-8000-000000000002',
  '73000000-0000-4000-8000-000000000001',
  'Legacy populated policy', 'MEDIUM', 60, 720
);

insert into public.support_tickets (
  id, organization_id, product_id, subject, description, status, priority,
  created_by, sla_policy_id, first_response_due_at, resolution_due_at,
  created_at, updated_at
)
values (
  '75000000-0000-4000-8000-000000000001',
  '72000000-0000-4000-8000-000000000002',
  '73000000-0000-4000-8000-000000000001',
  'Legacy populated support ticket', 'Legacy support description', 'OPEN', 'MEDIUM',
  '71000000-0000-4000-8000-000000000002',
  '74000000-0000-4000-8000-000000000001',
  now() + interval '60 minutes', now() + interval '720 minutes',
  now() - interval '2 hours', now() - interval '2 hours'
);

insert into public.ticket_messages (
  id, organization_id, ticket_id, author_user_id, body, is_internal, created_at, updated_at
)
values
  ('76000000-0000-4000-8000-000000000001', '72000000-0000-4000-8000-000000000002', '75000000-0000-4000-8000-000000000001', '71000000-0000-4000-8000-000000000002', 'Legacy visible message', false, now() - interval '90 minutes', now() - interval '90 minutes'),
  ('76000000-0000-4000-8000-000000000002', '72000000-0000-4000-8000-000000000002', '75000000-0000-4000-8000-000000000001', '71000000-0000-4000-8000-000000000001', 'Legacy internal note', true, now() - interval '30 minutes', now() - interval '30 minutes');

insert into public.attachments (
  id, organization_id, uploaded_by, entity_type, entity_id, object_key,
  original_filename, content_type, size_bytes
)
values
  ('77000000-0000-4000-8000-000000000001', '72000000-0000-4000-8000-000000000002', '71000000-0000-4000-8000-000000000002', 'TICKET', '75000000-0000-4000-8000-000000000001', 'legacy/ticket.txt', 'ticket.txt', 'text/plain', 20),
  ('77000000-0000-4000-8000-000000000002', '72000000-0000-4000-8000-000000000002', '71000000-0000-4000-8000-000000000001', 'TICKET_MESSAGE', '76000000-0000-4000-8000-000000000002', 'legacy/internal.txt', 'internal.txt', 'text/plain', 20);

insert into public.notifications (
  id, organization_id, user_id, title, body, category, status, read_at
)
values
  ('78000000-0000-4000-8000-000000000001', '72000000-0000-4000-8000-000000000002', '71000000-0000-4000-8000-000000000002', 'Legacy unread', 'Legacy notification', 'SUPPORT', 'UNREAD', null),
  ('78000000-0000-4000-8000-000000000002', '72000000-0000-4000-8000-000000000002', '71000000-0000-4000-8000-000000000002', 'Legacy read', 'Legacy notification', 'SUPPORT', 'READ', now() - interval '1 hour');
