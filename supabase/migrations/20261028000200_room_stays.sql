-- Overnight stays in hotel rooms and dormitory rooms. Event spaces are booked
-- per shift (bookings); rooms are booked per night against units.quantity.

create table public.room_stays (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  unit_id uuid not null,
  guest_id uuid not null,
  booking_id uuid,                       -- the event this stay is for, if any
  check_in date not null,
  check_out date not null,
  rooms int not null default 1 check (rooms > 0),
  guest_count int check (guest_count >= 0),
  rate numeric(12,2) not null default 0 check (rate >= 0),   -- per room per night
  nights int generated always as (check_out - check_in) stored,
  amount numeric(12,2) generated always as ((check_out - check_in) * rooms * rate) stored,
  status text not null default 'reserved'
    check (status in ('reserved','checked_in','checked_out','cancelled')),
  notes text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, org_id),
  check (check_out > check_in),
  foreign key (unit_id, org_id) references public.units(id, org_id),
  foreign key (guest_id, org_id) references public.guests(id, org_id),
  foreign key (booking_id, org_id) references public.bookings(id, org_id) on delete set null (booking_id),
  foreign key (created_by, org_id) references public.profiles(id, org_id)
);
create index room_stays_unit_dates_idx on public.room_stays(unit_id, check_in, check_out);
create index room_stays_org_idx on public.room_stays(org_id, check_in);
create index room_stays_guest_idx on public.room_stays(guest_id);
create index room_stays_booking_idx on public.room_stays(booking_id);

create trigger room_stays_touch_updated_at
  before update on public.room_stays
  for each row execute function app.touch_updated_at();

-- Only rooms and dorms take stays, and no night may exceed the rooms on hand.
create or replace function app.check_room_capacity()
returns trigger
language plpgsql
security definer   -- must count every stay, not only those the caller can see
set search_path = ''
as $$
declare
  v_unit record;
  v_night date;
  v_used int;
begin
  if new.status not in ('reserved','checked_in') then
    return new;
  end if;

  -- Lock the unit so two concurrent stays can't both take the last room.
  select kind, quantity, name into v_unit
    from public.units where id = new.unit_id for update;
  if v_unit.kind not in ('room','dormitory') then
    raise exception '% is not a room or dormitory', v_unit.name
      using errcode = 'P0001', hint = 'not_a_room';
  end if;

  for v_night in select generate_series(new.check_in, new.check_out - 1, interval '1 day')::date loop
    select coalesce(sum(s.rooms), 0) into v_used
      from public.room_stays s
     where s.unit_id = new.unit_id
       and s.id <> new.id
       and s.status in ('reserved','checked_in')
       and s.check_in <= v_night and s.check_out > v_night;
    if v_used + new.rooms > v_unit.quantity then
      raise exception 'Only % of % % free on %', greatest(v_unit.quantity - v_used, 0), v_unit.quantity, v_unit.name, v_night
        using errcode = 'P0001', hint = 'rooms_full';
    end if;
  end loop;
  return new;
end;
$$;

create trigger room_stays_check_capacity
  before insert or update of unit_id, check_in, check_out, rooms, status on public.room_stays
  for each row execute function app.check_room_capacity();

revoke all on public.room_stays from anon;
grant select, insert, update, delete on public.room_stays to authenticated;
alter table public.room_stays enable row level security;

create policy room_stays_select on public.room_stays for select to authenticated
  using (org_id = (select app.current_org_id()));
create policy room_stays_insert on public.room_stays for insert to authenticated
  with check (org_id = (select app.current_org_id()) and (select app.has_role('owner','manager','ops','sales')));
create policy room_stays_update on public.room_stays for update to authenticated
  using (org_id = (select app.current_org_id()) and (select app.has_role('owner','manager','ops','sales')))
  with check (org_id = (select app.current_org_id()));
create policy room_stays_delete on public.room_stays for delete to authenticated
  using (org_id = (select app.current_org_id()) and (select app.is_manager()));

alter table public.room_stays alter column org_id set default app.current_org_id();

create trigger room_stays_audit after insert or update or delete on public.room_stays
  for each row execute function app.write_audit_log();

-- One call from the stay form: find or create the guest by phone (or use the
-- booking's guest), then insert the stay. SECURITY INVOKER: caller's RLS applies.
create or replace function public.create_room_stay(
  p_unit_id uuid,
  p_check_in date,
  p_check_out date,
  p_rooms int default 1,
  p_phone_e164 text default null,
  p_full_name text default null,
  p_booking_id uuid default null,
  p_guest_count int default null,
  p_rate numeric default 0,
  p_notes text default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_guest uuid;
  v_stay uuid;
begin
  if p_booking_id is not null and p_phone_e164 is null then
    select guest_id into v_guest from public.bookings where id = p_booking_id;
    if v_guest is null then
      raise exception 'Unknown booking' using errcode = '23503';
    end if;
  elsif p_phone_e164 is not null then
    insert into public.guests (phone_e164, full_name)
    values (p_phone_e164, nullif(trim(p_full_name), ''))
    on conflict (org_id, phone_e164) do update
      set full_name = coalesce(public.guests.full_name, excluded.full_name)
    returning id into v_guest;
  else
    raise exception 'A booking or a phone number is required' using errcode = '22023';
  end if;

  insert into public.room_stays (unit_id, guest_id, booking_id, check_in, check_out, rooms, guest_count, rate, notes)
  values (p_unit_id, v_guest, p_booking_id, p_check_in, p_check_out, coalesce(p_rooms, 1), p_guest_count,
          coalesce(p_rate, 0), nullif(trim(p_notes), ''))
  returning id into v_stay;
  return v_stay;
end;
$$;

revoke execute on function public.create_room_stay(uuid, date, date, int, text, text, uuid, int, numeric, text) from public, anon;
grant execute on function public.create_room_stay(uuid, date, date, int, text, text, uuid, int, numeric, text) to authenticated;
