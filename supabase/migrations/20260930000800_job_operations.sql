-- Milestone 7: controlled office-side job operations.
-- Existing job tables, lifecycle triggers, forced RLS, and technician start/complete RPCs remain intact.

create unique index jobs_one_per_quote_idx
  on public.jobs(organization_id, quote_id)
  where quote_id is not null;

create or replace function private.parse_job_schedule(p_organization_id uuid, p_local_datetime text)
returns timestamptz language plpgsql security definer set search_path = ''
as $$
declare v_timezone text;
begin
  if nullif(btrim(p_local_datetime), '') is null then return null; end if;
  select timezone into v_timezone from public.business_settings where organization_id = p_organization_id;
  if v_timezone is null then raise exception 'Organization timezone is not configured' using errcode = '23514'; end if;
  return p_local_datetime::timestamp at time zone v_timezone;
exception when invalid_datetime_format or invalid_parameter_value then
  raise exception 'Invalid scheduled start or organization timezone' using errcode = '22007';
end;
$$;
revoke all on function private.parse_job_schedule(uuid,text) from public;

create or replace function public.create_job(
  p_organization_id uuid,
  p_customer_id uuid,
  p_quote_id uuid default null,
  p_job_type text default null,
  p_description text default null,
  p_priority text default 'medium',
  p_scheduled_start_local text default null,
  p_estimated_duration_minutes integer default null,
  p_address_line_1 text default null,
  p_address_line_2 text default null,
  p_suburb text default null,
  p_city text default null,
  p_postcode text default null,
  p_assignee_member_ids uuid[] default '{}'
) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_customer public.customers%rowtype;
  v_quote public.quotes%rowtype;
  v_job_id uuid;
  v_actor uuid;
  v_member_id uuid;
begin
  if not private.has_org_role(p_organization_id, array['owner', 'admin']) then
    raise exception 'Job access denied' using errcode = '42501';
  end if;
  v_actor := private.require_current_membership(p_organization_id);
  select * into v_customer from public.customers
    where organization_id = p_organization_id and id = p_customer_id and status = 'active';
  if not found then raise exception 'An active customer is required' using errcode = '23514'; end if;

  if p_quote_id is not null then
    select * into v_quote from public.quotes
      where organization_id = p_organization_id and id = p_quote_id for update;
    if not found or v_quote.customer_id <> p_customer_id or v_quote.status <> 'accepted' then
      raise exception 'An accepted quote for this customer is required' using errcode = '23514';
    end if;
    if exists (select 1 from public.jobs where organization_id = p_organization_id and quote_id = p_quote_id) then
      raise exception 'This quote already has a job' using errcode = '23505';
    end if;
  end if;

  if nullif(btrim(p_job_type), '') is null or nullif(btrim(p_description), '') is null then
    raise exception 'Job type and description are required' using errcode = '23514';
  end if;
  if p_priority not in ('low', 'medium', 'high', 'urgent') then
    raise exception 'Invalid priority' using errcode = '23514';
  end if;
  if p_estimated_duration_minutes is not null and p_estimated_duration_minutes <= 0 then
    raise exception 'Estimated duration must be positive' using errcode = '23514';
  end if;
  if nullif(btrim(p_address_line_1), '') is null or nullif(btrim(p_city), '') is null then
    raise exception 'Service address and city are required' using errcode = '23514';
  end if;

  if exists (
    select 1 from unnest(coalesce(p_assignee_member_ids, '{}'::uuid[])) member_id
    left join public.organization_members m on m.id = member_id
      and m.organization_id = p_organization_id and m.status = 'active' and m.role = 'technician'
    where m.id is null
  ) then raise exception 'Every assignee must be an active technician in this organization' using errcode = '23514'; end if;

  insert into public.jobs (organization_id, customer_id, quote_id, job_type, description, priority,
    scheduled_start_at, estimated_duration_minutes, address_line_1, address_line_2, suburb, city, postcode)
  values (p_organization_id, p_customer_id, p_quote_id, btrim(p_job_type), btrim(p_description), p_priority,
    private.parse_job_schedule(p_organization_id, p_scheduled_start_local), p_estimated_duration_minutes, btrim(p_address_line_1), nullif(btrim(p_address_line_2), ''),
    nullif(btrim(p_suburb), ''), btrim(p_city), nullif(btrim(p_postcode), '')) returning id into v_job_id;

  for v_member_id in select distinct unnest(coalesce(p_assignee_member_ids, '{}'::uuid[])) loop
    insert into public.job_assignments (organization_id, job_id, member_id, assigned_by_member_id)
    values (p_organization_id, v_job_id, v_member_id, v_actor);
  end loop;
  perform private.log_activity(p_organization_id, v_actor, 'member', 'job', v_job_id,
    'job.created', 'Job created', jsonb_build_object('customer_id', p_customer_id, 'quote_id', p_quote_id));
  if cardinality(coalesce(p_assignee_member_ids, '{}'::uuid[])) > 0 then
    perform private.log_activity(p_organization_id, v_actor, 'member', 'job', v_job_id,
      'job.assigned', 'Technicians assigned', jsonb_build_object('member_ids', p_assignee_member_ids));
  end if;
  return v_job_id;
end;
$$;

