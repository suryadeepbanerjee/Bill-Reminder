-- Migration: 024_fix_duplicate_occurrences
-- Description: Remove duplicate upcoming occurrences and fix states for existing ones

-- 1. Fix existing occurrences that should be due_today or overdue
update public.bill_occurrences
set state = case
      when due_date < CURRENT_DATE then 'overdue'
      when due_date = CURRENT_DATE then 'due_today'
      else state
    end,
    updated_at = now()
where state in ('upcoming', 'generated')
  and (due_date <= CURRENT_DATE);

-- 2. For each bill, keep only the earliest upcoming/generated occurrence and delete the rest
delete from public.bill_occurrences
where id in (
  select bo.id
  from public.bill_occurrences bo
  inner join (
    select bill_id, min(due_date) as min_due
    from public.bill_occurrences
    where state in ('upcoming', 'generated')
    group by bill_id
    having count(*) > 1
  ) dups on bo.bill_id = dups.bill_id
  where bo.state in ('upcoming', 'generated')
    and bo.due_date > dups.min_due
);
