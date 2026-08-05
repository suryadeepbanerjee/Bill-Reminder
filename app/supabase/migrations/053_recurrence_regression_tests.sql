-- Migration 053: Recurrence engine regression tests
-- ─────────────────────────────────────────────────────────────────────────────
-- Pure SQL assertions against the canonical engine (051). Each ASSERT raises
-- an exception if the engine regresses, which fails this migration loudly.
-- Fixture rows are created and removed inside this transaction, so the tests
-- never touch production data.
--
-- Covers: the Sim-1 84-day clamp regression, leap-year clamping, monthly
-- snapping, every_x_* pure arithmetic, fixed yearly/one-time anchor behavior,
-- prepaid one-time, preview/engine parity, cron idempotency guard, MODE 2
-- rebuild, anchor-shift rebuild, and mark-paid chain continuation.

DO $$
DECLARE
  -- fixture ids
  v_household uuid;
  v_category  uuid;
  v_bill_fixed uuid;
  v_bill_prepaid uuid;
  v_open_id   uuid;
  -- helpers
  v_today     date := CURRENT_DATE;
  v_expected  date;
  v_cycle     date;
  v_due       date;
  v_prev      json;
  v_rows      int;
  v_occ       record;
  v_new_anchor date;
BEGIN

-- ═══════════════════════════════════════════════════════════════════════
-- A. Pure helper tests (deterministic, no fixtures)
-- ═══════════════════════════════════════════════════════════════════════

-- A1. SIM-1 REGRESSION: prepaid every 84 days. Cycle = anchor + 84d and the
--     due date MUST equal the cycle (no day-of-month re-snap).
ASSERT public._compute_next_cycle_start('prepaid_validity', 'every_x_days', 84,
         date '2026-08-01', now(), NULL) = date '2026-10-24',
       'A1a: 84-day first cycle must be anchor + 84 days';
ASSERT public._compute_bill_due_date(date '2026-10-24', 'prepaid_validity',
         'every_x_days', NULL, date '2026-08-01') = date '2026-10-24',
       'A1b: 84-day due date must NOT snap to anchor day (Sim-1 clamp regression)';
ASSERT public._compute_next_cycle_start('prepaid_validity', 'every_x_days', 84,
         date '2026-08-01', now(), date '2026-10-24') = date '2027-01-16',
       'A1c: 84-day second cycle must be pure arithmetic';

-- A2. every_x_months: pure arithmetic, no snapping to anchor day.
ASSERT public._compute_next_cycle_start('prepaid_validity', 'every_x_months', 2,
         date '2026-01-31', now(), NULL) = date '2026-03-31',
       'A2: every 2 months from Jan 31 must be Mar 31';

-- A3. Prepaid monthly DOES snap to the anchor day (clamped to month length).
ASSERT public._compute_next_cycle_start('prepaid_validity', 'monthly', NULL,
         date '2026-08-31', now(), NULL) = date '2026-09-30',
       'A3a: monthly from Aug 31 must clamp to Sep 30';
ASSERT public._compute_next_cycle_start('prepaid_validity', 'monthly', NULL,
         date '2026-08-31', now(), date '2026-09-30') = date '2026-10-31',
       'A3b: monthly must snap back to the 31st in 31-day months';

-- A4. Leap year: anchor Feb 29 must clamp to Feb 28 in non-leap years.
ASSERT public._compute_next_cycle_start('prepaid_validity', 'monthly', NULL,
         date '2024-02-29', now(), NULL) = date '2024-03-29',
       'A4a: monthly after Feb 29 must be Mar 29';
ASSERT public._snap_to_anchor(date '2025-02-28', date '2024-02-29', true) = date '2025-02-28',
       'A4b: yearly snap of Feb 29 must clamp to Feb 28';
ASSERT public._snap_to_anchor(date '2028-02-29', date '2024-02-29', true) = date '2028-02-29',
       'A4c: yearly snap must land on Feb 29 in leap years';

-- A5. Fixed monthly due_day_offset: 0 = last day, N = Nth day, clamped.
ASSERT public._compute_bill_due_date(date '2026-08-01', 'fixed_due_date', 'monthly', 0, NULL)
         = date '2026-08-31', 'A5a: offset 0 must be last day of month';
ASSERT public._compute_bill_due_date(date '2026-08-01', 'fixed_due_date', 'monthly', 15, NULL)
         = date '2026-08-15', 'A5b: offset 15 must be the 15th';
ASSERT public._compute_bill_due_date(date '2026-02-01', 'fixed_due_date', 'monthly', 31, NULL)
         = date '2026-02-28', 'A5c: offset 31 must clamp in February';

