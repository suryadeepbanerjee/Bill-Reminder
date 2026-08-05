# Edge Functions

```yaml
location: app/supabase/functions/
count: 11
runtime: Deno
auth: CRON_SECRET for cron-triggered, user JWT for client-called
cors: "*"
```

## Flow Diagram
```
┌─────────────────────────────────────────────────────┐
│  pg_cron                                            │
│  ├── daily 2AM → occurrence-generator               │
│  ├── every 15min → reminder-materializer            │
│  ├── every 5min → reminder-dispatcher               │
│  └── weekly Sun 3AM → cleanup                       │
└─────────────────────────────────────────────────────┘
         │                    │
         ▼                    ▼
┌─────────────────┐  ┌─────────────────┐
│ occurrence-      │  │ reminder-        │
│ generator        │  │ materializer     │
│                  │  │                  │
│ For each active  │  │ Read rules +     │
│ bill: call       │  │ open occurrences │
│ generate_next_   │  │ Insert into      │
│ occurrence()     │  │ scheduled_       │
│                  │  │ reminders        │
└─────────────────┘  └────────┬────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │ reminder-        │
                    │ dispatcher       │
                    │                  │
                    │ claim_pending_   │
                    │ reminders()      │
                    │ Route to:        │
                    │ ├─ push-sender   │
                    │ └─ email-sender  │
                    └────────┬────────┘
                    ┌────────┴────────┐
                    ▼                  ▼
          ┌──────────────┐  ┌──────────────┐
          │ push-sender  │  │ email-sender │
          │              │  │              │
          │ Expo Push    │  │ Resend API   │
          │ API          │  │ + HTML       │
          │ → notif_log  │  │ template     │
          └──────────────┘  └──────────────┘
```

## Function Details

**Cron-triggered** (5 via pg_cron — schedules in 022/023): occurrence-generator,
reminder-materializer, reminder-dispatcher, cleanup + hourly occurrence-state-machine
(SQL function, not an edge function). **Client-invoked** (6): create-household,
invite-member, delete-household, delete-account, accept-invite, plus email/push-sender
invoked by the dispatcher.

### 1. email-sender (`index.ts:1`) — called by dispatcher
```typescript
// Input: reminderId, userId, billId, email, subject, billName, amount, dueDate, status
// Calls Resend API: POST https://api.resend.com/emails
// From: "Bill Reminder <billalert@billreminder.suryadeepbanerjee.in>"
// Reply-to: official@suryadeepbanerjee.in
// Renders notification.ts template (473 lines) with status-aware messages
// Logs to notification_log, updates scheduled_reminders status
```

### 2. reminder-materializer (`index.ts:1`) — cron every 15 min (022)
```typescript
// Reads bill_reminder_rules (enabled=true) with bills join
// For each rule × occurrence:
//   anchor = rule.anchor → occurrence.generation_date / expected_payment_date / due_date
//   scheduled_for = anchor + rule.offset_days, at 9:00 AM
//   channels = rule.channel → ['push'] | ['email'] | ['push','email']
//   Filters email if profile.email_notifications_enabled = false
// Overdue/due_today: creates daily reminders (checks for existing today)
// Idempotent via unique constraint (23505 errors caught)
```

### 3. reminder-dispatcher (`index.ts:1`) — cron every 5 min (022)
```typescript
// Calls claim_pending_reminders() RPC (atomic lock-and-claim)
// For each claimed reminder:
//   Fetch occurrence + bill details
//   If channel='push' → invoke push-sender
//   If channel='email' → fetch profile.email, check enabled, invoke email-sender
//   On failure: update status='failed'
```

### 4. push-sender (`index.ts:1`) — called by dispatcher
```typescript
// Gets user's push_tokens
// If no tokens: status='skipped'
// POST to https://exp.host/--/api/v2/push/send
// Messages: { to, sound:'default', title, body, data:{reminderId} }
// Logs to notification_log
```

### 5. occurrence-generator (`index.ts:1`) — cron daily 2AM UTC (022)
```typescript
// Gets all active bills
// For each: supabase.rpc('generate_next_occurrence', { p_bill_id: bill.id })
```

### 6. cleanup (`index.ts:1`) — cron weekly Sun 3AM UTC (022)
```typescript
// DELETE notification_log WHERE created_at < now() - 90 days
// DELETE bill_occurrences WHERE state='archived' AND created_at < now() - 1 year
```

### 7. create-household (`index.ts:1`) — client (auth)
```typescript
// Input: { name }
// Verifies caller JWT, creates household row + adds user as admin member
// Uses service-role client (bypasses RLS)
```

### 8. invite-member (`index.ts:1`) — client (auth)
```typescript
// Input: { householdId, email }
// Verifies caller is admin
// Looks up target in auth.users via admin.listUsers
// Creates household_members row (status='invited', role='editor')
// Sends invite email via Resend with accept link
// Link: https://billreminder.suryadeepbanerjee.in/accept-invite?hid={householdId}
```

### 9. delete-household (`index.ts:1`) — client (auth)
```typescript
// Input: { householdId }
// Verifies caller is an active admin member of that household
// Refuses when it's the caller's only household (count <= 1)
// Deletes the household (cascades to members, bills, categories, occurrences)
```

### 10. delete-account (`index.ts:1`) — client (auth, post-OTP)
```typescript
// Verifies caller JWT
// Cancels pending scheduled_reminders for their bills
// Deletes notification_log, push_tokens, audit_log for their households
// Deletes sole-member (personal) households
// Deletes remaining household_members + profile, then auth.admin.deleteUser
```

### 11. accept-invite (`index.ts:1`) — client (auth)
```typescript
// Input: { householdId }
// Verifies caller JWT
// Finds their household_members row with status='invited'
// Sets status='active' (role 'editor' from invite-member)
```

## claim_pending_reminders RPC (migration 015)
```sql
-- Lock-and-claim pattern: FOR UPDATE SKIP LOCKED
-- Returns: id, occurrence_id, rule_id, scheduled_for, channel, bill_id, user_id
-- Processes up to 50 pending reminders where scheduled_for <= now()
```
