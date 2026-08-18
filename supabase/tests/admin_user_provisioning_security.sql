begin;

select plan(39);

insert into auth.users (
  id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data
) values (
  '16000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated',
  'dashboard.user@example.test', 'test', '{}', '{}'
);

select is(
  (select count(*)::integer from public.profiles where id = '16000000-0000-4000-8000-000000000001'),
  1,
  'a dashboard-style user gets exactly one profile'
);
select is(
  (select full_name from public.profiles where id = '16000000-0000-4000-8000-000000000001'),
  'dashboard.user',
  'an absent full name safely falls back to the email local part'
);
select is(
  (select count(*)::integer from public.organization_memberships where user_id = '16000000-0000-4000-8000-000000000001'),
  0,
  'a dashboard-style user receives no membership'
);
select is(
  (select count(*)::integer from public.organizations),
  0,
  'a dashboard-style user does not create an organization'
);

insert into auth.users (
  id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data
) values (
  '16000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated',
  'provisioned.staff@beauroi.test', 'test', '{"nexora_account_type":"BEAUROI"}',
  '{"full_name":"Provisioned Staff"}'
);

select is(
  (select full_name from public.profiles where id = '16000000-0000-4000-8000-000000000002'),
  'Provisioned Staff',
  'the explicit Beau Roi provisioning path still creates a profile'
);
select is(
  (select count(*)::integer from public.organization_memberships where user_id = '16000000-0000-4000-8000-000000000002'),
  0,
  'Beau Roi app metadata alone creates no membership'
);

insert into auth.users (
  id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data
) values (
  '16000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated',
  'customer.admin@example.test', 'test', '{}',
  '{"company_name":"Provisioned Customer","company_size":"11-50","country":"India","designation":"Operations Lead","full_name":"Customer Administrator","industry":"Software"}'
);

select is(
  (select count(*)::integer from public.organizations where name = 'Provisioned Customer' and organization_type = 'CUSTOMER'),
  1,
  'customer registration creates exactly one customer organization'
);
select is(
  (select full_name from public.profiles where id = '16000000-0000-4000-8000-000000000003'),
  'Customer Administrator',
  'customer registration creates its profile'
);
select is(
  (select role::text from public.organization_memberships where user_id = '16000000-0000-4000-8000-000000000003'),
  'CUSTOMER_ADMIN',
  'customer registration creates a CUSTOMER_ADMIN membership'
);
select ok(
  (
    select status = 'ACTIVE' and is_primary
    from public.organization_memberships
    where user_id = '16000000-0000-4000-8000-000000000003'
  ),
  'the initial customer administrator membership is active and primary'
);

select throws_ok(
  $invalid_company$
    insert into auth.users (
      id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data
    ) values (
      '16000000-0000-4000-8000-000000000004', 'authenticated', 'authenticated',
      'short-company@example.test', 'test', '{}',
      '{"company_name":"A","full_name":"Invalid Customer"}'
    )
  $invalid_company$,
  'P0001',
  'A valid organization name is required for customer registration',
  'a supplied company name that is too short is rejected clearly'
);
select is(
  (select count(*)::integer from auth.users where id = '16000000-0000-4000-8000-000000000004'),
  0,
  'a rejected short company registration leaves no auth user'
);
select throws_ok(
  $blank_company$
    insert into auth.users (
      id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data
    ) values (
      '16000000-0000-4000-8000-000000000005', 'authenticated', 'authenticated',
      'blank-company@example.test', 'test', '{}',
      '{"company_name":"   ","full_name":"Invalid Customer"}'
    )
  $blank_company$,
  'P0001',
  'A valid organization name is required for customer registration',
  'a supplied blank company name is rejected clearly'
);
select is(
  (select count(*)::integer from auth.users where id = '16000000-0000-4000-8000-000000000005'),
  0,
  'a rejected blank company registration leaves no auth user'
);
select throws_ok(
  $oversized_company$
    insert into auth.users (
      id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data
    ) values (
      '16000000-0000-4000-8000-000000000006', 'authenticated', 'authenticated',
      'oversized-company@example.test', 'test', '{}',
      jsonb_build_object('company_name', repeat('A', 161), 'full_name', 'Invalid Customer')
    )
  $oversized_company$,
  'P0001',
  'A valid organization name is required for customer registration',
  'a supplied company name longer than 160 characters is rejected clearly'
);
select is(
  (select count(*)::integer from auth.users where id = '16000000-0000-4000-8000-000000000006'),
  0,
  'a rejected oversized company registration leaves no auth user'
);

