-- Room guide: requests, reviews and settings. Guests write through the Edge Function (service role),
-- so the rows below are inserted as the table owner.
begin;

insert into room_requests (org_id, room_number, guest_name, kind, item) values
  ('00000000-0000-4000-a000-000000000001', '101', 'Mr Verma', 'housekeeping', 'Towels'),
  ('00000000-0000-4000-a000-000000000001', '102', 'Mrs Rao', 'food', 'Tea');
insert into room_reviews (org_id, room_number, guest_name, rating, comment) values
  ('00000000-0000-4000-a000-000000000001', '101', 'Mr Verma', 5, 'Very clean');
insert into room_guide_settings (org_id, wifi_name, wifi_password) values
  ('00000000-0000-4000-a000-000000000001', 'SudhaVatika', 'welcome123');

-- Bad data is refused.
select tests.throws($$ insert into room_requests (org_id, room_number, guest_name, kind)
  values ('00000000-0000-4000-a000-000000000001', '103', 'X', 'spa') $$, '23514', 'unknown request kind');
select tests.throws($$ insert into room_reviews (org_id, room_number, guest_name, rating)
  values ('00000000-0000-4000-a000-000000000001', '103', 'X', 6) $$, '23514', 'rating above 5');

-- Ops handles a request: status change stamps who and when.
select tests.login('aaaaaaaa-0000-4000-8000-000000000005');
select tests.eq((select count(*)::int from room_requests), 2, 'ops sees requests');
update room_requests set status = 'done' where room_number = '101';
select tests.eq((select handled_by from room_requests where room_number = '101'),
  'aaaaaaaa-0000-4000-8000-000000000005'::uuid, 'handler recorded');
select tests.eq((select count(*)::int from room_requests where status = 'done' and handled_at is not null), 1, 'handled time recorded');
select tests.eq((select wifi_name from room_guide_settings), 'SudhaVatika', 'ops reads settings');
select tests.eq(tests.affected($$ update room_guide_settings set wifi_password = 'x' $$), 0, 'ops cannot edit settings');
select tests.logout();

-- Owner edits settings.
select tests.login('aaaaaaaa-0000-4000-8000-000000000001');
update room_guide_settings set wifi_password = 'new-pass';
select tests.eq((select wifi_password from room_guide_settings), 'new-pass', 'owner edits settings');
select tests.eq((select count(*)::int from room_reviews), 1, 'owner sees reviews');
select tests.logout();

-- Sales can handle requests but not read the WiFi password; viewers cannot change anything.
select tests.login('aaaaaaaa-0000-4000-8000-000000000003');
select tests.eq((select count(*)::int from room_guide_settings), 0, 'sales cannot read settings');
select tests.eq(tests.affected($$ update room_requests set status = 'in_progress' where room_number = '102' $$), 1, 'sales handles a request');
select tests.logout();

select tests.login('aaaaaaaa-0000-4000-8000-000000000006');
select tests.eq((select count(*)::int from room_requests), 2, 'viewer reads requests');
select tests.eq(tests.affected($$ update room_requests set status = 'done' $$), 0, 'viewer cannot handle requests');
select tests.logout();

-- Another organization sees nothing; anonymous callers cannot read.
select tests.login('bbbbbbbb-0000-4000-8000-000000000001');
select tests.eq((select count(*)::int from room_requests), 0, 'other org sees no requests');
select tests.eq((select count(*)::int from room_reviews), 0, 'other org sees no reviews');
select tests.logout();

set local role anon;
select tests.throws('select * from room_requests', '42501', 'anon cannot read requests');
select tests.throws('select * from room_guide_settings', '42501', 'anon cannot read settings');
reset role;

-- Nearby restaurants: everyone on staff reads, only owners and managers change, bad data is refused.
insert into room_restaurants (org_id, name, phone) values
  ('00000000-0000-4000-a000-000000000001', 'Test Kitchen', '+919876543210');
select tests.throws($$ insert into room_restaurants (org_id, name, phone)
  values ('00000000-0000-4000-a000-000000000001', 'Bad', '98765') $$, '23514', 'phone must be E.164');
select tests.throws($$ insert into room_restaurants (org_id, name, menu_url)
  values ('00000000-0000-4000-a000-000000000001', 'Bad', 'http://x') $$, '23514', 'menu link must be https');
select tests.login('aaaaaaaa-0000-4000-8000-000000000003');
select tests.eq((select count(*)::int from room_restaurants), 1, 'sales reads restaurants');
select tests.throws($$ insert into room_restaurants (name) values ('Nope') $$, '42501', 'sales cannot add restaurants');
select tests.logout();
select tests.login('aaaaaaaa-0000-4000-8000-000000000002');
insert into room_restaurants (name, phone) values ('Manager Cafe', '+919812345678');
select tests.eq((select count(*)::int from room_restaurants), 2, 'manager adds a restaurant');
select tests.logout();
select tests.login('bbbbbbbb-0000-4000-8000-000000000001');
select tests.eq((select count(*)::int from room_restaurants), 0, 'other org sees no restaurants');
select tests.logout();

rollback;
