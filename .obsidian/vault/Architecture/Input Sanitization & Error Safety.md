# Input Sanitization & Error Safety

> Two layers: (1) validated values are trimmed before they leave the form; (2) no raw
> Supabase message can reach the user — every displayed error passes `humanize()`.

## Layer 1 — Trim in Zod Schemas (`app/schemas/`)

Trimming lives in the **schema**, not in event handlers, so every form using
`zodResolver` gets it for free (add-bill, edit sheet, sign-in, sign-up, forgot-password,
mark-paid). Validation runs against the **trimmed** value — `"   "` fails `min(1)` →
"Title is required".

| Field | Schema | Rule |
|-------|--------|------|
| `title` | `schemas/bill.ts:58` | `.trim().min(1).max(120)` |
| `provider_name` | `schemas/bill.ts:63` | `.trim().max(80)` |
| `payment_notes` | `schemas/bill.ts` (markPaidSchema) | `.trim().max(1000)` |
| `email` | `schemas/auth.ts:4,9,19` (sign-in / sign-up / forgot) | `.trim().email(...)` |
| `displayName` | `schemas/auth.ts:12` | `.trim().min(1).max(50)` |

Settings / members screens trim at the call site (`name.trim()`, `email.trim()`) because
they don't use React Hook Form.

## Layer 2 — `humanize()` (`app/lib/errors.ts` — 179 lines)

```
extractMessage() → SAFE_MESSAGES lookup → pattern-match → context fallback
```

- **SAFE_MESSAGES** (39 entries): exact strings already user-safe, passed through verbatim.
- **Pattern matches**: network/internet/fetch → "Please check your internet connection…";
  OTP/token/expired → "Invalid code. Please try again."; session/jwt expiry → "Your session
  has expired…"; rate-limit → "Too many attempts…"; email-exists, wrong-credentials,
  email-not-confirmed, user-not-found, short-password, OAuth (cancelled / play-services /
  developer_error), RPC/function errors — each maps to a specific friendly string.
- **Context fallbacks** (9): `auth`, `network`, `session`, `permission`, `notFound`,
  `validation`, `server`, `unknown`.
- The original error is **always logged** — full object in dev, message-only in production.
- Wrappers: `authError()`, `networkError()`, `friendlyError()`.

### Raw-message leaks fixed (this pass)

| File | Before | After |
|------|--------|-------|
| `app/accept-invite.tsx:37` | `setErrorMsg(e.message ?? …)` | `friendlyError(e)` |
| `app/(tabs)/settings/members.tsx` (5×: invite, remove, rename, create, delete) | `Alert.alert("Error", e.message)` | `friendlyError(e)` |
| `app/(tabs)/settings/index.tsx` (create household) | `Alert.alert("Error", e.message)` | `friendlyError(e)` |

All remaining `e.message` reads are in `console.warn`/logs, or the pre-mapped OTP check in
`sign-in-otp.tsx:113` (which falls back to `humanize()`).

## Related
- [[Architecture/Key Patterns]] — Error Handling Pattern
- [[Architecture/Interaction Guarding]]
- [[Daily Notes/Day 2 - UI Hardening Pass]]
