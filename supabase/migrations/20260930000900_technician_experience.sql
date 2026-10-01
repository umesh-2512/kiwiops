-- Milestone 8: narrow organization-timezone access for active members.

create or replace function public.get_my_organization_timezone(p_organization_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_timezone text;
begin
  if not private.is_active_member(p_organization_id) then
    raise exception 'Organization access denied' using errcode = '42501';
  end if;

  select settings.timezone into v_timezone
  from public.business_settings as settings
  where settings.organization_id = p_organization_id;

  if v_timezone is null then
    raise exception 'Organization timezone is not configured' using errcode = '23514';
  end if;

  return v_timezone;
end;
$$;

revoke all on function public.get_my_organization_timezone(uuid) from public, anon;
grant execute on function public.get_my_organization_timezone(uuid) to authenticated;

comment on function public.get_my_organization_timezone(uuid) is
  'Returns the configured IANA timezone only to an active member of the organization.';
