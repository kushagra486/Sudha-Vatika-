# Decisions

Choices not covered by the brief, or where the brief's sketch was changed. Newest at the bottom.

## Phase 0: foundation

### D1. Repository root is the project root

The brief shows a `banquet-manager/` top folder. This repository _is_ the project, so `apps/`, `packages/`, `supabase/` and `docs/` sit at the root.

### D2. npm workspaces, no Turborepo or pnpm

Two workspaces (`apps/web`, `packages/shared`) don't need a build orchestrator. npm ships with Node, so there is nothing extra to install.

### D3. Shared package uses `.ts` import extensions

`packages/shared` imports its own files as `./enums.ts`. This lets Supabase Edge Functions (Deno) import the same Zod schemas without a build step. TypeScript allows it via `allowImportingTsExtensions`.

### D4. `org_id` added to `units`, `booking_items` and `package_services`

The brief's sketch leaves these three tables without `org_id`, but section 0 says every table has one. With the column in place, RLS is a plain `org_id` check rather than a join to the parent table.

Exception: `inbound_events` has no `org_id`. Webhooks write it before the organization is known. Authenticated users have no access to it at all; only the service role does.

### D5. Composite `(id, org_id)` foreign keys

Every reference between tenant tables is a composite key, for example `leads (guest_id, org_id) → guests (id, org_id)`. RLS alone doesn't stop a write from _pointing at_ another org's row, because foreign key checks bypass RLS. A service-role function with a bug could link org A's lead to org B's guest. The composite key makes that impossible in the schema.

Nullable references use `ON DELETE SET NULL (column)`, which needs Postgres 15 or later (Supabase is on 15 or 17). This clears the reference without clearing `org_id`.

### D6. Booking overlap uses an exclusion constraint, with a trigger in front

Brief 6.7 asks for a trigger. A trigger check alone has a race: two staff booking the same hall at the same moment can both pass the check before either commits.

How it works:

- Each shift maps to a range of meal slots via `app.shift_slots`. `full_day` covers all four slots; each other shift covers one.
- `bookings.slots` is a generated column holding that range.
- An exclusion constraint forbids two live bookings (`tentative` or `confirmed`) on the same unit and date whose slots overlap. This is race-safe.
- The trigger the brief asked for still runs first and raises a readable error (`Unit is already booked on …`). Both raise SQLSTATE `23P01`, so the app handles one error code.

The brief's partial unique index on `(unit_id, event_date, shift)` is replaced by the constraint, which is strictly stronger.

`bookings.unit_id` also references `units (id, outlet_id)`, so a booking's unit must belong to its outlet.

### D7. Role permissions per table

Brief section 4 defines each role at module level. The table-level reading:

| Area                                             | Read                                                                | Write                                                                                    |
| ------------------------------------------------ | ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Organization settings, outlets, users (profiles) | everyone in the org                                                 | owner only                                                                               |
| Units, services, categories, packages, media     | everyone                                                            | owner, manager, ops                                                                      |
| Guests                                           | everyone (ops needs them for bookings)                              | owner, manager, sales, ops; delete: manager or owner                                     |
| Leads                                            | owner, manager, viewer: all leads; sales: leads they own; ops: none | manager or owner: any lead; sales: own leads only, and cannot reassign them              |
| Bookings                                         | everyone (needed to check availability)                             | owner, manager, ops: any booking; sales: bookings they created; delete: manager or owner |
| Booking items                                    | everyone                                                            | same as the parent booking                                                               |
| Payments                                         | owner, manager, ops, viewer                                         | record: owner, manager, ops; edit or delete: manager or owner                            |
| Messages, call logs, upsell                      | manager or owner: all; sales: rows on leads they can see            | same as read; WhatsApp sends go through Edge Functions                                   |
| Templates                                        | owner, manager, sales                                               | manager or owner                                                                         |
| Campaigns, automation jobs                       | manager or owner                                                    | manager or owner                                                                         |
| Audit log                                        | manager or owner                                                    | nobody (written by triggers only)                                                        |

Unassigned leads (`owner_id` null, for example from an inbound WhatsApp message) are visible only to managers until someone assigns them. Auto-assignment will come with lead intake.

`leads.owner_id`, `bookings.created_by`, `payments.recorded_by` and every `org_id` default to the caller, so the client rarely needs to send them.

### D8. Auth helpers in a private `app` schema

`app.current_org_id()`, `app.user_role()`, `app.has_role(...)` and `app.is_manager()` are `SECURITY DEFINER`, so policies on `profiles` don't recurse. They live in a schema PostgREST doesn't expose. An inactive profile resolves to no org and no role, which denies everything.

Policies call them as `(select app.current_org_id())` so Postgres evaluates them once per query rather than once per row.

### D9. WhatsApp opt-out enforced in the database

A trigger on `messages` applies brief 6.7 for every writer, not only the `send-whatsapp` function:

