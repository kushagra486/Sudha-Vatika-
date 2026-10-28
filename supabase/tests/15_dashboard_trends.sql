-- Month comparison and tonight's rooms.
begin;

-- Pin data: two leads this month (Nov 2026), one last month, one booking and payment.
insert into leads (org_id, guest_id, source, created_at) values
  ('00000000-0000-4000-a000-000000000001', '00000000-0000-4000-a000-000000000701', 'call', '2026-11-03 10:00+05:30'),
  ('00000000-0000-4000-a000-000000000001', '00000000-0000-4000-a000-000000000701', 'call', '2026-11-09 10:00+05:30'),
  ('00000000-0000-4000-a000-000000000001', '00000000-0000-4000-a000-000000000702', 'call', '2026-10-05 10:00+05:30'),
  ('00000000-0000-4000-a000-000000000001', '00000000-0000-4000-a000-000000000702', 'call', '2026-10-20 10:00+05:30');
insert into room_stays (org_id, unit_id, guest_id, check_in, check_out, rooms, status) values
  ('00000000-0000-4000-a000-000000000001', '00000000-0000-4000-a000-000000000209', '00000000-0000-4000-a000-000000000701', '2026-11-09', '2026-11-12', 3, 'reserved'),
  ('00000000-0000-4000-a000-000000000001', '00000000-0000-4000-a000-000000000209', '00000000-0000-4000-a000-000000000702', '2026-11-08', '2026-11-10', 2, 'checked_in');

select tests.login('aaaaaaaa-0000-4000-8000-000000000001');  -- owner
create temporary table t_tr as select public.dashboard_trends('2026-11-10') as j;
select tests.eq((select (j->'this_month'->>'leads')::int from t_tr), 2, 'leads this month so far');
select tests.eq((select (j->'last_month_same_days'->>'leads')::int from t_tr), 1, 'last month counts only the same days (1-10 Oct)');
select tests.eq((select jsonb_array_length(j->'months') from t_tr), 6, 'six months of history');
select tests.eq((select j->'months'->5->>'m' from t_tr), '2026-11-01', 'series ends with this month');
select tests.eq(
  (select (r->>'taken')::int from t_tr, jsonb_array_elements(j->'rooms_tonight') r where r->>'name' = 'Hotel rooms'),
  3, 'rooms taken tonight (check-outs free their rooms)');
select tests.eq(
  (select (r->>'leaving')::int from t_tr, jsonb_array_elements(j->'rooms_tonight') r where r->>'name' = 'Hotel rooms'),
  2, 'check-outs today');
select tests.eq(
  (select (r->>'taken')::int from t_tr, jsonb_array_elements(j->'rooms_tonight') r where r->>'name' = 'Dormitory'),
  0, 'empty dorm');
select tests.logout();

-- Month-end clamp: 31 Mar compares with 1-28 Feb.
select tests.login('aaaaaaaa-0000-4000-8000-000000000001');
select tests.eq(
  (select (public.dashboard_trends('2027-03-31')->'last_month_same_days'->>'leads')::int), 0, 'month-end clamp runs');
select tests.logout();

-- Sales sees no payments in the comparison.
select tests.login('aaaaaaaa-0000-4000-8000-000000000003');
select tests.eq((select (public.dashboard_trends('2026-11-10')->'this_month'->>'collected')::numeric), 0::numeric, 'sales sees no money');
select tests.logout();

rollback;
