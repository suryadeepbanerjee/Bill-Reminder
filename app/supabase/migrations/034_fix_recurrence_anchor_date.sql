-- Migration: 034_fix_recurrence_anchor_date.sql
-- Description: Fixes generate_next_occurrence and preview_bill_occurrences
-- so prepaid/wallet bills use anchor_date to determine:
--   1. First cycle_start (not date_trunc to first of month)
--   2. Due date (uses anchor day, not just cycle_start)

-- ── Helper: extract day from anchor_date ────────────────────────────────────
CREATE OR REPLACE FUNCTION public._anchor_day(p_anchor_date date)
RETURNS int
LANGUAGE sql IMMUTABLE
AS $$
  SELECT CASE WHEN p_anchor_date IS NULL THEN NULL
              ELSE EXTRACT(day FROM p_anchor_date)::int
         END;
$$;

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
begin
  SELECT * INTO v_bill
  FROM public.bills
  WHERE id = p_bill_id
  FOR UPDATE;

  IF NOT FOUND OR NOT v_bill.is_active THEN
    RETURN;
  END IF;

  v_anchor_day := public._anchor_day(v_bill.anchor_date);

  SELECT max(cycle_start) INTO v_latest_cycle_start
  FROM public.bill_occurrences
  WHERE bill_id = p_bill_id;

  LOOP
    -- ── Calculate next cycle start ──────────────────────────────────────
    IF v_latest_cycle_start IS NULL THEN
      -- First occurrence
      IF v_bill.anchor_date IS NOT NULL THEN
        -- Use anchor_date as the starting point
        IF v_bill.repeat_kind IN ('monthly', 'yearly') THEN
          -- For monthly/yearly, snap to the anchor month
          v_next_cycle_start := v_bill.anchor_date;
        ELSE
          v_next_cycle_start := v_bill.anchor_date;
        END IF;
      ELSIF v_bill.repeat_kind IN ('monthly', 'yearly') THEN
        v_next_cycle_start := date_trunc('month', v_bill.created_at)::date;
      ELSE
        v_next_cycle_start := v_bill.created_at::date;
      END IF;
    ELSE
      IF v_bill.repeat_kind = 'none' THEN
        RETURN;
      ELSIF v_bill.repeat_kind = 'monthly' THEN
        v_next_cycle_start := (v_latest_cycle_start + interval '1 month')::date;
      ELSIF v_bill.repeat_kind = 'yearly' THEN
        v_next_cycle_start := (v_latest_cycle_start + interval '1 year')::date;
      ELSIF v_bill.repeat_kind = 'every_x_days' THEN
        v_next_cycle_start := (v_latest_cycle_start + (coalesce(v_bill.repeat_interval, 1) || ' days')::interval)::date;
      ELSIF v_bill.repeat_kind = 'every_x_weeks' THEN
        v_next_cycle_start := (v_latest_cycle_start + (coalesce(v_bill.repeat_interval, 1) * 7 || ' days')::interval)::date;
      ELSIF v_bill.repeat_kind = 'every_x_months' THEN
        v_next_cycle_start := (v_latest_cycle_start + (coalesce(v_bill.repeat_interval, 1) || ' months')::interval)::date;
      ELSE
        RETURN;
      END IF;
    END IF;

    -- ── Calculate due date based on behaviour type ─────────────────────
    IF v_bill.behavior_type = 'fixed_due_date' THEN
      IF coalesce(v_bill.due_day_offset, 0) = 0 THEN
        v_due_date := (date_trunc('month', v_next_cycle_start) + interval '1 month' - interval '1 day')::date;
      ELSE
        v_due_date := (date_trunc('month', v_next_cycle_start)
          + (least(v_bill.due_day_offset,
                   extract(day from (date_trunc('month', v_next_cycle_start) + interval '1 month' - interval '1 day')::date))
             - 1 || ' days')::interval)::date;
      END IF;
      v_generation_date       := (v_due_date + (coalesce(v_bill.generation_day_offset, -7)       || ' days')::interval)::date;
      v_expected_payment_date := (v_due_date + (coalesce(v_bill.expected_payment_day_offset, -3) || ' days')::interval)::date;

    ELSIF v_bill.behavior_type IN ('prepaid_validity', 'wallet_balance') THEN
      IF v_bill.repeat_kind IN ('monthly', 'yearly') AND v_anchor_day IS NOT NULL THEN
        -- Use the anchor day clamped to the month's actual length
        v_due_date := (date_trunc('month', v_next_cycle_start)
          + (least(v_anchor_day,
                   extract(day from (date_trunc('month', v_next_cycle_start) + interval '1 month' - interval '1 day')::date))
             - 1 || ' days')::interval)::date;
      ELSIF v_bill.repeat_kind = 'none' THEN
        -- One-time: the anchor_date IS the due date
        v_due_date := v_next_cycle_start;
      ELSE
        -- Every X days/weeks/months: due at cycle start
        v_due_date := v_next_cycle_start;
      END IF;

      IF v_bill.behavior_type = 'prepaid_validity' THEN
        v_generation_date       := (v_due_date - interval '3 days')::date;
        v_expected_payment_date := v_due_date;
      ELSE
        v_generation_date       := (v_due_date - interval '1 day')::date;
        v_expected_payment_date := v_due_date;
      END IF;
    END IF;

    -- Skip past cycles — only insert when due_date is today or future
    IF v_due_date >= CURRENT_DATE THEN
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
    END IF;

    v_latest_cycle_start := v_next_cycle_start;

    IF v_bill.repeat_kind = 'none' THEN
      -- One-time bill with past anchor_date — insert as overdue (user needs to know)
      INSERT INTO public.bill_occurrences (
        bill_id, cycle_start, generation_date, expected_payment_date, due_date, state, amount, generation_version, generated_at
      )
      VALUES (
        p_bill_id, v_next_cycle_start, v_generation_date, v_expected_payment_date, v_due_date,
        'overdue',
        v_bill.amount_expected, 1, now()
      )
      ON CONFLICT (bill_id, cycle_start) DO NOTHING;
      EXIT;
    END IF;
  END LOOP;
