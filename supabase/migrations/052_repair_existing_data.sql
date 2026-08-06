-- Migration 052: Repair existing occurrence data with the canonical engine
-- ─────────────────────────────────────────────────────────────────────────────
-- Runs MODE 2 (full rebuild) for every active bill:
--   * duplicate open chains (cron duplicates) are soft-deleted
--   * the single canonical next occurrence is rebuilt from the bill definition
--     with corrected cycle/due/generation dates (Sim-1 clamp, yearly anchor)
--   * pending reminders for cleared occurrences are cancelled (the 15-minute
--     materializer re-creates them from the corrected dates)
--   * paid / archived history is preserved forever
-- Also sweeps orphan pending reminders (old partial cancels) and re-runs the
-- state machine so due_today/overdue are correct.

DO $$
DECLARE
  v_bill    record;
  v_total   int := 0;
  v_before  int;
  v_after   int;
  v_dup     int;
BEGIN
  SELECT count(*) INTO v_before
  FROM public.bill_occurrences
  WHERE deleted_at IS NULL AND state NOT IN ('paid', 'archived');

  FOR v_bill IN SELECT id FROM public.bills WHERE is_active = true LOOP
    PERFORM public.generate_next_occurrence(v_bill.id, true);
    v_total := v_total + 1;
  END LOOP;

  -- Sweep: cancel pending reminders pointing at any soft-deleted occurrence
  -- (covers orphans left by pre-051 partial cancels).
  UPDATE public.scheduled_reminders sr
  SET status = 'cancelled'
  FROM public.bill_occurrences bo
  WHERE sr.occurrence_id = bo.id
    AND bo.deleted_at IS NOT NULL
    AND sr.status = 'pending';

  -- Re-run the state machine so due_today/overdue states are correct
  PERFORM public.transition_bill_occurrences();

  -- Self-check: after a rebuild no bill may have more than one open
  -- occurrence with due_date >= today (the engine produces exactly one
  -- future row per bill; overdue rows are all < today).
  SELECT count(*) INTO v_dup
  FROM (
    SELECT bill_id
    FROM public.bill_occurrences
    WHERE deleted_at IS NULL
      AND state NOT IN ('paid', 'archived')
      AND due_date >= CURRENT_DATE
    GROUP BY bill_id
    HAVING count(*) > 1
  ) d;

  IF v_dup > 0 THEN
    RAISE EXCEPTION 'Repair incomplete: % bill(s) still have duplicate future chains', v_dup;
  END IF;

  SELECT count(*) INTO v_after
  FROM public.bill_occurrences
  WHERE deleted_at IS NULL AND state NOT IN ('paid', 'archived');

  RAISE NOTICE 'Repair complete: % active bills rebuilt. Open occurrences: % → %',
    v_total, v_before, v_after;
END $$;
