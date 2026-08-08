-- Migration 065: Fix transfer_household_ownership trigger ordering
-- Problem (064): the RPC promoted the target → super_admin (step 2) BEFORE
-- updating households.created_by (step 3). The household_super_admin_guard
-- trigger fires on the promotion and requires households.created_by =
-- NEW.user_id → every transfer raised "Only the household creator can be
-- a super admin" and aborted.
--
-- Fix: update households.created_by FIRST (no trigger on households),
-- then promote the target. The guard then passes both checks:
--   created_by matches the new super_admin, and the old owner was already
--   demoted (only one active super_admin).

create or replace function public.transfer_household_ownership(
  p_household_id uuid,
  p_current_owner_id uuid,
  p_new_owner_id uuid
)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  -- Step 1: Downgrade the current owner to admin.
  -- This must happen first so the household_super_admin_guard trigger
  -- allows the final promotion (it prevents two active super_admins).
  UPDATE household_members
  SET role = 'admin'
  WHERE household_id = p_household_id
    AND user_id = p_current_owner_id
    AND role = 'super_admin'
    AND status = 'active';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Current owner not found, not active, or not super_admin';
  END IF;

  -- Step 2: Point the household at its new creator BEFORE promoting.
  -- The guard trigger validates created_by = NEW.user_id at promotion
  -- time, so it must already reflect p_new_owner_id here.
  UPDATE households
  SET created_by = p_new_owner_id
  WHERE id = p_household_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Household not found';
  END IF;

  -- Step 3: Upgrade the target admin to super_admin.
  --  Guard is satisfied: created_by now matches, and after Step 1 there
  --  is no other active super_admin.
  UPDATE household_members
  SET role = 'super_admin'
  WHERE household_id = p_household_id
    AND user_id = p_new_owner_id
    AND role = 'admin'
    AND status = 'active';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Target new owner not found, not active, or not an admin';
  END IF;
end;
$$;

-- Restrict execution to the service_role only (used by edge functions)
REVOKE ALL ON FUNCTION public.transfer_household_ownership FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.transfer_household_ownership TO service_role;