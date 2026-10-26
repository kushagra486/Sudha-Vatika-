-- Venue inventory: halls, lawns and rooms that can be booked per shift.

create type public.unit_kind as enum ('hall','lawn','room','other');
create type public.shift_code as enum ('full_day','breakfast','lunch','high_tea','dinner');

create table public.units (
  id uuid primary key default gen_random_uuid(),
  -- Not in the brief's sketch; added so units follow the org_id-on-every-table rule.
  org_id uuid not null references public.organizations(id) on delete cascade,
  outlet_id uuid not null,
  name text not null check (length(trim(name)) > 0),
  kind public.unit_kind not null default 'hall',
  floating_capacity int check (floating_capacity >= 0),
  seating_capacity int check (seating_capacity >= 0),
  active boolean not null default true,
  unique (outlet_id, name),
  unique (id, org_id),
  unique (id, outlet_id),
  foreign key (outlet_id, org_id) references public.outlets(id, org_id) on delete cascade
);
create index units_org_idx on public.units(org_id);

-- Maps a shift to the meal slots it occupies, so overlap is a range intersection.
-- full_day covers all four slots; every other shift covers exactly one.
create or replace function app.shift_slots(s public.shift_code)
returns int4range
language sql
immutable
parallel safe
set search_path = ''
as $$
  select case s
    when 'full_day'  then int4range(0, 4)
    when 'breakfast' then int4range(0, 1)
    when 'lunch'     then int4range(1, 2)
    when 'high_tea'  then int4range(2, 3)
    when 'dinner'    then int4range(3, 4)
  end
$$;
