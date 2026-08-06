/**
 * Pending-route destination preservation (mobile).
 *
 * When a signed-out user opens a deep link (e.g. a bill from an email/push),
 * we remember where they were headed and restore it after sign-in.
 *
 * In-memory on purpose: the mobile auth flows (password, OTP, Google OAuth)
 * all return to the SAME JS runtime, so nothing needs to survive a process
 * restart. The app is never killed to complete sign-in.
 */

let pendingRoute: string | null = null;

export function savePendingRoute(route: string | null): void {
  pendingRoute = route;
}

/** Read + clear the saved destination after a successful sign-in. */
export function takePendingRoute(): string | null {
  const route = pendingRoute;
  pendingRoute = null;
  return route;
}
