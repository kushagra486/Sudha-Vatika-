-- create_booking and the lead-booked trigger.
begin;

-- From a lead (sales_a1 owns lead 801, guest Riya).
select tests.login('aaaaaaaa-0000-4000-8000-000000000003');
create temporary table t_b (id uuid);
grant select, insert on t_b to authenticated;
insert into t_b select public.create_booking(
  '00000000-0000-4000-a000-000000000204', '2027-03-20', 'full_day',
  p_lead_id => '00000000-0000-4000-a000-000000000801', p_event_type => 'Wedding',
  p_guest_count => 900, p_subtotal => 500000, p_discount => 20000, p_tax => 86400);
select tests.eq(
  (select guest_id from bookings where id = (select id from t_b)),
  '00000000-0000-4000-a000-000000000701'::uuid, 'booking from a lead uses the lead''s guest');
select tests.eq(
  (select status::text from bookings where id = (select id from t_b)), 'tentative', 'new bookings start tentative');
select tests.eq(
  (select outlet_id from bookings where id = (select id from t_b)),
  '00000000-0000-4000-a000-000000000101'::uuid, 'outlet comes from the space');
select tests.eq(
  (select total from bookings where id = (select id from t_b)), 566400.00::numeric, 'total from subtotal, discount, GST');
select tests.eq(
  (select created_by from bookings where id = (select id from t_b)),
  'aaaaaaaa-0000-4000-8000-000000000003'::uuid, 'created_by is the caller');

-- Overlap still applies.
select tests.throws(
  $$select public.create_booking('00000000-0000-4000-a000-000000000204', '2027-03-20', 'dinner', '+919811111111')$$,
  '23P01', 'cannot double-book through create_booking');
select tests.logout();

-- Walk-in by phone: new guest is created; returning phone reuses the guest.
select tests.login('aaaaaaaa-0000-4000-8000-000000000005');  -- ops
select public.create_booking('00000000-0000-4000-a000-000000000203', '2027-03-21', 'lunch', '+919877700011', 'Rotary Club', p_event_type => 'Meeting');
select tests.eq((select count(*)::int from guests where phone_e164 = '+919877700011'), 1, 'walk-in guest created');
select public.create_booking('00000000-0000-4000-a000-000000000203', '2027-03-22', 'lunch', '+919877700011', 'Someone else');
select tests.eq((select full_name from guests where phone_e164 = '+919877700011'), 'Rotary Club', 'returning guest keeps name');
select tests.eq(
  (select count(*)::int from bookings b join guests g on g.id = b.guest_id where g.phone_e164 = '+919877700011'),
  2, 'both bookings recorded');
select tests.throws(
  $$select public.create_booking('00000000-0000-4000-a000-000000000203', '2027-03-23', 'lunch')$$,
  '22023', 'a lead or phone is required');
select tests.throws(
  $$select public.create_booking('00000000-0000-4000-a000-000000000203', '2027-03-23', 'lunch', '123')$$,
  '23514', 'bad phone is rejected');
select tests.logout();

-- Viewers cannot create bookings.
select tests.login('aaaaaaaa-0000-4000-8000-000000000006');
select tests.throws(
  $$select public.create_booking('00000000-0000-4000-a000-000000000203', '2027-03-24', 'lunch', '+919877700099')$$,
  '42501', 'viewer cannot create bookings');
select tests.logout();

-- Confirming (after the advance) marks the lead booked and clears its follow-up.
update leads set next_follow_up_at = now() + interval '1 day' where id = '00000000-0000-4000-a000-000000000801';
insert into payments (org_id, booking_id, amount, kind, method)
select '00000000-0000-4000-a000-000000000001', id, 21000, 'advance', 'upi' from t_b;
select tests.login('aaaaaaaa-0000-4000-8000-000000000005');  -- ops confirms; ops cannot edit leads directly
update bookings set status = 'confirmed' where id = (select id from t_b);
select tests.logout();
select tests.eq(
  (select stage::text from leads where id = '00000000-0000-4000-a000-000000000801'), 'booked', 'confirming marks the lead booked');
select tests.eq(
  (select next_follow_up_at from leads where id = '00000000-0000-4000-a000-000000000801'), null::timestamptz,
  'booked lead has no follow-up');

-- A tentative booking does not touch the lead.
select tests.eq(
  (select stage::text from leads where id = '00000000-0000-4000-a000-000000000802'), 'new', 'other leads untouched');

rollback;
