-- Migration: 063_three_tier_roles
-- Description: Introduce a three-tier role system on households.
--
--   super_admin  — the household creator. Cannot be transferred or removed as
--                  long as the household exists. Can do everything, including
--                  household delete, member invites, and role changes.
--   admin        — assignable by the super admin to a member. Can add/edit/delete
--                  bills and categories, but CANNOT delete the household, add
--                  members, or change member roles.
--   member       — default role for invited users. Read/track + push only; no
--                  editing. Email notifications only reach admin + super_admin.
--
-- Migration map (existing roles → new roles):
--   admin  -> super_admin   (creator keeps full power)
--   editor -> admin         (previous bill editors become admins)
--   viewer -> member        (previously read-only users become members)

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Rebuild the role CHECK constraint with the new vocabulary
-- ─────────────────────────────────────────────────────────────────────────────
-- Drop whichever check references the old role values (auto-named
-- household_members_role_check in migration 002).
do $$
declare
  v_constraint text;
begin
  select conname into v_constraint
  from pg_constraint
  where conrelid = 'public.household_members'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) like '%role%'
  order by conname
  limit 1;

  if v_constraint is not null then
    execute format('alter table public.household_members drop constraint %I', v_constraint);
  end if;
end $$;

alter table public.household_members
  add constraint household_members_role_check
  check (role in ('super_admin', 'admin', 'member'));

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Backfill existing rows to the new role vocabulary
-- ─────────────────────────────────────────────────────────────────────────────
update public.household_members set role = 'super_admin' where role = 'admin';
update public.household_members set role = 'admin'       where role = 'editor';
update public.household_members set role = 'member'      where role = 'viewer';

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. New-household trigger assigns super_admin to the creator
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.handle_new_user_household()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  new_household_id uuid;
  user_display_name text;
