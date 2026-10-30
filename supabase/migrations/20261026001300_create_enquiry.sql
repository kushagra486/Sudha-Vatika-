-- One-call enquiry capture for the quick-add form. Finds the guest by phone
-- (or creates them), opens a lead, and stores the first call note, all in one
-- transaction so a dropped connection never leaves half an enquiry.
-- SECURITY INVOKER: the caller's RLS applies to every write.

create or replace function public.create_enquiry(
  p_phone_e164 text,
  p_full_name text default null,
  p_source public.lead_source default 'call',
  p_event_type text default null,
  p_event_date date default null,
  p_guest_count int default null,
  p_preferred_unit_id uuid default null,
  p_next_follow_up_at timestamptz default null,
  p_note text default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_guest uuid;
  v_lead uuid;
begin
  insert into public.guests (phone_e164, full_name)
  values (p_phone_e164, nullif(trim(p_full_name), ''))
  on conflict (org_id, phone_e164) do update
    -- Keep an existing name; fill it in if we didn't have one.
    set full_name = coalesce(public.guests.full_name, excluded.full_name)
  returning id into v_guest;

  insert into public.leads (
    guest_id, source, event_type, event_date, guest_count,
    preferred_unit_id, next_follow_up_at, outlet_id
  )
  values (
    v_guest, p_source, nullif(trim(p_event_type), ''), p_event_date, p_guest_count,
    p_preferred_unit_id, p_next_follow_up_at,
    (select outlet_id from public.profiles where id = auth.uid())
  )
  returning id into v_lead;

  if nullif(trim(p_note), '') is not null then
    insert into public.messages (guest_id, lead_id, channel, direction, body, status, sent_by)
    values (v_guest, v_lead, 'call_note', 'in', trim(p_note), 'received', auth.uid());
  end if;

  return v_lead;
end;
$$;

revoke execute on function public.create_enquiry(text, text, public.lead_source, text, date, int, uuid, timestamptz, text) from public, anon;
grant execute on function public.create_enquiry(text, text, public.lead_source, text, date, int, uuid, timestamptz, text) to authenticated;
