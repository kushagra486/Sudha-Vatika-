-- Starting data for Sudha Vatika: the venue, its spaces, services and packages.
-- Service and package prices are placeholders until the venue confirms them.
-- Fixed ids make the seed idempotent and easy to reference in tests and docs.
-- Users are not seeded; see docs/RUNBOOK.md for linking your login to this org.

insert into public.organizations (id, name, tax_percent)
values ('00000000-0000-4000-a000-000000000001', 'Sudha Vatika', 18.00)
on conflict (id) do nothing;

insert into public.outlets (id, org_id, name)
values ('00000000-0000-4000-a000-000000000101', '00000000-0000-4000-a000-000000000001', 'Sudha Vatika')
on conflict (id) do nothing;

-- Bookable spaces. floating_capacity is the most guests the space takes.
-- Parking (200 bikes, 50+ cars), office and reception are facilities, not units.
insert into public.units (id, org_id, outlet_id, name, kind, floating_capacity, quantity, upcoming, description) values
  ('00000000-0000-4000-a000-000000000201', '00000000-0000-4000-a000-000000000001', '00000000-0000-4000-a000-000000000101', 'Ashoka Hall',                'hall',       300,  1, false, 'Banquet hall'),
  ('00000000-0000-4000-a000-000000000202', '00000000-0000-4000-a000-000000000001', '00000000-0000-4000-a000-000000000101', 'Lawn',                       'lawn',       null, 1, false, null),
  ('00000000-0000-4000-a000-000000000203', '00000000-0000-4000-a000-000000000001', '00000000-0000-4000-a000-000000000101', 'Meeting & Conference Hall',  'hall',       200,  1, false, null),
  ('00000000-0000-4000-a000-000000000204', '00000000-0000-4000-a000-000000000001', '00000000-0000-4000-a000-000000000101', 'Pandaal',                    'pandaal',    1500, 1, false, 'Wedding pandaal, 1,200 to 1,500 guests'),
  ('00000000-0000-4000-a000-000000000205', '00000000-0000-4000-a000-000000000001', '00000000-0000-4000-a000-000000000101', 'Poolside Hall',              'hall',       200,  1, true,  'Hall with pool'),
  ('00000000-0000-4000-a000-000000000206', '00000000-0000-4000-a000-000000000001', '00000000-0000-4000-a000-000000000101', 'Pool',                       'pool',       null, 1, true,  'Pool for functions'),
  ('00000000-0000-4000-a000-000000000207', '00000000-0000-4000-a000-000000000001', '00000000-0000-4000-a000-000000000101', 'Restaurant',                 'restaurant', 50,   1, true,  null),
  ('00000000-0000-4000-a000-000000000208', '00000000-0000-4000-a000-000000000001', '00000000-0000-4000-a000-000000000101', 'Dormitory',                  'dormitory',  50,   6, false, '6 rooms, 50 beds in total'),
  ('00000000-0000-4000-a000-000000000209', '00000000-0000-4000-a000-000000000001', '00000000-0000-4000-a000-000000000101', 'Hotel rooms',                'room',       null, 8, false, '15 rooms planned; 8 open now, 7 upcoming')
on conflict (id) do nothing;

insert into public.service_categories (id, org_id, name) values
  ('00000000-0000-4000-a000-000000000301', '00000000-0000-4000-a000-000000000001', 'Catering'),
  ('00000000-0000-4000-a000-000000000302', '00000000-0000-4000-a000-000000000001', 'Decor'),
  ('00000000-0000-4000-a000-000000000303', '00000000-0000-4000-a000-000000000001', 'Entertainment'),
  ('00000000-0000-4000-a000-000000000304', '00000000-0000-4000-a000-000000000001', 'Photography')
on conflict (id) do nothing;

