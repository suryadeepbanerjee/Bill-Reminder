-- Migration: 010_create_audit_log
-- Description: Create audit_log table

create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  household_id uuid references public.households(id) on delete set null,
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb,
  created_at timestamptz not null default now()
);

-- Enable RLS
alter table public.audit_log enable row level security;

-- Indexes
create index if not exists audit_log_household_id_created_at_idx on public.audit_log (household_id, created_at desc);
