-- Migration 049: Fix anchor-based scheduling after delete
-- Bug 1: generate_next_occurrence didn't filter soft-deleted occurrences
--   → v_latest_cycle_start picked up deleted rows, computing next cycle from
--     the wrong date instead of falling back to anchor_date.
-- Bug 2: delete_occurrence_transaction "revert" fell back to created_at
--   → when deleting the only paid occurrence, should use its paid_at as anchor.

-- ── Fix 1: generate_next_occurrence — filter soft-deleted occurrences ─────────
CREATE OR REPLACE FUNCTION public.generate_next_occurrence(p_bill_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_bill record;
  v_latest_cycle_start date;
  v_next_cycle_start date;
  v_due_date date;
  v_generation_date date;
  v_expected_payment_date date;
  v_anchor_day int;
  v_max_day int;
BEGIN
  SELECT * INTO v_bill
  FROM public.bills
  WHERE id = p_bill_id
  FOR UPDATE;

  IF NOT found OR NOT v_bill.is_active THEN
    RETURN;
  END IF;

  SELECT public._anchor_day(v_bill.anchor_date) INTO v_anchor_day;

  -- KEY FIX: filter out soft-deleted occurrences
  SELECT max(cycle_start) INTO v_latest_cycle_start
  FROM public.bill_occurrences
  WHERE bill_id = p_bill_id
    AND deleted_at IS NULL;

  LOOP
    -- ── Calculate next cycle start ──────────────────────────────────────
    IF v_latest_cycle_start IS NULL THEN
      -- First occurrence (or all previous were deleted)
      IF v_bill.behavior_type IN ('prepaid_validity', 'wallet_balance') THEN
        IF v_bill.anchor_date IS NOT NULL THEN
          v_next_cycle_start := v_bill.anchor_date;
        ELSE
          v_next_cycle_start := v_bill.created_at::date;
        END IF;
      ELSE
        IF v_bill.repeat_kind IN ('monthly', 'yearly') THEN
          v_next_cycle_start := date_trunc('month', v_bill.created_at)::date;
        ELSE
          v_next_cycle_start := v_bill.created_at::date;
        END IF;
      END IF;
    ELSE
      IF v_bill.repeat_kind = 'none' THEN
        RETURN;
      ELSIF v_bill.repeat_kind = 'monthly' THEN
        v_next_cycle_start := (v_latest_cycle_start + interval '1 month')::date;
        IF v_bill.behavior_type IN ('prepaid_validity', 'wallet_balance') AND v_anchor_day IS NOT NULL THEN
          v_max_day := public._days_in_month(v_next_cycle_start);
          v_next_cycle_start := make_date(
            EXTRACT(year FROM v_next_cycle_start)::int,
            EXTRACT(month FROM v_next_cycle_start)::int,
            LEAST(v_anchor_day, v_max_day)
          );
        END IF;
      ELSIF v_bill.repeat_kind = 'yearly' THEN
        v_next_cycle_start := (v_latest_cycle_start + interval '1 year')::date;
        IF v_bill.behavior_type IN ('prepaid_validity', 'wallet_balance') AND v_anchor_day IS NOT NULL THEN
          v_next_cycle_start := public._snap_to_anchor(v_next_cycle_start, v_bill.anchor_date, true);
        END IF;
      ELSIF v_bill.repeat_kind = 'every_x_days' THEN
        v_next_cycle_start := (v_latest_cycle_start + (coalesce(v_bill.repeat_interval, 1) || ' days')::interval)::date;
      ELSIF v_bill.repeat_kind = 'every_x_weeks' THEN
        v_next_cycle_start := (v_latest_cycle_start + (coalesce(v_bill.repeat_interval, 1) * 7 || ' days')::interval)::date;
      ELSIF v_bill.repeat_kind = 'every_x_months' THEN
        v_next_cycle_start := (v_latest_cycle_start + (coalesce(v_bill.repeat_interval, 1) || ' months')::interval)::date;
        IF v_bill.behavior_type IN ('prepaid_validity', 'wallet_balance') AND v_anchor_day IS NOT NULL THEN
          v_next_cycle_start := public._snap_to_anchor(v_next_cycle_start, v_bill.anchor_date, false);
        END IF;
      ELSE
        RETURN;
      END IF;
    END IF;

    -- ── Calculate due date based on behaviour type ─────────────────────
    IF v_bill.behavior_type = 'fixed_due_date' THEN
      IF coalesce(v_bill.due_day_offset, 0) = 0 THEN
        v_due_date := (date_trunc('month', v_next_cycle_start) + interval '1 month' - interval '1 day')::date;
      ELSE
        v_due_date := (date_trunc('month', v_next_cycle_start)
          + (least(v_bill.due_day_offset,
                   extract(day from (date_trunc('month', v_next_cycle_start) + interval '1 month' - interval '1 day')::date))
             - 1 || ' days')::interval)::date;
      END IF;
      v_generation_date       := (v_due_date + (coalesce(v_bill.generation_day_offset, -7)       || ' days')::interval)::date;
      v_expected_payment_date := (v_due_date + (coalesce(v_bill.expected_payment_day_offset, -3) || ' days')::interval)::date;

    ELSIF v_bill.behavior_type = 'prepaid_validity' THEN
      IF v_anchor_day IS NOT NULL THEN
        v_max_day := public._days_in_month(v_next_cycle_start);
        v_due_date := make_date(
          EXTRACT(year FROM v_next_cycle_start)::int,
          EXTRACT(month FROM v_next_cycle_start)::int,
          LEAST(v_anchor_day, v_max_day)
        );
      ELSE
        v_due_date := v_next_cycle_start;
      END IF;
      v_generation_date        := (v_due_date - interval '3 days')::date;
      v_expected_payment_date  := v_due_date;

    ELSIF v_bill.behavior_type = 'wallet_balance' THEN
      IF v_anchor_day IS NOT NULL THEN
        v_max_day := public._days_in_month(v_next_cycle_start);
        v_due_date := make_date(
          EXTRACT(year FROM v_next_cycle_start)::int,
          EXTRACT(month FROM v_next_cycle_start)::int,
          LEAST(v_anchor_day, v_max_day)
        );
      ELSE
        v_due_date := v_next_cycle_start;
      END IF;
      v_generation_date        := (v_due_date - interval '1 day')::date;
      v_expected_payment_date  := v_due_date;
    END IF;

    -- ── Skip past cycles ────────────────────────────────────────────────
    IF v_due_date < CURRENT_DATE THEN
      v_latest_cycle_start := v_next_cycle_start;
      IF v_bill.repeat_kind = 'none' THEN
        EXIT;
      END IF;
      IF v_latest_cycle_start > (CURRENT_DATE + interval '3 years')::date THEN
        EXIT;
      END IF;
      CONTINUE;
    END IF;

    INSERT INTO public.bill_occurrences (
      bill_id, cycle_start, generation_date, expected_payment_date, due_date, state, amount, generation_version, generated_at
    )
    VALUES (
      p_bill_id, v_next_cycle_start, v_generation_date, v_expected_payment_date, v_due_date,
      CASE
        WHEN v_due_date = CURRENT_DATE THEN 'due_today'
        ELSE 'upcoming'
      END,
      v_bill.amount_expected, 1, now()
    )
    ON CONFLICT (bill_id, cycle_start) DO NOTHING;

    EXIT;
  END LOOP;
END;
$$;

-- ── Fix 2: delete_occurrence_transaction — use deleted occurrence's paid_at ──
--   when no previous paid exists
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
  v_new_anchor date;
  v_prev_paid record;
BEGIN
  SELECT * INTO v_occ
  FROM public.bill_occurrences
  WHERE id = p_occurrence_id AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND OR v_occ.state != 'paid' THEN
    RAISE EXCEPTION 'Occurrence not found or not paid';
  END IF;

  SELECT * INTO v_bill
  FROM public.bills
  WHERE id = v_occ.bill_id
  FOR UPDATE;

  -- Soft-delete the target
  UPDATE public.bill_occurrences
  SET deleted_at = now(), updated_at = now()
  WHERE id = p_occurrence_id;

  -- Cancel pending reminders
  UPDATE public.scheduled_reminders
  SET status = 'cancelled'
  WHERE occurrence_id = p_occurrence_id AND status = 'pending';

  -- Soft-delete future unpaid occurrences
  UPDATE public.bill_occurrences
  SET deleted_at = now(), updated_at = now()
  WHERE bill_id = v_bill.id
    AND state IN ('upcoming', 'generated', 'expected_payment', 'due_today', 'overdue')
    AND cycle_start > v_occ.cycle_start
    AND deleted_at IS NULL;

  -- Cancel pending reminders for those
  UPDATE public.scheduled_reminders sr
  SET status = 'cancelled'
  FROM public.bill_occurrences bo
  WHERE sr.occurrence_id = bo.id
    AND bo.bill_id = v_bill.id
    AND bo.state IN ('upcoming', 'generated', 'expected_payment', 'due_today', 'overdue')
    AND bo.cycle_start > v_occ.cycle_start
    AND bo.deleted_at IS NOT NULL
    AND sr.status = 'pending';

  -- Handle anchor for prepaid/wallet
  IF v_bill.behavior_type IN ('prepaid_validity', 'wallet_balance') THEN
    IF p_anchor_action = 'keep' THEN
      NULL;

    ELSIF p_anchor_action = 'revert' THEN
      -- Try to find the previous valid paid occurrence
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
        -- No previous paid — use the DELETED occurrence's paid_at as anchor
        -- (this was the starting point of the chain)
        IF v_occ.paid_at IS NOT NULL THEN
          v_new_anchor := (v_occ.paid_at AT TIME ZONE 'UTC')::date;
        ELSE
          v_new_anchor := v_bill.created_at::date;
        END IF;
      END IF;

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

  -- Regenerate next occurrence (now uses anchor_date since all occurrences deleted)
  PERFORM public.generate_next_occurrence(v_bill.id);
END;
$$;
