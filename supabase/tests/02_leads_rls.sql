-- Lead visibility by role, and data that inherits it (messages, upsell).
begin;

-- Sales see only their own leads.
select tests.login('aaaaaaaa-0000-4000-8000-000000000003');  -- sales_a1
select tests.eq((select count(*)::int from leads), 1, 'sales_a1 sees one lead');
select tests.eq((select id from leads), '00000000-0000-4000-a000-000000000801'::uuid, 'sales_a1 sees own lead');
select tests.eq(
  tests.affected($$update leads set stage = 'lost', lost_reason = 'x' where id = '00000000-0000-4000-a000-000000000802'$$),
  0, 'sales_a1 cannot update a colleague lead');
select tests.eq(
  tests.affected($$update leads set stage = 'follow_up' where id = '00000000-0000-4000-a000-000000000801'$$),
  1, 'sales_a1 can update own lead');
select tests.throws(
  $$update leads set owner_id = 'aaaaaaaa-0000-4000-8000-000000000004' where id = '00000000-0000-4000-a000-000000000801'$$,
  '42501', 'sales cannot hand a lead to someone else');
select tests.throws(
  $$insert into leads (guest_id, source, owner_id)
    values ('00000000-0000-4000-a000-000000000701', 'manual', 'aaaaaaaa-0000-4000-8000-000000000004')$$,
  '42501', 'sales cannot create a lead owned by someone else');

-- owner_id defaults to the creator, so a plain insert works.
insert into leads (guest_id, source) values ('00000000-0000-4000-a000-000000000701', 'walk_in');
select tests.eq((select count(*)::int from leads), 2, 'sales lead insert defaults owner to self');
select tests.eq(
  tests.affected($$delete from leads where id = '00000000-0000-4000-a000-000000000801'$$),
  0, 'sales cannot delete leads');

-- Messages follow lead visibility.
select tests.eq((select count(*)::int from messages), 1, 'sales_a1 sees messages on own lead only');
select tests.throws(
  $$insert into messages (guest_id, lead_id, channel, direction, body)
    values ('00000000-0000-4000-a000-000000000702', '00000000-0000-4000-a000-000000000802', 'call_note', 'out', 'x')$$,
  '42501', 'sales cannot add notes to a colleague lead');
insert into messages (guest_id, lead_id, channel, direction, body)
values ('00000000-0000-4000-a000-000000000701', '00000000-0000-4000-a000-000000000801', 'call_note', 'out', 'Called, wants a site visit');
select tests.eq((select count(*)::int from messages), 2, 'sales can add a call note on own lead');

-- Upsell follows lead visibility.
insert into upsell_suggestions (lead_id, service_id, reason)
values ('00000000-0000-4000-a000-000000000801', '00000000-0000-4000-a000-000000000406', 'Wedding with 400 guests');
select tests.throws(
  $$insert into upsell_suggestions (lead_id, service_id)
    values ('00000000-0000-4000-a000-000000000802', '00000000-0000-4000-a000-000000000406')$$,
  '42501', 'sales cannot add upsell to a colleague lead');

-- Sales can read templates but not change them.
select tests.eq((select count(*)::int from message_templates), 2, 'sales can read templates');
select tests.eq(
  tests.affected($$update message_templates set body = 'x'$$), 0, 'sales cannot edit templates');

-- No payments, campaigns, automation or audit for sales.
select tests.eq((select count(*)::int from payments), 0, 'sales sees no payments');
select tests.eq((select count(*)::int from campaigns), 0, 'sales sees no campaigns');
select tests.eq((select count(*)::int from audit_log), 0, 'sales sees no audit log');
select tests.logout();

-- Managers see and manage every lead, including unassigned ones.
select tests.login('aaaaaaaa-0000-4000-8000-000000000002');
-- 3 fixture leads plus the one sales_a1 created above.
select tests.eq((select count(*)::int from leads), 4, 'manager sees all leads');
select tests.eq((select count(*)::int from messages), 3, 'manager sees all messages, including the note above');
select tests.eq(
  tests.affected($$update leads set owner_id = 'aaaaaaaa-0000-4000-8000-000000000003' where id = '00000000-0000-4000-a000-000000000803'$$),
  1, 'manager can assign a lead');
select tests.logout();

-- After assignment, sales_a1 sees it.
select tests.login('aaaaaaaa-0000-4000-8000-000000000003');
select tests.eq((select count(*)::int from leads), 3, 'assigned lead becomes visible to sales');
select tests.logout();

-- Viewer reads all leads but cannot write; ops has no lead access.
select tests.login('aaaaaaaa-0000-4000-8000-000000000006');
select tests.eq((select count(*)::int from leads), 4, 'viewer sees all leads');
select tests.throws(
  $$insert into leads (guest_id, source) values ('00000000-0000-4000-a000-000000000701', 'manual')$$,
  '42501', 'viewer cannot create leads');
select tests.eq(
  tests.affected($$update leads set stage = 'contacted'$$), 0, 'viewer cannot update leads');
select tests.eq((select count(*)::int from messages), 0, 'viewer sees no chats');
select tests.logout();

select tests.login('aaaaaaaa-0000-4000-8000-000000000005');
select tests.eq((select count(*)::int from leads), 0, 'ops sees no leads');
select tests.logout();

-- updated_at moves on update.
update leads set updated_at = '2020-01-01' where id = '00000000-0000-4000-a000-000000000802';
update leads set guest_count = 90 where id = '00000000-0000-4000-a000-000000000802';
select tests.eq(
  (select updated_at > '2020-01-02' from leads where id = '00000000-0000-4000-a000-000000000802'),
  true, 'updated_at is maintained');

-- Budget range check.
select tests.throws(
  $$update leads set budget_min = 500000, budget_max = 100000 where id = '00000000-0000-4000-a000-000000000802'$$,
  '23514', 'budget_min cannot exceed budget_max');

rollback;
