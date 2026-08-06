-- Migration: 056_fix_self_member_insert_policy
-- Description: Close household-takeover hole in the self-insert RLS policy (C-1).
--
-- The old policy allowed ANY authenticated user to insert a household_members
-- row for ANY household_id with ANY role/status (only user_id was bound to
-- auth.uid()). That let an attacker grant themselves admin/active membership
-- in a household they don't belong to — a full household takeover.
--
-- Legitimate first-member creation happens via two paths that bypass RLS:
--   1. handle_new_user_household trigger (SECURITY DEFINER, migration 002)
--   2. create-household edge function (service-role client)
-- No client code inserts into household_members directly (verified 2026-08-06).
--
-- The replacement policy only permits self-insert into a household that has
-- no members at all, forces role=editor and status=invited, and binds
-- invited_email to the caller's own email. Activation still requires the
-- accept-invite edge function (email-scoped).

-- Remove the vulnerable policy (created in migration 027)
drop policy if exists "users add self as first household member"
  on public.household_members;

-- Replace with a scoped version: only the very first row in a brand-new
-- household, and only as an invited editor for yourself.
create policy "self-insert only into empty households as invited editor"
  on public.household_members for insert
  with check (
    user_id = auth.uid()
    and status = 'invited'
    and role = 'editor'
    and invited_email is not distinct from lower(auth.jwt()->>'email')
    and not exists (
      select 1 from public.household_members existing
      where existing.household_id = household_members.household_id
    )
  );

-- Tighten the households insert policy (026) so a user can only create a
-- household they own — prevents orphan rows and belt-and-braces for the
-- member path above.
drop policy if exists "authenticated users create households"
  on public.households;

create policy "users create their own households"
  on public.households for insert
  with check (created_by = auth.uid());
