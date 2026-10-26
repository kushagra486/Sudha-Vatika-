-- Bookings, their line items, and payments against them.

create extension if not exists btree_gist;

create type public.booking_status as enum ('tentative','confirmed','cancelled','completed');

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  outlet_id uuid not null,
  unit_id uuid not null,
  lead_id uuid,
  guest_id uuid not null,
  event_type text,
  event_date date not null,
  shift public.shift_code not null,
  -- Meal slots this booking occupies; see app.shift_slots.
  slots int4range generated always as (app.shift_slots(shift)) stored,
  guest_count int check (guest_count >= 0),
  status public.booking_status not null default 'tentative',
  subtotal numeric(12,2) not null default 0 check (subtotal >= 0),
  discount numeric(12,2) not null default 0 check (discount >= 0),
  tax numeric(12,2) not null default 0 check (tax >= 0),
  total numeric(12,2) generated always as (subtotal - discount + tax) stored,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, org_id),
  check (discount <= subtotal),
  foreign key (outlet_id, org_id) references public.outlets(id, org_id),
  -- (unit_id, outlet_id) guarantees the unit belongs to the booking's outlet.
  foreign key (unit_id, outlet_id) references public.units(id, outlet_id),
  foreign key (lead_id, org_id) references public.leads(id, org_id),
  foreign key (guest_id, org_id) references public.guests(id, org_id),
  foreign key (created_by, org_id) references public.profiles(id, org_id),
  -- One live booking per unit per slot. A full_day booking occupies every slot,
  -- so it conflicts with any other shift on that unit and date. This is the
  -- race-safe backstop; the trigger below gives the friendly error first.
  constraint bookings_no_overlap exclude using gist (
    unit_id with =,
    event_date with =,
    slots with &&
  ) where (status in ('tentative','confirmed'))
);
create index bookings_org_date_idx on public.bookings(org_id, event_date);
create index bookings_lead_idx on public.bookings(lead_id);
create index bookings_guest_idx on public.bookings(guest_id);

create or replace function app.check_booking_overlap()
returns trigger
language plpgsql
security definer   -- must see bookings the caller's RLS hides (e.g. other users' tentative holds)
set search_path = ''
as $$
declare
  v_conflict record;
begin
  if new.status not in ('tentative','confirmed') then
    return new;
  end if;

  select b.id, b.shift, b.status
    into v_conflict
    from public.bookings b
   where b.unit_id = new.unit_id
     and b.event_date = new.event_date
     and b.status in ('tentative','confirmed')
     and b.id <> new.id
     and (b.shift = new.shift or b.shift = 'full_day' or new.shift = 'full_day')
   limit 1;

  if found then
    raise exception 'Unit is already booked on % (% %, booking %)',
      new.event_date, v_conflict.status, v_conflict.shift, v_conflict.id
      using errcode = '23P01',
            hint = 'Pick another unit, date or shift, or cancel the existing booking.';
  end if;

  return new;
end;
$$;

create trigger bookings_check_overlap
  before insert or update of unit_id, event_date, shift, status on public.bookings
  for each row execute function app.check_booking_overlap();

create trigger bookings_touch_updated_at
  before update on public.bookings
  for each row execute function app.touch_updated_at();

create table public.booking_items (
  id uuid primary key default gen_random_uuid(),
  -- Not in the brief's sketch; added so RLS is a plain org_id check.
  org_id uuid not null references public.organizations(id) on delete cascade,
  booking_id uuid not null,
  service_id uuid,
  description text not null check (length(trim(description)) > 0),
  quantity int not null default 1 check (quantity > 0),
  unit_price numeric(12,2) not null check (unit_price >= 0),
  line_discount numeric(12,2) not null default 0 check (line_discount >= 0),
  foreign key (booking_id, org_id) references public.bookings(id, org_id) on delete cascade,
  foreign key (service_id, org_id) references public.services(id, org_id)
);
create index booking_items_booking_idx on public.booking_items(booking_id);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  booking_id uuid not null,
  amount numeric(12,2) not null check (amount > 0),
  kind text not null check (kind in ('advance','part','final','refund')),
  method text not null check (method in ('cash','upi','card','bank','gateway','other')),
  reference text,
  received_at timestamptz not null default now(),
  recorded_by uuid,
  foreign key (booking_id, org_id) references public.bookings(id, org_id) on delete cascade,
  foreign key (recorded_by, org_id) references public.profiles(id, org_id)
);
create index payments_booking_idx on public.payments(booking_id);
create index payments_org_received_idx on public.payments(org_id, received_at);

-- Amount collected and outstanding per booking. security_invoker keeps the
-- caller's RLS on bookings and payments in force.
create view public.booking_balances
with (security_invoker = true)
as
select
  b.id as booking_id,
  b.org_id,
  b.total,
  coalesce(sum(case when p.kind = 'refund' then -p.amount else p.amount end), 0)::numeric(12,2) as paid,
  (b.total - coalesce(sum(case when p.kind = 'refund' then -p.amount else p.amount end), 0))::numeric(12,2) as balance
from public.bookings b
left join public.payments p on p.booking_id = b.id
group by b.id;
