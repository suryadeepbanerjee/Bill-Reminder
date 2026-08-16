-- Migration: 074_paid_occurrences_sort_last
-- Description: Dashboard "Upcoming" rendered bills out of due-date order
-- (e.g. a 5-day bill before a 3-day bill before tomorrow's).
--
-- Root cause: the app fetches bill_occurrences ordered by due_date ASC
-- (nulls last), then keeps ONE occurrence per bill. A paid occurrence (due
-- date = its own due date, which is always EARLIER than the next cycle's due
-- date) is returned first and pins the bill's slot; the surviving upcoming
-- occurrence later replaces the value in the slot of the paid row -> the
-- upcoming list follows min(due_date per bill) instead of the upcoming
-- due_date, producing a seemingly random order.
--
-- Fix: PAID occurrences are only ever needed for the "recently paid" list,
-- which sorts by paid_at (never due_date). Null their due_date and
-- expected_payment_date so the client's `order by due_date asc nulls last`
-- pushes them to the end and they can no longer anchor a bill's position.
--
-- Safety:
--   - state = 'paid' rows only. The recurrence engine never reads
--     due_date of paid rows (051 chains off max(cycle_start) and 073 keeps
--     the real due date in cycle_start, which bill history displays).
--   - occurrence-state-machine (023) only mutates non-paid states.
--   - Marking new payments later re-materializes the same shape: the RPC
--     writes paid_date/paid_amount, and this migration's data intent can be
--     preserved at worst on a re-run (idempotent).

update public.bill_occurrences
set due_date = null,
    expected_payment_date = null
where state = 'paid'
  and (due_date is not null or expected_payment_date is not null);