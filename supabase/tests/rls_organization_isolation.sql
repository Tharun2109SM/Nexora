begin;

select plan(9);

insert into auth.users (id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data)
values
  ('10000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'admin-a@example.test', 'test', '{"nexora_account_type":"BEAUROI"}', '{"full_name":"Test User A"}'),
  ('10000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'member-b@example.test', 'test', '{"nexora_account_type":"BEAUROI"}', '{"full_name":"Test User B"}');

insert into public.organizations (id, name, slug, organization_type)
values
  ('20000000-0000-0000-0000-000000000001', 'Organization A', 'organization-a', 'CUSTOMER'),
  ('20000000-0000-0000-0000-000000000002', 'Organization B', 'organization-b', 'CUSTOMER');

insert into public.organization_memberships (organization_id, user_id, role, status, is_primary, joined_at)
values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'CUSTOMER_ADMIN', 'ACTIVE', true, now()),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', 'CUSTOMER_MEMBER', 'ACTIVE', true, now());

insert into auth.users (id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data)
values (
  '10000000-0000-0000-0000-000000000003',
  'authenticated',
  'authenticated',
  'new-admin@example.test',
  'test',
  '{}',
  '{"company_name":"Signup Company","company_size":"11-50","country":"India","designation":"Operations Lead","full_name":"New Administrator","industry":"Software","phone":"+91 90000 00000"}'
);

select is(
  (select role::text from public.organization_memberships where user_id = '10000000-0000-0000-0000-000000000003'),
  'CUSTOMER_ADMIN',
  'public signup creates the first customer administrator'
);
select is(
  (
    select organization_type::text
    from public.organizations
    where id = (
      select organization_id
      from public.organization_memberships
      where user_id = '10000000-0000-0000-0000-000000000003'
    )
  ),
  'CUSTOMER',
  'public signup creates a customer organization'
);
select is(
  (select full_name from public.profiles where id = '10000000-0000-0000-0000-000000000003'),
  'New Administrator',
  'public signup creates the administrator profile'
);

set local role authenticated;
set local request.jwt.claims = '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}';

select is((select count(*)::integer from public.organizations), 1, 'customer sees exactly one organization');
select ok((select exists(select 1 from public.organizations where slug = 'organization-a')), 'customer sees own organization');
select ok((select not exists(select 1 from public.organizations where slug = 'organization-b')), 'customer cannot see another organization');
select is((select count(*)::integer from public.organization_memberships), 1, 'customer admin cannot enumerate another organization membership');
select lives_ok(
  $$update public.organizations set name = 'Unauthorized' where id = '20000000-0000-0000-0000-000000000002'$$,
  'cross-organization update is safely filtered'
);

reset role;
select is(
  (select name from public.organizations where id = '20000000-0000-0000-0000-000000000002'),
  'Organization B',
  'customer admin cannot update another organization'
);

select * from finish();
rollback;
