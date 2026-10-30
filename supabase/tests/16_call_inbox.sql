-- Screenshot call inbox: dedupe, push to enquiry, existing guest, RLS.
begin;

select tests.login('aaaaaaaa-0000-4000-8000-000000000003');  -- sales_a1
insert into call_inbox (dedupe_key, phone_e164, call_at, call_label, missed)
values ('+919812300001|2026-10-30|10:42', '+919812300001', '2026-10-30 10:42+05:30', '10:42 AM', true);
insert into call_inbox (dedupe_key, phone_e164, call_at) values ('+919811111111|2026-10-30|11:00', '+919811111111', '2026-10-30 11:00+05:30');
insert into call_inbox (dedupe_key, contact_name, call_label) values ('name:papa|2026-10-30|', 'Papa', 'Yesterday');
select tests.eq((select count(*)::int from call_inbox), 3, 'calls imported');

select tests.throws($$
  insert into call_inbox (dedupe_key, phone_e164) values ('+919812300001|2026-10-30|10:42', '+919812300001')
$$, '23505', 'same call twice is skipped');

-- New number -> new enquiry with the description as a note and a follow-up.
create temporary table t_r as select public.push_call(
  (select id from call_inbox where phone_e164 = '+919812300001'), '+919812300001', 'Neha', 'enquiry',
  'Engagement in Jan, 150 guests') as r;
select tests.eq((select (r->>'new_lead')::boolean from t_r), true, 'new lead created');
select tests.eq(
  (select source::text from leads where id = (select (r->>'lead_id')::uuid from t_r)), 'call', 'lead source is call');
select tests.eq(
  (select body from messages where lead_id = (select (r->>'lead_id')::uuid from t_r)), 'Engagement in Jan, 150 guests', 'description saved as call note');
select tests.eq(
  (select duration_sec from call_logs where provider = 'screenshot' and caller_phone_e164 = '+919812300001'), 0, 'missed call logged with 0 seconds');
select tests.eq((select status from call_inbox where phone_e164 = '+919812300001'), 'pushed', 'inbox row marked pushed');

select tests.throws($$
  select public.push_call((select id from call_inbox where phone_e164 = '+919812300001'), '+919812300001')
$$, 'P0001', 'cannot push twice');

-- Existing guest with an open enquiry (Riya, lead 801 owned by sales_a1) -> note added, no new lead.
create temporary table t_r2 as select public.push_call(
  (select id from call_inbox where phone_e164 = '+919811111111'), '+919811111111', null, 'enquiry', 'Asked about decor') as r;
select tests.eq((select (r->>'lead_id')::uuid from t_r2), '00000000-0000-4000-a000-000000000801'::uuid, 'joins the open enquiry');
select tests.eq((select (r->>'new_lead')::boolean from t_r2), false, 'no duplicate enquiry');

-- Saved contact pushed with a typed phone works too.
select public.push_call((select id from call_inbox where contact_name = 'Papa'), '+919899900000', null, 'enquiry', null);
select tests.eq((select full_name from guests where phone_e164 = '+919899900000'), 'Papa', 'contact name becomes guest name');

insert into phone_directory (key, category, label) values ('name:papa', 'personal', 'Papa');
select tests.eq((select count(*)::int from phone_directory), 1, 'directory entry saved');
select tests.logout();

-- Ops and viewers can't see the inbox; other orgs see nothing.
select tests.login('aaaaaaaa-0000-4000-8000-000000000005');
select tests.eq((select count(*)::int from call_inbox), 0, 'ops sees no call inbox');
select tests.logout();
select tests.login('bbbbbbbb-0000-4000-8000-000000000001');
select tests.eq((select count(*)::int from call_inbox), 0, 'other org sees nothing');
select tests.eq((select count(*)::int from phone_directory), 0, 'other org sees no directory');
select tests.logout();

rollback;
