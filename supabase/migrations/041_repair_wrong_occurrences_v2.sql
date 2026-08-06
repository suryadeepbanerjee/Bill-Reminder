-- Migration: 041_repair_wrong_occurrences_v2.sql
-- Description:
--   040 was wrong. It deleted state in ('upcoming','due_today','overdue')
--   but this table actually has 7 possible states:
--     upcoming, generated, expected_payment, due_today, overdue, paid, archived
--   (see 005_create_bill_occurrences.sql's CHECK constraint, and
--   fetchCurrentOccurrence() in lib/supabase/occurrences.ts, which reads
--   due_today/overdue/expected_payment/generated/upcoming — all five).
--
--   040 missed 'generated' and 'expected_payment'. Any bad row sitting in
--   either of those states survived the "repair" untouched, which is why
--   the Sim 2 bill still showed the old wrong "2 Oct" — that row was never
--   deleted, generate_next_occurrence saw it as the latest cycle and built
--   on top of it, and the detail screen still picks it up because it's
--   still the earliest unresolved row by due_date.
--
--   Fix: stop enumerating "the unresolved states" (that list can go stale
--   again the next time someone adds a state). Only 'paid' and 'archived'
--   are terminal/settled. Delete everything else.

-- ── STEP 1 — Preview what will be touched (read this before running DELETE) ─
select
  b.id            as bill_id,
  b.title,
  b.behavior_type,
  b.repeat_kind,
  b.repeat_interval,
  b.anchor_date,
  o.id            as occurrence_id,
  o.cycle_start,
  o.due_date      as wrong_due_date,
  o.state
from public.bill_occurrences o
join public.bills b on b.id = o.bill_id
where o.state not in ('paid', 'archived')
order by b.title, o.cycle_start;

-- ── STEP 2 — Delete every non-terminal occurrence, whatever state it's in ──
delete from public.bill_occurrences
where state not in ('paid', 'archived');

-- ── STEP 3 — Regenerate correctly for every active bill ────────────────────
do $$
declare
  v_bill_id uuid;
begin
  for v_bill_id in select id from public.bills where is_active loop
    perform public.generate_next_occurrence(v_bill_id);
  end loop;
end $$;

-- ── STEP 4 — Re-run the state machine so due_today/overdue are correct ─────
select public.transition_bill_occurrences();

-- ── STEP 5 — Sanity check: confirm nothing bad is left ─────────────────────
select
  b.title,
  o.cycle_start,
  o.due_date,
  o.state
from public.bill_occurrences o
join public.bills b on b.id = o.bill_id
where o.state not in ('paid', 'archived')
order by b.title, o.cycle_start;
