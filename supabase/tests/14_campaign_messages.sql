-- Campaign messages: linked to the campaign, one per guest.
begin;

select tests.login('aaaaaaaa-0000-4000-8000-000000000002');  -- manager
insert into message_templates (id, name, category, body)
values ('00000000-0000-4000-a000-00000000aa01', 'diwali_offer', 'marketing', 'Hi {{1}}, Diwali offer!');
insert into campaigns (id, name, template_id)
values ('00000000-0000-4000-a000-00000000ab01', 'Diwali', '00000000-0000-4000-a000-00000000aa01');

insert into messages (guest_id, channel, direction, body, status, campaign_id, template_id)
values ('00000000-0000-4000-a000-000000000701', 'whatsapp', 'out', 'Hi Riya, Diwali offer!', 'sent',
        '00000000-0000-4000-a000-00000000ab01', '00000000-0000-4000-a000-00000000aa01');
select tests.eq(
  (select count(*)::int from messages where campaign_id = '00000000-0000-4000-a000-00000000ab01'), 1, 'campaign message logged');

select tests.throws($$
  insert into messages (guest_id, channel, direction, body, status, campaign_id)
  values ('00000000-0000-4000-a000-000000000701', 'whatsapp', 'out', 'again', 'sent', '00000000-0000-4000-a000-00000000ab01')
$$, '23505', 'a guest gets each campaign once');

-- Opted-out guests are still refused.
update guests set whatsapp_opt_in = false where id = '00000000-0000-4000-a000-000000000702';
select tests.throws($$
  insert into messages (guest_id, channel, direction, body, status, campaign_id)
  values ('00000000-0000-4000-a000-000000000702', 'whatsapp', 'out', 'x', 'sent', '00000000-0000-4000-a000-00000000ab01')
$$, 'P0001', 'campaign respects opt-out');
select tests.logout();

-- Sales cannot see campaigns or their messages.
select tests.login('aaaaaaaa-0000-4000-8000-000000000003');
select tests.eq((select count(*)::int from campaigns), 0, 'sales sees no campaigns');
select tests.eq(
  (select count(*)::int from messages where campaign_id is not null), 0, 'sales sees no campaign messages');
select tests.logout();

rollback;
