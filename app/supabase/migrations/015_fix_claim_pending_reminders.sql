-- Migration: 015_fix_claim_pending_reminders
-- Description: Fixes the claim_pending_reminders RPC which incorrectly referenced a joined table in the returning clause without proper aliasing.

create or replace function public.claim_pending_reminders()
returns table (
  id uuid,
  occurrence_id uuid,
  rule_id uuid,
  scheduled_for timestamptz,
  channel text,
  bill_id uuid,
  user_id uuid
)
language plpgsql
security definer
as $$
begin
  return query
  with claimed as (
    update public.scheduled_reminders sr
    set status = 'sent', sent_at = now()
    where sr.id in (
      select sr2.id
      from public.scheduled_reminders sr2
      where sr2.status = 'pending'
      and sr2.scheduled_for <= now()
      order by sr2.scheduled_for
      limit 50
      for update skip locked
    )
    returning *
  )
  select 
    c.id,
    c.occurrence_id,
    c.rule_id,
    c.scheduled_for,
    c.channel,
    bo.bill_id,
    b.created_by as user_id
  from claimed c
  join public.bill_occurrences bo on bo.id = c.occurrence_id
  join public.bills b on b.id = bo.bill_id;
end;
$$;
