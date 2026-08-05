# Lib

> Every module in `app/lib/` — Supabase data layer, error safety, theme, utils, notifications.

## Supabase (`app/lib/supabase/`)

| Module | Exports | Notes |
|--------|---------|-------|
| `client.ts` | `supabase`, `redirectUri` (bill-reminder://callback), `webRedirectUri` (website /auth/callback) | SecureStore adapter; `flowType: "implicit"` — PKCE breaks web email-verification links, see code comment |
| `bills.ts` | `fetchBills`, `fetchBillById`, `createBill`, `updateBill`, `deleteBill` | `createBill` sends `next_due_date` (054 override) |
| `occurrences.ts` | `fetchDashboardData`, `fetchBillOccurrences`, `fetchCurrentOccurrence`, `markOccurrencePaid`, `deleteOccurrenceTransaction` | mark-paid + delete call SECURITY DEFINER RPCs |
| `reminders.ts` | `fetchSyncData`, `fetchReminderRules`, `createReminderRule`, `updateReminderRule`, `deleteReminderRule`, `toggleReminderRule`, `defaultReminderRules` | `defaultReminderRules(billId)` creates the 3 defaults (due date, generation, expected payment) |
| `profile.ts` | `fetchProfile`, `updateProfile`, `fetchAllUserHouseholds`, `fetchUserHousehold`, `fetchHouseholdMembers`, `createHousehold`, `inviteToHousehold`, `removeMember`, `renameHousehold`, `deleteHousehold`, `acceptInvite`, `savePushToken` | |
| `categories.ts` | `fetchCategoryPresets`, `fetchHouseholdCategories`, `createCategory`, `ensureHouseholdCategoryFromPreset` | preset→household category materialization in add-bill |

## Error Safety (`app/lib/errors.ts` — 179 lines)

- `humanize(error, context)` — the only thing that may reach the user. SAFE_MESSAGES set + pattern matching + 9 context fallbacks; always logs.
- `authError()` / `networkError()` / `friendlyError()` — contextual wrappers.
- Full spec: [[Architecture/Input Sanitization & Error Safety]]

## Theme (`app/lib/theme.ts` — 275 lines)

- `Colors` — neutral scale (50–950), accent (desaturated indigo `#5B5BD6`), state colors (amber/emerald/sky/red).
- `SemanticColors.light` / `.dark` — surfaces, text, accent, state tokens. **Dark accent is gold `#D1A920`, accentText is dark** — inverted on accent fills (see CategoryIconBadge).
- `Spacing` (4 px base, `touchMin: 44`), `BorderRadius` (input 8 / card 12 / sheet 16 / pill 999), `FontSize`/`LineHeight`/`FontWeight`, `Shadow` (resting / raised / fab), `Motion` (150–200 ms ease-out only), `IconSize`, `ZIndex`.

## Utils (`app/lib/utils.ts` — 133 lines)

- `formatCurrency`, `formatDate`, `formatDateShort`, `formatRelativeDate`, `daysUntil`, `formatOverdueLabel`, `formatRepeatKind`, `formatBehaviorType`
- `LUCIDE_TO_IONICONS` map + `resolveIcon(lucideKey)` — DB stores Lucide keys; UI renders Ionicons.

## Notifications (`app/lib/notifications.ts` — 312 lines)

- **Lazy-imported everywhere** — never on the cold-start path (see [[Architecture/Startup & Performance]]).
- `setupNotificationListeners()` — channels + push registration (2 s defer) + tap-to-bill navigation.
- `syncLocalReminders()` — serialized queue over `doSyncLocalReminders`; reconciles scheduled
  notifications against `fetchSyncData`. **Push-token aware (dedupe fix, Day 3 §5):** if the user
  has a `push_tokens` row, local scheduling is skipped and the diff cancels existing local
  notifications — the server pipeline (materializer → dispatcher → push-sender) owns push. No
  token → local fallback schedules. One actionable occurrence per bill (urgency-ranked).
- `scheduleReminder`/`cancelReminder`/`cancelAllReminders` — 9:00 AM local trigger + offset_days.

## Auth (`app/lib/auth/google.ts`)

- `signInWithGoogle()` → `GoogleSignInResult`; `signOutGoogle()`.

## Schemas (`app/schemas/`) — Zod, single source of truth

- `bill.ts` (332 lines) — `createBillSchema`, `updateBillSchema` (partial), `markPaidSchema`; exports `DUE_DATE_YEAR_MIN`/`MAX` (current year → +9); one-time `anchor_year` capped at max; trim on title/provider_name/payment_notes.
- `auth.ts` (33 lines) — sign-in / sign-up / forgot-password / reset-password; trim on email + displayName.
- `reminder.ts` (42 lines) — `reminderRuleSchema` (offset −30…+7 d, repeat 6–168 h, cap ≤ 8), `emailPreferenceSchema`.

## Related
- [[Hooks/All]]
- [[Architecture/UI Components]]
- [[Database/Schema Overview]]
