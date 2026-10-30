-- Sudha Vatika's enquiry channels: mostly phone calls, then WhatsApp, office
-- visits (walk_in), word of mouth and a few from Instagram.

alter type public.lead_source add value if not exists 'instagram';
alter type public.lead_source add value if not exists 'referral';
