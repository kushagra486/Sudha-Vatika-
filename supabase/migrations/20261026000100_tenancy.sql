-- Core tenancy: organizations, outlets, user profiles, and the helper functions
-- that every RLS policy uses.

create extension if not exists pgcrypto;

-- Helpers live in a schema that PostgREST does not expose.
create schema if not exists app;
grant usage on schema app to authenticated, service_role;

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  gst_number text,
  tax_percent numeric(5,2) not null default 0 check (tax_percent >= 0 and tax_percent <= 100),
  currency text not null default 'INR',
  timezone text not null default 'Asia/Kolkata',
  created_at timestamptz not null default now()
);

create table public.outlets (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  address text,
  created_at timestamptz not null default now(),
  unique (org_id, name),
  -- Target for composite foreign keys, so children cannot point at another org's outlet.
  unique (id, org_id)
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  org_id uuid not null references public.organizations(id) on delete cascade,
  outlet_id uuid,
  full_name text not null check (length(trim(full_name)) > 0),
  phone_e164 text check (phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  role text not null check (role in ('owner','manager','sales','ops','viewer')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (id, org_id),
  foreign key (outlet_id, org_id) references public.outlets(id, org_id)
);
create index profiles_org_idx on public.profiles(org_id);

-- ---------------------------------------------------------------------------
-- Auth helpers. SECURITY DEFINER so policies on `profiles` itself do not recurse.
-- Inactive users resolve to no org and no role, which denies everything.
-- ---------------------------------------------------------------------------

create or replace function app.current_org_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.org_id from public.profiles p where p.id = auth.uid() and p.active
$$;

create or replace function app.user_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select p.role from public.profiles p where p.id = auth.uid() and p.active
$$;

create or replace function app.has_role(variadic roles text[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(app.user_role() = any(roles), false)
$$;

-- Owners and managers see every lead and every outlet.
create or replace function app.is_manager()
returns boolean
language sql
stable
set search_path = ''
as $$
  select app.has_role('owner', 'manager')
$$;

grant execute on all functions in schema app to authenticated, service_role;

-- Generic updated_at maintenance.
create or replace function app.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Onboarding: a signed-in user with no profile creates their organization,
-- first outlet and owner profile in one call. Exposed as an RPC.
-- ---------------------------------------------------------------------------

create or replace function public.create_organization(
  org_name text,
  outlet_name text,
  owner_full_name text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_org uuid;
  v_outlet uuid;
begin
  if v_uid is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  if exists (select 1 from public.profiles where id = v_uid) then
    raise exception 'User already belongs to an organization' using errcode = '23505';
  end if;

  insert into public.organizations (name) values (org_name) returning id into v_org;
  insert into public.outlets (org_id, name) values (v_org, outlet_name) returning id into v_outlet;
  insert into public.profiles (id, org_id, outlet_id, full_name, role)
  values (v_uid, v_org, v_outlet, owner_full_name, 'owner');

  return v_org;
end;
$$;

revoke execute on function public.create_organization(text, text, text) from public, anon;
grant execute on function public.create_organization(text, text, text) to authenticated;
