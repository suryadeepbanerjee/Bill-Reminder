-- Migration: 005_create_bill_occurrences
-- Description: Create bill_occurrences table (instance/state machine)

create table if not exists public.bill_occurrences (
  id uuid primary key default gen_random_uuid(),
  bill_id uuid not null references public.bills(id) on delete cascade,
  cycle_start date not null,
  generation_date date,
  expected_payment_date date,
  due_date date,
  state text not null default 'upcoming'
    check (state in ('upcoming','generated','expected_payment','due_today','overdue','paid','archived')),
  amount numeric(12,2),
  paid_at timestamptz,
  paid_amount numeric(12,2),
  payment_notes text check (char_length(payment_notes) <= 1000),
  receipt_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (bill_id, cycle_start)
);

-- Enable RLS
alter table public.bill_occurrences enable row level security;

-- Indexes
create index if not exists bill_occurrences_bill_id_state_idx on public.bill_occurrences (bill_id, state);
create index if not exists bill_occurrences_due_date_idx on public.bill_occurrences (due_date) where state not in ('paid','archived');
