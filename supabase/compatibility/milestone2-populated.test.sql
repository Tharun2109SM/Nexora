begin;

select plan(6);

select is(
  (select assigned_at from public.customer_assignments where id = '54000000-0000-4000-8000-000000000001'),
  '2025-02-03 04:05:06+00'::timestamptz,
  'legacy assignment assigned_at is backfilled from created_at'
);
select is(
  (select ended_at from public.customer_assignments where id = '54000000-0000-4000-8000-000000000001'),
  '2025-02-03 04:05:06+00'::timestamptz,
  'legacy inactive assignment receives a deterministic ended_at backfill'
);
select ok(
  (select convalidated from pg_constraint where conrelid = 'public.customer_assignments'::regclass and conname = 'customer_assignments_dates_check'),
  'assignment date consistency constraint validates on populated Milestone 1 data'
);
select ok(
  not exists (
    select 1 from pg_constraint
    where conrelid = 'public.customer_assignments'::regclass
      and conname = 'customer_assignments_organization_id_product_id_employee_us_key'
  ),
  'the exact legacy uniqueness constraint was replaced'
);
select has_index(
  'public', 'customer_assignments', 'customer_assignments_one_active_type_idx',
  'active assignment partial unique index exists after populated upgrade'
);
select lives_ok(
  $$select private.assert_no_duplicate_active_customer_assignments()$$,
  'populated migration leaves assignment uniqueness preflight clean'
);

select * from finish();
rollback;
