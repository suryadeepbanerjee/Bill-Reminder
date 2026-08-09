<div align="center">

<img src="screenshots/landing-page.png" alt="Bill Reminder landing page" width="920">

<br>

# Bill Reminder

### A private, cross-platform way to stay ahead of recurring payments.

<p>
  <a href="https://billreminder.suryadeepbanerjee.in">
    <img src="https://img.shields.io/badge/Live-billreminder.suryadeepbanerjee.in-D1A920?style=flat-square&labelColor=0A0A0C" alt="Live website">
  </a>
  <img src="https://img.shields.io/badge/React%20Native-Expo%2054-0A0A0C?style=flat-square&logo=expo&logoColor=white" alt="React Native">
  <img src="https://img.shields.io/badge/Supabase-PostgreSQL-0A0A0C?style=flat-square&logo=supabase&logoColor=white" alt="Supabase">
  <img src="https://img.shields.io/badge/License-MIT-D1A920?style=flat-square&labelColor=0A0A0C" alt="MIT License">
</p>

<p>
  <img src="https://readme-typing-svg.demolab.com?font=Inter&weight=500&size=17&duration=2800&pause=900&color=D1A920&center=true&vCenter=true&width=620&lines=Recurring+payments%2C+without+the+mental+overhead.;Mobile-first.+Web-ready.+Private+by+design.;Built+around+real+reminder+and+recurrence+logic." alt="Animated project description">
</p>

</div>

---

## The idea

Most bill trackers stop at storing a due date.

Bill Reminder is built around what happens after that: recurring cycles, reminders, payment history, household access, authentication, and the small details that make a reminder system dependable rather than decorative.

It gives you one place to see what needs attention, what is coming next, and what has already been paid.

The project is deliberately **mobile-first**, with a production web dashboard that shares the same backend and data model.

---

## Product

<table>
<tr>
<td width="50%" valign="top">

### Home

A quick view of the financial work that actually needs attention.

- Overdue, due-today, and upcoming counts
- Total amount currently owed
- Action-required bills
- Upcoming payments
- Recently paid activity

</td>
<td width="50%" valign="top">

<img src="screenshots/mobile-home.png" alt="Bill Reminder mobile dashboard">

</td>
</tr>
</table>

<br>

<table>
<tr>
<td width="50%" valign="top">

<img src="screenshots/mobile-bills.png" alt="Bill Reminder mobile bills screen">

</td>
<td width="50%" valign="top">

### Bills

A focused bill list with search and state filters.

Bills can represent subscriptions, utilities, rent, credit cards, education, hosting, insurance and other recurring expenses.

The important part is not the list. It is the recurrence model behind it.

</td>
</tr>
</table>

---

## Designed around recurrence

A recurring payment is not simply `due_date + 30 days`.

Bill Reminder distinguishes between different billing models and keeps the next occurrence derived from the underlying rule.

### Fixed due dates

For payments such as rent, EMIs or utilities where the due day is anchored to the cycle.

### Prepaid / recharge

For payments where the next cycle moves based on the previous payment, such as certain subscriptions and recharges.

### One-time payments

For expenses that should exist once and then disappear from the active schedule.

The app also provides a live recurrence preview while creating or editing a bill, so the user can see what the schedule actually means before saving it.

---

## Add a bill

The creation flow is intentionally split into three steps:

<table>
<tr>
<td width="33%" align="center">

<img src="screenshots/mobile-add-bill-category.png" alt="Bill category selection">

**01 — Category**

Choose the type of bill.

</td>
<td width="33%" align="center">

<img src="screenshots/mobile-add-bill-details.png" alt="Bill details">

**02 — Details**

Define the name, provider, amount and billing model.

</td>
<td width="33%" align="center">

<img src="screenshots/mobile-add-bill-schedule.png" alt="Bill schedule">

**03 — Schedule**

Set recurrence and the date anchor.

</td>
</tr>
</table>

This is backed by React Hook Form and Zod validation rather than trusting the UI to behave itself, because users have a remarkable talent for finding the one input path nobody tested.

---

## Bill details

<img src="screenshots/mobile-bill-details-amazon.png" alt="Amazon Prime bill details" width="430">

The detail screen brings the complete lifecycle of a bill together:

- Current amount and payment state
- Due date and recurrence
- Reminder rules
- Push and email notification preferences
- Payment history
- Mark-paid and transaction deletion flows
- Editing through the same recurrence model used during creation

