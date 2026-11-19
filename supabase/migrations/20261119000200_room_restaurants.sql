-- Nearby restaurants shown on the room guide ("order food online"). Food is not served by the venue,
-- so guests call these places or use a delivery app. Owners and managers keep the list up to date in
-- the dashboard (Room desk > Restaurants); the public room-guest function reads the active rows.

create table public.room_restaurants (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 80),
  area text check (length(area) <= 120),
  cuisine text check (length(cuisine) <= 80),
  diet text not null default 'mixed' check (diet in ('veg','nonveg','mixed')),
  phone text check (phone is null or phone ~ '^\+[0-9]{8,15}$'),   -- E.164
  hours text check (length(hours) <= 60),
  menu_url text check (menu_url is null or menu_url ~ '^https://'),
  note text check (length(note) <= 200),
  sort int not null default 100,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, org_id)
);
create index room_restaurants_org_idx on public.room_restaurants(org_id, active, sort, name);

create trigger room_restaurants_touch_updated_at
  before update on public.room_restaurants
  for each row execute function app.touch_updated_at();

revoke all on public.room_restaurants from anon;
grant select, insert, update, delete on public.room_restaurants to authenticated;
alter table public.room_restaurants enable row level security;

create policy room_restaurants_select on public.room_restaurants for select to authenticated
  using (org_id = (select app.current_org_id()));
create policy room_restaurants_insert on public.room_restaurants for insert to authenticated
  with check (org_id = (select app.current_org_id()) and (select app.is_manager()));
create policy room_restaurants_update on public.room_restaurants for update to authenticated
  using (org_id = (select app.current_org_id()) and (select app.is_manager()))
  with check (org_id = (select app.current_org_id()));
create policy room_restaurants_delete on public.room_restaurants for delete to authenticated
  using (org_id = (select app.current_org_id()) and (select app.is_manager()));

alter table public.room_restaurants alter column org_id set default app.current_org_id();

create trigger room_restaurants_audit after insert or update or delete on public.room_restaurants
  for each row execute function app.write_audit_log();
