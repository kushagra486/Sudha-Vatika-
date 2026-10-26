-- Tenant isolation and basic role access.
begin;

-- Every public table has RLS enabled.
select tests.eq(
  (select count(*)::int from pg_tables where schemaname = 'public' and not rowsecurity),
  0, 'RLS enabled on every public table');

-- Every public table except inbound_events carries org_id (or is organizations).
select tests.eq(
  (select string_agg(t.tablename, ',') from pg_tables t
    where t.schemaname = 'public'
      and t.tablename not in ('organizations','inbound_events')
      and not exists (select 1 from information_schema.columns c
                       where c.table_schema = 'public' and c.table_name = t.tablename
                         and c.column_name = 'org_id')),
  null, 'org_id on every tenant table');

-- Owner B sees only org B.
select tests.login('bbbbbbbb-0000-4000-8000-000000000001');
select tests.eq((select count(*)::int from organizations), 1, 'owner B sees one org');
select tests.eq((select name from organizations), 'Other Venue', 'owner B sees own org');
select tests.eq((select count(*)::int from units), 1, 'owner B sees only B units');
select tests.eq((select count(*)::int from guests), 1, 'owner B sees only B guests');
select tests.eq((select count(*)::int from leads), 1, 'owner B sees only B leads');
select tests.eq((select count(*)::int from bookings), 0, 'owner B sees no A bookings');
select tests.eq((select count(*)::int from services), 0, 'owner B sees no A services');
select tests.eq((select count(*)::int from profiles), 1, 'owner B sees only B profiles');

-- Writing into another org is rejected by RLS.
select tests.throws(
  $$insert into guests (org_id, phone_e164) values ('00000000-0000-4000-a000-000000000001', '+919899999999')$$,
  '42501', 'owner B cannot insert into org A');
select tests.eq(
  tests.affected($$update guests set notes = 'x' where org_id = '00000000-0000-4000-a000-000000000001'$$),
  0, 'owner B cannot update org A rows');

-- org_id defaults to the caller's org.
insert into guests (phone_e164) values ('+919877777777');
select tests.eq(
  (select org_id from guests where phone_e164 = '+919877777777'),
  '00000000-0000-4000-b000-000000000001'::uuid, 'org_id defaults to caller org');
select tests.logout();

-- Composite foreign keys stop cross-tenant references even for privileged writers.
select tests.throws(
  $$insert into leads (org_id, guest_id, source)
    values ('00000000-0000-4000-a000-000000000001', '00000000-0000-4000-b000-000000000301', 'web')$$,
  '23503', 'lead cannot reference a guest from another org');
select tests.throws(
  $$insert into bookings (org_id, outlet_id, unit_id, guest_id, event_date, shift)
    values ('00000000-0000-4000-a000-000000000001', '00000000-0000-4000-a000-000000000101',
            '00000000-0000-4000-b000-000000000201', '00000000-0000-4000-a000-000000000701', '2027-01-01', 'lunch')$$,
  '23503', 'booking cannot use a unit from another org');

-- Anonymous users have no table access at all.
set local role anon;
select tests.throws('select * from leads', '42501', 'anon cannot read leads');
select tests.throws('select * from organizations', '42501', 'anon cannot read organizations');
reset role;

-- Inactive users and users without a profile see nothing.
select tests.login('aaaaaaaa-0000-4000-8000-000000000007');
select tests.eq((select count(*)::int from leads), 0, 'inactive user sees no leads');
select tests.eq((select count(*)::int from units), 0, 'inactive user sees no units');
select tests.logout();

select tests.login('cccccccc-0000-4000-8000-000000000001');
select tests.eq((select count(*)::int from organizations), 0, 'user without profile sees no org');
select tests.logout();

-- inbound_events is service-role only.
select tests.login('aaaaaaaa-0000-4000-8000-000000000001');
select tests.throws('select * from inbound_events', '42501', 'owner cannot read inbound_events');
select tests.logout();

-- Only owners manage users and org settings.
select tests.login('aaaaaaaa-0000-4000-8000-000000000002');  -- manager
select tests.eq(
  tests.affected($$update organizations set tax_percent = 5$$), 0, 'manager cannot change org settings');
select tests.eq(
  tests.affected($$update profiles set role = 'owner' where id = 'aaaaaaaa-0000-4000-8000-000000000002'$$),
  0, 'manager cannot promote self');
select tests.throws(
  $$insert into outlets (name) values ('Second outlet')$$, '42501', 'manager cannot add outlets');
select tests.logout();

select tests.login('aaaaaaaa-0000-4000-8000-000000000003');  -- sales
select tests.eq(
  tests.affected($$update profiles set role = 'manager' where id = 'aaaaaaaa-0000-4000-8000-000000000003'$$),
  0, 'sales cannot change own role');
select tests.logout();

select tests.login('aaaaaaaa-0000-4000-8000-000000000001');  -- owner
select tests.eq(
  tests.affected($$update organizations set tax_percent = 12$$), 1, 'owner can change org settings');
select tests.eq(
  tests.affected($$update profiles set role = 'viewer' where id = 'aaaaaaaa-0000-4000-8000-000000000004'$$),
  1, 'owner can change a role');
select tests.logout();

-- Catalogue: ops writes, sales and viewer read only.
select tests.login('aaaaaaaa-0000-4000-8000-000000000005');  -- ops
insert into services (name, base_price) values ('Valet parking', 15000);
select tests.eq((select count(*)::int from services where name = 'Valet parking'), 1, 'ops can add a service');
select tests.logout();

select tests.login('aaaaaaaa-0000-4000-8000-000000000003');  -- sales
select tests.eq((select count(*)::int from services), 7, 'sales can read services');
select tests.throws(
  $$insert into services (name) values ('Sneaky')$$, '42501', 'sales cannot add services');
select tests.eq(
  tests.affected($$update units set seating_capacity = 1$$), 0, 'sales cannot edit units');
select tests.logout();

select tests.login('aaaaaaaa-0000-4000-8000-000000000006');  -- viewer
select tests.eq((select count(*)::int from units), 3, 'viewer can read units');
select tests.throws(
  $$insert into guests (phone_e164) values ('+919866666666')$$, '42501', 'viewer cannot add guests');
select tests.eq(
  tests.affected($$update packages set price = 1$$), 0, 'viewer cannot edit packages');
select tests.logout();

rollback;
