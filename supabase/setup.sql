-- San Andreas MLS: shared listings. Run once in the Supabase SQL Editor.
-- Also turn on Authentication -> Sign In / Providers -> Allow anonymous sign-ins.

create table public.listings (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null default auth.uid(),
  local_id text not null,
  agent text not null default '',
  agency text not null default '',
  address text not null,
  zone int,
  status text,
  appraisal int,
  asking int,
  sold_for int,
  sqft int,
  rooms int,
  features jsonb not null default '[]',
  photos jsonb not null default '[]',
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (owner, local_id),
  constraint listings_sizes check (
    char_length(address) <= 120 and char_length(agent) <= 60 and char_length(agency) <= 60
    and jsonb_array_length(photos) <= 12 and jsonb_array_length(features) <= 60)
);

create table public.directors (user_id uuid primary key);

alter table public.listings enable row level security;
alter table public.directors enable row level security;

create or replace function public.is_director() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.directors where user_id = auth.uid())
$$;

create policy "Everyone can see listings" on public.listings
  for select using (true);
create policy "Agents add their own" on public.listings
  for insert to authenticated with check (owner = auth.uid());
create policy "Agents change their own" on public.listings
  for update to authenticated using (owner = auth.uid()) with check (owner = auth.uid());
create policy "Agents or the director remove" on public.listings
  for delete to authenticated using (owner = auth.uid() or public.is_director());
