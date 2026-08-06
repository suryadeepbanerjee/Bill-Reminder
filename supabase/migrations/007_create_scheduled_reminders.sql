-- Migration: 007_create_scheduled_reminders
-- Description: Create scheduled_reminders table (materialized queue)

create table if not exists public.scheduled_reminders (
  id uuid primary key default gen_random_uuid(),
  occurrence_id uuid not null references public.bill_occurrences(id) on delete cascade,
  rule_id uuid not null references public.bill_reminder_rules(id) on delete cascade,
  scheduled_for timestamptz not null,
  channel text not null check (channel in ('push','email')),
  status text not null default 'pending' check (status in ('pending','sent','skipped','failed','cancelled')),
  sent_at timestamptz,
  unique (occurrence_id, rule_id, scheduled_for, channel)
);

-- Enable RLS
alter table public.scheduled_reminders enable row level security;

-- Indexes
create index if not exists scheduled_reminders_pending_idx on public.scheduled_reminders (status, scheduled_for) where status = 'pending';
