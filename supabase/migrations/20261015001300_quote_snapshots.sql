-- Preserve customer and business document details when a quote is issued.

alter table public.quotes
  add column customer_name_snapshot text,
  add column customer_email_snapshot text,
  add column customer_phone_snapshot text,
  add column billing_address_line_1_snapshot text,
  add column billing_address_line_2_snapshot text,
  add column billing_suburb_snapshot text,
  add column billing_city_snapshot text,
  add column billing_postcode_snapshot text,
  add column business_name_snapshot text,
  add column business_email_snapshot text,
  add column business_phone_snapshot text,
  add column business_address_line_1_snapshot text,
  add column business_address_line_2_snapshot text,
  add column business_suburb_snapshot text,
  add column business_city_snapshot text,
  add column business_postcode_snapshot text,
  add column business_gst_number_snapshot text,
  add column business_gst_registered_snapshot boolean,
  add column tax_rate_snapshot numeric(7,4) check (tax_rate_snapshot between 0 and 100);

-- Existing issued quotes can only be backfilled from values available now. This
-- establishes a stable baseline but cannot recover details changed in the past.
update public.quotes as quote
set
  customer_name_snapshot = btrim(customer.first_name || ' ' || customer.last_name),
  customer_email_snapshot = customer.email,
  customer_phone_snapshot = customer.phone,
  billing_address_line_1_snapshot = customer.address_line_1,
  billing_address_line_2_snapshot = customer.address_line_2,
  billing_suburb_snapshot = customer.suburb,
  billing_city_snapshot = customer.city,
  billing_postcode_snapshot = customer.postcode,
  business_name_snapshot = settings.business_display_name,
  business_email_snapshot = settings.email,
  business_phone_snapshot = settings.phone,
  business_address_line_1_snapshot = settings.address_line_1,
  business_address_line_2_snapshot = settings.address_line_2,
  business_suburb_snapshot = settings.suburb,
  business_city_snapshot = settings.city,
  business_postcode_snapshot = settings.postcode,
  business_gst_number_snapshot = settings.gst_number,
  business_gst_registered_snapshot = settings.gst_registered,
  tax_rate_snapshot = coalesce(
    (select max(item.tax_rate) from public.quote_items as item where item.quote_id = quote.id),
    case when settings.gst_registered then settings.default_gst_rate else 0 end
  )
from public.customers as customer, public.business_settings as settings
where quote.status <> 'draft'
  and customer.organization_id = quote.organization_id
  and customer.id = quote.customer_id
  and settings.organization_id = quote.organization_id;

alter table public.quotes
  add constraint quotes_issued_snapshot_check check (
    status = 'draft'
    or (
      nullif(btrim(customer_name_snapshot), '') is not null
      and nullif(btrim(business_name_snapshot), '') is not null
      and business_gst_registered_snapshot is not null
      and tax_rate_snapshot is not null
    )
  );

