-- Atomic enquiry operations with active-customer enforcement and activity history.

create or replace function private.validate_enquiry_fields(
  p_source text, p_description text, p_category text, p_priority text, p_status text
)
returns void language plpgsql immutable security definer set search_path = '' as $$
begin
  if p_source not in ('phone', 'email', 'website', 'walk_in', 'referral', 'other') then
    raise exception 'Invalid enquiry source' using errcode = '22023';
  end if;
  if nullif(btrim(p_description), '') is null or char_length(btrim(p_description)) > 5000 then
    raise exception 'Invalid enquiry description' using errcode = '22023';
  end if;
  if char_length(coalesce(btrim(p_category), '')) > 100 then
    raise exception 'Invalid enquiry category' using errcode = '22023';
  end if;
  if p_priority not in ('low', 'medium', 'high', 'urgent') then
    raise exception 'Invalid enquiry priority' using errcode = '22023';
  end if;
  if p_status not in ('new', 'reviewing', 'quoted', 'converted', 'closed') then
    raise exception 'Invalid enquiry status' using errcode = '22023';
  end if;
end;
$$;

revoke all on function private.validate_enquiry_fields(text, text, text, text, text) from public, anon, authenticated;

create or replace function public.create_enquiry(
  p_organization_id uuid,
  p_customer_id uuid,
  p_source text,
  p_description text,
  p_category text,
  p_priority text
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid;
  v_enquiry_id uuid;
begin
  if not private.has_org_role(p_organization_id, array['owner', 'admin']) then
    raise exception 'Operational role required' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.customers
    where id = p_customer_id and organization_id = p_organization_id and status = 'active'
  ) then
    raise exception 'Active customer not found' using errcode = 'P0002';
  end if;
  perform private.validate_enquiry_fields(p_source, p_description, p_category, p_priority, 'new');
  v_actor := private.require_current_membership(p_organization_id);

  insert into public.enquiries (organization_id, customer_id, source, description, category, priority)
  values (p_organization_id, p_customer_id, p_source, btrim(p_description), nullif(btrim(p_category), ''), p_priority)
  returning id into v_enquiry_id;

  perform private.log_activity(
    p_organization_id, v_actor, 'member', 'enquiry', v_enquiry_id,
    'enquiry.created', 'Enquiry created', jsonb_build_object('priority', p_priority)
  );
  return v_enquiry_id;
end;
$$;

create or replace function public.update_enquiry(
  p_enquiry_id uuid,
  p_customer_id uuid,
  p_source text,
  p_description text,
  p_category text,
  p_priority text,
  p_status text
)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_enquiry public.enquiries%rowtype;
  v_actor uuid;
  v_details_changed boolean;
begin
  select * into v_enquiry from public.enquiries where id = p_enquiry_id for update;
  if not found then raise exception 'Enquiry not found' using errcode = 'P0002'; end if;
  if not private.has_org_role(v_enquiry.organization_id, array['owner', 'admin']) then
    raise exception 'Operational role required' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.customers
    where id = p_customer_id and organization_id = v_enquiry.organization_id and status = 'active'
  ) then
    raise exception 'Active customer not found' using errcode = 'P0002';
  end if;
  perform private.validate_enquiry_fields(p_source, p_description, p_category, p_priority, p_status);
  v_actor := private.require_current_membership(v_enquiry.organization_id);
  v_details_changed := v_enquiry.customer_id is distinct from p_customer_id
    or v_enquiry.source is distinct from p_source
    or v_enquiry.description is distinct from btrim(p_description)
    or v_enquiry.category is distinct from nullif(btrim(p_category), '');

  update public.enquiries set customer_id = p_customer_id, source = p_source,
    description = btrim(p_description), category = nullif(btrim(p_category), ''),
    priority = p_priority, status = p_status
  where id = p_enquiry_id;

  if v_details_changed then
    perform private.log_activity(v_enquiry.organization_id, v_actor, 'member', 'enquiry', p_enquiry_id,
      'enquiry.updated', 'Enquiry details updated', '{}'::jsonb);
  end if;
  if v_enquiry.priority is distinct from p_priority then
    perform private.log_activity(v_enquiry.organization_id, v_actor, 'member', 'enquiry', p_enquiry_id,
      'enquiry.priority_changed', 'Priority changed from ' || initcap(v_enquiry.priority) || ' to ' || initcap(p_priority),
      jsonb_build_object('from', v_enquiry.priority, 'to', p_priority));
  end if;
  if v_enquiry.status is distinct from p_status then
    perform private.log_activity(v_enquiry.organization_id, v_actor, 'member', 'enquiry', p_enquiry_id,
      'enquiry.status_changed', 'Status changed from ' || initcap(v_enquiry.status) || ' to ' || initcap(p_status),
      jsonb_build_object('from', v_enquiry.status, 'to', p_status));
  end if;
end;
$$;

revoke all on function public.create_enquiry(uuid, uuid, text, text, text, text) from public, anon;
revoke all on function public.update_enquiry(uuid, uuid, text, text, text, text, text) from public, anon;
revoke insert, update, delete on public.enquiries from authenticated;
grant execute on function public.create_enquiry(uuid, uuid, text, text, text, text) to authenticated;
grant execute on function public.update_enquiry(uuid, uuid, text, text, text, text, text) to authenticated;

comment on function public.create_enquiry(uuid, uuid, text, text, text, text) is
  'Creates an enquiry for an active same-organization customer and records activity atomically.';
comment on function public.update_enquiry(uuid, uuid, text, text, text, text, text) is
  'Updates an enquiry after office-role and active-customer checks and records meaningful changes.';
