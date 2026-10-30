-- WhatsApp opt-out (brief 6.7) and messaging constraints.
-- Writes here run as the table owner, the way Edge Functions write with the service role.
begin;

-- An inbound STOP opts the guest out, in any case and with surrounding text.
insert into messages (org_id, guest_id, channel, direction, body, status)
values ('00000000-0000-4000-a000-000000000001', '00000000-0000-4000-a000-000000000701', 'whatsapp', 'in', 'Please Stop sending these', 'received');
select tests.eq(
  (select whatsapp_opt_in from guests where id = '00000000-0000-4000-a000-000000000701'),
  false, 'inbound STOP opts the guest out');
select tests.eq(
  (select whatsapp_opted_out_at is not null from guests where id = '00000000-0000-4000-a000-000000000701'),
  true, 'opt-out time is recorded');

-- Outbound WhatsApp to an opted-out guest is blocked, whoever writes it.
select tests.throws(
  $$insert into messages (org_id, guest_id, channel, direction, body)
    values ('00000000-0000-4000-a000-000000000001', '00000000-0000-4000-a000-000000000701', 'whatsapp', 'out', 'Offer!')$$,
  'P0001', 'outbound WhatsApp to an opted-out guest is blocked');

-- Internal call notes are still allowed.
insert into messages (org_id, guest_id, channel, direction, body)
values ('00000000-0000-4000-a000-000000000001', '00000000-0000-4000-a000-000000000701', 'call_note', 'out', 'Guest asked for no WhatsApp');
select tests.eq(
  (select count(*)::int from messages where guest_id = '00000000-0000-4000-a000-000000000701' and channel = 'call_note'),
  1, 'call notes are unaffected by opt-out');

-- "stop" inside another word does not opt out.
insert into messages (org_id, guest_id, channel, direction, body, status)
values ('00000000-0000-4000-a000-000000000001', '00000000-0000-4000-a000-000000000702', 'whatsapp', 'in', 'Non-stop music till midnight? Unstoppable!', 'received');
select tests.eq(
  (select whatsapp_opt_in from guests where id = '00000000-0000-4000-a000-000000000702'),
  true, '"Non-stop"/"Unstoppable" do not opt out');
insert into messages (org_id, guest_id, channel, direction, body, status)
values ('00000000-0000-4000-a000-000000000001', '00000000-0000-4000-a000-000000000702', 'whatsapp', 'in', 'Need a nonstop DJ', 'received');
select tests.eq(
  (select whatsapp_opt_in from guests where id = '00000000-0000-4000-a000-000000000702'),
  true, '"nonstop" does not opt out');

-- Outbound to an opted-in guest works.
insert into messages (org_id, guest_id, channel, direction, body)
values ('00000000-0000-4000-a000-000000000001', '00000000-0000-4000-a000-000000000702', 'whatsapp', 'out', 'Our rates are attached');
select tests.eq(
  (select count(*)::int from messages where guest_id = '00000000-0000-4000-a000-000000000702' and direction = 'out'),
  1, 'outbound to an opted-in guest is allowed');

-- A bare "STOP." reply opts out too.
insert into messages (org_id, guest_id, channel, direction, body, status)
values ('00000000-0000-4000-a000-000000000001', '00000000-0000-4000-a000-000000000702', 'whatsapp', 'in', 'STOP.', 'received');
select tests.eq(
  (select whatsapp_opt_in from guests where id = '00000000-0000-4000-a000-000000000702'),
  false, 'bare "STOP." opts out');

-- Provider message ids are unique (webhook retries must not duplicate).
select tests.throws(
  $$insert into messages (org_id, channel, direction, provider_message_id) values
      ('00000000-0000-4000-a000-000000000001', 'whatsapp', 'in', 'wamid.X'),
      ('00000000-0000-4000-a000-000000000001', 'whatsapp', 'in', 'wamid.X')$$,
  '23505', 'provider_message_id is unique');

-- inbound_events dedupes on (provider, external_id).
select tests.throws(
  $$insert into inbound_events (provider, external_id, payload) values ('whatsapp', 'wamid.TEST1', '{}')$$,
  '23505', 'inbound_events dedupes webhook deliveries');

-- Template names follow Meta's rules.
select tests.throws(
  $$insert into message_templates (org_id, name, category, body)
    values ('00000000-0000-4000-a000-000000000001', 'Booking Confirmed!', 'utility', 'x')$$,
  '23514', 'template names must be lowercase with underscores');

-- Deleting a lead keeps its chat history but detaches it.
delete from leads where id = '00000000-0000-4000-a000-000000000802';
select tests.eq(
  (select lead_id from messages where id = '00000000-0000-4000-a000-000000000a02'),
  null::uuid, 'messages survive lead deletion with lead_id cleared');
select tests.eq(
  (select org_id from messages where id = '00000000-0000-4000-a000-000000000a02'),
  '00000000-0000-4000-a000-000000000001'::uuid, 'org_id is kept when lead_id is cleared');

rollback;
