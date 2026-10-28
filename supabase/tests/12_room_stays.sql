-- Room and dormitory stays: per-night capacity, kind check, RLS.
begin;

-- Hotel rooms (209) have 8 rooms; dormitory (208) has 6.
select tests.login('aaaaaaaa-0000-4000-8000-000000000005');  -- ops
insert into room_stays (unit_id, guest_id, check_in, check_out, rooms, rate)
values ('00000000-0000-4000-a000-000000000209', '00000000-0000-4000-a000-000000000701', '2027-01-10', '2027-01-13', 5, 2500);
select tests.eq((select nights from room_stays where rooms = 5), 3, 'nights from dates');
select tests.eq((select amount from room_stays where rooms = 5), 37500.00::numeric, 'amount = nights x rooms x rate');

-- 3 more on overlapping nights fit (5 + 3 = 8).
insert into room_stays (unit_id, guest_id, check_in, check_out, rooms)
values ('00000000-0000-4000-a000-000000000209', '00000000-0000-4000-a000-000000000702', '2027-01-12', '2027-01-14', 3);

select tests.throws($$
  insert into room_stays (unit_id, guest_id, check_in, check_out, rooms)
  values ('00000000-0000-4000-a000-000000000209', '00000000-0000-4000-a000-000000000702', '2027-01-12', '2027-01-13', 1)
$$, 'P0001', 'a ninth room on a full night is refused');

-- The checkout day is free again.
insert into room_stays (unit_id, guest_id, check_in, check_out, rooms)
values ('00000000-0000-4000-a000-000000000209', '00000000-0000-4000-a000-000000000702', '2027-01-14', '2027-01-15', 8);
select tests.eq((select count(*)::int from room_stays), 3, 'check-out day can be rebooked');

-- Cancelling frees rooms.
update room_stays set status = 'cancelled' where rooms = 3;
insert into room_stays (unit_id, guest_id, check_in, check_out, rooms)
values ('00000000-0000-4000-a000-000000000209', '00000000-0000-4000-a000-000000000702', '2027-01-12', '2027-01-13', 3);
select tests.eq((select count(*)::int from room_stays where status = 'reserved'), 3, 'cancelled stays free rooms');

select tests.throws($$
  insert into room_stays (unit_id, guest_id, check_in, check_out)
  values ('00000000-0000-4000-a000-000000000201', '00000000-0000-4000-a000-000000000701', '2027-02-01', '2027-02-02')
$$, 'P0001', 'halls cannot take overnight stays');

select tests.throws($$
  insert into room_stays (unit_id, guest_id, check_in, check_out)
  values ('00000000-0000-4000-a000-000000000208', '00000000-0000-4000-a000-000000000701', '2027-02-02', '2027-02-02')
$$, '23514', 'check-out must be after check-in');

select tests.throws($$
  insert into room_stays (unit_id, guest_id, check_in, check_out, rooms)
  values ('00000000-0000-4000-a000-000000000208', '00000000-0000-4000-a000-000000000701', '2027-02-02', '2027-02-03', 7)
$$, 'P0001', 'dormitory holds 6 rooms');
-- RPC: walk-in by phone creates the guest; booking guest is reused.
select public.create_room_stay('00000000-0000-4000-a000-000000000208', '2027-02-10', '2027-02-11', 2, '+919855500011', 'Baraat party');
select tests.eq((select full_name from guests where phone_e164 = '+919855500011'), 'Baraat party', 'stay RPC creates guest');
select public.create_room_stay('00000000-0000-4000-a000-000000000208', '2027-02-10', '2027-02-11', 1,
  p_booking_id => '00000000-0000-4000-a000-000000000901');
select tests.eq(
  (select guest_id from room_stays where booking_id = '00000000-0000-4000-a000-000000000901'),
  '00000000-0000-4000-a000-000000000701'::uuid, 'stay for a booking uses the booking guest');
select tests.logout();

-- Viewer reads, cannot write; other org sees nothing.
select tests.login('aaaaaaaa-0000-4000-8000-000000000006');
select tests.eq((select count(*)::int from room_stays), 6, 'viewer sees stays');
select tests.throws($$
  insert into room_stays (unit_id, guest_id, check_in, check_out)
  values ('00000000-0000-4000-a000-000000000208', '00000000-0000-4000-a000-000000000701', '2027-03-01', '2027-03-02')
$$, '42501', 'viewer cannot add stays');
select tests.logout();

select tests.login('bbbbbbbb-0000-4000-8000-000000000001');
select tests.eq((select count(*)::int from room_stays), 0, 'other org sees no stays');
select tests.logout();

rollback;
