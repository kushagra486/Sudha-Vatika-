-- Bookings in the assistant snapshot carry their id, so a photo or document the
-- assistant reads (receipt, invoice, menu for an event) can be attached to the
-- right booking after staff confirm it. Otherwise unchanged.

create or replace function public.assistant_snapshot(
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
      (p_today::timestamp at time zone 'Asia/Kolkata') as day_start,
      ((p_today + 1)::timestamp at time zone 'Asia/Kolkata') as day_end,
      (date_trunc('month', p_today)::timestamp at time zone 'Asia/Kolkata') as month_start,
      ((date_trunc('month', p_today) - interval '1 month')::timestamp at time zone 'Asia/Kolkata') as last_month_start,
      (select app.has_role('owner','manager','ops','viewer')) as money
  ),
  open_leads as (
    select l.* from public.leads l
     where l.stage in ('new','contacted','follow_up','proposal_sent')
  )
  select jsonb_build_object(
    'today', (select today from b),
    'generated_at', now(),
    'can_see_money', (select money from b),
    'venue', (
      select jsonb_build_object('name', o.name, 'min_advance', o.min_advance, 'gst_percent', o.tax_percent)
        from public.organizations o limit 1
    ),
    'spaces', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'name', u.name, 'kind', u.kind, 'capacity', u.floating_capacity,
               'rooms', u.quantity, 'opening_soon', u.upcoming) order by u.upcoming, u.name), '[]'::jsonb)
        from public.units u where u.active
    ),
    'bookings', (
      select coalesce(jsonb_agg(x order by x->>'date', x->>'shift'), '[]'::jsonb) from (
        select jsonb_strip_nulls(jsonb_build_object(
          'id', bk.id, 'date', bk.event_date, 'shift', bk.shift, 'space', u.name, 'status', bk.status,
          'event', bk.event_type, 'guests', bk.guest_count,
          'guest', g.full_name, 'phone', g.phone_e164,
          'total', case when (select money from b) then bk.total end,
          'paid', case when (select money from b) then bb.paid end,
          'balance', case when (select money from b) then bb.balance end
        )) as x
        from public.bookings bk
        join public.units u on u.id = bk.unit_id
        join public.guests g on g.id = bk.guest_id
        left join public.booking_balances bb on bb.booking_id = bk.id
        where bk.status <> 'cancelled'
          and bk.event_date between p_today - 7 and p_today + 180
        order by bk.event_date
        limit 300
      ) s
    ),
    'room_stays', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'space', u.name, 'check_in', s.check_in, 'check_out', s.check_out,
               'rooms', s.rooms, 'status', s.status, 'guest', g.full_name) order by s.check_in), '[]'::jsonb)
        from public.room_stays s
        join public.units u on u.id = s.unit_id
        join public.guests g on g.id = s.guest_id
       where s.status in ('reserved','checked_in')
         and s.check_out > p_today and s.check_in <= p_today + 60
    ),
    'open_enquiries', (
      select coalesce(jsonb_agg(x), '[]'::jsonb) from (
        select jsonb_strip_nulls(jsonb_build_object(
          'guest', g.full_name, 'phone', g.phone_e164, 'stage', l.stage, 'source', l.source,
          'event', l.event_type, 'date', l.event_date, 'guests', l.guest_count,
          'budget', l.budget_max,
          'follow_up', (l.next_follow_up_at at time zone 'Asia/Kolkata')::date,
          'received', (l.created_at at time zone 'Asia/Kolkata')::date
        )) as x
        from open_leads l join public.guests g on g.id = l.guest_id
        order by l.next_follow_up_at nulls last, l.created_at desc
        limit 200
      ) s
    ),
    'counts', jsonb_build_object(
      'open_enquiries', (select count(*) from open_leads),
      'new_today', (select count(*) from public.leads, b where created_at >= b.day_start),
      'new_last_7_days', (select count(*) from public.leads, b where created_at >= b.day_start - interval '6 days'),
      'follow_ups_overdue', (select count(*) from open_leads, b where next_follow_up_at < b.day_start),
      'follow_ups_today', (select count(*) from open_leads, b
                            where next_follow_up_at >= b.day_start and next_follow_up_at < b.day_end),
      'booked_this_month', (select count(*) from public.leads, b where stage = 'booked' and updated_at >= b.month_start)
    ),
    'money', case when (select money from b) then jsonb_build_object(
      'collected_this_month', (
        select coalesce(sum(case when p.kind = 'refund' then -p.amount else p.amount end), 0)
          from public.payments p, b where p.received_at >= b.month_start),
      'collected_last_month', (
        select coalesce(sum(case when p.kind = 'refund' then -p.amount else p.amount end), 0)
          from public.payments p, b where p.received_at >= b.last_month_start and p.received_at < b.month_start),
      'balance_due_upcoming', (
        select coalesce(sum(greatest(bb.balance, 0)), 0)
          from public.booking_balances bb join public.bookings bk on bk.id = bb.booking_id, b
         where bk.status in ('tentative','confirmed') and bk.event_date >= b.today)
    ) end,
    'services', (
      select coalesce(jsonb_agg(jsonb_build_object('name', sv.name, 'price', sv.base_price,
               'per', sv.pricing_unit, 'group', c.name) order by c.name, sv.name), '[]'::jsonb)
        from public.services sv left join public.service_categories c on c.id = sv.category_id
       where sv.active
    ),
    'packages', (
      select coalesce(jsonb_agg(jsonb_build_object('name', p.name, 'price', p.price,
               'guests_from', p.guest_min, 'guests_to', p.guest_max, 'details', p.description)
               order by p.price), '[]'::jsonb)
        from public.packages p where p.active
    )
  )
$$;

revoke execute on function public.assistant_snapshot(date) from public, anon;
grant execute on function public.assistant_snapshot(date) to authenticated;
