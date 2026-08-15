-- Restrict the RLS event-trigger implementation from the Data API roles.
-- Some existing environments already contain the documented Supabase helper,
-- while a clean local CLI database does not. Bootstrap only missing objects so
-- an existing deployed definition and event-trigger configuration stay intact.
do $migration$
begin
  if to_regprocedure('public.rls_auto_enable()') is null then
    execute $function$
      create function public.rls_auto_enable()
      returns event_trigger
      language plpgsql
      security definer
      set search_path = pg_catalog
      as $body$
      declare
        command record;
      begin
        for command in
          select *
          from pg_event_trigger_ddl_commands()
          where command_tag in ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
            and object_type in ('table', 'partitioned table')
        loop
          if command.schema_name = 'public' then
            begin
              execute format(
                'alter table if exists %s enable row level security',
                command.object_identity
              );
            exception
              when others then
                raise log 'rls_auto_enable: failed to enable RLS on %', command.object_identity;
            end;
          end if;
        end loop;
      end;
      $body$
    $function$;
  end if;

  if not exists (
    select 1
    from pg_event_trigger
    where evtfoid = 'public.rls_auto_enable()'::regprocedure
  ) then
    execute $trigger$
      create event trigger ensure_rls
      on ddl_command_end
      when tag in ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      execute function public.rls_auto_enable()
    $trigger$;
  end if;
end;
$migration$;

revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
