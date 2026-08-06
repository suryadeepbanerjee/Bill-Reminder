-- Migration: 026_add_household_insert_policy
-- Description: Allow authenticated users to create new households and add themselves as first member

create policy "authenticated users create households"
  on public.households for insert
  with check (auth.uid() is not null);

create policy "users add self as first household member"
  on public.household_members for insert
  with check (user_id = auth.uid());
