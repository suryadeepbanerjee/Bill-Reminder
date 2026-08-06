-- Migration 054: next_due_date — "next due date" control
-- ─────────────────────────────────────────────────────────────────────────────
-- PROBLEM: A bill created with a past anchor (e.g. "last payment 1 Feb")
-- materializes only the next FUTURE occurrence (11 Oct). The user's mental
-- model is "next payment date": the preview shows the whole chain (26 Apr,
-- 19 Jul, 11 Oct) and the NEXT occurrence must be the default — with the
-- option to explicitly pick any chain date (future or past) as the next due
-- date. Picking a PAST date means the bill is genuinely overdue/today, so
-- the chain must materialize from that cycle.
--
-- WHAT CHANGES:
--   1. bills.next_due_date (date, nullable) — the chain-start override.
--      NULL = auto (first future cycle; past cycles skipped silently).
--      SET  = materialize from that cycle onward (past cycles before it are
--             skipped, it and everything after materialize — past ones as
--             'overdue'). Paid rows are untouched (ON CONFLICT skips them),
--             so a stale next_due_date is self-healing.
--   2. Engine MODE 1 + MODE 2: the catch-up branch honors next_due_date,
--      and the loop now CHAIN-BUILDS past cycles in a single call when a
--      selected past cycle is materialized (one call = the whole visible
--      chain, not one row per cron run).
--   3. bills_after_update_generate trigger now also fires on next_due_date
--      edits (MODE 2 rebuild).
--   4. mark_occurrence_paid CONSUMES the override: paying the occurrence whose
--      cycle_start = next_due_date clears it, so the chain resumes its natural
--      cadence from the (possibly shifted) anchor.
--   5. Regression tests C1-C6 (deploy gate, same fixture pattern as 053).

ALTER TABLE public.bills ADD COLUMN next_due_date date;

-- ─────────────────────────────────────────────────────────────────────────────
-- MODE 1 — incremental engine (cron / new bill / mark-paid without shift)
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

    -- Skip cycles that must NOT materialize: everything BEFORE a set
    -- next_due_date (past OR future — a future pick skips the nearer
    -- cycles, and the revive path below must never resurrect them), and
    -- past cycles when no next_due_date is set (default: only the next
    -- future occurrence exists). One-time bills always materialize their
    -- single cycle, even as 'overdue', or the bill would vanish from the
    -- dashboard.
    IF (v_bill.next_due_date IS NOT NULL AND v_next_cycle_start < v_bill.next_due_date)
       OR (v_bill.next_due_date IS NULL AND v_due_date < CURRENT_DATE AND v_bill.repeat_kind <> 'none')
    THEN
      v_latest_cycle_start := v_next_cycle_start;
      EXIT WHEN v_latest_cycle_start > (CURRENT_DATE + interval '3 years')::date;
      CONTINUE;
    END IF;

    -- Revive a soft-deleted row at this exact cycle (delete-undo case) and
    -- refresh it with the canonical dates. When next_due_date pulls past
    -- cycles into the chain, keep stepping so the whole chain materializes
    -- in one call instead of one row per cron run.
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
      IF v_due_date < CURRENT_DATE AND v_bill.repeat_kind <> 'none' THEN
        v_latest_cycle_start := v_next_cycle_start;
        CONTINUE;
      END IF;
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
    -- forward; otherwise we just added a fresh occurrence.
    GET DIAGNOSTICS v_inserted = ROW_COUNT;
    IF v_inserted = 0 THEN
      v_latest_cycle_start := v_next_cycle_start;
      IF v_bill.repeat_kind = 'none' THEN
        RETURN;
      END IF;
      CONTINUE;
    END IF;

    -- Chain-building: keep stepping while the cycle we just materialized is
    -- still in the past (selected next_due_date catch-up), so one call
    -- produces the whole visible chain. The first future cycle ends it.
    IF v_due_date < CURRENT_DATE AND v_bill.repeat_kind <> 'none' THEN
      v_latest_cycle_start := v_next_cycle_start;
      CONTINUE;
    END IF;

    RETURN;
  END LOOP;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- MODE 2 — full rebuild engine (edit / anchor change / delete transaction)
