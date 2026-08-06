-- Migration: 008_create_notification_log
-- Description: Create notification_log table (audit trail)

create table if not exists public.notification_log (
  id uuid primary key default gen_random_uuid(),
  scheduled_reminder_id uuid references public.scheduled_reminders(id) on delete set null,
  user_id uuid references public.profiles(id),
  channel text not null,
  provider_message_id text,
  status text not null,
  error text,
  created_at timestamptz not null default now()
);

-- Enable RLS
alter table public.notification_log enable row level security;
