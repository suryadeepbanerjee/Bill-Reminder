-- Migration: 073_fix_paid_history_date
-- Description: Paid occurrence history showed the recurrence anchor
-- (cycle_start) as the primary date - a value the user perceives as random
-- (e.g. 1st of month for a bill due on the 12th). The app renders
-- cycle_start as the history row's primary date, so for PAID rows make
-- cycle_start mirror the due date. The history then reads exactly two
-- dates: due date (cycle_start) and paid date (paid_at).
--
-- Safety:
--   - Only state = 'paid' rows are touched (the engine chains future cycles
--     off max(cycle_start) of NON-deleted rows; a paid row is never the max
--     because mark_occurrence_paid generates the next occurrence in the same
--     transaction, and the nightly generator keeps newer unpaid rows ahead).
--   - Rows whose due_date would collide with an existing sibling
--     (unique bill_id + cycle_start) are skipped, never overwritten.

update public.bill_occurrences bo
set cycle_start = bo.due_date
where bo.state = 'paid'
  and bo.due_date is not null
  and bo.cycle_start <> bo.due_date
  and not exists (
    select 1
    from public.bill_occurrences x
    where x.bill_id = bo.bill_id
      and x.cycle_start = bo.due_date
      and x.id <> bo.id
  );