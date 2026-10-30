-- Audit log triggers on bookings, payments, leads and services.
begin;

select tests.login('aaaaaaaa-0000-4000-8000-000000000002');  -- manager
update leads set stage = 'proposal_sent', guest_count = 450
 where id = '00000000-0000-4000-a000-000000000801';
select tests.logout();

select tests.eq(
  (select actor_id from audit_log where entity = 'leads' and action = 'update'
     and entity_id = '00000000-0000-4000-a000-000000000801'),
  'aaaaaaaa-0000-4000-8000-000000000002'::uuid, 'audit records the actor');
select tests.eq(
  (select diff from audit_log where entity = 'leads' and action = 'update'
     and entity_id = '00000000-0000-4000-a000-000000000801'),
  '{"stage": {"old": "contacted", "new": "proposal_sent"}, "guest_count": {"old": 400, "new": 450}}'::jsonb,
  'update diff holds only changed columns');

-- A no-op update writes nothing.
update services set name = name where id = '00000000-0000-4000-a000-000000000401';
select tests.eq(
  (select count(*)::int from audit_log where entity = 'services' and action = 'update'),
  0, 'no-op updates are not audited');

-- Inserts and deletes store the full row.
select tests.login('aaaaaaaa-0000-4000-8000-000000000005');  -- ops
insert into payments (booking_id, amount, kind, method)
values ('00000000-0000-4000-a000-000000000901', 25000, 'part', 'cash');
select tests.logout();
select tests.eq(
  (select (diff ->> 'amount')::numeric from audit_log where entity = 'payments' and action = 'insert'
     and actor_id = 'aaaaaaaa-0000-4000-8000-000000000005'),
  25000::numeric, 'insert is audited with the row');

delete from services where id = '00000000-0000-4000-a000-000000000405';
select tests.eq(
  (select diff ->> 'name' from audit_log where entity = 'services' and action = 'delete'),
  'DJ and sound', 'delete is audited with the old row');

-- Only managers can read the audit log, and users cannot write it.
select tests.login('aaaaaaaa-0000-4000-8000-000000000001');
select tests.eq((select count(*)::int > 0 from audit_log), true, 'owner can read audit log');
select tests.throws(
  $$insert into audit_log (org_id, action, entity) values ('00000000-0000-4000-a000-000000000001', 'x', 'y')$$,
  '42501', 'audit log cannot be written directly');
select tests.throws($$delete from audit_log$$, '42501', 'audit log cannot be deleted');
select tests.logout();

select tests.login('aaaaaaaa-0000-4000-8000-000000000005');
select tests.eq((select count(*)::int from audit_log), 0, 'ops cannot read audit log');
select tests.logout();

select tests.login('bbbbbbbb-0000-4000-8000-000000000001');
select tests.eq(
  (select count(*)::int from audit_log where org_id = '00000000-0000-4000-a000-000000000001'),
  0, 'other org cannot read org A audit log');
select tests.logout();

rollback;
