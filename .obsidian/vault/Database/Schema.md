# Schema

> Friendly markdown walkthrough: [[Database/Schema Overview]] · RPCs: [[Database/RPCs]]

```sql
-- All tables in app/supabase/migrations/

profiles (001)                     -- extends auth.users
  id uuid PK → auth.users          -- one-to-one with auth user
  display_name text
  avatar_url text
  email text
  email_notifications_enabled bool -- default true, user toggle
  created_at timestamptz
  updated_at timestamptz

households (002)
  id uuid PK
  name text
  created_by uuid → profiles
  created_at timestamptz

household_members (002)
  id uuid PK
  household_id uuid → households
  user_id uuid → profiles          -- nullable (invited but not joined)
  invited_email text               -- nullable
  role text CHECK (admin|editor|viewer)
  status text CHECK (invited|active|removed)
  created_at timestamptz

categories (003)
  id uuid PK
  household_id uuid → households
  preset_key text                  -- nullable, FK to category_presets.key
  name text
  icon text                        -- Ionicons name
  color text                       -- hex color
  created_at timestamptz

category_presets (012)
  id uuid PK
  key text UNIQUE                  -- e.g., 'mobile_recharge', 'electricity'
  name text
  icon text
  color text

bills (004)
  id uuid PK
  household_id uuid → households
  category_id uuid → categories
  title text CHECK (1-120 chars)
  provider_name text CHECK (≤80 chars)
  behavior_type text CHECK (fixed_due_date|prepaid_validity|wallet_balance)
  amount_expected numeric(12,2) CHECK (≥0 or null)
  currency text DEFAULT 'INR'
  repeat_kind text CHECK (monthly|yearly|every_x_days|every_x_weeks|every_x_months|none)
  repeat_interval int CHECK (>0 or null)
  generation_day_offset int        -- for fixed: days before due to generate
  expected_payment_day_offset int  -- for fixed: days before due to remind
  due_day_offset int               -- for fixed: 0=last day, N=Nth day
  validity_days int                -- legacy, unused
  check_interval_days int          -- legacy, unused
  minimum_balance numeric(12,2)    -- legacy, unused
  balance_notes text               -- legacy, unused
  anchor_date date                 -- universal anchor (THE key field)
  next_due_date date               -- chain-start override (054): NULL=auto, SET=materialize from that cycle
  is_active bool DEFAULT true      -- soft delete for bills
  created_by uuid → profiles
  created_at timestamptz
  updated_at timestamptz

bill_occurrences (005)
  id uuid PK
  bill_id uuid → bills
  cycle_start date                 -- start of billing cycle
  generation_date date             -- when occurrence was generated
  expected_payment_date date       -- when payment is expected
  due_date date                    -- when payment is due
  state text CHECK (upcoming|generated|expected_payment|due_today|overdue|paid|archived)
  amount numeric(12,2)             -- copied from bills.amount_expected
  paid_at timestamptz              -- when marked paid
  paid_amount numeric(12,2)        -- actual amount paid
  payment_notes text               -- user notes
  receipt_path text                -- file path
  deleted_at timestamptz           -- soft delete (migration 047)
  created_at timestamptz
  updated_at timestamptz
  UNIQUE (bill_id, cycle_start)

bill_reminder_rules (006)
  id uuid PK
  bill_id uuid → bills
  anchor text CHECK (generation|expected_payment|due_date)
  offset_days int                  -- days from anchor
  repeat_interval_hours int        -- repeat interval
  repeat_cap int                   -- max repeats
  channel text CHECK (push|email|both)
  enabled bool DEFAULT true

scheduled_reminders (007)
  id uuid PK
  occurrence_id uuid → bill_occurrences
  rule_id uuid → bill_reminder_rules
  scheduled_for timestamptz
  channel text CHECK (push|email)
  status text CHECK (pending|sent|skipped|failed|cancelled)
  sent_at timestamptz
  UNIQUE (occurrence_id, rule_id, scheduled_for, channel)

push_tokens (009)
  id uuid PK
  user_id uuid → profiles
  expo_push_token text
  device_label text
  created_at timestamptz
  last_used_at timestamptz

notification_log (008)
  id uuid PK
  scheduled_reminder_id uuid → scheduled_reminders
  user_id uuid → profiles
  channel text
  provider_message_id text
  status text (sent|failed)
  error text
  created_at timestamptz DEFAULT now()

audit_log (010)
  id uuid PK
  user_id uuid → profiles
  action text
  details jsonb
  created_at timestamptz
```

## Key Relationships
```
profiles ←──1:1── auth.users
households ──1:N── bills ──1:N── bill_occurrences ──1:N── scheduled_reminders
                       ──1:N── bill_reminder_rules ──1:N── scheduled_reminders
households ──1:N── household_members ──N:1── profiles
households ──1:N── categories
profiles ──1:N── push_tokens
profiles ──1:N── notification_log
```
