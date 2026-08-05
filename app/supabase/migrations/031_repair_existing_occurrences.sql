-- Migration: 031_repair_existing_occurrences
-- Description:
-- Drops all currently 'upcoming' or 'generated' occurrences and forces
-- the engine to regenerate them under the new snapping rules.
-- This automatically fixes the "10th Aug vs 10th Oct" or "Sep vs Aug"
-- drift issues for any existing bills without requiring manual edits.

BEGIN;

-- 1. Wipe all future auto-generated occurrences.
--    Safe to do because the engine will immediately recreate the correct ones.
DELETE FROM public.bill_occurrences
WHERE state IN ('upcoming', 'generated');

-- 2. Loop through all active bills and regenerate them
DO $$
DECLARE
  v_bill_id uuid;
BEGIN
  FOR v_bill_id IN SELECT id FROM public.bills WHERE is_active = true LOOP
    PERFORM public.generate_next_occurrence(v_bill_id);
  END LOOP;
END;
$$;

COMMIT;