-- A6. Fixed yearly: cycle pinned to the anchor month, due = anchor month/day.
ASSERT public._compute_next_cycle_start('fixed_due_date', 'yearly', NULL,
         date '2025-10-10', timestamp '2025-10-05', NULL) = date '2025-10-01',
       'A6a: yearly cycle must be the 1st of the anchor month';
ASSERT public._compute_bill_due_date(date '2025-10-01', 'fixed_due_date', 'yearly', NULL,
         date '2025-10-10') = date '2025-10-10',
       'A6b: yearly due must honor the anchor day';
ASSERT public._compute_next_cycle_start('fixed_due_date', 'yearly', NULL,
         date '2025-10-10', timestamp '2025-10-05', date '2026-10-01') = date '2027-10-01',
       'A6c: yearly cycle must stay pinned to the anchor month, never drift';

-- A7. Fixed one-time: the anchor IS the cycle and the due date.
ASSERT public._compute_next_cycle_start('fixed_due_date', 'none', NULL,
         date '2026-11-20', now(), NULL) = date '2026-11-20',
       'A7a: one-time cycle must be the anchor';
ASSERT public._compute_bill_due_date(date '2026-11-20', 'fixed_due_date', 'none', NULL,
         date '2026-11-20') = date '2026-11-20',
       'A7b: one-time due must be the anchor';

-- A8. Prepaid one-time (044 returned NULL — the anchor itself is the payment).
ASSERT public._compute_next_cycle_start('prepaid_validity', 'none', NULL,
         date '2026-11-20', now(), NULL) = date '2026-11-20',
       'A8: prepaid one-time first cycle must be the anchor';

-- A9. Preview/engine parity: preview must produce exactly the canonical dates.
v_prev := public.preview_bill_occurrences(
  'prepaid_validity', 'every_x_days', 84,
  NULL, NULL, NULL, date '2026-08-01', date '2026-08-01', 3);
ASSERT v_prev::text = '["2026-10-24","2027-01-16","2027-04-10"]',
       'A9: preview must agree with the engine (got ' || v_prev::text || ')';

-- ═══════════════════════════════════════════════════════════════════════
-- B. Engine tests with fixture bills
-- ═══════════════════════════════════════════════════════════════════════

INSERT INTO public.households (name) VALUES ('__engine_test__')
  RETURNING id INTO v_household;
INSERT INTO public.categories (household_id, name, icon, color)
  VALUES (v_household, '__engine_test__', 'test', '#000000')
  RETURNING id INTO v_category;

-- B1. Fixed monthly bill created 60 days ago, due on the 15th.
--     Expected first future due: the 15th of this month (if not past)
--     else the 15th of next month.
v_expected := (date_trunc('month', v_today)::date + 14);
IF v_expected < v_today THEN
  v_expected := ((date_trunc('month', v_today)::date + interval '1 month')::date + 14);
END IF;

INSERT INTO public.bills (
  household_id, category_id, title, behavior_type, amount_expected, currency,
  repeat_kind, due_day_offset, created_at
) VALUES (
  v_household, v_category, '__engine_fixed__', 'fixed_due_date', 100, 'INR',
  'monthly', 15, now() - interval '60 days'
) RETURNING id INTO v_bill_fixed;

SELECT count(*) INTO v_rows
FROM public.bill_occurrences
WHERE bill_id = v_bill_fixed AND deleted_at IS NULL;
ASSERT v_rows = 1, 'B1a: insert trigger must create exactly one open occurrence';

SELECT * INTO v_occ
FROM public.bill_occurrences
WHERE bill_id = v_bill_fixed AND deleted_at IS NULL;
ASSERT v_occ.due_date = v_expected,
       'B1b: fixed monthly due must be the 15th (got ' || v_occ.due_date || ')';
ASSERT v_occ.state IN ('upcoming', 'due_today'),
       'B1c: state must be upcoming/due_today (got ' || v_occ.state || ')';

-- B2. Idempotency guard: running MODE 1 again (as the cron does daily)
--     must NOT append a duplicate chain.
PERFORM public.generate_next_occurrence(v_bill_fixed);
SELECT count(*) INTO v_rows
FROM public.bill_occurrences
WHERE bill_id = v_bill_fixed AND deleted_at IS NULL;
ASSERT v_rows = 1, 'B2: cron must be idempotent (guard failed)';

-- B3. Guard vs stale duplicate: manually inject a second future row (the old
--     cron-duplicate bug), MODE 1 must leave it alone, MODE 2 must fix it.
INSERT INTO public.bill_occurrences (
  bill_id, cycle_start, generation_date, expected_payment_date, due_date,
  state, amount, generation_version, generated_at
) VALUES (
  v_bill_fixed,
  ((date_trunc('month', v_occ.due_date)::date + interval '1 month')::date),
  NULL, NULL,
  ((date_trunc('month', v_occ.due_date)::date + interval '1 month')::date + 14),
  'upcoming', 100, 1, now()
);

