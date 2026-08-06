-- Migration 039: Update anchor date on payment for variable/prepaid bills

CREATE OR REPLACE FUNCTION public.tr_generate_on_paid()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_bill record;
  v_new_anchor date;
BEGIN
  -- State transition protection: only fire if transitioning strictly from non-paid to paid
  IF NEW.state = 'paid' AND OLD.state != 'paid' THEN
    
    -- Fetch the bill to check its behavior
    SELECT * INTO v_bill FROM public.bills WHERE id = NEW.bill_id;
    
    -- If it's a prepaid, wallet, or interval-based bill, paying it should shift the cycle
    -- We do this by updating the bill's anchor_date to the date it was actually paid.
    IF v_bill.behavior_type IN ('prepaid_validity', 'wallet_balance') THEN
      v_new_anchor := (NEW.paid_at AT TIME ZONE 'UTC')::date;
      
      -- Update the bill's anchor date
      -- This will fire bills_after_update_generate, which will delete the OLD upcoming occurrences
      -- and regenerate new ones based on this new anchor date.
      UPDATE public.bills 
      SET 
        anchor_date = v_new_anchor,
        anchor_month = EXTRACT(month FROM v_new_anchor)::int,
        anchor_day = EXTRACT(day FROM v_new_anchor)::int,
        anchor_year = EXTRACT(year FROM v_new_anchor)::int,
        updated_at = now()
      WHERE id = NEW.bill_id;
      
      -- We don't need to manually call generate_next_occurrence here because the UPDATE above
      -- triggers tr_generate_on_bill_update which does exactly that.
    ELSE
      -- For fixed_due_date bills, paying early/late doesn't shift the underlying schedule
      -- So we just generate the next occurrence normally
      PERFORM public.generate_next_occurrence(NEW.bill_id);
    END IF;

  END IF;
  
  RETURN NEW;
END;
$$;
