-- Migration: 066_profile_read_household_peers
-- Description: Members could not see each other's profile rows. The original
-- policy (001) only allowed reading YOUR OWN profile (`auth.uid() = id`), so
-- the household members screen always showed "Unknown" for everyone else —
-- most visibly for the owner (who has no invited_email fallback).
--
-- Fix: any active household member may read the profiles of the other active
-- members of their shared households. Self-read stays covered by the old
-- policy; the two are OR'ed by Postgres.

drop policy if exists "Household members can view peer profiles" on public.profiles;

create policy "Household members can view peer profiles"
  on public.profiles for select
  using (
    exists (
      select 1
      from public.household_members hm
      where hm.user_id = public.profiles.id
        and hm.status = 'active'
        and public.is_household_member(hm.household_id)
    )
  );