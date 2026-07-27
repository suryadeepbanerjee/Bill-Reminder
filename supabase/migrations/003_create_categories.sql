-- Migration: 003_create_categories
-- Description: Create category_presets and categories tables

create table if not exists public.category_presets (
  id uuid primary key default gen_random_uuid(),
  key text unique not null,
  name text not null,
  icon text not null,
  color text not null
);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  preset_key text references public.category_presets(key),
  name text not null,
  icon text not null,
  color text not null,
  created_at timestamptz not null default now()
);

-- Enable RLS
alter table public.category_presets enable row level security;
alter table public.categories enable row level security;

-- Public read for presets (no writes allowed from client)
create policy "Anyone can view category presets"
  on public.category_presets for select
  using (true);
