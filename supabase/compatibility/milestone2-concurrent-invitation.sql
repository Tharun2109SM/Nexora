-- Seed applied after both migrations for the local concurrent-acceptance pgTAP test.
set session_replication_role = replica;

insert into auth.users (id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data)
values
  ('71000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'concurrency-admin@example.test', 'test', '{"nexora_account_type":"BEAUROI"}', '{}'),
  ('71000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'concurrency-invitee@example.test', 'test', '{"nexora_account_type":"BEAUROI"}', '{}');

insert into public.organizations (id, name, slug, organization_type)
values ('72000000-0000-4000-8000-000000000001', 'Concurrency Customer', 'concurrency-customer', 'CUSTOMER');

insert into public.organization_invitations (
  id, organization_id, normalized_email, intended_role, invited_by, token_hash, expires_at
) values (
  '73000000-0000-4000-8000-000000000001', '72000000-0000-4000-8000-000000000001',
  'concurrency-invitee@example.test', 'CUSTOMER_MEMBER', '71000000-0000-4000-8000-000000000001',
  encode(extensions.digest(convert_to('concurrent-token-aaaaaaaaaaaaaaaaaaaaaaaa', 'UTF8'), 'sha256'), 'hex'),
  now() + interval '7 days'
);

set session_replication_role = origin;
