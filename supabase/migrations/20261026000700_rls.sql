-- Row Level Security for every table, following the role matrix in brief section 4.
--
--   owner    everything
--   manager  everything except users (profiles) and org settings (organizations, outlets)
--   sales    leads (own only), chats, guests, bookings (own), upsell, templates (view)
--   ops      bookings, inventory, payments (record), services, packages, media
--   viewer   read-only lists
--
-- Policies call helpers through (select ...) so Postgres evaluates them once per
-- statement instead of once per row.

-- ---------------------------------------------------------------------------
-- Defaults that fill tenant and actor columns from the session.
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'outlets','units','guests','leads','service_categories','services','packages',
    'package_services','media_assets','bookings','booking_items','payments',
    'message_templates','messages','call_logs','campaigns','automation_jobs',
    'upsell_suggestions'
  ] loop
    execute format('alter table public.%I alter column org_id set default app.current_org_id()', t);
  end loop;
end $$;

alter table public.leads alter column owner_id set default auth.uid();
alter table public.bookings alter column created_by set default auth.uid();
alter table public.payments alter column recorded_by set default auth.uid();
alter table public.campaigns alter column created_by set default auth.uid();

-- ---------------------------------------------------------------------------
-- Grants. RLS decides which rows; grants decide which verbs. anon gets nothing.
-- ---------------------------------------------------------------------------
revoke all on all tables in schema public from anon;
grant select, insert, update, delete on all tables in schema public to authenticated;
revoke all on public.inbound_events from authenticated;
revoke insert, update, delete on public.audit_log from authenticated;

-- ---------------------------------------------------------------------------
-- Enable RLS everywhere.
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- organizations, outlets, profiles: owner-managed.
-- ---------------------------------------------------------------------------
create policy organizations_select on public.organizations for select to authenticated
  using (id = (select app.current_org_id()));
create policy organizations_update on public.organizations for update to authenticated
  using (id = (select app.current_org_id()) and (select app.has_role('owner')))
  with check (id = (select app.current_org_id()));

create policy outlets_select on public.outlets for select to authenticated
  using (org_id = (select app.current_org_id()));
create policy outlets_write on public.outlets for all to authenticated
  using (org_id = (select app.current_org_id()) and (select app.has_role('owner')))
  with check (org_id = (select app.current_org_id()) and (select app.has_role('owner')));

create policy profiles_select on public.profiles for select to authenticated
  using (org_id = (select app.current_org_id()));
create policy profiles_write on public.profiles for all to authenticated
  using (org_id = (select app.current_org_id()) and (select app.has_role('owner')))
  with check (org_id = (select app.current_org_id()) and (select app.has_role('owner')));

