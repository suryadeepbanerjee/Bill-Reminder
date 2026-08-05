# Email Notifications

## Architecture

```
reminder-materializer (every 15min)
  → materializes pending reminders from rules

reminder-dispatcher (every 5min)
  → claims pending reminders
  → sends push notifications via expo
  → sends email via email-sender edge function

email-sender
  → uses Resend API
  → renders HTML from notification.ts template
```

## Email Template

**File**: `supabase/functions/email-sender/templates/notification.ts`

- Dark background `#0f172a`
- Max-width `520px`, `16px` rounded corners
- Mobile-responsive: `@media max-width: 620px`
  - Bill detail rows stack vertically
  - CTA button goes full-width
- Brand color: gold/amber `#b69317`
- Labels: `12px` uppercase
- Outlook-compatible table layout with MSO conditionals

## Status-Aware Messages

| Status | Message Tone |
|--------|-------------|
| overdue | "is overdue. Please make the payment" |
| due_today | "is due today. Don't forget" |
| expected_payment | "has a payment expected soon" |
| generated | "A new occurrence has been generated" |
| upcoming | "is coming up. Here's a heads-up" |

## Configuration

- **From**: `billalert@billreminder.suryadeepbanerjee.in`
- **Reply-to**: `official@suryadeepbanerjee.in`
- **Auth**: `double_confirm_changes = true` (OTP from both old AND new email)
- **User toggle**: `email_notifications_enabled` on profiles table
- **CTA URL**: `https://billreminder.suryadeepbanerjee.in/bill/{billId}`

## Invite Emails

The `invite-member` function also sends branded emails:
- Dark theme matching the app
- Shows inviter name + household name
- "Accept Invitation" CTA button
- Link to `https://billreminder.suryadeepbanerjee.in/accept-invite?hid={householdId}`
