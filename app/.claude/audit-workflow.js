export const meta = {
  name: 'bill-reminder-audit',
  description: 'Exhaustive production-readiness audit of the Bill Reminder Expo SDK 54 / Supabase app',
  phases: [
    { title: 'Domain Audits', detail: '14 parallel subsystem auditors read real code and return structured findings' },
    { title: 'Blocker Verification', detail: 'Adversarially verify the 5 flagged blockers against the code' },
  ],
}

const ROOT = 'D:\\WebApp\\Bill Reminder\\app'

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    area: { type: 'string' },
    summary: { type: 'string', description: '2-4 sentence overview of the subsystem health' },
    findings: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          title: { type: 'string' },
          severity: { type: 'string', enum: ['Critical', 'High', 'Medium', 'Low'] },
          rootCause: { type: 'string', description: 'The underlying cause, not the symptom' },
          files: { type: 'array', items: { type: 'string' }, description: 'Exact file paths + line refs' },
          why: { type: 'string', description: 'Why it happens / the mechanism' },
          risks: { type: 'string' },
          approach: { type: 'string', description: 'Recommended fix approach in prose, NO code' },
          confidence: { type: 'string', enum: ['High', 'Medium', 'Low'] },
        },
        required: ['title', 'severity', 'rootCause', 'files', 'why', 'risks', 'approach', 'confidence'],
      },
    },
  },
  required: ['area', 'summary', 'findings'],
}

const RULES = [
  'You are a ruthless senior engineer performing a production-readiness audit of a React Native / Expo SDK 54 + expo-router + NativeWind 4 + Supabase mobile app called "Bill Reminder".',
  `Project root: ${ROOT}. All paths below are relative to it.`,
  'HARD RULES:',
  '1. AUDIT ONLY. Do NOT modify any file. Do NOT write patches or code. Recommended fixes go in the "approach" field as PROSE ONLY.',
  '2. Never trust comments, TODOs, doc files, or claims like "Fixed" — read the ACTUAL code and verify behavior yourself. A comment saying something works is NOT evidence.',
  '3. For every issue, trace the dependency chain to the true ROOT CAUSE, not the surface symptom. Follow imports, props, hooks, query keys, RLS policies, RPC names, and env wiring until you reach the real cause.',
  '4. Read the real files before making any claim. Use Read/Grep/Glob. If a file is referenced, open it. Do not assume.',
  '5. Be exhaustive within your area. Report every real defect. Do not stop at the first.',
  '6. Assign accurate severity (Critical = broken/blocks release or data loss/security; High = major UX/correctness; Medium; Low = polish). Set confidence honestly (High only when you read the code and are certain).',
  '7. Treat files that may hold secrets (.env, keys, tokens) cautiously — reference by key name, never echo secret values.',
  'Return your result via the structured output schema only.',
].join('\n')

phase('Domain Audits')

