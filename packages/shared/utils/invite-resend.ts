// ── Invite resend policy (kept in sync with supabase/functions/invite-member) ──
export const RESEND_COOLDOWN_MS = 2 * 60 * 1000; // between sends
export const INVITE_MAX_SENDS   = 4;             // initial invite + 3 resends
export const INVITE_LOCKOUT_MS   = 60 * 60 * 1000; // 1h after max sends

export type InviteResendState =
  | { stage: "ready" }
  | { stage: "cooldown"; remainingMs: number }
  | { stage: "lockout"; remainingMs: number };

export function getInviteResendState(
  inviteCount: number,
  lastSentAt: string | null | undefined,
  now = Date.now()
): InviteResendState {
  const lastSent = lastSentAt ? new Date(lastSentAt).getTime() : now;
  const since = Math.max(0, now - lastSent);

  if (inviteCount >= INVITE_MAX_SENDS) {
    if (since < INVITE_LOCKOUT_MS) {
      return { stage: "lockout", remainingMs: INVITE_LOCKOUT_MS - since };
    }
    return { stage: "ready" };
  }

  if (since < RESEND_COOLDOWN_MS) {
    return { stage: "cooldown", remainingMs: RESEND_COOLDOWN_MS - since };
  }

  return { stage: "ready" };
}

/** "1m 02s" style countdown from a millisecond remaining. */
export function formatWaitMs(ms: number): string {
  const total = Math.max(1, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  if (m <= 0) return `${s}s`;
  return `${m}m ${s.toString().padStart(2, "0")}s`;
}