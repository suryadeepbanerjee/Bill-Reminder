-- Migration 064: Atomic Transfer of Household Ownership
-- Replaces the current super_admin with a target admin in a single transaction.

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
  -- allows the next step (it prevents two active super_admins).
  UPDATE household_members
  SET role = 'admin'
  WHERE household_id = p_household_id
    AND user_id = p_current_owner_id
    AND role = 'super_admin'
    AND status = 'active';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Current owner not found, not active, or not super_admin';
  END IF;

  -- Step 2: Upgrade the target admin to super_admin.
  UPDATE household_members
  SET role = 'super_admin'
  WHERE household_id = p_household_id
    AND user_id = p_new_owner_id
    AND role = 'admin'
    AND status = 'active';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Target new owner not found, not active, or not an admin';
  END IF;

  -- Step 3: Update the created_by pointer on the household itself.
  UPDATE households
  SET created_by = p_new_owner_id
  WHERE id = p_household_id;
  
  IF NOT FOUND THEN
      RAISE EXCEPTION 'Household not found';
  END IF;
end;
$$;

-- Restrict execution to the service_role only (used by edge functions)
REVOKE ALL ON FUNCTION public.transfer_household_ownership FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.transfer_household_ownership TO service_role;
