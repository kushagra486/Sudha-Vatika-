-- Calls read from iPhone "Recents" screenshots. iOS lets no app read the call
-- log, so staff screenshot Recents once a day and the web app reads the
-- images in the browser. Each call lands in call_inbox; staff flag the real
-- enquiries, add a description and push them, which creates or updates the
-- guest and enquiry. phone_directory remembers numbers (and saved-contact
-- names) that are never enquiries: family, staff, vendors, spam.

create table public.call_inbox (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null default app.current_org_id() references public.organizations(id) on delete cascade,
  imported_by uuid default auth.uid(),
  dedupe_key text not null,
  phone_e164 text check (phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  contact_name text,                 -- Recents shows a name for saved contacts
  call_at timestamptz,
  call_label text,                   -- as shown: "10:42 AM", "Yesterday", "Monday"
  missed boolean not null default false,
  repeat_count int not null default 1 check (repeat_count > 0),
  status text not null default 'new' check (status in ('new','pushed','ignored')),
  category text check (category in ('enquiry','existing','personal','staff','vendor','spam','other')),
  description text,
  guest_id uuid,
  lead_id uuid,
  created_at timestamptz not null default now(),
  unique (org_id, dedupe_key),
  check (phone_e164 is not null or contact_name is not null),
  foreign key (imported_by, org_id) references public.profiles(id, org_id),
  foreign key (guest_id, org_id) references public.guests(id, org_id) on delete set null (guest_id),
  foreign key (lead_id, org_id) references public.leads(id, org_id) on delete set null (lead_id)
);
create index call_inbox_org_status_idx on public.call_inbox(org_id, status, call_at desc);

create table public.phone_directory (
  org_id uuid not null default app.current_org_id() references public.organizations(id) on delete cascade,
  key text not null,                 -- '+9198…' or 'name:<lowercased contact name>'
  category text not null check (category in ('personal','staff','vendor','spam')),
  label text,
  created_at timestamptz not null default now(),
  primary key (org_id, key)
);

revoke all on public.call_inbox, public.phone_directory from anon;
grant select, insert, update, delete on public.call_inbox, public.phone_directory to authenticated;
alter table public.call_inbox enable row level security;
alter table public.phone_directory enable row level security;

create policy call_inbox_rw on public.call_inbox for all to authenticated
  using (org_id = (select app.current_org_id()) and (select app.has_role('owner','manager','sales')))
  with check (org_id = (select app.current_org_id()) and (select app.has_role('owner','manager','sales')));
create policy phone_directory_rw on public.phone_directory for all to authenticated
  using (org_id = (select app.current_org_id()) and (select app.has_role('owner','manager','sales')))
  with check (org_id = (select app.current_org_id()) and (select app.has_role('owner','manager','sales')));

-- Pushed calls also appear in each guest's call history.
create policy call_logs_insert on public.call_logs for insert to authenticated
  with check (org_id = (select app.current_org_id()) and (select app.has_role('owner','manager','sales')));
alter table public.call_logs alter column org_id set default app.current_org_id();

-- Flag a call as an enquiry (or about an existing one) and send it on.
-- SECURITY INVOKER: the caller's RLS applies to every write.
create or replace function public.push_call(
  p_inbox_id uuid,
  p_phone_e164 text,
  p_full_name text default null,
  p_kind text default 'enquiry',     -- 'enquiry' | 'existing'
  p_description text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_row public.call_inbox;
  v_guest uuid;
  v_lead uuid;
  v_new boolean := false;
  v_note text := nullif(trim(p_description), '');
begin
  if p_kind not in ('enquiry','existing') then
    raise exception 'Unknown kind %', p_kind using errcode = '22023';
  end if;
  select * into v_row from public.call_inbox where id = p_inbox_id for update;
  if not found then
    raise exception 'Call not found' using errcode = '23503';
  end if;
  if v_row.status <> 'new' then
    raise exception 'Call already handled' using errcode = 'P0001', hint = 'already_handled';
  end if;

  insert into public.guests (phone_e164, full_name)
  values (p_phone_e164, nullif(trim(coalesce(p_full_name, v_row.contact_name)), ''))
  on conflict (org_id, phone_e164) do update
    set full_name = coalesce(public.guests.full_name, excluded.full_name)
  returning id into v_guest;

  -- An open enquiry for this guest gets the note; otherwise start one.
  select id into v_lead from public.leads
   where guest_id = v_guest
     and (p_kind = 'existing' or stage in ('new','contacted','follow_up','proposal_sent'))
   order by (stage in ('new','contacted','follow_up','proposal_sent')) desc, created_at desc
   limit 1;

  if v_lead is null then
    insert into public.leads (guest_id, source, next_follow_up_at, outlet_id)
    values (
      v_guest, 'call',
      -- tomorrow 11 am India time
      ((now() at time zone 'Asia/Kolkata')::date + 1 + time '11:00') at time zone 'Asia/Kolkata',
      (select outlet_id from public.profiles where id = auth.uid())
    )
    returning id into v_lead;
    v_new := true;
  end if;

  if v_note is not null then
    insert into public.messages (guest_id, lead_id, channel, direction, body, status, sent_by)
    values (v_guest, v_lead, 'call_note', 'in', v_note, 'received', auth.uid());
  end if;

  insert into public.call_logs (provider, provider_call_id, caller_phone_e164, guest_id, lead_id,
                                started_at, duration_sec, transcript)
  values ('screenshot', v_row.id::text, p_phone_e164, v_guest, v_lead,
          v_row.call_at, case when v_row.missed then 0 end, v_note)
  on conflict (provider, provider_call_id) do nothing;

  update public.call_inbox
     set status = 'pushed', category = p_kind, phone_e164 = p_phone_e164,
         description = v_note, guest_id = v_guest, lead_id = v_lead
   where id = v_row.id;

  return jsonb_build_object('guest_id', v_guest, 'lead_id', v_lead, 'new_lead', v_new);
end;
$$;

revoke execute on function public.push_call(uuid, text, text, text, text) from public, anon;
grant execute on function public.push_call(uuid, text, text, text, text) to authenticated;
