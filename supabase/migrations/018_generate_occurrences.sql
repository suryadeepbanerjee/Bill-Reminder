-- Migration: 018_generate_occurrences
-- Description: Implement database-level occurrence generation engine, add constraints and email notifications column.

-- 1. Schema Additions
alter table public.profiles 
  add column if not exists email_notifications_enabled boolean not null default true;

alter table public.bill_occurrences 
  add column if not exists generated_at timestamptz not null default now(),
  add column if not exists generation_version int not null default 1;

-- 2. Constraints and Bug Fixes
-- Fix for Delete Account (foreign keys restricting cascade)
alter table public.notification_log drop constraint if exists notification_log_user_id_fkey;
alter table public.notification_log add constraint notification_log_user_id_fkey foreign key (user_id) references public.profiles(id) on delete set null;

alter table public.bills drop constraint if exists bills_created_by_fkey;
alter table public.bills add constraint bills_created_by_fkey foreign key (created_by) references public.profiles(id) on delete set null;

alter table public.households drop constraint if exists households_created_by_fkey;
alter table public.households add constraint households_created_by_fkey foreign key (created_by) references public.profiles(id) on delete set null;

-- Add check constraints
alter table public.bills 
  add constraint bills_validity_days_check check (validity_days is null or validity_days > 0),
  add constraint bills_check_interval_days_check check (check_interval_days is null or check_interval_days > 0);

