-- Migration: 006_create_reminder_rules
-- Description: Create bill_reminder_rules table

create table if not exists public.bill_reminder_rules (
  id uuid primary key default gen_random_uuid(),
  bill_id uuid not null references public.bills(id) on delete cascade,
  anchor text not null check (anchor in ('generation','expected_payment','due_date')),
  offset_days int not null default 0,
  repeat_interval_hours int check (repeat_interval_hours is null or repeat_interval_hours >= 6),
  repeat_cap int check (repeat_cap is null or repeat_cap between 1 and 8),
  channel text not null default 'push' check (channel in ('push','email','both')),
  enabled boolean not null default true
);

-- Enable RLS
alter table public.bill_reminder_rules enable row level security;
