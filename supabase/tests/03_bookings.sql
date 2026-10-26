-- Booking overlap rules, totals, and booking/payment access.
-- Fixture: Grand Hall (…0201) is booked for dinner on 2026-12-12 (confirmed).
begin;

create temporary table t_ids as select
  '00000000-0000-4000-a000-000000000001'::uuid as org,
  '00000000-0000-4000-a000-000000000101'::uuid as outlet,
  '00000000-0000-4000-a000-000000000201'::uuid as grand_hall,
  '00000000-0000-4000-a000-000000000202'::uuid as lawn,
  '00000000-0000-4000-a000-000000000701'::uuid as guest;
grant select on t_ids to authenticated;

create or replace function pg_temp.book(p_unit uuid, p_date date, p_shift shift_code, p_status booking_status default 'tentative')
returns uuid language sql as $$
  insert into bookings (org_id, outlet_id, unit_id, guest_id, event_date, shift, status)
  select org, outlet, p_unit, guest, p_date, p_shift, p_status from t_ids
  returning id
$$;

-- Same unit, date and shift: rejected.
select tests.throws(
  $$select pg_temp.book((select grand_hall from t_ids), '2026-12-12', 'dinner')$$,
  '23P01', 'same shift on same unit and date is rejected');

-- full_day conflicts with any shift, both ways.
select tests.throws(
  $$select pg_temp.book((select grand_hall from t_ids), '2026-12-12', 'full_day')$$,
  '23P01', 'full_day is rejected when dinner is booked');
select pg_temp.book((select lawn from t_ids), '2026-12-20', 'full_day');
select tests.throws(
  $$select pg_temp.book((select lawn from t_ids), '2026-12-20', 'lunch')$$,
  '23P01', 'lunch is rejected when full_day is booked');

-- Different shifts, units or dates are fine.
select tests.eq(
  (select pg_temp.book((select grand_hall from t_ids), '2026-12-12', 'lunch') is not null),
  true, 'lunch and dinner can share a unit and date');
select tests.eq(
  (select pg_temp.book((select lawn from t_ids), '2026-12-12', 'dinner') is not null),
  true, 'another unit is free on the same slot');
select tests.eq(
  (select pg_temp.book((select grand_hall from t_ids), '2026-12-13', 'dinner') is not null),
  true, 'same unit is free on another date');

-- Cancelled bookings free the slot, and cannot be revived into a clash.
update bookings set status = 'cancelled' where id = '00000000-0000-4000-a000-000000000901';
select tests.eq(
  (select pg_temp.book((select grand_hall from t_ids), '2026-12-12', 'dinner') is not null),
  true, 'cancelled booking frees its slot');
select tests.throws(
  $$update bookings set status = 'confirmed' where id = '00000000-0000-4000-a000-000000000901'$$,
  '23P01', 'reviving a cancelled booking into a clash is rejected');

-- Moving a booking onto a taken slot is rejected.
select tests.throws(
  $$update bookings set shift = 'dinner'
     where unit_id = (select grand_hall from t_ids) and event_date = '2026-12-12' and shift = 'lunch'$$,
  '23P01', 'changing shift into a clash is rejected');
select tests.throws(
  $$update bookings set event_date = '2026-12-20', unit_id = (select lawn from t_ids)
     where unit_id = (select grand_hall from t_ids) and event_date = '2026-12-13'$$,
  '23P01', 'moving date and unit into a clash is rejected');

-- The exclusion constraint holds even if the friendly trigger is bypassed
-- (this is what protects against two concurrent inserts).
alter table bookings disable trigger bookings_check_overlap;
select tests.throws(
  $$select pg_temp.book((select lawn from t_ids), '2026-12-20', 'dinner')$$,
  '23P01', 'exclusion constraint blocks overlap without the trigger');
alter table bookings enable trigger bookings_check_overlap;

-- The trigger sees bookings hidden from the caller: sales_a1 cannot double-book
-- a slot even though RLS lets them see all bookings anyway.
select tests.login('aaaaaaaa-0000-4000-8000-000000000003');
select tests.throws(
  $$select pg_temp.book((select lawn from t_ids), '2026-12-20', 'high_tea')$$,
  '23P01', 'sales cannot double-book');
