-- Sellable catalogue: services, packages of services, and media used in WhatsApp.

create table public.service_categories (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  active boolean not null default true,
  unique (org_id, name),
  unique (id, org_id)
);

create type public.pricing_unit as enum ('fixed','per_guest','per_day');

create table public.services (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  category_id uuid,
  name text not null check (length(trim(name)) > 0),
  description text,
  base_price numeric(12,2) not null default 0 check (base_price >= 0),
  pricing_unit public.pricing_unit not null default 'fixed',
  active boolean not null default true,
  unique (id, org_id),
  foreign key (category_id, org_id) references public.service_categories(id, org_id)
);
create index services_org_idx on public.services(org_id);

create table public.packages (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  description text,
  price numeric(12,2) not null default 0 check (price >= 0),
  guest_min int check (guest_min >= 0),
  guest_max int check (guest_max >= 0),
  active boolean not null default true,
  unique (id, org_id),
  check (guest_min is null or guest_max is null or guest_min <= guest_max)
);
create index packages_org_idx on public.packages(org_id);

create table public.package_services (
  -- Not in the brief's sketch; added so RLS is a plain org_id check.
  org_id uuid not null references public.organizations(id) on delete cascade,
  package_id uuid not null,
  service_id uuid not null,
  quantity int not null default 1 check (quantity > 0),
  primary key (package_id, service_id),
  foreign key (package_id, org_id) references public.packages(id, org_id) on delete cascade,
  foreign key (service_id, org_id) references public.services(id, org_id) on delete cascade
);
create index package_services_service_idx on public.package_services(service_id);

create type public.media_kind as enum ('photo','video','pdf');

create table public.media_assets (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  unit_id uuid,
  service_id uuid,
  package_id uuid,
  kind public.media_kind not null,
  title text not null check (length(trim(title)) > 0),
  storage_path text not null,            -- path in Supabase Storage bucket "media"
  public_url text,                       -- signed or public URL used in WhatsApp
  size_bytes bigint check (size_bytes >= 0),
  created_at timestamptz not null default now(),
  unique (id, org_id),
  -- Storage paths are prefixed with the org id so storage policies can scope them.
  check (storage_path like org_id::text || '/%'),
  foreign key (unit_id, org_id) references public.units(id, org_id) on delete set null (unit_id),
  foreign key (service_id, org_id) references public.services(id, org_id) on delete set null (service_id),
  foreign key (package_id, org_id) references public.packages(id, org_id) on delete set null (package_id)
);
create index media_assets_org_idx on public.media_assets(org_id);
