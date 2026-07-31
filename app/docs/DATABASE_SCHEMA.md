# Database Schema Dependency Graph

## Tables and Foreign Keys

- **profiles** (References `auth.users`)
  - Extended with `avatar_url`, `email`, `updated_at`.
- **households** (References `profiles.id` as `created_by`)
- **household_members** (References `households.id`, `profiles.id`)
- **category_presets** (Global dictionary)
- **categories** (References `households.id`, `category_presets.key`)
- **bills** (References `households.id`, `categories.id`, `profiles.id` as `created_by`)
- **bill_occurrences** (References `bills.id`)
- **bill_reminder_rules** (References `bills.id`)
- **scheduled_reminders** (References `bill_occurrences.id`, `bill_reminder_rules.id`)
- **notification_log** (References `scheduled_reminders.id`, `profiles.id`)
- **push_tokens** (References `profiles.id`)
- **audit_log** (References `households.id`, `profiles.id`)

## Trigger Flow
1. **Signup:** `auth.users` Insert 
   -> `handle_new_user()` trigger populates `profiles` with Google metadata.
   -> `handle_new_user_household()` trigger creates default `households` and `household_members`.
2. **Profile Update:** `profiles` Update
   -> `update_profiles_updated_at()` trigger sets `updated_at`.

## Missing Indexes Resolved
- `categories (household_id)`
- `notification_log (user_id)`
- `household_members (household_id)`
- `household_members (user_id)`

## RPC Functions
- **claim_pending_reminders()**: Atomic, SKIP LOCKED queue claimer for background dispatchers. Aliases correctly resolved.
