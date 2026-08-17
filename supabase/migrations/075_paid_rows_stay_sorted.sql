-- Migration: 075_paid_rows_stay_sorted
-- Description: Make the "paid occurrences sort last" guarantee PERMANENT.
--
-- 074 nulled due_date/expected_payment_date on paid rows ONCE, but every
-- future payment (mark_occurrence_paid RPC) rewrites state='paid' on a row
-- that still carries its real due_date. Such a row sorts by that date in the
-- dashboard query (due_date ASC, nulls last) and again anchors its bill's
-- dedup slot - so a paid bill whose next cycle is a month out jumps to the
-- top of "Upcoming". This migration:
--
--   1. Backfills any paid row that escaped 074 (idempotent re-run of its
--      data intent, plus cycle_start normalization so PAID history keeps
--      showing the due date, not the recurrence anchor).
--   2. Adds a BEFORE trigger that nulls both dates (and preserves the due
--      date into cycle_start) on ANY insert/update that lands in state
--      'paid' - covering the RPC, future code paths and manual fixes.
--
-- Safety:
--   - cycle_start stays NOT NULL-safe: a paid row only takes its own
--     due_date as cycle_start when no sibling already occupies it
--     (unique bill_id + cycle_start; skip silently otherwise).
--   - Recurrence engine chains off max(cycle_start) and ignores paid rows'
--     due dates entirely (051); the paid-transition generator (018) fires
--     AFTER this trigger and is unaffected. delete_occurrence_transaction
--     (048/049) chains off cycle_start, never paid due_date.
--   - recentlyPaid sorts by paid_at; bill history renders cycle_start +
--     paid_at - neither is touched by the nulling.

-- 1. Backfill anything 074 missed (or rows paid between 074 and now).
update public.bill_occurrences bo
set cycle_start = bo.due_date,
    due_date = null,
    expected_payment_date = null
where bo.state = 'paid'
  and bo.due_date is not null
  and not exists (
    select 1
    from public.bill_occurrences x
    where x.bill_id = bo.bill_id
      and x.cycle_start = bo.due_date
      and x.id <> bo.id
  );

-- Stragglers that hit the collision guard still lose their sort-anchoring
-- dates (their history keeps the pre-existing cycle_start).
update public.bill_occurrences bo
set due_date = null,
    expected_payment_date = null
where bo.state = 'paid'
  and bo.due_date is not null;

-- 2. Permanent guarantee for every future payment.
create or replace function public.tr_paid_rows_sort_last()
returns trigger
language plpgsql
as $$
begin
  if NEW.state = 'paid' then
    if NEW.due_date is not null then
      -- Preserve the real due date in the history field (cycle_start),
      -- but never collide with a sibling cycle (unique bill_id, cycle_start).
      if not exists (
        select 1
        from public.bill_occurrences x
        where x.bill_id = NEW.bill_id
          and x.cycle_start = NEW.due_date
          and x.id <> NEW.id
      ) then
        NEW.cycle_start := NEW.due_date;
      end if;
      NEW.due_date := null;
      NEW.expected_payment_date := null;
    end if;
  end if;
  return NEW;
end;
$$;

drop trigger if exists occurrences_paid_sort_last on public.bill_occurrences;
create trigger occurrences_paid_sort_last
  before insert or update of state on public.bill_occurrences
  for each row
  execute function public.tr_paid_rows_sort_last();