insert into public.services (id, org_id, category_id, name, description, base_price, pricing_unit) values
  ('00000000-0000-4000-a000-000000000401', '00000000-0000-4000-a000-000000000001', '00000000-0000-4000-a000-000000000301', 'Veg buffet',          '4 starters, 6 mains, 3 desserts',   850.00,  'per_guest'),
  ('00000000-0000-4000-a000-000000000402', '00000000-0000-4000-a000-000000000001', '00000000-0000-4000-a000-000000000301', 'Non-veg buffet',      '5 starters, 7 mains, 3 desserts',  1150.00,  'per_guest'),
  ('00000000-0000-4000-a000-000000000403', '00000000-0000-4000-a000-000000000001', '00000000-0000-4000-a000-000000000302', 'Floral stage decor',  'Fresh flowers, stage and entry',  45000.00, 'fixed'),
  ('00000000-0000-4000-a000-000000000404', '00000000-0000-4000-a000-000000000001', '00000000-0000-4000-a000-000000000302', 'Mandap setup',        'Traditional mandap with lighting', 35000.00, 'fixed'),
  ('00000000-0000-4000-a000-000000000405', '00000000-0000-4000-a000-000000000001', '00000000-0000-4000-a000-000000000303', 'DJ and sound',        '6 hours, 2 speakers, lights',     25000.00, 'fixed'),
  ('00000000-0000-4000-a000-000000000406', '00000000-0000-4000-a000-000000000001', '00000000-0000-4000-a000-000000000304', 'Photo and video',     'One photographer, one videographer', 60000.00, 'per_day'),
  ('00000000-0000-4000-a000-000000000407', '00000000-0000-4000-a000-000000000001', '00000000-0000-4000-a000-000000000302', 'Varmala stage',       'Varmala area setup for weddings',  15000.00, 'fixed')
on conflict (id) do nothing;

insert into public.packages (id, org_id, name, description, price, guest_min, guest_max) values
  ('00000000-0000-4000-a000-000000000501', '00000000-0000-4000-a000-000000000001', 'Silver Wedding', 'Veg buffet, floral decor, DJ',                    250000.00, 100, 300),
  ('00000000-0000-4000-a000-000000000502', '00000000-0000-4000-a000-000000000001', 'Gold Wedding',   'Non-veg buffet, mandap, decor, DJ, photo and video', 550000.00, 200, 500)
on conflict (id) do nothing;

insert into public.package_services (org_id, package_id, service_id, quantity) values
  ('00000000-0000-4000-a000-000000000001', '00000000-0000-4000-a000-000000000501', '00000000-0000-4000-a000-000000000401', 1),
  ('00000000-0000-4000-a000-000000000001', '00000000-0000-4000-a000-000000000501', '00000000-0000-4000-a000-000000000403', 1),
  ('00000000-0000-4000-a000-000000000001', '00000000-0000-4000-a000-000000000501', '00000000-0000-4000-a000-000000000405', 1),
  ('00000000-0000-4000-a000-000000000001', '00000000-0000-4000-a000-000000000502', '00000000-0000-4000-a000-000000000402', 1),
  ('00000000-0000-4000-a000-000000000001', '00000000-0000-4000-a000-000000000502', '00000000-0000-4000-a000-000000000403', 1),
  ('00000000-0000-4000-a000-000000000001', '00000000-0000-4000-a000-000000000502', '00000000-0000-4000-a000-000000000404', 1),
  ('00000000-0000-4000-a000-000000000001', '00000000-0000-4000-a000-000000000502', '00000000-0000-4000-a000-000000000405', 1),
  ('00000000-0000-4000-a000-000000000001', '00000000-0000-4000-a000-000000000502', '00000000-0000-4000-a000-000000000406', 1)
on conflict do nothing;

insert into public.message_templates (id, org_id, name, language, category, body, variables) values
  ('00000000-0000-4000-a000-000000000601', '00000000-0000-4000-a000-000000000001', 'enquiry_thanks', 'en', 'utility',
   'Hi {{1}}, thank you for your enquiry about {{2}} on {{3}}. Our team will call you shortly.',
   '["guest.full_name", "lead.event_type", "lead.event_date"]'),
  ('00000000-0000-4000-a000-000000000602', '00000000-0000-4000-a000-000000000001', 'booking_confirmed', 'en', 'utility',
   'Hi {{1}}, your booking at {{2}} on {{3}} is confirmed. Booking total: {{4}}.',
   '["guest.full_name", "unit.name", "booking.event_date", "booking.total"]')
on conflict (id) do nothing;
