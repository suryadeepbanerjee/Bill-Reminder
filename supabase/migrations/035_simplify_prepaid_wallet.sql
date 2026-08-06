-- Migration: 033_simplify_prepaid_wallet.sql
-- Description: prepaid_validity and wallet_balance no longer depend on
-- validity_days / check_interval_days.  Due date is driven entirely by
-- the repeat settings (same as every other behaviour type).
--
-- Also updates preview_bill_occurrences to always pass NULL for the
-- removed fields (the _compute_bill_due_date helper already handles this).

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
    -- ── Calculate next cycle start ──────────────────────────────────────
    if v_latest_cycle_start is null then
      -- First occurrence: use created_at as anchor
      if v_bill.repeat_kind in ('monthly', 'yearly') then
        v_next_cycle_start := date_trunc('month', v_bill.created_at)::date;
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

    -- ── Calculate due date based on behaviour type ─────────────────────
    if v_bill.behavior_type = 'fixed_due_date' then
      if coalesce(v_bill.due_day_offset, 0) = 0 then
        -- Last day of the cycle month
        v_due_date := (date_trunc('month', v_next_cycle_start) + interval '1 month' - interval '1 day')::date;
      else
        -- Clamp to actual days in month (handles 31 in Feb, etc.)
        v_due_date := (date_trunc('month', v_next_cycle_start)
          + (least(v_bill.due_day_offset,
                   extract(day from (date_trunc('month', v_next_cycle_start) + interval '1 month' - interval '1 day')::date))
             - 1 || ' days')::interval)::date;
      end if;
      v_generation_date       := (v_due_date + (coalesce(v_bill.generation_day_offset, -7)       || ' days')::interval)::date;
      v_expected_payment_date := (v_due_date + (coalesce(v_bill.expected_payment_day_offset, -3) || ' days')::interval)::date;

    elsif v_bill.behavior_type = 'prepaid_validity' then
      -- Due at start of cycle (you pay upfront)
      v_due_date               := v_next_cycle_start;
      v_generation_date        := (v_due_date - interval '3 days')::date;
      v_expected_payment_date  := v_due_date;

    elsif v_bill.behavior_type = 'wallet_balance' then
      -- Due at start of cycle (check and top up)
      v_due_date               := v_next_cycle_start;
      v_generation_date        := (v_due_date - interval '1 day')::date;
      v_expected_payment_date  := v_due_date;
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

-- Update preview to always pass NULL for removed fields
CREATE OR REPLACE FUNCTION public.preview_bill_occurrences(
  p_behavior_type       text,
  p_repeat_kind         text,
  p_repeat_interval     int     DEFAULT NULL,
  p_due_day_offset      int     DEFAULT NULL,
  p_validity_days       int     DEFAULT NULL,    -- ignored, kept for signature compat
  p_check_interval_days int     DEFAULT NULL,    -- ignored, kept for signature compat
  p_anchor_date         date    DEFAULT NULL,
  p_preview_from        date    DEFAULT CURRENT_DATE,
  p_count               int     DEFAULT 5
) RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_cycle_start  date;
  v_due_date     date;
  v_results      date[]  := '{}';
  v_anchor_month int;
  v_iterations   int     := 0;
  v_max_iter     int     := 400;
