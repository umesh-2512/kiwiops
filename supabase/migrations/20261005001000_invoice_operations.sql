-- Milestone 9: controlled invoice and manual-payment operations.

alter table public.invoices
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
  add column tax_rate_snapshot numeric(7,4) check (tax_rate_snapshot between 0 and 100),
  add constraint invoices_issued_snapshot_check check (
    status in ('draft', 'cancelled')
    or (
      nullif(btrim(customer_name_snapshot), '') is not null
      and nullif(btrim(business_name_snapshot), '') is not null
      and business_gst_registered_snapshot is not null
      and tax_rate_snapshot is not null
    )
  );

create or replace function private.guard_invoice_lifecycle()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.organization_id is distinct from old.organization_id
     or new.invoice_number is distinct from old.invoice_number
     or new.created_by_member_id is distinct from old.created_by_member_id then
    raise exception 'Invoice ownership and system fields are immutable' using errcode = '42501';
  end if;

  if old.status <> 'draft' and (
    new.customer_id is distinct from old.customer_id or new.job_id is distinct from old.job_id
    or new.issue_date is distinct from old.issue_date or new.due_date is distinct from old.due_date
    or new.currency is distinct from old.currency or new.notes is distinct from old.notes
    or new.payment_instructions is distinct from old.payment_instructions
    or new.subtotal_cents is distinct from old.subtotal_cents or new.tax_cents is distinct from old.tax_cents
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
  ) then raise exception 'Issued invoice content is immutable' using errcode = '42501'; end if;

  if new.status is distinct from old.status then
    if not (
      (old.status = 'draft' and new.status in ('sent', 'cancelled'))
      or (old.status = 'sent' and new.status in ('paid', 'cancelled'))
      or (old.status = 'paid' and new.status = 'sent')
    ) then raise exception 'Invalid invoice status transition' using errcode = '23514'; end if;
    if new.status = 'sent' and old.status = 'draft' then new.sent_at := now(); end if;
    if new.status = 'paid' then new.paid_at := now(); end if;
    if new.status = 'sent' and old.status = 'paid' then new.paid_at := null; end if;
    if new.status = 'cancelled' then new.cancelled_at := now(); end if;
  end if;
  return new;
end;
$$;

create or replace function private.insert_invoice_items(
  p_organization_id uuid, p_invoice_id uuid, p_items jsonb, p_tax_rate numeric
) returns void language plpgsql security definer set search_path = '' as $$
declare v_item jsonb; v_position integer := 0; v_quantity numeric(12,3); v_price bigint;
begin
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 or jsonb_array_length(p_items) > 100 then
    raise exception 'Invoice requires between 1 and 100 items' using errcode = '22023';
  end if;
  for v_item in select value from jsonb_array_elements(p_items) loop
    if nullif(btrim(v_item->>'description'), '') is null or char_length(v_item->>'description') > 500 then
      raise exception 'Invalid invoice item description' using errcode = '22023';
    end if;
    begin
      v_quantity := (v_item->>'quantity')::numeric(12,3);
      v_price := (v_item->>'unit_price_cents')::bigint;
    exception when others then
      raise exception 'Invalid invoice item amount' using errcode = '22023';
    end;
    if v_quantity <= 0 or v_price < 0 or v_price > 99999999 then
      raise exception 'Invalid invoice item amount' using errcode = '22023';
    end if;
    insert into public.invoice_items (organization_id,invoice_id,description,quantity,unit_price_cents,tax_rate,position)
    values (p_organization_id,p_invoice_id,btrim(v_item->>'description'),v_quantity,v_price,p_tax_rate,v_position);
    v_position := v_position + 1;
  end loop;
end;
$$;
revoke all on function private.insert_invoice_items(uuid,uuid,jsonb,numeric) from public;

create or replace function public.get_invoice_defaults(p_organization_id uuid)
returns table(payment_terms_days integer,currency text,default_gst_rate numeric,gst_registered boolean,organization_today date)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.has_org_role(p_organization_id,array['owner','admin']) then
    raise exception 'Invoice access denied' using errcode='42501';
  end if;
  return query select s.invoice_payment_terms_days,s.currency::text,s.default_gst_rate,s.gst_registered,
    (now() at time zone s.timezone)::date from public.business_settings s where s.organization_id=p_organization_id;
end;
$$;

