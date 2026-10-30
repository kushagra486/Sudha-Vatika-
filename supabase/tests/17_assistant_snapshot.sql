-- Assistant snapshot: contents, and money hidden from sales.
begin;

select tests.login('aaaaaaaa-0000-4000-8000-000000000001');  -- owner
create temporary table t_s as select public.assistant_snapshot('2026-11-01') as j;
select tests.eq((select j->'venue'->>'name' from t_s), 'Sudha Vatika', 'venue name');
select tests.eq((select (j->>'can_see_money')::boolean from t_s), true, 'owner sees money');
select tests.eq((select jsonb_array_length(j->'spaces') >= 9 from t_s), true, 'spaces listed');
select tests.eq((select j->'bookings'->0->>'space' from t_s), 'Ashoka Hall', 'fixture booking with space name');
select tests.eq((select j->'bookings'->0->>'id' from t_s), '00000000-0000-4000-a000-000000000901', 'bookings carry their id');
select tests.eq((select (j->'bookings'->0->>'total')::numeric from t_s), 330400.00::numeric, 'owner sees booking total');
select tests.eq((select (j->'counts'->>'open_enquiries')::int from t_s), 3, 'open enquiries counted');
select tests.eq((select j->'money' is not null and j->'money' <> 'null'::jsonb from t_s), true, 'money block present');
select tests.logout();

select tests.login('aaaaaaaa-0000-4000-8000-000000000003');  -- sales_a1
create temporary table t_s2 as select public.assistant_snapshot('2026-11-01') as j;
select tests.eq((select (j->>'can_see_money')::boolean from t_s2), false, 'sales flagged without money');
select tests.eq((select j->'bookings'->0 ? 'total' from t_s2), false, 'sales sees no booking totals');
select tests.eq((select j->'money' = 'null'::jsonb from t_s2), true, 'sales gets no money block');
select tests.eq((select (j->'counts'->>'open_enquiries')::int from t_s2), 1, 'sales sees only own enquiries');
select tests.logout();

rollback;