A second example shows how the same screen handles variable amounts and fixed due dates:

<img src="screenshots/mobile-bill-details-hdfc.png" alt="HDFC Credit Card bill details" width="430">

---

## Web dashboard

The web application is not a separate product bolted onto the side.

It is a feature-parity port of the mobile experience using the same Supabase backend, shared data model and query patterns.

<img src="screenshots/web-dashboard.png" alt="Bill Reminder web dashboard" width="1000">

### Desktop application shell

- Persistent sidebar navigation
- Dashboard, bills, add-bill, settings and household management
- Responsive mobile web layout
- Same recurrence and reminder behaviour as the mobile client
- Dark/light/system theme support
- Export to JSON on the web

### Authentication

<img src="screenshots/web-login.png" alt="Bill Reminder web sign in" width="820">

Authentication uses Supabase Auth with email/password, Google Sign-In and OTP-based flows for sensitive account operations.

---

## Settings and privacy

<img src="screenshots/mobile-settings.png" alt="Bill Reminder settings" width="430">

The settings area keeps account, appearance, notification and data controls together.

It includes:

- Profile management
- Household selection
- Theme controls
- Push notification settings
- Email notification settings
- JSON data export
- Account deletion with OTP verification
- Household management and role controls

---

# Architecture

```text
                         ┌─────────────────────────┐
                         │       Bill Reminder     │
                         └────────────┬────────────┘
                                      │
                    ┌─────────────────┴─────────────────┐
                    │                                   │
             Mobile Client                         Web Client
          React Native + Expo                    React + Vite
                    │                                   │
                    └─────────────────┬─────────────────┘
                                      │
                              Shared data model
                                      │
                         ┌────────────▼────────────┐
                         │       Supabase          │
                         │                         │
                         │ PostgreSQL              │
                         │ Auth + RLS              │
                         │ RPCs + triggers         │
                         │ Edge Functions          │
                         └────────────┬────────────┘
                                      │
                    ┌─────────────────┼─────────────────┐
                    │                 │                 │
                 pg_cron          Upstash Redis       Resend
                    │             rate limiting       email
                    │
          occurrence generation
          reminder materialization
          reminder dispatch
                    │
              ┌─────┴─────┐
              │           │
          Expo Push     Email
             API       notifications
```

## Technology

| Layer | Technology |
|---|---|
| Mobile | React Native, Expo SDK 54 |
| Navigation | Expo Router 6 |
| Styling | NativeWind 4 |
| State | Zustand |
| Server state | TanStack React Query |
| Forms | React Hook Form + Zod |
| Animation | React Native Reanimated |
| Backend | Supabase PostgreSQL |
| Authentication | Supabase Auth |
| Server logic | Supabase Edge Functions + Deno |
| Scheduled work | PostgreSQL `pg_cron` |
| Rate limiting | Upstash Redis |
| Email | Resend |
| Push | Expo Push API |
| Web | React + Vite |
| Web routing | React Router 7 |
| Web motion | Framer Motion |
| Deployment | Vercel |

---

# Security is part of the architecture

Security was treated as an implementation concern rather than a README adjective.

The project has gone through a dedicated security audit and subsequent hardening passes covering the mobile app, web application, database policies, Edge Functions, authentication flows, secrets, deep links and rate limiting.

### Database

- Household-scoped Row Level Security
- Membership checks around privileged operations
- `SECURITY DEFINER` RPCs with explicit authorization boundaries
- Database triggers enforcing ownership invariants
- Audit logging for sensitive household operations

### Edge Functions

User-facing functions require authenticated sessions where appropriate.

CORS uses an explicit origin allowlist rather than a wildcard, while privileged and cron-triggered functions use server-side secrets.

### Rate limiting

User-facing Edge Functions use a shared Redis sliding-window limiter.

The limiter:

- Uses server-derived identity
- Performs atomic checks with Redis Lua
- Returns standard `429` responses and rate-limit headers
- Covers authentication-adjacent and household-management operations
- Adds explicit email quota protection
- Has automated unit/integration coverage documented at 15/15 passing

### CAPTCHA

Authentication flows are protected by a Turnstile-based application-layer guard.

The current implementation covers both mobile and web authentication paths, including sign-in, sign-up, OTP, recovery and verification flows.

### Sensitive operations

High-impact actions such as account deletion and household ownership transfer require OTP verification.

