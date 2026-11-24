-- Milestone 12 Batch 7: confirmed business settings and GST-safe issuance.

alter table public.business_settings
  add column gst_settings_confirmed_at timestamptz,
  add column gst_settings_confirmed_by_member_id uuid,
  add constraint business_settings_gst_confirmation_fk
    foreign key (organization_id, gst_settings_confirmed_by_member_id)
    references public.organization_members(organization_id, id)
    on delete restrict,
  add constraint business_settings_gst_confirmation_pair_check check (
    (gst_settings_confirmed_at is null and gst_settings_confirmed_by_member_id is null)
    or (gst_settings_confirmed_at is not null and gst_settings_confirmed_by_member_id is not null)
  );

create or replace function private.normalize_nz_ird_number(p_value text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when regexp_replace(coalesce(p_value, ''), '[^0-9]', '', 'g') ~ '^[0-9]{8}$'
      then '0' || regexp_replace(p_value, '[^0-9]', '', 'g')
    else regexp_replace(coalesce(p_value, ''), '[^0-9]', '', 'g')
  end;
$$;

create or replace function private.is_valid_nz_ird_number(p_value text)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_digits text := private.normalize_nz_ird_number(p_value);
  v_number bigint;
  v_sum integer;
  v_check integer;
begin
  if v_digits !~ '^[0-9]{9}$' then return false; end if;
  v_number := v_digits::bigint;
  if v_number < 10000000 or v_number > 200000000 then return false; end if;

  v_sum := substr(v_digits,1,1)::integer * 3
    + substr(v_digits,2,1)::integer * 2
    + substr(v_digits,3,1)::integer * 7
    + substr(v_digits,4,1)::integer * 6
    + substr(v_digits,5,1)::integer * 5
    + substr(v_digits,6,1)::integer * 4
    + substr(v_digits,7,1)::integer * 3
    + substr(v_digits,8,1)::integer * 2;
  v_check := case when v_sum % 11 = 0 then 0 else 11 - (v_sum % 11) end;
  if v_check = 10 then
    v_sum := substr(v_digits,1,1)::integer * 7
      + substr(v_digits,2,1)::integer * 4
      + substr(v_digits,3,1)::integer * 3
      + substr(v_digits,4,1)::integer * 2
      + substr(v_digits,5,1)::integer * 5
      + substr(v_digits,6,1)::integer * 2
      + substr(v_digits,7,1)::integer * 7
      + substr(v_digits,8,1)::integer * 6;
    v_check := case when v_sum % 11 = 0 then 0 else 11 - (v_sum % 11) end;
  end if;
  return v_check between 0 and 9 and v_check = substr(v_digits,9,1)::integer;
end;
$$;

revoke all on function private.normalize_nz_ird_number(text) from public;
revoke all on function private.is_valid_nz_ird_number(text) from public;

create or replace function private.business_settings_are_ready(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select settings.gst_settings_confirmed_at is not null
      and nullif(btrim(organization.legal_name), '') is not null
      and nullif(btrim(settings.business_display_name), '') is not null
      and nullif(btrim(settings.email), '') is not null
      and settings.email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
      and nullif(btrim(settings.address_line_1), '') is not null
      and nullif(btrim(settings.city), '') is not null
      and nullif(btrim(settings.postcode), '') is not null
      and settings.currency = 'NZD'
      and settings.default_gst_rate = 15.0000
      and (
        (not settings.gst_registered and settings.gst_number is null)
        or (settings.gst_registered and private.is_valid_nz_ird_number(settings.gst_number))
      )
    from public.business_settings as settings
    join public.organizations as organization on organization.id = settings.organization_id
    where settings.organization_id = p_organization_id
  ), false);
$$;

revoke all on function private.business_settings_are_ready(uuid) from public;

