begin;

select plan(29);

insert into auth.users (id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data)
values
  ('11000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'admin@beauroi.test', 'test', '{"nexora_account_type":"BEAUROI"}', '{"full_name":"Beau Roi Admin"}'),
  ('11000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'staff@beauroi.test', 'test', '{"nexora_account_type":"BEAUROI"}', '{"full_name":"Beau Roi Staff"}'),
  ('11000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'admin-a@example.test', 'test', '{"nexora_account_type":"BEAUROI"}', '{"full_name":"Customer A Admin"}'),
  ('11000000-0000-4000-8000-000000000004', 'authenticated', 'authenticated', 'member-a@example.test', 'test', '{"nexora_account_type":"BEAUROI"}', '{"full_name":"Customer A Member"}'),
  ('11000000-0000-4000-8000-000000000005', 'authenticated', 'authenticated', 'admin-b@example.test', 'test', '{"nexora_account_type":"BEAUROI"}', '{"full_name":"Customer B Admin"}'),
  ('11000000-0000-4000-8000-000000000006', 'authenticated', 'authenticated', 'invitee@example.test', 'test', '{"nexora_account_type":"BEAUROI"}', '{"full_name":"Invited User"}');

insert into public.organizations (id, name, slug, organization_type, logo_object_key)
values
  ('21000000-0000-4000-8000-000000000001', 'Beau Roi', 'beau-roi-test', 'BEAUROI', null),
  ('21000000-0000-4000-8000-000000000002', 'Customer A', 'customer-a-test', 'CUSTOMER', 'organizations/customer-a/private-logo.png'),
  ('21000000-0000-4000-8000-000000000003', 'Customer B', 'customer-b-test', 'CUSTOMER', 'organizations/customer-b/private-logo.png');

insert into public.organization_memberships (id, organization_id, user_id, role, status, is_primary, joined_at)
values
  ('31000000-0000-4000-8000-000000000001', '21000000-0000-4000-8000-000000000001', '11000000-0000-4000-8000-000000000001', 'BEAUROI_ADMIN', 'ACTIVE', true, now()),
  ('31000000-0000-4000-8000-000000000002', '21000000-0000-4000-8000-000000000001', '11000000-0000-4000-8000-000000000002', 'BEAUROI_EMPLOYEE', 'ACTIVE', true, now()),
  ('31000000-0000-4000-8000-000000000003', '21000000-0000-4000-8000-000000000002', '11000000-0000-4000-8000-000000000003', 'CUSTOMER_ADMIN', 'ACTIVE', true, now()),
  ('31000000-0000-4000-8000-000000000004', '21000000-0000-4000-8000-000000000002', '11000000-0000-4000-8000-000000000004', 'CUSTOMER_MEMBER', 'ACTIVE', true, now()),
  ('31000000-0000-4000-8000-000000000005', '21000000-0000-4000-8000-000000000003', '11000000-0000-4000-8000-000000000005', 'CUSTOMER_ADMIN', 'ACTIVE', true, now());

set local role anon;
select throws_ok(
  $$select * from public.organization_invitations$$,
  '42501', null,
  'anonymous users have no Data API privilege on invitations'
);
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub":"11000000-0000-4000-8000-000000000004","role":"authenticated","email":"member-a@example.test"}';
select is((select count(*)::integer from public.organizations), 1, 'customer member sees only its organization');
select is(
  (select logo_object_key from public.organizations),
  'organizations/customer-a/private-logo.png',
  'customer member can read only its own organization R2 object metadata'
);
select is((select count(*)::integer from public.organization_memberships), 2, 'customer member can read its own organization people');
select lives_ok(
  $$update public.organizations set name = 'Attack' where id = '21000000-0000-4000-8000-000000000003'$$,
  'cross-organization profile write is filtered by RLS'
);
select throws_ok(
  $$insert into public.health_score_history (organization_id, score, reason, source) values ('21000000-0000-4000-8000-000000000002', 80, 'Not allowed', 'MANUAL')$$,
  'P0001', 'Only Beau Roi staff may record health scores',
  'customer member cannot create health scores'
);
update public.organization_memberships set role = 'CUSTOMER_ADMIN'
where id = '31000000-0000-4000-8000-000000000004';
select is(
  (select role::text from public.organization_memberships where id = '31000000-0000-4000-8000-000000000004'),
  'CUSTOMER_MEMBER',
  'customer member cannot self-elevate'
);
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub":"11000000-0000-4000-8000-000000000003","role":"authenticated","email":"admin-a@example.test"}';
select lives_ok(
  $$update public.organizations set industry = 'Professional services' where id = '21000000-0000-4000-8000-000000000002'$$,
  'customer administrator can update approved own-organization profile fields'
);
select throws_ok(
  $$update public.organizations set lifecycle_status = 'PAUSED' where id = '21000000-0000-4000-8000-000000000002'$$,
  'P0001', 'Only Beau Roi staff may change lifecycle status',
  'customer administrator cannot change protected lifecycle state'
);
select throws_ok(
  $$update public.organization_memberships set role = 'BEAUROI_ADMIN' where id = '31000000-0000-4000-8000-000000000004'$$,
  'P0001', 'Customer administrators may only manage customer roles',
  'customer administrator cannot issue an internal role'
);
select throws_ok(
  $$update public.organization_memberships set status = 'REMOVED' where id = '31000000-0000-4000-8000-000000000003'$$,
  'P0001', 'Administrators cannot change their own membership',
  'customer administrator cannot deactivate itself'
);
select lives_ok(
  $$insert into public.organization_invitations (organization_id, normalized_email, intended_role, invited_by, token_hash, expires_at) values ('21000000-0000-4000-8000-000000000002', 'invitee@example.test', 'CUSTOMER_MEMBER', '11000000-0000-4000-8000-000000000003', encode(digest('valid-token', 'sha256'), 'hex'), now() + interval '7 days')$$,
  'customer administrator can create a safe customer invitation'
);
select throws_ok(
  $$insert into public.organization_invitations (organization_id, normalized_email, intended_role, invited_by, token_hash, expires_at) values ('21000000-0000-4000-8000-000000000002', 'other@example.test', 'BEAUROI_ADMIN', '11000000-0000-4000-8000-000000000003', encode(digest('bad-role', 'sha256'), 'hex'), now() + interval '7 days')$$,
  'P0001', 'Invalid invitation actor or role',
  'database constraints reject internal invitation roles'
);
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub":"11000000-0000-4000-8000-000000000002","role":"authenticated","email":"staff@beauroi.test"}';
select lives_ok(
  $$select public.replace_customer_assignment('21000000-0000-4000-8000-000000000002', 'CSM', '11000000-0000-4000-8000-000000000002', 'Private coordination note')$$,
  'Beau Roi staff can assign a Customer Success Manager'
);
select lives_ok(
  $$insert into public.health_score_history (organization_id, score, reason, source) values ('21000000-0000-4000-8000-000000000002', 72, 'Manual quarterly review', 'MANUAL')$$,
  'Beau Roi staff can record a justified health score'
);
select is((select count(*)::integer from public.audit_events where organization_id = '21000000-0000-4000-8000-000000000002'), 4, 'sensitive mutations create audit records');
select throws_ok(
  $$update public.health_score_history set score = 1 where organization_id = '21000000-0000-4000-8000-000000000002'$$,
  '42501', null,
  'health history is immutable to application roles'
);
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub":"11000000-0000-4000-8000-000000000004","role":"authenticated","email":"member-a@example.test"}';
select is((select count(*)::integer from public.customer_assignments), 1, 'customer member sees its active assignment');
select is((select count(*)::integer from public.customer_assignments where organization_id = '21000000-0000-4000-8000-000000000003'), 0, 'customer member cannot read another customer assignment');
select throws_ok(
  $$select * from private.customer_assignment_notes$$,
  '42501', null,
  'customer members cannot read private assignment notes'
);
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub":"11000000-0000-4000-8000-000000000005","role":"authenticated","email":"admin-b@example.test"}';
insert into public.organization_invitations (
  id, organization_id, normalized_email, intended_role, invited_by, token_hash, created_at, expires_at
) values (
  '41000000-0000-4000-8000-000000000001', '21000000-0000-4000-8000-000000000003',
  'invitee@example.test', 'CUSTOMER_MEMBER', '11000000-0000-4000-8000-000000000005',
  encode(digest('expired-token', 'sha256'), 'hex'), now() - interval '2 days', now() - interval '1 day'
);
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub":"11000000-0000-4000-8000-000000000006","role":"authenticated","email":"invitee@example.test"}';
select is(
  public.accept_organization_invitation(encode(digest('valid-token', 'sha256'), 'hex')),
  '21000000-0000-4000-8000-000000000002'::uuid,
  'matching authenticated email can accept an unexpired invitation'
);
select throws_ok(
  $$select public.accept_organization_invitation(encode(digest('valid-token', 'sha256'), 'hex'))$$,
  'P0001', 'The invitation is invalid or unavailable',
  'invitation token is single-use'
);
select throws_ok(
  $$select public.accept_organization_invitation(encode(digest('expired-token', 'sha256'), 'hex'))$$,
  'P0001', 'The invitation is invalid or unavailable',
  'expired invitation is rejected'
);
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub":"11000000-0000-4000-8000-000000000005","role":"authenticated","email":"admin-b@example.test"}';
update public.organization_invitations
set status = 'REVOKED', revoked_at = now(), revoked_by = '11000000-0000-4000-8000-000000000005'
where id = '41000000-0000-4000-8000-000000000001';
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub":"11000000-0000-4000-8000-000000000006","role":"authenticated","email":"invitee@example.test"}';
select throws_ok(
  $$select public.accept_organization_invitation(encode(digest('expired-token', 'sha256'), 'hex'))$$,
  'P0001', 'The invitation is invalid or unavailable',
  'revoked invitation is rejected'
);
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub":"11000000-0000-4000-8000-000000000001","role":"authenticated","email":"admin@beauroi.test"}';
select throws_ok(
  $$update public.organization_memberships set status = 'REMOVED' where id = '31000000-0000-4000-8000-000000000005'$$,
  'P0001', 'The last active customer administrator cannot be removed',
  'even a Beau Roi administrator cannot remove the last customer administrator'
);
select throws_ok(
  $$update public.audit_events set action = 'TAMPERED'$$,
  '42501', null,
  'audit events are append-only for application users'
);
reset role;

select ok(not has_table_privilege('authenticated', 'public.audit_events', 'UPDATE'), 'authenticated role has no audit update grant');
select ok(has_table_privilege('authenticated', 'public.organization_invitations', 'SELECT'), 'invitation Data API select grant is explicit');
select ok(
  exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'organization_invitations_organization_created_idx'),
  'invitation organization and cursor columns are indexed'
);

select * from finish();
rollback;
