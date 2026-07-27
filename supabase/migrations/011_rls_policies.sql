-- Migration: 011_rls_policies
-- Description: Row Level Security policies for all household-scoped tables

-- ============ Helper functions ============

create or replace function public.is_household_member(hh uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from public.household_members
    where household_id = hh and user_id = auth.uid() and status = 'active'
  );
$$;

create or replace function public.household_role(hh uuid)
returns text
language sql
security definer
stable
as $$
  select role from public.household_members
  where household_id = hh and user_id = auth.uid() and status = 'active';
$$;

-- ============ PROFILES ============

-- (Policies already created in 001_create_profiles.sql)

-- ============ HOUSEHOLDS ============

create policy "members read households"
  on public.households for select
  using (public.is_household_member(id));

create policy "admins update households"
  on public.households for update
  using (public.household_role(id) = 'admin');

-- ============ HOUSEHOLD_MEMBERS ============

create policy "members read household members"
  on public.household_members for select
  using (public.is_household_member(household_id));

create policy "admins manage household members"
  on public.household_members for all
  using (public.household_role(household_id) = 'admin');

-- ============ CATEGORIES ============

create policy "members read categories"
  on public.categories for select
  using (public.is_household_member(household_id));

create policy "editors write categories"
  on public.categories for insert
  with check (
    public.is_household_member(household_id) and
    public.household_role(household_id) in ('admin', 'editor')
  );

create policy "editors update categories"
  on public.categories for update
  using (
    public.is_household_member(household_id) and
    public.household_role(household_id) in ('admin', 'editor')
  );

create policy "admins delete categories"
  on public.categories for delete
  using (public.household_role(household_id) = 'admin');

-- ============ BILLS ============

create policy "members read bills"
  on public.bills for select
  using (public.is_household_member(household_id));

create policy "editors write bills"
  on public.bills for insert
  with check (
    public.is_household_member(household_id) and
    public.household_role(household_id) in ('admin', 'editor')
  );

create policy "editors update bills"
  on public.bills for update
  using (
    public.is_household_member(household_id) and
    public.household_role(household_id) in ('admin', 'editor')
  );

create policy "admins delete bills"
  on public.bills for delete
  using (public.household_role(household_id) = 'admin');

-- ============ BILL_OCCURRENCES ============

create policy "members read bill occurrences"
  on public.bill_occurrences for select
  using (
    exists (
      select 1 from public.bills
      where bills.id = bill_occurrences.bill_id
      and public.is_household_member(bills.household_id)
    )
  );

create policy "editors write bill occurrences"
  on public.bill_occurrences for insert
  with check (
    exists (
      select 1 from public.bills
      where bills.id = bill_occurrences.bill_id
      and public.is_household_member(bills.household_id)
      and public.household_role(bills.household_id) in ('admin', 'editor')
    )
  );

create policy "editors update bill occurrences"
  on public.bill_occurrences for update
  using (
    exists (
      select 1 from public.bills
      where bills.id = bill_occurrences.bill_id
      and public.is_household_member(bills.household_id)
      and public.household_role(bills.household_id) in ('admin', 'editor')
    )
  );

create policy "admins delete bill occurrences"
  on public.bill_occurrences for delete
  using (
    exists (
      select 1 from public.bills
      where bills.id = bill_occurrences.bill_id
      and public.household_role(bills.household_id) = 'admin'
    )
  );

-- ============ BILL_REMINDER_RULES ============

create policy "members read reminder rules"
  on public.bill_reminder_rules for select
  using (
    exists (
      select 1 from public.bills
      where bills.id = bill_reminder_rules.bill_id
      and public.is_household_member(bills.household_id)
    )
  );

create policy "editors write reminder rules"
  on public.bill_reminder_rules for insert
  with check (
    exists (
      select 1 from public.bills
      where bills.id = bill_reminder_rules.bill_id
      and public.is_household_member(bills.household_id)
      and public.household_role(bills.household_id) in ('admin', 'editor')
    )
  );

create policy "editors update reminder rules"
  on public.bill_reminder_rules for update
  using (
    exists (
      select 1 from public.bills
      where bills.id = bill_reminder_rules.bill_id
      and public.is_household_member(bills.household_id)
      and public.household_role(bills.household_id) in ('admin', 'editor')
    )
  );

create policy "admins delete reminder rules"
  on public.bill_reminder_rules for delete
  using (
    exists (
      select 1 from public.bills
      where bills.id = bill_reminder_rules.bill_id
      and public.household_role(bills.household_id) = 'admin'
    )
  );

-- ============ SCHEDULED_REMINDERS ============
-- Read-only for users (managed by Edge Functions with service role)

create policy "users read own scheduled reminders"
  on public.scheduled_reminders for select
  using (
    exists (
      select 1 from public.bill_occurrences bo
      join public.bills b on b.id = bo.bill_id
      where bo.id = scheduled_reminders.occurrence_id
      and public.is_household_member(b.household_id)
    )
  );

-- ============ NOTIFICATION_LOG ============
-- Read-only for users (written by Edge Functions)

create policy "users read own notification log"
  on public.notification_log for select
  using (user_id = auth.uid());

-- ============ PUSH_TOKENS ============

create policy "users manage own push tokens"
  on public.push_tokens for all
  using (user_id = auth.uid());

-- ============ AUDIT_LOG ============
-- Read-only for members, admin-scoped

create policy "members read audit log"
  on public.audit_log for select
  using (public.is_household_member(household_id));

create policy "system writes audit log"
  on public.audit_log for insert
  with check (true);
