-- Reject invalid, nonexistent, and ambiguous organization-local job times.
-- Existing scheduled timestamps are not rewritten.

create or replace function private.parse_job_schedule(p_organization_id uuid, p_local_datetime text)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_timezone text;
  v_local timestamp;
  v_instant timestamptz;
begin
  if nullif(btrim(p_local_datetime), '') is null then return null; end if;

  select settings.timezone into v_timezone
  from public.business_settings as settings
  where settings.organization_id = p_organization_id;

  if v_timezone is null or not exists (
    select 1 from pg_catalog.pg_timezone_names where name = v_timezone
  ) then
    raise exception 'Organization timezone is not configured' using errcode = '23514';
  end if;

  if btrim(p_local_datetime) !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}$' then
    raise exception 'Invalid scheduled start' using errcode = '22007';
  end if;

  begin
    v_local := p_local_datetime::timestamp;
  exception
    when invalid_datetime_format or datetime_field_overflow then
      raise exception 'Invalid scheduled start' using errcode = '22007';
  end;
  v_instant := v_local at time zone v_timezone;

  if (v_instant at time zone v_timezone) is distinct from v_local then
    raise exception 'Scheduled start does not exist in the organization timezone' using errcode = '22007';
  end if;

  if ((v_instant - interval '1 hour') at time zone v_timezone) = v_local
     or ((v_instant + interval '1 hour') at time zone v_timezone) = v_local then
    raise exception 'Scheduled start is ambiguous in the organization timezone' using errcode = '22007';
  end if;

  return v_instant;
end;
$$;

revoke all on function private.parse_job_schedule(uuid, text) from public, anon, authenticated;

comment on function private.parse_job_schedule(uuid, text) is
  'Converts a validated organization-local job time to a UTC instant and rejects DST gaps and overlaps.';
