-- Migration 058: Add membership checks to SECURITY DEFINER RPCs (H-1)
-- ─────────────────────────────────────────────────────────────────────────────
-- Problem: mark_occurrence_paid, delete_occurrence_transaction,
-- generate_next_occurrence (both overloads), repair_all_occurrences and
-- claim_pending_reminders are SECURITY DEFINER but never verify that the
-- caller can act on the target bill's household. RLS does not apply inside
-- SECURITY DEFINER, so ANY authenticated user could mutate another
-- household's schedule — mark paid, delete transactions, rebuild chains.
--
-- Fix: every function now checks the caller belongs to the target bill's
-- household with an active admin/editor role, via the new shared helper
-- is_household_editor(). Two context subtleties are handled:
--
--   1. generate_next_occurrence is ALSO called by triggers inside user-
--      initiated DML (bills INSERT/UPDATE succeed only after RLS passes, so
--      the caller is already a known editor — the check passes) AND by the
--      daily cron via the service role (auth.uid() IS NULL → check skipped,
--      cron keeps working).
--   2. claim_pending_reminders + repair_all_occurrences are global jobs that
--      mail / rebuild reminders for EVERY household. They must be callable
--      ONLY by non-user roles (service_role / postgres / pg_cron), so the
--      guard requires auth.uid() IS NULL, and EXECUTE is revoked from
--      anon/authenticated.
--
-- Bodies for generate_next_occurrence / mark_occurrence_paid are taken
-- verbatim from 054 (the canonical version) with the guard injected, so 054's
-- proven behavior is preserved byte-for-byte.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Shared helper — active member with admin or editor role
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_household_editor(hh uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.household_members
    WHERE household_id = hh
      AND user_id = auth.uid()
      AND status = 'active'
      AND role IN ('admin', 'editor')
  );
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. MODE 1 — incremental engine (054 body + editor check)
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

  -- H-1: if a real user is calling (not service-role cron), they must be an
  -- active editor of this bill's household.
  IF auth.uid() IS NOT NULL AND NOT public.is_household_editor(v_bill.household_id) THEN
    RAISE EXCEPTION 'Not authorized to modify this bill';
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
-- 3. MODE 2 — full rebuild engine (054 body + editor check)
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

  -- H-1: user-context callers must be an active editor of this bill's household.
  IF auth.uid() IS NOT NULL AND NOT public.is_household_editor(v_bill.household_id) THEN
    RAISE EXCEPTION 'Not authorized to modify this bill';
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
-- 4. mark_occurrence_paid — 054 body + editor check (guard before first write)
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

  -- H-1: the caller must be an active editor of the bill's household.
  IF NOT public.is_household_editor(v_bill.household_id) THEN
    RAISE EXCEPTION 'Not authorized to modify this bill';
  END IF;

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
-- 5. delete_occurrence_transaction — 051 body + editor check
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

  -- H-1: the caller must be an active editor of the bill's household.
  IF NOT public.is_household_editor(v_bill.household_id) THEN
    RAISE EXCEPTION 'Not authorized to delete this transaction';
  END IF;

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

  -- Rebuild the chain from the bill definition (MODE 2).
  PERFORM public.generate_next_occurrence(v_bill.id, true);
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. repair_all_occurrences — global job: service_role/postgres only
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.repair_all_occurrences()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_bill_id uuid;
BEGIN
  -- H-1: only non-user roles (service_role, postgres, pg_cron) may trigger a
  -- full-project rebuild. auth.uid() is NULL for those roles; authenticated
  -- users are blocked even if a stray EXECUTE grant ever exists.
  IF auth.uid() IS NOT NULL THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  FOR v_bill_id IN SELECT id FROM public.bills WHERE is_active = true LOOP
    PERFORM public.generate_next_occurrence(v_bill_id);
  END LOOP;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.repair_all_occurrences() FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.repair_all_occurrences() TO postgres, service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. claim_pending_reminders — global claimer; service_role only
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.claim_pending_reminders()
RETURNS table (
  id uuid,
  occurrence_id uuid,
  rule_id uuid,
  scheduled_for timestamptz,
  channel text,
  bill_id uuid,
  user_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- H-1 / M-3: only the reminder-dispatcher (service_role) may claim global
  -- reminders. auth.uid() is NULL for service_role, non-NULL for end users.
  IF auth.uid() IS NOT NULL THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN QUERY
  WITH claimed AS (
    UPDATE public.scheduled_reminders sr
    SET status = 'sent', sent_at = now()
    WHERE sr.id IN (
      SELECT sr2.id
      FROM public.scheduled_reminders sr2
      WHERE sr2.status = 'pending'
      AND sr2.scheduled_for <= now()
      ORDER BY sr2.scheduled_for
      LIMIT 50
      FOR UPDATE SKIP LOCKED
    )
    RETURNING *
  )
  SELECT
    c.id,
    c.occurrence_id,
    c.rule_id,
    c.scheduled_for,
    c.channel,
    bo.bill_id,
    b.created_by AS user_id
  FROM claimed c
  JOIN public.bill_occurrences bo ON bo.id = c.occurrence_id
  JOIN public.bills b ON b.id = bo.bill_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.claim_pending_reminders() FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_pending_reminders() TO service_role;