--    Clears every non-terminal occurrence (paid/archived = immutable history),
--    cancels their pending reminders, then rebuilds the chain purely from the
--    bill definition — honoring next_due_date.
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

    -- Catch-up: same semantics as MODE 1 — cycles before a set next_due_date
    -- are skipped (past OR future — a future pick skips the nearer cycles
    -- and the revive path below must never resurrect them), and ALL past
    -- cycles when next_due_date is NULL are skipped silently.
    IF (v_bill.next_due_date IS NOT NULL AND v_next_cycle_start < v_bill.next_due_date)
       OR (v_bill.next_due_date IS NULL AND v_due_date < CURRENT_DATE AND v_bill.repeat_kind <> 'none')
    THEN
      v_latest_cycle_start := v_next_cycle_start;
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
      IF v_due_date < CURRENT_DATE AND v_bill.repeat_kind <> 'none' THEN
        v_latest_cycle_start := v_next_cycle_start;
        CONTINUE;
      END IF;
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

    -- Chain-building: same as MODE 1 — a selected past cycle brings its
    -- whole chain in one rebuild; the first future cycle ends the loop.
    IF v_due_date < CURRENT_DATE AND v_bill.repeat_kind <> 'none' THEN
      v_latest_cycle_start := v_next_cycle_start;
      CONTINUE;
    END IF;

    RETURN;
  END LOOP;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- AFTER UPDATE trigger — next_due_date edits now also trigger a full rebuild.
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
     NEW.next_due_date IS DISTINCT FROM OLD.next_due_date OR
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
-- mark_occurrence_paid — same contract as 046, plus: paying the occurrence
-- whose cycle_start equals bills.next_due_date CONSUMES the override (it is a
-- one-shot instruction — once its cycle is paid the chain resumes its natural
-- cadence from the anchor). The next_due_date change fires the trigger, so the
-- rebuild happens once.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.mark_occurrence_paid(
  p_occurrence_id uuid,
  p_paid_at timestamptz,
  p_paid_amount numeric,
  p_payment_notes text,
  p_receipt_path text,
  p_shift_anchor boolean
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_occ record;
  v_bill record;
  v_new_anchor date;
BEGIN
  SELECT * INTO v_occ FROM public.bill_occurrences WHERE id = p_occurrence_id FOR UPDATE;
  IF NOT FOUND OR v_occ.state = 'paid' THEN
    RETURN;
  END IF;

  SELECT * INTO v_bill FROM public.bills WHERE id = v_occ.bill_id;

  UPDATE public.bill_occurrences
  SET
    state = 'paid',
    paid_at = p_paid_at,
    paid_amount = p_paid_amount,
    payment_notes = p_payment_notes,
    receipt_path = p_receipt_path,
    updated_at = now()
  WHERE id = p_occurrence_id;

  IF p_shift_anchor AND v_bill.behavior_type IN ('prepaid_validity', 'wallet_balance') THEN
    v_new_anchor := (p_paid_at AT TIME ZONE 'UTC')::date;

    IF v_bill.next_due_date = v_occ.cycle_start THEN
      UPDATE public.bills
      SET anchor_date = v_new_anchor, next_due_date = NULL, updated_at = now()
      WHERE id = v_occ.bill_id;
    ELSE
      UPDATE public.bills
      SET anchor_date = v_new_anchor, updated_at = now()
      WHERE id = v_occ.bill_id;
    END IF;
  ELSE
    IF v_bill.next_due_date = v_occ.cycle_start THEN
      UPDATE public.bills SET next_due_date = NULL, updated_at = now()
      WHERE id = v_occ.bill_id;
    END IF;
    PERFORM public.generate_next_occurrence(v_occ.bill_id);
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_occurrence_paid(uuid, timestamptz, numeric, text, text, boolean) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- Regression tests (deploy gate). Fixture pattern identical to 053.
-- C1: prepaid + past anchor, no next_due_date → ONE future occurrence.
-- C2: next_due_date = past cycle → full chain materializes (overdue+upcoming).
-- C3: clearing next_due_date → single future occurrence again.
-- C4: next_due_date = future cycle → that cycle becomes next (skip).
-- C5: paid history survives a next_due_date rebuild; chain continues.
-- C6: one-time bill still materializes even as overdue.
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_household uuid;
  v_category  uuid;
  v_bill_prepaid uuid;
  v_bill_once    uuid;
  v_today     date := CURRENT_DATE;
  v_rows      int;
  v_occ       record;
BEGIN

INSERT INTO public.households (name) VALUES ('__engine_054__')
  RETURNING id INTO v_household;
INSERT INTO public.categories (household_id, name, icon, color)
  VALUES (v_household, '__engine_054__', 'test', '#000000')
  RETURNING id INTO v_category;

-- C1. Prepaid every 30 days, anchor 40 days ago (last payment). Default:
--     only the next FUTURE occurrence materializes — no overdue catch-up.
INSERT INTO public.bills (
  household_id, category_id, title, behavior_type, amount_expected, currency,
  repeat_kind, repeat_interval, anchor_date, created_at
) VALUES (
  v_household, v_category, '__engine_054_prepaid__', 'prepaid_validity', 200, 'INR',
  'every_x_days', 30, v_today - 40, now() - interval '60 days'
) RETURNING id INTO v_bill_prepaid;

SELECT count(*) INTO v_rows
FROM public.bill_occurrences
WHERE bill_id = v_bill_prepaid AND deleted_at IS NULL;
ASSERT v_rows = 1, 'C1a: default must create exactly ONE open occurrence (got ' || v_rows || ')';

SELECT * INTO v_occ
FROM public.bill_occurrences
WHERE bill_id = v_bill_prepaid AND deleted_at IS NULL;
ASSERT v_occ.cycle_start = v_today + 20,
       'C1b: the open cycle must be the next future one, anchor + 30 (got ' || v_occ.cycle_start || ')';
ASSERT v_occ.state IN ('upcoming', 'due_today'),
       'C1c: default state must be upcoming, not overdue (got ' || v_occ.state || ')';

-- C2. Select a PAST pattern cycle (anchor + 30 = today - 10) as next due date.
--     The UPDATE fires the trigger → MODE 2 rebuild → the chain materializes
--     from that cycle: overdue (today-10) + the next future cycle (today+20).
--     (The cycle after that appears only once today+20 is paid — the engine
--     materializes one future occurrence ahead of the current one.)
UPDATE public.bills SET next_due_date = v_today - 10 WHERE id = v_bill_prepaid;

SELECT count(*) INTO v_rows
FROM public.bill_occurrences
WHERE bill_id = v_bill_prepaid AND deleted_at IS NULL;
ASSERT v_rows = 2, 'C2a: selected past cycle must materialize itself + next future (got ' || v_rows || ')';

SELECT count(*) INTO v_rows
FROM public.bill_occurrences
WHERE bill_id = v_bill_prepaid AND deleted_at IS NULL AND state = 'overdue';
ASSERT v_rows = 1, 'C2b: exactly one overdue row (the selected cycle)';

SELECT * INTO v_occ
FROM public.bill_occurrences
WHERE bill_id = v_bill_prepaid AND deleted_at IS NULL AND state = 'overdue';
ASSERT v_occ.cycle_start = v_today - 10,
       'C2c: the overdue cycle must be the selected one (got ' || v_occ.cycle_start || ')';

SELECT * INTO v_occ
FROM public.bill_occurrences
WHERE bill_id = v_bill_prepaid AND deleted_at IS NULL AND state IN ('upcoming', 'due_today');
ASSERT v_occ.cycle_start = v_today + 20,
       'C2d: the future cycle must follow the selected past cycle (got ' || v_occ.cycle_start || ')';

-- C3. Clear next_due_date → rebuild collapses back to a single future row.
UPDATE public.bills SET next_due_date = NULL WHERE id = v_bill_prepaid;

SELECT count(*) INTO v_rows
FROM public.bill_occurrences
WHERE bill_id = v_bill_prepaid AND deleted_at IS NULL;
ASSERT v_rows = 1, 'C3a: clearing next_due_date must collapse to ONE open row (got ' || v_rows || ')';

SELECT * INTO v_occ
FROM public.bill_occurrences
WHERE bill_id = v_bill_prepaid AND deleted_at IS NULL;
ASSERT v_occ.cycle_start = v_today + 20 AND v_occ.state IN ('upcoming', 'due_today'),
       'C3b: collapsed row must be the next future cycle (got ' || v_occ.cycle_start || ')';

-- C4. next_due_date = a FUTURE pattern cycle → that cycle becomes the next
--     one (the nearer today+20 cycle is skipped, not owed).
UPDATE public.bills SET next_due_date = v_today + 50 WHERE id = v_bill_prepaid;

SELECT count(*) INTO v_rows
FROM public.bill_occurrences
WHERE bill_id = v_bill_prepaid AND deleted_at IS NULL;
ASSERT v_rows = 1, 'C4a: future selection must produce one open row';

SELECT * INTO v_occ
FROM public.bill_occurrences
WHERE bill_id = v_bill_prepaid AND deleted_at IS NULL;
ASSERT v_occ.cycle_start = v_today + 50,
       'C4b: future selection must skip the nearer cycle (got ' || v_occ.cycle_start || ')';

-- C5. Pay the open cycle ON its due date (shift anchor) → the override is
--     consumed (cleared), paid history survives, chain resumes its natural
--     cadence (anchor + 30).
PERFORM public.mark_occurrence_paid(
  v_occ.id,
  (v_occ.cycle_start::timestamp + interval '12 hours')::timestamptz,
  200, NULL, NULL, true
);

SELECT count(*) INTO v_rows
FROM public.bill_occurrences
WHERE bill_id = v_bill_prepaid AND state = 'paid' AND deleted_at IS NULL;
ASSERT v_rows = 1, 'C5a: paid history must survive a next_due_date rebuild';

SELECT * INTO v_occ
FROM public.bill_occurrences
WHERE bill_id = v_bill_prepaid AND deleted_at IS NULL AND state <> 'paid'
ORDER BY cycle_start ASC LIMIT 1;
ASSERT v_occ.cycle_start = v_today + 80,
       'C5b: chain must continue from the paid cycle (got ' || v_occ.cycle_start || ')';

-- C6. One-time bills still materialize even as overdue (unchanged from 051).
INSERT INTO public.bills (
  household_id, category_id, title, behavior_type, amount_expected, currency,
  repeat_kind, anchor_date, created_at
) VALUES (
  v_household, v_category, '__engine_054_once__', 'fixed_due_date', 500, 'INR',
  'none', v_today - 7, now() - interval '60 days'
) RETURNING id INTO v_bill_once;

SELECT count(*) INTO v_rows
FROM public.bill_occurrences
WHERE bill_id = v_bill_once AND deleted_at IS NULL;
ASSERT v_rows = 1, 'C6a: one-time bill must materialize its single occurrence';

SELECT * INTO v_occ
FROM public.bill_occurrences
WHERE bill_id = v_bill_once AND deleted_at IS NULL;
ASSERT v_occ.state = 'overdue', 'C6b: past one-time due must be overdue (got ' || v_occ.state || ')';

-- ── Cleanup fixtures ─────────────────────────────────────────────────────────
DELETE FROM public.bill_occurrences WHERE bill_id IN (v_bill_prepaid, v_bill_once);
DELETE FROM public.bills WHERE id IN (v_bill_prepaid, v_bill_once);
DELETE FROM public.categories WHERE id = v_category;
DELETE FROM public.households WHERE id = v_household;

RAISE NOTICE 'next_due_date regression tests passed';
END $$;
