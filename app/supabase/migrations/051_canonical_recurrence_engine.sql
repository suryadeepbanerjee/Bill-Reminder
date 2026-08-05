-- Migration 051: Canonical recurrence engine
-- ─────────────────────────────────────────────────────────────────────────────
-- The definitive fix for the recurrence layer. Supersedes the inline math of
-- 049 (engine) and 044 (preview helpers) by making BOTH paths call the SAME
-- two helper functions, and by fixing every known defect:
--
--   DEFECT 1 (Sim-1 proof): 049 re-snapped prepaid/wallet due dates to the
--     anchor DAY of the month, silently destroying every_x_days/weeks/months
--     interval math (cycle 2026-10-24 got due 2026-10-01). Canonical rule:
--     interval kinds are PURE ARITHMETIC; only 'monthly'/'yearly' snap.
--
--   DEFECT 2: fixed yearly/one-time bills ignored anchor_date (049 used
--     created_at's month for yearly, so "suryadeepbanerjee.in" got due dates
--     in the month the bill happened to be created).
--
--   DEFECT 3: no idempotency guard → the daily cron appended a NEW cycle on
--     top of an existing future occurrence, creating duplicate chains
--     (Jshsb Sep 1 + Oct 1, Usns Aug 31 + Sep 30, domain 2026 + 2027).
--
--   DEFECT 4: edit/anchor/delete regeneration continued from max(cycle_start)
--     of PAID rows, so a new anchor_date was ignored whenever ≥1 payment
--     existed.
--
--   DEFECT 5: pending reminders were never re-anchored after a rebuild, so
--     reminders could fire at stale dates.
--
-- Architecture (single source of truth):
--   bills.*            = the DEFINITION of the schedule (never changes per payment)
--   bill_occurrences   = a MATERIALIZED schedule; paid/archived rows are
--                        immutable history, non-terminal rows may be rebuilt
--
--   generate_next_occurrence(p_bill_id)            → MODE 1: incremental
--     Cron / new bill / mark-paid(no shift). If an open occurrence already
--     exists for today or later, do NOTHING (idempotency). Otherwise append
--     one cycle continuing from the latest non-deleted cycle.
--
--   generate_next_occurrence(p_bill_id, true)      → MODE 2: full rebuild
--     Edit / anchor change / delete transaction. Soft-delete every
--     non-terminal occurrence, cancel their pending reminders, then rebuild
--     the chain PURELY FROM THE BILL DEFINITION (never from history).
--
-- All date math lives in _compute_next_cycle_start + _compute_bill_due_date
-- (5-arg). The preview RPC already calls these helpers, so the engine and
-- the preview are now guaranteed to agree.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. _compute_next_cycle_start — SINGLE SOURCE OF TRUTH for cycle stepping
--    Fixes vs 044: prepaid/wallet + 'none' returned NULL (no occurrence ever);
--    now the anchor itself is the one and only payment.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public._compute_next_cycle_start(
  p_behavior_type      text,
  p_repeat_kind        text,
  p_repeat_interval    int,
  p_anchor_date        date,
  p_created_at         timestamptz,
  p_latest_cycle_start date          -- NULL = "give me the first cycle"
) RETURNS date
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_latest date := p_latest_cycle_start;
  v_next   date;