- An inbound WhatsApp message containing the standalone word **stop**, in any case, opts the guest out. "STOP", "Stop." and "please stop messaging" all count. Words joined to letters, digits or hyphens don't, so "non-stop" and "unstoppable" stay opted in.
- Any outbound WhatsApp insert to an opted-out guest raises an error with hint `whatsapp_opted_out`.
- Call notes and SMS rows are not affected.

A false positive (for example "don't stop the music") opts the guest out. That is the safe direction; staff can re-enable opt-in when the guest asks.

### D10. Audit log stores diffs

Updates store only the changed columns as `{"column": {"old": …, "new": …}}`. Inserts and deletes store the full row. Updates that change nothing (or only `updated_at`) write no audit row. `actor_id` is null for service-role writes.

### D11. Closed signup; first-run RPC

Staff accounts are invited by the owner (Supabase dashboard now; an in-app invite later), and the login page sets `shouldCreateUser: false`. `public.create_organization(org_name, outlet_name, owner_full_name)` turns a signed-in user with no profile into the owner of a new org and its first outlet. It refuses if the caller already has a profile.

### D12. `booking_balances` view

`paid` and `balance` per booking, with refunds subtracted. It is `security_invoker`, so the caller's RLS on payments applies: sales users see `paid = 0`, because they can't see payments.

### D13. SQL tests run on plain Postgres

pgTAP isn't available everywhere. `scripts/test-db.sh` loads a small stand-in for Supabase's `auth` schema and roles (`supabase/tests/_bootstrap.sql`), applies every migration, the seed and the fixtures, then runs `supabase/tests/NN_*.sql`. Each test file runs in a transaction that rolls back.

Locally the script starts a throwaway cluster; CI uses a `postgres:15` service. The storage migration is skipped when there is no `storage` schema. That part is only exercised on a real Supabase stack.

### D14. Feature modules start as placeholders

Each nav item routes to a placeholder page until its phase lands, and module folders under `src/features/` are created with their phase. Nav visibility mirrors D7, but it's a convenience only: RLS is the real gate.

### D15. Feature flags come from env

`config.ts` reads `VITE_FEATURE_WHATSAPP`, `VITE_FEATURE_AI_EXTRACTION`, `VITE_FEATURE_CALL_CAPTURE` and `VITE_FEATURE_PAYMENT_GATEWAY`, all off by default. This lets a deployment switch features on without a code change.

## Venue setup (Sudha Vatika)

### D16. Space types and upcoming spaces

The venue is moving to a resort format, so `unit_kind` gains `pandaal`, `pool`, `restaurant` and `dormitory` alongside `hall`, `lawn`, `room` and `other`.

`units.upcoming` marks spaces still being built (Poolside Hall, Pool, Restaurant). They show in lists and quotes with a flag, and bookings are not blocked, so dates can be pre-sold.

The pandaal (a fixed, waterproof, all-weather structure with an asbestos-sheet roof, 1,200 to 1,500 guests) and the lawn (open, up to 300 guests) are separate spaces: booking one never blocks the other.

Parking, office and reception are facilities, not bookable units. The varmala area is a wedding add-on service, not a separate space.

### D17. Rooms and dormitory are blocks, not single spaces

`units.quantity` records how many identical rooms a row stands for: Hotel rooms = 8 (15 planned), Dormitory = 6 rooms with 50 beds.

The event booking model (one booking per space per shift) doesn't fit overnight stays, where several rooms are sold per night. Room and dormitory bookings will get their own per-night model in a later phase. Until then, event bookings should not use these units.

### D18. Two owners, no other roles yet

The business is run by two people who both handle all leads and tasks. Both get the `owner` role, which sees every lead, including unassigned ones. The other roles stay in place for when staff join.

### D19. Lead sources match how enquiries arrive

Most enquiries come by phone, some by WhatsApp, a few from Instagram, and the rest by word of mouth or office visits. `lead_source` gains `instagram` and `referral`. Office visits use `walk_in`, labelled "Office visit" in the UI. Because phone is the main channel, adding a lead must be a fast, phone-first form.

### D20. GST is optional per booking

Some customers are billed with GST and some without. `bookings.tax` is entered per booking: 0 means no GST. `organizations.tax_percent` (18%) is only the rate the UI offers when GST is switched on. How non-GST billing is handled will be decided later; nothing in the schema assumes GST.

### D21. Minimum advance before confirming

Sudha Vatika takes at least ₹21,000 on every booking. `organizations.min_advance` holds the amount, and a trigger blocks a booking from becoming `confirmed` until the net amount received (refunds subtracted) reaches it. When a booking's total is below the minimum, the full total is required instead.

Tentative bookings (date holds) need no advance, and a confirmed booking can still be edited. The check counts payments even when the caller can't see them (sales).

The trigger derives the total from `subtotal - discount + tax`, because generated columns are computed after BEFORE triggers run.

### D22. Prices start at zero

Prices, terms and conditions vary by booking, and the owners will enter them in the app. The seed keeps the service and package names but sets every price to ₹0, so no invented figure can reach a quote.

## Lead management

### D23. Enquiries are captured in one database call

`public.create_enquiry(...)` finds the guest by phone (or creates them), opens a lead owned by the caller, and saves the first call note, all in one transaction. On a patchy mobile connection, separate requests could leave a guest with no lead.

