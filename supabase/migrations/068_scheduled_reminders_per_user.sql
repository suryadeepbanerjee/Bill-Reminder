-- Migration: 068_scheduled_reminders_per_user
-- Description: Make scheduled_reminders account-specific.
--
-- Previously the reminder-dispatcher derived the recipient from
-- bills.created_by, so ONLY the bill creator ever received push or email —
-- household members got nothing. With per-account per-bill preferences
-- (067), each reminder row now targets exactly one user.
--
--   - add scheduled_reminders.user_id
--   - backfill existing rows to the bill creator (old behavior)
--   - make user_id NOT NULL going forward
--   - unique (occurrence_id, rule_id, scheduled_for, channel, user_id)
--   - rewrite claim_pending_reminders to return sr.user_id

alter table public.scheduled_reminders
  add column if not exists user_id uuid references public.profiles(id) on delete cascade;

-- Backfill: every existing row was (and is) routed to the bill creator.
update public.scheduled_reminders sr
set user_id = b.created_by
from public.bill_occurrences bo
join public.bills b on b.id = bo.bill_id
where bo.id = sr.occurrence_id
  and sr.user_id is null;

-- Rows whose bill creator no longer exists cannot be claimed by anyone
-- (the dispatcher never had a recipient for them either). Drop them.
delete from public.scheduled_reminders sr
where sr.user_id is null;

alter table public.scheduled_reminders
  alter column user_id set not null;

-- Rebuild the idempotency constraint for per-user rows.
alter table public.scheduled_reminders
  drop constraint if exists scheduled_reminders_occurrence_id_rule_id_scheduled_for_channel_key;

alter table public.scheduled_reminders
  add constraint scheduled_reminders_dispatch_key
  unique (occurrence_id, rule_id, scheduled_for, channel, user_id);

create index if not exists scheduled_reminders_user_idx
  on public.scheduled_reminders (user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- claim_pending_reminders now returns each row's OWN user_id.
-- ─────────────────────────────────────────────────────────────────────────────
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
  if auth.uid() is not null then
    raise exception 'Not authorized';
  end if;

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
    c.user_id
  from claimed c
  join public.bill_occurrences bo on bo.id = c.occurrence_id;
end;
$$;

revoke execute on function public.claim_pending_reminders() from public, anon, authenticated;
grant execute on function public.claim_pending_reminders() to service_role;