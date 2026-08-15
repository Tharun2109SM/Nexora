begin;

select plan(8);

select ok(
  not has_function_privilege('anon', 'public.rls_auto_enable()', 'EXECUTE'),
  'anon has no EXECUTE privilege on the RLS event-trigger function'
);
set local role anon;
select throws_ok(
  $$select public.rls_auto_enable()$$,
  '42501',
  null,
  'anon cannot invoke the RLS event-trigger function'
);
reset role;

select ok(
  not has_function_privilege('authenticated', 'public.rls_auto_enable()', 'EXECUTE'),
  'authenticated has no EXECUTE privilege on the RLS event-trigger function'
);
set local role authenticated;
select throws_ok(
  $$select public.rls_auto_enable()$$,
  '42501',
  null,
  'authenticated cannot invoke the RLS event-trigger function'
);
reset role;

select ok(
  (
    select has_function_privilege(
      pg_get_userbyid(proowner),
      'public.rls_auto_enable()',
      'EXECUTE'
    )
    from pg_proc
    where oid = 'public.rls_auto_enable()'::regprocedure
  ),
  'the database owner retains EXECUTE access'
);
select ok(
  exists (
    select 1
    from pg_event_trigger
    where evtfoid = 'public.rls_auto_enable()'::regprocedure
      and evtenabled <> 'D'
  ),
  'an enabled event trigger remains associated with the function'
);

create table public.rls_auto_enable_pgtap_test (id bigint primary key);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.rls_auto_enable_pgtap_test'::regclass),
  'creating a public table automatically enables RLS'
);
drop table public.rls_auto_enable_pgtap_test;
select is(
  to_regclass('public.rls_auto_enable_pgtap_test'),
  null,
  'the temporary RLS test table is removed'
);

select * from finish();
rollback;