create or replace function public.create_invoice(
  p_organization_id uuid,p_job_id uuid,p_due_date date,p_notes text,p_payment_instructions text,p_items jsonb
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_job public.jobs%rowtype; v_settings public.business_settings%rowtype; v_actor uuid; v_invoice_id uuid; v_today date;
begin
  if not private.has_org_role(p_organization_id,array['owner','admin']) then raise exception 'Invoice access denied' using errcode='42501'; end if;
  v_actor := private.require_current_membership(p_organization_id);
  select * into v_job from public.jobs where organization_id=p_organization_id and id=p_job_id for update;
  if not found or v_job.status <> 'completed' then raise exception 'A completed job is required' using errcode='23514'; end if;
  if exists(select 1 from public.invoices where organization_id=p_organization_id and job_id=p_job_id) then
    raise exception 'This job already has an invoice' using errcode='23505';
  end if;
  select * into strict v_settings from public.business_settings where organization_id=p_organization_id;
  v_today := (now() at time zone v_settings.timezone)::date;
  if p_due_date < v_today then raise exception 'Due date cannot be before invoice date' using errcode='23514'; end if;
  if char_length(coalesce(p_notes,'')) > 5000 or char_length(coalesce(p_payment_instructions,'')) > 5000 then
    raise exception 'Invoice notes are too long' using errcode='22023';
  end if;
  insert into public.invoices(organization_id,customer_id,job_id,issue_date,due_date,currency,notes,payment_instructions,created_by_member_id)
  values(p_organization_id,v_job.customer_id,v_job.id,v_today,p_due_date,v_settings.currency,nullif(btrim(p_notes),''),nullif(btrim(p_payment_instructions),''),v_actor)
  returning id into v_invoice_id;
  perform private.insert_invoice_items(p_organization_id,v_invoice_id,p_items,case when v_settings.gst_registered then v_settings.default_gst_rate else 0 end);
  perform private.log_activity(p_organization_id,v_actor,'member','invoice',v_invoice_id,'invoice.created','Invoice draft created',jsonb_build_object('job_id',p_job_id));
  return v_invoice_id;
end;
$$;

create or replace function public.update_draft_invoice(
  p_invoice_id uuid,p_expected_updated_at timestamptz,p_due_date date,p_notes text,p_payment_instructions text,p_items jsonb
) returns void language plpgsql security definer set search_path = '' as $$
declare v_invoice public.invoices%rowtype; v_settings public.business_settings%rowtype; v_actor uuid;
begin
  select * into v_invoice from public.invoices where id=p_invoice_id for update;
  if not found then raise exception 'Invoice not found' using errcode='P0002'; end if;
  if not private.has_org_role(v_invoice.organization_id,array['owner','admin']) then raise exception 'Invoice access denied' using errcode='42501'; end if;
  if v_invoice.status <> 'draft' then raise exception 'Only draft invoices may be updated' using errcode='55000'; end if;
  if v_invoice.updated_at is distinct from p_expected_updated_at then raise exception 'Invoice was updated by another user' using errcode='40001'; end if;
  if p_due_date < v_invoice.issue_date then raise exception 'Due date cannot be before invoice date' using errcode='23514'; end if;
  if char_length(coalesce(p_notes,'')) > 5000 or char_length(coalesce(p_payment_instructions,'')) > 5000 then raise exception 'Invoice notes are too long' using errcode='22023'; end if;
  select * into strict v_settings from public.business_settings where organization_id=v_invoice.organization_id;
  v_actor := private.require_current_membership(v_invoice.organization_id);
  update public.invoices set due_date=p_due_date,notes=nullif(btrim(p_notes),''),payment_instructions=nullif(btrim(p_payment_instructions),'') where id=p_invoice_id;
  delete from public.invoice_items where invoice_id=p_invoice_id;
  perform private.insert_invoice_items(v_invoice.organization_id,p_invoice_id,p_items,case when v_settings.gst_registered then v_settings.default_gst_rate else 0 end);
  perform private.log_activity(v_invoice.organization_id,v_actor,'member','invoice',p_invoice_id,'invoice.updated','Invoice draft updated',jsonb_build_object('item_count',jsonb_array_length(p_items)));
end;
$$;

create or replace function public.issue_invoice(p_invoice_id uuid,p_expected_updated_at timestamptz)
returns void language plpgsql security definer set search_path = '' as $$
declare v_invoice public.invoices%rowtype; v_customer public.customers%rowtype; v_settings public.business_settings%rowtype; v_actor uuid;
begin
  select * into v_invoice from public.invoices where id=p_invoice_id for update;
  if not found then raise exception 'Invoice not found' using errcode='P0002'; end if;
  if not private.has_org_role(v_invoice.organization_id,array['owner','admin']) then raise exception 'Invoice access denied' using errcode='42501'; end if;
  if v_invoice.status <> 'draft' then raise exception 'Only a draft invoice may be issued' using errcode='55000'; end if;
  if v_invoice.updated_at is distinct from p_expected_updated_at then raise exception 'Invoice was updated by another user' using errcode='40001'; end if;
  if not exists(select 1 from public.invoice_items where invoice_id=p_invoice_id) or v_invoice.total_cents <= 0 then raise exception 'Invoice requires a positive total' using errcode='23514'; end if;
  select * into strict v_customer from public.customers where organization_id=v_invoice.organization_id and id=v_invoice.customer_id;
  select * into strict v_settings from public.business_settings where organization_id=v_invoice.organization_id;
  v_actor := private.require_current_membership(v_invoice.organization_id);
  update public.invoices set status='sent',
    customer_name_snapshot=btrim(v_customer.first_name||' '||v_customer.last_name),customer_email_snapshot=v_customer.email,customer_phone_snapshot=v_customer.phone,
    billing_address_line_1_snapshot=v_customer.address_line_1,billing_address_line_2_snapshot=v_customer.address_line_2,billing_suburb_snapshot=v_customer.suburb,billing_city_snapshot=v_customer.city,billing_postcode_snapshot=v_customer.postcode,
    business_name_snapshot=v_settings.business_display_name,business_email_snapshot=v_settings.email,business_phone_snapshot=v_settings.phone,
    business_address_line_1_snapshot=v_settings.address_line_1,business_address_line_2_snapshot=v_settings.address_line_2,business_suburb_snapshot=v_settings.suburb,business_city_snapshot=v_settings.city,business_postcode_snapshot=v_settings.postcode,
    business_gst_number_snapshot=v_settings.gst_number,business_gst_registered_snapshot=v_settings.gst_registered,
    tax_rate_snapshot=case when v_settings.gst_registered then v_settings.default_gst_rate else 0 end
  where id=p_invoice_id;
  perform private.log_activity(v_invoice.organization_id,v_actor,'member','invoice',p_invoice_id,'invoice.issued','Invoice issued',jsonb_build_object('total_cents',v_invoice.total_cents));
end;
$$;

create or replace function public.void_invoice(p_invoice_id uuid,p_expected_updated_at timestamptz)
returns void language plpgsql security definer set search_path = '' as $$
declare v_invoice public.invoices%rowtype; v_actor uuid;
begin
  select * into v_invoice from public.invoices where id=p_invoice_id for update;
  if not found then raise exception 'Invoice not found' using errcode='P0002'; end if;
  if not private.has_org_role(v_invoice.organization_id,array['owner','admin']) then raise exception 'Invoice access denied' using errcode='42501'; end if;
  if v_invoice.status not in ('draft','sent') then raise exception 'This invoice cannot be voided' using errcode='23514'; end if;
  if v_invoice.updated_at is distinct from p_expected_updated_at then raise exception 'Invoice was updated by another user' using errcode='40001'; end if;
  if exists(select 1 from public.payments where invoice_id=p_invoice_id and voided_at is null) then raise exception 'Void active payments before voiding the invoice' using errcode='23514'; end if;
  v_actor := private.require_current_membership(v_invoice.organization_id);
  update public.invoices set status='cancelled' where id=p_invoice_id;
  perform private.log_activity(v_invoice.organization_id,v_actor,'member','invoice',p_invoice_id,'invoice.voided','Invoice voided','{}'::jsonb);
end;
$$;

create or replace function public.record_invoice_payment(
  p_invoice_id uuid,p_expected_updated_at timestamptz,p_amount_cents bigint,p_paid_on date,p_method text,p_reference text default null,p_notes text default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_invoice public.invoices%rowtype; v_settings public.business_settings%rowtype; v_actor uuid; v_paid bigint; v_payment_id uuid; v_today date;
begin
  select * into v_invoice from public.invoices where id=p_invoice_id for update;
  if not found then raise exception 'Invoice not found' using errcode='P0002'; end if;
  if not private.has_org_role(v_invoice.organization_id,array['owner','admin']) then raise exception 'Invoice access denied' using errcode='42501'; end if;
  if v_invoice.status <> 'sent' then raise exception 'Payments require an issued invoice' using errcode='23514'; end if;
  if v_invoice.updated_at is distinct from p_expected_updated_at then raise exception 'Invoice was updated by another user' using errcode='40001'; end if;
  if p_amount_cents <= 0 then raise exception 'Payment amount must be positive' using errcode='22023'; end if;
  if p_method not in ('bank_transfer','cash','card','cheque','other') then raise exception 'Unsupported payment method' using errcode='22023'; end if;
  if char_length(coalesce(p_reference,'')) > 200 or char_length(coalesce(p_notes,'')) > 2000 then raise exception 'Payment details are too long' using errcode='22023'; end if;
  select * into strict v_settings from public.business_settings where organization_id=v_invoice.organization_id;
  v_today := (now() at time zone v_settings.timezone)::date;
  if p_paid_on > v_today then raise exception 'Payment date cannot be in the future' using errcode='23514'; end if;
  select coalesce(sum(amount_cents),0)::bigint into v_paid from public.payments where invoice_id=p_invoice_id and voided_at is null;
  if v_paid+p_amount_cents > v_invoice.total_cents then raise exception 'Payment exceeds the invoice balance' using errcode='23514'; end if;
  v_actor := private.require_current_membership(v_invoice.organization_id);
  insert into public.payments(organization_id,invoice_id,amount_cents,currency,paid_on,method,reference,notes,recorded_by_member_id)
  values(v_invoice.organization_id,p_invoice_id,p_amount_cents,v_invoice.currency,p_paid_on,p_method,nullif(btrim(p_reference),''),nullif(btrim(p_notes),''),v_actor)
  returning id into v_payment_id;
  if v_paid+p_amount_cents=v_invoice.total_cents then update public.invoices set status='paid' where id=p_invoice_id;
  else update public.invoices set updated_at=now() where id=p_invoice_id; end if;
  perform private.log_activity(v_invoice.organization_id,v_actor,'member','payment',v_payment_id,'payment.recorded','Payment recorded',jsonb_build_object('invoice_id',p_invoice_id,'amount_cents',p_amount_cents));
  if v_paid+p_amount_cents=v_invoice.total_cents then
    perform private.log_activity(v_invoice.organization_id,v_actor,'member','invoice',p_invoice_id,'invoice.paid','Invoice paid',jsonb_build_object('payment_id',v_payment_id));
  end if;
  return v_payment_id;
end;
$$;

create or replace function public.void_invoice_payment(p_payment_id uuid,p_expected_invoice_updated_at timestamptz)
returns void language plpgsql security definer set search_path = '' as $$
declare v_payment public.payments%rowtype; v_invoice public.invoices%rowtype; v_actor uuid;
begin
  select * into v_payment from public.payments where id=p_payment_id for update;
  if not found then raise exception 'Payment not found' using errcode='P0002'; end if;
  select * into v_invoice from public.invoices where id=v_payment.invoice_id for update;
  if not private.has_org_role(v_payment.organization_id,array['owner','admin']) then raise exception 'Invoice access denied' using errcode='42501'; end if;
  if v_payment.voided_at is not null then raise exception 'Payment is already voided' using errcode='23514'; end if;
  if v_invoice.status='cancelled' then raise exception 'A void invoice cannot be changed' using errcode='23514'; end if;
  if v_invoice.updated_at is distinct from p_expected_invoice_updated_at then raise exception 'Invoice was updated by another user' using errcode='40001'; end if;
  v_actor := private.require_current_membership(v_payment.organization_id);
  update public.payments set voided_at=now(),voided_by_member_id=v_actor where id=p_payment_id;
  if v_invoice.status='paid' then update public.invoices set status='sent' where id=v_invoice.id;
  else update public.invoices set updated_at=now() where id=v_invoice.id; end if;
  perform private.log_activity(v_payment.organization_id,v_actor,'member','payment',p_payment_id,'payment.voided','Payment voided',jsonb_build_object('invoice_id',v_payment.invoice_id));
end;
$$;

revoke all on function public.get_invoice_defaults(uuid) from public,anon;
revoke all on function public.create_invoice(uuid,uuid,date,text,text,jsonb) from public,anon;
revoke all on function public.update_draft_invoice(uuid,timestamptz,date,text,text,jsonb) from public,anon;
revoke all on function public.issue_invoice(uuid,timestamptz) from public,anon;
revoke all on function public.void_invoice(uuid,timestamptz) from public,anon;
revoke all on function public.record_invoice_payment(uuid,timestamptz,bigint,date,text,text,text) from public,anon;
revoke all on function public.void_invoice_payment(uuid,timestamptz) from public,anon;
grant execute on function public.get_invoice_defaults(uuid),public.create_invoice(uuid,uuid,date,text,text,jsonb),
  public.update_draft_invoice(uuid,timestamptz,date,text,text,jsonb),public.issue_invoice(uuid,timestamptz),
  public.void_invoice(uuid,timestamptz),public.record_invoice_payment(uuid,timestamptz,bigint,date,text,text,text),
  public.void_invoice_payment(uuid,timestamptz) to authenticated;

revoke execute on function public.set_invoice_status(uuid,text),public.record_payment(uuid,bigint,date,text,text,text),public.void_payment(uuid) from authenticated;
revoke insert,update,delete on public.invoices,public.invoice_items,public.payments from authenticated;

comment on function public.create_invoice(uuid,uuid,date,text,text,jsonb) is 'Creates one draft invoice for a completed job; totals remain trigger-calculated.';
comment on function public.issue_invoice(uuid,timestamptz) is 'Issues an invoice, captures customer and business snapshots, and locks financial content.';
comment on function public.record_invoice_payment(uuid,timestamptz,bigint,date,text,text,text) is 'Records a serialized manual payment and rejects overpayment.';
