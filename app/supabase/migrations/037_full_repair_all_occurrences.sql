-- Migration: 034_full_repair_all_occurrences
-- Description:
-- The previous repair migrations (031, 033) only deleted 'upcoming'/'generated'
-- occurrences. This left stale 'overdue' occurrences from the old engine in place,
-- causing the generation engine to produce dates that are off by one full interval
-- (e.g., showing Jan 17 instead of Oct 24 for "Aug 1 + 84 days").
--
-- This migration performs a FULL WIPE of all auto-generated occurrences
-- (overdue, due_today, upcoming, generated) but preserves 'paid' and 'skipped'
-- entries so payment history is never lost.

BEGIN;

-- 1. Delete all non-paid, non-skipped occurrences across all bills.
DELETE FROM public.bill_occurrences
WHERE state NOT IN ('paid', 'skipped');

-- 2. Regenerate all bills from scratch using the corrected engine.
DO $$
DECLARE
  v_bill_id uuid;
BEGIN
  FOR v_bill_id IN
    SELECT id FROM public.bills WHERE is_active = true ORDER BY created_at
  LOOP
    PERFORM public.generate_next_occurrence(v_bill_id);
  END LOOP;
END;
$$;

COMMIT;
