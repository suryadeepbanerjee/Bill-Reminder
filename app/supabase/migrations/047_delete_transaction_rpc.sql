-- Migration 047: Add soft delete to occurrences and delete_occurrence_transaction RPC

-- 1. Add deleted_at column
ALTER TABLE public.bill_occurrences ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- 2. Create RPC
CREATE OR REPLACE FUNCTION public.delete_occurrence_transaction(
  p_occurrence_id uuid,
  p_anchor_action text,
  p_custom_anchor date
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_occ record;
  v_bill record;
  v_latest_paid record;
  v_new_anchor date;
BEGIN
  -- 1. Fetch occurrence and lock bill
  SELECT * INTO v_occ FROM public.bill_occurrences WHERE id = p_occurrence_id AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND OR v_occ.state != 'paid' THEN
    RETURN;
  END IF;

  SELECT * INTO v_bill FROM public.bills WHERE id = v_occ.bill_id FOR UPDATE;

  -- 2. Determine if it's the latest paid occurrence
  SELECT * INTO v_latest_paid 
  FROM public.bill_occurrences 
  WHERE bill_id = v_bill.id 
    AND state = 'paid' 
    AND deleted_at IS NULL
  ORDER BY cycle_start DESC 
  LIMIT 1;

  -- 3. Soft delete the target occurrence
  UPDATE public.bill_occurrences 
  SET deleted_at = now(), updated_at = now()
  WHERE id = p_occurrence_id;

  -- 4. If it WAS the latest paid occurrence, we need to regenerate
  IF v_latest_paid.id = p_occurrence_id THEN
    -- Delete future unpaid occurrences
    DELETE FROM public.bill_occurrences
    WHERE bill_id = v_bill.id 
      AND state IN ('upcoming', 'generated', 'expected_payment', 'due_today', 'overdue')
      AND cycle_start >= v_occ.cycle_start;

    -- Handle anchor date shifting
    IF v_bill.behavior_type IN ('prepaid_validity', 'wallet_balance') THEN
      IF p_anchor_action = 'revert' THEN
        -- Find the new latest paid occurrence
        SELECT * INTO v_latest_paid 
        FROM public.bill_occurrences 
        WHERE bill_id = v_bill.id 
          AND state = 'paid' 
          AND deleted_at IS NULL
        ORDER BY cycle_start DESC 
        LIMIT 1;
        
        IF FOUND AND v_latest_paid.paid_at IS NOT NULL THEN
          v_new_anchor := (v_latest_paid.paid_at AT TIME ZONE 'UTC')::date;
        ELSE
          v_new_anchor := v_bill.created_at::date;
        END IF;

        UPDATE public.bills SET anchor_date = v_new_anchor, updated_at = now() WHERE id = v_bill.id;
      ELSIF p_anchor_action = 'custom' AND p_custom_anchor IS NOT NULL THEN
        IF p_custom_anchor >= v_bill.created_at::date AND p_custom_anchor <= current_date THEN
          UPDATE public.bills SET anchor_date = p_custom_anchor, updated_at = now() WHERE id = v_bill.id;
        ELSE
          RAISE EXCEPTION 'Custom anchor date must be between bill creation and today';
        END IF;
      END IF;
    END IF;

    -- Generate next occurrence (will replace the one we just deleted)
    PERFORM public.generate_next_occurrence(v_bill.id);
  END IF;

END;
$$;
