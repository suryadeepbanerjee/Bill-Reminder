-- Migration 044: Fix first occurrence logic and stop skipping past dates

-- 1. Fix _compute_next_cycle_start so that for prepaid/wallet, anchor_date is treated
--    as the LAST payment date (i.e., we skip the anchor date itself and generate the NEXT one).
CREATE OR REPLACE FUNCTION public._compute_next_cycle_start(
  p_behavior_type      text,
  p_repeat_kind        text,
  p_repeat_interval    int,
  p_anchor_date        date,
  p_created_at         timestamptz,
  p_latest_cycle_start date
) RETURNS date
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_next date;
  v_latest date := p_latest_cycle_start;
BEGIN
  -- ── FIRST OCCURRENCE ──────────────────────────────────────────────────
  IF v_latest IS NULL THEN
    IF p_behavior_type IN ('prepaid_validity', 'wallet_balance') THEN
      IF p_anchor_date IS NOT NULL THEN
        -- anchor_date is the "Last payment date".
        -- Treat it as the latest cycle start so we compute the *next* cycle!
        v_latest := p_anchor_date;
        -- (falls through to SUBSEQUENT OCCURRENCES logic below)
      ELSE
        RETURN p_created_at::date;
      END IF;
    ELSIF p_behavior_type = 'fixed_due_date' THEN
      IF p_repeat_kind = 'yearly' THEN
        IF p_anchor_date IS NOT NULL THEN
          RETURN make_date(EXTRACT(year FROM p_created_at)::int, EXTRACT(month FROM p_anchor_date)::int, 1);
        END IF;
        RETURN date_trunc('month', p_created_at)::date;
      ELSIF p_repeat_kind = 'monthly' THEN
        RETURN date_trunc('month', p_created_at)::date;
      ELSE
        RETURN COALESCE(p_anchor_date, p_created_at::date);
      END IF;
    ELSE
      RETURN p_created_at::date;
    END IF;
  END IF;

  -- ── SUBSEQUENT OCCURRENCES ───────────────────────────────────────────
  CASE p_repeat_kind
    WHEN 'none' THEN
      RETURN NULL;

    WHEN 'monthly' THEN
      v_next := (v_latest + interval '1 month')::date;
      IF p_behavior_type IN ('prepaid_validity', 'wallet_balance') AND p_anchor_date IS NOT NULL THEN
        v_next := public._snap_to_anchor(v_next, p_anchor_date, false);
      END IF;
      RETURN v_next;

    WHEN 'yearly' THEN
      v_next := (v_latest + interval '1 year')::date;
      IF p_behavior_type = 'fixed_due_date' THEN
        IF p_anchor_date IS NOT NULL THEN
          RETURN make_date(EXTRACT(year FROM v_next)::int, EXTRACT(month FROM p_anchor_date)::int, 1);
        END IF;
        RETURN v_next;
      ELSE
        IF p_anchor_date IS NOT NULL THEN
          RETURN public._snap_to_anchor(v_next, p_anchor_date, true);
        END IF;
        RETURN v_next;
      END IF;

    WHEN 'every_x_days' THEN
      RETURN (v_latest + (COALESCE(p_repeat_interval, 1) || ' days')::interval)::date;

    WHEN 'every_x_weeks' THEN
      RETURN (v_latest + (COALESCE(p_repeat_interval, 1) * 7 || ' days')::interval)::date;

    WHEN 'every_x_months' THEN
      RETURN (v_latest + (COALESCE(p_repeat_interval, 1) || ' months')::interval)::date;

    ELSE
      RETURN NULL;
  END CASE;
END;
$$;


-- 2. Fix generate_next_occurrence to NOT skip past occurrences.
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
BEGIN
  SELECT * INTO v_bill FROM public.bills WHERE id = p_bill_id FOR UPDATE;
  IF NOT FOUND OR NOT v_bill.is_active THEN
    RETURN;
  END IF;

  SELECT max(cycle_start) INTO v_latest_cycle_start
  FROM public.bill_occurrences WHERE bill_id = p_bill_id;

  LOOP
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
    ELSE
      v_generation_date       := (v_due_date - interval '1 day')::date;
      v_expected_payment_date := v_due_date;
    END IF;

    -- WE NO LONGER SKIP PAST DATES!
    -- If it's in the past, it just gets inserted as 'overdue'.
    INSERT INTO public.bill_occurrences (
      bill_id, cycle_start, generation_date, expected_payment_date, due_date,
      state, amount, generation_version, generated_at
    )
    VALUES (
      p_bill_id, v_next_cycle_start, v_generation_date, v_expected_payment_date, v_due_date,
      CASE 
        WHEN v_due_date < CURRENT_DATE THEN 'overdue'
        WHEN v_due_date = CURRENT_DATE THEN 'due_today' 
        ELSE 'upcoming' 
      END,
      v_bill.amount_expected, 2, now()
    )
    ON CONFLICT (bill_id, cycle_start) DO NOTHING;

    EXIT; -- Always exit after generating one occurrence
  END LOOP;
END;
$$;
