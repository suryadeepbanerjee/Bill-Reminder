-- Migration: 013_claim_pending_reminders_rpc
-- Description: Create claim_pending_reminders RPC for atomic reminder claiming

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
  returning
    sr.id,
    sr.occurrence_id,
    sr.rule_id,
    sr.scheduled_for,
    sr.channel,
    bo.bill_id,
    (select b.created_by from public.bills b
     join public.bill_occurrences occ on occ.bill_id = b.id
     where occ.id = sr.occurrence_id) as user_id;
end;
$$;
