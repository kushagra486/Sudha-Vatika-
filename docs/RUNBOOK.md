# Runbook

## Local development

Requirements: Node 20+ and, for the full local stack, Docker with the [Supabase CLI](https://supabase.com/docs/guides/local-development).

```bash
npm install
cp .env.example .env
```

### Option A: full local Supabase stack

```bash
supabase start                 # applies supabase/migrations and supabase/seed.sql
supabase status                # copy API URL and anon key into .env
npm run dev                    # http://localhost:5173
```

Local emails, including magic links, go to Inbucket at http://localhost:54324.

### Option B: hosted Supabase project (free tier)

1. Create a project at supabase.com and pick the Mumbai (ap-south-1) region.
2. Link it and push the migrations:
   ```bash
   supabase link --project-ref <ref>
   supabase db push
   ```
3. Optional: load the demo data by running `supabase/seed.sql` in the SQL editor.
4. In **Authentication → Providers → Email**, turn off "Allow new users to sign up".
5. In **Authentication → URL Configuration**, set the Site URL to your frontend URL.
6. Put the project URL and anon key in `.env`.

## First owner

Signup is closed (see DECISIONS D11), so the first account is created by hand:

1. **Authentication → Users → Invite user**, using the owner's email.
2. Then either:
   - **New organization:** after the owner signs in once, run this as them (for example from the browser console with the Supabase client):
     ```js
     await supabase.rpc('create_organization', {
       org_name: 'Venue name',
       outlet_name: 'Main outlet',
       owner_full_name: 'Owner name',
     });
     ```
   - **Demo organization from the seed:** in the SQL editor, run:
     ```sql
     insert into profiles (id, org_id, outlet_id, full_name, role)
     select id, '00000000-0000-4000-a000-000000000001', '00000000-0000-4000-a000-000000000101', 'Your Name', 'owner'
     from auth.users where email = 'owner@example.com';
     ```

To add staff, invite them the same way, then insert a `profiles` row with their role. An owner can do this through the API, since RLS allows owners to write `profiles`. An in-app user screen comes with Settings.

## Checks

```bash
npm run check      # prettier, eslint, tsc, vitest
npm run test:db    # migrations + seed + SQL tests on a throwaway Postgres
npm run build
```

`test:db` uses `$DATABASE_URL` if it is set. Otherwise it starts a temporary cluster from the locally installed Postgres binaries (set `PGBIN` if they are not under `/usr/lib/postgresql/*/bin`). Point it only at a disposable database: it creates roles and stub `auth` objects.

## Frontend deploy (Cloudflare Pages or Netlify, free tier)

- Build command: `npm run build`
- Output directory: `apps/web/dist`
- Environment variables: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_APP_NAME`, plus any `VITE_FEATURE_*` flags.
- SPA routing: `apps/web/public/_redirects` already rewrites every path to `index.html`. Both hosts honour it.

Don't host on Vercel Hobby: its terms are non-commercial only.

## Migrations

- New file per change: `supabase/migrations/<YYYYMMDDHHMMSS>_<concern>.sql`. Never edit a migration that has been pushed to a hosted project.
- Every new table needs `org_id` (with the `app.current_org_id()` default), `unique (id, org_id)` if other tables reference it, composite foreign keys, RLS enabled, and policies. Add a test to `supabase/tests/`.
- If you add or change an enum or a check-constraint list, update `packages/shared/src/enums.ts`. `enums.test.ts` fails if they drift.