const auditors = [
  {
    area: 'Theme System & Dark Mode',
    hint: 'Files: global.css, tailwind.config.js, tailwind.theme.js, lib/theme.ts, stores/theme-store.ts, app/_layout.tsx, app/(tabs)/_layout.tsx, and grep the whole app/ + components/ tree for hardcoded hex colors, inline style colors, and dark:/className usage. VERIFY: (a) is NativeWind dark mode actually enabled/strategized correctly given tailwind.config.js has no darkMode key and the app drives .dark via setColorScheme? (b) does the settings screen actually re-theme? (c) two competing color systems (lib/theme.ts indigo SemanticColors vs global.css gold CSS vars) — which is live, which is dead? (d) every hardcoded color that will not adapt (e.g. settings person-circle #737373). (e) is there a system/Appearance-following mode, and should there be? (f) does setColorScheme from nativewind actually flip the .dark class at runtime, and is StatusBar correct?',
  },
  {
    area: 'Icon Visibility (Ionicons color)',
    hint: 'Grep every <Ionicons .../> and other @expo/vector-icons usage across app/ and components/. VERIFY whether passing className (e.g. className="text-secondary") sets the vector-icon glyph color under NativeWind, or whether the color prop is required. Determine which icons render invisible or low-contrast in dark and light mode (category selector, repeat-preference selector, settings rows, tab bar). Trace to root cause: is className color supported by react-native-css-interop for @expo/vector-icons Ionicons, or ignored?',
  },
  {
    area: 'Dashboard — No Bills Showing',
    hint: 'Files: app/(tabs)/dashboard/index.tsx, hooks/useBills.ts, hooks/useOccurrences.ts, lib/supabase/* (bills/occurrences queries), schemas/bill.ts, app/add-bill.tsx (how a bill is created), and the relevant migrations for bills/occurrences/RLS. VERIFY the full create->read chain: does add-bill insert into the same table/columns the dashboard reads? Do query keys match between create invalidation and the list query? Does RLS allow the just-created row to be selected by the same user/household? Does the dashboard read occurrences that are only generated by a server function/trigger that may not have run? Find why a freshly created bill does not appear.',
  },
  {
    area: 'Delete Account',
    hint: 'Files: app/(tabs)/settings/index.tsx handleDeleteAccount (calls supabase.rpc("delete_user_account")), supabase/migrations/017_delete_account_rpc.sql and any other migration defining account deletion, lib/auth/google.ts. VERIFY the RPC name in code EXACTLY matches the function name created in SQL, that EXECUTE is granted to the authenticated role, that SECURITY DEFINER/search_path are correct, that it actually deletes the auth user (not just app rows), and that the UI resets navigation/session after success. Find why the button does nothing.',
  },
  {
    area: 'Email Notifications (does mail actually send on the right day?)',
    hint: 'Files: supabase/functions/email-sender/index.ts and its templates/, plus any occurrence-generator / reminder-materializer / reminder-dispatcher functions, supabase/config.toml (cron/schedules), lib/supabase/reminders.ts, hooks/useReminders.ts, migrations 015/018/019, and the profiles email_notifications_enabled flag + useUpdateProfile. VERIFY end to end: is there a scheduled trigger that invokes the dispatcher daily? Does it select reminders due on the correct local day (timezone handling)? Does it honor email_notifications_enabled? Is Resend actually configured (API key env, from-domain)? Is the settings email toggle wired to anything that changes send behavior? Determine whether an email would ACTUALLY be sent on the due day or never.',
  },
  {
    area: 'Local Notifications (expo-notifications)',
    hint: 'Files: lib/notifications.ts (syncLocalReminders, setupNotificationListeners), app/_layout.tsx, hooks/useReminders.ts, hooks/useOccurrences.ts, settings PushNotificationsToggle. VERIFY scheduling correctness: are triggers computed in the future with correct timezone/DST, cancelled/rescheduled on bill edit/delete/paid, deduplicated, and re-synced on session restore/reboot? Check permission flow, Android channel setup, race conditions between auth listener firing sync twice, and missing cleanup.',
  },
  {
    area: 'Authentication & Session',
    hint: 'Files: app/(auth)/_layout.tsx, all app/(auth)/*.tsx (sign-in, sign-up, forgot/reset, update-password), app/callback.tsx, lib/auth/google.ts, lib/supabase/client.ts, stores/auth-store.ts, app/_layout.tsx. VERIFY Google sign-in, email signup/login, email verification deep link (bill-reminder://callback), password reset + update-password screen, session restore via getSession, onAuthStateChange handling, token refresh persistence, sign-out clearing state, and route guarding (can an unauthenticated user reach tabs, or an authed user get stuck on auth?).',
  },
  {
    area: 'Keyboard UX on Auth & Forms',
    hint: 'Files: app/(auth)/*.tsx sign-in/sign-up, components/ui/AuthFormContainer.tsx, components/ui/ScreenContainer.tsx, components/ui/TextInput.tsx, add-bill.tsx, settings EditNameModal, components/ui/Modal.tsx. VERIFY whether inputs stay visible above the keyboard: is KeyboardAvoidingView/KeyboardAwareScrollView used with correct behavior per-platform (iOS padding vs Android), correct keyboardVerticalOffset, ScrollView with keyboardShouldPersistTaps, and safe-area insets? Root-cause why sign-in/sign-up inputs are hidden behind the keyboard.',
  },
  {
    area: 'Database, RLS, Migrations, RPC',
    hint: 'Files: every file under supabase/migrations/ (001 through 019) and lib/supabase/types.ts. VERIFY schema integrity: tables/columns match what the app reads/writes, foreign keys + ON DELETE behavior, indexes on hot query columns (016), RLS policies on every user table (household scoping), RPC/trigger correctness (claim_pending_reminders 015, generate_occurrences 018, backfill/grants 019, delete_account 017), CHECK constraints, duplicate-occurrence prevention, and whether migrations are internally consistent/ordered. Flag any policy that blocks legitimate reads/writes.',
  },
  {
    area: 'Settings Screen',
    hint: 'File: app/(tabs)/settings/index.tsx end to end. VERIFY every row works: ThemeSelector, EmailNotificationsToggle, PushNotificationsToggle, Export, delete/sign-out, links. Check hardcoded colors, className-on-Ionicons, missing system theme option, EmailNotificationsToggle being cosmetic vs functional, missing loading/empty/error states, and accessibility of the pressables.',
  },
  {
    area: 'UI Consistency & Components',
    hint: 'Files: all components/ui/* (Surface, ListItem, Button, TextInput, Modal, AlertBadge, AuthFormContainer, ScreenContainer, and any others). VERIFY consistent use of tokens vs ad-hoc values, dark-mode support in each component, contrast, spacing scale adherence, duplicated component logic, and whether SemanticColors from lib/theme.ts is imported anywhere or is dead code.',
  },
  {
    area: 'Accessibility (WCAG)',
    hint: 'Sweep all screens + components/ui/*. VERIFY touch target sizes (>=44px), color contrast in BOTH themes (text-secondary on surface, gold accent on dark, placeholder text), accessibilityRole/Label/State coverage on Pressables and icons, focus order, dynamic type / font scaling, and screen-reader labeling of icon-only controls. Note: full WCAG validation needs manual AT testing — flag that where relevant.',
  },
  {
    area: 'Navigation & Routing',
    hint: 'Files: app/_layout.tsx, app/(auth)/_layout.tsx, app/(tabs)/_layout.tsx, app/callback.tsx, app/+not-found (if present), and how redirects/guards are implemented. VERIFY the auth<->tabs redirect logic, deep-link handling, modal presentation for add-bill, back behavior after delete/sign-out, tab bar theming, and any race between session load and initial route.',
  },
  {
    area: 'Code Quality & React/Query Correctness',
    hint: 'Sweep hooks/* , stores/*, app/*, components/*. VERIFY React Query usage (query keys, invalidation, staleTime, retry 0 impact, enabled guards), useEffect dependency arrays and cleanup, memory leaks (listeners/subscriptions), unnecessary re-renders, dead/duplicate code, unused hooks (useHousehold?)/providers, dynamic import("expo-notifications") patterns, and error handling. Report concrete instances with file+line.',
  },
]