The function runs with the caller's permissions (`SECURITY INVOKER`), so RLS applies to every insert. An existing guest's name is kept; a missing name is filled in.

### D24. Leads screen behaviour

- The list defaults to open leads. They are sorted by next follow-up (earliest first, unset last), then newest.
- Follow-ups are marked overdue or due today by India date.
- Search matches name, or phone digits when at least 3 digits are typed. Characters that mean something in PostgREST filters are stripped from the search text.
- Marking a lead lost asks for a reason (common reasons are suggested) and clears its follow-up.
- The WhatsApp button is hidden for guests who have opted out.
- The availability panel lists event spaces only (rooms and dormitory are excluded, see D17) and flags upcoming spaces.
- Notes added on a lead are stored as `messages` with `channel = 'call_note'`.

## Dashboard

### D25. Dashboard numbers come from one database call

`public.dashboard_summary(p_today)` returns every headline figure as one JSON object: open leads by stage, overdue and due-today follow-ups, new enquiries, WhatsApp chats waiting on a reply, events in the next 7 days, money collected this month, money still owed on upcoming bookings, and lead sources over 30 days. The dashboard opens with one request.

It runs with the caller's permissions (`SECURITY INVOKER`), so every count obeys RLS. Sales users see only their own leads and get zero for the money figures, which the UI hides for them. "Today" is the India date; the parameter exists so tests can fix the date.

The lists (follow-ups due, upcoming events, payments due, the availability grid) are separate queries, so each card loads and retries on its own. All of them refresh every 5 minutes and when the window regains focus, so a screen left open at reception stays current.

### D26. Dashboard design

- **Look:** the existing warm theme. The design skill suggested a dark "liquid glass" style, which is meant for marketing pages and costs performance and contrast on mid-range phones.
- **Stat tiles:** large numbers with fixed-width digits, linking to the page behind each number. Overdue follow-ups get a red border and a waiting WhatsApp reply an amber one, each with its icon, so colour is never the only signal.
- **Pipeline and lead sources:** plain single-colour horizontal bars with the value written on every row. They are built from HTML rather than Recharts, which is too heavy for so few rows. No pie charts.
- **Availability grid:**
  - 14 days × event spaces; every cell carries a letter (B, L, T, D, F) as well as a colour, with a legend and screen-reader text.
  - On phones the grid scrolls sideways inside its card, with the space names pinned on the left; the page itself never scrolls sideways.
  - The scroll box is `position: relative` so the screen-reader labels don't widen the page.
- **Grid layout:** grid items get `min-w-0`; without it, long rows push cards past 360px.

### D27. Password sign-in alongside magic links

Magic links stay the default, but the sign-in page can switch to email and password. This lets the owners test with a demo account before SMTP is configured on the Pi, and keeps people able to sign in if email delivery fails. Signup stays closed: password accounts are created on the Pi with the admin API, never from the app. Sign-in errors are mapped to plain messages (`app/loginErrors.ts`), and the server's own text is never shown.

The demo account `demo@example.com` has the `owner` role in the Sudha Vatika venue. Delete it, or change its password, before real customer data goes in.

## Bookings and payments

### D28. Bookings are created through `create_booking`

`public.create_booking(...)` does everything in one transaction. It uses the lead's guest (or finds or creates one by phone), takes the outlet from the space, and inserts a **tentative** booking. It runs with the caller's permissions, so RLS, the overlap rule and the advance rule all apply as usual.

Confirming a booking marks its lead `booked` and clears the follow-up. That trigger runs with the definer's permissions, because ops staff confirm bookings but can't edit leads.

The test fixture booking is no longer linked to a lead. Otherwise confirming it would mark the fixture lead booked and change the expected counts in other test files.

### D29. Booking screens

- **List:** filters for Upcoming, Tentative, Past and Cancelled.
- **Booking page:**
  - shows the money breakdown, what's been received and the balance
  - shows advance progress ("₹11,000 of ₹21,000 received"), and Confirm stays disabled until the advance is in
  - records payments, including refunds
  - lets you edit the space, date, shift, guests and price
  - can be cancelled (after a second confirmation), or marked completed once the event date arrives
- **Who sees what:** payments and money are hidden from sales users. They can still press Confirm, and the database checks the advance.
- **GST when editing:** the stored GST is kept when the price doesn't change, so changing the rate in settings never quietly rewrites an old booking.

### D30. Dashboard links

- **Tiles open filtered lists:** "Overdue follow-ups" opens `/leads?view=due` and "New enquiries" opens `/leads?view=new`. Both use India-date boundaries.
- **Availability grid:**
  - a full cell opens its booking
  - a free or partly booked cell starts a new booking with the space, date and first open shift filled in
  - back and next buttons page through 14 days at a time
- **Clickable rows:** rows under "Upcoming events" and "Payments due" open their booking.
- **WhatsApp tile:** while `VITE_FEATURE_WHATSAPP` is off, it's replaced by an "Open leads" tile, because its count would always be 0.
