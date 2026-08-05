-- Migration: 038_backfill_anchor_date_and_repair.sql
-- Description:
-- Prepaid/wallet bills that were created before anchor_date tracking was added
-- have anchor_date = NULL. The engine falls back to created_at, but since
-- created_at can differ from what the user intends, occurrences end up wrong.
--
-- Fix:
-- 1. For all active prepaid/wallet bills where anchor_date IS NULL,
--    set anchor_date = created_at::date so the engine has a consistent base.
-- 2. Full wipe + regenerate all non-paid occurrences with the corrected engine.

BEGIN;

-- Step 1: Backfill anchor_date from created_at for NULL-anchor prepaid/wallet bills.
UPDATE public.bills
SET anchor_date = created_at::date
WHERE anchor_date IS NULL
  AND behavior_type IN ('prepaid_validity', 'wallet_balance')
  AND is_active = true;

-- Step 2: Delete ALL non-paid, non-skipped occurrences so the engine starts fresh.
DELETE FROM public.bill_occurrences
WHERE state NOT IN ('paid', 'skipped');

-- Step 3: Regenerate occurrences for every active bill using the corrected engine.
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
