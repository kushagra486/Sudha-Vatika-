-- dashboard_summary: headline numbers, scoped by RLS.
-- Fixture org A has 3 open leads (new, new, contacted) created now, two inbound
-- WhatsApp chats, one confirmed booking on 2026-12-12 (total ₹3,30,400) with a
-- ₹1,00,000 advance received now.
begin;

create temporary table t_today as select (now() at time zone 'Asia/Kolkata')::date as d;
grant select on t_today to authenticated;

-- Follow-ups: one overdue (yesterday), one due later today.
update leads set next_follow_up_at = ((select d from t_today) - 1)::timestamp at time zone 'Asia/Kolkata' + interval '11 hours'
 where id = '00000000-0000-4000-a000-000000000801';
update leads set next_follow_up_at = (select d from t_today)::timestamp at time zone 'Asia/Kolkata' + interval '23 hours 30 minutes'
 where id = '00000000-0000-4000-a000-000000000802';

-- Events: one today (tentative, ₹50,000, nothing paid), one in 3 days, one in 10 days.
insert into bookings (org_id, outlet_id, unit_id, guest_id, event_date, shift, subtotal) values
  ('00000000-0000-4000-a000-000000000001', '00000000-0000-4000-a000-000000000101', '00000000-0000-4000-a000-000000000202',
   '00000000-0000-4000-a000-000000000702', (select d from t_today), 'dinner', 50000),
  ('00000000-0000-4000-a000-000000000001', '00000000-0000-4000-a000-000000000101', '00000000-0000-4000-a000-000000000203',
   '00000000-0000-4000-a000-000000000702', (select d from t_today) + 3, 'lunch', 0),
  ('00000000-0000-4000-a000-000000000001', '00000000-0000-4000-a000-000000000101', '00000000-0000-4000-a000-000000000203',
   '00000000-0000-4000-a000-000000000702', (select d from t_today) + 10, 'lunch', 0);
-- A cancelled booking today must not count.
insert into bookings (org_id, outlet_id, unit_id, guest_id, event_date, shift, status) values
  ('00000000-0000-4000-a000-000000000001', '00000000-0000-4000-a000-000000000101', '00000000-0000-4000-a000-000000000201',
   '00000000-0000-4000-a000-000000000702', (select d from t_today), 'lunch', 'cancelled');

create temporary table t_owner (s jsonb);
grant select, insert on t_owner to authenticated;

select tests.login('aaaaaaaa-0000-4000-8000-000000000001');
insert into t_owner select public.dashboard_summary((select d from t_today));
select tests.logout();

select tests.eq((select (s ->> 'today')::date from t_owner), (select d from t_today), 'today is the India date');
select tests.eq((select (s ->> 'open_total')::int from t_owner), 3, 'open leads');
select tests.eq((select s -> 'open_by_stage' from t_owner), '{"new": 2, "contacted": 1}'::jsonb, 'open leads by stage');
select tests.eq((select (s -> 'follow_ups' ->> 'overdue')::int from t_owner), 1, 'overdue follow-ups');
select tests.eq((select (s -> 'follow_ups' ->> 'today')::int from t_owner), 1, 'follow-ups due today (late tonight still counts)');
select tests.eq((select (s -> 'new_leads' ->> 'today')::int from t_owner), 3, 'new enquiries today');
select tests.eq((select (s -> 'new_leads' ->> 'last_7_days')::int from t_owner), 3, 'new enquiries in 7 days');
select tests.eq((select (s ->> 'unreplied_whatsapp')::int from t_owner), 2, 'unreplied WhatsApp chats');
select tests.eq((select (s -> 'events' ->> 'today')::int from t_owner), 1, 'events today (cancelled excluded)');
select tests.eq((select (s -> 'events' ->> 'next_7_days')::int from t_owner), 2, 'events in the next 7 days');
select tests.eq((select (s -> 'events' ->> 'tentative_upcoming')::int from t_owner), 3, 'tentative upcoming bookings');
select tests.eq((select (s -> 'money' ->> 'collected_this_month')::numeric from t_owner), 100000::numeric, 'collected this month');
select tests.eq(
  (select (s -> 'money' ->> 'pending_upcoming')::numeric from t_owner),
  280400::numeric, 'pending = ₹2,30,400 on the wedding + ₹50,000 today');
select tests.eq(
  (select s -> 'sources_30_days' from t_owner),
  '[{"source": "call", "leads": 1, "booked": 0}, {"source": "web", "leads": 1, "booked": 0}, {"source": "whatsapp", "leads": 1, "booked": 0}]'::jsonb,
  'sources in the last 30 days');

-- Replying on WhatsApp clears that chat; booking a lead moves it out of "open".
insert into messages (org_id, guest_id, channel, direction, body)
values ('00000000-0000-4000-a000-000000000001', '00000000-0000-4000-a000-000000000701', 'whatsapp', 'out', 'Yes, 12 Dec is free');
update leads set stage = 'booked' where id = '00000000-0000-4000-a000-000000000801';
select tests.login('aaaaaaaa-0000-4000-8000-000000000001');
select tests.eq((select (public.dashboard_summary((select d from t_today)) ->> 'unreplied_whatsapp')::int), 1, 'a reply clears the chat');
select tests.eq((select (public.dashboard_summary((select d from t_today)) ->> 'open_total')::int), 2, 'booked leads leave the open count');
select tests.eq(
  (select public.dashboard_summary((select d from t_today)) -> 'sources_30_days' -> 2),
  '{"source": "whatsapp", "leads": 1, "booked": 1}'::jsonb, 'booked leads count per source');
-- Refunds reduce money collected.
insert into payments (booking_id, amount, kind, method)
values ('00000000-0000-4000-a000-000000000901', 5000, 'refund', 'upi');
select tests.eq(
  (select (public.dashboard_summary((select d from t_today)) -> 'money' ->> 'collected_this_month')::numeric),
  95000::numeric, 'refunds reduce collected');
select tests.logout();

-- Sales see only their own leads and no money.
select tests.login('aaaaaaaa-0000-4000-8000-000000000004');  -- sales_a2 owns lead 802
select tests.eq((select (public.dashboard_summary((select d from t_today)) ->> 'open_total')::int), 1, 'sales: own open leads only');
select tests.eq(
  (select (public.dashboard_summary((select d from t_today)) -> 'money' ->> 'collected_this_month')::numeric),
  0::numeric, 'sales: no payment figures');
select tests.logout();

-- Another org sees only its own numbers.
select tests.login('bbbbbbbb-0000-4000-8000-000000000001');
select tests.eq((select (public.dashboard_summary((select d from t_today)) ->> 'open_total')::int), 1, 'org B: own leads only');
select tests.eq((select (public.dashboard_summary((select d from t_today)) -> 'events' ->> 'next_7_days')::int), 0, 'org B: no org A events');
select tests.logout();

-- Anonymous callers are refused.
set local role anon;
select tests.throws($$select public.dashboard_summary()$$, '42501', 'anon cannot read the dashboard');
reset role;

rollback;
