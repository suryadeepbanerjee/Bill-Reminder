-- Migration: 004_create_bills
-- Description: Create bills table (template/recurring rule)

create table if not exists public.bills (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  category_id uuid not null references public.categories(id),
  title text not null check (char_length(title) between 1 and 120),
  provider_name text check (char_length(provider_name) <= 80),
  behavior_type text not null check (behavior_type in ('fixed_due_date','prepaid_validity','wallet_balance')),
  amount_expected numeric(12,2) check (amount_expected is null or amount_expected >= 0),
  currency text not null default 'INR',
  repeat_kind text not null check (repeat_kind in ('monthly','yearly','every_x_days','every_x_weeks','every_x_months','none')),
  repeat_interval int check (repeat_interval is null or repeat_interval > 0),
  -- fixed_due_date specifics
  generation_day_offset int,
  expected_payment_day_offset int,
  due_day_offset int,
  -- prepaid_validity specifics
  validity_days int,
  -- wallet_balance specifics
  check_interval_days int,
  minimum_balance numeric(12,2),
  balance_notes text,
  is_active boolean not null default true,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Enable RLS
alter table public.bills enable row level security;

-- Indexes
create index if not exists bills_household_id_is_active_idx on public.bills (household_id, is_active);
