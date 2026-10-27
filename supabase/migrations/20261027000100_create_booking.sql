-- Booking capture and lead follow-through.
--
-- create_booking: one call from the booking form. Uses the lead's guest when a
-- lead is given, otherwise finds or creates the guest by phone, then inserts a
-- tentative booking. SECURITY INVOKER, so the caller's RLS applies to every
-- write; overlap and advance rules fire as usual.
--
-- Confirming a booking moves its lead to "booked" and clears the follow-up.
-- That trigger is SECURITY DEFINER because ops staff confirm bookings but
-- cannot edit leads.

create or replace function public.create_booking(
  p_unit_id uuid,
  p_event_date date,
  p_shift public.shift_code,
  p_phone_e164 text default null,
  p_full_name text default null,
  p_lead_id uuid default null,
  p_event_type text default null,
  p_guest_count int default null,
  p_subtotal numeric default 0,
  p_discount numeric default 0,
  p_tax numeric default 0
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_guest uuid;
  v_outlet uuid;
  v_booking uuid;
begin
  select outlet_id into v_outlet from public.units where id = p_unit_id;
  if v_outlet is null then
    raise exception 'Unknown space' using errcode = '23503';
  end if;

  if p_lead_id is not null then
    select guest_id into v_guest from public.leads where id = p_lead_id;
    if v_guest is null then
      raise exception 'Unknown lead' using errcode = '23503';
    end if;
  elsif p_phone_e164 is not null then
    insert into public.guests (phone_e164, full_name)
    values (p_phone_e164, nullif(trim(p_full_name), ''))
    on conflict (org_id, phone_e164) do update
      set full_name = coalesce(public.guests.full_name, excluded.full_name)
    returning id into v_guest;
  else
    raise exception 'A lead or a phone number is required' using errcode = '22023';
  end if;

  insert into public.bookings (
    outlet_id, unit_id, lead_id, guest_id, event_type, event_date, shift,
    guest_count, subtotal, discount, tax
  )
  values (
    v_outlet, p_unit_id, p_lead_id, v_guest, nullif(trim(p_event_type), ''), p_event_date, p_shift,
    p_guest_count, coalesce(p_subtotal, 0), coalesce(p_discount, 0), coalesce(p_tax, 0)
  )
  returning id into v_booking;

  return v_booking;
end;
$$;

revoke execute on function public.create_booking(uuid, date, public.shift_code, text, text, uuid, text, int, numeric, numeric, numeric) from public, anon;
grant execute on function public.create_booking(uuid, date, public.shift_code, text, text, uuid, text, int, numeric, numeric, numeric) to authenticated;

create or replace function app.mark_lead_booked()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.lead_id is not null and new.status = 'confirmed'
     and (tg_op = 'INSERT' or old.status is distinct from 'confirmed') then
    update public.leads
       set stage = 'booked', next_follow_up_at = null, lost_reason = null
     where id = new.lead_id and stage <> 'booked';
  end if;
  return new;
end;
$$;

create trigger bookings_mark_lead_booked
  after insert or update of status on public.bookings
  for each row execute function app.mark_lead_booked();
