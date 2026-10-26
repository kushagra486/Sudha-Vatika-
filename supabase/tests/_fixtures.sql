-- Shared fixtures for the SQL tests, layered on top of seed.sql.
-- Org A is the seeded "Sudha Vatika". Org B is a second tenant used to prove isolation.
--
-- Users (auth.users ids):
--   aaaaaaaa-...-01 owner_a     aaaaaaaa-...-05 ops_a
--   aaaaaaaa-...-02 manager_a   aaaaaaaa-...-06 viewer_a
--   aaaaaaaa-...-03 sales_a1    aaaaaaaa-...-07 inactive sales user in A
--   aaaaaaaa-...-04 sales_a2    bbbbbbbb-...-01 owner_b
--   cccccccc-...-01 signed up, no profile yet

insert into auth.users (id, email) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'owner.a@example.com'),
  ('aaaaaaaa-0000-4000-8000-000000000002', 'manager.a@example.com'),
  ('aaaaaaaa-0000-4000-8000-000000000003', 'sales1.a@example.com'),
  ('aaaaaaaa-0000-4000-8000-000000000004', 'sales2.a@example.com'),
  ('aaaaaaaa-0000-4000-8000-000000000005', 'ops.a@example.com'),
  ('aaaaaaaa-0000-4000-8000-000000000006', 'viewer.a@example.com'),
  ('aaaaaaaa-0000-4000-8000-000000000007', 'inactive.a@example.com'),
  ('bbbbbbbb-0000-4000-8000-000000000001', 'owner.b@example.com'),
  ('cccccccc-0000-4000-8000-000000000001', 'new.user@example.com');

insert into public.profiles (id, org_id, outlet_id, full_name, role, active) values
  ('aaaaaaaa-0000-4000-8000-000000000001', '00000000-0000-4000-a000-000000000001', '00000000-0000-4000-a000-000000000101', 'Owner A',   'owner',   true),
  ('aaaaaaaa-0000-4000-8000-000000000002', '00000000-0000-4000-a000-000000000001', '00000000-0000-4000-a000-000000000101', 'Manager A', 'manager', true),
  ('aaaaaaaa-0000-4000-8000-000000000003', '00000000-0000-4000-a000-000000000001', '00000000-0000-4000-a000-000000000101', 'Sales A1',  'sales',   true),
  ('aaaaaaaa-0000-4000-8000-000000000004', '00000000-0000-4000-a000-000000000001', '00000000-0000-4000-a000-000000000101', 'Sales A2',  'sales',   true),
  ('aaaaaaaa-0000-4000-8000-000000000005', '00000000-0000-4000-a000-000000000001', '00000000-0000-4000-a000-000000000101', 'Ops A',     'ops',     true),
  ('aaaaaaaa-0000-4000-8000-000000000006', '00000000-0000-4000-a000-000000000001', '00000000-0000-4000-a000-000000000101', 'Viewer A',  'viewer',  true),
  ('aaaaaaaa-0000-4000-8000-000000000007', '00000000-0000-4000-a000-000000000001', '00000000-0000-4000-a000-000000000101', 'Former A',  'sales',   false);

-- Org B
insert into public.organizations (id, name) values ('00000000-0000-4000-b000-000000000001', 'Other Venue');
insert into public.outlets (id, org_id, name) values ('00000000-0000-4000-b000-000000000101', '00000000-0000-4000-b000-000000000001', 'B Outlet');
insert into public.units (id, org_id, outlet_id, name) values
  ('00000000-0000-4000-b000-000000000201', '00000000-0000-4000-b000-000000000001', '00000000-0000-4000-b000-000000000101', 'B Hall');
insert into public.profiles (id, org_id, outlet_id, full_name, role) values
  ('bbbbbbbb-0000-4000-8000-000000000001', '00000000-0000-4000-b000-000000000001', '00000000-0000-4000-b000-000000000101', 'Owner B', 'owner');
insert into public.guests (id, org_id, full_name, phone_e164) values
  ('00000000-0000-4000-b000-000000000301', '00000000-0000-4000-b000-000000000001', 'B Guest', '+919000000001');
insert into public.leads (id, org_id, guest_id, source, owner_id) values
  ('00000000-0000-4000-b000-000000000401', '00000000-0000-4000-b000-000000000001', '00000000-0000-4000-b000-000000000301', 'web', 'bbbbbbbb-0000-4000-8000-000000000001');

-- Org A guests, leads, booking, messages
insert into public.guests (id, org_id, full_name, phone_e164) values
  ('00000000-0000-4000-a000-000000000701', '00000000-0000-4000-a000-000000000001', 'Riya Sharma', '+919811111111'),
  ('00000000-0000-4000-a000-000000000702', '00000000-0000-4000-a000-000000000001', 'Aman Gupta',  '+919822222222');

insert into public.leads (id, org_id, outlet_id, guest_id, source, stage, owner_id, event_type, event_date, guest_count) values
  ('00000000-0000-4000-a000-000000000801', '00000000-0000-4000-a000-000000000001', '00000000-0000-4000-a000-000000000101', '00000000-0000-4000-a000-000000000701', 'whatsapp', 'contacted', 'aaaaaaaa-0000-4000-8000-000000000003', 'Wedding',  '2026-12-12', 400),
  ('00000000-0000-4000-a000-000000000802', '00000000-0000-4000-a000-000000000001', '00000000-0000-4000-a000-000000000101', '00000000-0000-4000-a000-000000000702', 'call',     'new',       'aaaaaaaa-0000-4000-8000-000000000004', 'Birthday', '2026-11-20', 80),
  ('00000000-0000-4000-a000-000000000803', '00000000-0000-4000-a000-000000000001', '00000000-0000-4000-a000-000000000101', '00000000-0000-4000-a000-000000000702', 'web',      'new',       null,                                   'Reception', null,        null);

insert into public.bookings (id, org_id, outlet_id, unit_id, lead_id, guest_id, event_type, event_date, shift, guest_count, status, subtotal, discount, tax, created_by) values
  ('00000000-0000-4000-a000-000000000901', '00000000-0000-4000-a000-000000000001', '00000000-0000-4000-a000-000000000101', '00000000-0000-4000-a000-000000000201',
   '00000000-0000-4000-a000-000000000801', '00000000-0000-4000-a000-000000000701', 'Wedding', '2026-12-12', 'dinner', 400, 'confirmed', 300000, 20000, 50400,
   'aaaaaaaa-0000-4000-8000-000000000005');

insert into public.payments (org_id, booking_id, amount, kind, method, recorded_by) values
  ('00000000-0000-4000-a000-000000000001', '00000000-0000-4000-a000-000000000901', 100000, 'advance', 'upi', 'aaaaaaaa-0000-4000-8000-000000000005');

insert into public.messages (id, org_id, guest_id, lead_id, channel, direction, body, status) values
  ('00000000-0000-4000-a000-000000000a01', '00000000-0000-4000-a000-000000000001', '00000000-0000-4000-a000-000000000701', '00000000-0000-4000-a000-000000000801', 'whatsapp', 'in', 'Is 12 Dec available?', 'received'),
  ('00000000-0000-4000-a000-000000000a02', '00000000-0000-4000-a000-000000000001', '00000000-0000-4000-a000-000000000702', '00000000-0000-4000-a000-000000000802', 'whatsapp', 'in', 'Rates for 80 people?', 'received');

insert into public.inbound_events (provider, external_id, payload) values ('whatsapp', 'wamid.TEST1', '{}');
