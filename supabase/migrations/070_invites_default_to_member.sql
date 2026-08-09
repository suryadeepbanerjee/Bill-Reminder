-- Migration: 070_invites_default_to_member
-- Description: Every non-active membership gets normalized to the 'member'
-- role so that pending invites and re-invites never retain a legacy 'admin'
-- role. The owner's own row (status 'active', role 'super_admin') and all
-- active memberships are untouched.

UPDATE public.household_members
SET role = 'member'
WHERE status <> 'active'
  AND role <> 'member';