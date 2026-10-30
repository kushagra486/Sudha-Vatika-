-- A guest's WhatsApp number when it differs from the phone they call on.
-- Filled from the website enquiry form; the dashboard's WhatsApp buttons use it
-- when present and fall back to the phone number otherwise.
alter table public.guests
  add column whatsapp_e164 text
  check (whatsapp_e164 is null or whatsapp_e164 ~ '^\+[1-9][0-9]{7,14}$');
