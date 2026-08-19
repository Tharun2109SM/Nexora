-- Complete the Milestone 4 in-app support notification workflow. Notifications
-- are derived only from immutable support events and contain no message bodies,
-- internal-note content, event metadata, or storage identifiers.

create or replace function private.create_support_event_notifications()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  ticket_record record;
  recipient record;
  customer_title text;
begin
  -- Database-owner maintenance and fixture loading must remain side-effect free.
  if (select auth.uid()) is null or new.event_type = 'INTERNAL_NOTE_ADDED' then
    return new;
  end if;

  select
    ticket.id,
    ticket.ticket_number,
    ticket.organization_id,
    ticket.product_id,
    ticket.assigned_to,
    ticket.subject
  into ticket_record
  from public.support_tickets ticket
  where ticket.id = new.ticket_id;

  if not found then
    return new;
  end if;

  if new.event_type in ('TICKET_CREATED', 'CUSTOMER_REPLIED') then
    for recipient in
      select distinct membership.user_id
      from public.organization_memberships membership
      join public.organizations organization on organization.id = membership.organization_id
      where membership.status = 'ACTIVE'
        and organization.organization_type = 'BEAUROI'
        and organization.is_active
        and (
          membership.role = 'BEAUROI_ADMIN'
          or (
            membership.role = 'BEAUROI_EMPLOYEE'
            and exists (
              select 1
              from public.customer_assignments assignment
              where assignment.employee_user_id = membership.user_id
                and assignment.organization_id = ticket_record.organization_id
                and assignment.assignment_type = 'SUPPORT_LEAD'
                and assignment.is_active
                and assignment.ended_at is null
                and (
                  assignment.product_id is null
                  or (
                    ticket_record.product_id is not null
                    and assignment.product_id = ticket_record.product_id
                  )
                )
            )
          )
        )
    loop
      insert into public.notifications (
        organization_id, user_id, title, body, category, link_path
      ) values (
        ticket_record.organization_id,
        recipient.user_id,
        case new.event_type
          when 'TICKET_CREATED' then 'New customer support ticket'
          else 'Customer replied to a support ticket'
        end,
        format('SUP-%s · %s', ticket_record.ticket_number, ticket_record.subject),
        'SUPPORT',
        format('/beauroi/support/%s', ticket_record.id)
      );
    end loop;
  end if;

  if new.event_type = 'ASSIGNED' and ticket_record.assigned_to is not null and exists (
    select 1
    from public.organization_memberships membership
    join public.organizations organization on organization.id = membership.organization_id
    where membership.user_id = ticket_record.assigned_to
      and membership.status = 'ACTIVE'
      and membership.role in ('BEAUROI_ADMIN', 'BEAUROI_EMPLOYEE')
      and organization.organization_type = 'BEAUROI'
      and organization.is_active
  ) then
    insert into public.notifications (
      organization_id, user_id, title, body, category, link_path
    ) values (
      ticket_record.organization_id,
      ticket_record.assigned_to,
      'Support ticket assigned to you',
      format('SUP-%s · %s', ticket_record.ticket_number, ticket_record.subject),
      'SUPPORT',
      format('/beauroi/support/%s', ticket_record.id)
    );
  end if;

  customer_title := case
    when new.event_type = 'STAFF_REPLIED' then 'Beau Roi replied to your support ticket'
    when new.event_type = 'RESOLVED' then 'Support ticket resolved'
    when new.event_type = 'CLOSED' then 'Support ticket closed'
    when new.event_type = 'STATUS_CHANGED'
      and new.metadata ->> 'after' = 'WAITING_ON_CUSTOMER'
      then 'Support ticket is waiting for your response'
    else null
  end;

  if customer_title is not null then
    for recipient in
      select membership.user_id
      from public.organization_memberships membership
      join public.organizations organization on organization.id = membership.organization_id
      where membership.organization_id = ticket_record.organization_id
        and membership.status = 'ACTIVE'
        and membership.role in ('CUSTOMER_ADMIN', 'CUSTOMER_MEMBER')
        and organization.organization_type = 'CUSTOMER'
        and organization.is_active
    loop
      insert into public.notifications (
        organization_id, user_id, title, body, category, link_path
      ) values (
        ticket_record.organization_id,
        recipient.user_id,
        customer_title,
        format('SUP-%s · %s', ticket_record.ticket_number, ticket_record.subject),
        'SUPPORT',
        format('/portal/support/%s', ticket_record.id)
      );
    end loop;
  end if;

  return new;
end;
$$;

create trigger support_ticket_events_create_notifications
  after insert on public.support_ticket_events
  for each row execute function private.create_support_event_notifications();

-- Notifications are personal. Staff administration does not require reading
-- other users' notification inboxes.
drop policy if exists notifications_read_own on public.notifications;
create policy notifications_read_own on public.notifications
  for select to authenticated
  using (
    user_id = (select auth.uid())
    and (select private.can_access_organization(organization_id))
  );

revoke all on function private.create_support_event_notifications()
  from public, anon, authenticated;