select tests.logout();

-- Totals are generated and cannot be written.
select tests.eq(
  (select total from bookings where id = '00000000-0000-4000-a000-000000000901'),
  330400.00::numeric, 'total = subtotal - discount + tax');
select tests.throws(
  $$update bookings set total = 1 where id = '00000000-0000-4000-a000-000000000901'$$,
  '428C9', 'total cannot be written');
select tests.throws(
  $$update bookings set discount = 400000 where id = '00000000-0000-4000-a000-000000000901'$$,
  '23514', 'discount cannot exceed subtotal');

-- Unit must belong to the booking outlet.
insert into outlets (id, org_id, name) values ('00000000-0000-4000-a000-000000000102', '00000000-0000-4000-a000-000000000001', 'Second Outlet');
select tests.throws(
  $$insert into bookings (org_id, outlet_id, unit_id, guest_id, event_date, shift)
    select org, '00000000-0000-4000-a000-000000000102', grand_hall, guest, '2027-02-01', 'lunch' from t_ids$$,
  '23503', 'unit must belong to the booking outlet');

-- Sales can create bookings and edit only their own.
select tests.login('aaaaaaaa-0000-4000-8000-000000000003');
select tests.eq(
  (select pg_temp.book((select grand_hall from t_ids), '2027-01-15', 'lunch') is not null),
  true, 'sales can create a booking');
select tests.eq(
  (select created_by from bookings where event_date = '2027-01-15'),
  'aaaaaaaa-0000-4000-8000-000000000003'::uuid, 'created_by defaults to the creator');
select tests.eq(
  tests.affected($$update bookings set guest_count = 10 where id = '00000000-0000-4000-a000-000000000901'$$),
  0, 'sales cannot edit a booking created by ops');
insert into booking_items (booking_id, description, unit_price)
select id, 'Extra chairs', 5000 from bookings where event_date = '2027-01-15';
select tests.throws(
  $$insert into booking_items (booking_id, description, unit_price)
    values ('00000000-0000-4000-a000-000000000901', 'Sneaky item', 1)$$,
  '42501', 'sales cannot add items to someone else''s booking');
select tests.throws(
  $$insert into payments (booking_id, amount, kind, method)
    values ('00000000-0000-4000-a000-000000000901', 5000, 'part', 'cash')$$,
  '42501', 'sales cannot record payments');
select tests.logout();

-- Ops records payments; balance view reflects them; refunds subtract.
select tests.login('aaaaaaaa-0000-4000-8000-000000000005');
insert into payments (booking_id, amount, kind, method, reference)
values ('00000000-0000-4000-a000-000000000901', 50000, 'part', 'bank', 'NEFT123');
select tests.eq(
  (select paid from booking_balances where booking_id = '00000000-0000-4000-a000-000000000901'),
  150000.00::numeric, 'paid sums advance and part payments');
insert into payments (booking_id, amount, kind, method)
values ('00000000-0000-4000-a000-000000000901', 10000, 'refund', 'upi');
select tests.eq(
  (select balance from booking_balances where booking_id = '00000000-0000-4000-a000-000000000901'),
  190400.00::numeric, 'balance = total - payments + refunds');
select tests.eq(
  tests.affected($$update payments set amount = 1$$), 0, 'ops cannot edit recorded payments');
select tests.throws(
  $$insert into payments (booking_id, amount, kind, method)
    values ('00000000-0000-4000-a000-000000000901', 0, 'part', 'cash')$$,
  '23514', 'zero payments are rejected');
select tests.logout();

-- Viewer reads payments but cannot record them.
select tests.login('aaaaaaaa-0000-4000-8000-000000000006');
select tests.eq((select count(*)::int from payments), 3, 'viewer can read payments');
select tests.throws(
  $$insert into payments (booking_id, amount, kind, method)
    values ('00000000-0000-4000-a000-000000000901', 1, 'part', 'cash')$$,
  '42501', 'viewer cannot record payments');
select tests.logout();

rollback;
