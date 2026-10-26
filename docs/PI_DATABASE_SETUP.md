# Database on the Raspberry Pi

The owners chose to self-host the Sudha Vatika database on their Raspberry Pi ("Pi console") instead of Supabase's cloud. The web app is hosted on Netlify at <https://sudha-vatika.netlify.app> and talks to the Pi over HTTPS.

**Trade-off:** if the Pi loses power or internet, the app is down for everyone, including staff phones. Keep it on a UPS, use wired internet, and keep the nightly backups below.

## What the app needs

A real Supabase stack: Postgres 15+, GoTrue (auth), PostgREST, Storage and Kong. The migrations rely on:

- `auth.uid()` and the `anon`, `authenticated` and `service_role` roles
- the `btree_gist` extension
- `storage.buckets`

A plain Postgres server is not enough.

## Steps (run on the Pi, in `~/projects/Sudha-Vatika-`)

1. **Update the code.** Run `git pull origin claude/banquet-manager-setup-rg7qte`.
2. **Create the project.** In the Pi console, create a Supabase project named **Sudha Vatika**. If the console can't run a full Supabase stack on ARM64, stop and report what it supports.
3. **Apply the schema.** Apply `supabase/migrations/*.sql` in filename order, then `supabase/seed.sql`. `supabase db push` works if the CLI is linked to the project. Never edit an applied migration; if one fails, report the error.
4. **Set up auth.**
   - Email magic link, with public signup **off**.
   - Configure SMTP, or nobody receives sign-in links. A free Brevo or Gmail app-password SMTP account is enough for two owners.
   - Site URL `https://sudha-vatika.netlify.app`, with that URL in the redirect allow-list.
5. **Make it reachable over HTTPS.** The Netlify site is HTTPS, so the API needs a public HTTPS hostname; a LAN IP or plain HTTP won't work. A Cloudflare Tunnel (free) avoids opening router ports.
   - Expose **only** the Supabase API gateway (Kong).
   - Never expose Postgres (5432) or Studio.
6. **Keep it running.** Start the stack and the tunnel on boot (systemd), and run a nightly `pg_dump` backup that keeps 14 days, ideally to a USB drive or cloud storage rather than the SD card.
7. **Connect the website.** In Netlify (Project configuration → Environment variables), set:
   - `VITE_SUPABASE_URL`: the public HTTPS API URL
   - `VITE_SUPABASE_ANON_KEY`: the anon (public) key

   Then redeploy. These two values are public by design; RLS protects the data.

8. **Create the owners' accounts.** Invite both owners by email. After each has signed in once, link them to the venue (see `docs/RUNBOOK.md`, "Sudha Vatika from the seed"), with role `owner` for both.

**Never** put the `service_role` key, JWT secret or database password in Netlify, in git, or in a chat message. They stay on the Pi.

## Checking it works

- `https://<api-host>/rest/v1/` with header `apikey: <anon key>` returns JSON, not an error page.
- Sign in at <https://sudha-vatika.netlify.app> with an owner email. The magic link arrives and the dashboard loads with the seeded spaces in the availability grid.
- To test the schema on the Pi, run `DATABASE_URL=<a throwaway local postgres> bash scripts/test-db.sh`. It should print 9 PASS lines. **Never point it at the real database**: it creates test roles and fixtures.
