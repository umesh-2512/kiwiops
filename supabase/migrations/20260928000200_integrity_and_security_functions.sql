-- Authorization helpers, lifecycle guards, financial calculations, and narrow RPCs.

create or replace function private.is_active_member(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_members as member
    where member.organization_id = p_organization_id
      and member.user_id = auth.uid()
      and member.status = 'active'
  );
$$;

create or replace function private.current_membership_id(p_organization_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select member.id
  from public.organization_members as member
  where member.organization_id = p_organization_id
    and member.user_id = auth.uid()
    and member.status = 'active'
  limit 1;
$$;

create or replace function private.current_org_role(p_organization_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select member.role
  from public.organization_members as member
  where member.organization_id = p_organization_id
    and member.user_id = auth.uid()
    and member.status = 'active'
  limit 1;
$$;

create or replace function private.has_org_role(p_organization_id uuid, p_allowed_roles text[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(private.current_org_role(p_organization_id) = any(p_allowed_roles), false);
$$;

create or replace function private.is_assigned_to_job(p_job_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.job_assignments as assignment
    join public.organization_members as member
      on member.organization_id = assignment.organization_id
     and member.id = assignment.member_id
    where assignment.job_id = p_job_id
      and assignment.unassigned_at is null
      and member.user_id = auth.uid()
      and member.status = 'active'
  );
$$;

revoke all on function private.is_active_member(uuid) from public;
revoke all on function private.current_membership_id(uuid) from public;
revoke all on function private.current_org_role(uuid) from public;
revoke all on function private.has_org_role(uuid, text[]) from public;
revoke all on function private.is_assigned_to_job(uuid) from public;

create or replace function private.require_current_membership(p_organization_id uuid)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_membership_id uuid;
begin
  v_membership_id := private.current_membership_id(p_organization_id);
  if v_membership_id is null then
    raise exception 'Active organization membership required' using errcode = '42501';
  end if;
  return v_membership_id;
end;
$$;

revoke all on function private.require_current_membership(uuid) from public;

create or replace function private.allocate_document_number_internal(
  p_organization_id uuid,
  p_document_type text,
  p_calendar_year integer
)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_number bigint;
  v_prefix text;
begin
  if p_document_type not in ('quote', 'job', 'invoice') then
    raise exception 'Unsupported document type' using errcode = '22023';
  end if;

  if p_calendar_year not between 2000 and 9999 then
    raise exception 'Invalid document year' using errcode = '22023';
  end if;

  if not exists (select 1 from public.organizations where id = p_organization_id) then
    raise exception 'Organization not found' using errcode = '23503';
  end if;

  insert into public.document_sequences (
    organization_id,
    document_type,
    calendar_year,
    next_value
  ) values (
    p_organization_id,
    p_document_type,
    p_calendar_year,
    2
  )
  on conflict (organization_id, document_type, calendar_year)
  do update set next_value = public.document_sequences.next_value + 1
  returning next_value - 1 into v_number;

  v_prefix := case p_document_type
    when 'quote' then 'Q'
    when 'job' then 'JOB'
    when 'invoice' then 'INV'
  end;

  return format('%s-%s-%s', v_prefix, p_calendar_year, lpad(v_number::text, 4, '0'));
end;
$$;

revoke all on function private.allocate_document_number_internal(uuid, text, integer) from public;

create or replace function private.organization_local_year(p_organization_id uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select extract(
    year from timezone(coalesce(settings.timezone, 'Pacific/Auckland'), now())
  )::integer
  from public.organizations as organization
  left join public.business_settings as settings
    on settings.organization_id = organization.id
  where organization.id = p_organization_id;
$$;

revoke all on function private.organization_local_year(uuid) from public;

create or replace function private.assign_quote_system_fields()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.quote_number := private.allocate_document_number_internal(
    new.organization_id,
    'quote',
    private.organization_local_year(new.organization_id)
  );
  new.created_by_member_id := private.require_current_membership(new.organization_id);
  new.subtotal_cents := 0;
  new.tax_cents := 0;
  new.total_cents := 0;
  new.sent_at := null;
  new.accepted_at := null;
  new.rejected_at := null;
  new.status := 'draft';
  return new;
end;
$$;

create or replace function private.assign_job_system_fields()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.job_number := private.allocate_document_number_internal(
    new.organization_id,
    'job',
    private.organization_local_year(new.organization_id)
  );
  new.created_by_member_id := private.require_current_membership(new.organization_id);
  new.started_at := null;
  new.completed_at := null;
  new.cancelled_at := null;
  new.completed_by_member_id := null;
  new.status := case when new.scheduled_start_at is null then 'unscheduled' else 'scheduled' end;
  return new;
end;
$$;

create or replace function private.assign_invoice_system_fields()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.invoice_number := private.allocate_document_number_internal(
    new.organization_id,
    'invoice',
    private.organization_local_year(new.organization_id)
  );
  new.created_by_member_id := private.require_current_membership(new.organization_id);
  new.subtotal_cents := 0;
  new.tax_cents := 0;
  new.total_cents := 0;
  new.sent_at := null;
  new.paid_at := null;
  new.cancelled_at := null;
  new.status := 'draft';
  return new;
end;
$$;

revoke all on function private.assign_quote_system_fields() from public;
revoke all on function private.assign_job_system_fields() from public;
revoke all on function private.assign_invoice_system_fields() from public;

create trigger quotes_assign_system_fields
  before insert on public.quotes
  for each row execute function private.assign_quote_system_fields();
create trigger jobs_assign_system_fields
  before insert on public.jobs
  for each row execute function private.assign_job_system_fields();
create trigger invoices_assign_system_fields
  before insert on public.invoices
  for each row execute function private.assign_invoice_system_fields();

create or replace function private.calculate_line_amounts()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.line_subtotal_cents := round(new.quantity * new.unit_price_cents)::bigint;
  new.tax_cents := round(new.line_subtotal_cents * new.tax_rate / 100)::bigint;
  new.line_total_cents := new.line_subtotal_cents + new.tax_cents;
  return new;
end;
$$;

create or replace function private.guard_quote_item_changes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_organization_id uuid;
  v_quote_id uuid;
  v_status text;
begin
  v_organization_id := case when tg_op = 'DELETE' then old.organization_id else new.organization_id end;
  v_quote_id := case when tg_op = 'DELETE' then old.quote_id else new.quote_id end;

  if tg_op = 'UPDATE' and (
    new.organization_id is distinct from old.organization_id
    or new.quote_id is distinct from old.quote_id
  ) then
    raise exception 'Quote items cannot be moved between quotes or organizations' using errcode = '42501';
  end if;

  select status into v_status
  from public.quotes
  where organization_id = v_organization_id and id = v_quote_id;

  if v_status is distinct from 'draft' then
    raise exception 'Only draft quote items may be changed' using errcode = '42501';
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create or replace function private.recalculate_quote_totals()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_organization_id uuid;
  v_quote_id uuid;
begin
  v_organization_id := case when tg_op = 'DELETE' then old.organization_id else new.organization_id end;
  v_quote_id := case when tg_op = 'DELETE' then old.quote_id else new.quote_id end;

  update public.quotes as quote
  set subtotal_cents = totals.subtotal_cents,
      tax_cents = totals.tax_cents,
      total_cents = totals.subtotal_cents + totals.tax_cents
  from (
    select
      coalesce(sum(item.line_subtotal_cents), 0)::bigint as subtotal_cents,
      coalesce(sum(item.tax_cents), 0)::bigint as tax_cents
    from public.quote_items as item
    where item.organization_id = v_organization_id and item.quote_id = v_quote_id
  ) as totals
  where quote.organization_id = v_organization_id and quote.id = v_quote_id;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create or replace function private.guard_invoice_item_changes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_organization_id uuid;
  v_invoice_id uuid;
  v_status text;
begin
  v_organization_id := case when tg_op = 'DELETE' then old.organization_id else new.organization_id end;
  v_invoice_id := case when tg_op = 'DELETE' then old.invoice_id else new.invoice_id end;

  if tg_op = 'UPDATE' and (
    new.organization_id is distinct from old.organization_id
    or new.invoice_id is distinct from old.invoice_id
  ) then
    raise exception 'Invoice items cannot be moved between invoices or organizations' using errcode = '42501';
  end if;

  select status into v_status
  from public.invoices
  where organization_id = v_organization_id and id = v_invoice_id;

  if v_status is distinct from 'draft' then
    raise exception 'Only draft invoice items may be changed' using errcode = '42501';
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create or replace function private.recalculate_invoice_totals()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_organization_id uuid;
  v_invoice_id uuid;
begin
  v_organization_id := case when tg_op = 'DELETE' then old.organization_id else new.organization_id end;
  v_invoice_id := case when tg_op = 'DELETE' then old.invoice_id else new.invoice_id end;

  update public.invoices as invoice
  set subtotal_cents = totals.subtotal_cents,
      tax_cents = totals.tax_cents,
      total_cents = totals.subtotal_cents + totals.tax_cents
  from (
    select
      coalesce(sum(item.line_subtotal_cents), 0)::bigint as subtotal_cents,
      coalesce(sum(item.tax_cents), 0)::bigint as tax_cents
    from public.invoice_items as item
    where item.organization_id = v_organization_id and item.invoice_id = v_invoice_id
  ) as totals
  where invoice.organization_id = v_organization_id and invoice.id = v_invoice_id;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

revoke all on function private.calculate_line_amounts() from public;
revoke all on function private.guard_quote_item_changes() from public;
revoke all on function private.recalculate_quote_totals() from public;
revoke all on function private.guard_invoice_item_changes() from public;
revoke all on function private.recalculate_invoice_totals() from public;

create trigger quote_items_10_guard
  before insert or update or delete on public.quote_items
  for each row execute function private.guard_quote_item_changes();
create trigger quote_items_20_calculate
  before insert or update on public.quote_items
  for each row execute function private.calculate_line_amounts();
create trigger quote_items_30_recalculate
  after insert or update or delete on public.quote_items
  for each row execute function private.recalculate_quote_totals();

create trigger invoice_items_10_guard
  before insert or update or delete on public.invoice_items
  for each row execute function private.guard_invoice_item_changes();
create trigger invoice_items_20_calculate
  before insert or update on public.invoice_items
  for each row execute function private.calculate_line_amounts();
create trigger invoice_items_30_recalculate
  after insert or update or delete on public.invoice_items
  for each row execute function private.recalculate_invoice_totals();

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

create or replace function private.guard_invoice_lifecycle()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.organization_id is distinct from old.organization_id
     or new.invoice_number is distinct from old.invoice_number
     or new.created_by_member_id is distinct from old.created_by_member_id then
    raise exception 'Invoice ownership and system fields are immutable' using errcode = '42501';
  end if;

  if old.status <> 'draft' and (
    new.customer_id is distinct from old.customer_id
    or new.job_id is distinct from old.job_id
    or new.issue_date is distinct from old.issue_date
    or new.due_date is distinct from old.due_date
    or new.currency is distinct from old.currency
    or new.notes is distinct from old.notes
    or new.payment_instructions is distinct from old.payment_instructions
    or new.subtotal_cents is distinct from old.subtotal_cents
    or new.tax_cents is distinct from old.tax_cents
    or new.total_cents is distinct from old.total_cents
  ) then
    raise exception 'Issued invoice content is immutable' using errcode = '42501';
  end if;

  if new.status is distinct from old.status then
    if not (
      (old.status = 'draft' and new.status in ('sent', 'cancelled'))
      or (old.status = 'sent' and new.status in ('paid', 'cancelled'))
      or (old.status = 'paid' and new.status = 'sent')
    ) then
      raise exception 'Invalid invoice status transition' using errcode = '23514';
    end if;

    if new.status = 'sent' and old.status = 'draft' then new.sent_at := now(); end if;
    if new.status = 'paid' then new.paid_at := now(); end if;
    if new.status = 'sent' and old.status = 'paid' then new.paid_at := null; end if;
    if new.status = 'cancelled' then new.cancelled_at := now(); end if;
  end if;

  return new;
end;
$$;

create or replace function private.guard_job_lifecycle()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.organization_id is distinct from old.organization_id
     or new.job_number is distinct from old.job_number
     or new.created_by_member_id is distinct from old.created_by_member_id then
    raise exception 'Job ownership and system fields are immutable' using errcode = '42501';
  end if;

  if new.status is distinct from old.status then
    if not (
      (old.status = 'unscheduled' and new.status in ('scheduled', 'cancelled'))
      or (old.status = 'scheduled' and new.status in ('unscheduled', 'in_progress', 'cancelled'))
      or (old.status = 'in_progress' and new.status in ('completed', 'cancelled'))
    ) then
      raise exception 'Invalid job status transition' using errcode = '23514';
    end if;

    if new.status = 'in_progress' then new.started_at := now(); end if;
    if new.status = 'completed' then
      new.completed_at := now();
      new.completed_by_member_id := private.require_current_membership(new.organization_id);
    end if;
    if new.status = 'cancelled' then new.cancelled_at := now(); end if;
  end if;

  return new;
end;
$$;

revoke all on function private.guard_quote_lifecycle() from public;
revoke all on function private.guard_invoice_lifecycle() from public;
revoke all on function private.guard_job_lifecycle() from public;

create trigger quotes_guard_lifecycle before update on public.quotes
  for each row execute function private.guard_quote_lifecycle();
create trigger invoices_guard_lifecycle before update on public.invoices
  for each row execute function private.guard_invoice_lifecycle();
create trigger jobs_guard_lifecycle before update on public.jobs
  for each row execute function private.guard_job_lifecycle();

create or replace function private.sync_simple_lifecycle_fields()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member_id uuid;
begin
  if tg_table_name = 'organizations' then
    if new.status = 'closed' and old.status is distinct from 'closed' then new.archived_at := now(); end if;
    if new.status <> 'closed' then new.archived_at := null; end if;
  elsif tg_table_name = 'customers' then
    if new.status = 'archived' and old.status is distinct from 'archived' then new.archived_at := now(); end if;
    if new.status = 'active' then new.archived_at := null; end if;
  elsif tg_table_name = 'enquiries' then
    if new.status = 'closed' and old.status is distinct from 'closed' then new.closed_at := now(); end if;
    if new.status <> 'closed' then new.closed_at := null; end if;
  elsif tg_table_name = 'service_reminders' then
    if tg_op = 'INSERT' then
      new.created_by_member_id := private.require_current_membership(new.organization_id);
      if new.status = 'completed' then new.completed_at := now(); end if;
    elsif new.status = 'completed' and old.status is distinct from 'completed' then
      new.completed_at := now();
    end if;
    if new.status <> 'completed' then new.completed_at := null; end if;
  elsif tg_table_name = 'business_settings' then
    v_member_id := private.require_current_membership(new.organization_id);
    new.updated_by_member_id := v_member_id;
  end if;
  return new;
end;
$$;

revoke all on function private.sync_simple_lifecycle_fields() from public;

create trigger organizations_sync_lifecycle before update on public.organizations
  for each row execute function private.sync_simple_lifecycle_fields();
create trigger customers_sync_lifecycle before update on public.customers
  for each row execute function private.sync_simple_lifecycle_fields();
create trigger enquiries_sync_lifecycle before update on public.enquiries
  for each row execute function private.sync_simple_lifecycle_fields();
create trigger service_reminders_sync_lifecycle before insert or update on public.service_reminders
  for each row execute function private.sync_simple_lifecycle_fields();
create trigger business_settings_sync_updater before update on public.business_settings
  for each row execute function private.sync_simple_lifecycle_fields();

create or replace function private.guard_assignment_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid;
begin
  v_actor := private.require_current_membership(new.organization_id);

  if not exists (
    select 1 from public.organization_members as member
    where member.organization_id = new.organization_id
      and member.id = new.member_id
      and member.status = 'active'
  ) then
    raise exception 'Assignment target must be an active organization member' using errcode = '23514';
  end if;

  if tg_op = 'INSERT' then
    new.assigned_by_member_id := v_actor;
    new.unassigned_at := null;
    new.unassigned_by_member_id := null;
  else
    if new.organization_id is distinct from old.organization_id
       or new.job_id is distinct from old.job_id
       or new.member_id is distinct from old.member_id
       or new.assigned_by_member_id is distinct from old.assigned_by_member_id then
      raise exception 'Assignment ownership and identity fields are immutable' using errcode = '42501';
    end if;
    if old.unassigned_at is not null then
      raise exception 'Assignment history is immutable after unassignment' using errcode = '42501';
    end if;
    if new.unassigned_at is not null then
      new.unassigned_at := now();
      new.unassigned_by_member_id := v_actor;
    end if;
  end if;
  return new;
end;
$$;

create or replace function private.set_job_note_author()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.author_member_id := private.require_current_membership(new.organization_id);
  return new;
end;
$$;

revoke all on function private.guard_assignment_write() from public;
revoke all on function private.set_job_note_author() from public;

create trigger job_assignments_guard_write before insert or update on public.job_assignments
  for each row execute function private.guard_assignment_write();
create trigger job_notes_set_author before insert on public.job_notes
  for each row execute function private.set_job_note_author();

create or replace function private.log_activity(
  p_organization_id uuid,
  p_actor_member_id uuid,
  p_actor_type text,
  p_entity_type text,
  p_entity_id uuid,
  p_action text,
  p_summary text,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.activity_logs (
    organization_id,
    actor_member_id,
    actor_type,
    entity_type,
    entity_id,
    action,
    summary,
    metadata
  ) values (
    p_organization_id,
    p_actor_member_id,
    p_actor_type,
    p_entity_type,
    p_entity_id,
    p_action,
    p_summary,
    coalesce(p_metadata, '{}'::jsonb)
  );
$$;

revoke all on function private.log_activity(uuid, uuid, text, text, uuid, text, text, jsonb) from public;

create or replace function public.create_organization(
  p_display_name text,
  p_member_display_name text,
  p_legal_name text default null,
  p_slug text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_organization_id uuid;
  v_member_id uuid;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if nullif(btrim(p_display_name), '') is null or nullif(btrim(p_member_display_name), '') is null then
    raise exception 'Organization and member names are required' using errcode = '22023';
  end if;

  insert into public.organizations (display_name, legal_name, slug, created_by_user_id)
  values (btrim(p_display_name), nullif(btrim(p_legal_name), ''), nullif(btrim(p_slug), ''), v_user_id)
  returning id into v_organization_id;

  insert into public.organization_members (
    organization_id, user_id, role, status, display_name, joined_at
  ) values (
    v_organization_id, v_user_id, 'owner', 'active', btrim(p_member_display_name), now()
  ) returning id into v_member_id;

  insert into public.business_settings (
    organization_id, business_display_name, updated_by_member_id
  ) values (
    v_organization_id, btrim(p_display_name), v_member_id
  );

  perform private.log_activity(
    v_organization_id, v_member_id, 'member', 'organization', v_organization_id,
    'organization.created', 'Organization created', '{}'::jsonb
  );

  return v_organization_id;
end;
$$;

create or replace function public.add_organization_member(
  p_organization_id uuid,
  p_user_id uuid,
  p_display_name text,
  p_role text default 'technician'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid;
  v_member_id uuid;
begin
  if not private.has_org_role(p_organization_id, array['owner']) then
    raise exception 'Owner role required' using errcode = '42501';
  end if;
  if p_role not in ('owner', 'admin', 'technician') then
    raise exception 'Invalid organization role' using errcode = '22023';
  end if;
  if nullif(btrim(p_display_name), '') is null then
    raise exception 'Display name is required' using errcode = '22023';
  end if;

  v_actor := private.require_current_membership(p_organization_id);
  insert into public.organization_members (
    organization_id, user_id, role, status, display_name, joined_at
  ) values (
    p_organization_id, p_user_id, p_role, 'active', btrim(p_display_name), now()
  ) returning id into v_member_id;

  perform private.log_activity(
    p_organization_id, v_actor, 'member', 'member', v_member_id,
    'member.added', 'Organization member added', jsonb_build_object('role', p_role)
  );
  return v_member_id;
end;
$$;

create or replace function public.set_member_role(p_member_id uuid, p_role text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member public.organization_members%rowtype;
  v_actor uuid;
  v_owner_count integer;
begin
  select * into v_member from public.organization_members where id = p_member_id for update;
  if not found then raise exception 'Membership not found' using errcode = 'P0002'; end if;
  if not private.has_org_role(v_member.organization_id, array['owner']) then
    raise exception 'Owner role required' using errcode = '42501';
  end if;
  if v_member.user_id = auth.uid() then
    raise exception 'Members cannot change their own role' using errcode = '42501';
  end if;
  if p_role not in ('owner', 'admin', 'technician') then
    raise exception 'Invalid organization role' using errcode = '22023';
  end if;

  -- Serialize owner-count checks so two concurrent calls cannot remove the
  -- final owners in separate transactions.
  perform organization.id
  from public.organizations as organization
  where organization.id = v_member.organization_id
  for update;

  if v_member.role = 'owner' and p_role <> 'owner' and v_member.status = 'active' then
    select count(*) into v_owner_count
    from public.organization_members
    where organization_id = v_member.organization_id and role = 'owner' and status = 'active';
    if v_owner_count <= 1 then
      raise exception 'Cannot demote the final active owner' using errcode = '23514';
    end if;
  end if;

  v_actor := private.require_current_membership(v_member.organization_id);
  update public.organization_members set role = p_role where id = p_member_id;
  perform private.log_activity(
    v_member.organization_id, v_actor, 'member', 'member', p_member_id,
    'member.role_changed', 'Organization member role changed',
    jsonb_build_object('from', v_member.role, 'to', p_role)
  );
end;
$$;

create or replace function public.set_member_status(p_member_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member public.organization_members%rowtype;
  v_actor uuid;
  v_owner_count integer;
begin
  select * into v_member from public.organization_members where id = p_member_id for update;
  if not found then raise exception 'Membership not found' using errcode = 'P0002'; end if;
  if not private.has_org_role(v_member.organization_id, array['owner']) then
    raise exception 'Owner role required' using errcode = '42501';
  end if;
  if p_status not in ('active', 'suspended', 'removed') then
    raise exception 'Invalid membership status' using errcode = '22023';
  end if;

  perform organization.id
  from public.organizations as organization
  where organization.id = v_member.organization_id
  for update;
  if v_member.role = 'owner' and v_member.status = 'active' and p_status <> 'active' then
    select count(*) into v_owner_count
    from public.organization_members
    where organization_id = v_member.organization_id and role = 'owner' and status = 'active';
    if v_owner_count <= 1 then
      raise exception 'Cannot deactivate the final active owner' using errcode = '23514';
    end if;
  end if;

  v_actor := private.require_current_membership(v_member.organization_id);
  update public.organization_members
  set status = p_status,
      joined_at = case when p_status = 'active' then coalesce(joined_at, now()) else joined_at end,
      removed_at = case when p_status = 'removed' then now() else null end
  where id = p_member_id;

  perform private.log_activity(
    v_member.organization_id, v_actor, 'member', 'member', p_member_id,
    'member.status_changed', 'Organization member status changed',
    jsonb_build_object('from', v_member.status, 'to', p_status)
  );
end;
$$;

create or replace function public.get_assigned_job_contact(p_job_id uuid)
returns table (
  customer_id uuid,
  first_name text,
  last_name text,
  email text,
  phone text,
  address_line_1 text,
  address_line_2 text,
  suburb text,
  city text,
  postcode text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_organization_id uuid;
begin
  select job.organization_id into v_organization_id
  from public.jobs as job where job.id = p_job_id;

  if v_organization_id is null then return; end if;
  if not (
    private.has_org_role(v_organization_id, array['owner', 'admin'])
    or private.is_assigned_to_job(p_job_id)
  ) then
    raise exception 'Job access denied' using errcode = '42501';
  end if;

  return query
  select
    customer.id,
    customer.first_name,
    customer.last_name,
    customer.email,
    customer.phone,
    job.address_line_1,
    job.address_line_2,
    job.suburb,
    job.city,
    job.postcode
  from public.jobs as job
  join public.customers as customer
    on customer.organization_id = job.organization_id and customer.id = job.customer_id
  where job.id = p_job_id;
end;
$$;

create or replace function public.start_job(p_job_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job public.jobs%rowtype;
  v_actor uuid;
begin
  select * into v_job from public.jobs where id = p_job_id for update;
  if not found then raise exception 'Job not found' using errcode = 'P0002'; end if;
  if not (
    private.has_org_role(v_job.organization_id, array['owner', 'admin'])
    or private.is_assigned_to_job(p_job_id)
  ) then
    raise exception 'Job access denied' using errcode = '42501';
  end if;
  if v_job.status <> 'scheduled' then
    raise exception 'Only scheduled jobs can be started' using errcode = '23514';
  end if;
  v_actor := private.require_current_membership(v_job.organization_id);
  update public.jobs set status = 'in_progress' where id = p_job_id;
  perform private.log_activity(
    v_job.organization_id, v_actor, 'member', 'job', p_job_id,
    'job.started', 'Job started', '{}'::jsonb
  );
end;
$$;

create or replace function public.complete_job(p_job_id uuid, p_completion_notes text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job public.jobs%rowtype;
  v_actor uuid;
begin
  select * into v_job from public.jobs where id = p_job_id for update;
  if not found then raise exception 'Job not found' using errcode = 'P0002'; end if;
  if not (
    private.has_org_role(v_job.organization_id, array['owner', 'admin'])
    or private.is_assigned_to_job(p_job_id)
  ) then
    raise exception 'Job access denied' using errcode = '42501';
  end if;
  if v_job.status <> 'in_progress' then
    raise exception 'Only in-progress jobs can be completed' using errcode = '23514';
  end if;
  v_actor := private.require_current_membership(v_job.organization_id);
  update public.jobs
  set status = 'completed', completion_notes = nullif(btrim(p_completion_notes), '')
  where id = p_job_id;
  perform private.log_activity(
    v_job.organization_id, v_actor, 'member', 'job', p_job_id,
    'job.completed', 'Job completed', '{}'::jsonb
  );
end;
$$;

create or replace function public.set_quote_status(p_quote_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_quote public.quotes%rowtype;
  v_actor uuid;
begin
  select * into v_quote from public.quotes where id = p_quote_id for update;
  if not found then raise exception 'Quote not found' using errcode = 'P0002'; end if;
  if not private.has_org_role(v_quote.organization_id, array['owner', 'admin']) then
    raise exception 'Operational role required' using errcode = '42501';
  end if;
  if p_status not in ('sent', 'accepted', 'rejected') then
    raise exception 'Unsupported quote status' using errcode = '22023';
  end if;
  if p_status = 'sent' and not exists (select 1 from public.quote_items where quote_id = p_quote_id) then
    raise exception 'Quote must contain at least one item' using errcode = '23514';
  end if;
  v_actor := private.require_current_membership(v_quote.organization_id);
  update public.quotes set status = p_status where id = p_quote_id;
  perform private.log_activity(
    v_quote.organization_id, v_actor, 'member', 'quote', p_quote_id,
    'quote.status_changed', 'Quote status changed', jsonb_build_object('to', p_status)
  );
end;
$$;

create or replace function public.set_invoice_status(p_invoice_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invoice public.invoices%rowtype;
  v_actor uuid;
begin
  select * into v_invoice from public.invoices where id = p_invoice_id for update;
  if not found then raise exception 'Invoice not found' using errcode = 'P0002'; end if;
  if not private.has_org_role(v_invoice.organization_id, array['owner', 'admin']) then
    raise exception 'Operational role required' using errcode = '42501';
  end if;
  if p_status not in ('sent', 'cancelled') then
    raise exception 'Unsupported invoice status' using errcode = '22023';
  end if;
  if p_status = 'sent' and not exists (select 1 from public.invoice_items where invoice_id = p_invoice_id) then
    raise exception 'Invoice must contain at least one item' using errcode = '23514';
  end if;
  v_actor := private.require_current_membership(v_invoice.organization_id);
  update public.invoices set status = p_status where id = p_invoice_id;
  perform private.log_activity(
    v_invoice.organization_id, v_actor, 'member', 'invoice', p_invoice_id,
    'invoice.status_changed', 'Invoice status changed', jsonb_build_object('to', p_status)
  );
end;
$$;

create or replace function public.record_payment(
  p_invoice_id uuid,
  p_amount_cents bigint,
  p_paid_on date,
  p_method text,
  p_reference text default null,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invoice public.invoices%rowtype;
  v_actor uuid;
  v_paid_cents bigint;
  v_payment_id uuid;
begin
  select * into v_invoice from public.invoices where id = p_invoice_id for update;
  if not found then raise exception 'Invoice not found' using errcode = 'P0002'; end if;
  if not private.has_org_role(v_invoice.organization_id, array['owner', 'admin']) then
    raise exception 'Operational role required' using errcode = '42501';
  end if;
  if v_invoice.status <> 'sent' then
    raise exception 'Payments can only be recorded against sent invoices' using errcode = '23514';
  end if;
  if p_amount_cents <= 0 then raise exception 'Payment amount must be positive' using errcode = '22023'; end if;
  if p_method not in ('bank_transfer', 'cash', 'card', 'cheque', 'other') then
    raise exception 'Unsupported payment method' using errcode = '22023';
  end if;

  select coalesce(sum(amount_cents), 0)::bigint into v_paid_cents
  from public.payments where invoice_id = p_invoice_id and voided_at is null;
  if v_paid_cents + p_amount_cents > v_invoice.total_cents then
    raise exception 'Payment exceeds the invoice balance' using errcode = '23514';
  end if;

  v_actor := private.require_current_membership(v_invoice.organization_id);
  insert into public.payments (
    organization_id, invoice_id, amount_cents, currency, paid_on, method,
    reference, notes, recorded_by_member_id
  ) values (
    v_invoice.organization_id, p_invoice_id, p_amount_cents, v_invoice.currency,
    p_paid_on, p_method, nullif(btrim(p_reference), ''), nullif(btrim(p_notes), ''), v_actor
  ) returning id into v_payment_id;

  if v_paid_cents + p_amount_cents = v_invoice.total_cents then
    update public.invoices set status = 'paid' where id = p_invoice_id;
  end if;

  perform private.log_activity(
    v_invoice.organization_id, v_actor, 'member', 'payment', v_payment_id,
    'payment.recorded', 'Payment recorded', jsonb_build_object('invoice_id', p_invoice_id)
  );
  return v_payment_id;
end;
$$;

create or replace function public.void_payment(p_payment_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payment public.payments%rowtype;
  v_invoice public.invoices%rowtype;
  v_actor uuid;
begin
  select * into v_payment from public.payments where id = p_payment_id for update;
  if not found then raise exception 'Payment not found' using errcode = 'P0002'; end if;
  if v_payment.voided_at is not null then raise exception 'Payment is already voided' using errcode = '23514'; end if;
  if not private.has_org_role(v_payment.organization_id, array['owner', 'admin']) then
    raise exception 'Operational role required' using errcode = '42501';
  end if;
  select * into v_invoice from public.invoices where id = v_payment.invoice_id for update;
  v_actor := private.require_current_membership(v_payment.organization_id);

  update public.payments
  set voided_at = now(), voided_by_member_id = v_actor
  where id = p_payment_id;
  if v_invoice.status = 'paid' then
    update public.invoices set status = 'sent' where id = v_invoice.id;
  end if;
  perform private.log_activity(
    v_payment.organization_id, v_actor, 'member', 'payment', p_payment_id,
    'payment.voided', 'Payment voided', jsonb_build_object('invoice_id', v_payment.invoice_id)
  );
end;
$$;

-- No function in this file accepts a caller-provided actor or trusts caller-provided ownership.
revoke all on function public.create_organization(text, text, text, text) from public, anon;
revoke all on function public.add_organization_member(uuid, uuid, text, text) from public, anon;
revoke all on function public.set_member_role(uuid, text) from public, anon;
revoke all on function public.set_member_status(uuid, text) from public, anon;
revoke all on function public.get_assigned_job_contact(uuid) from public, anon;
revoke all on function public.start_job(uuid) from public, anon;
revoke all on function public.complete_job(uuid, text) from public, anon;
revoke all on function public.set_quote_status(uuid, text) from public, anon;
revoke all on function public.set_invoice_status(uuid, text) from public, anon;
revoke all on function public.record_payment(uuid, bigint, date, text, text, text) from public, anon;
revoke all on function public.void_payment(uuid) from public, anon;

grant execute on function public.create_organization(text, text, text, text) to authenticated;
grant execute on function public.add_organization_member(uuid, uuid, text, text) to authenticated;
grant execute on function public.set_member_role(uuid, text) to authenticated;
grant execute on function public.set_member_status(uuid, text) to authenticated;
grant execute on function public.get_assigned_job_contact(uuid) to authenticated;
grant execute on function public.start_job(uuid) to authenticated;
grant execute on function public.complete_job(uuid, text) to authenticated;
grant execute on function public.set_quote_status(uuid, text) to authenticated;
grant execute on function public.set_invoice_status(uuid, text) to authenticated;
grant execute on function public.record_payment(uuid, bigint, date, text, text, text) to authenticated;
grant execute on function public.void_payment(uuid) to authenticated;

comment on function public.get_assigned_job_contact(uuid) is
  'Returns only customer contact and snapshotted service address after checking job assignment or office role.';
comment on function public.record_payment(uuid, bigint, date, text, text, text) is
  'Records a payment and updates invoice state atomically; caller identity comes from auth.uid().';
