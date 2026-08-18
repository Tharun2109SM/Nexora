-- Allow Supabase Dashboard/Admin API users to be created before they are assigned
-- to an organization. Authorization remains entirely membership-backed.
create or replace function private.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_organization_id uuid;
  company_name text;
  company_name_supplied boolean;
  generated_slug text;
  account_type text;
  profile_name text;
  email_local_part text;
begin
  account_type := new.raw_app_meta_data ->> 'nexora_account_type';

  -- Preserve the explicit staff-provisioning path. This creates only a profile:
  -- app metadata never grants portal access without an active Beau Roi membership.
  if account_type = 'BEAUROI' then
    insert into public.profiles (id, full_name, designation, phone)
    values (
      new.id,
      coalesce(nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''), 'Beau Roi user'),
      nullif(btrim(new.raw_user_meta_data ->> 'designation'), ''),
      nullif(btrim(new.raw_user_meta_data ->> 'phone'), '')
    );
    return new;
  end if;

  company_name_supplied := coalesce(new.raw_user_meta_data ? 'company_name', false);

  -- Dashboard/Admin API inserts do not reliably contain app metadata while this
  -- AFTER INSERT trigger runs. An absent company field therefore means the user is
  -- intentionally unassigned, not an incomplete customer registration.
  if not company_name_supplied then
    profile_name := nullif(btrim(new.raw_user_meta_data ->> 'full_name'), '');
    if profile_name is null or char_length(profile_name) not between 2 and 120 then
      email_local_part := nullif(btrim(split_part(coalesce(new.email, ''), '@', 1)), '');
      if email_local_part is not null and char_length(email_local_part) between 2 and 120 then
        profile_name := email_local_part;
      else
        profile_name := 'Unassigned user';
      end if;
    end if;

    insert into public.profiles (id, full_name, designation, phone)
    values (
      new.id,
      profile_name,
      nullif(btrim(new.raw_user_meta_data ->> 'designation'), ''),
      nullif(btrim(new.raw_user_meta_data ->> 'phone'), '')
    );
    return new;
  end if;

  company_name := nullif(btrim(new.raw_user_meta_data ->> 'company_name', E' \t\n\r'), '');
  if company_name is null or char_length(company_name) not between 2 and 160 then
    raise exception 'A valid organization name is required for customer registration';
  end if;

  generated_slug := trim(both '-' from regexp_replace(lower(company_name), '[^a-z0-9]+', '-', 'g'));
  if generated_slug = '' then generated_slug := 'customer'; end if;
  generated_slug := generated_slug || '-' || substr(replace(new.id::text, '-', ''), 1, 8);

  insert into public.organizations (
    name,
    slug,
    organization_type,
    website,
    industry,
    company_size,
    country
  )
  values (
    company_name,
    generated_slug,
    'CUSTOMER',
    nullif(btrim(new.raw_user_meta_data ->> 'company_website'), ''),
    nullif(btrim(new.raw_user_meta_data ->> 'industry'), ''),
    nullif(btrim(new.raw_user_meta_data ->> 'company_size'), ''),
    nullif(btrim(new.raw_user_meta_data ->> 'country'), '')
  )
  returning id into new_organization_id;

  insert into public.profiles (id, full_name, designation, phone)
  values (
    new.id,
    coalesce(nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''), 'Customer administrator'),
    nullif(btrim(new.raw_user_meta_data ->> 'designation'), ''),
    nullif(btrim(new.raw_user_meta_data ->> 'phone'), '')
  );

  insert into public.organization_memberships (
    organization_id,
    user_id,
    role,
    status,
    is_primary,
    joined_at
  )
  values (new_organization_id, new.id, 'CUSTOMER_ADMIN', 'ACTIVE', true, now());

  return new;
end;
$$;

revoke all on function private.handle_new_auth_user() from public, anon, authenticated;
