-- Migration 046: Add mark_occurrence_paid RPC

-- Drop the after update trigger to prevent double-firing since the RPC now handles this
DROP TRIGGER IF EXISTS occurrences_after_update_paid ON public.bill_occurrences;
DROP FUNCTION IF EXISTS public.tr_generate_on_paid();

-- Create RPC
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
  -- 1. Fetch occurrence
  SELECT * INTO v_occ FROM public.bill_occurrences WHERE id = p_occurrence_id FOR UPDATE;
  IF NOT FOUND OR v_occ.state = 'paid' THEN
    RETURN;
  END IF;

  -- 2. Fetch bill
  SELECT * INTO v_bill FROM public.bills WHERE id = v_occ.bill_id;

  -- 3. Update occurrence
  UPDATE public.bill_occurrences
  SET
    state = 'paid',
    paid_at = p_paid_at,
    paid_amount = p_paid_amount,
    payment_notes = p_payment_notes,
    receipt_path = p_receipt_path,
    updated_at = now()
  WHERE id = p_occurrence_id;

  -- 4. Handle next occurrence generation based on shift flag
  IF p_shift_anchor AND v_bill.behavior_type IN ('prepaid_validity', 'wallet_balance') THEN
    v_new_anchor := (p_paid_at AT TIME ZONE 'UTC')::date;
    
    -- This UPDATE triggers bills_after_update_generate which deletes upcoming and runs generate_next_occurrence
    UPDATE public.bills 
    SET 
      anchor_date = v_new_anchor,
      updated_at = now()
    WHERE id = v_occ.bill_id;
  ELSE
    -- No anchor shift, just generate the next occurrence based on original schedule
    PERFORM public.generate_next_occurrence(v_occ.bill_id);
  END IF;
END;
$$;
