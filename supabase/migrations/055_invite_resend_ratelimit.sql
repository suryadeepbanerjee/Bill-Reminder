-- 055: Invite resend tracking + rate limit
-- Resend policy: 2 min cooldown between sends, max 3 resends (4 total sends),
-- then 1 hour lockout after the last send.

alter table household_members
  add column if not exists invite_count int not null default 0,
  add column if not exists invite_last_sent_at timestamptz;

-- Backfill: existing invited rows count as 1 send at creation time
update household_members
set invite_count         = 1,
    invite_last_sent_at  = created_at
where status = 'invited'
  and invite_count = 0
  and invite_last_sent_at is null;

-- New invites default to 1 send + now(): handled by the edge function,
-- but keep DB-level defaults sane for any direct inserts.
alter table household_members
  alter column invite_count set default 1;

-- Migration 053-style invariant check
do $$
begin
  if exists (
    select 1 from household_members
    where status = 'invited' and invite_count = 0
  ) then
    raise exception 'invariant failed: invited rows must have invite_count >= 1';
  end if;
end $$;

select count(*) as invited_rows_after_055
from household_members
where status = 'invited';
