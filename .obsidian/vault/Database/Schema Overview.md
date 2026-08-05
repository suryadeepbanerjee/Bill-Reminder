# Database Schema

> SQL form: [[Database/Schema]] · Migrations: [[Database/Migrations]] · RPCs: [[Database/RPCs]]

## Core Tables

### profiles
Extends Supabase auth.users. One row per user.
```sql
id uuid PK → auth.users
display_name text
avatar_url text
email text
email_notifications_enabled boolean (default true)
created_at timestamptz
updated_at timestamptz
```

### households
Multi-user container. Bills belong to households.
```sql
id uuid PK
name text
created_by uuid → profiles
created_at timestamptz
```

### household_members
Membership with roles.
```sql
id uuid PK
household_id uuid → households
user_id uuid → profiles (nullable)
invited_email text (nullable)
role text (admin|editor|viewer)
status text (invited|active|removed)
created_at timestamptz
```

### categories
Per-household bill categories.
```sql
id uuid PK
household_id uuid → households
preset_key text (nullable)
name text
icon text
color text
created_at timestamptz
```

### category_presets
Global category templates.
```sql
id uuid PK
key text (unique)
name text
icon text
color text
```

### bills
Recurring bill template. NOT an occurrence.
```sql
id uuid PK
household_id uuid → households
category_id uuid → categories
title text (1-120 chars)
provider_name text (nullable, ≤80 chars)
behavior_type text (fixed_due_date|prepaid_validity|wallet_balance)
amount_expected numeric(12,2) (nullable, ≥0)
currency text (default 'INR')
repeat_kind text (monthly|yearly|every_x_days|every_x_weeks|every_x_months|none)
repeat_interval int (nullable, >0)
generation_day_offset int
expected_payment_day_offset int
due_day_offset int
validity_days int
check_interval_days int
minimum_balance numeric(12,2)
balance_notes text
anchor_date date (nullable) — universal anchor
next_due_date date (nullable) — chain-start override (054): NULL = auto, SET = materialize from that cycle
is_active boolean (default true)
created_by uuid → profiles
created_at timestamptz
updated_at timestamptz
```

### bill_occurrences
Generated instances. One row per billing cycle.
```sql
id uuid PK
bill_id uuid → bills
cycle_start date
generation_date date
expected_payment_date date
due_date date
state text (upcoming|generated|expected_payment|due_today|overdue|paid|archived)
amount numeric(12,2)
paid_at timestamptz
paid_amount numeric(12,2)
payment_notes text
receipt_path text
deleted_at timestamptz — soft delete
created_at timestamptz
updated_at timestamptz

UNIQUE (bill_id, cycle_start)
```

### bill_reminder_rules
User-configurable reminder settings.
```sql
id uuid PK
bill_id uuid → bills
anchor text (generation|expected_payment|due_date)
offset_days int
repeat_interval_hours int
repeat_cap int
channel text (push|email|both)
enabled boolean (default true)
```

### scheduled_reminders
Materialized reminders ready to send.
```sql
id uuid PK
occurrence_id uuid → bill_occurrences
rule_id uuid → bill_reminder_rules
scheduled_for timestamptz
channel text (push|email)
status text (pending|sent|skipped|failed|cancelled)
sent_at timestamptz

UNIQUE (occurrence_id, rule_id, scheduled_for, channel)
```

### push_tokens
Expo push tokens per device.
```sql
id uuid PK
user_id uuid → profiles
expo_push_token text
device_label text
created_at timestamptz
last_used_at timestamptz
```

### notification_log
Audit log of sent notifications.
```sql
id uuid PK
scheduled_reminder_id uuid → scheduled_reminders
user_id uuid → profiles
channel text
provider_message_id text
status text (sent|failed)
error text
created_at timestamptz (default now())
```

### audit_log
General audit trail.
```sql
id uuid PK
user_id uuid → profiles
action text
details jsonb
created_at timestamptz
```

## Key Relationships

```
household ──1:N── bills ──1:N── bill_occurrences
                       ──1:N── bill_reminder_rules ──1:N── scheduled_reminders
household ──1:N── household_members ──N:1── profile
household ──1:N── categories
profile ──1:N── push_tokens
```

## RLS Policies

All tables have Row Level Security. Users can only access data in their households via `household_members`.

## Indexes

- `bills_household_id_is_active_idx` on bills (household_id, is_active)
- Various indexes on foreign keys
