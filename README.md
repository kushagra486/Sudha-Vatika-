# Banquet Manager

Lead, booking and WhatsApp management for banquet halls and lawns in India. The product name is configurable with `VITE_APP_NAME`.

- **Frontend:** React 18, TypeScript, Vite, Tailwind, TanStack Query (`apps/web`)
- **Backend:** Supabase only: Postgres with Row Level Security, Auth, Storage, and Edge Functions. There is no separate server.
- **Shared:** enums, Zod schemas, and phone, money and date helpers (`packages/shared`)

## Quick start

```bash
npm install
cp .env.example .env      # fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
npm run dev
```

See [docs/RUNBOOK.md](docs/RUNBOOK.md) for local Supabase setup, creating the first owner, and deploying.

## Scripts

| Command           | What it does                                                                             |
| ----------------- | ---------------------------------------------------------------------------------------- |
| `npm run dev`     | Start the web app                                                                        |
| `npm run check`   | Prettier, ESLint, TypeScript and unit tests                                              |
| `npm run test:db` | Apply migrations, seed data and fixtures to a throwaway Postgres, then run the SQL tests |
| `npm run build`   | Production build into `apps/web/dist`                                                    |

## Layout

```
apps/web/            React SPA
packages/shared/     Zod schemas and helpers shared with Edge Functions
supabase/migrations/ SQL migrations, one concern each
supabase/tests/      RLS and constraint tests
supabase/seed.sql    Sudha Vatika venue, spaces, services, packages
docs/                DECISIONS, RUNBOOK, WHATSAPP_TEMPLATES
```

## Conventions

- Every table has `org_id`, and every query goes through RLS. Design choices are recorded in [docs/DECISIONS.md](docs/DECISIONS.md).
- Money is INR in `numeric(12,2)`. Dates are `Asia/Kolkata`. Phone numbers are E.164.
- UI strings live in `apps/web/src/i18n/en.ts`.
