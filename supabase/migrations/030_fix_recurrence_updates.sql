-- Migration: 030_fix_recurrence_updates
-- Description: 
-- 1. Adds an AFTER UPDATE trigger to bills to regenerate upcoming occurrences
--    if any recurrence rules change.
-- 2. Modifies `generate_next_occurrence` to snap correctly to `anchor_date`
--    for prepaid_validity / wallet_balance, preventing drift.
-- 3. Modifies `preview_bill_occurrences` RPC to match the new snap behavior.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Helper: Snaps a date to the anchor month/day or anchor day
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public._snap_to_anchor(
  p_target_date date,
  p_anchor_date date,
  p_snap_month boolean -- If true, snap both month AND day. If false, snap only day.
) RETURNS date
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_target_year  int;
  v_target_month int;
  v_anchor_month int;
  v_anchor_day   int;
  v_month_start  date;
  v_max_day      int;
BEGIN
  IF p_anchor_date IS NULL THEN
    RETURN p_target_date;
  END IF;

  v_target_year  := EXTRACT(year FROM p_target_date)::int;
  v_target_month := EXTRACT(month FROM p_target_date)::int;
  v_anchor_month := EXTRACT(month FROM p_anchor_date)::int;
  v_anchor_day   := EXTRACT(day FROM p_anchor_date)::int;

  IF p_snap_month THEN
    -- Snap to anchor's month, keep target's year
    v_month_start := make_date(v_target_year, v_anchor_month, 1);
    v_max_day     := EXTRACT(day FROM (v_month_start + interval '1 month' - interval '1 day'))::int;
    RETURN make_date(v_target_year, v_anchor_month, LEAST(v_anchor_day, v_max_day));
  ELSE
    -- Snap only to anchor's day, keep target's year and month
    v_month_start := make_date(v_target_year, v_target_month, 1);
    v_max_day     := EXTRACT(day FROM (v_month_start + interval '1 month' - interval '1 day'))::int;
    RETURN make_date(v_target_year, v_target_month, LEAST(v_anchor_day, v_max_day));
  END IF;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Updated generate_next_occurrence
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.generate_next_occurrence(p_bill_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_bill          record;
  v_latest_cycle  date;
  v_next_cycle    date;
  v_due_date      date;
  v_gen_date      date;
  v_exp_pay_date  date;
  v_state         text;
  v_anchor_month  int;
  v_anchor_day    int;
BEGIN
  -- Lock the bill row
  SELECT * INTO v_bill FROM public.bills WHERE id = p_bill_id FOR UPDATE;
  IF NOT FOUND OR NOT v_bill.is_active THEN RETURN; END IF;

  SELECT max(cycle_start) INTO v_latest_cycle
  FROM public.bill_occurrences WHERE bill_id = p_bill_id;

  IF v_bill.anchor_date IS NOT NULL THEN
    v_anchor_month := EXTRACT(month FROM v_bill.anchor_date)::int;
    v_anchor_day   := EXTRACT(day   FROM v_bill.anchor_date)::int;
  END IF;

  LOOP
    -- ── DERIVE NEXT CYCLE START ─────────────────────────────────────────────
    IF v_latest_cycle IS NULL THEN
      -- ── FIRST OCCURRENCE ───────────────────────────────────────────────────
      IF v_bill.behavior_type = 'fixed_due_date' AND v_bill.repeat_kind = 'monthly' THEN
        v_next_cycle := date_trunc('month', v_bill.created_at)::date;
        v_due_date   := public._compute_bill_due_date(
          v_next_cycle, v_bill.behavior_type, v_bill.repeat_kind,
          v_bill.due_day_offset, v_bill.validity_days, v_bill.check_interval_days,
          v_bill.anchor_date
        );
        IF v_due_date < v_bill.created_at::date THEN
          v_next_cycle := (v_next_cycle + interval '1 month')::date;
        END IF;

      ELSIF v_bill.behavior_type = 'fixed_due_date' AND v_bill.repeat_kind = 'yearly' THEN
        IF v_bill.anchor_date IS NOT NULL THEN
          v_next_cycle := make_date(EXTRACT(year FROM v_bill.created_at)::int, v_anchor_month, 1);
          v_due_date := public._compute_bill_due_date(
            v_next_cycle, v_bill.behavior_type, v_bill.repeat_kind,
            v_bill.due_day_offset, v_bill.validity_days, v_bill.check_interval_days,
            v_bill.anchor_date
          );
          IF v_due_date < v_bill.created_at::date THEN
            v_next_cycle := make_date(EXTRACT(year FROM v_bill.created_at)::int + 1, v_anchor_month, 1);
          END IF;
        ELSE
          v_next_cycle := date_trunc('month', v_bill.created_at)::date;
          v_due_date   := public._compute_bill_due_date(
            v_next_cycle, v_bill.behavior_type, 'monthly',
            v_bill.due_day_offset, v_bill.validity_days, v_bill.check_interval_days, NULL
          );
          IF v_due_date < v_bill.created_at::date THEN
            v_next_cycle := (v_next_cycle + interval '1 year')::date;
          END IF;
        END IF;

      ELSIF v_bill.behavior_type = 'fixed_due_date' AND v_bill.repeat_kind = 'none' THEN
        v_next_cycle := COALESCE(v_bill.anchor_date, v_bill.created_at::date);

      ELSE
        -- prepaid, wallet, or legacy fixed every_x_*:
        v_next_cycle := COALESCE(v_bill.anchor_date, v_bill.created_at::date);
        
        -- Special edge case: If anchor_date is way in the past, `generate_next_occurrence` 
        -- will loop until `v_due_date >= CURRENT_DATE`.
      END IF;

    ELSE
      -- ── SUBSEQUENT OCCURRENCE ──────────────────────────────────────────────
      IF v_bill.repeat_kind = 'none' THEN RETURN; END IF;

      CASE v_bill.repeat_kind
        WHEN 'monthly' THEN
          v_next_cycle := (v_latest_cycle + interval '1 month')::date;
          -- FIX: Snap prepaid/wallet to anchor day
          IF v_bill.behavior_type != 'fixed_due_date' AND v_bill.anchor_date IS NOT NULL THEN
            v_next_cycle := public._snap_to_anchor(v_next_cycle, v_bill.anchor_date, false);
          END IF;

        WHEN 'yearly' THEN
          v_next_cycle := (v_latest_cycle + interval '1 year')::date;
          IF v_bill.behavior_type = 'fixed_due_date' AND v_bill.anchor_date IS NOT NULL THEN
            v_next_cycle := make_date(EXTRACT(year FROM v_next_cycle)::int, v_anchor_month, 1);
          ELSIF v_bill.anchor_date IS NOT NULL THEN
            -- FIX: Snap prepaid/wallet yearly to anchor month/day
            v_next_cycle := public._snap_to_anchor(v_next_cycle, v_bill.anchor_date, true);
          END IF;

        WHEN 'every_x_days' THEN
          v_next_cycle := (v_latest_cycle + (COALESCE(v_bill.repeat_interval, 1) || ' days')::interval)::date;

        WHEN 'every_x_weeks' THEN
          v_next_cycle := (v_latest_cycle + (COALESCE(v_bill.repeat_interval, 1) * 7 || ' days')::interval)::date;

        WHEN 'every_x_months' THEN
          v_next_cycle := (v_latest_cycle + (COALESCE(v_bill.repeat_interval, 1) || ' months')::interval)::date;
          -- Note: We intentionally do NOT snap every_x_months because interval preserves day correctly
          -- and user might expect relative shifts, but if they want snapping they should use 'monthly'.
          IF v_bill.behavior_type != 'fixed_due_date' AND v_bill.anchor_date IS NOT NULL THEN
             v_next_cycle := public._snap_to_anchor(v_next_cycle, v_bill.anchor_date, false);
          END IF;

        ELSE
          RETURN;
      END CASE;
    END IF;

    -- ── COMPUTE TARGET DATES ──────────────────────────────────────────────────
    v_due_date := public._compute_bill_due_date(
      v_next_cycle, v_bill.behavior_type, v_bill.repeat_kind,
      v_bill.due_day_offset, v_bill.validity_days, v_bill.check_interval_days,
      v_bill.anchor_date
    );

    IF v_bill.behavior_type = 'fixed_due_date' THEN
      v_gen_date     := (v_due_date + (COALESCE(v_bill.generation_day_offset, -7)       || ' days')::interval)::date;
      v_exp_pay_date := (v_due_date + (COALESCE(v_bill.expected_payment_day_offset, -3) || ' days')::interval)::date;
    ELSIF v_bill.behavior_type = 'prepaid_validity' THEN
      v_gen_date     := (v_due_date - interval '3 days')::date;
      v_exp_pay_date := v_due_date;
    ELSIF v_bill.behavior_type = 'wallet_balance' THEN
      v_gen_date     := (v_due_date - interval '1 day')::date;
      v_exp_pay_date := v_due_date;
    END IF;

    -- ── DETERMINE INITIAL STATE ───────────────────────────────────────────────
    v_state := CASE
      WHEN v_due_date <  CURRENT_DATE THEN 'overdue'
      WHEN v_due_date =  CURRENT_DATE THEN 'due_today'
      ELSE 'upcoming'
    END;

    -- ── INSERT ────────────────────────────────────────────────────────────────
    INSERT INTO public.bill_occurrences (
      bill_id, cycle_start, generation_date, expected_payment_date,
      due_date, state, amount, generation_version, generated_at
    ) VALUES (
      p_bill_id, v_next_cycle, v_gen_date, v_exp_pay_date,
      v_due_date, v_state, v_bill.amount_expected, 1, now()
    )
    ON CONFLICT (bill_id, cycle_start) DO NOTHING;

    v_latest_cycle := v_next_cycle;

    EXIT WHEN v_due_date >= CURRENT_DATE;
    EXIT WHEN v_bill.repeat_kind = 'none';
  END LOOP;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Update preview RPC to use the new snap logic
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.preview_bill_occurrences(
  p_behavior_type       text,
  p_repeat_kind         text,
  p_repeat_interval     int     DEFAULT NULL,
  p_due_day_offset      int     DEFAULT NULL,
  p_validity_days       int     DEFAULT NULL,
  p_check_interval_days int     DEFAULT NULL,
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
      p_due_day_offset, p_validity_days, p_check_interval_days, p_anchor_date
    );
    IF v_due_date < p_preview_from THEN
      v_cycle_start := (v_cycle_start + interval '1 month')::date;
    END IF;
  ELSIF p_behavior_type = 'fixed_due_date' AND p_repeat_kind = 'yearly' THEN
    IF p_anchor_date IS NULL THEN RETURN '[]'::json; END IF;
    v_cycle_start := make_date(EXTRACT(year FROM p_preview_from)::int, v_anchor_month, 1);
    v_due_date := public._compute_bill_due_date(
      v_cycle_start, p_behavior_type, p_repeat_kind,
      p_due_day_offset, p_validity_days, p_check_interval_days, p_anchor_date
    );
    IF v_due_date < p_preview_from THEN
      v_cycle_start := make_date(EXTRACT(year FROM p_preview_from)::int + 1, v_anchor_month, 1);
    END IF;
  ELSIF p_behavior_type = 'fixed_due_date' AND p_repeat_kind = 'none' THEN
    IF p_anchor_date IS NULL THEN RETURN '[]'::json; END IF;
    v_cycle_start := p_anchor_date;
  ELSE
    v_cycle_start := COALESCE(p_anchor_date, p_preview_from);
  END IF;

  LOOP
    EXIT WHEN v_iterations >= v_max_iter;
    EXIT WHEN COALESCE(array_length(v_results, 1), 0) >= p_count;
    v_iterations := v_iterations + 1;

    v_due_date := public._compute_bill_due_date(
      v_cycle_start, p_behavior_type, p_repeat_kind,
      p_due_day_offset, p_validity_days, p_check_interval_days, p_anchor_date
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
      ELSE EXIT;
    END CASE;
  END LOOP;

  RETURN to_json(v_results);
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. AFTER UPDATE TRIGGER: Regenerate occurrences on edit
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.tr_generate_on_bill_update()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Only trigger if a field affecting recurrence has changed
  IF 
     NEW.behavior_type IS DISTINCT FROM OLD.behavior_type OR
     NEW.repeat_kind IS DISTINCT FROM OLD.repeat_kind OR
     NEW.repeat_interval IS DISTINCT FROM OLD.repeat_interval OR
     NEW.due_day_offset IS DISTINCT FROM OLD.due_day_offset OR
     NEW.anchor_date IS DISTINCT FROM OLD.anchor_date OR
     NEW.validity_days IS DISTINCT FROM OLD.validity_days OR
     NEW.check_interval_days IS DISTINCT FROM OLD.check_interval_days OR
     NEW.generation_day_offset IS DISTINCT FROM OLD.generation_day_offset OR
     NEW.expected_payment_day_offset IS DISTINCT FROM OLD.expected_payment_day_offset OR
     NEW.amount_expected IS DISTINCT FROM OLD.amount_expected
  THEN
    -- Delete upcoming occurrences so they can be regenerated under new rules.
    DELETE FROM public.bill_occurrences
    WHERE bill_id = NEW.id
      AND state IN ('upcoming', 'generated', 'expected_payment', 'due_today', 'overdue');

    -- Regenerate occurrences from the latest PAID cycle (or from scratch if none)
    PERFORM public.generate_next_occurrence(NEW.id);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS bills_after_update_generate ON public.bills;
CREATE TRIGGER bills_after_update_generate
  AFTER UPDATE ON public.bills
  FOR EACH ROW
  EXECUTE FUNCTION public.tr_generate_on_bill_update();
