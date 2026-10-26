-- Space types and fields for a resort-style venue: pandaal, pool, restaurant
-- and dormitory spaces, spaces that are still being built, and room blocks.

alter type public.unit_kind add value if not exists 'pandaal';
alter type public.unit_kind add value if not exists 'pool';
alter type public.unit_kind add value if not exists 'restaurant';
alter type public.unit_kind add value if not exists 'dormitory';

alter table public.units
  -- Being built or not yet open. Shown in lists and quotes, flagged in the UI.
  add column upcoming boolean not null default false,
  -- Identical bookable units this row stands for (hotel rooms, dorm rooms).
  -- Event spaces are always 1. Overnight stays get their own booking model later.
  add column quantity int not null default 1 check (quantity > 0),
  add column description text;
