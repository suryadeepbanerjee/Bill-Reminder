-- Migration: 009_create_push_tokens
-- Description: Create push_tokens table

create table if not exists public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  expo_push_token text not null unique,
  device_label text,
  created_at timestamptz not null default now(),
  last_used_at timestamptz not null default now()
);

-- Enable RLS
alter table public.push_tokens enable row level security;
