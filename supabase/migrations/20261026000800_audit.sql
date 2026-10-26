-- Audit trail for bookings, payments, leads and services (brief 6.7).
-- Inserts and deletes store the full row; updates store only changed columns
-- as {"column": {"old": ..., "new": ...}}.

create or replace function app.write_audit_log()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old jsonb := case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) end;
  v_new jsonb := case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) end;
  v_row jsonb := coalesce(v_new, v_old);
  v_diff jsonb;
begin
  if tg_op = 'UPDATE' then
    select jsonb_object_agg(n.key, jsonb_build_object('old', v_old -> n.key, 'new', n.value))
      into v_diff
      from jsonb_each(v_new) n
     where n.key not in ('updated_at')
       and (v_old -> n.key) is distinct from n.value;
    if v_diff is null then
      return new;  -- nothing meaningful changed
    end if;
  else
    v_diff := v_row;
  end if;

  insert into public.audit_log (org_id, actor_id, action, entity, entity_id, diff)
  values (
    (v_row ->> 'org_id')::uuid,
    auth.uid(),
    lower(tg_op),
    tg_table_name,
    (v_row ->> 'id')::uuid,
    v_diff
  );

  return coalesce(new, old);
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array['bookings','payments','leads','services'] loop
    execute format(
      'create trigger %1$s_audit after insert or update or delete on public.%1$I
         for each row execute function app.write_audit_log()', t);
  end loop;
end $$;
