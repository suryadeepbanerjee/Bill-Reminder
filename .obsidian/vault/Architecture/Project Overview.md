# Project Overview

## Identity
- **Name**: Bill Reminder
- **Type**: SaaS mobile app + landing website
- **Purpose**: Help users manage, track, and pay bills efficiently
- **Owner**: Suryadeep Banerjee
- **Domain**: billreminder.suryadeepbanerjee.in

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Mobile | React Native + Expo | SDK 54 |
| Router | Expo Router | v6 |
| Styling | NativeWind (Tailwind CSS) | 4.2.1 |
| State | Zustand (auth) + React Query (data) | — |
| Forms | React Hook Form + Zod | — |
| Database | Supabase (PostgreSQL) | — |
| Auth | Supabase Auth | — |
| Edge Functions | Deno (Supabase) | — |
| Notifications | expo-notifications + Expo Push API | — |
| Email | Resend API | — |
| Cron | pg_cron on Supabase | — |
| Landing | React + Vite + Framer Motion | — |

## Project Structure

```
Bill Reminder/
├── app/                          # Mobile app (Expo)
│   ├── app/                      # Expo Router screens
│   │   ├── (tabs)/               # Tab navigator
│   │   │   ├── dashboard/        # Dashboard/home
│   │   │   ├── bills/            # Bills list
│   │   │   ├── add/              # Add-tab redirect
│   │   │   └── settings/         # Settings, profile, members
│   │   ├── (auth)/               # Sign-in, sign-up, OTP, password, verify-email
│   │   ├── bill/[id].tsx         # Bill detail + edit sheet
│   │   ├── add-bill.tsx          # Create bill
│   │   ├── accept-invite.tsx     # Invite landing
│   │   ├── callback.tsx          # Auth callback
│   │   └── _layout.tsx           # Root layout
│   ├── components/               # UI components
│   │   ├── bills/                # Bill-specific
│   │   │   ├── BillCard.tsx
│   │   │   ├── BillStateChip.tsx
│   │   │   ├── CategoryPill.tsx
│   │   │   ├── DeleteTransactionModal.tsx
│   │   │   ├── MarkPaidModal.tsx
│   │   │   └── RecurrencePreview.tsx
│   │   └── ui/                   # Shared UI (30 files: Button, Modal, IconButton,
│   │       │                     #   DateAnchorPicker, DayPicker, MonthPicker, YearPicker,
│   │       │                     #   FAB, TextInput, NumericInput, Screen, Card, …)
│   ├── hooks/                    # React Query hooks
│   │   ├── useBills.ts
│   │   ├── useOccurrences.ts
│   │   ├── useReminders.ts
│   │   ├── useHousehold.ts
│   │   ├── useProfile.ts
│   │   ├── useCategories.ts
│   │   ├── useRecurrencePreview.ts
│   │   ├── useTapGuard.ts
│   │   ├── useToast.ts
│   │   └── useGuardedCallback.ts
│   ├── lib/                      # Utilities
│   │   ├── supabase/
│   │   │   ├── client.ts         # Supabase client
│   │   │   ├── bills.ts          # Bill CRUD
│   │   │   ├── occurrences.ts    # Occurrence queries + mutations
│   │   │   ├── reminders.ts      # Reminder rule CRUD
│   │   │   ├── categories.ts     # Category queries + preset materialization
│   │   │   ├── profile.ts        # Profile + household queries
│   │   │   └── types.ts          # TypeScript types
│   │   ├── notifications.ts      # Local notification sync
│   │   ├── utils.ts              # Formatters, helpers
│   │   ├── errors.ts             # humanize() error pipeline
│   │   ├── action-guard.ts       # Per-action tap dedupe registry
│   │   ├── guarded-navigation.ts # expo-router patch (nav dedupe)
│   │   └── theme.ts              # Color tokens
│   ├── stores/                   # Zustand stores
│   │   ├── auth-store.ts
│   │   ├── household-store.ts
│   │   └── theme-store.ts
│   ├── schemas/                  # Zod validation
│   │   ├── bill.ts
│   │   ├── auth.ts
│   │   └── reminder.ts
│   └── supabase/                 # Backend
│       ├── functions/            # Edge functions (11)
│       └── migrations/           # SQL migrations (54)
├── website/                      # Landing page
│   ├── src/
│   │   ├── pages/                # Auth pages
│   │   ├── components/           # Landing sections
│   │   └── lib/
│   └── vercel.json
└── .obsidian/vault/              # This knowledge base
```

## Environment Variables

```bash
# Mobile app (.env)
EXPO_PUBLIC_SUPABASE_URL=https://dyhajmtfkjtwkijhptjx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=...

# Supabase Edge Functions
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
RESEND_API_KEY=...
CRON_SECRET=...
```

## Key Files Reference

| File | Purpose |
|------|---------|
| `app/lib/supabase/client.ts` | Supabase client with SecureStore |
| `app/lib/supabase/types.ts` | All TypeScript types |
| `app/stores/auth-store.ts` | Auth state (Zustand) |
| `app/hooks/useOccurrences.ts` | Dashboard + mutation hooks |
| `app/hooks/useBills.ts` | Bill CRUD hooks |
| `app/components/ui/Modal.tsx` | Animated bottom/center modal |
| `app/app/bill/[id].tsx` | Bill detail screen (931 lines) |
| `app/app/add-bill.tsx` | Create bill screen (1031 lines) |