create or replace function private.require_financial_readiness(p_organization_id uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.business_settings_are_ready(p_organization_id) then
    raise exception 'Complete Business Settings before issuing financial documents'
      using errcode = '23514';
  end if;
end;
$$;

revoke all on function private.require_financial_readiness(uuid) from public;

create or replace function public.get_business_settings(p_organization_id uuid)
returns table (
  organization_id uuid,
  legal_name text,
  trading_name text,
  business_email text,
  business_phone text,
  address_line_1 text,
  address_line_2 text,
  suburb text,
  city text,
  postcode text,
  nzbn text,
  gst_registered boolean,
  gst_number text,
  default_gst_rate numeric,
  currency text,
  timezone text,
  invoice_payment_terms_days integer,
  gst_settings_confirmed_at timestamptz,
  financial_ready boolean,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.has_org_role(p_organization_id, array['owner','admin']) then
    raise exception 'Business settings access denied' using errcode = '42501';
  end if;

  return query
  select settings.organization_id,
    organization.legal_name,
    settings.business_display_name,
    settings.email,
    settings.phone,
    settings.address_line_1,
    settings.address_line_2,
    settings.suburb,
    settings.city,
    settings.postcode,
    settings.nzbn,
    settings.gst_registered,
    settings.gst_number,
    settings.default_gst_rate,
    settings.currency::text,
    settings.timezone,
    settings.invoice_payment_terms_days,
    settings.gst_settings_confirmed_at,
    private.business_settings_are_ready(settings.organization_id),
    settings.updated_at
  from public.business_settings as settings
  join public.organizations as organization on organization.id = settings.organization_id
  where settings.organization_id = p_organization_id;
end;
$$;

create or replace function public.update_business_settings(
  p_organization_id uuid,
  p_expected_updated_at timestamptz,
  p_legal_name text,
  p_trading_name text,
  p_business_email text,
  p_business_phone text,
  p_address_line_1 text,
  p_address_line_2 text,
  p_suburb text,
  p_city text,
  p_postcode text,
  p_nzbn text,
  p_gst_registered boolean,
  p_gst_number text,
  p_currency text,
  p_timezone text,
  p_invoice_payment_terms_days integer
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_settings public.business_settings%rowtype;
  v_actor uuid;
  v_gst_number text;
  v_changed text[] := array[]::text[];
begin
  if not private.has_org_role(p_organization_id, array['owner']) then
    raise exception 'Owner role required' using errcode = '42501';
  end if;
  select * into v_settings from public.business_settings
    where organization_id = p_organization_id for update;
  if not found then raise exception 'Business settings not found' using errcode = 'P0002'; end if;
  if v_settings.updated_at is distinct from p_expected_updated_at then
    raise exception 'Business settings were updated by another user' using errcode = '40001';
  end if;
  if nullif(btrim(p_legal_name), '') is null or char_length(btrim(p_legal_name)) > 200 then
    raise exception 'Legal business name is required' using errcode = '22023';
  end if;
  if nullif(btrim(p_trading_name), '') is null or char_length(btrim(p_trading_name)) > 200 then
    raise exception 'Trading name is required' using errcode = '22023';
  end if;
  if p_business_email !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or char_length(p_business_email) > 320 then
    raise exception 'A valid business email is required' using errcode = '22023';
  end if;
  if nullif(btrim(p_address_line_1), '') is null or nullif(btrim(p_city), '') is null or nullif(btrim(p_postcode), '') is null then
    raise exception 'Business street address, city, and postcode are required' using errcode = '22023';
  end if;
  if p_nzbn is not null and nullif(btrim(p_nzbn), '') is not null and btrim(p_nzbn) !~ '^[0-9]{13}$' then
    raise exception 'NZBN must contain 13 digits' using errcode = '22023';
  end if;
  if p_gst_registered is null then raise exception 'GST registration status is required' using errcode = '22023'; end if;
  v_gst_number := case when p_gst_registered then private.normalize_nz_ird_number(p_gst_number) else null end;
  if p_gst_registered and not private.is_valid_nz_ird_number(v_gst_number) then
    raise exception 'Enter a valid New Zealand GST number' using errcode = '22023';
  end if;
  if upper(btrim(p_currency)) <> 'NZD' then raise exception 'Only NZD is supported' using errcode = '22023'; end if;
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = p_timezone) then
    raise exception 'Select a valid IANA timezone' using errcode = '22023';
  end if;
  if p_invoice_payment_terms_days < 0 or p_invoice_payment_terms_days > 365 then
    raise exception 'Payment terms must be between 0 and 365 days' using errcode = '22023';
  end if;

  v_actor := private.require_current_membership(p_organization_id);
  if v_settings.gst_registered is distinct from p_gst_registered or v_settings.gst_number is distinct from v_gst_number then
    v_changed := array_append(v_changed, 'gst');
  end if;
  if v_settings.timezone is distinct from p_timezone then v_changed := array_append(v_changed, 'timezone'); end if;
  if v_settings.invoice_payment_terms_days is distinct from p_invoice_payment_terms_days then v_changed := array_append(v_changed, 'payment_terms'); end if;

  update public.organizations set
    legal_name = btrim(p_legal_name),
    display_name = btrim(p_trading_name)
  where id = p_organization_id;

  update public.business_settings set
    business_display_name = btrim(p_trading_name),
    email = lower(btrim(p_business_email)),
    phone = nullif(btrim(p_business_phone), ''),
    address_line_1 = btrim(p_address_line_1),
    address_line_2 = nullif(btrim(p_address_line_2), ''),
    suburb = nullif(btrim(p_suburb), ''),
    city = btrim(p_city),
    postcode = btrim(p_postcode),
    nzbn = nullif(btrim(p_nzbn), ''),
    gst_registered = p_gst_registered,
    gst_number = v_gst_number,
    default_gst_rate = 15.0000,
    currency = 'NZD',
    timezone = p_timezone,
    invoice_payment_terms_days = p_invoice_payment_terms_days,
    gst_settings_confirmed_at = now(),
    gst_settings_confirmed_by_member_id = v_actor,
    updated_by_member_id = v_actor
  where organization_id = p_organization_id;

  perform private.log_activity(
    p_organization_id, v_actor, 'member', 'organization', p_organization_id,
    'business_settings.updated', 'Business settings updated',
    jsonb_build_object('changed_sections', v_changed, 'financial_ready', private.business_settings_are_ready(p_organization_id))
  );
end;
$$;

create or replace function public.create_organization(
  p_display_name text,
  p_member_display_name text,
  p_legal_name text,
  p_slug text,
  p_gst_registered boolean,
  p_gst_number text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_organization_id uuid;
  v_actor uuid;
  v_gst_number text;
begin
  if p_gst_registered is null then raise exception 'GST registration status is required' using errcode = '22023'; end if;
  v_gst_number := case when p_gst_registered then private.normalize_nz_ird_number(p_gst_number) else null end;
  if p_gst_registered and not private.is_valid_nz_ird_number(v_gst_number) then
    raise exception 'Enter a valid New Zealand GST number' using errcode = '22023';
  end if;
  v_organization_id := public.create_organization(p_display_name, p_member_display_name, p_legal_name, p_slug);
  v_actor := private.require_current_membership(v_organization_id);
  update public.business_settings set
    gst_registered = p_gst_registered,
    gst_number = v_gst_number,
    default_gst_rate = 15.0000,
    gst_settings_confirmed_at = now(),
    gst_settings_confirmed_by_member_id = v_actor,
    updated_by_member_id = v_actor
  where organization_id = v_organization_id;
  return v_organization_id;
end;
$$;

create or replace function public.issue_quote(p_quote_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_quote public.quotes%rowtype;
  v_customer public.customers%rowtype;
  v_settings public.business_settings%rowtype;
  v_actor uuid;
  v_tax_rate numeric(7,4);
  v_expected_tax_rate numeric(7,4);
begin
  select * into v_quote from public.quotes where id = p_quote_id for update;
  if not found then raise exception 'Quote not found' using errcode = 'P0002'; end if;
  if not private.has_org_role(v_quote.organization_id, array['owner', 'admin']) then raise exception 'Operational role required' using errcode = '42501'; end if;
  if v_quote.status <> 'draft' then raise exception 'Only a draft quote may be issued' using errcode = '55000'; end if;
  if not exists (select 1 from public.quote_items where quote_id = p_quote_id) then raise exception 'Quote requires at least one item' using errcode = '23514'; end if;
  select * into strict v_customer from public.customers
    where organization_id = v_quote.organization_id and id = v_quote.customer_id;
  select * into strict v_settings from public.business_settings
    where organization_id = v_quote.organization_id for share;
  perform private.require_financial_readiness(v_quote.organization_id);
  v_expected_tax_rate := case when v_settings.gst_registered then 15.0000 else 0 end;
  if exists (select 1 from public.quote_items where quote_id = p_quote_id and tax_rate <> v_expected_tax_rate) then
    raise exception 'GST settings changed. Review and save this draft before issuing it' using errcode = '23514';
  end if;
  select max(item.tax_rate) into strict v_tax_rate from public.quote_items as item where item.quote_id = p_quote_id;

  v_actor := private.require_current_membership(v_quote.organization_id);
  update public.quotes set status = 'sent',
    customer_name_snapshot = btrim(v_customer.first_name || ' ' || v_customer.last_name),
    customer_email_snapshot = v_customer.email, customer_phone_snapshot = v_customer.phone,
    billing_address_line_1_snapshot = v_customer.address_line_1, billing_address_line_2_snapshot = v_customer.address_line_2,
    billing_suburb_snapshot = v_customer.suburb, billing_city_snapshot = v_customer.city, billing_postcode_snapshot = v_customer.postcode,
    business_name_snapshot = v_settings.business_display_name, business_email_snapshot = v_settings.email,
    business_phone_snapshot = v_settings.phone, business_address_line_1_snapshot = v_settings.address_line_1,
    business_address_line_2_snapshot = v_settings.address_line_2, business_suburb_snapshot = v_settings.suburb,
    business_city_snapshot = v_settings.city, business_postcode_snapshot = v_settings.postcode,
    business_gst_number_snapshot = v_settings.gst_number, business_gst_registered_snapshot = v_settings.gst_registered,
    tax_rate_snapshot = v_tax_rate
  where id = p_quote_id;

  if v_quote.enquiry_id is not null then
    update public.enquiries set status = 'quoted' where id = v_quote.enquiry_id and status in ('new', 'reviewing');
    if found then perform private.log_activity(v_quote.organization_id, v_actor, 'member', 'enquiry', v_quote.enquiry_id,
      'enquiry.status_changed', 'Status changed to Quoted when quote was issued', jsonb_build_object('quote_id', p_quote_id)); end if;
  end if;
  perform private.log_activity(v_quote.organization_id, v_actor, 'member', 'quote', p_quote_id,
    'quote.issued', 'Quote issued', jsonb_build_object('total_cents', v_quote.total_cents));
end;
$$;

create or replace function public.issue_invoice(p_invoice_id uuid,p_expected_updated_at timestamptz)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invoice public.invoices%rowtype;
  v_customer public.customers%rowtype;
  v_settings public.business_settings%rowtype;
  v_actor uuid;
  v_expected_tax_rate numeric(7,4);
begin
  select * into v_invoice from public.invoices where id=p_invoice_id for update;
  if not found then raise exception 'Invoice not found' using errcode='P0002'; end if;
  if not private.has_org_role(v_invoice.organization_id,array['owner','admin']) then raise exception 'Invoice access denied' using errcode='42501'; end if;
  if v_invoice.status <> 'draft' then raise exception 'Only a draft invoice may be issued' using errcode='55000'; end if;
  if v_invoice.updated_at is distinct from p_expected_updated_at then raise exception 'Invoice was updated by another user' using errcode='40001'; end if;
  if not exists(select 1 from public.invoice_items where invoice_id=p_invoice_id) or v_invoice.total_cents <= 0 then raise exception 'Invoice requires a positive total' using errcode='23514'; end if;
  select * into strict v_customer from public.customers where organization_id=v_invoice.organization_id and id=v_invoice.customer_id;
  select * into strict v_settings from public.business_settings where organization_id=v_invoice.organization_id for share;
  perform private.require_financial_readiness(v_invoice.organization_id);
  v_expected_tax_rate := case when v_settings.gst_registered then 15.0000 else 0 end;
  if exists (select 1 from public.invoice_items where invoice_id = p_invoice_id and tax_rate <> v_expected_tax_rate) then
    raise exception 'GST settings changed. Review and save this draft before issuing it' using errcode = '23514';
  end if;
  v_actor := private.require_current_membership(v_invoice.organization_id);
  update public.invoices set status='sent',
    customer_name_snapshot=btrim(v_customer.first_name||' '||v_customer.last_name),customer_email_snapshot=v_customer.email,customer_phone_snapshot=v_customer.phone,
    billing_address_line_1_snapshot=v_customer.address_line_1,billing_address_line_2_snapshot=v_customer.address_line_2,billing_suburb_snapshot=v_customer.suburb,billing_city_snapshot=v_customer.city,billing_postcode_snapshot=v_customer.postcode,
    business_name_snapshot=v_settings.business_display_name,business_email_snapshot=v_settings.email,business_phone_snapshot=v_settings.phone,
    business_address_line_1_snapshot=v_settings.address_line_1,business_address_line_2_snapshot=v_settings.address_line_2,business_suburb_snapshot=v_settings.suburb,business_city_snapshot=v_settings.city,business_postcode_snapshot=v_settings.postcode,
    business_gst_number_snapshot=v_settings.gst_number,business_gst_registered_snapshot=v_settings.gst_registered,
    tax_rate_snapshot=v_expected_tax_rate
  where id=p_invoice_id;
  perform private.log_activity(v_invoice.organization_id,v_actor,'member','invoice',p_invoice_id,
    'invoice.issued','Invoice issued',jsonb_build_object('total_cents',v_invoice.total_cents));
end;
$$;

revoke update on public.business_settings from authenticated;
revoke all on function public.get_business_settings(uuid) from public, anon;
revoke all on function public.update_business_settings(uuid,timestamptz,text,text,text,text,text,text,text,text,text,text,boolean,text,text,text,integer) from public, anon;
revoke all on function public.create_organization(text,text,text,text,boolean,text) from public, anon;
revoke all on function public.issue_quote(uuid) from public, anon;
revoke all on function public.issue_invoice(uuid,timestamptz) from public, anon;
revoke execute on function public.set_quote_status(uuid,text) from authenticated;
revoke execute on function public.set_invoice_status(uuid,text) from authenticated;

grant execute on function public.get_business_settings(uuid) to authenticated;
grant execute on function public.update_business_settings(uuid,timestamptz,text,text,text,text,text,text,text,text,text,text,boolean,text,text,text,integer) to authenticated;
grant execute on function public.create_organization(text,text,text,text,boolean,text) to authenticated;
grant execute on function public.issue_quote(uuid) to authenticated;
grant execute on function public.issue_invoice(uuid,timestamptz) to authenticated;

comment on column public.business_settings.gst_settings_confirmed_at is
  'When an owner explicitly confirmed the organization GST registration settings.';
comment on function public.update_business_settings(uuid,timestamptz,text,text,text,text,text,text,text,text,text,text,boolean,text,text,text,integer) is
  'Owner-only trusted update for business identity, GST confirmation, timezone, and payment terms.';
comment on function private.require_financial_readiness(uuid) is
  'Rejects financial document issuance until required business and GST settings are owner-confirmed.';
