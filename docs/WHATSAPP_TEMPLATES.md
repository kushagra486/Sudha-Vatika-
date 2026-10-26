# WhatsApp templates

Business-initiated WhatsApp messages (anything sent more than 24 hours after the guest's last message) must use a template that Meta has approved. Each row in `message_templates` mirrors one Meta template:

- `name` and `language` must match Meta exactly. Names use lowercase letters, digits and underscores; the database enforces this.
- `body` uses Meta's numbered placeholders: `{{1}}`, `{{2}}`, …
- `variables` is a JSON array that maps each placeholder, in order, to a field. For example `["guest.full_name", "lead.event_date"]` means `{{1}}` is the guest's name and `{{2}}` is the lead's event date.
- `meta_status` tracks review: `draft` → `pending` → `approved` or `rejected`. Only `approved` templates can be sent.

## Seeded templates (demo org)

| Name                | Category | Body                                                                                       | Variables                                                     |
| ------------------- | -------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------- |
| `enquiry_thanks`    | utility  | Hi {{1}}, thank you for your enquiry about {{2}} on {{3}}. Our team will call you shortly. | guest.full_name, lead.event_type, lead.event_date             |
| `booking_confirmed` | utility  | Hi {{1}}, your booking at {{2}} on {{3}} is confirmed. Booking total: {{4}}.               | guest.full_name, unit.name, booking.event_date, booking.total |

Before sending, submit each template in WhatsApp Manager with the same name, language and body.

## Category notes

- **utility**: confirmations, reminders, payment receipts. Cheaper, and approved quickly when the wording is plainly transactional.
- **marketing**: offers, campaigns, upsell. Guests can block these, and Meta limits how often they are delivered.
- Every outbound send is blocked for guests who replied STOP (see DECISIONS D9).
