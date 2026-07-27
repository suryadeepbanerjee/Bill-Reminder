# Engineering Rules

## Security
- Never trust client input.
- Validate with Zod on client and server.
- RLS enabled everywhere.
- No service role key in client.

## Code
- TypeScript strict mode.
- Reusable components.
- Atomic RPCs for payments.
- Idempotent reminder scheduling.

## Notifications
- Push is primary.
- Email defaults to milestone reminders.
- User may enable every reminder or disable email.
