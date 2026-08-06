-- Migration: 014_update_profiles
-- Description: Adds avatar_url, email, updated_at to profiles. Updates the trigger to map Google OAuth metadata correctly. Backfills missing profiles safely.

-- 1. Add new columns idempotently
alter table public.profiles
  add column if not exists avatar_url text,
  add column if not exists email text,
  add column if not exists updated_at timestamptz not null default now();

-- 2. Create or replace the improved trigger function
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, avatar_url, email)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data->>'display_name',
      new.raw_user_meta_data->>'name',
      new.raw_user_meta_data->>'full_name',
      trim(both from concat_ws(' ', new.raw_user_meta_data->>'given_name', new.raw_user_meta_data->>'family_name')),
      ''
    ),
    coalesce(
      new.raw_user_meta_data->>'picture',
      new.raw_user_meta_data->>'avatar_url',
      ''
    ),
    coalesce(new.email, '')
  )
  on conflict (id) do update set
    avatar_url = excluded.avatar_url,
    email = excluded.email,
    display_name = case 
      when profiles.display_name is null or profiles.display_name = '' 
      then excluded.display_name 
      else profiles.display_name 
    end;
  
  return new;
end;
$$;

-- 3. Backfill any existing users that might have slipped through without a profile or need fields updated
-- We use INSERT ... ON CONFLICT DO UPDATE to backfill gracefully without overriding existing manual edits
insert into public.profiles (id, display_name, avatar_url, email)
select 
  u.id,
  coalesce(
    u.raw_user_meta_data->>'display_name',
    u.raw_user_meta_data->>'name',
    u.raw_user_meta_data->>'full_name',
    trim(both from concat_ws(' ', u.raw_user_meta_data->>'given_name', u.raw_user_meta_data->>'family_name')),
    ''
  ) as display_name,
  coalesce(
    u.raw_user_meta_data->>'picture',
    u.raw_user_meta_data->>'avatar_url',
    ''
  ) as avatar_url,
  coalesce(u.email, '') as email
from auth.users u
on conflict (id) do update set
  avatar_url = coalesce(profiles.avatar_url, excluded.avatar_url),
  email = coalesce(profiles.email, excluded.email),
  display_name = case 
    when profiles.display_name is null or profiles.display_name = '' 
    then excluded.display_name 
    else profiles.display_name 
  end;

-- 4. Create trigger for updated_at
create or replace function public.update_profiles_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
  before update on public.profiles
  for each row
  execute function public.update_profiles_updated_at();
