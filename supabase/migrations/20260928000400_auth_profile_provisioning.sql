-- Provision the non-sensitive application profile when Supabase Auth creates a user.
-- User metadata supplies display names only and is never used for authorization.

create or replace function private.handle_new_auth_user_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_first_name text;
  v_last_name text;
begin
  v_first_name := coalesce(
    nullif(btrim(new.raw_user_meta_data ->> 'first_name'), ''),
    'KiwiOps'
  );
  v_last_name := coalesce(
    nullif(btrim(new.raw_user_meta_data ->> 'last_name'), ''),
    'User'
  );

  insert into public.profiles (id, first_name, last_name)
  values (new.id, v_first_name, v_last_name)
  on conflict (id) do nothing;

  return new;
end;
$$;

revoke all on function private.handle_new_auth_user_profile() from public, anon, authenticated;

create trigger on_auth_user_created_create_profile
  after insert on auth.users
  for each row execute function private.handle_new_auth_user_profile();

-- Safely cover any Auth users created before this trigger was deployed.
insert into public.profiles (id, first_name, last_name)
select
  auth_user.id,
  coalesce(nullif(btrim(auth_user.raw_user_meta_data ->> 'first_name'), ''), 'KiwiOps'),
  coalesce(nullif(btrim(auth_user.raw_user_meta_data ->> 'last_name'), ''), 'User')
from auth.users as auth_user
left join public.profiles as profile on profile.id = auth_user.id
where profile.id is null
on conflict (id) do nothing;

comment on function private.handle_new_auth_user_profile() is
  'Creates a display-only KiwiOps profile for each new Auth user. Authorization remains in organization_members.';
