-- Migration: 033_repair_prepaid_occurrences
-- Description: Wipes generated occurrences again after fixing the offset.

BEGIN;

DELETE FROM public.bill_occurrences
WHERE state IN ('upcoming', 'generated');

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