begin
  -- Get display name from profile
  select display_name into user_display_name
  from public.profiles
  where id = new.id;

  -- Create household
  insert into public.households (name, created_by)
  values (coalesce(user_display_name, 'My Household') || '''s Household', new.id)
  returning id into new_household_id;

  -- Add user as super admin (the household creator)
  insert into public.household_members (household_id, user_id, role, status)
  values (new_household_id, new.id, 'super_admin', 'active');

  return new;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Role helper functions
-- ─────────────────────────────────────────────────────────────────────────────
-- Any user who can touch bill data = super_admin or admin.
create or replace function public.is_household_editor(hh uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from public.household_members
    where household_id = hh
      and user_id = auth.uid()
      and status = 'active'
      and role in ('super_admin', 'admin')
  );
$$;

-- Household-super_admin helper (only the creator can manage members/household).
create or replace function public.is_household_super_admin(hh uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from public.household_members
    where household_id = hh
      and user_id = auth.uid()
      and status = 'active'
      and role = 'super_admin'
  );
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Super-admin invariant trigger
-- ─────────────────────────────────────────────────────────────────────────────
-- Only the household creator (households.created_by) may hold super_admin, and
-- at most one active super_admin may exist per household. Blocks both takeover
-- (promoting a non-creator to super_admin) and a silent second super_admin.
create or replace function public.household_super_admin_guard()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.role = 'super_admin' then
    -- The holder of super_admin must be the household creator.
    if not exists (
      select 1 from public.households
      where id = new.household_id
        and created_by = new.user_id
    ) then
      raise exception 'Only the household creator can be a super admin';
    end if;

    -- Only one active super_admin per household (the creator). Invited rows
    -- never touch this path (invites default to member), but guard anyway.
    if exists (
      select 1 from public.household_members
      where id is distinct from new.id
        and household_id = new.household_id
        and status = 'active'
        and role = 'super_admin'
    ) then
      raise exception 'A super admin already exists for this household';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists household_super_admin_guard on public.household_members;
create trigger household_super_admin_guard
  before insert or update of role on public.household_members
  for each row execute function public.household_super_admin_guard();

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Rewrite household-scoped RLS policies for the three tiers
-- ─────────────────────────────────────────────────────────────────────────────
-- HOUSEHOLDS — rename/update only by super_admin.
drop policy if exists "admins update households" on public.households;
create policy "admins update households"
  on public.households for update
  using (public.is_household_super_admin(id))
  with check (public.is_household_super_admin(id));

-- HOUSEHOLD_MEMBERS — management (invite/remove/role) only by super_admin.
drop policy if exists "admins manage household members" on public.household_members;
create policy "admins manage household members"
  on public.household_members for all
  using (public.is_household_super_admin(household_id));

-- 056's self-insert policy required role='editor', which no longer exists in
-- the CHECK. Tighten it to the new default invite role 'member'.
drop policy if exists "self-insert only into empty households as invited editor"
  on public.household_members;
create policy "self-insert only into empty households as invited member"
  on public.household_members for insert
  with check (
    user_id = auth.uid()
    and status = 'invited'
    and role = 'member'
    and invited_email is not distinct from lower(auth.jwt()->>'email')
    and not exists (
      select 1 from public.household_members existing
      where existing.household_id = household_members.household_id
    )
  );

-- CATEGORIES — write/delete by super_admin or admin.
drop policy if exists "editors write categories" on public.categories;
create policy "editors write categories"
  on public.categories for insert
  with check (
    public.is_household_member(household_id) and
    public.is_household_editor(household_id)
  );

drop policy if exists "editors update categories" on public.categories;
create policy "editors update categories"
  on public.categories for update
  using (
    public.is_household_member(household_id) and
    public.is_household_editor(household_id)
  )
  with check (
    public.is_household_member(household_id) and
    public.is_household_editor(household_id)
  );

drop policy if exists "admins delete categories" on public.categories;
create policy "admins delete categories"
  on public.categories for delete
  using (public.is_household_editor(household_id));

-- BILLS — write/delete by admin or super_admin.
drop policy if exists "editors write bills" on public.bills;
create policy "editors write bills"
  on public.bills for insert
  with check (
    public.is_household_member(household_id) and
    public.is_household_editor(household_id)
  );

drop policy if exists "editors update bills" on public.bills;
create policy "editors update bills"
  on public.bills for update
  using (
    public.is_household_member(household_id) and
    public.is_household_editor(household_id)
  )
  with check (
    public.is_household_member(household_id) and
    public.is_household_editor(household_id)
  );

drop policy if exists "admins delete bills" on public.bills;
create policy "admins delete bills"
  on public.bills for delete
  using (public.is_household_editor(household_id));

-- BILL_OCCURRENCES
drop policy if exists "editors write bill occurrences" on public.bill_occurrences;
create policy "editors write bill occurrences"
  on public.bill_occurrences for insert
  with check (
    exists (
      select 1 from public.bills
      where bills.id = bill_occurrences.bill_id
        and public.is_household_editor(bills.household_id)
    )
  );

drop policy if exists "editors update bill occurrences" on public.bill_occurrences;
create policy "editors update bill occurrences"
  on public.bill_occurrences for update
  using (
    exists (
      select 1 from public.bills
      where bills.id = bill_occurrences.bill_id
        and public.is_household_editor(bills.household_id)
    )
  )
  with check (
    exists (
      select 1 from public.bills
      where bills.id = bill_occurrences.bill_id
        and public.is_household_editor(bills.household_id)
    )
  );

drop policy if exists "admins delete bill occurrences" on public.bill_occurrences;
create policy "admins delete bill occurrences"
  on public.bill_occurrences for delete
  using (
    exists (
      select 1 from public.bills
      where bills.id = bill_occurrences.bill_id
        and public.is_household_editor(bills.household_id)
    )
  );

-- BILL_REMINDER_RULES
drop policy if exists "editors write reminder rules" on public.bill_reminder_rules;
create policy "editors write reminder rules"
  on public.bill_reminder_rules for insert
  with check (
    exists (
      select 1 from public.bills
      where bills.id = bill_reminder_rules.bill_id
        and public.is_household_editor(bills.household_id)
    )
  );

drop policy if exists "editors update reminder rules" on public.bill_reminder_rules;
create policy "editors update reminder rules"
  on public.bill_reminder_rules for update
  using (
    exists (
      select 1 from public.bills
      where bills.id = bill_reminder_rules.bill_id
        and public.is_household_editor(bills.household_id)
    )
  )
  with check (
    exists (
      select 1 from public.bills
      where bills.id = bill_reminder_rules.bill_id
        and public.is_household_editor(bills.household_id)
    )
  );

drop policy if exists "admins delete reminder rules" on public.bill_reminder_rules;
create policy "admins delete reminder rules"
  on public.bill_reminder_rules for delete
  using (
    exists (
      select 1 from public.bills
      where bills.id = bill_reminder_rules.bill_id
        and public.is_household_editor(bills.household_id)
    )
  );