-- create_organization RPC: first-run onboarding for a user with no profile.
begin;

select tests.login('cccccccc-0000-4000-8000-000000000001');
select public.create_organization('Shubh Vatika', 'Main Lawn', 'Neha Verma');
select tests.eq((select count(*)::int from organizations), 1, 'new owner sees their new org');
select tests.eq((select name from outlets), 'Main Lawn', 'first outlet is created');
select tests.eq((select role from profiles), 'owner', 'caller becomes owner');
select tests.eq((select tax_percent from organizations), 0::numeric, 'tax defaults to 0 until configured');

-- The new owner can now work inside their org.
insert into units (outlet_id, name) select id, 'Garden' from outlets;
select tests.eq((select count(*)::int from units), 1, 'new owner can add units');

select tests.throws(
  $$select public.create_organization('Again', 'X', 'Y')$$,
  '23505', 'cannot create a second org');
select tests.logout();

-- Existing members cannot create a new org either.
select tests.login('aaaaaaaa-0000-4000-8000-000000000003');
select tests.throws(
  $$select public.create_organization('Side hustle', 'X', 'Y')$$,
  '23505', 'existing member cannot create an org');
select tests.logout();

-- Anonymous callers are refused.
set local role anon;
select tests.throws(
  $$select public.create_organization('Anon', 'X', 'Y')$$,
  '42501', 'anon cannot call create_organization');
reset role;

rollback;
