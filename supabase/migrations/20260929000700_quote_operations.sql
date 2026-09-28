-- Atomic quote operations. Financial totals remain trigger-calculated from trusted line inputs.

create or replace function private.insert_quote_items(
  p_organization_id uuid,
  p_quote_id uuid,
  p_items jsonb,
  p_tax_rate numeric
)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_item jsonb;
  v_position integer := 0;
  v_description text;
  v_quantity numeric(12,3);
  v_unit_price_cents bigint;
begin
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) > 100 then
    raise exception 'Quote items must be an array of at most 100 items' using errcode = '22023';
  end if;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_description := btrim(coalesce(v_item ->> 'description', ''));
    if v_description = '' or char_length(v_description) > 500 then
      raise exception 'Invalid quote item description' using errcode = '22023';
    end if;
    begin
      v_quantity := (v_item ->> 'quantity')::numeric(12,3);
      v_unit_price_cents := (v_item ->> 'unit_price_cents')::bigint;
    exception when others then
      raise exception 'Invalid quote item amount' using errcode = '22023';
    end;
    if v_quantity <= 0 or v_quantity > 999999.999::numeric
       or v_unit_price_cents < 0 or v_unit_price_cents > 99999999 then
      raise exception 'Invalid quote item amount' using errcode = '22023';
    end if;

    insert into public.quote_items (
      organization_id, quote_id, description, quantity, unit_price_cents, tax_rate, position
    ) values (
      p_organization_id, p_quote_id, v_description, v_quantity, v_unit_price_cents, p_tax_rate, v_position
    );
    v_position := v_position + 1;
  end loop;
end;
$$;

revoke all on function private.insert_quote_items(uuid, uuid, jsonb, numeric) from public, anon, authenticated;

create or replace function public.get_quote_defaults(p_organization_id uuid)
returns table (quote_validity_days integer, currency char(3), default_gst_rate numeric, gst_registered boolean)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.has_org_role(p_organization_id, array['owner', 'admin']) then
    raise exception 'Operational role required' using errcode = '42501';
  end if;
  return query select s.quote_validity_days, s.currency, s.default_gst_rate, s.gst_registered
    from public.business_settings s where s.organization_id = p_organization_id;
end;
$$;

