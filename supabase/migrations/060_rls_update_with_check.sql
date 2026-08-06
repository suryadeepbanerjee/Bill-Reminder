-- Migration: 060_rls_update_with_check
-- Description: Close the RLS UPDATE-policy gap flagged by the audit — UPDATE
-- policies only had USING (old row) and no WITH CHECK (new row). An editor
-- could re-point rows (e.g. a bill's household_id, category_id to another
-- household's category, occurrence's bill_id) as long as the OLD row passed
-- membership. WITH CHECK now constrains the NEW row too.
--
-- Also adds a trigger that makes bills.household_id immutable after INSERT —
-- a bill can never be silently moved between households by an UPDATE.

-- ============ 1. WITH CHECK on UPDATE policies ============

-- BILLS
drop policy if exists "editors update bills" on public.bills;
create policy "editors update bills"
  on public.bills for update
  using (
    public.is_household_member(household_id) and
    public.household_role(household_id) in ('admin', 'editor')
  )
  with check (
    public.is_household_member(household_id) and
    public.household_role(household_id) in ('admin', 'editor')
  );

-- CATEGORIES
drop policy if exists "editors update categories" on public.categories;
create policy "editors update categories"
  on public.categories for update
  using (
    public.is_household_member(household_id) and
    public.household_role(household_id) in ('admin', 'editor')
  )
  with check (
    public.is_household_member(household_id) and
    public.household_role(household_id) in ('admin', 'editor')
  );

-- BILL_OCCURRENCES
drop policy if exists "editors update bill occurrences" on public.bill_occurrences;
create policy "editors update bill occurrences"
  on public.bill_occurrences for update
  using (
    exists (
      select 1 from public.bills
      where bills.id = bill_occurrences.bill_id
      and public.is_household_member(bills.household_id)
      and public.household_role(bills.household_id) in ('admin', 'editor')
    )
  )
  with check (
    exists (
      select 1 from public.bills
      where bills.id = bill_occurrences.bill_id
      and public.is_household_member(bills.household_id)
      and public.household_role(bills.household_id) in ('admin', 'editor')
    )
  );

-- BILL_REMINDER_RULES
drop policy if exists "editors update reminder rules" on public.bill_reminder_rules;
create policy "editors update reminder rules"
  on public.bill_reminder_rules for update
  using (
    exists (
      select 1 from public.bills
      where bills.id = bill_reminder_rules.bill_id
      and public.is_household_member(bills.household_id)
      and public.household_role(bills.household_id) in ('admin', 'editor')
    )
  )
  with check (
    exists (
      select 1 from public.bills
      where bills.id = bill_reminder_rules.bill_id
      and public.is_household_member(bills.household_id)
      and public.household_role(bills.household_id) in ('admin', 'editor')
    )
  );

-- HOUSEHOLDS
drop policy if exists "admins update households" on public.households;
create policy "admins update households"
  on public.households for update
  using (public.household_role(id) = 'admin')
  with check (public.household_role(id) = 'admin');

-- PROFILES
drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- ============ 2. Bills: household_id immutable after insert ============
-- Client code never requests this (UpdateBillInput omits household_id), so a
-- prohibition cannot break any flow — it only stops crafted UPDATEs from
-- silently relocating a bill across households.

create or replace function public.bills_block_household_move()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE' and old.household_id is distinct from new.household_id then
    raise exception 'bills.household_id cannot be changed once a bill is created';
  end if;
  return new;
end;
$$;

drop trigger if exists bills_block_household_move on public.bills;
create trigger bills_block_household_move
  before update on public.bills
  for each row execute function public.bills_block_household_move();