PERFORM public.generate_next_occurrence(v_bill_fixed);
SELECT count(*) INTO v_rows
FROM public.bill_occurrences
WHERE bill_id = v_bill_fixed AND deleted_at IS NULL;
ASSERT v_rows = 2, 'B3a: MODE 1 must not touch an existing duplicate';

PERFORM public.generate_next_occurrence(v_bill_fixed, true);
SELECT count(*) INTO v_rows
FROM public.bill_occurrences
WHERE bill_id = v_bill_fixed AND deleted_at IS NULL;
ASSERT v_rows = 1, 'B3b: MODE 2 must collapse the duplicate chain';

SELECT * INTO v_occ
FROM public.bill_occurrences
WHERE bill_id = v_bill_fixed AND deleted_at IS NULL;
ASSERT v_occ.due_date = v_expected AND v_occ.generation_version = 3,
       'B3c: MODE 2 must rebuild to the canonical due with engine version 3';

-- B4. Prepaid every 30 days + anchor edit (the DEFECT-4 fix: edits must
--     rebuild from the definition, never continue from paid history).
INSERT INTO public.bills (
  household_id, category_id, title, behavior_type, amount_expected, currency,
  repeat_kind, repeat_interval, anchor_date, created_at
) VALUES (
  v_household, v_category, '__engine_prepaid__', 'prepaid_validity', 200, 'INR',
  'every_x_days', 30, v_today - 40, now() - interval '60 days'
) RETURNING id INTO v_bill_prepaid;

SELECT * INTO v_occ
FROM public.bill_occurrences
WHERE bill_id = v_bill_prepaid AND deleted_at IS NULL;
ASSERT v_occ.cycle_start = v_today + 20,
       'B4a: prepaid first open cycle must be anchor + 30 (got ' || v_occ.cycle_start || ')';
ASSERT v_occ.due_date = v_occ.cycle_start,
       'B4b: prepaid due must equal its cycle (no clamp)';

-- Mark the open occurrence paid WITHOUT shifting the anchor, then verify the
-- next cycle continues from the paid cycle (mark-paid no-shift path).
v_open_id := v_occ.id;
PERFORM public.mark_occurrence_paid(v_open_id, now(), 200, NULL, NULL, false);
SELECT * INTO v_occ
FROM public.bill_occurrences
WHERE bill_id = v_bill_prepaid AND deleted_at IS NULL AND state <> 'paid'
ORDER BY cycle_start DESC LIMIT 1;
ASSERT v_occ.cycle_start = v_today + 50,
       'B4c: mark-paid (no shift) must continue from the paid cycle (got ' || v_occ.cycle_start || ')';

-- Now edit the anchor (moves it 5 days later). The UPDATE fires the trigger,
-- which must REBUILD from the new anchor — the old engine would have ignored
-- it and continued from max(cycle_start).
v_new_anchor := v_today - 5;
UPDATE public.bills SET anchor_date = v_new_anchor WHERE id = v_bill_prepaid;

SELECT * INTO v_occ
FROM public.bill_occurrences
WHERE bill_id = v_bill_prepaid AND deleted_at IS NULL AND state <> 'paid'
ORDER BY cycle_start DESC LIMIT 1;
ASSERT v_occ.cycle_start = v_new_anchor + 30,
       'B4d: anchor edit must rebuild from the new anchor (got ' || v_occ.cycle_start
       || ', expected ' || (v_new_anchor + 30) || ')';
ASSERT v_occ.due_date = v_occ.cycle_start,
       'B4e: rebuilt prepaid due must equal its cycle';

-- B5. The paid occurrence from B4c must still exist (history preserved).
SELECT count(*) INTO v_rows
FROM public.bill_occurrences
WHERE bill_id = v_bill_prepaid AND state = 'paid' AND deleted_at IS NULL;
ASSERT v_rows = 1, 'B5: paid history must survive a rebuild';

-- ═══════════════════════════════════════════════════════════════════════
-- C. Cleanup fixtures
-- ═══════════════════════════════════════════════════════════════════════
DELETE FROM public.bill_occurrences WHERE bill_id IN (v_bill_fixed, v_bill_prepaid);
DELETE FROM public.bills WHERE id IN (v_bill_fixed, v_bill_prepaid);
DELETE FROM public.categories WHERE id = v_category;
DELETE FROM public.households WHERE id = v_household;

RAISE NOTICE 'All recurrence engine regression tests passed';
END $$;