BEGIN
  -- ── FIRST OCCURRENCE (no prior cycle) ─────────────────────────────────
  IF v_latest IS NULL THEN
    IF p_behavior_type IN ('prepaid_validity', 'wallet_balance') THEN
      IF p_repeat_kind = 'none' THEN
        -- Prepaid one-time: the anchor IS the single payment/occurrence.
        RETURN COALESCE(p_anchor_date, p_created_at::date);
      ELSIF p_anchor_date IS NOT NULL THEN
        -- anchor_date is the LAST PAYMENT date. Treat it as the latest
        -- cycle start so we generate the *next* cycle, never the anchor.
        v_latest := p_anchor_date;
      ELSE
        RETURN p_created_at::date;
      END IF;

    ELSIF p_behavior_type = 'fixed_due_date' THEN
      IF p_repeat_kind = 'yearly' AND p_anchor_date IS NOT NULL THEN
        -- Cycle = 1st of the anchor month, in the year the bill was created.
        -- (_compute_bill_due_date pins the due day; the engine's catch-up
        -- loop rolls the year forward if that first date has passed.)
        RETURN make_date(EXTRACT(year FROM p_created_at)::int,
                         EXTRACT(month FROM p_anchor_date)::int, 1);
      ELSIF p_repeat_kind IN ('monthly', 'yearly') THEN
        RETURN date_trunc('month', p_created_at)::date;
      ELSE -- 'none'
        -- One-time fixed: the anchor IS the due date.
        RETURN COALESCE(p_anchor_date, p_created_at::date);
      END IF;
    END IF;
  END IF;

  -- ── SUBSEQUENT OCCURRENCES ───────────────────────────────────────────
  CASE p_repeat_kind
    WHEN 'none' THEN
      RETURN NULL;

    WHEN 'monthly' THEN
      v_next := (v_latest + interval '1 month')::date;
      -- Prepaid/wallet pay on the anchor DAY every month (clamped to month
      -- length). fixed_due_date uses due_day_offset, not the anchor day.
      IF p_behavior_type IN ('prepaid_validity', 'wallet_balance')
         AND p_anchor_date IS NOT NULL THEN
        v_next := public._snap_to_anchor(v_next, p_anchor_date, false);
      END IF;
      RETURN v_next;

    WHEN 'yearly' THEN
      v_next := (v_latest + interval '1 year')::date;
      IF p_behavior_type = 'fixed_due_date' THEN
        IF p_anchor_date IS NOT NULL THEN
          -- Keep the cycle pinned to the anchor month — never drift.
          RETURN make_date(EXTRACT(year FROM v_next)::int,
                           EXTRACT(month FROM p_anchor_date)::int, 1);
        END IF;
        RETURN v_next;
      ELSIF p_anchor_date IS NOT NULL THEN
        RETURN public._snap_to_anchor(v_next, p_anchor_date, true);
      ELSE
        RETURN v_next;
      END IF;

    -- Interval-based recurrence: PURE ARITHMETIC. NEVER re-snap to a
    -- day-of-month — that snap is exactly what broke the 84-day bill.
    WHEN 'every_x_days' THEN
      RETURN (v_latest + (COALESCE(p_repeat_interval, 1) || ' days')::interval)::date;

    WHEN 'every_x_weeks' THEN
      RETURN (v_latest + (COALESCE(p_repeat_interval, 1) * 7 || ' days')::interval)::date;

    WHEN 'every_x_months' THEN
      RETURN (v_latest + (COALESCE(p_repeat_interval, 1) || ' months')::interval)::date;

    ELSE
      RETURN NULL;
  END CASE;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. _compute_bill_due_date (5-arg) — SINGLE SOURCE OF TRUTH for due dates
