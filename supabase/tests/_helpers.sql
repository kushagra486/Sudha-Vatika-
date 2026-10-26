-- Assertion helpers for the SQL tests. Loaded after migrations.

create schema if not exists tests;
grant usage on schema tests to authenticated, anon;

-- Act as a signed-in user for the rest of the transaction.
create or replace function tests.login(p_user uuid)
returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end;
$$;

create or replace function tests.logout()
returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claims', '', true);
  execute 'reset role';
end;
$$;

create or replace function tests.eq(actual anyelement, expected anyelement, label text)
returns void
language plpgsql
as $$
begin
  if actual is distinct from expected then
    raise exception 'FAIL %: expected %, got %', label, expected, actual;
  end if;
  raise notice 'ok - %', label;
end;
$$;

-- Assert that a statement fails with the given SQLSTATE (or any error when null).
create or replace function tests.throws(stmt text, expected_state text, label text)
returns void
language plpgsql
as $$
declare
  v_state text;
begin
  begin
    execute stmt;
  exception when others then
    get stacked diagnostics v_state = returned_sqlstate;
    if expected_state is not null and v_state <> expected_state then
      raise exception 'FAIL %: expected SQLSTATE %, got % (%)', label, expected_state, v_state, sqlerrm;
    end if;
    raise notice 'ok - %', label;
    return;
  end;
  raise exception 'FAIL %: statement succeeded but should have failed', label;
end;
$$;

-- Number of rows a statement affected (for UPDATE/DELETE that RLS silently filters).
create or replace function tests.affected(stmt text)
returns int
language plpgsql
as $$
declare
  n int;
begin
  execute stmt;
  get diagnostics n = row_count;
  return n;
end;
$$;

grant execute on all functions in schema tests to authenticated, anon;
