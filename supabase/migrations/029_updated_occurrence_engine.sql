-- Migration: 029_updated_occurrence_engine
-- Description: Refactors the occurrence engine to support anchor_date.
--   1. _compute_bill_due_date — single source-of-truth helper (also used by preview)
--   2. generate_next_occurrence — updated engine (backward-compatible)
--   3. preview_bill_occurrences — RPC for live recurrence previews in the UI
--
-- Backward compatibility guarantee:
--   Bills with anchor_date IS NULL follow the exact same code paths as before.
--   Only bills with anchor_date set (created by the new UI) use the new paths.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Helper: compute due_date from a cycle_start + bill parameters
--    This is the canonical due_date formula, shared by the engine and preview.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public._compute_bill_due_date(
  p_cycle_start         date,
  p_behavior_type       text,
  p_repeat_kind         text,
  p_due_day_offset      int,
  p_validity_days       int,
  p_check_interval_days int,
  p_anchor_date         date
) RETURNS date
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_anchor_month int;
  v_anchor_day   int;
  v_max_day      int;
  v_month_start  date;
BEGIN
  -- ── FIXED DUE DATE ──────────────────────────────────────────────────────────
  IF p_behavior_type = 'fixed_due_date' THEN

    IF p_repeat_kind = 'yearly' AND p_anchor_date IS NOT NULL THEN
      -- Yearly with anchor: use anchor month+day in the cycle year.
      -- Clamp day to the month's actual length (handles e.g. Feb 29 in non-leap years).
      v_anchor_month := EXTRACT(month FROM p_anchor_date)::int;
      v_anchor_day   := EXTRACT(day   FROM p_anchor_date)::int;
      v_month_start  := make_date(EXTRACT(year FROM p_cycle_start)::int, v_anchor_month, 1);
      v_max_day      := EXTRACT(day FROM (v_month_start + interval '1 month' - interval '1 day'))::int;
      RETURN make_date(
        EXTRACT(year FROM p_cycle_start)::int,
        v_anchor_month,
        LEAST(v_anchor_day, v_max_day)
      );

    ELSIF p_repeat_kind = 'none' AND p_anchor_date IS NOT NULL THEN
      -- One-time: the anchor IS the due date.
      RETURN p_anchor_date;

    ELSE
      -- Monthly (or legacy yearly/every_x_* without anchor_date): use due_day_offset.
      -- due_day_offset = 0  → last day of month
      -- due_day_offset = N  → Nth day (clamped to month length)
      v_max_day := EXTRACT(day FROM (
        date_trunc('month', p_cycle_start) + interval '1 month' - interval '1 day'
      ))::int;

      IF COALESCE(p_due_day_offset, 0) = 0 THEN
        RETURN (date_trunc('month', p_cycle_start) + interval '1 month' - interval '1 day')::date;
      ELSE
        RETURN (
          date_trunc('month', p_cycle_start)
          + (LEAST(p_due_day_offset, v_max_day) - 1 || ' days')::interval
        )::date;
      END IF;
    END IF;

  -- ── PREPAID VALIDITY ────────────────────────────────────────────────────────
  ELSIF p_behavior_type = 'prepaid_validity' THEN
    IF p_validity_days IS NOT NULL THEN
      -- Legacy / explicitly set: expire after N days.
      RETURN (p_cycle_start + (p_validity_days || ' days')::interval)::date;
    ELSE
      -- New model: the cycle_start IS the payment/due date.
      RETURN p_cycle_start;
    END IF;

  -- ── WALLET BALANCE ──────────────────────────────────────────────────────────
  ELSIF p_behavior_type = 'wallet_balance' THEN
    IF p_check_interval_days IS NOT NULL THEN
      -- Legacy / explicitly set: check after N days.
      RETURN (p_cycle_start + (p_check_interval_days || ' days')::interval)::date;
    ELSE
      -- New model: the cycle_start IS the check date.
      RETURN p_cycle_start;
    END IF;
  END IF;

  -- Fallback (should never reach here with valid data)
  RETURN p_cycle_start;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Updated main occurrence generation engine
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
  v_anchor_month  int;
  v_anchor_day    int;
  v_state         text;