END;
$$;

-- ── Preview function ───────────────────────────────────────────────────────
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
  v_anchor_day   int;
  v_iterations   int     := 0;
  v_max_iter     int     := 400;
BEGIN
  IF p_repeat_kind IS NULL OR p_behavior_type IS NULL THEN RETURN '[]'::json; END IF;

  IF p_anchor_date IS NOT NULL THEN
    v_anchor_month := EXTRACT(month FROM p_anchor_date)::int;
    v_anchor_day   := EXTRACT(day   FROM p_anchor_date)::int;
  END IF;

  -- ── FIXED DUE DATE ──────────────────────────────────────────────────────
  IF p_behavior_type = 'fixed_due_date' THEN
    IF p_repeat_kind = 'monthly' THEN
      IF p_due_day_offset IS NULL THEN RETURN '[]'::json; END IF;
      v_cycle_start := date_trunc('month', p_preview_from)::date;
      v_due_date := public._compute_bill_due_date(
        v_cycle_start, p_behavior_type, p_repeat_kind,
        p_due_day_offset, NULL, NULL, p_anchor_date
      );
      IF v_due_date < p_preview_from THEN
        v_cycle_start := (v_cycle_start + interval '1 month')::date;
      END IF;

    ELSIF p_repeat_kind = 'yearly' THEN
      IF p_anchor_date IS NULL THEN RETURN '[]'::json; END IF;
      v_cycle_start := make_date(EXTRACT(year FROM p_preview_from)::int, v_anchor_month, 1);
      v_due_date := public._compute_bill_due_date(
        v_cycle_start, p_behavior_type, p_repeat_kind,
        p_due_day_offset, NULL, NULL, p_anchor_date
      );
      IF v_due_date < p_preview_from THEN
        v_cycle_start := make_date(EXTRACT(year FROM p_preview_from)::int + 1, v_anchor_month, 1);
      END IF;

    ELSIF p_repeat_kind = 'none' THEN
      IF p_anchor_date IS NULL THEN RETURN '[]'::json; END IF;
      v_cycle_start := p_anchor_date;
    END IF;

  -- ── PREPAID / WALLET ─────────────────────────────────────────────────────
  ELSE
    IF p_repeat_kind IN ('monthly', 'yearly') THEN
      -- Use anchor_date as cycle_start; due_date uses anchor day
      v_cycle_start := COALESCE(p_anchor_date, p_preview_from);
      IF p_repeat_kind = 'monthly' THEN
        v_due_date := (date_trunc('month', v_cycle_start)
          + (least(v_anchor_day,
                   extract(day from (date_trunc('month', v_cycle_start) + interval '1 month' - interval '1 day')::date))
             - 1 || ' days')::interval)::date;
        IF v_due_date < p_preview_from THEN
          v_cycle_start := (v_cycle_start + interval '1 month')::date;
          v_due_date := (date_trunc('month', v_cycle_start)
            + (least(v_anchor_day,
                     extract(day from (date_trunc('month', v_cycle_start) + interval '1 month' - interval '1 day')::date))
               - 1 || ' days')::interval)::date;
        END IF;
      ELSIF p_repeat_kind = 'yearly' THEN
        v_due_date := make_date(
          EXTRACT(year FROM v_cycle_start)::int,
          v_anchor_month,
          LEAST(v_anchor_day, EXTRACT(day FROM (make_date(EXTRACT(year FROM v_cycle_start)::int, v_anchor_month, 1) + interval '1 month' - interval '1 day'))::int)
        );
        IF v_due_date < p_preview_from THEN
          v_cycle_start := (v_cycle_start + interval '1 year')::date;
          v_due_date := make_date(
            EXTRACT(year FROM v_cycle_start)::int,
            v_anchor_month,
            LEAST(v_anchor_day, EXTRACT(day FROM (make_date(EXTRACT(year FROM v_cycle_start)::int, v_anchor_month, 1) + interval '1 month' - interval '1 day'))::int)
          );
        END IF;
      END IF;

    ELSIF p_repeat_kind = 'none' THEN
      IF p_anchor_date IS NULL THEN RETURN '[]'::json; END IF;
      v_cycle_start := p_anchor_date;
      v_due_date    := p_anchor_date;

    ELSE
      -- Every X days/weeks/months: anchor_date is cycle_start
      v_cycle_start := COALESCE(p_anchor_date, p_preview_from);
      v_due_date    := v_cycle_start;
    END IF;
  END IF;

  LOOP
    EXIT WHEN v_iterations >= v_max_iter;
    EXIT WHEN COALESCE(array_length(v_results, 1), 0) >= p_count;
    v_iterations := v_iterations + 1;

    -- Add current due_date if not in the past
    IF v_due_date >= p_preview_from THEN
      v_results := array_append(v_results, v_due_date);
    END IF;

    EXIT WHEN p_repeat_kind = 'none';

    -- Advance to next cycle
    IF p_behavior_type = 'fixed_due_date' THEN
      IF p_repeat_kind = 'monthly' THEN
        v_cycle_start := (v_cycle_start + interval '1 month')::date;
      ELSIF p_repeat_kind = 'yearly' THEN
        v_cycle_start := (v_cycle_start + interval '1 year')::date;
        IF v_anchor_date IS NOT NULL THEN
          v_cycle_start := make_date(EXTRACT(year FROM v_cycle_start)::int, v_anchor_month, 1);
        END IF;
      END IF;
      v_due_date := public._compute_bill_due_date(
        v_cycle_start, p_behavior_type, p_repeat_kind,
        p_due_day_offset, NULL, NULL, p_anchor_date
      );

    ELSE
      -- Prepaid / Wallet
      IF p_repeat_kind = 'monthly' THEN
        v_cycle_start := (v_cycle_start + interval '1 month')::date;
        v_due_date := (date_trunc('month', v_cycle_start)
          + (least(v_anchor_day,
                   extract(day from (date_trunc('month', v_cycle_start) + interval '1 month' - interval '1 day')::date))
             - 1 || ' days')::interval)::date;
      ELSIF p_repeat_kind = 'yearly' THEN
        v_cycle_start := (v_cycle_start + interval '1 year')::date;
        v_due_date := make_date(
          EXTRACT(year FROM v_cycle_start)::int,
          v_anchor_month,
          LEAST(v_anchor_day, EXTRACT(day FROM (make_date(EXTRACT(year FROM v_cycle_start)::int, v_anchor_month, 1) + interval '1 month' - interval '1 day'))::int)
        );
      ELSIF p_repeat_kind = 'every_x_days' THEN
        v_cycle_start := (v_cycle_start + (COALESCE(p_repeat_interval, 1) || ' days')::interval)::date;
        v_due_date := v_cycle_start;
      ELSIF p_repeat_kind = 'every_x_weeks' THEN
        v_cycle_start := (v_cycle_start + (COALESCE(p_repeat_interval, 1) * 7 || ' days')::interval)::date;
        v_due_date := v_cycle_start;
      ELSIF p_repeat_kind = 'every_x_months' THEN
        v_cycle_start := (v_cycle_start + (COALESCE(p_repeat_interval, 1) || ' months')::interval)::date;
        v_due_date := v_cycle_start;
      END IF;
    END IF;
  END LOOP;

  RETURN to_json(v_results);
END;
$$;

-- ── Cleanup: archive phantom overdue occurrences ─────────────────────────────
-- The old generate_next_occurrence inserted every past cycle as 'overdue' while
-- looping to find the next future one. Archive them so reminders stop firing.
UPDATE public.bill_occurrences
SET state = 'archived', updated_at = now()
WHERE state = 'overdue'
  AND due_date < CURRENT_DATE
  AND paid_at IS NULL
  AND id IN (
    SELECT bo.id
    FROM public.bill_occurrences bo
    JOIN public.bills b ON b.id = bo.bill_id
    WHERE b.is_active = true
      AND b.repeat_kind != 'none'
  );
