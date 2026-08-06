-- Migration: 025_fix_occurrence_initial_state
-- Description: When generating an occurrence, set the correct state based on due_date
-- instead of always using 'upcoming'. Bills due today should show as 'due_today' immediately.

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
  select * into v_bill
  from public.bills
  where id = p_bill_id
  for update;

  if not found or not v_bill.is_active then
    return;
  end if;

  select max(cycle_start) into v_latest_cycle_start
  from public.bill_occurrences
  where bill_id = p_bill_id;

  loop
    if v_latest_cycle_start is null then
      if v_bill.behavior_type = 'fixed_due_date' and v_bill.repeat_kind in ('monthly', 'yearly') then
        v_next_cycle_start := date_trunc('month', v_bill.created_at)::date;

        if coalesce(v_bill.due_day_offset, 0) = 0 then
          v_due_date := (v_next_cycle_start + interval '1 month' - interval '1 day')::date;
        else
          v_due_date := v_next_cycle_start + (least(v_bill.due_day_offset, extract(day from (v_next_cycle_start + interval '1 month' - interval '1 day')::date)) - 1 || ' days')::interval;
        end if;

        if v_due_date < v_bill.created_at::date then
          if v_bill.repeat_kind = 'monthly' then
            v_next_cycle_start := (v_next_cycle_start + interval '1 month')::date;
          else
            v_next_cycle_start := (v_next_cycle_start + interval '1 year')::date;
          end if;
        end if;
      else
        v_next_cycle_start := v_bill.created_at::date;
      end if;
    else
      if v_bill.repeat_kind = 'none' then
        return;
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

    insert into public.bill_occurrences (
      bill_id, cycle_start, generation_date, expected_payment_date, due_date, state, amount, generation_version, generated_at
    )
    values (
      p_bill_id, v_next_cycle_start, v_generation_date, v_expected_payment_date, v_due_date,
      case
        when v_due_date < CURRENT_DATE then 'overdue'
        when v_due_date = CURRENT_DATE then 'due_today'
        else 'upcoming'
      end,
      v_bill.amount_expected, 1, now()
    )
    on conflict (bill_id, cycle_start) do nothing;

    v_latest_cycle_start := v_next_cycle_start;

    if v_due_date >= CURRENT_DATE then
      exit;
    end if;

    if v_bill.repeat_kind = 'none' then
      exit;
    end if;
  end loop;
end;
$$;
