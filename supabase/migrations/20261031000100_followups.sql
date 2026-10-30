-- After-booking follow-ups:
--   * balance reminders before the event (money roles only)
--   * feedback requests after the event, with the venue's Google review link
-- Every reminder, request and reply is a row in booking_touches, so the lists
-- show when a guest was last contacted and nobody is messaged twice by accident.

alter table public.organizations
  add column google_review_url text check (google_review_url is null or google_review_url ~ '^https://'),
  add column upi_id text check (upi_id is null or upi_id ~ '^[A-Za-z0-9._-]+@[A-Za-z0-9.-]+$');

create table public.booking_touches (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade default app.current_org_id(),
  booking_id uuid not null,
  kind text not null check (kind in ('balance_reminder','feedback_request','feedback')),
  rating smallint check (rating between 1 and 5),
  note text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  check (kind = 'feedback' or rating is null),
  foreign key (booking_id, org_id) references public.bookings(id, org_id) on delete cascade,
  foreign key (created_by, org_id) references public.profiles(id, org_id)
);
create index booking_touches_booking_idx on public.booking_touches(booking_id, kind, created_at desc);
create index booking_touches_org_idx on public.booking_touches(org_id, created_at);

revoke all on public.booking_touches from anon;
grant select, insert, delete on public.booking_touches to authenticated;
alter table public.booking_touches enable row level security;

create policy booking_touches_select on public.booking_touches for select to authenticated
  using (org_id = (select app.current_org_id()));
-- Balance reminders are about money: owner, manager, ops. Feedback: anyone who works with guests.
create policy booking_touches_insert on public.booking_touches for insert to authenticated
  with check (
    org_id = (select app.current_org_id())
    and created_by = (select auth.uid())
    and case when kind = 'balance_reminder'
             then (select app.has_role('owner','manager','ops'))
             else (select app.has_role('owner','manager','ops','sales')) end
  );
create policy booking_touches_delete on public.booking_touches for delete to authenticated
  using (org_id = (select app.current_org_id()) and (select app.is_manager()));

create trigger booking_touches_audit after insert or delete on public.booking_touches
  for each row execute function app.write_audit_log();

-- Upcoming events with money still to collect, soonest first.
create or replace function public.balance_reminders(
  p_days int default 30,
  p_today date default (now() at time zone 'Asia/Kolkata')::date
)
returns table (
  booking_id uuid, event_date date, shift public.shift_code, space text, event_type text,
  status public.booking_status, guest_id uuid, guest_name text, phone_e164 text,
  total numeric, paid numeric, balance numeric,
  last_reminded_at timestamptz, reminders int
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  if not (select app.has_role('owner','manager','ops','viewer')) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  return query
  select bk.id, bk.event_date, bk.shift, u.name, bk.event_type, bk.status,
         g.id, g.full_name, g.phone_e164,
         bb.total, bb.paid, bb.balance,
         t.last_at, coalesce(t.n, 0)::int
    from public.bookings bk
    join public.booking_balances bb on bb.booking_id = bk.id
    join public.units u on u.id = bk.unit_id
    join public.guests g on g.id = bk.guest_id
    left join lateral (
      select max(x.created_at) as last_at, count(*) as n
        from public.booking_touches x
       where x.booking_id = bk.id and x.kind = 'balance_reminder'
    ) t on true
   where bk.status in ('tentative','confirmed')
     and bk.event_date between p_today and p_today + greatest(p_days, 0)
     and bb.balance > 0
   order by bk.event_date, bk.shift;
end;
$$;

-- Events that have happened in the last p_days, with where feedback stands.
create or replace function public.feedback_queue(
  p_days int default 30,
  p_today date default (now() at time zone 'Asia/Kolkata')::date
)
returns table (
  booking_id uuid, event_date date, space text, event_type text,
  guest_id uuid, guest_name text, phone_e164 text,
  asked_at timestamptz, rating smallint, feedback_note text, feedback_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  select bk.id, bk.event_date, u.name, bk.event_type,
         g.id, g.full_name, g.phone_e164,
         (select max(x.created_at) from public.booking_touches x
           where x.booking_id = bk.id and x.kind = 'feedback_request'),
         f.rating, f.note, f.created_at
    from public.bookings bk
    join public.units u on u.id = bk.unit_id
    join public.guests g on g.id = bk.guest_id
    left join lateral (
      select x.rating, x.note, x.created_at from public.booking_touches x
       where x.booking_id = bk.id and x.kind = 'feedback'
       order by x.created_at desc limit 1
    ) f on true
   where bk.status in ('confirmed','completed')
     and bk.event_date between p_today - greatest(p_days, 1) and p_today - 1
   order by bk.event_date desc
$$;

revoke execute on function public.balance_reminders(int, date) from public, anon;
revoke execute on function public.feedback_queue(int, date) from public, anon;
grant execute on function public.balance_reminders(int, date) to authenticated;
grant execute on function public.feedback_queue(int, date) to authenticated;
