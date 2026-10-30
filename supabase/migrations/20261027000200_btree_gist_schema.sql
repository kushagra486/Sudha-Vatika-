-- Supabase's security advisor flags extensions in the public schema (lint
-- 0014). Move btree_gist, which backs the booking overlap constraint, into
-- "extensions" where Supabase keeps add-ons. The constraint refers to its
-- operator classes by id, so it keeps working. Skipped on plain Postgres (CI),
-- which has no "extensions" schema.

do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'extensions')
     and exists (select 1 from pg_extension e join pg_namespace n on n.oid = e.extnamespace
                  where e.extname = 'btree_gist' and n.nspname = 'public') then
    alter extension btree_gist set schema extensions;
  end if;
end $$;
