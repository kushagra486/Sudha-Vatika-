-- Minimum advance before a booking can be confirmed. Sudha Vatika takes at
-- least ₹21,000 on every booking; the amount is an org setting.
-- GST is optional per booking: bookings.tax is entered per booking (0 when the
-- customer is billed without GST) and organizations.tax_percent is the default
-- rate the UI offers.

alter table public.organizations
  add column min_advance numeric(12,2) not null default 0 check (min_advance >= 0);

-- Net amount received on a booking (refunds subtract).
create or replace function app.booking_paid(p_booking uuid)
returns numeric
language sql
stable
security definer   -- must count payments the caller's RLS hides (sales can't read payments)
set search_path = ''
as $$
  select coalesce(sum(case when kind = 'refund' then -amount else amount end), 0)
    from public.payments
   where booking_id = p_booking
$$;

create or replace function app.check_booking_advance()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_min numeric;
  v_total numeric;
  v_required numeric;
  v_paid numeric;
begin
  if new.status <> 'confirmed' or (tg_op = 'UPDATE' and old.status = 'confirmed') then
    return new;
  end if;

  select min_advance into v_min from public.organizations where id = new.org_id;
  -- Generated columns are computed after BEFORE triggers, so new.total is not
  -- current here; derive it the same way.
  v_total := new.subtotal - new.discount + new.tax;
  -- A booking worth less than the minimum needs its full total instead.
  v_required := case when v_total > 0 then least(v_min, v_total) else v_min end;
  v_paid := case when tg_op = 'INSERT' then 0 else app.booking_paid(new.id) end;

  if v_paid < v_required then
    raise exception 'Advance of % required to confirm; % received', v_required, v_paid
      using errcode = 'P0001', hint = 'advance_required';
  end if;
  return new;
end;
$$;

create trigger bookings_check_advance
  before insert or update of status on public.bookings
  for each row execute function app.check_booking_advance();
