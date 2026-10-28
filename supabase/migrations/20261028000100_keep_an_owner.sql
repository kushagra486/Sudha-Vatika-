-- An organization must always keep at least one active owner, so a mistaken
-- role change or deactivation can never lock everyone out of settings.

create or replace function app.keep_an_owner()
returns trigger
language plpgsql
security definer   -- must count owners the caller's RLS might hide
set search_path = ''
as $$
declare
  v_org uuid := coalesce(old.org_id, new.org_id);
begin
  if not exists (
    select 1 from public.profiles
     where org_id = v_org and role = 'owner' and active
  ) then
    raise exception 'An organization needs at least one active owner'
      using errcode = 'P0001', hint = 'last_owner';
  end if;
  return null;
end;
$$;

-- Deferred to the end of the statement so swapping roles in one update works.
create constraint trigger profiles_keep_an_owner
  after update of role, active or delete on public.profiles
  for each row execute function app.keep_an_owner();
