-- Minimum advance (₹21,000 for Sudha Vatika) before a booking can be confirmed.
begin;

select tests.eq(
  (select min_advance from organizations where id = '00000000-0000-4000-a000-000000000001'),
  21000.00::numeric, 'seeded minimum advance is ₹21,000');

-- Hold a date (tentative needs no advance).
insert into bookings (id, org_id, outlet_id, unit_id, guest_id, event_date, shift, subtotal)
values ('00000000-0000-4000-a000-000000000902', '00000000-0000-4000-a000-000000000001', '00000000-0000-4000-a000-000000000101',
        '00000000-0000-4000-a000-000000000204', '00000000-0000-4000-a000-000000000702', '2027-02-14', 'full_day', 400000);
select tests.eq(
  (select status::text from bookings where id = '00000000-0000-4000-a000-000000000902'),
  'tentative', 'a date can be held without an advance');

-- Cannot be created straight as confirmed.
select tests.throws(
  $$insert into bookings (org_id, outlet_id, unit_id, guest_id, event_date, shift, status, subtotal)
    values ('00000000-0000-4000-a000-000000000001', '00000000-0000-4000-a000-000000000101',
            '00000000-0000-4000-a000-000000000203', '00000000-0000-4000-a000-000000000702', '2027-02-15', 'lunch', 'confirmed', 50000)$$,
  'P0001', 'cannot create a confirmed booking with no advance');

-- Not enough advance.
insert into payments (org_id, booking_id, amount, kind, method)
values ('00000000-0000-4000-a000-000000000001', '00000000-0000-4000-a000-000000000902', 11000, 'advance', 'cash');
select tests.throws(
  $$update bookings set status = 'confirmed' where id = '00000000-0000-4000-a000-000000000902'$$,
  'P0001', '₹11,000 is not enough to confirm');

-- A refund brings the net below the minimum.
insert into payments (org_id, booking_id, amount, kind, method)
values ('00000000-0000-4000-a000-000000000001', '00000000-0000-4000-a000-000000000902', 10000, 'part', 'upi'),
       ('00000000-0000-4000-a000-000000000001', '00000000-0000-4000-a000-000000000902', 1000, 'refund', 'upi');
select tests.throws(
  $$update bookings set status = 'confirmed' where id = '00000000-0000-4000-a000-000000000902'$$,
  'P0001', 'refunds count against the advance');

-- Reaching ₹21,000 net allows confirmation.
insert into payments (org_id, booking_id, amount, kind, method)
values ('00000000-0000-4000-a000-000000000001', '00000000-0000-4000-a000-000000000902', 1000, 'part', 'cash');
update bookings set status = 'confirmed' where id = '00000000-0000-4000-a000-000000000902';
select tests.eq(
  (select status::text from bookings where id = '00000000-0000-4000-a000-000000000902'),
  'confirmed', '₹21,000 net confirms the booking');

-- Editing a confirmed booking does not re-check the advance.
update bookings set guest_count = 1200 where id = '00000000-0000-4000-a000-000000000902';
select tests.eq(
  (select guest_count from bookings where id = '00000000-0000-4000-a000-000000000902'),
  1200, 'confirmed bookings stay editable');

-- A booking worth less than ₹21,000 needs only its full total.
insert into bookings (id, org_id, outlet_id, unit_id, guest_id, event_date, shift, subtotal)
values ('00000000-0000-4000-a000-000000000903', '00000000-0000-4000-a000-000000000001', '00000000-0000-4000-a000-000000000101',
        '00000000-0000-4000-a000-000000000203', '00000000-0000-4000-a000-000000000702', '2027-03-01', 'high_tea', 15000);
insert into payments (org_id, booking_id, amount, kind, method)
values ('00000000-0000-4000-a000-000000000001', '00000000-0000-4000-a000-000000000903', 15000, 'final', 'upi');
update bookings set status = 'confirmed' where id = '00000000-0000-4000-a000-000000000903';
select tests.eq(
  (select status::text from bookings where id = '00000000-0000-4000-a000-000000000903'),
  'confirmed', 'small booking confirms once fully paid');

-- GST is optional: a booking without tax is valid.
select tests.eq(
  (select total from bookings where id = '00000000-0000-4000-a000-000000000903'),
  15000.00::numeric, 'booking without GST totals the subtotal');

-- Sales cannot read payments but the rule still counts them.
select tests.login('aaaaaaaa-0000-4000-8000-000000000003');
insert into bookings (id, outlet_id, unit_id, guest_id, event_date, shift, subtotal)
values ('00000000-0000-4000-a000-000000000904', '00000000-0000-4000-a000-000000000101',
        '00000000-0000-4000-a000-000000000201', '00000000-0000-4000-a000-000000000701', '2027-04-01', 'lunch', 100000);
select tests.logout();
insert into payments (org_id, booking_id, amount, kind, method)
values ('00000000-0000-4000-a000-000000000001', '00000000-0000-4000-a000-000000000904', 21000, 'advance', 'upi');
select tests.login('aaaaaaaa-0000-4000-8000-000000000003');
update bookings set status = 'confirmed' where id = '00000000-0000-4000-a000-000000000904';
select tests.eq(
  (select status::text from bookings where id = '00000000-0000-4000-a000-000000000904'),
  'confirmed', 'sales can confirm once the advance is in, without seeing payments');
select tests.logout();

rollback;
