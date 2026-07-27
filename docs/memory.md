# Project Memory

## Core Decisions

* **Bill Model**: Bill templates separated from occurrences.
* **Reminders**: Server computes reminders, scheduling is idempotent.
* **Notifications**: Push is primary notification channel. Email is milestone-first (Resend).
* **Sync**: SQLite outbox for offline sync.
* **Database**: Multi-tenant household schema from day one. Household UI is deferred to Phase 2/Phase 5.
* **Theme**: Light mode is default, Dark mode is supported. Theme preference should be persisted using Zustand/AsyncStorage.
* **Typography**: Inter (Google Font) will be the primary font, dropping System default.
* **UI System**: Minimal, calm, professional (Linear/Things 3 inspired). No glow, no neon.

## Technical Details \& Gotchas

* **Deep Links**: Expo Go doesn't reliably support the `bill-reminder://` custom scheme for Supabase Auth redirects. A Development Build is required for Magic Link and Password Reset flows to work perfectly on devices.
* **Environment**: Use `.env.example` as source of truth for required variables.
* **Atomic Operations**: Mark-paid flow must be atomic (update occurrence + cancel reminders + trigger next generation).
* **Email Configuration**: Supabase Auth SMTP must be manually configured via the Supabase Dashboard to use Resend credentials. Branded HTML templates are needed for standard auth flows.
* **Styling**: Do not use raw color hex values injected via inline styles `style={{ backgroundColor: ... }}` if they need to support dark mode. Always use NativeWind utility classes where possible.

## Never Change

* RLS on every table.
* UUID primary keys.
* Never trust client input; validate with Zod on client and server.
* No service role key in client.
* Atomic mark-paid flow.
* Idempotent reminder scheduling.