create or replace function private.guard_quote_lifecycle()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.organization_id is distinct from old.organization_id
     or new.quote_number is distinct from old.quote_number
     or new.created_by_member_id is distinct from old.created_by_member_id then
    raise exception 'Quote ownership and system fields are immutable' using errcode = '42501';
  end if;

  if old.status <> 'draft' and (
    new.customer_id is distinct from old.customer_id
    or new.enquiry_id is distinct from old.enquiry_id
    or new.issue_date is distinct from old.issue_date
    or new.expiry_date is distinct from old.expiry_date
    or new.currency is distinct from old.currency
    or new.notes is distinct from old.notes
    or new.terms is distinct from old.terms
    or new.subtotal_cents is distinct from old.subtotal_cents
    or new.tax_cents is distinct from old.tax_cents
    or new.total_cents is distinct from old.total_cents
    or new.customer_name_snapshot is distinct from old.customer_name_snapshot
    or new.customer_email_snapshot is distinct from old.customer_email_snapshot
    or new.customer_phone_snapshot is distinct from old.customer_phone_snapshot
    or new.billing_address_line_1_snapshot is distinct from old.billing_address_line_1_snapshot
    or new.billing_address_line_2_snapshot is distinct from old.billing_address_line_2_snapshot
    or new.billing_suburb_snapshot is distinct from old.billing_suburb_snapshot
    or new.billing_city_snapshot is distinct from old.billing_city_snapshot
    or new.billing_postcode_snapshot is distinct from old.billing_postcode_snapshot
    or new.business_name_snapshot is distinct from old.business_name_snapshot
    or new.business_email_snapshot is distinct from old.business_email_snapshot
    or new.business_phone_snapshot is distinct from old.business_phone_snapshot
    or new.business_address_line_1_snapshot is distinct from old.business_address_line_1_snapshot
    or new.business_address_line_2_snapshot is distinct from old.business_address_line_2_snapshot
    or new.business_suburb_snapshot is distinct from old.business_suburb_snapshot
    or new.business_city_snapshot is distinct from old.business_city_snapshot
    or new.business_postcode_snapshot is distinct from old.business_postcode_snapshot
    or new.business_gst_number_snapshot is distinct from old.business_gst_number_snapshot
    or new.business_gst_registered_snapshot is distinct from old.business_gst_registered_snapshot
    or new.tax_rate_snapshot is distinct from old.tax_rate_snapshot
  ) then
    raise exception 'Issued quote content is immutable' using errcode = '42501';
  end if;

  if new.status is distinct from old.status then
    if not (
      (old.status = 'draft' and new.status in ('sent', 'rejected'))
      or (old.status = 'sent' and new.status in ('accepted', 'rejected'))
    ) then
      raise exception 'Invalid quote status transition' using errcode = '23514';
    end if;

    if new.status = 'sent' then new.sent_at := now(); end if;
    if new.status = 'accepted' then new.accepted_at := now(); end if;
    if new.status = 'rejected' then new.rejected_at := now(); end if;
  end if;

  return new;
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
begin
  select * into v_quote from public.quotes where id = p_quote_id for update;
  if not found then raise exception 'Quote not found' using errcode = 'P0002'; end if;
  if not private.has_org_role(v_quote.organization_id, array['owner', 'admin']) then raise exception 'Operational role required' using errcode = '42501'; end if;
  if v_quote.status <> 'draft' then raise exception 'Only a draft quote may be issued' using errcode = '55000'; end if;
  if not exists (select 1 from public.quote_items where quote_id = p_quote_id) then raise exception 'Quote requires at least one item' using errcode = '23514'; end if;

  select * into strict v_customer
  from public.customers
  where organization_id = v_quote.organization_id and id = v_quote.customer_id;

  select * into strict v_settings
  from public.business_settings
  where organization_id = v_quote.organization_id;

  select max(item.tax_rate) into strict v_tax_rate
  from public.quote_items as item
  where item.quote_id = p_quote_id;

  v_actor := private.require_current_membership(v_quote.organization_id);
  update public.quotes set
    status = 'sent',
    customer_name_snapshot = btrim(v_customer.first_name || ' ' || v_customer.last_name),
    customer_email_snapshot = v_customer.email,
    customer_phone_snapshot = v_customer.phone,
    billing_address_line_1_snapshot = v_customer.address_line_1,
    billing_address_line_2_snapshot = v_customer.address_line_2,
    billing_suburb_snapshot = v_customer.suburb,
    billing_city_snapshot = v_customer.city,
    billing_postcode_snapshot = v_customer.postcode,
    business_name_snapshot = v_settings.business_display_name,
    business_email_snapshot = v_settings.email,
    business_phone_snapshot = v_settings.phone,
    business_address_line_1_snapshot = v_settings.address_line_1,
    business_address_line_2_snapshot = v_settings.address_line_2,
    business_suburb_snapshot = v_settings.suburb,
    business_city_snapshot = v_settings.city,
    business_postcode_snapshot = v_settings.postcode,
    business_gst_number_snapshot = v_settings.gst_number,
    business_gst_registered_snapshot = v_settings.gst_registered,
    tax_rate_snapshot = v_tax_rate
  where id = p_quote_id;

  if v_quote.enquiry_id is not null then
    update public.enquiries set status = 'quoted' where id = v_quote.enquiry_id and status in ('new', 'reviewing');
    if found then
      perform private.log_activity(v_quote.organization_id, v_actor, 'member', 'enquiry', v_quote.enquiry_id,
        'enquiry.status_changed', 'Status changed to Quoted when quote was issued', jsonb_build_object('quote_id', p_quote_id));
    end if;
  end if;

  perform private.log_activity(v_quote.organization_id, v_actor, 'member', 'quote', p_quote_id,
    'quote.issued', 'Quote issued', jsonb_build_object('total_cents', v_quote.total_cents));
end;
$$;

create or replace function public.get_quote_document_business(p_organization_id uuid)
returns table (
  business_name text,
  business_email text,
  business_phone text,
  address_line_1 text,
  address_line_2 text,
  suburb text,
  city text,
  postcode text,
  gst_number text,
  gst_registered boolean,
  tax_rate numeric
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.has_org_role(p_organization_id, array['owner', 'admin']) then
    raise exception 'Operational role required' using errcode = '42501';
  end if;

  return query
  select
    settings.business_display_name,
    settings.email,
    settings.phone,
    settings.address_line_1,
    settings.address_line_2,
    settings.suburb,
    settings.city,
    settings.postcode,
    settings.gst_number,
    settings.gst_registered,
    case when settings.gst_registered then settings.default_gst_rate else 0 end
  from public.business_settings as settings
  where settings.organization_id = p_organization_id;
end;
$$;

revoke all on function public.issue_quote(uuid) from public, anon;
grant execute on function public.issue_quote(uuid) to authenticated;
revoke all on function public.get_quote_document_business(uuid) from public, anon;
grant execute on function public.get_quote_document_business(uuid) to authenticated;

comment on function public.issue_quote(uuid) is
  'Issues and locks a quote, captures trusted customer and business snapshots, records activity, and advances an eligible linked enquiry to quoted.';
comment on function public.get_quote_document_business(uuid) is
  'Returns current business document details to active owner/admin members for draft quote display.';
