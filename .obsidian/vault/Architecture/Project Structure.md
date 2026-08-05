# Project Structure

```
Bill Reminder/
├── app/                              # Mobile app root
│   ├── app/                          # Expo Router screens (file-based routing)
│   │   ├── _layout.tsx               # Root layout (providers, splash, guard patch)
│   │   ├── index.tsx                 # Post-auth redirect
│   │   ├── callback.tsx              # Auth callback (implicit flow)
│   │   ├── accept-invite.tsx         # Invite landing
│   │   ├── +not-found.tsx            # 404
│   │   ├── (auth)/                   # Unauthenticated group
│   │   │   ├── _layout.tsx           # Auth stack
│   │   │   ├── sign-in.tsx / sign-in-otp.tsx / sign-up.tsx
│   │   │   ├── forgot-password.tsx / update-password.tsx
│   │   │   └── verify-email.tsx
│   │   ├── (tabs)/                   # Authenticated tab group
│   │   │   ├── _layout.tsx           # Tab navigator (dashboard, bills, add, settings)
│   │   │   ├── dashboard/index.tsx   # Dashboard (home) — 468 lines
│   │   │   ├── bills/index.tsx       # Bills list + search + filters — 233 lines
│   │   │   ├── add/                  # Add tab (redirect → add-bill)
│   │   │   └── settings/             # index (429+), profile.tsx (390+), members.tsx
│   │   ├── bill/[id].tsx             # Bill detail + edit sheet — 931 lines
│   │   │                            #   - Bill info card (icon, title, amount, state)
│   │   │                            #   - Details section (type, frequency)
│   │   │                            #   - Reminder rules with toggles
│   │   │                            #   - Payment history with delete buttons
│   │   │                            #   - MarkPaidModal + DeleteTransactionModal + edit sheet
│   │   └── add-bill.tsx              # Create bill — 1031 lines, 3-step wizard
│   │                                #   - Step 1: Category selection
│   │                                #   - Step 2: Bill details (name, amount, type)
│   │                                #   - Step 3: Recurrence + anchor date + RecurrencePreview
│   ├── components/
│   │   ├── bills/                    # Bill-specific components
│   │   │   ├── BillCard.tsx          # Dashboard bill card (memoized)
│   │   │   ├── BillStateChip.tsx     # State badge (7 variants)
│   │   │   ├── CategoryPill.tsx      # Category icon badge
│   │   │   ├── DeleteTransactionModal.tsx  # Safe delete UI
│   │   │   ├── MarkPaidModal.tsx     # Mark paid form
│   │   │   └── RecurrencePreview.tsx # Live recurrence preview (tappable rows)
│   │   └── ui/                       # Shared primitives (30 files)
│   │       ├── AlertBadge.tsx        # Error/success/warning banners
│   │       ├── AuthFormContainer.tsx # Auth screen shell
│   │       ├── Badge.tsx / Chip.tsx  # Small pills
│   │       ├── Button.tsx            # 5 variants × 3 sizes (+ guardKey)
│   │       ├── Card.tsx / Surface.tsx / Screen.tsx / ScreenContainer.tsx
│   │       ├── DateAnchorPicker.tsx  # Month+Day+Year picker composite
│   │       ├── DayPicker.tsx         # Day grid (44px cells, percentage basis)
│   │       ├── Divider.tsx / SectionHeader.tsx
│   │       ├── EmptyState.tsx        # Empty list state
│   │       ├── ErrorView.tsx         # Error state
│   │       ├── FAB.tsx               # Floating action button
│   │       ├── Header.tsx / ListItem.tsx
│   │       ├── IconButton.tsx        # Icon-only button (4 variants)
│   │       ├── LoadingSkeleton.tsx   # Placeholder loader
│   │       ├── Modal.tsx             # Animated bottom/center sheet
│   │       ├── MonthPicker.tsx       # Month grid (3×4)
│   │       ├── NumericInput.tsx / TextInput.tsx / PasswordField.tsx / SearchField.tsx
│   │       ├── SelectPicker.tsx      # Modal-based select
│   │       ├── Switch.tsx            # Toggle
│   │       ├── Toast.tsx             # Animated notification
│   │       └── YearPicker.tsx        # Year grid (2020–2027 default)
│   ├── hooks/                        # React Query hooks
│   │   ├── useBills.ts               # useBills, useBill, useCreateBill, useUpdateBill, useDeleteBill
│   │   ├── useOccurrences.ts         # useDashboard, useBillOccurrences, useMarkPaid, useDeleteTransaction
│   │   ├── useReminders.ts           # useReminderRules, useCreate/Update/Delete/ToggleReminderRule
│   │   ├── useHousehold.ts           # useHousehold (React Query + Zustand)
│   │   ├── useProfile.ts             # useProfile, useUpdateProfile
│   │   ├── useCategories.ts          # useCategoryPresets, useHouseholdCategories
│   │   ├── useRecurrencePreview.ts   # useRecurrencePreview (calls RPC)
│   │   ├── useTapGuard.ts            # per-control double-tap guard
│   │   ├── useGuardedCallback.ts     # guarded async callback wrapper
│   │   └── useToast.ts               # toast state
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts:13          # createClient + SecureStore adapter + redirect URIs
│   │   │   ├── types.ts:1            # All TS types (Profile, Household, Bill, BillOccurrence, etc.)
│   │   │   ├── bills.ts:12           # CRUD: fetchBills, fetchBillById, createBill, updateBill, deleteBill
│   │   │   ├── occurrences.ts:37     # fetchDashboardData, fetchBillOccurrences, markOccurrencePaid, deleteOccurrenceTransaction
│   │   │   ├── reminders.ts:10       # CRUD: fetchReminderRules, create/update/delete/toggle, defaultReminderRules
│   │   │   ├── categories.ts:4       # fetchCategoryPresets, fetchHouseholdCategories, createCategory
│   │   │   └── profile.ts:5          # profile, households, members, invite, push token
│   │   ├── errors.ts:61              # humanize() — the ONLY thing allowed to reach the user
│   │   ├── notifications.ts:150      # syncLocalReminders (push-token-aware, lazy-imported)
│   │   ├── action-guard.ts           # per-action tap dedupe registry
│   │   ├── guarded-navigation.ts     # expo-router routingQueue patch
│   │   ├── utils.ts:8                # formatCurrency, formatRelativeDate, formatOverdueLabel, date helpers
│   │   └── theme.ts:12               # Colors, SemanticColors, tokens
│   ├── stores/
│   │   ├── auth-store.ts:16          # Zustand: user, session, isLoading, isEmailVerified
│   │   ├── household-store.ts:23     # Zustand: households, activeHousehold, loadActive
│   │   └── theme-store.ts:15         # Zustand: theme mode (SecureStore)
│   ├── schemas/
│   │   ├── bill.ts:53                # createBillSchema, updateBillSchema, markPaidSchema, DUE_DATE_YEAR_MIN/MAX
│   │   ├── auth.ts:3                 # sign-in/sign-up/forgot/reset schemas
│   │   └── reminder.ts               # reminderRuleSchema, emailPreferenceSchema
│   └── supabase/
│       ├── migrations/               # 54 SQL files (001–054, all deployed)
│       └── functions/                # 11 edge functions
├── website/                          # Landing page (React + Vite)
│   ├── src/
│   │   ├── pages/                    # Auth pages (SignIn, SignUp, Reset, Callback)
│   │   ├── components/               # Landing sections (Hero, Features, Pricing, FAQ)
│   │   └── lib/                      # Supabase client for web
│   └── vercel.json                   # Deploy config
├── AGENTS.md                         # AI assistant context
└── .obsidian/vault/                  # This knowledge base
```

## File Sizes (Notable)

| File | Lines | Why So Big |
|------|-------|-----------|
| `app/app/add-bill.tsx` | 1031 | 3-step wizard with DateAnchorPicker, recurrence preview, form validation |
| `app/app/bill/[id].tsx` | 931 | Bill info + details + reminders + payment history + modals + edit sheet |
| `app/supabase/functions/email-sender/templates/notification.ts` | 473 | Full HTML email template with MSO conditionals |
| `app/supabase/migrations/039_unify_due_date_engine.sql` | 318 | Complex due date calculation engine |
| `app/supabase/migrations/034_fix_recurrence_anchor_date.sql` | 334 | Anchor-date snap logic |
