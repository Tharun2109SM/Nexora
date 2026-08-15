begin;

select plan(68);

insert into auth.users (id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data)
values
  ('11000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'admin@beauroi.test', 'test', '{"nexora_account_type":"BEAUROI"}', '{"full_name":"Beau Roi Admin"}'),
  ('11000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'staff-one@beauroi.test', 'test', '{"nexora_account_type":"BEAUROI"}', '{"full_name":"Beau Roi Staff One"}'),
  ('11000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'staff-two@beauroi.test', 'test', '{"nexora_account_type":"BEAUROI"}', '{"full_name":"Beau Roi Staff Two"}'),
  ('11000000-0000-4000-8000-000000000004', 'authenticated', 'authenticated', 'admin-a@example.test', 'test', '{"nexora_account_type":"BEAUROI"}', '{"full_name":"Customer A Admin"}'),
  ('11000000-0000-4000-8000-000000000005', 'authenticated', 'authenticated', 'member-a@example.test', 'test', '{"nexora_account_type":"BEAUROI"}', '{"full_name":"Customer A Member"}'),
  ('11000000-0000-4000-8000-000000000006', 'authenticated', 'authenticated', 'admin-b@example.test', 'test', '{"nexora_account_type":"BEAUROI"}', '{"full_name":"Customer B Admin"}'),
  ('11000000-0000-4000-8000-000000000007', 'authenticated', 'authenticated', 'invitee@example.test', 'test', '{"nexora_account_type":"BEAUROI"}', '{"full_name":"Invited User"}');

insert into public.organizations (id, name, slug, organization_type, logo_object_key)
values
  ('21000000-0000-4000-8000-000000000001', 'Beau Roi', 'beau-roi-test', 'BEAUROI', null),
  ('21000000-0000-4000-8000-000000000002', 'Customer A', 'customer-a-test', 'CUSTOMER', 'organizations/customer-a/private-logo.png'),
  ('21000000-0000-4000-8000-000000000003', 'Customer B', 'customer-b-test', 'CUSTOMER', 'organizations/customer-b/private-logo.png');

insert into public.organization_memberships (id, organization_id, user_id, role, status, is_primary, joined_at)
values
  ('31000000-0000-4000-8000-000000000001', '21000000-0000-4000-8000-000000000001', '11000000-0000-4000-8000-000000000001', 'BEAUROI_ADMIN', 'ACTIVE', true, now()),
  ('31000000-0000-4000-8000-000000000002', '21000000-0000-4000-8000-000000000001', '11000000-0000-4000-8000-000000000002', 'BEAUROI_EMPLOYEE', 'ACTIVE', false, now()),
  ('31000000-0000-4000-8000-000000000003', '21000000-0000-4000-8000-000000000001', '11000000-0000-4000-8000-000000000003', 'BEAUROI_EMPLOYEE', 'ACTIVE', false, now()),
  ('31000000-0000-4000-8000-000000000004', '21000000-0000-4000-8000-000000000002', '11000000-0000-4000-8000-000000000004', 'CUSTOMER_ADMIN', 'ACTIVE', true, now()),
  ('31000000-0000-4000-8000-000000000005', '21000000-0000-4000-8000-000000000002', '11000000-0000-4000-8000-000000000005', 'CUSTOMER_MEMBER', 'ACTIVE', false, now()),
  ('31000000-0000-4000-8000-000000000006', '21000000-0000-4000-8000-000000000003', '11000000-0000-4000-8000-000000000006', 'CUSTOMER_ADMIN', 'ACTIVE', true, now());

select ok(
  not exists (
    select 1 from pg_constraint
    where conrelid = 'public.customer_assignments'::regclass
      and conname = 'customer_assignments_organization_id_product_id_employee_us_key'
  ),
  'the exact Milestone 1 assignment uniqueness constraint was replaced'
);
select ok(
  pg_get_indexdef('public.customer_assignments_one_active_type_idx'::regclass)
    like 'CREATE UNIQUE INDEX%organization_id, assignment_type)%'
  and pg_get_indexdef('public.customer_assignments_one_active_type_idx'::regclass)
    like '%WHERE (is_active AND (product_id IS NULL) AND (assignment_type = ANY%',
  'active CSM and implementation engineer uniqueness uses the reviewed partial index'
);
select ok(
  not has_function_privilege('authenticated', 'private.assert_no_duplicate_active_customer_assignments()', 'EXECUTE'),
  'the migration preflight helper is not executable by authenticated users'
);

savepoint duplicate_assignment_preflight;
drop index public.customer_assignments_one_active_type_idx;
set local session_replication_role = replica;
insert into public.customer_assignments (organization_id, employee_user_id, assignment_type, is_active)
values
  ('21000000-0000-4000-8000-000000000002', '11000000-0000-4000-8000-000000000002', 'CSM', true),
  ('21000000-0000-4000-8000-000000000002', '11000000-0000-4000-8000-000000000003', 'CSM', true);
set local session_replication_role = origin;
select throws_ok(
  $$select private.assert_no_duplicate_active_customer_assignments()$$,
  'P0001',
  'Milestone 2 preflight failed: duplicate active customer assignments require review',
  'duplicate active assignments fail preflight instead of silently deleting history'
);
rollback to savepoint duplicate_assignment_preflight;

select ok(not has_table_privilege('anon', 'public.organization_invitations', 'SELECT'), 'anon cannot select the invitation table');
select ok(not has_column_privilege('anon', 'public.organization_invitations', 'token_hash', 'SELECT'), 'anon cannot select invitation token hashes');
select ok(not has_table_privilege('authenticated', 'public.organization_invitations', 'SELECT'), 'authenticated users cannot select the invitation table');
select ok(not has_column_privilege('authenticated', 'public.organization_invitations', 'token_hash', 'SELECT'), 'authenticated users cannot select invitation token hashes');

set local role authenticated;
set local request.jwt.claims = '{"sub":"11000000-0000-4000-8000-000000000005","role":"authenticated","email":"member-a@example.test"}';
select is((select count(*)::integer from public.organizations), 1, 'customer member sees only its organization');
select is((select count(*)::integer from public.organization_memberships), 2, 'customer member sees only people in its organization');
select lives_ok(
  $$update public.organizations set name = 'Cross-tenant attack' where id = '21000000-0000-4000-8000-000000000003'$$,
  'cross-organization profile update is filtered by RLS'
);
select is((select name from public.organizations where id = '21000000-0000-4000-8000-000000000003'), null, 'cross-organization data remains unreadable and unchanged');
select throws_ok(
  $$insert into public.health_score_history (organization_id, score, reason, source) values ('21000000-0000-4000-8000-000000000002', 80, 'Not allowed', 'MANUAL')$$,
  'P0001', 'Only Beau Roi staff may record health scores',
  'customer member cannot create health scores'
);
update public.organization_memberships set role = 'CUSTOMER_ADMIN'
where id = '31000000-0000-4000-8000-000000000005';
select is(
  (select role::text from public.organization_memberships where id = '31000000-0000-4000-8000-000000000005'),
  'CUSTOMER_MEMBER',
  'customer member cannot self-elevate'
);
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub":"11000000-0000-4000-8000-000000000004","role":"authenticated","email":"admin-a@example.test"}';
select lives_ok(
  $$update public.organizations set industry = 'Professional services' where id = '21000000-0000-4000-8000-000000000002'$$,
  'customer administrator can update an approved own-organization field'
);
select is((select industry from public.organizations where id = '21000000-0000-4000-8000-000000000002'), 'Professional services', 'approved profile update persisted');
select throws_ok(
  $$update public.organizations set lifecycle_status = 'PAUSED' where id = '21000000-0000-4000-8000-000000000002'$$,
  'P0001', 'Only approved organization profile fields may be changed',
  'customer administrator cannot change lifecycle status'
);
select throws_ok(
  $$update public.organizations set logo_object_key = 'organizations/21000000-0000-4000-8000-000000000002/logos/00000000-0000-4000-8000-000000000000.png' where id = '21000000-0000-4000-8000-000000000002'$$,
  '42501', null,
  'direct Data API access cannot update protected logo metadata'
);
reset role;

alter table public.organizations add column future_sensitive_field text;
set local request.jwt.claims = '{"sub":"11000000-0000-4000-8000-000000000004","role":"authenticated","email":"admin-a@example.test"}';
select throws_ok(
  $$update public.organizations set future_sensitive_field = 'blocked' where id = '21000000-0000-4000-8000-000000000002'$$,
  'P0001', 'Only approved organization profile fields may be changed',
  'future organization columns are denied automatically by the allowlist trigger'
);
set local role authenticated;
select throws_ok(
  $$update public.organization_memberships set joined_at = now() + interval '1 day' where id = '31000000-0000-4000-8000-000000000005'$$,
  '42501', null,
  'authenticated users have no joined_at update privilege'
);
reset role;
select throws_ok(
  $$update public.organization_memberships set joined_at = now() + interval '1 day' where id = '31000000-0000-4000-8000-000000000005'$$,
  'P0001', 'Membership identity and history fields are immutable',
  'the trigger also protects joined_at from privileged direct updates'
);

set local role authenticated;
set local request.jwt.claims = '{"sub":"11000000-0000-4000-8000-000000000004","role":"authenticated","email":"admin-a@example.test"}';
select lives_ok(
  $$select * from public.create_organization_invitation(
    '21000000-0000-4000-8000-000000000002', 'invitee@example.test', 'CUSTOMER_MEMBER',
    encode(extensions.digest(convert_to('valid-token-aaaaaaaaaaaaaaaaaaaaaaaaaaaa', 'UTF8'), 'sha256'), 'hex'),
    now() + interval '7 days'
  )$$,
  'customer administrator creates an invitation only through the narrow RPC'
);
select is(
  (select count(*)::integer from public.list_organization_invitations('21000000-0000-4000-8000-000000000002')),
  1,
  'safe invitation listing RPC returns the organization invitation'
);
select throws_ok(
  $$insert into public.organization_invitations (organization_id, normalized_email, intended_role, invited_by, token_hash, expires_at)
    values ('21000000-0000-4000-8000-000000000002', 'direct@example.test', 'CUSTOMER_MEMBER',
      '11000000-0000-4000-8000-000000000004', repeat('a', 64), now() + interval '1 day')$$,
  '42501', null,
  'direct invitation insertion is rejected'
);
select throws_ok(
  $$update public.organization_invitations set status = 'REVOKED'$$,
  '42501', null,
  'direct invitation mutation is rejected'
);
select throws_ok(
  $$select * from public.create_organization_invitation(
    '21000000-0000-4000-8000-000000000002', 'internal@example.test', 'BEAUROI_ADMIN',
    repeat('b', 64), now() + interval '7 days'
  )$$,
  'P0001', 'Invalid invitation role',
  'customer administrator cannot issue an internal role'
);
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub":"11000000-0000-4000-8000-000000000007","role":"authenticated","email":"invitee@example.test"}';
select throws_ok(
  $$select public.accept_organization_invitation('wrong-token-aaaaaaaaaaaaaaaaaaaaaaaaaaaaa')$$,
  'P0001', 'The invitation is invalid or unavailable',
  'wrong raw invitation token returns the generic unavailable error'
);
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub":"11000000-0000-4000-8000-000000000005","role":"authenticated","email":"member-a@example.test"}';
select throws_ok(
  $$select public.accept_organization_invitation('valid-token-aaaaaaaaaaaaaaaaaaaaaaaaaaaa')$$,
  'P0001', 'The invitation is invalid or unavailable',
  'wrong authenticated email returns the generic unavailable error'
);
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub":"11000000-0000-4000-8000-000000000007","role":"authenticated","email":"invitee@example.test"}';
select is(
  public.accept_organization_invitation('valid-token-aaaaaaaaaaaaaaaaaaaaaaaaaaaa'),
  '21000000-0000-4000-8000-000000000002'::uuid,
  'matching authenticated email accepts the raw single-use token'
);
select throws_ok(
  $$select public.accept_organization_invitation('valid-token-aaaaaaaaaaaaaaaaaaaaaaaaaaaa')$$,
  'P0001', 'The invitation is invalid or unavailable',
  'accepted invitation cannot be reused'
);
reset role;

set local session_replication_role = replica;
insert into public.organization_invitations (
  organization_id, normalized_email, intended_role, invited_by, token_hash, created_at, expires_at
) values (
  '21000000-0000-4000-8000-000000000003', 'invitee@example.test', 'CUSTOMER_MEMBER',
  '11000000-0000-4000-8000-000000000006',
  encode(extensions.digest(convert_to('expired-token-aaaaaaaaaaaaaaaaaaaaaaaaaa', 'UTF8'), 'sha256'), 'hex'),
  now() - interval '2 days', now() - interval '1 day'
);
set local session_replication_role = origin;

set local role authenticated;
set local request.jwt.claims = '{"sub":"11000000-0000-4000-8000-000000000007","role":"authenticated","email":"invitee@example.test"}';
select throws_ok(
  $$select public.accept_organization_invitation('expired-token-aaaaaaaaaaaaaaaaaaaaaaaaaa')$$,
  'P0001', 'The invitation is invalid or unavailable',
  'expired invitation is rejected'
);
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub":"11000000-0000-4000-8000-000000000006","role":"authenticated","email":"admin-b@example.test"}';
select lives_ok(
  $$select * from public.create_organization_invitation(
    '21000000-0000-4000-8000-000000000003', 'revoked@example.test', 'CUSTOMER_MEMBER',
    encode(extensions.digest(convert_to('revoked-token-aaaaaaaaaaaaaaaaaaaaaaaaaa', 'UTF8'), 'sha256'), 'hex'),
    now() + interval '7 days'
  )$$,
  'second customer administrator creates a revocable invitation'
);
select lives_ok(
  $$select * from public.revoke_organization_invitation(
    '21000000-0000-4000-8000-000000000003',
    (select id from public.list_organization_invitations('21000000-0000-4000-8000-000000000003')
      where normalized_email = 'revoked@example.test')
  )$$,
  'pending invitation is revoked through the narrow RPC'
);
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub":"11000000-0000-4000-8000-000000000007","role":"authenticated","email":"revoked@example.test"}';
select throws_ok(
  $$select public.accept_organization_invitation('revoked-token-aaaaaaaaaaaaaaaaaaaaaaaaaa')$$,
  'P0001', 'The invitation is invalid or unavailable',
  'revoked invitation is rejected'
);
reset role;
select ok(
  lower(pg_get_functiondef('private.accept_organization_invitation(text)'::regprocedure)) like '%for update%',
  'invitation acceptance locks the credential row before mutation for concurrent safety'
);
select ok(not has_function_privilege('authenticated', 'private.accept_organization_invitation(text)', 'EXECUTE'), 'private invitation implementation is not directly executable');
select ok(has_function_privilege('authenticated', 'public.accept_organization_invitation(text)', 'EXECUTE'), 'only the narrow public invitation acceptance RPC is executable');

set local role authenticated;
set local request.jwt.claims = '{"sub":"11000000-0000-4000-8000-000000000002","role":"authenticated","email":"staff-one@beauroi.test"}';
select lives_ok(
  $$select public.replace_customer_assignment(
    '21000000-0000-4000-8000-000000000002', 'CSM',
    '11000000-0000-4000-8000-000000000003', 'Initial assignment'
  )$$,
  'Beau Roi staff creates an active assignment through the narrow RPC'
);
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub":"11000000-0000-4000-8000-000000000001","role":"authenticated","email":"admin@beauroi.test"}';
select lives_ok(
  $$update public.organization_memberships set status = 'SUSPENDED' where id = '31000000-0000-4000-8000-000000000003'$$,
  'Beau Roi administrator can deactivate the original assignee'
);
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub":"11000000-0000-4000-8000-000000000002","role":"authenticated","email":"staff-one@beauroi.test"}';
select lives_ok(
  $$select public.replace_customer_assignment(
    '21000000-0000-4000-8000-000000000002', 'CSM',
    '11000000-0000-4000-8000-000000000002', 'Replacement assignment'
  )$$,
  'existing assignment can end after its assignee becomes inactive'
);
reset role;
select ok(
  exists (
    select 1 from public.customer_assignments
    where employee_user_id = '11000000-0000-4000-8000-000000000003'
      and not is_active and ended_at is not null
  ),
  'replaced assignment remains immutable history with an end timestamp'
);

set local request.jwt.claims = '{"sub":"11000000-0000-4000-8000-000000000001","role":"authenticated","email":"admin@beauroi.test"}';
select throws_ok(
  $$update public.customer_assignments set is_active = true, ended_at = null
    where employee_user_id = '11000000-0000-4000-8000-000000000003' and not is_active$$,
  'P0001', 'Ended assignments cannot be reactivated',
  'assignment reactivation is rejected by the transition guard'
);
select throws_ok(
  $$update public.customer_assignments set ended_at = ended_at + interval '1 minute'
    where employee_user_id = '11000000-0000-4000-8000-000000000003' and not is_active$$,
  'P0001', 'An ended assignment timestamp is immutable',
  'ended_at cannot change after the assignment has ended'
);
select throws_ok(
  $$update public.customer_assignments set id = '41000000-0000-4000-8000-000000000099'
    where employee_user_id = '11000000-0000-4000-8000-000000000003' and not is_active$$,
  'P0001', 'Assignment history fields are immutable',
  'assignment identity is immutable even for a privileged direct update'
);

set local role authenticated;
set local request.jwt.claims = '{"sub":"11000000-0000-4000-8000-000000000005","role":"authenticated","email":"member-a@example.test"}';
select is((select count(*)::integer from public.customer_assignments), 1, 'customer member reads only its active assignment');
select throws_ok(
  $$select * from private.customer_assignment_notes$$,
  '42501', null,
  'customer members cannot read private assignment notes'
);
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub":"11000000-0000-4000-8000-000000000001","role":"authenticated","email":"admin@beauroi.test"}';
select throws_ok(
  $$update public.organization_memberships set status = 'REMOVED' where id = '31000000-0000-4000-8000-000000000006'$$,
  'P0001', 'The last active customer administrator cannot be removed',
  'last active customer administrator cannot be removed by update'
);
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub":"11000000-0000-4000-8000-000000000001","role":"authenticated","email":"admin@beauroi.test"}';
select throws_ok(
  $$delete from public.organization_memberships where id = '31000000-0000-4000-8000-000000000006'$$,
  '42501', null,
  'authenticated administrators cannot delete memberships'
);
reset role;
select ok(not has_table_privilege('authenticated', 'public.organization_memberships', 'DELETE'), 'authenticated role has no membership DELETE privilege');
select ok(
  not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'organization_memberships'
      and cmd = 'DELETE'
      and ('authenticated' = any(roles) or 'public' = any(roles))
  ),
  'no authenticated membership DELETE policy exists'
);

savepoint trusted_membership_cleanup;
select lives_ok(
  $$delete from public.organization_memberships where id = '31000000-0000-4000-8000-000000000006'$$,
  'database-owner membership maintenance remains operational'
);
rollback to savepoint trusted_membership_cleanup;

savepoint trusted_organization_cascade;
insert into public.organizations (id, name, slug, organization_type)
values ('21000000-0000-4000-8000-000000000099', 'Cleanup Test', 'cleanup-test', 'CUSTOMER');
insert into public.organization_memberships (
  id, organization_id, user_id, role, status, is_primary, joined_at
) values (
  '31000000-0000-4000-8000-000000000099', '21000000-0000-4000-8000-000000000099',
  '11000000-0000-4000-8000-000000000006', 'CUSTOMER_MEMBER', 'ACTIVE', false, now()
);
delete from public.organizations where id = '21000000-0000-4000-8000-000000000099';
select is(
  (select count(*)::integer from public.organization_memberships where id = '31000000-0000-4000-8000-000000000099'),
  0,
  'organization deletion can cascade membership cleanup for trusted maintenance'
);
rollback to savepoint trusted_organization_cascade;

savepoint trusted_auth_user_cascade;
insert into auth.users (
  id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data
) values (
  '11000000-0000-4000-8000-000000000099', 'authenticated', 'authenticated',
  'cleanup-user@example.test', 'test', '{"nexora_account_type":"BEAUROI"}',
  '{"full_name":"Cleanup User"}'
);
insert into public.organization_memberships (
  id, organization_id, user_id, role, status, is_primary, joined_at
) values (
  '31000000-0000-4000-8000-000000000098', '21000000-0000-4000-8000-000000000002',
  '11000000-0000-4000-8000-000000000099', 'CUSTOMER_MEMBER', 'ACTIVE', false, now()
);
delete from auth.users where id = '11000000-0000-4000-8000-000000000099';
select is(
  (select count(*)::integer from public.organization_memberships where id = '31000000-0000-4000-8000-000000000098'),
  0,
  'auth user deletion can cascade membership cleanup for trusted maintenance'
);
rollback to savepoint trusted_auth_user_cascade;

set local role authenticated;
set local request.jwt.claims = '{"sub":"11000000-0000-4000-8000-000000000004","role":"authenticated","email":"admin-a@example.test"}';
select lives_ok(
  $$update public.organization_memberships set status = 'SUSPENDED' where id = '31000000-0000-4000-8000-000000000006'$$,
  'cross-organization membership update is filtered by RLS'
);
reset role;
select is(
  (select status::text from public.organization_memberships where id = '31000000-0000-4000-8000-000000000006'),
  'ACTIVE',
  'cross-organization membership status remains unchanged'
);

set local role authenticated;
set local request.jwt.claims = '{"sub":"11000000-0000-4000-8000-000000000001","role":"authenticated","email":"admin@beauroi.test"}';
select throws_ok(
  $$update public.audit_events set action = 'TAMPERED'$$,
  '42501', null,
  'audit events remain append-only for application users'
);
reset role;
select ok(not has_table_privilege('authenticated', 'public.audit_events', 'UPDATE'), 'authenticated role has no audit update grant');
select ok(
  exists (
    select 1 from pg_constraint
    where conrelid = 'public.organization_invitations'::regclass
      and conname = 'organization_invitations_token_hash_check'
  ),
  'invitation token hash format constraint exists'
);
select ok(
  exists (
    select 1 from pg_constraint
    where conrelid = 'public.organization_invitations'::regclass
      and conname = 'organization_invitations_lifetime_check'
  ),
  'invitation maximum lifetime constraint exists'
);
select ok(
  pg_get_function_result('public.list_organization_invitations(uuid)'::regprocedure) not like '%token_hash%',
  'safe invitation listing RPC cannot return token hashes'
);
select is((select relrowsecurity from pg_class where oid = 'public.organization_invitations'::regclass), true, 'invitation table has RLS enabled');
select ok(not has_column_privilege('authenticated', 'public.organizations', 'logo_object_key', 'UPDATE'), 'authenticated role cannot directly update logo object keys');
set local role authenticated;
set local request.jwt.claims = '{"sub":"11000000-0000-4000-8000-000000000004","role":"authenticated","email":"admin-a@example.test"}';
set local nexora.logo_update = 'on';
select throws_ok(
  $$update public.organizations set name = 'Spoofed logo workflow' where id = '21000000-0000-4000-8000-000000000002'$$,
  '42501', null,
  'authenticated callers cannot spoof the internal logo workflow flag'
);
set local nexora.logo_update = 'off';
set local nexora.invitation_acceptance = 'on';
select throws_ok(
  $$update public.organization_memberships set status = 'SUSPENDED' where id = '31000000-0000-4000-8000-000000000005'$$,
  '42501', null,
  'authenticated callers cannot spoof the internal invitation-acceptance workflow flag'
);
set local nexora.invitation_acceptance = 'off';
reset role;
select ok(has_column_privilege('authenticated', 'public.organizations', 'lifecycle_status', 'UPDATE'), 'lifecycle column is available only behind RLS and the role-aware allowlist trigger');
select ok(not has_table_privilege('authenticated', 'public.customer_assignments', 'INSERT'), 'assignment creation is available only through the narrow RPC');
select ok(not has_function_privilege('authenticated', 'private.replace_customer_assignment(uuid,text,uuid,text)', 'EXECUTE'), 'private assignment implementation is not directly executable');
select ok(has_function_privilege('authenticated', 'public.replace_customer_assignment(uuid,text,uuid,text)', 'EXECUTE'), 'public assignment replacement RPC has minimum execute permission');

select * from finish();
rollback;
