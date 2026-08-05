-- Migration: 036_fix_generate_next_occurrence_v2.sql
-- Description: Fixes generate_next_occurrence to properly use anchor_date
-- for prepaid/wallet bills. Migration 035 clobbered the v034 fix.

-- ── Main engine ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.generate_next_occurrence(p_bill_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_bill record;
  v_latest_cycle_start date;
  v_next_cycle_start date;
  v_due_date date;
  v_generation_date date;
  v_expected_payment_date date;
  v_anchor_day int;
  v_max_day int;
BEGIN
  SELECT * INTO v_bill
  FROM public.bills
  WHERE id = p_bill_id
  FOR UPDATE;

  IF NOT found OR NOT v_bill.is_active THEN
    RETURN;
  END IF;

  SELECT public._anchor_day(v_bill.anchor_date) INTO v_anchor_day;

  SELECT max(cycle_start) INTO v_latest_cycle_start
  FROM public.bill_occurrences
  WHERE bill_id = p_bill_id;

  LOOP
    -- ── Calculate next cycle start ──────────────────────────────────────
    IF v_latest_cycle_start IS NULL THEN
      -- First occurrence
      IF v_bill.behavior_type IN ('prepaid_validity', 'wallet_balance') THEN
        -- Use anchor_date if present (the user's chosen start date)
        IF v_bill.anchor_date IS NOT NULL THEN
          v_next_cycle_start := v_bill.anchor_date;
        ELSE
          v_next_cycle_start := v_bill.created_at::date;
        END IF;
      ELSE
        IF v_bill.repeat_kind IN ('monthly', 'yearly') THEN
          v_next_cycle_start := date_trunc('month', v_bill.created_at)::date;
        ELSE
          v_next_cycle_start := v_bill.created_at::date;
        END IF;
      END IF;
    ELSE
      IF v_bill.repeat_kind = 'none' THEN
        RETURN;
      ELSIF v_bill.repeat_kind = 'monthly' THEN
        v_next_cycle_start := (v_latest_cycle_start + interval '1 month')::date;
        -- Snap to anchor day for prepaid/wallet
        IF v_bill.behavior_type IN ('prepaid_validity', 'wallet_balance') AND v_anchor_day IS NOT NULL THEN
          v_max_day := public._days_in_month(v_next_cycle_start);
          v_next_cycle_start := make_date(
            EXTRACT(year FROM v_next_cycle_start)::int,
            EXTRACT(month FROM v_next_cycle_start)::int,
            LEAST(v_anchor_day, v_max_day)
          );
        END IF;
      ELSIF v_bill.repeat_kind = 'yearly' THEN
        v_next_cycle_start := (v_latest_cycle_start + interval '1 year')::date;
        -- Snap to anchor month+day for prepaid/wallet
        IF v_bill.behavior_type IN ('prepaid_validity', 'wallet_balance') AND v_anchor_day IS NOT NULL THEN
          v_next_cycle_start := public._snap_to_anchor(v_next_cycle_start, v_bill.anchor_date, true);
        END IF;
      ELSIF v_bill.repeat_kind = 'every_x_days' THEN
        v_next_cycle_start := (v_latest_cycle_start + (coalesce(v_bill.repeat_interval, 1) || ' days')::interval)::date;
      ELSIF v_bill.repeat_kind = 'every_x_weeks' THEN
        v_next_cycle_start := (v_latest_cycle_start + (coalesce(v_bill.repeat_interval, 1) * 7 || ' days')::interval)::date;
      ELSIF v_bill.repeat_kind = 'every_x_months' THEN
        v_next_cycle_start := (v_latest_cycle_start + (coalesce(v_bill.repeat_interval, 1) || ' months')::interval)::date;
        IF v_bill.behavior_type IN ('prepaid_validity', 'wallet_balance') AND v_anchor_day IS NOT NULL THEN
          v_next_cycle_start := public._snap_to_anchor(v_next_cycle_start, v_bill.anchor_date, false);
        END IF;
      ELSE
        RETURN;
      END IF;
    END IF;

    -- ── Calculate due date based on behaviour type ─────────────────────
    IF v_bill.behavior_type = 'fixed_due_date' THEN
      IF coalesce(v_bill.due_day_offset, 0) = 0 THEN
        -- Last day of the cycle month
        v_due_date := (date_trunc('month', v_next_cycle_start) + interval '1 month' - interval '1 day')::date;
      ELSE
        -- Clamp to actual days in month (handles 31 in Feb, etc.)
        v_due_date := (date_trunc('month', v_next_cycle_start)
          + (least(v_bill.due_day_offset,
                   extract(day from (date_trunc('month', v_next_cycle_start) + interval '1 month' - interval '1 day')::date))
             - 1 || ' days')::interval)::date;
      END IF;
      v_generation_date       := (v_due_date + (coalesce(v_bill.generation_day_offset, -7)       || ' days')::interval)::date;
      v_expected_payment_date := (v_due_date + (coalesce(v_bill.expected_payment_day_offset, -3) || ' days')::interval)::date;

    ELSIF v_bill.behavior_type = 'prepaid_validity' THEN
      -- Due at start of cycle (you pay upfront), clamp anchor_day to month
      IF v_anchor_day IS NOT NULL THEN
        v_max_day := public._days_in_month(v_next_cycle_start);
        v_due_date := make_date(
          EXTRACT(year FROM v_next_cycle_start)::int,
          EXTRACT(month FROM v_next_cycle_start)::int,
          LEAST(v_anchor_day, v_max_day)
        );
      ELSE
        v_due_date := v_next_cycle_start;
      END IF;
      v_generation_date        := (v_due_date - interval '3 days')::date;
      v_expected_payment_date  := v_due_date;

    ELSIF v_bill.behavior_type = 'wallet_balance' THEN
      -- Due at start of cycle (check and top up), clamp anchor_day to month
      IF v_anchor_day IS NOT NULL THEN
        v_max_day := public._days_in_month(v_next_cycle_start);
        v_due_date := make_date(
          EXTRACT(year FROM v_next_cycle_start)::int,
          EXTRACT(month FROM v_next_cycle_start)::int,
          LEAST(v_anchor_day, v_max_day)
        );
      ELSE
        v_due_date := v_next_cycle_start;
      END IF;
      v_generation_date        := (v_due_date - interval '1 day')::date;
      v_expected_payment_date  := v_due_date;
    END IF;

    -- ── Skip past cycles: only insert when due_date >= today ───────────
    IF v_due_date < CURRENT_DATE THEN
      v_latest_cycle_start := v_next_cycle_start;
      IF v_bill.repeat_kind = 'none' THEN
        EXIT;
      END IF;
      -- Safety: don't loop forever
      IF v_latest_cycle_start > (CURRENT_DATE + interval '3 years')::date THEN
        EXIT;
      END IF;
      CONTINUE;
    END IF;

    INSERT INTO public.bill_occurrences (
      bill_id, cycle_start, generation_date, expected_payment_date, due_date, state, amount, generation_version, generated_at
    )
    VALUES (
      p_bill_id, v_next_cycle_start, v_generation_date, v_expected_payment_date, v_due_date,
      CASE
        WHEN v_due_date = CURRENT_DATE THEN 'due_today'
        ELSE 'upcoming'
      END,
      v_bill.amount_expected, 1, now()
    )
    ON CONFLICT (bill_id, cycle_start) DO NOTHING;

    EXIT;
  END LOOP;
END;
$$;

-- ── Ensure _days_in_month helper exists ────────────────────────────────────
CREATE OR REPLACE FUNCTION public._days_in_month(p_date date)
RETURNS int
LANGUAGE sql IMMUTABLE
AS $$
  SELECT EXTRACT(day FROM (date_trunc('month', p_date) + interval '1 month' - interval '1 day'))::int;
$$;
