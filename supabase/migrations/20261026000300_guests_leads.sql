-- Guests (people, keyed by phone) and leads (enquiries from those people).

create table public.guests (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  full_name text,
  phone_e164 text not null check (phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  email text,
  whatsapp_opt_in boolean not null default true,
  whatsapp_opted_out_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  unique (org_id, phone_e164),
  unique (id, org_id)
);

create type public.lead_source as enum ('call','whatsapp','web','walk_in','manual');
create type public.lead_stage as enum ('new','contacted','follow_up','proposal_sent','booked','lost');

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  outlet_id uuid,
  guest_id uuid not null,
  source public.lead_source not null,
  stage public.lead_stage not null default 'new',
  owner_id uuid,
  event_type text,
  event_date date,
  guest_count int check (guest_count >= 0),
  budget_min numeric(12,2) check (budget_min >= 0),
  budget_max numeric(12,2) check (budget_max >= 0),
  preferred_unit_id uuid,
  interested_services text[] not null default '{}',
  extracted jsonb not null default '{}',   -- raw AI/rule output, kept for audit
  next_follow_up_at timestamptz,
  lost_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, org_id),
  check (budget_min is null or budget_max is null or budget_min <= budget_max),
  -- Composite keys keep every reference inside the same organization.
  foreign key (outlet_id, org_id) references public.outlets(id, org_id),
  foreign key (guest_id, org_id) references public.guests(id, org_id),
  foreign key (owner_id, org_id) references public.profiles(id, org_id),
  foreign key (preferred_unit_id, org_id) references public.units(id, org_id)
);
create index leads_org_stage_idx on public.leads(org_id, stage);
create index leads_owner_idx on public.leads(owner_id);
create index leads_guest_idx on public.leads(guest_id);
create index leads_event_date_idx on public.leads(org_id, event_date);
create index leads_follow_up_idx on public.leads(next_follow_up_at)
  where stage in ('new','contacted','follow_up','proposal_sent');

create trigger leads_touch_updated_at
  before update on public.leads
  for each row execute function app.touch_updated_at();