BEGIN
  -- Lock the bill row to prevent concurrent generation races.
  SELECT * INTO v_bill FROM public.bills WHERE id = p_bill_id FOR UPDATE;
  IF NOT FOUND OR NOT v_bill.is_active THEN RETURN; END IF;

  SELECT max(cycle_start) INTO v_latest_cycle
  FROM public.bill_occurrences WHERE bill_id = p_bill_id;

  -- Cache anchor month/day to avoid repeated EXTRACT calls inside the loop.
  IF v_bill.anchor_date IS NOT NULL THEN
    v_anchor_month := EXTRACT(month FROM v_bill.anchor_date)::int;
    v_anchor_day   := EXTRACT(day   FROM v_bill.anchor_date)::int;
  END IF;

  LOOP
    -- ── DERIVE NEXT CYCLE START ─────────────────────────────────────────────

    IF v_latest_cycle IS NULL THEN
      -- ── FIRST OCCURRENCE ───────────────────────────────────────────────────

      IF v_bill.behavior_type = 'fixed_due_date' AND v_bill.repeat_kind = 'monthly' THEN
        -- Anchor to 1st of creation month; advance one month if due_date already passed.
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
          -- New path: anchor to 1st of anchor_month in creation year.
          v_next_cycle := make_date(
            EXTRACT(year FROM v_bill.created_at)::int, v_anchor_month, 1
          );
          v_due_date := public._compute_bill_due_date(
            v_next_cycle, v_bill.behavior_type, v_bill.repeat_kind,
            v_bill.due_day_offset, v_bill.validity_days, v_bill.check_interval_days,
            v_bill.anchor_date
          );
          -- If the annual due date has already passed this year, push to next year.
          IF v_due_date < v_bill.created_at::date THEN
            v_next_cycle := make_date(
              EXTRACT(year FROM v_bill.created_at)::int + 1, v_anchor_month, 1
            );
          END IF;
        ELSE
          -- Legacy path (no anchor_date): mirror old behavior.
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
        -- One-time: use anchor_date if set, else created_at.
        v_next_cycle := COALESCE(v_bill.anchor_date, v_bill.created_at::date);

      ELSE
        -- prepaid, wallet, or legacy fixed every_x_*:
        -- Use anchor_date as the first cycle start when set.
        v_next_cycle := COALESCE(v_bill.anchor_date, v_bill.created_at::date);
      END IF;

    ELSE
      -- ── SUBSEQUENT OCCURRENCE ──────────────────────────────────────────────
      IF v_bill.repeat_kind = 'none' THEN RETURN; END IF;

      CASE v_bill.repeat_kind
        WHEN 'monthly' THEN
          v_next_cycle := (v_latest_cycle + interval '1 month')::date;

        WHEN 'yearly' THEN
          IF v_bill.behavior_type = 'fixed_due_date' AND v_bill.anchor_date IS NOT NULL THEN
            -- Keep advancing in anchor_month — never drift to a different month.
            v_next_cycle := make_date(
              EXTRACT(year FROM v_latest_cycle)::int + 1, v_anchor_month, 1
            );
          ELSE
            v_next_cycle := (v_latest_cycle + interval '1 year')::date;
          END IF;

        WHEN 'every_x_days' THEN
          v_next_cycle := (
            v_latest_cycle + (COALESCE(v_bill.repeat_interval, 1) || ' days')::interval
          )::date;

        WHEN 'every_x_weeks' THEN
          v_next_cycle := (
            v_latest_cycle + (COALESCE(v_bill.repeat_interval, 1) * 7 || ' days')::interval
          )::date;

        WHEN 'every_x_months' THEN
          v_next_cycle := (
            v_latest_cycle + (COALESCE(v_bill.repeat_interval, 1) || ' months')::interval
          )::date;

        ELSE
          RETURN;
      END CASE;
    END IF;

    -- ── COMPUTE TARGET DATES ──────────────────────────────────────────────────
    v_due_date := public._compute_bill_due_date(
      v_next_cycle,
      v_bill.behavior_type, v_bill.repeat_kind,
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

    -- ── INSERT — idempotent via ON CONFLICT ───────────────────────────────────
    INSERT INTO public.bill_occurrences (
      bill_id, cycle_start, generation_date, expected_payment_date,
      due_date, state, amount, generation_version, generated_at
    ) VALUES (
      p_bill_id, v_next_cycle, v_gen_date, v_exp_pay_date,
      v_due_date, v_state, v_bill.amount_expected, 1, now()
    )
    ON CONFLICT (bill_id, cycle_start) DO NOTHING;

    v_latest_cycle := v_next_cycle;

    -- Stop once we have a future occurrence; loop catches up past ones.
    EXIT WHEN v_due_date >= CURRENT_DATE;
    EXIT WHEN v_bill.repeat_kind = 'none';
  END LOOP;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Preview RPC — used by the UI for live recurrence previews.
--    Uses the same _compute_bill_due_date helper as the real engine,
--    guaranteeing UI/backend parity.
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
  v_max_iter     int     := 400; -- safety ceiling (handles far-past anchors)
BEGIN
  -- Input guard
  IF p_repeat_kind IS NULL OR p_behavior_type IS NULL THEN
    RETURN '[]'::json;
  END IF;

  IF p_anchor_date IS NOT NULL THEN
    v_anchor_month := EXTRACT(month FROM p_anchor_date)::int;
  END IF;

  -- ── DERIVE FIRST CYCLE START (mirrors the engine's first-occurrence logic) ──

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
    -- prepaid / wallet — anchor_date is the first cycle start (fall back to today).
    v_cycle_start := COALESCE(p_anchor_date, p_preview_from);
  END IF;

  -- ── GENERATE UP TO p_count UPCOMING DUE DATES ───────────────────────────────
  LOOP
    EXIT WHEN v_iterations >= v_max_iter;
    EXIT WHEN COALESCE(array_length(v_results, 1), 0) >= p_count;
    v_iterations := v_iterations + 1;

    v_due_date := public._compute_bill_due_date(
      v_cycle_start, p_behavior_type, p_repeat_kind,
      p_due_day_offset, p_validity_days, p_check_interval_days, p_anchor_date
    );

    -- Only collect occurrences on or after the preview start date.
    IF v_due_date >= p_preview_from THEN
      v_results := array_append(v_results, v_due_date);
    END IF;

    -- One-time bills produce exactly one occurrence.
    EXIT WHEN p_repeat_kind = 'none';

    -- Advance cycle_start using the same rules as the engine.
    CASE p_repeat_kind
      WHEN 'monthly' THEN
        v_cycle_start := (v_cycle_start + interval '1 month')::date;

      WHEN 'yearly' THEN
        IF p_behavior_type = 'fixed_due_date' AND p_anchor_date IS NOT NULL THEN
          v_cycle_start := make_date(
            EXTRACT(year FROM v_cycle_start)::int + 1, v_anchor_month, 1
          );
        ELSE
          v_cycle_start := (v_cycle_start + interval '1 year')::date;
        END IF;

      WHEN 'every_x_days' THEN
        v_cycle_start := (
          v_cycle_start + (COALESCE(p_repeat_interval, 1) || ' days')::interval
        )::date;

      WHEN 'every_x_weeks' THEN
        v_cycle_start := (
          v_cycle_start + (COALESCE(p_repeat_interval, 1) * 7 || ' days')::interval
        )::date;

      WHEN 'every_x_months' THEN
        v_cycle_start := (
          v_cycle_start + (COALESCE(p_repeat_interval, 1) || ' months')::interval
        )::date;

      ELSE EXIT;
    END CASE;
  END LOOP;

  RETURN to_json(v_results);
END;
$$;

-- Grant execute to authenticated users (required for supabase.rpc() calls)
GRANT EXECUTE ON FUNCTION public.preview_bill_occurrences TO authenticated;
GRANT EXECUTE ON FUNCTION public._compute_bill_due_date TO authenticated;
