-- Messaging (WhatsApp/SMS/call notes), call logs, campaigns, automation and upsell.

create type public.message_direction as enum ('in','out');

create table public.message_templates (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (name ~ '^[a-z0-9_]+$'),  -- must match Meta template name exactly
  language text not null default 'en',
  category text not null check (category in ('marketing','utility','authentication')),
  body text not null,                       -- with {{1}}, {{2}} placeholders
  variables jsonb not null default '[]' check (jsonb_typeof(variables) = 'array'),
  header_media_asset_id uuid,
  meta_status text not null default 'draft' check (meta_status in ('draft','pending','approved','rejected')),
  unique (org_id, name, language),
  unique (id, org_id),
  foreign key (header_media_asset_id, org_id) references public.media_assets(id, org_id)
    on delete set null (header_media_asset_id)
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  guest_id uuid,
  lead_id uuid,
  channel text not null check (channel in ('whatsapp','sms','call_note')),
  direction public.message_direction not null,
  body text,
  template_id uuid,
  media_asset_id uuid,
  provider_message_id text unique,
  status text not null default 'queued' check (status in ('queued','sent','delivered','read','failed','received')),
  error text,
  sent_by uuid,
  created_at timestamptz not null default now(),
  foreign key (guest_id, org_id) references public.guests(id, org_id),
  foreign key (lead_id, org_id) references public.leads(id, org_id) on delete set null (lead_id),
  foreign key (template_id, org_id) references public.message_templates(id, org_id),
  foreign key (media_asset_id, org_id) references public.media_assets(id, org_id),
  foreign key (sent_by, org_id) references public.profiles(id, org_id)
);
create index messages_lead_idx on public.messages(lead_id, created_at);
create index messages_guest_idx on public.messages(guest_id, created_at);
create index messages_org_created_idx on public.messages(org_id, created_at desc);

-- Opt-out rules (brief 6.7). Enforced here so every writer obeys them, not only
-- the send-whatsapp function.
create or replace function app.enforce_whatsapp_opt_out()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.channel <> 'whatsapp' or new.guest_id is null then
    return new;
  end if;

  -- "stop" as a standalone word opts out ("STOP", "Please stop messaging").
  -- Hyphen and alphanumeric neighbours don't count, so "non-stop" and
  -- "unstoppable" stay opted in.
  if new.direction = 'in'
     and new.body ~* '(^|[^[:alnum:]_-])stop($|[^[:alnum:]_-])' then
    update public.guests
       set whatsapp_opt_in = false,
           whatsapp_opted_out_at = coalesce(whatsapp_opted_out_at, now())
     where id = new.guest_id;
  elsif new.direction = 'out' and exists (
    select 1 from public.guests g where g.id = new.guest_id and not g.whatsapp_opt_in
  ) then
    raise exception 'Guest % has opted out of WhatsApp messages', new.guest_id
      using errcode = 'P0001', hint = 'whatsapp_opted_out';
  end if;

  return new;
end;
$$;

create trigger messages_enforce_opt_out
  before insert on public.messages
  for each row execute function app.enforce_whatsapp_opt_out();

-- Idempotency log for every inbound webhook. Written by Edge Functions with the
-- service role before the org is known, so it has no org_id and no user policies.
create table public.inbound_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,                   -- whatsapp | call_provider
  external_id text not null,                -- Meta message id or call id
  payload jsonb not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  error text,
  unique (provider, external_id)
);

create table public.call_logs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  provider text not null,
  provider_call_id text not null,
  direction text check (direction in ('inbound','outbound')),
  caller_phone_e164 text check (caller_phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  guest_id uuid,
  lead_id uuid,
  started_at timestamptz,
  duration_sec int check (duration_sec >= 0),
  recording_url text,
  transcript text,
  ai_summary text,
  raw jsonb,
  created_at timestamptz not null default now(),
  unique (provider, provider_call_id),
  foreign key (guest_id, org_id) references public.guests(id, org_id),
  foreign key (lead_id, org_id) references public.leads(id, org_id) on delete set null (lead_id)
);
create index call_logs_lead_idx on public.call_logs(lead_id);

create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  template_id uuid,
  audience jsonb not null default '{}',     -- filter: stage, event_type, last_contact_before
  status text not null default 'draft' check (status in ('draft','ready','running','done','cancelled')),
  scheduled_for timestamptz,
  created_by uuid,
  created_at timestamptz not null default now(),
  foreign key (template_id, org_id) references public.message_templates(id, org_id),
  foreign key (created_by, org_id) references public.profiles(id, org_id)
);

create table public.automation_jobs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  kind text not null check (kind in ('send_template','send_media','follow_up_reminder','campaign_send')),
  lead_id uuid,
  payload jsonb not null default '{}',
  run_at timestamptz not null default now(),
  status text not null default 'pending' check (status in ('pending','running','done','failed','cancelled')),
  attempts int not null default 0 check (attempts >= 0),
  last_error text,
  foreign key (lead_id, org_id) references public.leads(id, org_id) on delete cascade
);
create index automation_jobs_due_idx on public.automation_jobs(run_at) where status = 'pending';
create index automation_jobs_lead_idx on public.automation_jobs(lead_id);

create table public.upsell_suggestions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  lead_id uuid not null,
  service_id uuid,
  package_id uuid,
  reason text,
  status text not null default 'suggested' check (status in ('suggested','sent','accepted','declined')),
  created_at timestamptz not null default now(),
  check (service_id is not null or package_id is not null),
  foreign key (lead_id, org_id) references public.leads(id, org_id) on delete cascade,
  foreign key (service_id, org_id) references public.services(id, org_id) on delete cascade,
  foreign key (package_id, org_id) references public.packages(id, org_id) on delete cascade
);
create index upsell_suggestions_lead_idx on public.upsell_suggestions(lead_id);

create table public.audit_log (
  id bigint generated always as identity primary key,
  org_id uuid not null,
  actor_id uuid,
  action text not null,
  entity text not null,
  entity_id uuid,
  diff jsonb,
  created_at timestamptz not null default now()
);
create index audit_log_org_created_idx on public.audit_log(org_id, created_at desc);
create index audit_log_entity_idx on public.audit_log(entity, entity_id);
