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
3. Load the venue's starting data by running `supabase/seed.sql` in the SQL editor.
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
   - **Sudha Vatika from the seed:** in the SQL editor, run:
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

## Turning on optional services

Every one of these is off until you add its secrets. Until then the app still works: WhatsApp opens on the phone, and the AI uses its built-in rules.

Add secrets in the Supabase dashboard under **Edge Functions → Secrets**. Never put them in Netlify or git.

### AI (Claude)

1. Create an API key at console.anthropic.com (Settings → API keys) and add billing.
2. Add the secret `ANTHROPIC_API_KEY`. You can also add `AI_MODEL` to use a different model (default `claude-opus-5-5`).
3. In a lead, open **Assistant → Draft reply**. The note under the result should say "Suggested by Claude AI".

### WhatsApp Business API

1. In Meta Business, create a WhatsApp app and add the venue's number.
2. Add these secrets:
   - `WHATSAPP_TOKEN`: a permanent token
   - `WHATSAPP_PHONE_ID`
   - `WHATSAPP_APP_SECRET`
   - `WHATSAPP_VERIFY_TOKEN`: any string you choose
   - `WHATSAPP_ORG_ID`: the venue's organization id, `00000000-0000-4000-a000-000000000001` for Sudha Vatika
3. In Meta's webhook settings:
   - Callback URL: `https://iccdwtjefhwvptohbkha.supabase.co/functions/v1/whatsapp-webhook`
   - Verify token: the same `WHATSAPP_VERIFY_TOKEN`
   - Subscribe to `messages`.
4. Submit your templates for approval, and set each template's status to Approved in the app once Meta approves it.
5. In Netlify, set `VITE_FEATURE_WHATSAPP=true` and redeploy.

### Call capture

1. Add the secret `CALL_WEBHOOK_SECRET` (any long random string).
2. In your telephony provider (Exotel, Knowlarity, MyOperator…), set the "call ended" webhook:
   - URL: `https://iccdwtjefhwvptohbkha.supabase.co/functions/v1/call-webhook?org=00000000-0000-4000-a000-000000000001`
   - Header: `X-Webhook-Secret: <the secret>`
3. In Netlify, set `VITE_FEATURE_CALL_CAPTURE=true`. Calls then appear in Chats, and new callers become leads.

### Reception screen

Open `https://sudha-vatika.netlify.app/tv` on the reception TV or tablet. Sign in with a **viewer** account so the screen can't change anything.