-- ---------------------------------------------------------------------------
-- Inventory and catalogue: everyone reads; owner, manager and ops write.
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'units','service_categories','services','packages','package_services','media_assets'
  ] loop
    execute format($f$
      create policy %1$s_select on public.%1$I for select to authenticated
        using (org_id = (select app.current_org_id()));
      create policy %1$s_write on public.%1$I for all to authenticated
        using (org_id = (select app.current_org_id()) and (select app.has_role('owner','manager','ops')))
        with check (org_id = (select app.current_org_id()) and (select app.has_role('owner','manager','ops')));
    $f$, t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Guests: everyone reads (ops needs them for bookings); staff who talk to
-- guests write; only managers delete.
-- ---------------------------------------------------------------------------
create policy guests_select on public.guests for select to authenticated
  using (org_id = (select app.current_org_id()));
create policy guests_insert on public.guests for insert to authenticated
  with check (org_id = (select app.current_org_id()) and (select app.has_role('owner','manager','sales','ops')));
create policy guests_update on public.guests for update to authenticated
  using (org_id = (select app.current_org_id()) and (select app.has_role('owner','manager','sales','ops')))
  with check (org_id = (select app.current_org_id()));
create policy guests_delete on public.guests for delete to authenticated
  using (org_id = (select app.current_org_id()) and (select app.is_manager()));

-- ---------------------------------------------------------------------------
-- Leads: managers and viewers see all; sales see only leads they own.
-- ---------------------------------------------------------------------------
create policy leads_select on public.leads for select to authenticated
  using (
    org_id = (select app.current_org_id())
    and (
      (select app.has_role('owner','manager','viewer'))
      or ((select app.has_role('sales')) and owner_id = (select auth.uid()))
    )
  );
create policy leads_insert on public.leads for insert to authenticated
  with check (
    org_id = (select app.current_org_id())
    and (
      (select app.is_manager())
      or ((select app.has_role('sales')) and owner_id = (select auth.uid()))
    )
  );
create policy leads_update on public.leads for update to authenticated
  using (
    org_id = (select app.current_org_id())
    and (
      (select app.is_manager())
      or ((select app.has_role('sales')) and owner_id = (select auth.uid()))
    )
  )
  with check (
    org_id = (select app.current_org_id())
    and (
      (select app.is_manager())
      or ((select app.has_role('sales')) and owner_id = (select auth.uid()))
    )
  );
create policy leads_delete on public.leads for delete to authenticated
  using (org_id = (select app.current_org_id()) and (select app.is_manager()));

-- ---------------------------------------------------------------------------
-- Bookings: everyone reads (availability); owner, manager and ops write any;
-- sales write bookings they created. Only managers delete (prefer cancelling).
-- ---------------------------------------------------------------------------
create policy bookings_select on public.bookings for select to authenticated
  using (org_id = (select app.current_org_id()));
create policy bookings_insert on public.bookings for insert to authenticated
  with check (
    org_id = (select app.current_org_id())
    and (
      (select app.has_role('owner','manager','ops'))
      or ((select app.has_role('sales')) and created_by = (select auth.uid()))
    )
  );
create policy bookings_update on public.bookings for update to authenticated
  using (
    org_id = (select app.current_org_id())
    and (
      (select app.has_role('owner','manager','ops'))
      or ((select app.has_role('sales')) and created_by = (select auth.uid()))
    )
  )
  with check (
    org_id = (select app.current_org_id())
    and (
      (select app.has_role('owner','manager','ops'))
      or ((select app.has_role('sales')) and created_by = (select auth.uid()))
    )
  );
create policy bookings_delete on public.bookings for delete to authenticated
  using (org_id = (select app.current_org_id()) and (select app.is_manager()));

create policy booking_items_select on public.booking_items for select to authenticated
  using (org_id = (select app.current_org_id()));
create policy booking_items_write on public.booking_items for all to authenticated
  using (
    org_id = (select app.current_org_id())
    and (
      (select app.has_role('owner','manager','ops'))
      or (
        (select app.has_role('sales'))
        and exists (select 1 from public.bookings b
                     where b.id = booking_id and b.created_by = (select auth.uid()))
      )
    )
  )
  with check (
    org_id = (select app.current_org_id())
    and (
      (select app.has_role('owner','manager','ops'))
      or (
        (select app.has_role('sales'))
        and exists (select 1 from public.bookings b
                     where b.id = booking_id and b.created_by = (select auth.uid()))
      )
    )
  );

-- ---------------------------------------------------------------------------
-- Payments: ops records; managers correct; sales has no access.
-- ---------------------------------------------------------------------------
create policy payments_select on public.payments for select to authenticated
  using (org_id = (select app.current_org_id()) and (select app.has_role('owner','manager','ops','viewer')));
create policy payments_insert on public.payments for insert to authenticated
  with check (org_id = (select app.current_org_id()) and (select app.has_role('owner','manager','ops')));
create policy payments_update on public.payments for update to authenticated
  using (org_id = (select app.current_org_id()) and (select app.is_manager()))
  with check (org_id = (select app.current_org_id()));
create policy payments_delete on public.payments for delete to authenticated
  using (org_id = (select app.current_org_id()) and (select app.is_manager()));

-- ---------------------------------------------------------------------------
-- Messaging. Rows tied to a lead are visible to whoever can see that lead
-- (the subquery on leads runs under the caller's RLS).
-- ---------------------------------------------------------------------------
create policy message_templates_select on public.message_templates for select to authenticated
  using (org_id = (select app.current_org_id()) and (select app.has_role('owner','manager','sales')));
create policy message_templates_write on public.message_templates for all to authenticated
  using (org_id = (select app.current_org_id()) and (select app.is_manager()))
  with check (org_id = (select app.current_org_id()) and (select app.is_manager()));

create policy messages_select on public.messages for select to authenticated
  using (
    org_id = (select app.current_org_id())
    and (
      (select app.is_manager())
      or (
        (select app.has_role('sales'))
        and exists (select 1 from public.leads l where l.id = lead_id)
      )
    )
  );
-- Staff add call notes or manual messages; provider sends and status updates
-- go through Edge Functions with the service role.
create policy messages_insert on public.messages for insert to authenticated
  with check (
    org_id = (select app.current_org_id())
    and (
      (select app.is_manager())
      or (
        (select app.has_role('sales'))
        and exists (select 1 from public.leads l where l.id = lead_id)
      )
    )
  );

create policy call_logs_select on public.call_logs for select to authenticated
  using (
    org_id = (select app.current_org_id())
    and (
      (select app.is_manager())
      or (
        (select app.has_role('sales'))
        and exists (select 1 from public.leads l where l.id = lead_id)
      )
    )
  );

create policy campaigns_all on public.campaigns for all to authenticated
  using (org_id = (select app.current_org_id()) and (select app.is_manager()))
  with check (org_id = (select app.current_org_id()) and (select app.is_manager()));

create policy automation_jobs_all on public.automation_jobs for all to authenticated
  using (org_id = (select app.current_org_id()) and (select app.is_manager()))
  with check (org_id = (select app.current_org_id()) and (select app.is_manager()));

create policy upsell_suggestions_all on public.upsell_suggestions for all to authenticated
  using (
    org_id = (select app.current_org_id())
    and (
      (select app.is_manager())
      or (
        (select app.has_role('sales'))
        and exists (select 1 from public.leads l where l.id = lead_id)
      )
    )
  )
  with check (
    org_id = (select app.current_org_id())
    and (
      (select app.is_manager())
      or (
        (select app.has_role('sales'))
        and exists (select 1 from public.leads l where l.id = lead_id)
      )
    )
  );

create policy audit_log_select on public.audit_log for select to authenticated
  using (org_id = (select app.current_org_id()) and (select app.is_manager()));

-- inbound_events: RLS on, no policies. Service role only.