-- 3. Generation Engine Function
create or replace function public.generate_next_occurrence(p_bill_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_bill record;
  v_latest_cycle_start date;
  v_next_cycle_start date;
  v_due_date date;
  v_generation_date date;
  v_expected_payment_date date;
begin
  -- Lock the bill row for concurrency protection against race conditions
  select * into v_bill
  from public.bills
  where id = p_bill_id
  for update;

  if not found or not v_bill.is_active then
    return;
  end if;

  -- Find the latest cycle start for this bill
  select max(cycle_start) into v_latest_cycle_start
  from public.bill_occurrences
  where bill_id = p_bill_id;

  -- Catch-up loop: generate occurrences until we have one strictly in the future
  loop
    if v_latest_cycle_start is null then
      -- FIRST OCCURRENCE DERIVATION
      if v_bill.behavior_type = 'fixed_due_date' and v_bill.repeat_kind in ('monthly', 'yearly') then
        -- Default to the 1st of the month of the creation date
        v_next_cycle_start := date_trunc('month', v_bill.created_at)::date;
        
        -- Compute temporary due date to check if it's already in the past relative to creation
        if coalesce(v_bill.due_day_offset, 0) = 0 then
          v_due_date := (v_next_cycle_start + interval '1 month' - interval '1 day')::date;
        else
          v_due_date := v_next_cycle_start + (least(v_bill.due_day_offset, extract(day from (v_next_cycle_start + interval '1 month' - interval '1 day')::date)) - 1 || ' days')::interval;
        end if;

        -- If created AFTER the due date in this month, automatically shift to the next cycle
        if v_due_date < v_bill.created_at::date then
          if v_bill.repeat_kind = 'monthly' then
            v_next_cycle_start := (v_next_cycle_start + interval '1 month')::date;
          else
            v_next_cycle_start := (v_next_cycle_start + interval '1 year')::date;
          end if;
        end if;
      else
        -- For non-calendar anchored bills, the cycle starts exactly on creation day
        v_next_cycle_start := v_bill.created_at::date;
      end if;
    else
      -- SUBSEQUENT OCCURRENCE DERIVATION
      if v_bill.repeat_kind = 'none' then
        return; -- Stop generating for one-time bills
      elsif v_bill.repeat_kind = 'monthly' then
        v_next_cycle_start := (v_latest_cycle_start + interval '1 month')::date;
      elsif v_bill.repeat_kind = 'yearly' then
        v_next_cycle_start := (v_latest_cycle_start + interval '1 year')::date;
      elsif v_bill.repeat_kind = 'every_x_days' then
        v_next_cycle_start := (v_latest_cycle_start + (coalesce(v_bill.repeat_interval, 1) || ' days')::interval)::date;
      elsif v_bill.repeat_kind = 'every_x_weeks' then
        v_next_cycle_start := (v_latest_cycle_start + (coalesce(v_bill.repeat_interval, 1) * 7 || ' days')::interval)::date;
      elsif v_bill.repeat_kind = 'every_x_months' then
        v_next_cycle_start := (v_latest_cycle_start + (coalesce(v_bill.repeat_interval, 1) || ' months')::interval)::date;
      else
        return;
      end if;
    end if;

    -- COMPUTE TARGET DATES based on behavior
    if v_bill.behavior_type = 'fixed_due_date' then
      if coalesce(v_bill.due_day_offset, 0) = 0 then
        v_due_date := (date_trunc('month', v_next_cycle_start) + interval '1 month' - interval '1 day')::date;
      else
        v_due_date := (date_trunc('month', v_next_cycle_start) + (least(v_bill.due_day_offset, extract(day from (date_trunc('month', v_next_cycle_start) + interval '1 month' - interval '1 day')::date)) - 1 || ' days')::interval)::date;
      end if;
      v_generation_date := (v_due_date + (coalesce(v_bill.generation_day_offset, -7) || ' days')::interval)::date;
      v_expected_payment_date := (v_due_date + (coalesce(v_bill.expected_payment_day_offset, -3) || ' days')::interval)::date;

    elsif v_bill.behavior_type = 'prepaid_validity' then
      v_due_date := (v_next_cycle_start + (coalesce(v_bill.validity_days, 1) || ' days')::interval)::date;
      v_generation_date := (v_due_date - interval '3 days')::date;
      v_expected_payment_date := v_due_date;

    elsif v_bill.behavior_type = 'wallet_balance' then
      v_due_date := (v_next_cycle_start + (coalesce(v_bill.check_interval_days, 1) || ' days')::interval)::date;
      v_generation_date := (v_due_date - interval '1 day')::date;
      v_expected_payment_date := v_due_date;
    end if;

    -- INSERT IDEMPOTENTLY
    insert into public.bill_occurrences (
      bill_id, cycle_start, generation_date, expected_payment_date, due_date, state, amount, generation_version, generated_at
    )
    values (
      p_bill_id, v_next_cycle_start, v_generation_date, v_expected_payment_date, v_due_date, 'upcoming', v_bill.amount_expected, 1, now()
    )
    on conflict (bill_id, cycle_start) do nothing;
    
    v_latest_cycle_start := v_next_cycle_start;

    -- RECURRENCE-AWARE STOPPING CONDITION
    -- Stop generating if the staged due date is strictly in the future.
    if v_due_date > CURRENT_DATE then
      exit;
    end if;

    -- Do not loop for one-time bills
    if v_bill.repeat_kind = 'none' then
      exit;
    end if;
  end loop;
end;
$$;

-- 4. Triggers for Automatic Generation
create or replace function public.tr_generate_initial_occurrence()
returns trigger
language plpgsql
as $$
begin
  perform public.generate_next_occurrence(NEW.id);
  return NEW;
end;
$$;

drop trigger if exists bills_after_insert_generate on public.bills;
create trigger bills_after_insert_generate
  after insert on public.bills
  for each row
  execute function public.tr_generate_initial_occurrence();


create or replace function public.tr_generate_on_paid()
returns trigger
language plpgsql
as $$
begin
  -- State transition protection: only fire if transitioning strictly from non-paid to paid
  if NEW.state = 'paid' and OLD.state != 'paid' then
    perform public.generate_next_occurrence(NEW.bill_id);
  end if;
  return NEW;
end;
$$;

drop trigger if exists occurrences_after_update_paid on public.bill_occurrences;
create trigger occurrences_after_update_paid
  after update on public.bill_occurrences
  for each row
  execute function public.tr_generate_on_paid();

-- 5. Repair Utility
create or replace function public.repair_all_occurrences()
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_bill_id uuid;
begin
  for v_bill_id in select id from public.bills where is_active = true loop
    perform public.generate_next_occurrence(v_bill_id);
  end loop;
end;
$$;
