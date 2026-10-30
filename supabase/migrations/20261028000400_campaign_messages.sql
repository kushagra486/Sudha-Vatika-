-- Link sent messages to the campaign that sent them, so a campaign can show
-- progress and never message the same guest twice.

alter table public.campaigns add constraint campaigns_id_org_key unique (id, org_id);

alter table public.messages
  add column campaign_id uuid,
  add constraint messages_campaign_fk foreign key (campaign_id, org_id)
    references public.campaigns(id, org_id) on delete set null (campaign_id);

create unique index messages_campaign_guest_uniq
  on public.messages(campaign_id, guest_id) where campaign_id is not null;

-- Campaign messages have no lead, so the default messages policy (lead-based for
-- sales) already limits them to managers; nothing else to change.
