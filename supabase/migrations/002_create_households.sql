-- Migration: 002_create_households
-- Description: Create households and household_members tables

create table if not exists public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists public.household_members (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  invited_email text,
  role text not null check (role in ('admin','editor','viewer')),
  status text not null default 'active' check (status in ('invited','active','removed')),
  created_at timestamptz not null default now(),
  unique (household_id, user_id)
);

-- Enable RLS
alter table public.households enable row level security;
alter table public.household_members enable row level security;

-- Function to auto-create household on signup
create or replace function public.handle_new_user_household()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  new_household_id uuid;
  user_display_name text;
begin
  -- Get display name from profile
  select display_name into user_display_name
  from public.profiles
  where id = new.id;

  -- Create household
  insert into public.households (name, created_by)
  values (coalesce(user_display_name, 'My Household') || '''s Household', new.id)
  returning id into new_household_id;

  -- Add user as admin
  insert into public.household_members (household_id, user_id, role, status)
  values (new_household_id, new.id, 'admin', 'active');

  return new;
end;
$$;

-- Trigger to create household on profile creation
create or replace trigger on_profile_created
  after insert on public.profiles
  for each row execute function public.handle_new_user_household();