log(`Launching ${auditors.length} domain auditors in parallel...`)

const domainResults = await parallel(
  auditors.map((a) => () =>
    agent(`${RULES}\n\n=== YOUR AUDIT AREA: ${a.area} ===\n${a.hint}`, {
      label: a.area,
      phase: 'Domain Audits',
      schema: SCHEMA,
      effort: 'high',
    })
  )
)

const clean = domainResults.filter(Boolean)
log(`Domain audits complete: ${clean.length}/${auditors.length} returned.`)

// ── Phase 2: adversarial verification of the 5 user-flagged blockers ──────────
phase('Blocker Verification')

const VERIFY_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    blocker: { type: 'string' },
    verdict: { type: 'string', enum: ['CONFIRMED broken', 'PARTIALLY broken', 'NOT broken / works', 'CANNOT determine'] },
    rootCause: { type: 'string' },
    evidence: { type: 'string', description: 'Exact file+line evidence you personally read that proves the verdict' },
    files: { type: 'array', items: { type: 'string' } },
    approach: { type: 'string', description: 'Prose fix approach, NO code' },
    confidence: { type: 'string', enum: ['High', 'Medium', 'Low'] },
  },
  required: ['blocker', 'verdict', 'rootCause', 'evidence', 'files', 'approach', 'confidence'],
}

const VERIFY_RULE = RULES + '\nYou are the adversarial verifier. A prior auditor may have made a claim. Do NOT trust it. Independently read the actual code and prove the verdict with concrete file+line evidence. If the user reports it is broken but the code works, say so and explain what the user actually experiences. Your job is ground truth.'

const blockers = [
  'DARK MODE: The settings page (and other screens) reportedly stays LIGHT in dark mode and some text/icons are barely visible. Determine the exact runtime reason the .dark class either does or does not apply, and why colors do not adapt. Read tailwind.config.js, global.css, app/_layout.tsx setColorScheme wiring, and the settings screen classes.',
  'DASHBOARD EMPTY: A bill created via add-bill does NOT appear on the dashboard/home. Trace the exact create->persist->read chain (insert target, query keys, invalidation, RLS, occurrence generation) and prove where the chain breaks.',
  'DELETE ACCOUNT: The Delete Account button "does not work". Prove whether supabase.rpc("delete_user_account") matches a real, granted SQL function and whether the UI handles success. Read migration 017 and settings handleDeleteAccount.',
  'EMAIL ON DUE DAY: Verify whether a reminder email would ACTUALLY be sent to the user on the correct day. Prove there is (or is not) a scheduled dispatcher, correct date/timezone selection, the enabled-flag honored, and Resend configured. Read the edge functions, config.toml, and reminders SQL.',
  'KEYBOARD: On sign-in and sign-up, input boxes are hidden behind the keyboard. Prove whether keyboard avoidance is implemented correctly on both iOS and Android in the auth screens/containers, and root-cause why inputs are covered.',
]

const verifyResults = await parallel(
  blockers.map((b, i) => () =>
    agent(`${VERIFY_RULE}\n\n=== BLOCKER TO VERIFY #${i + 1} ===\n${b}`, {
      label: b.split(':')[0],
      phase: 'Blocker Verification',
      schema: VERIFY_SCHEMA,
      effort: 'high',
    })
  )
)

const verifiedClean = verifyResults.filter(Boolean)
log(`Blocker verification complete: ${verifiedClean.length}/${blockers.length} returned.`)

return { domains: clean, blockers: verifiedClean }
