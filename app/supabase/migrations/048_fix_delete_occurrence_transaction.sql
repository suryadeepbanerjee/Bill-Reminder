-- Migration 048: Fix delete_occurrence_transaction RPC
-- Fixes: soft-delete future occurrences, cancel reminders, proper chain rebuild

CREATE OR REPLACE FUNCTION public.delete_occurrence_transaction(
  p_occurrence_id uuid,
  p_anchor_action text,  -- 'keep', 'revert', 'custom'
  p_custom_anchor date
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_occ record;
  v_bill record;
  v_new_anchor date;
  v_prev_paid record;
BEGIN
  -- 1. Fetch occurrence and lock it
  SELECT * INTO v_occ
  FROM public.bill_occurrences
  WHERE id = p_occurrence_id AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND OR v_occ.state != 'paid' THEN
    RAISE EXCEPTION 'Occurrence not found or not paid';
  END IF;

  -- 2. Lock the bill
  SELECT * INTO v_bill
  FROM public.bills
  WHERE id = v_occ.bill_id
  FOR UPDATE;

  -- 3. Soft-delete the target occurrence
  UPDATE public.bill_occurrences
  SET deleted_at = now(), updated_at = now()
  WHERE id = p_occurrence_id;

  -- 4. Cancel pending reminders for this occurrence
  UPDATE public.scheduled_reminders
  SET status = 'cancelled'
  WHERE occurrence_id = p_occurrence_id AND status = 'pending';

  -- 5. Soft-delete all FUTURE unpaid occurrences (they'll be regenerated)
  UPDATE public.bill_occurrences
  SET deleted_at = now(), updated_at = now()
  WHERE bill_id = v_bill.id
    AND state IN ('upcoming', 'generated', 'expected_payment', 'due_today', 'overdue')
    AND cycle_start > v_occ.cycle_start
    AND deleted_at IS NULL;

  -- 6. Cancel pending reminders for soft-deleted future occurrences
  UPDATE public.scheduled_reminders sr
  SET status = 'cancelled'
  FROM public.bill_occurrences bo
  WHERE sr.occurrence_id = bo.id
    AND bo.bill_id = v_bill.id
    AND bo.state IN ('upcoming', 'generated', 'expected_payment', 'due_today', 'overdue')
    AND bo.cycle_start > v_occ.cycle_start
    AND bo.deleted_at IS NOT NULL
    AND sr.status = 'pending';

  -- 7. Handle anchor date for prepaid/wallet bills only
  IF v_bill.behavior_type IN ('prepaid_validity', 'wallet_balance') THEN
    IF p_anchor_action = 'keep' THEN
      -- Keep existing anchor — no change
      NULL;

    ELSIF p_anchor_action = 'revert' THEN
      -- Find the previous valid paid occurrence (not the one we just deleted)
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
      ELSE
        -- No previous paid — revert to bill creation date
        v_new_anchor := v_bill.created_at::date;
      END IF;

      -- Validate anchor date
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
      -- Validate custom date
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

  -- 8. Regenerate next occurrence (rebuilds the chain from the current anchor)
  PERFORM public.generate_next_occurrence(v_bill.id);
END;
$$;
