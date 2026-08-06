// Shared site URL config for Edge Functions.
// ONE canonical origin for every public link this project emits.
// Do not hardcode the domain anywhere else — import from here.

export const SITE_URL = "https://billreminder.suryadeepbanerjee.in";

/** Canonical deep link to a bill (web: BillDetailPage, mobile: universal/app link). */
export function billUrl(billId: string): string {
  return `${SITE_URL}/bill/${encodeURIComponent(billId)}`;
}

/** Canonical link to a household invite (accept-invite page).
 * `inviteCode` is the household_members.id — a UUIDv4 one-time token
 * that lets the recipient accept without signing in first. */
export function inviteUrl(householdId: string, inviteCode: string): string {
  return `${SITE_URL}/accept-invite?code=${encodeURIComponent(inviteCode)}&hid=${encodeURIComponent(householdId)}`;
}