create or replace function public.create_quote(
  p_organization_id uuid,
  p_customer_id uuid,
  p_enquiry_id uuid,
  p_expiry_date date,
  p_notes text,
  p_terms text,
  p_items jsonb
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid;
  v_quote_id uuid;
  v_settings public.business_settings%rowtype;
begin
  if not private.has_org_role(p_organization_id, array['owner', 'admin']) then
    raise exception 'Operational role required' using errcode = '42501';
  end if;
  if not exists (select 1 from public.customers where id = p_customer_id and organization_id = p_organization_id and status = 'active') then
    raise exception 'Active customer not found' using errcode = 'P0002';
  end if;
  if p_enquiry_id is not null and not exists (
    select 1 from public.enquiries where id = p_enquiry_id and organization_id = p_organization_id
      and customer_id = p_customer_id and status <> 'closed'
  ) then
    raise exception 'Valid enquiry not found for customer' using errcode = 'P0002';
  end if;
  if p_expiry_date < current_date or char_length(coalesce(p_notes, '')) > 5000 or char_length(coalesce(p_terms, '')) > 5000 then
    raise exception 'Invalid quote details' using errcode = '22023';
  end if;

  select * into strict v_settings from public.business_settings where organization_id = p_organization_id;
  v_actor := private.require_current_membership(p_organization_id);
  insert into public.quotes (organization_id, customer_id, enquiry_id, issue_date, expiry_date, currency, notes, terms)
  values (p_organization_id, p_customer_id, p_enquiry_id, current_date, p_expiry_date, v_settings.currency,
    nullif(btrim(p_notes), ''), nullif(btrim(p_terms), '')) returning id into v_quote_id;
  perform private.insert_quote_items(p_organization_id, v_quote_id, p_items,
    case when v_settings.gst_registered then v_settings.default_gst_rate else 0 end);
  perform private.log_activity(p_organization_id, v_actor, 'member', 'quote', v_quote_id,
    'quote.created', 'Quote draft created', jsonb_build_object('item_count', jsonb_array_length(p_items)));
  return v_quote_id;
end;
$$;

create or replace function public.update_draft_quote(
  p_quote_id uuid,
  p_customer_id uuid,
  p_enquiry_id uuid,
  p_expiry_date date,
  p_notes text,
  p_terms text,
  p_items jsonb,
  p_expected_updated_at timestamptz
)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_quote public.quotes%rowtype;
  v_actor uuid;
  v_tax_rate numeric(7,4);
begin
  select * into v_quote from public.quotes where id = p_quote_id for update;
  if not found then raise exception 'Quote not found' using errcode = 'P0002'; end if;
  if not private.has_org_role(v_quote.organization_id, array['owner', 'admin']) then raise exception 'Operational role required' using errcode = '42501'; end if;
  if v_quote.status <> 'draft' then raise exception 'Only draft quotes may be updated' using errcode = '55000'; end if;
  if v_quote.updated_at is distinct from p_expected_updated_at then raise exception 'Quote was updated by another user' using errcode = '40001'; end if;
  if not exists (select 1 from public.customers where id = p_customer_id and organization_id = v_quote.organization_id and status = 'active') then raise exception 'Active customer not found' using errcode = 'P0002'; end if;
  if p_enquiry_id is not null and not exists (
    select 1 from public.enquiries where id = p_enquiry_id and organization_id = v_quote.organization_id
      and customer_id = p_customer_id and status <> 'closed'
  ) then raise exception 'Valid enquiry not found for customer' using errcode = 'P0002'; end if;
  if p_expiry_date < v_quote.issue_date or char_length(coalesce(p_notes, '')) > 5000 or char_length(coalesce(p_terms, '')) > 5000 then raise exception 'Invalid quote details' using errcode = '22023'; end if;

  select case when gst_registered then default_gst_rate else 0 end into strict v_tax_rate
    from public.business_settings where organization_id = v_quote.organization_id;
  v_actor := private.require_current_membership(v_quote.organization_id);
  update public.quotes set customer_id = p_customer_id, enquiry_id = p_enquiry_id, expiry_date = p_expiry_date,
    notes = nullif(btrim(p_notes), ''), terms = nullif(btrim(p_terms), '') where id = p_quote_id;
  delete from public.quote_items where quote_id = p_quote_id;
  perform private.insert_quote_items(v_quote.organization_id, p_quote_id, p_items, v_tax_rate);
  perform private.log_activity(v_quote.organization_id, v_actor, 'member', 'quote', p_quote_id,
    'quote.updated', 'Quote draft updated', jsonb_build_object('item_count', jsonb_array_length(p_items)));
end;
$$;

create or replace function public.issue_quote(p_quote_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_quote public.quotes%rowtype;
  v_actor uuid;
begin
  select * into v_quote from public.quotes where id = p_quote_id for update;
  if not found then raise exception 'Quote not found' using errcode = 'P0002'; end if;
  if not private.has_org_role(v_quote.organization_id, array['owner', 'admin']) then raise exception 'Operational role required' using errcode = '42501'; end if;
  if v_quote.status <> 'draft' then raise exception 'Only a draft quote may be issued' using errcode = '55000'; end if;
  if not exists (select 1 from public.quote_items where quote_id = p_quote_id) then raise exception 'Quote requires at least one item' using errcode = '23514'; end if;
  v_actor := private.require_current_membership(v_quote.organization_id);
  update public.quotes set status = 'sent' where id = p_quote_id;
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

create or replace function public.set_quote_outcome(p_quote_id uuid, p_status text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_quote public.quotes%rowtype;
  v_actor uuid;
begin
  select * into v_quote from public.quotes where id = p_quote_id for update;
  if not found then raise exception 'Quote not found' using errcode = 'P0002'; end if;
  if not private.has_org_role(v_quote.organization_id, array['owner', 'admin']) then raise exception 'Operational role required' using errcode = '42501'; end if;
  if v_quote.status <> 'sent' or p_status not in ('accepted', 'rejected') then raise exception 'Invalid quote outcome transition' using errcode = '23514'; end if;
  v_actor := private.require_current_membership(v_quote.organization_id);
  update public.quotes set status = p_status where id = p_quote_id;
  perform private.log_activity(v_quote.organization_id, v_actor, 'member', 'quote', p_quote_id,
    case when p_status = 'accepted' then 'quote.accepted' else 'quote.rejected' end,
    case when p_status = 'accepted' then 'Quote accepted' else 'Quote declined' end,
    jsonb_build_object('from', v_quote.status, 'to', p_status));
end;
$$;

revoke all on function public.create_quote(uuid, uuid, uuid, date, text, text, jsonb) from public, anon;
revoke all on function public.get_quote_defaults(uuid) from public, anon;
revoke all on function public.update_draft_quote(uuid, uuid, uuid, date, text, text, jsonb, timestamptz) from public, anon;
revoke all on function public.issue_quote(uuid) from public, anon;
revoke all on function public.set_quote_outcome(uuid, text) from public, anon;
revoke insert, update, delete on public.quotes from authenticated;
revoke insert, update, delete on public.quote_items from authenticated;
revoke execute on function public.set_quote_status(uuid, text) from authenticated;
grant execute on function public.create_quote(uuid, uuid, uuid, date, text, text, jsonb) to authenticated;
grant execute on function public.get_quote_defaults(uuid) to authenticated;
grant execute on function public.update_draft_quote(uuid, uuid, uuid, date, text, text, jsonb, timestamptz) to authenticated;
grant execute on function public.issue_quote(uuid) to authenticated;
grant execute on function public.set_quote_outcome(uuid, text) to authenticated;

comment on function public.create_quote(uuid, uuid, uuid, date, text, text, jsonb) is 'Creates a draft quote and line items atomically; totals are trigger-calculated.';
comment on function public.update_draft_quote(uuid, uuid, uuid, date, text, text, jsonb, timestamptz) is 'Replaces a draft quote and its lines atomically with optimistic concurrency protection.';
comment on function public.issue_quote(uuid) is 'Issues and locks a quote, records activity, and advances an eligible linked enquiry to quoted.';
comment on function public.set_quote_outcome(uuid, text) is 'Records an accepted or rejected outcome for a sent quote.';