Ownership transfer is implemented as an atomic database operation so the system cannot intentionally leave a household without an owner or create two owners through the transfer path.

> Security status is intentionally described conservatively. The project documentation records items that still require live/device verification and a small set of consciously accepted risks. No application should call itself "fully secure" because a README looked confident enough.

---

# Household model

Bill Reminder supports shared households with three roles:

| Role | Bill management | Household management | Invite members |
|---|---:|---:|---:|
| Owner | Yes | Yes | Yes |
| Admin | Yes | No | No |
| Member | No | No | No |

Ownership transfer is restricted to the current Owner and uses OTP verification, rate limiting, an atomic RPC and an audit-log entry.

The database trigger is the final authority on ownership, rather than relying solely on the client UI.

---

# Reminder pipeline

```text
Recurring bill
     │
     ▼
Occurrence Generator
     │
     ▼
Open Occurrence
     │
     ▼
Reminder Materializer
     │
     ▼
Scheduled Reminder
     │
     ▼
Reminder Dispatcher
     │
     ├───────────────┐
     ▼               ▼
Push Sender      Email Sender
     │               │
 Expo Push API     Resend
```

Scheduled work is handled server-side through PostgreSQL cron jobs and Edge Functions.

The mobile client manages reminder rules. It does not need to stay open for the backend scheduler to understand when a reminder should be dispatched.

---

# Engineering details

### State and data

The clients use TanStack React Query for server state and Zustand for local application state such as authentication, household context and theme.

### Validation

Form input is validated with Zod schemas and React Hook Form.

### Interaction safety

Critical controls use guarded callbacks to reduce accidental duplicate submissions and repeated navigation caused by rapid taps.

### Error handling

The application routes user-visible failures through a shared error-humanization layer instead of exposing raw database, network or provider errors.

### Performance

The mobile startup path keeps heavyweight native modules lazy where possible. The CAPTCHA host, for example, is loaded lazily so the WebView dependency does not sit on the normal cold-start path.

---

# Project structure

```text
bill-reminder/
├── app/
│   ├── app/                  # Expo Router screens
│   ├── components/           # Shared mobile UI
│   ├── hooks/                # React Query hooks
│   ├── lib/                  # Supabase, notifications, theme, errors
│   ├── stores/               # Zustand stores
│   └── schemas/              # Zod schemas
│
├── packages/
│   └── shared/               # Shared types, schemas and utilities
│
├── supabase/
│   ├── functions/            # Deno Edge Functions
│   └── migrations/            # PostgreSQL migrations
│
├── website/
│   ├── src/pages/             # Web routes
│   ├── src/components/        # Web UI
│   └── src/lib/               # Web API adapters
│
└── screenshots/               # README product screenshots
```

---

# Running locally

### Mobile

```bash
cd app
npm install
npx expo start
```

### Website

```bash
cd website
npm install
npm run dev
```

### Environment

Create local environment files from the project's example configuration.

Never commit service-role keys, API secrets or production credentials.

Public client configuration such as Supabase's anon key is not a substitute for server-side authorization. RLS and backend authorization remain the security boundary.

---

# Deployment

The web application is deployed as a Vercel SPA.

The mobile application is built with Expo.

Supabase hosts the PostgreSQL database, authentication layer, RPCs, scheduled jobs and Edge Functions.

The architecture deliberately keeps the clients relatively thin: business-critical recurrence, authorization, reminder scheduling and privileged operations live on the backend.

---

# Roadmap

The project is already usable, but several engineering areas remain intentionally open:

- Physical-device verification of the native CAPTCHA flow
- Universal Links / Android App Links replacing the remaining custom-scheme deep-link paths
- Continued dependency upgrades as Expo releases move forward
- Further live verification of deployed database policies and function grants
- Additional operational monitoring for security events

The goal is not to keep adding features forever. The goal is to make the existing ones increasingly difficult to break.

---

## License

MIT

---

<div align="center">

### Bill Reminder

Built by **Suryadeep Banerjee**

<a href="https://billreminder.suryadeepbanerjee.in">Website</a>
&nbsp;&nbsp;·&nbsp;&nbsp;
<a href="https://github.com/suryadeepbanerjee">GitHub</a>

<br><br>

<img src="https://capsule-render.vercel.app/api?type=waving&height=100&section=footer&color=0A0A0C&reversal=false" width="100%" alt="">

</div>
