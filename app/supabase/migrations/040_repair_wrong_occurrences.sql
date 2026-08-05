-- Migration: 040_repair_wrong_occurrences.sql
-- Description:
--   039 fixed the engine going forward. This migration repairs bills that
--   already have a WRONG stored occurrence sitting in bill_occurrences
--   from before the fix (e.g. your Domain bill showing 31 Aug, your
--   60-day prepaid bill showing 2 Oct).
--
--   Safe by construction: it only deletes occurrences that are still
--   unresolved (upcoming / due_today / overdue) and NEVER touches rows in
--   'paid' or 'skipped' (or any other settled state) — your payment
--   history is untouched. After deleting the unresolved ones, it calls
--   the now-fixed generate_next_occurrence() to rebuild them correctly.
--
--   Review the SELECT at the top before running the DELETE — it shows you
--   exactly which rows are about to be wiped and regenerated.

-- ── STEP 1 — Preview what will be touched (run this first, read it) ───────
select
  b.id            as bill_id,
  b.title,
  b.behavior_type,
  b.repeat_kind,
  b.repeat_interval,
  b.anchor_date,
  b.due_day_offset,
  o.id            as occurrence_id,
  o.cycle_start,
  o.due_date      as wrong_due_date,
  o.state
from public.bill_occurrences o
join public.bills b on b.id = o.bill_id
where o.state in ('upcoming', 'due_today', 'overdue')
order by b.title, o.cycle_start;

-- ── STEP 2 — Delete the unresolved (unpaid) wrong occurrences ─────────────
delete from public.bill_occurrences
where state in ('upcoming', 'due_today', 'overdue');

-- ── STEP 3 — Regenerate correctly for every active bill ───────────────────
do $$
declare
  v_bill_id uuid;
begin
  for v_bill_id in select id from public.bills where is_active loop
    perform public.generate_next_occurrence(v_bill_id);
  end loop;
end $$;

-- ── STEP 4 — Re-run the state machine so due_today/overdue are correct ────
select public.transition_bill_occurrences();
