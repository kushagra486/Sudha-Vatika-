-- Headline numbers for the dashboard in one round trip.
-- SECURITY INVOKER: every count runs under the caller's RLS, so a sales user
-- sees their own leads and no money figures (payments are hidden from sales).
-- "Today" is the India date; p_today exists so tests can pin it.

create or replace function public.dashboard_summary(
  p_today date default (now() at time zone 'Asia/Kolkata')::date
)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with
  bounds as (
    select
      p_today as today,
      (p_today::timestamp at time zone 'Asia/Kolkata') as day_start,
      ((p_today + 1)::timestamp at time zone 'Asia/Kolkata') as day_end,
      (date_trunc('month', p_today)::timestamp at time zone 'Asia/Kolkata') as month_start
  ),
  open_leads as (
    select l.* from public.leads l
    where l.stage in ('new','contacted','follow_up','proposal_sent')
  ),
  live_bookings as (
    select b.* from public.bookings b
    where b.status in ('tentative','confirmed')
  ),
  latest_whatsapp as (
    select distinct on (m.guest_id) m.guest_id, m.direction
    from public.messages m
    where m.channel = 'whatsapp' and m.guest_id is not null
    order by m.guest_id, m.created_at desc
  ),
  sources as (
    select l.source::text as source,
           count(*)::int as leads,
           count(*) filter (where l.stage = 'booked')::int as booked
    from public.leads l, bounds
    where l.created_at >= bounds.day_start - interval '29 days'
    group by l.source
  )
  select jsonb_build_object(
    'today', (select today from bounds),
    'open_by_stage', (
      select coalesce(jsonb_object_agg(stage, n), '{}'::jsonb)
      from (select stage::text, count(*)::int as n from open_leads group by stage) s
    ),
    'open_total', (select count(*)::int from open_leads),
    'follow_ups', jsonb_build_object(
      'overdue', (select count(*)::int from open_leads, bounds where next_follow_up_at < bounds.day_start),
      'today', (select count(*)::int from open_leads, bounds
                 where next_follow_up_at >= bounds.day_start and next_follow_up_at < bounds.day_end)
    ),
    'new_leads', jsonb_build_object(
      'today', (select count(*)::int from public.leads, bounds where created_at >= bounds.day_start),
      'last_7_days', (select count(*)::int from public.leads, bounds
                       where created_at >= bounds.day_start - interval '6 days')
    ),
    'unreplied_whatsapp', (select count(*)::int from latest_whatsapp where direction = 'in'),
    'events', jsonb_build_object(
      'today', (select count(*)::int from live_bookings, bounds where event_date = bounds.today),
      'next_7_days', (select count(*)::int from live_bookings, bounds
                       where event_date between bounds.today and bounds.today + 6),
      'tentative_upcoming', (select count(*)::int from live_bookings, bounds
                              where status = 'tentative' and event_date >= bounds.today)
    ),
    'money', jsonb_build_object(
      'collected_this_month', (
        select coalesce(sum(case when p.kind = 'refund' then -p.amount else p.amount end), 0)
        from public.payments p, bounds
        where p.received_at >= bounds.month_start
      ),
      'pending_upcoming', (
        select coalesce(sum(greatest(bb.balance, 0)), 0)
        from public.booking_balances bb
        join live_bookings b on b.id = bb.booking_id, bounds
        where b.event_date >= bounds.today
      )
    ),
    'sources_30_days', (
      select coalesce(jsonb_agg(to_jsonb(s) order by s.leads desc, s.source), '[]'::jsonb) from sources s
    )
  )
$$;

revoke execute on function public.dashboard_summary(date) from public, anon;
grant execute on function public.dashboard_summary(date) to authenticated;