create or replace function public.update_job(
  p_job_id uuid,
  p_expected_updated_at timestamptz,
  p_job_type text,
  p_description text,
  p_priority text,
  p_scheduled_start_local text,
  p_estimated_duration_minutes integer,
  p_address_line_1 text,
  p_address_line_2 text,
  p_suburb text,
  p_city text,
  p_postcode text,
  p_assignee_member_ids uuid[] default '{}'
) returns void
language plpgsql security definer set search_path = ''
as $$
declare v_job public.jobs%rowtype; v_actor uuid; v_member_id uuid; v_status text;
begin
  select * into v_job from public.jobs where id = p_job_id for update;
  if not found then raise exception 'Job not found' using errcode = 'P0002'; end if;
  if not private.has_org_role(v_job.organization_id, array['owner', 'admin']) then raise exception 'Job access denied' using errcode = '42501'; end if;
  if v_job.status not in ('unscheduled', 'scheduled') then raise exception 'Only unscheduled or scheduled jobs can be edited' using errcode = '23514'; end if;
  if v_job.updated_at <> p_expected_updated_at then raise exception 'This job was changed by another user' using errcode = '40001'; end if;
  if nullif(btrim(p_job_type), '') is null or nullif(btrim(p_description), '') is null
    or nullif(btrim(p_address_line_1), '') is null or nullif(btrim(p_city), '') is null
    or p_priority not in ('low', 'medium', 'high', 'urgent')
    or (p_estimated_duration_minutes is not null and p_estimated_duration_minutes <= 0)
  then raise exception 'Invalid job details' using errcode = '23514'; end if;
  if exists (
    select 1 from unnest(coalesce(p_assignee_member_ids, '{}'::uuid[])) member_id
    left join public.organization_members m on m.id = member_id
      and m.organization_id = v_job.organization_id and m.status = 'active' and m.role = 'technician'
    where m.id is null
  ) then raise exception 'Every assignee must be an active technician in this organization' using errcode = '23514'; end if;
  v_actor := private.require_current_membership(v_job.organization_id);
  v_status := case when nullif(btrim(p_scheduled_start_local), '') is null then 'unscheduled' else 'scheduled' end;
  update public.jobs set job_type=btrim(p_job_type), description=btrim(p_description), priority=p_priority,
    status=v_status, scheduled_start_at=private.parse_job_schedule(v_job.organization_id, p_scheduled_start_local), estimated_duration_minutes=p_estimated_duration_minutes,
    address_line_1=btrim(p_address_line_1), address_line_2=nullif(btrim(p_address_line_2), ''),
    suburb=nullif(btrim(p_suburb), ''), city=btrim(p_city), postcode=nullif(btrim(p_postcode), '') where id=p_job_id;
  update public.job_assignments set unassigned_at=now(), unassigned_by_member_id=v_actor
    where job_id=p_job_id and unassigned_at is null and not (member_id = any(coalesce(p_assignee_member_ids, '{}'::uuid[])));
  for v_member_id in select distinct unnest(coalesce(p_assignee_member_ids, '{}'::uuid[])) loop
    if not exists (select 1 from public.job_assignments where job_id=p_job_id and member_id=v_member_id and unassigned_at is null) then
      insert into public.job_assignments (organization_id,job_id,member_id,assigned_by_member_id)
      values (v_job.organization_id,p_job_id,v_member_id,v_actor);
    end if;
  end loop;
  perform private.log_activity(v_job.organization_id,v_actor,'member','job',p_job_id,'job.updated','Job details updated',
    jsonb_build_object('scheduled_start_local',p_scheduled_start_local,'member_ids',p_assignee_member_ids));
end;
$$;

create or replace function public.cancel_job(p_job_id uuid) returns void
language plpgsql security definer set search_path = ''
as $$
declare v_job public.jobs%rowtype; v_actor uuid;
begin
  select * into v_job from public.jobs where id=p_job_id for update;
  if not found then raise exception 'Job not found' using errcode='P0002'; end if;
  if not private.has_org_role(v_job.organization_id,array['owner','admin']) then raise exception 'Job access denied' using errcode='42501'; end if;
  if v_job.status not in ('unscheduled','scheduled','in_progress') then raise exception 'This job cannot be cancelled' using errcode='23514'; end if;
  v_actor := private.require_current_membership(v_job.organization_id);
  update public.jobs set status='cancelled' where id=p_job_id;
  perform private.log_activity(v_job.organization_id,v_actor,'member','job',p_job_id,'job.cancelled','Job cancelled','{}'::jsonb);
end;
$$;

revoke all on function public.create_job(uuid,uuid,uuid,text,text,text,text,integer,text,text,text,text,text,uuid[]) from public, anon;
revoke all on function public.update_job(uuid,timestamptz,text,text,text,text,integer,text,text,text,text,text,uuid[]) from public, anon;
revoke all on function public.cancel_job(uuid) from public, anon;
grant execute on function public.create_job(uuid,uuid,uuid,text,text,text,text,integer,text,text,text,text,text,uuid[]) to authenticated;
grant execute on function public.update_job(uuid,timestamptz,text,text,text,text,integer,text,text,text,text,text,uuid[]) to authenticated;
grant execute on function public.cancel_job(uuid) to authenticated;

revoke insert, update, delete on public.jobs from authenticated;
revoke insert, update, delete on public.job_assignments from authenticated;

comment on function public.create_job(uuid,uuid,uuid,text,text,text,text,integer,text,text,text,text,text,uuid[]) is
  'Creates a direct job or converts one accepted quote, snapshots the service address, and validates technician assignments.';
comment on function public.update_job(uuid,timestamptz,text,text,text,text,integer,text,text,text,text,text,uuid[]) is
  'Updates editable job details and assignment history with optimistic concurrency protection.';