select ok(
  not has_function_privilege('public', 'private.handle_new_auth_user()', 'EXECUTE'),
  'PUBLIC cannot execute the private auth trigger function'
);
select ok(
  not has_function_privilege('anon', 'private.handle_new_auth_user()', 'EXECUTE'),
  'anon cannot execute the private auth trigger function'
);
select ok(
  not has_function_privilege('authenticated', 'private.handle_new_auth_user()', 'EXECUTE'),
  'authenticated cannot execute the private auth trigger function'
);
select ok(
  (
    select has_function_privilege(pg_get_userbyid(proowner), oid, 'EXECUTE')
    from pg_proc
    where oid = 'private.handle_new_auth_user()'::regprocedure
  ),
  'the trigger-function owner retains required execution access'
);
select ok(
  not has_table_privilege('anon', 'public.organizations', 'SELECT')
  and not has_table_privilege('anon', 'public.organization_memberships', 'SELECT')
  and not has_table_privilege('anon', 'public.profiles', 'SELECT'),
  'anon receives no table-read privilege from auth provisioning'
);

set local role authenticated;
set local request.jwt.claims = '{"sub":"16000000-0000-4000-8000-000000000001","role":"authenticated","email":"dashboard.user@example.test"}';

select is(
  (select count(*)::integer from public.organization_memberships where status = 'ACTIVE'),
  0,
  'an unassigned user has no active membership for either portal'
);
select ok(not private.is_beauroi_user(), 'an unassigned user is not authorized as Beau Roi staff');
select is((select count(*)::integer from public.organizations), 0, 'an unassigned user cannot read customer or staff organizations');
select is((select count(*)::integer from public.organization_memberships), 0, 'an unassigned user cannot read customer or staff memberships');
select is((select count(*)::integer from public.profiles), 1, 'an unassigned user can read only their own profile');

reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"16000000-0000-4000-8000-000000000002","role":"authenticated","email":"provisioned.staff@beauroi.test"}';

select is(
  (select count(*)::integer from public.organization_memberships where status = 'ACTIVE'),
  0,
  'an app-metadata-only staff user has no portal membership'
);
select ok(not private.is_beauroi_user(), 'Beau Roi app metadata alone does not authorize staff access');
select is((select count(*)::integer from public.organizations), 0, 'an app-metadata-only staff user cannot read organizations');

reset role;

insert into public.organizations (id, name, slug, organization_type)
values ('26000000-0000-4000-8000-000000000001', 'Beau Roi', 'beau-roi-provisioning-test', 'BEAUROI');
insert into public.organization_memberships (
  id, organization_id, user_id, role, status, is_primary, joined_at
) values (
  '36000000-0000-4000-8000-000000000001',
  '26000000-0000-4000-8000-000000000001',
  '16000000-0000-4000-8000-000000000002',
  'BEAUROI_EMPLOYEE', 'ACTIVE', true, now()
);

set local role authenticated;
set local request.jwt.claims = '{"sub":"16000000-0000-4000-8000-000000000003","role":"authenticated","email":"customer.admin@example.test"}';

select ok(not private.is_beauroi_user(), 'a customer administrator remains outside the Beau Roi portal');
select is((select count(*)::integer from public.organizations), 1, 'a customer administrator still sees exactly their own organization');
select ok(
  not exists(select 1 from public.organizations where organization_type = 'BEAUROI'),
  'a customer administrator cannot read the Beau Roi organization'
);
select is((select count(*)::integer from public.profiles), 1, 'a customer administrator cannot read unrelated user profiles');

reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"16000000-0000-4000-8000-000000000002","role":"authenticated","email":"provisioned.staff@beauroi.test"}';

select ok(private.is_beauroi_user(), 'an active database membership authorizes an existing Beau Roi employee');
select is((select count(*)::integer from public.organizations), 2, 'an authorized Beau Roi employee retains cross-organization visibility');
select is((select count(*)::integer from public.profiles), 3, 'an authorized Beau Roi employee retains staff profile visibility');

reset role;

select ok(
  exists (
    select 1
    from pg_trigger
    where tgrelid = 'auth.users'::regclass
      and tgname = 'on_auth_user_created'
      and tgfoid = 'private.handle_new_auth_user()'::regprocedure
      and tgenabled <> 'D'
  ),
  'the enabled auth.users trigger still calls the private provisioning function'
);
select ok(
  not has_table_privilege('authenticated', 'public.organizations', 'INSERT')
  and not has_table_privilege('authenticated', 'public.organization_memberships', 'INSERT'),
  'authenticated receives no new organization or membership insert privilege'
);
select ok(
  not has_table_privilege('authenticated', 'public.organization_memberships', 'DELETE'),
  'authenticated retains no membership delete privilege'
);

select * from finish();
rollback;
