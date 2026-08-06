-- Migration: 020_fix_delete_account_cascade
-- Description: Improve delete_user_account to properly clean up all user data
--              before deleting from auth.users, preventing orphan rows.

-- First, drop the old function
drop function if exists public.delete_user_account();

-- Create improved function that handles cascade properly
create or replace function public.delete_user_account()
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_user_id uuid;
  v_household_id uuid;
begin
  v_user_id := auth.uid();
  
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  -- 1. Cancel all pending scheduled reminders for the user's occurrences
  update public.scheduled_reminders
  set status = 'cancelled'
  where occurrence_id in (
    select bo.id
    from public.bill_occurrences bo
    join public.bills b on b.id = bo.bill_id
    where b.created_by = v_user_id
  )
  and status = 'pending';

  -- 2. Delete notification log entries for this user
  delete from public.notification_log
  where user_id = v_user_id;

  -- 3. Delete push tokens for this user
  delete from public.push_tokens
  where user_id = v_user_id;

  -- 4. Delete audit log entries for households where this user is a member
  delete from public.audit_log
  where household_id in (
    select household_id
    from public.household_members
    where user_id = v_user_id
  );

  -- 5. Delete households where this user is the only member (personal households)
  -- This cascades to: categories, bills, bill_occurrences, bill_reminder_rules,
  -- scheduled_reminders, household_members
  for v_household_id in
    select hm.household_id
    from public.household_members hm
    where hm.user_id = v_user_id
    and not exists (
      select 1
      from public.household_members hm2
      where hm2.household_id = hm.household_id
      and hm2.user_id != v_user_id
      and hm2.status = 'active'
    )
  loop
    delete from public.households where id = v_household_id;
  end loop;

  -- 6. Delete remaining household memberships
  delete from public.household_members
  where user_id = v_user_id;

  -- 7. Delete the profile (this will set null on households.created_by, bills.created_by)
  delete from public.profiles where id = v_user_id;

  -- 8. Finally, delete from auth.users
  -- This is the authoritative deletion that Supabase Auth relies on
  delete from auth.users where id = v_user_id;
end;
$$;

-- Ensure the function can be called by authenticated users
grant execute on function public.delete_user_account() to authenticated;
