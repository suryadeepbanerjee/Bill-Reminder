-- Migration: 039_unify_due_date_engine.sql
-- Description:
--   Root-cause fix for two bugs:
--
--   BUG 1 (yearly fixed_due_date, e.g. Domain renewal):
--     generate_next_occurrence never read anchor_date/anchor_month for
--     fixed_due_date bills. It used due_day_offset (a monthly-only concept,
--     which the yearly form never sets — so it's always 0) and the bill's
--     created_at month. Result: "last day of the month you happened to add
--     the bill in", completely ignoring the anchor date you picked.
--
--   BUG 2 (prepaid every_x_days, e.g. every 60 days):
--     generate_next_occurrence correctly advanced cycle_start by the
--     interval (+60 days), then THREW THAT AWAY and re-snapped the due
--     date back to "day <anchor_day> of whatever month it landed in".
--     That snap only makes sense for monthly/yearly recurrence. Applied to
--     every_x_days/weeks/months it silently overwrites your interval math
--     every cycle, causing drift.
--
--   UNDERLYING CAUSE: generate_next_occurrence (the engine that writes
--   real rows) and preview_bill_occurrences (what you see in the UI before
--   saving) were two separately hand-maintained copies of the same logic.
--   They drifted apart across migrations 029-038. This migration deletes
--   the duplication: both now call the SAME two helper functions below.
--   There is no longer a second place for this logic to live and rot.
--
-- ─────────────────────────────────────────────────────────────────────────
-- 1. _compute_next_cycle_start — SINGLE SOURCE OF TRUTH for cycle stepping
--    Used by both generate_next_occurrence and preview_bill_occurrences.
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public._compute_next_cycle_start(
  p_behavior_type      text,
  p_repeat_kind        text,
  p_repeat_interval    int,
  p_anchor_date        date,
  p_created_at         timestamptz,
  p_latest_cycle_start date          -- NULL means "give me the first cycle"
) RETURNS date
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_next date;
BEGIN
  -- ── FIRST OCCURRENCE ──────────────────────────────────────────────────
  IF p_latest_cycle_start IS NULL THEN
    IF p_behavior_type IN ('prepaid_validity', 'wallet_balance') THEN
      RETURN COALESCE(p_anchor_date, p_created_at::date);
    ELSIF p_behavior_type = 'fixed_due_date' THEN
      IF p_repeat_kind = 'yearly' THEN
        -- Anchor to the anchor month, in the year the bill was created.
        -- (_compute_bill_due_date will clamp to the anchor day and roll
        -- the year forward if that first date has already passed.)
        IF p_anchor_date IS NOT NULL THEN
          RETURN make_date(EXTRACT(year FROM p_created_at)::int, EXTRACT(month FROM p_anchor_date)::int, 1);
        END IF;
        RETURN date_trunc('month', p_created_at)::date;
      ELSIF p_repeat_kind = 'monthly' THEN
        RETURN date_trunc('month', p_created_at)::date;
      ELSE
        -- 'none' one-time bill: the anchor IS the due date.
        RETURN COALESCE(p_anchor_date, p_created_at::date);
      END IF;
    ELSE
      RETURN p_created_at::date;
    END IF;
  END IF;

  -- ── SUBSEQUENT OCCURRENCES ───────────────────────────────────────────
  CASE p_repeat_kind
    WHEN 'none' THEN
      RETURN NULL;  -- caller stops the loop

    WHEN 'monthly' THEN
      v_next := (p_latest_cycle_start + interval '1 month')::date;
      -- Snap to anchor DAY only for prepaid/wallet (fixed_due_date uses
      -- due_day_offset, handled entirely inside _compute_bill_due_date).
      IF p_behavior_type IN ('prepaid_validity', 'wallet_balance') AND p_anchor_date IS NOT NULL THEN
        v_next := public._snap_to_anchor(v_next, p_anchor_date, false);
      END IF;
      RETURN v_next;

    WHEN 'yearly' THEN
      v_next := (p_latest_cycle_start + interval '1 year')::date;
      IF p_behavior_type = 'fixed_due_date' THEN
        IF p_anchor_date IS NOT NULL THEN
          RETURN make_date(EXTRACT(year FROM v_next)::int, EXTRACT(month FROM p_anchor_date)::int, 1);
        END IF;
        RETURN v_next;
      ELSE
        IF p_anchor_date IS NOT NULL THEN
          RETURN public._snap_to_anchor(v_next, p_anchor_date, true);
        END IF;
        RETURN v_next;
      END IF;

    -- ── Interval-based recurrence: PURE ARITHMETIC. NEVER re-snap to a
    --    day-of-month. That snap is what caused the 60-day drift bug.
    WHEN 'every_x_days' THEN
      RETURN (p_latest_cycle_start + (COALESCE(p_repeat_interval, 1) || ' days')::interval)::date;

    WHEN 'every_x_weeks' THEN
      RETURN (p_latest_cycle_start + (COALESCE(p_repeat_interval, 1) * 7 || ' days')::interval)::date;

    WHEN 'every_x_months' THEN
      RETURN (p_latest_cycle_start + (COALESCE(p_repeat_interval, 1) || ' months')::interval)::date;

    ELSE
      RETURN NULL;
  END CASE;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- 2. _compute_bill_due_date — kept from migration 029 (this one was
--    already correct — it just wasn't being called consistently). Restated
--    here so this migration is self-contained and the intent is explicit.
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public._compute_bill_due_date(
  p_cycle_start   date,
  p_behavior_type text,
  p_repeat_kind   text,
  p_due_day_offset int,
  p_anchor_date   date
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
  IF p_behavior_type = 'fixed_due_date' THEN

    IF p_repeat_kind = 'yearly' AND p_anchor_date IS NOT NULL THEN
      v_anchor_month := EXTRACT(month FROM p_anchor_date)::int;
      v_anchor_day   := EXTRACT(day   FROM p_anchor_date)::int;
      v_month_start  := make_date(EXTRACT(year FROM p_cycle_start)::int, v_anchor_month, 1);
      v_max_day      := EXTRACT(day FROM (v_month_start + interval '1 month' - interval '1 day'))::int;
      RETURN make_date(EXTRACT(year FROM p_cycle_start)::int, v_anchor_month, LEAST(v_anchor_day, v_max_day));

    ELSIF p_repeat_kind = 'none' AND p_anchor_date IS NOT NULL THEN
      RETURN p_anchor_date;

    ELSE
      -- Monthly: due_day_offset = 0 -> last day of month, else clamp to Nth day.
      v_max_day := EXTRACT(day FROM (
        date_trunc('month', p_cycle_start) + interval '1 month' - interval '1 day'
      ))::int;
      IF COALESCE(p_due_day_offset, 0) = 0 THEN
        RETURN (date_trunc('month', p_cycle_start) + interval '1 month' - interval '1 day')::date;
      ELSE
        RETURN (date_trunc('month', p_cycle_start)
          + (LEAST(p_due_day_offset, v_max_day) - 1 || ' days')::interval)::date;
      END IF;
    END IF;

  ELSIF p_behavior_type IN ('prepaid_validity', 'wallet_balance') THEN
    -- Due date IS the cycle start. No re-snapping, no day-of-month games.
    RETURN p_cycle_start;
  END IF;

  RETURN p_cycle_start;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- 3. generate_next_occurrence — now just steps + computes via the helpers.
--    No more duplicated inline date math.
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.generate_next_occurrence(p_bill_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_bill                   record;
  v_latest_cycle_start     date;
  v_next_cycle_start       date;
  v_due_date               date;
  v_generation_date        date;
  v_expected_payment_date  date;
BEGIN
  SELECT * INTO v_bill FROM public.bills WHERE id = p_bill_id FOR UPDATE;
  IF NOT FOUND OR NOT v_bill.is_active THEN
    RETURN;
  END IF;

  SELECT max(cycle_start) INTO v_latest_cycle_start
  FROM public.bill_occurrences WHERE bill_id = p_bill_id;

  LOOP
    v_next_cycle_start := public._compute_next_cycle_start(
      v_bill.behavior_type, v_bill.repeat_kind, v_bill.repeat_interval,
      v_bill.anchor_date, v_bill.created_at, v_latest_cycle_start
    );

    IF v_next_cycle_start IS NULL THEN
      RETURN;  -- repeat_kind = 'none' and we already have an occurrence
    END IF;

    v_due_date := public._compute_bill_due_date(
      v_next_cycle_start, v_bill.behavior_type, v_bill.repeat_kind,
      v_bill.due_day_offset, v_bill.anchor_date
    );

    IF v_bill.behavior_type = 'fixed_due_date' THEN
      v_generation_date       := (v_due_date + (coalesce(v_bill.generation_day_offset, -7)       || ' days')::interval)::date;
      v_expected_payment_date := (v_due_date + (coalesce(v_bill.expected_payment_day_offset, -3) || ' days')::interval)::date;
    ELSIF v_bill.behavior_type = 'prepaid_validity' THEN
      v_generation_date       := (v_due_date - interval '3 days')::date;
      v_expected_payment_date := v_due_date;
    ELSE -- wallet_balance
      v_generation_date       := (v_due_date - interval '1 day')::date;
      v_expected_payment_date := v_due_date;
    END IF;

    -- Skip past cycles silently (catch-up), keep looping until we reach
    -- a cycle that is due today or in the future.
    IF v_due_date < CURRENT_DATE THEN
      v_latest_cycle_start := v_next_cycle_start;
      IF v_bill.repeat_kind = 'none' THEN
        EXIT;
      END IF;
      IF v_latest_cycle_start > (CURRENT_DATE + interval '3 years')::date THEN
        EXIT;  -- safety valve against infinite loops on bad data
      END IF;
      CONTINUE;
    END IF;

    INSERT INTO public.bill_occurrences (
      bill_id, cycle_start, generation_date, expected_payment_date, due_date,
      state, amount, generation_version, generated_at
    )
    VALUES (
      p_bill_id, v_next_cycle_start, v_generation_date, v_expected_payment_date, v_due_date,
      CASE WHEN v_due_date = CURRENT_DATE THEN 'due_today' ELSE 'upcoming' END,
      v_bill.amount_expected, 2, now()
    )
    ON CONFLICT (bill_id, cycle_start) DO NOTHING;

    EXIT;
  END LOOP;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- 4. preview_bill_occurrences — now steps identically to
--    generate_next_occurrence because it calls the same helper. This is
--    what actually kills the "preview shows X, real bill shows Y" bug —
--    there is only one stepping algorithm left in the codebase.
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.preview_bill_occurrences(
  p_behavior_type   text,
  p_repeat_kind     text,
  p_repeat_interval int  DEFAULT NULL,
  p_due_day_offset  int  DEFAULT NULL,
  p_validity_days   int  DEFAULT NULL,    -- unused, kept for call-site compat
  p_check_interval_days int DEFAULT NULL, -- unused, kept for call-site compat
  p_anchor_date     date DEFAULT NULL,
  p_preview_from    date DEFAULT CURRENT_DATE,
  p_count           int  DEFAULT 5
) RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_cycle_start date;
  v_due_date    date;
  v_results     date[] := '{}';
  v_iterations  int    := 0;
  v_max_iter    int    := 400;
BEGIN
  IF p_repeat_kind IS NULL OR p_behavior_type IS NULL THEN
    RETURN '[]'::json;
  END IF;

  -- Bootstrap the very first cycle exactly like generate_next_occurrence
  -- does for a brand-new bill (p_latest_cycle_start = NULL), using "now"
  -- in place of created_at since the bill doesn't exist yet.
  v_cycle_start := public._compute_next_cycle_start(
    p_behavior_type, p_repeat_kind, p_repeat_interval,
    p_anchor_date, now(), NULL
  );

  IF v_cycle_start IS NULL THEN
    RETURN '[]'::json;
  END IF;

  LOOP
    EXIT WHEN v_iterations >= v_max_iter;
    EXIT WHEN COALESCE(array_length(v_results, 1), 0) >= p_count;
    v_iterations := v_iterations + 1;

    v_due_date := public._compute_bill_due_date(
      v_cycle_start, p_behavior_type, p_repeat_kind, p_due_day_offset, p_anchor_date
    );

    IF v_due_date >= p_preview_from THEN
      v_results := array_append(v_results, v_due_date);
    END IF;

    EXIT WHEN p_repeat_kind = 'none';

    v_cycle_start := public._compute_next_cycle_start(
      p_behavior_type, p_repeat_kind, p_repeat_interval,
      p_anchor_date, now(), v_cycle_start
    );

    EXIT WHEN v_cycle_start IS NULL;
  END LOOP;

  RETURN to_json(v_results);
END;
$$;
