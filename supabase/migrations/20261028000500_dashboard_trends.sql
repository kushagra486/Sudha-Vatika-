-- Month-on-month numbers and tonight's rooms for the dashboard.
-- SECURITY INVOKER: everything runs under the caller's RLS (sales see their
-- own leads and no payments). "This month so far" is compared with the same
-- number of days of last month, so the comparison is fair mid-month.

create or replace function public.dashboard_trends(
  p_today date default (now() at time zone 'Asia/Kolkata')::date
)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with
  b as (
    select
      p_today as today,
      date_trunc('month', p_today)::date as this_start,
      (date_trunc('month', p_today) - interval '1 month')::date as last_start,
      -- same day of last month, capped at its last day (31 Mar -> 28/29 Feb)
      least(
        (date_trunc('month', p_today) - interval '1 month')::date + (p_today - date_trunc('month', p_today)::date),
        (date_trunc('month', p_today) - interval '1 day')::date
      ) as last_same_day
  ),
  months as (
    select (date_trunc('month', p_today) - make_interval(months => g))::date as m
    from generate_series(0, 5) g
  ),
  lead_days as (
    select (l.created_at at time zone 'Asia/Kolkata')::date as d, l.stage
    from public.leads l
  ),
  booking_days as (
    select (bk.created_at at time zone 'Asia/Kolkata')::date as d, bk.status, bk.total, bk.event_date
    from public.bookings bk
  ),
  pay_days as (
    select (p.received_at at time zone 'Asia/Kolkata')::date as d,
           case when p.kind = 'refund' then -p.amount else p.amount end as amount
    from public.payments p
  ),
  period as (
    select 'this' as k, b.this_start as s, b.today as e from b
    union all
    select 'last', b.last_start, b.last_same_day from b
  ),
  cmp as (
    select pr.k,
      (select count(*) from lead_days ld where ld.d between pr.s and pr.e)::int as leads,
      (select count(*) from booking_days bd where bd.d between pr.s and pr.e and bd.status <> 'cancelled')::int as bookings,
      (select coalesce(sum(bd.total), 0) from booking_days bd where bd.d between pr.s and pr.e and bd.status <> 'cancelled') as booked_value,
      (select coalesce(sum(pd.amount), 0) from pay_days pd where pd.d between pr.s and pr.e) as collected
    from period pr
  ),
  series as (
    select mo.m,
      (select count(*) from lead_days ld where date_trunc('month', ld.d) = mo.m)::int as leads,
      (select count(*) from booking_days bd where date_trunc('month', bd.d) = mo.m and bd.status <> 'cancelled')::int as bookings,
      (select coalesce(sum(pd.amount), 0) from pay_days pd where date_trunc('month', pd.d) = mo.m) as collected,
      (select count(*) from public.bookings e where date_trunc('month', e.event_date) = mo.m and e.status in ('confirmed','completed'))::int as events
    from months mo
  ),
  rooms as (
    select u.id, u.name, u.kind::text as kind, u.quantity,
      coalesce((select sum(s.rooms) from public.room_stays s
                 where s.unit_id = u.id and s.status in ('reserved','checked_in')
                   and s.check_in <= p_today and s.check_out > p_today), 0)::int as taken,
      coalesce((select sum(s.rooms) from public.room_stays s
                 where s.unit_id = u.id and s.status = 'reserved' and s.check_in = p_today), 0)::int as arriving,
      coalesce((select sum(s.rooms) from public.room_stays s
                 where s.unit_id = u.id and s.status = 'checked_in' and s.check_out = p_today), 0)::int as leaving
    from public.units u
    where u.active and u.kind in ('room','dormitory')
  )
  select jsonb_build_object(
    'this_month', (select to_jsonb(c) - 'k' from cmp c where c.k = 'this'),
    'last_month_same_days', (select to_jsonb(c) - 'k' from cmp c where c.k = 'last'),
    'months', (select jsonb_agg(to_jsonb(s) order by s.m) from series s),
    'rooms_tonight', (select coalesce(jsonb_agg(to_jsonb(r) order by r.name), '[]'::jsonb) from rooms r)
  )
$$;

revoke execute on function public.dashboard_trends(date) from public, anon;
grant execute on function public.dashboard_trends(date) to authenticated;
