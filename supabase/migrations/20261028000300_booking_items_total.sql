-- Itemised quotes: once a booking has line items, its subtotal is their sum.
-- GST follows: a booking that was charged GST is re-taxed at the org rate on
-- the new amount; a booking without GST stays without it. The discount is
-- capped at the new subtotal so removing items never breaks the
-- discount <= subtotal rule.

alter table public.booking_items
  add constraint booking_items_discount_le_amount check (line_discount <= quantity * unit_price);

create index if not exists booking_items_booking_idx on public.booking_items(booking_id);

create or replace function app.sync_booking_subtotal()
returns trigger
language plpgsql
security definer   -- item writes are already gated by booking_items RLS
set search_path = ''
as $$
declare
  v_booking uuid := coalesce(new.booking_id, old.booking_id);
  v_sub numeric(12,2);
  v_rate numeric;
begin
  select coalesce(sum(quantity * unit_price - line_discount), 0)
    into v_sub
    from public.booking_items
   where booking_id = v_booking;

  select o.tax_percent into v_rate
    from public.bookings b join public.organizations o on o.id = b.org_id
   where b.id = v_booking;

  update public.bookings b
     set subtotal = v_sub,
         discount = least(b.discount, v_sub),
         tax = case when b.tax > 0
                    then round((v_sub - least(b.discount, v_sub)) * coalesce(v_rate, 0) / 100, 2)
                    else 0 end
   where b.id = v_booking;
  return null;
end;
$$;

create trigger booking_items_sync_subtotal
  after insert or update or delete on public.booking_items
  for each row execute function app.sync_booking_subtotal();
