-- create_enquiry: the quick-add path for phone enquiries.
begin;

select tests.login('aaaaaaaa-0000-4000-8000-000000000001');  -- owner

-- New caller: guest, lead and note are created together.
select public.create_enquiry('+919833333333', 'Pooja Mehta', 'call', 'Wedding', '2027-02-10', 800,
                             '00000000-0000-4000-a000-000000000204', '2026-10-27 11:00+05:30',
                             'Wants pandaal, asked for veg menu');
select tests.eq((select count(*)::int from guests where phone_e164 = '+919833333333'), 1, 'new guest created');
select tests.eq(
  (select l.event_type from leads l join guests g on g.id = l.guest_id where g.phone_e164 = '+919833333333'),
  'Wedding', 'lead created for the guest');
select tests.eq(
  (select l.owner_id from leads l join guests g on g.id = l.guest_id where g.phone_e164 = '+919833333333'),
  'aaaaaaaa-0000-4000-8000-000000000001'::uuid, 'lead owned by whoever took the call');
select tests.eq(
  (select l.outlet_id from leads l join guests g on g.id = l.guest_id where g.phone_e164 = '+919833333333'),
  '00000000-0000-4000-a000-000000000101'::uuid, 'lead gets the caller''s outlet');
select tests.eq(
  (select m.body from messages m join guests g on g.id = m.guest_id where g.phone_e164 = '+919833333333'),
  'Wants pandaal, asked for veg menu', 'first call note saved');

-- Returning caller: same guest, new lead, existing name kept.
select public.create_enquiry('+919833333333', 'P. Mehta', 'referral', 'Birthday');
select tests.eq((select count(*)::int from guests where phone_e164 = '+919833333333'), 1, 'returning caller reuses the guest');
select tests.eq((select full_name from guests where phone_e164 = '+919833333333'), 'Pooja Mehta', 'existing name is kept');
select tests.eq(
  (select count(*)::int from leads l join guests g on g.id = l.guest_id where g.phone_e164 = '+919833333333'),
  2, 'a second lead is opened');

-- Unknown name gets filled in later.
select public.create_enquiry('+919844444444');
select public.create_enquiry('+919844444444', 'Karan Singh');
select tests.eq((select full_name from guests where phone_e164 = '+919844444444'), 'Karan Singh', 'missing name is filled in');

-- Blank note creates no message.
select tests.eq(
  (select count(*)::int from messages m join guests g on g.id = m.guest_id where g.phone_e164 = '+919844444444'),
  0, 'no note, no message');

-- Bad phone numbers are rejected by the guests constraint.
select tests.throws($$select public.create_enquiry('98765')$$, '23514', 'invalid phone is rejected');
select tests.logout();

-- Viewers cannot capture enquiries.
select tests.login('aaaaaaaa-0000-4000-8000-000000000006');
select tests.throws($$select public.create_enquiry('+919855555555', 'X')$$, '42501', 'viewer cannot create enquiries');
select tests.logout();

-- Ops may create guests but not leads: the guest insert succeeds, the lead
-- insert fails, and the guest must be rolled back with it.
select tests.login('aaaaaaaa-0000-4000-8000-000000000005');
select tests.throws($$select public.create_enquiry('+919855555556', 'Y')$$, '42501', 'ops cannot create enquiries');
select tests.logout();
select tests.eq((select count(*)::int from guests where phone_e164 = '+919855555556'), 0, 'failed enquiry leaves no orphan guest');

-- Sales get the lead as their own.
select tests.login('aaaaaaaa-0000-4000-8000-000000000003');
select public.create_enquiry('+919866666666', 'Neha', 'walk_in');
select tests.eq(
  (select count(*)::int from leads l join guests g on g.id = l.guest_id where g.phone_e164 = '+919866666666'),
  1, 'sales sees the enquiry they captured');
select tests.logout();

rollback;
