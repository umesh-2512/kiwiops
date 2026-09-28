-- Atomic customer operations with append-only activity history.
-- Caller identity and office authorization are always derived from auth.uid().

create or replace function private.validate_customer_fields(
  p_first_name text,
  p_last_name text,
  p_email text,
  p_phone text,
  p_address_line_1 text,
  p_address_line_2 text,
  p_suburb text,
  p_city text,
  p_postcode text,
  p_notes text
)
returns void
language plpgsql
immutable
security definer
set search_path = ''
as $$
begin
  if nullif(btrim(p_first_name), '') is null or char_length(btrim(p_first_name)) > 100 then
    raise exception 'Invalid first name' using errcode = '22023';
  end if;
  if nullif(btrim(p_last_name), '') is null or char_length(btrim(p_last_name)) > 100 then
    raise exception 'Invalid last name' using errcode = '22023';
  end if;
  if nullif(btrim(p_email), '') is not null and (
    char_length(btrim(p_email)) > 254
    or btrim(p_email) !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  ) then
    raise exception 'Invalid email' using errcode = '22023';
  end if;
  if nullif(btrim(p_phone), '') is not null and (
    char_length(btrim(p_phone)) not between 7 and 30
    or btrim(p_phone) !~ '^[+0-9][0-9[:space:]().-]*$'
  ) then
    raise exception 'Invalid phone' using errcode = '22023';
  end if;
  if char_length(coalesce(btrim(p_address_line_1), '')) > 160
    or char_length(coalesce(btrim(p_address_line_2), '')) > 160
    or char_length(coalesce(btrim(p_suburb), '')) > 100
    or char_length(coalesce(btrim(p_city), '')) > 100
    or char_length(coalesce(btrim(p_postcode), '')) > 20
    or char_length(coalesce(btrim(p_notes), '')) > 5000 then
    raise exception 'Invalid customer field length' using errcode = '22023';
  end if;
end;
$$;

revoke all on function private.validate_customer_fields(text, text, text, text, text, text, text, text, text, text) from public, anon, authenticated;

create or replace function public.create_customer(
  p_organization_id uuid,
  p_first_name text,
  p_last_name text,
  p_email text,
  p_phone text,
  p_address_line_1 text,
  p_address_line_2 text,
  p_suburb text,
  p_city text,
  p_postcode text,
  p_notes text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid;
  v_customer_id uuid;
begin
  if not private.has_org_role(p_organization_id, array['owner', 'admin']) then
    raise exception 'Operational role required' using errcode = '42501';
  end if;

  perform private.validate_customer_fields(
    p_first_name, p_last_name, p_email, p_phone, p_address_line_1,
    p_address_line_2, p_suburb, p_city, p_postcode, p_notes
  );
  v_actor := private.require_current_membership(p_organization_id);

  insert into public.customers (
    organization_id, first_name, last_name, email, phone, address_line_1,
    address_line_2, suburb, city, postcode, notes
  ) values (
    p_organization_id, btrim(p_first_name), btrim(p_last_name),
    nullif(btrim(p_email), ''), nullif(btrim(p_phone), ''),
    nullif(btrim(p_address_line_1), ''), nullif(btrim(p_address_line_2), ''),
    nullif(btrim(p_suburb), ''), nullif(btrim(p_city), ''),
    nullif(btrim(p_postcode), ''), nullif(btrim(p_notes), '')
  ) returning id into v_customer_id;

  perform private.log_activity(
    p_organization_id, v_actor, 'member', 'customer', v_customer_id,
    'customer.created', 'Customer created', '{}'::jsonb
  );

  return v_customer_id;
end;
$$;

create or replace function public.update_customer(
  p_customer_id uuid,
  p_first_name text,
  p_last_name text,
  p_email text,
  p_phone text,
  p_address_line_1 text,
  p_address_line_2 text,
  p_suburb text,
  p_city text,
  p_postcode text,
  p_notes text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_customer public.customers%rowtype;
  v_actor uuid;
begin
  select * into v_customer
  from public.customers
  where id = p_customer_id
  for update;

  if not found then
    raise exception 'Customer not found' using errcode = 'P0002';
  end if;
  if not private.has_org_role(v_customer.organization_id, array['owner', 'admin']) then
    raise exception 'Operational role required' using errcode = '42501';
  end if;

  perform private.validate_customer_fields(
    p_first_name, p_last_name, p_email, p_phone, p_address_line_1,
    p_address_line_2, p_suburb, p_city, p_postcode, p_notes
  );
  v_actor := private.require_current_membership(v_customer.organization_id);

  update public.customers
  set first_name = btrim(p_first_name),
      last_name = btrim(p_last_name),
      email = nullif(btrim(p_email), ''),
      phone = nullif(btrim(p_phone), ''),
      address_line_1 = nullif(btrim(p_address_line_1), ''),
      address_line_2 = nullif(btrim(p_address_line_2), ''),
      suburb = nullif(btrim(p_suburb), ''),
      city = nullif(btrim(p_city), ''),
      postcode = nullif(btrim(p_postcode), ''),
      notes = nullif(btrim(p_notes), '')
  where id = p_customer_id;

  perform private.log_activity(
    v_customer.organization_id, v_actor, 'member', 'customer', p_customer_id,
    'customer.updated', 'Customer details updated', '{}'::jsonb
  );
end;
$$;

create or replace function public.set_customer_archived(
  p_customer_id uuid,
  p_archived boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_customer public.customers%rowtype;
  v_actor uuid;
begin
  select * into v_customer
  from public.customers
  where id = p_customer_id
  for update;

  if not found then
    raise exception 'Customer not found' using errcode = 'P0002';
  end if;
  if not private.has_org_role(v_customer.organization_id, array['owner', 'admin']) then
    raise exception 'Operational role required' using errcode = '42501';
  end if;

  v_actor := private.require_current_membership(v_customer.organization_id);

  update public.customers
  set status = case when p_archived then 'archived' else 'active' end,
      archived_at = case when p_archived then now() else null end
  where id = p_customer_id;

  perform private.log_activity(
    v_customer.organization_id, v_actor, 'member', 'customer', p_customer_id,
    case when p_archived then 'customer.archived' else 'customer.restored' end,
    case when p_archived then 'Customer archived' else 'Customer restored' end,
    '{}'::jsonb
  );
end;
$$;

revoke all on function public.create_customer(uuid, text, text, text, text, text, text, text, text, text, text) from public, anon;
revoke all on function public.update_customer(uuid, text, text, text, text, text, text, text, text, text, text) from public, anon;
revoke all on function public.set_customer_archived(uuid, boolean) from public, anon;

-- Customer writes must use the checked functions above so the change and its
-- activity entry cannot be separated or bypass database validation.
revoke insert, update on public.customers from authenticated;

grant execute on function public.create_customer(uuid, text, text, text, text, text, text, text, text, text, text) to authenticated;
grant execute on function public.update_customer(uuid, text, text, text, text, text, text, text, text, text, text) to authenticated;
grant execute on function public.set_customer_archived(uuid, boolean) to authenticated;

comment on function public.create_customer(uuid, text, text, text, text, text, text, text, text, text, text) is
  'Creates an organization customer and activity entry after deriving office authorization from auth.uid().';
comment on function public.update_customer(uuid, text, text, text, text, text, text, text, text, text, text) is
  'Updates editable customer fields and records activity without allowing ownership changes.';
comment on function public.set_customer_archived(uuid, boolean) is
  'Archives or restores a customer and records the lifecycle event atomically.';
