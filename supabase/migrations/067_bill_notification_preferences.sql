-- Migration: 067_bill_notification_preferences
-- Description: Per-account, per-bill notification preferences.
--
-- Model:
--   bill_notification_preferences (bill_id, user_id, push_enabled, email_enabled)
--   - One row per household account per bill.
--   - Super admin / admin: push + email ON by default, can toggle.
--   - Member: OFF and BLOCKED (policy denies any write; role trigger force-sets OFF).
--   - Role changes auto-sync: promote to admin => all bills ON; demote => all OFF.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Table
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.bill_notification_preferences (
  id            uuid primary key default gen_random_uuid(),
  bill_id       uuid not null references public.bills(id) on delete cascade,
  user_id       uuid not null references public.profiles(id) on delete cascade,
  push_enabled  boolean not null default false,
  email_enabled boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (bill_id, user_id)
);

alter table public.bill_notification_preferences enable row level security;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. RLS policies
-- ─────────────────────────────────────────────────────────────────────────────
-- Read: any active household member can see the prefs of a bill in their household.
create policy "members read bill notification preferences"
  on public.bill_notification_preferences for select
  using (
    exists (
      select 1 from public.bills
      where bills.id = bill_notification_preferences.bill_id
        and public.is_household_member(bills.household_id)
    )
  );

-- Write (insert/update): only the row's OWN user may write, and only if they are
-- an admin or super_admin of the bill's household. Members are BLOCKED — they
-- cannot toggle anything on for themselves (nor anyone else).
create policy "users insert own notification preferences as editor"
  on public.bill_notification_preferences for insert
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.bills
      where bills.id = bill_notification_preferences.bill_id
        and public.is_household_editor(bills.household_id)
    )
  );

create policy "users update own notification preferences as editor"
  on public.bill_notification_preferences for update
  using (
    user_id = auth.uid()
    and exists (
      select 1 from public.bills
      where bills.id = bill_notification_preferences.bill_id
        and public.is_household_editor(bills.household_id)
    )
  )
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.bills
      where bills.id = bill_notification_preferences.bill_id
        and public.is_household_editor(bills.household_id)
    )
  );

create policy "users delete own notification preferences as editor"
  on public.bill_notification_preferences for delete
  using (
    user_id = auth.uid()
    and exists (
      select 1 from public.bills
      where bills.id = bill_notification_preferences.bill_id
        and public.is_household_editor(bills.household_id)
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Role-sync trigger
-- ─────────────────────────────────────────────────────────────────────────────
-- Whenever a membership's role changes (or a new active membership is created),
-- force the member's preferences across the household's bills:
--   super_admin / admin  -> push + email ON
--   member               -> push + email OFF (blocked)
create or replace function public.sync_bill_notification_preferences()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'active' then
    if new.role in ('super_admin', 'admin') then
      insert into public.bill_notification_preferences (bill_id, user_id, push_enabled, email_enabled)
      select b.id, new.user_id, true, true
      from public.bills b
      where b.household_id = new.household_id
      on conflict (bill_id, user_id)
      do update set push_enabled = true, email_enabled = true, updated_at = now();
    else
      insert into public.bill_notification_preferences (bill_id, user_id, push_enabled, email_enabled)
      select b.id, new.user_id, false, false
      from public.bills b
      where b.household_id = new.household_id
      on conflict (bill_id, user_id)
      do update set push_enabled = false, email_enabled = false, updated_at = now();
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists sync_bill_notification_preferences on public.household_members;
create trigger sync_bill_notification_preferences
  after insert or update of role, status on public.household_members
  for each row execute function public.sync_bill_notification_preferences();

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. New-bill trigger
-- ─────────────────────────────────────────────────────────────────────────────
-- When a bill is created, seed preference rows for every active household member
-- (admin/owner ON, member OFF).
create or replace function public.seed_bill_notification_preferences()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.bill_notification_preferences (bill_id, user_id, push_enabled, email_enabled)
  select new.id, hm.user_id,
         (hm.role in ('super_admin', 'admin')),
         (hm.role in ('super_admin', 'admin'))
  from public.household_members hm
  where hm.household_id = new.household_id
    and hm.status = 'active'
    and hm.user_id is not null
  on conflict (bill_id, user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists seed_bill_notification_preferences on public.bills;
create trigger seed_bill_notification_preferences
  after insert on public.bills
  for each row execute function public.seed_bill_notification_preferences();

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Backfill existing data
-- ─────────────────────────────────────────────────────────────────────────────
insert into public.bill_notification_preferences (bill_id, user_id, push_enabled, email_enabled)
select b.id, hm.user_id,
       (hm.role in ('super_admin', 'admin')),
       (hm.role in ('super_admin', 'admin'))
from public.household_members hm
join public.bills b
  on b.household_id = hm.household_id
where hm.status = 'active'
  and hm.user_id is not null
on conflict (bill_id, user_id)
do update set push_enabled = excluded.push_enabled,
              email_enabled = excluded.email_enabled,
              updated_at = now();