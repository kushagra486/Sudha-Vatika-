-- Settings rules: owners keep control; settings writes are owner-only.
begin;

-- The last active owner cannot be demoted, deactivated or deleted.
select tests.throws(
  $$update profiles set role = 'manager' where id = 'aaaaaaaa-0000-4000-8000-000000000001'$$,
  'P0001', 'last owner cannot be demoted');
select tests.throws(
  $$update profiles set active = false where id = 'aaaaaaaa-0000-4000-8000-000000000001'$$,
  'P0001', 'last owner cannot be deactivated');
select tests.throws(
  $$delete from profiles where id = 'aaaaaaaa-0000-4000-8000-000000000001'$$,
  'P0001', 'last owner cannot be deleted');

-- With a second owner, one can step down.
update profiles set role = 'owner' where id = 'aaaaaaaa-0000-4000-8000-000000000002';
update profiles set role = 'manager' where id = 'aaaaaaaa-0000-4000-8000-000000000001';
select tests.eq(
  (select role from profiles where id = 'aaaaaaaa-0000-4000-8000-000000000001'), 'manager',
  'an owner can step down when another owner remains');

-- Other orgs are unaffected by org A's owners.
select tests.eq(
  (select count(*)::int from profiles where org_id = '00000000-0000-4000-b000-000000000001' and role = 'owner'),
  1, 'org B still has its owner');

-- Owners edit venue settings; managers cannot.
select tests.login('aaaaaaaa-0000-4000-8000-000000000002');  -- now an owner
select tests.eq(
  tests.affected($$update organizations set tax_percent = 12, min_advance = 25000, gst_number = '09ABCDE1234F1Z5'$$),
  1, 'owner updates GST rate, advance and GST number');
select tests.eq(
  tests.affected($$update outlets set address = 'Allahabad' where id = '00000000-0000-4000-a000-000000000101'$$),
  1, 'owner updates the venue address');
select tests.throws(
  $$update organizations set min_advance = -5$$, '23514', 'advance cannot be negative');
select tests.logout();

select tests.login('aaaaaaaa-0000-4000-8000-000000000001');  -- now a manager
select tests.eq(
  tests.affected($$update organizations set min_advance = 1$$), 0, 'manager cannot change the advance');
select tests.eq(
  tests.affected($$update profiles set role = 'owner' where id = 'aaaaaaaa-0000-4000-8000-000000000001'$$),
  0, 'manager cannot promote self back');
select tests.logout();

rollback;
