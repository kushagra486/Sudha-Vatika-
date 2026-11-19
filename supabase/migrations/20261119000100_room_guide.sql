-- Room guide: guests scan the QR in their room and ask for reception, housekeeping, food,
-- luggage help and so on, or leave a review. Guests never sign in: the public Edge Function
-- `room-guest` writes these rows (service role). Staff read and handle them in the dashboard.

create table public.room_requests (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  room_number text not null check (length(trim(room_number)) between 1 and 20),
  guest_name text not null check (length(trim(guest_name)) between 1 and 80),
  kind text not null check (kind in
    ('reception','housekeeping','food','luggage','maintenance','transport','helpdesk','other')),
  item text check (length(item) <= 200),        -- what they picked, e.g. "Towels, Drinking water"
  details text check (length(details) <= 500),  -- anything they typed
  status text not null default 'new' check (status in ('new','in_progress','done','cancelled')),
  handled_by uuid,
  handled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, org_id),
  foreign key (handled_by, org_id) references public.profiles(id, org_id)
);
create index room_requests_org_status_idx on public.room_requests(org_id, status, created_at desc);
create index room_requests_room_idx on public.room_requests(org_id, lower(room_number), created_at desc);

create table public.room_reviews (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  room_number text not null check (length(trim(room_number)) between 1 and 20),
  guest_name text not null check (length(trim(guest_name)) between 1 and 80),
  rating int not null check (rating between 1 and 5),
  ratings jsonb not null default '{}'::jsonb,   -- optional: cleanliness, staff, comfort (1 to 5)
  comment text check (length(comment) <= 1000),
  created_at timestamptz not null default now(),
  unique (id, org_id)
);
create index room_reviews_org_idx on public.room_reviews(org_id, created_at desc);

-- What guests see on the guide that the venue controls (one row per organization).
create table public.room_guide_settings (
  org_id uuid primary key references public.organizations(id) on delete cascade,
  wifi_name text check (length(wifi_name) <= 60),
  wifi_password text check (length(wifi_password) <= 80),
  checkout_time text check (length(checkout_time) <= 30),
  note text check (length(note) <= 500),
  updated_at timestamptz not null default now()
);

create trigger room_requests_touch_updated_at
  before update on public.room_requests
  for each row execute function app.touch_updated_at();
create trigger room_guide_settings_touch_updated_at
  before update on public.room_guide_settings
  for each row execute function app.touch_updated_at();

-- Who picked a request up, and when.
create or replace function app.stamp_room_request()
returns trigger
language plpgsql
as $$
begin
  if new.status is distinct from old.status then
    new.handled_by := auth.uid();
    new.handled_at := now();
  end if;
  return new;
end;
$$;
create trigger room_requests_stamp
  before update on public.room_requests
  for each row execute function app.stamp_room_request();

revoke all on public.room_requests, public.room_reviews, public.room_guide_settings from anon;
grant select, update, delete on public.room_requests to authenticated;
grant select, delete on public.room_reviews to authenticated;
grant select, insert, update on public.room_guide_settings to authenticated;

alter table public.room_requests enable row level security;
alter table public.room_reviews enable row level security;
alter table public.room_guide_settings enable row level security;

create policy room_requests_select on public.room_requests for select to authenticated
  using (org_id = (select app.current_org_id()));
create policy room_requests_update on public.room_requests for update to authenticated
  using (org_id = (select app.current_org_id()) and (select app.has_role('owner','manager','ops','sales')))
  with check (org_id = (select app.current_org_id()));
create policy room_requests_delete on public.room_requests for delete to authenticated
  using (org_id = (select app.current_org_id()) and (select app.is_manager()));

create policy room_reviews_select on public.room_reviews for select to authenticated
  using (org_id = (select app.current_org_id()));
create policy room_reviews_delete on public.room_reviews for delete to authenticated
  using (org_id = (select app.current_org_id()) and (select app.is_manager()));

-- The WiFi password is only for owners, managers and ops.
create policy room_guide_settings_select on public.room_guide_settings for select to authenticated
  using (org_id = (select app.current_org_id()) and (select app.has_role('owner','manager','ops')));
create policy room_guide_settings_insert on public.room_guide_settings for insert to authenticated
  with check (org_id = (select app.current_org_id()) and (select app.is_manager()));
create policy room_guide_settings_update on public.room_guide_settings for update to authenticated
  using (org_id = (select app.current_org_id()) and (select app.is_manager()))
  with check (org_id = (select app.current_org_id()));

alter table public.room_guide_settings alter column org_id set default app.current_org_id();

create trigger room_guide_settings_audit after insert or update or delete on public.room_guide_settings
  for each row execute function app.write_audit_log();
