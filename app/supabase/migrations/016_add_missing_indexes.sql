-- Migration: 016_add_missing_indexes
-- Description: Add missing indexes identified during EXPLAIN audit for foreign keys and common query patterns.

create index if not exists categories_household_id_idx on public.categories (household_id);
create index if not exists notification_log_user_id_idx on public.notification_log (user_id);
create index if not exists household_members_household_id_idx on public.household_members (household_id);
create index if not exists household_members_user_id_idx on public.household_members (user_id);
