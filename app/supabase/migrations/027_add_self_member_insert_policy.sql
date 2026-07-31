-- Migration: 027_add_self_member_insert_policy
-- Description: Allow users to add themselves as first member when creating a household

create policy "users add self as first household member"
  on public.household_members for insert
  with check (user_id = auth.uid());