BEGIN
  IF p_repeat_kind IS NULL OR p_behavior_type IS NULL THEN RETURN '[]'::json; END IF;

  IF p_anchor_date IS NOT NULL THEN
    v_anchor_month := EXTRACT(month FROM p_anchor_date)::int;
  END IF;

  IF p_behavior_type = 'fixed_due_date' AND p_repeat_kind = 'monthly' THEN
    IF p_due_day_offset IS NULL THEN RETURN '[]'::json; END IF;
    v_cycle_start := date_trunc('month', p_preview_from)::date;
    v_due_date := public._compute_bill_due_date(
      v_cycle_start, p_behavior_type, p_repeat_kind,
      p_due_day_offset, NULL, NULL, p_anchor_date
    );
    IF v_due_date < p_preview_from THEN
      v_cycle_start := (v_cycle_start + interval '1 month')::date;
    END IF;
  ELSIF p_behavior_type = 'fixed_due_date' AND p_repeat_kind = 'yearly' THEN
    IF p_anchor_date IS NULL THEN RETURN '[]'::json; END IF;
    v_cycle_start := make_date(EXTRACT(year FROM p_preview_from)::int, v_anchor_month, 1);
    v_due_date := public._compute_bill_due_date(
      v_cycle_start, p_behavior_type, p_repeat_kind,
      p_due_day_offset, NULL, NULL, p_anchor_date
    );
    IF v_due_date < p_preview_from THEN
      v_cycle_start := make_date(EXTRACT(year FROM p_preview_from)::int + 1, v_anchor_month, 1);
    END IF;
  ELSIF p_behavior_type = 'fixed_due_date' AND p_repeat_kind = 'none' THEN
    IF p_anchor_date IS NULL THEN RETURN '[]'::json; END IF;
    v_cycle_start := p_anchor_date;
  ELSE
    -- PREPAID / WALLET
    v_cycle_start := COALESCE(p_anchor_date, p_preview_from);

    CASE p_repeat_kind
      WHEN 'monthly' THEN
        v_cycle_start := (v_cycle_start + interval '1 month')::date;
        IF p_anchor_date IS NOT NULL THEN
          v_cycle_start := public._snap_to_anchor(v_cycle_start, p_anchor_date, false);
        END IF;
      WHEN 'yearly' THEN
        v_cycle_start := (v_cycle_start + interval '1 year')::date;
        IF p_anchor_date IS NOT NULL THEN
          v_cycle_start := public._snap_to_anchor(v_cycle_start, p_anchor_date, true);
        END IF;
      WHEN 'every_x_days' THEN
        v_cycle_start := (v_cycle_start + (COALESCE(p_repeat_interval, 1) || ' days')::interval)::date;
      WHEN 'every_x_weeks' THEN
        v_cycle_start := (v_cycle_start + (COALESCE(p_repeat_interval, 1) * 7 || ' days')::interval)::date;
      WHEN 'every_x_months' THEN
        v_cycle_start := (v_cycle_start + (COALESCE(p_repeat_interval, 1) || ' months')::interval)::date;
        IF p_anchor_date IS NOT NULL THEN
          v_cycle_start := public._snap_to_anchor(v_cycle_start, p_anchor_date, false);
        END IF;
      ELSE
        -- 'none' just uses anchor
    END CASE;
  END IF;

  LOOP
    EXIT WHEN v_iterations >= v_max_iter;
    EXIT WHEN COALESCE(array_length(v_results, 1), 0) >= p_count;
    v_iterations := v_iterations + 1;

    v_due_date := public._compute_bill_due_date(
      v_cycle_start, p_behavior_type, p_repeat_kind,
      p_due_day_offset, NULL, NULL, p_anchor_date
    );

    IF v_due_date >= p_preview_from THEN
      v_results := array_append(v_results, v_due_date);
    END IF;

    EXIT WHEN p_repeat_kind = 'none';

    CASE p_repeat_kind
      WHEN 'monthly' THEN
        v_cycle_start := (v_cycle_start + interval '1 month')::date;
        IF p_behavior_type != 'fixed_due_date' AND p_anchor_date IS NOT NULL THEN
          v_cycle_start := public._snap_to_anchor(v_cycle_start, p_anchor_date, false);
        END IF;
      WHEN 'yearly' THEN
        v_cycle_start := (v_cycle_start + interval '1 year')::date;
        IF p_behavior_type = 'fixed_due_date' AND p_anchor_date IS NOT NULL THEN
          v_cycle_start := make_date(EXTRACT(year FROM v_cycle_start)::int, v_anchor_month, 1);
        ELSIF p_anchor_date IS NOT NULL THEN
          v_cycle_start := public._snap_to_anchor(v_cycle_start, p_anchor_date, true);
        END IF;
      WHEN 'every_x_days' THEN
        v_cycle_start := (v_cycle_start + (COALESCE(p_repeat_interval, 1) || ' days')::interval)::date;
      WHEN 'every_x_weeks' THEN
        v_cycle_start := (v_cycle_start + (COALESCE(p_repeat_interval, 1) * 7 || ' days')::interval)::date;
      WHEN 'every_x_months' THEN
        v_cycle_start := (v_cycle_start + (COALESCE(p_repeat_interval, 1) || ' months')::interval)::date;
        IF p_behavior_type != 'fixed_due_date' AND p_anchor_date IS NOT NULL THEN
          v_cycle_start := public._snap_to_anchor(v_cycle_start, p_anchor_date, false);
        END IF;
      ELSE
        EXIT;
    END CASE;
  END LOOP;

  RETURN to_json(v_results);
END;
$$;