--    Restated from 044 so this migration is self-contained and explicit.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public._compute_bill_due_date(
  p_cycle_start    date,
  p_behavior_type  text,
  p_repeat_kind    text,
  p_due_day_offset int,
  p_anchor_date    date
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
      -- Yearly: anchor month+day in the cycle year, clamped to month length
      -- (handles Feb 29 in non-leap years).
      v_anchor_month := EXTRACT(month FROM p_anchor_date)::int;
      v_anchor_day   := EXTRACT(day   FROM p_anchor_date)::int;
      v_month_start  := make_date(EXTRACT(year FROM p_cycle_start)::int, v_anchor_month, 1);
      v_max_day      := EXTRACT(day FROM (v_month_start + interval '1 month' - interval '1 day'))::int;
      RETURN make_date(EXTRACT(year FROM p_cycle_start)::int,
                       v_anchor_month,
                       LEAST(v_anchor_day, v_max_day));

    ELSIF p_repeat_kind = 'none' AND p_anchor_date IS NOT NULL THEN
      -- One-time: the anchor IS the due date.
      RETURN p_anchor_date;

    ELSE
      -- Monthly (or legacy yearly/every_x_* without anchor): due_day_offset.
      -- offset 0 = last day of month, N = Nth day clamped to month length.
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

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Drop the legacy 7-arg overload (029-era, prepaid = cycle_start +
--    validity_days). Nothing calls it anymore; keeping it is a trap.
-- ─────────────────────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public._compute_bill_due_date(
  date, text, text, integer, integer, integer, date
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. MODE 1 — incremental engine (cron / new bill / mark-paid without shift)
--    Idempotency guard + helper-driven + catch-up + collision handling.
-- ─────────────────────────────────────────────────────────────────────────────
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
  v_iterations             int := 0;
  v_inserted               int;
BEGIN
  SELECT * INTO v_bill
  FROM public.bills
  WHERE id = p_bill_id
  FOR UPDATE;

  IF NOT FOUND OR NOT v_bill.is_active THEN
    RETURN;
  END IF;

  -- IDEMPOTENCY GUARD: if an open (non-terminal, non-deleted) occurrence
  -- already exists for today or later, the chain is complete. This is what
  -- stops the daily cron from appending duplicate future cycles.
  IF EXISTS (
    SELECT 1 FROM public.bill_occurrences
    WHERE bill_id = p_bill_id
      AND deleted_at IS NULL
      AND state NOT IN ('paid', 'archived')
      AND due_date >= CURRENT_DATE
  ) THEN
    RETURN;
  END IF;

  SELECT max(cycle_start) INTO v_latest_cycle_start
  FROM public.bill_occurrences
  WHERE bill_id = p_bill_id
    AND deleted_at IS NULL;

  LOOP
    v_iterations := v_iterations + 1;
    EXIT WHEN v_iterations > 5000;  -- absolute safety valve

    v_next_cycle_start := public._compute_next_cycle_start(
      v_bill.behavior_type, v_bill.repeat_kind, v_bill.repeat_interval,
      v_bill.anchor_date, v_bill.created_at, v_latest_cycle_start
    );

    IF v_next_cycle_start IS NULL THEN
      RETURN;  -- 'none' and the cycle already exists
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

    -- Catch-up: silently step past cycles that are already due — except for
    -- one-time bills, whose single occurrence must ALWAYS materialize (even
    -- as 'overdue') or the bill would vanish from the dashboard.
    IF v_due_date < CURRENT_DATE AND v_bill.repeat_kind <> 'none' THEN
      v_latest_cycle_start := v_next_cycle_start;
      EXIT WHEN v_latest_cycle_start > (CURRENT_DATE + interval '3 years')::date;
      CONTINUE;
    END IF;

    -- Revive a soft-deleted row at this exact cycle (delete-undo case) and
    -- refresh it with the canonical dates.
    UPDATE public.bill_occurrences
    SET deleted_at = NULL,
        updated_at = now(),
        state = CASE WHEN v_due_date < CURRENT_DATE THEN 'overdue'
     WHEN v_due_date = CURRENT_DATE THEN 'due_today'
     ELSE 'upcoming' END,
        generation_date = v_generation_date,
        expected_payment_date = v_expected_payment_date,
        due_date = v_due_date,
        amount = v_bill.amount_expected,
        generation_version = 3,
        generated_at = now()
    WHERE bill_id = p_bill_id
      AND cycle_start = v_next_cycle_start
      AND deleted_at IS NOT NULL;

    IF FOUND THEN
      RETURN;
    END IF;

    INSERT INTO public.bill_occurrences (
      bill_id, cycle_start, generation_date, expected_payment_date, due_date,
      state, amount, generation_version, generated_at
    )
    VALUES (
      p_bill_id, v_next_cycle_start, v_generation_date, v_expected_payment_date, v_due_date,
      CASE WHEN v_due_date < CURRENT_DATE THEN 'overdue'
     WHEN v_due_date = CURRENT_DATE THEN 'due_today'
     ELSE 'upcoming' END,
      v_bill.amount_expected, 3, now()
    )
    ON CONFLICT (bill_id, cycle_start) DO NOTHING;

    -- ROW_COUNT tells us whether ON CONFLICT swallowed the insert. If the
    -- cycle already existed (paid history or a concurrent insert) step
    -- forward; otherwise we just added a fresh occurrence — done.
    GET DIAGNOSTICS v_inserted = ROW_COUNT;
    IF v_inserted = 0 THEN
      v_latest_cycle_start := v_next_cycle_start;
      IF v_bill.repeat_kind = 'none' THEN
        RETURN;
      END IF;
      CONTINUE;
    END IF;

    RETURN;
  END LOOP;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. MODE 2 — full rebuild engine (edit / anchor change / delete transaction)
--    Clears every non-terminal occurrence (paid/archived = immutable history),
--    cancels their pending reminders, then rebuilds the chain purely from the
--    bill definition.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.generate_next_occurrence(p_bill_id uuid, p_rebuild boolean)
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
  v_iterations             int := 0;
  v_inserted               int;
BEGIN
  SELECT * INTO v_bill
  FROM public.bills
  WHERE id = p_bill_id
  FOR UPDATE;

  IF NOT FOUND OR NOT v_bill.is_active THEN
    RETURN;
  END IF;

  IF p_rebuild THEN
    -- Soft-delete every non-terminal occurrence. 'paid' and 'archived' rows
    -- are history and are preserved forever.
    UPDATE public.bill_occurrences
    SET deleted_at = now(), updated_at = now()
    WHERE bill_id = p_bill_id
      AND deleted_at IS NULL
      AND state NOT IN ('paid', 'archived');

    -- Cancel ALL pending reminders for the bill's non-terminal occurrences
    -- (both the ones just cleared and any that will be revived with new
    -- dates). The 15-minute materializer re-creates them from the rebuilt
    -- schedule, so reminders always anchor to the corrected dates.
    UPDATE public.scheduled_reminders sr
    SET status = 'cancelled'
    FROM public.bill_occurrences bo
    WHERE sr.occurrence_id = bo.id
      AND bo.bill_id = p_bill_id
      AND bo.state NOT IN ('paid', 'archived')
      AND sr.status = 'pending';
  END IF;

  IF NOT p_rebuild AND EXISTS (
    SELECT 1 FROM public.bill_occurrences
    WHERE bill_id = p_bill_id
      AND deleted_at IS NULL
      AND state NOT IN ('paid', 'archived')
      AND due_date >= CURRENT_DATE
  ) THEN
    RETURN;
  END IF;

  IF p_rebuild THEN
    -- Rebuild from the bill definition, NEVER from occurrence history.
    v_latest_cycle_start := NULL;
  ELSE
    SELECT max(cycle_start) INTO v_latest_cycle_start
    FROM public.bill_occurrences
    WHERE bill_id = p_bill_id
      AND deleted_at IS NULL;
  END IF;

  LOOP
    v_iterations := v_iterations + 1;
    EXIT WHEN v_iterations > 5000;

    v_next_cycle_start := public._compute_next_cycle_start(
      v_bill.behavior_type, v_bill.repeat_kind, v_bill.repeat_interval,
      v_bill.anchor_date, v_bill.created_at, v_latest_cycle_start
    );

    IF v_next_cycle_start IS NULL THEN
      RETURN;
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

    IF v_due_date < CURRENT_DATE THEN
      v_latest_cycle_start := v_next_cycle_start;
      IF v_bill.repeat_kind = 'none' THEN
        RETURN;
      END IF;
      EXIT WHEN v_latest_cycle_start > (CURRENT_DATE + interval '3 years')::date;
      CONTINUE;
    END IF;

    UPDATE public.bill_occurrences
    SET deleted_at = NULL,
        updated_at = now(),
        state = CASE WHEN v_due_date < CURRENT_DATE THEN 'overdue'
     WHEN v_due_date = CURRENT_DATE THEN 'due_today'
     ELSE 'upcoming' END,
        generation_date = v_generation_date,
        expected_payment_date = v_expected_payment_date,
        due_date = v_due_date,
        amount = v_bill.amount_expected,
        generation_version = 3,
        generated_at = now()
    WHERE bill_id = p_bill_id
      AND cycle_start = v_next_cycle_start
      AND deleted_at IS NOT NULL;

    IF FOUND THEN
      RETURN;
    END IF;

    INSERT INTO public.bill_occurrences (
      bill_id, cycle_start, generation_date, expected_payment_date, due_date,
      state, amount, generation_version, generated_at
    )
    VALUES (
      p_bill_id, v_next_cycle_start, v_generation_date, v_expected_payment_date, v_due_date,
      CASE WHEN v_due_date < CURRENT_DATE THEN 'overdue'
     WHEN v_due_date = CURRENT_DATE THEN 'due_today'
     ELSE 'upcoming' END,
      v_bill.amount_expected, 3, now()
    )
    ON CONFLICT (bill_id, cycle_start) DO NOTHING;

    -- ROW_COUNT tells us whether ON CONFLICT swallowed the insert. If the
    -- cycle already existed (paid history or a concurrent insert) step
    -- forward; otherwise we just added a fresh occurrence — done.
    GET DIAGNOSTICS v_inserted = ROW_COUNT;
    IF v_inserted = 0 THEN
      v_latest_cycle_start := v_next_cycle_start;
      IF v_bill.repeat_kind = 'none' THEN
        RETURN;
      END IF;
      CONTINUE;
    END IF;

    RETURN;
  END LOOP;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. AFTER UPDATE trigger — edits now do a FULL REBUILD (MODE 2). This is
--    also the path mark_occurrence_paid uses when shifting the anchor:
--    the anchor UPDATE fires this trigger, which rebuilds from the new anchor.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.tr_generate_on_bill_update()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Only rebuild if a field affecting recurrence has changed
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
    PERFORM public.generate_next_occurrence(NEW.id, true);
  END IF;

  RETURN NEW;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. delete_occurrence_transaction — simplified to delegate the chain rebuild
--    to MODE 2. Removed the manual future-clearing (MODE 2 clears every
--    non-terminal row) and the revert-anchor fallback logic is preserved.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.delete_occurrence_transaction(
  p_occurrence_id uuid,
  p_anchor_action text,
  p_custom_anchor date
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_occ  record;
  v_bill record;
  v_new_anchor date;
  v_prev_paid  record;
BEGIN
  SELECT * INTO v_occ
  FROM public.bill_occurrences
  WHERE id = p_occurrence_id AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND OR v_occ.state != 'paid' THEN
    RAISE EXCEPTION 'Occurrence not found or not paid';
  END IF;

  SELECT * INTO v_bill
  FROM public.bills
  WHERE id = v_occ.bill_id
  FOR UPDATE;

  -- Soft-delete the target occurrence and cancel its pending reminders
  UPDATE public.bill_occurrences
  SET deleted_at = now(), updated_at = now()
  WHERE id = p_occurrence_id;

  UPDATE public.scheduled_reminders
  SET status = 'cancelled'
  WHERE occurrence_id = p_occurrence_id AND status = 'pending';

  -- Anchor handling for prepaid/wallet only (unchanged semantics from 049)
  IF v_bill.behavior_type IN ('prepaid_validity', 'wallet_balance') THEN
    IF p_anchor_action = 'keep' THEN
      NULL;

    ELSIF p_anchor_action = 'revert' THEN
      -- Previous valid paid occurrence wins; else the deleted occurrence's
      -- own paid_at (it was the start of the chain); else bill creation.
      SELECT * INTO v_prev_paid
      FROM public.bill_occurrences
      WHERE bill_id = v_bill.id
        AND state = 'paid'
        AND deleted_at IS NULL
        AND id != p_occurrence_id
      ORDER BY cycle_start DESC
      LIMIT 1;

      IF FOUND AND v_prev_paid.paid_at IS NOT NULL THEN
        v_new_anchor := (v_prev_paid.paid_at AT TIME ZONE 'UTC')::date;
      ELSIF v_occ.paid_at IS NOT NULL THEN
        v_new_anchor := (v_occ.paid_at AT TIME ZONE 'UTC')::date;
      ELSE
        v_new_anchor := v_bill.created_at::date;
      END IF;

      IF v_new_anchor < v_bill.created_at::date THEN
        v_new_anchor := v_bill.created_at::date;
      END IF;
      IF v_new_anchor > CURRENT_DATE THEN
        v_new_anchor := CURRENT_DATE;
      END IF;

      UPDATE public.bills
      SET anchor_date = v_new_anchor, updated_at = now()
      WHERE id = v_bill.id;

    ELSIF p_anchor_action = 'custom' AND p_custom_anchor IS NOT NULL THEN
      IF p_custom_anchor < v_bill.created_at::date THEN
        RAISE EXCEPTION 'Custom anchor date must be on or after bill creation date (%)', v_bill.created_at::date;
      END IF;
      IF p_custom_anchor > CURRENT_DATE THEN
        RAISE EXCEPTION 'Custom anchor date cannot be in the future';
      END IF;

      UPDATE public.bills
      SET anchor_date = p_custom_anchor, updated_at = now()
      WHERE id = v_bill.id;
    END IF;
  END IF;

  -- Rebuild the chain from the bill definition (MODE 2). For 'revert'/'custom'
  -- the anchor UPDATE above already fired the trigger; this second call is
  -- idempotent and guarantees the rebuild even for 'keep'.
  PERFORM public.generate_next_occurrence(v_bill.id, true);
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. Grants — the new MODE 2 overload is called by the trigger on behalf of
--    authenticated users, so it needs an explicit EXECUTE grant.
-- ─────────────────────────────────────────────────────────────────────────────
GRANT EXECUTE ON FUNCTION public.generate_next_occurrence(uuid, boolean) TO authenticated;
