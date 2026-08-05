/**
 * Action Guard — silent, per-action duplicate-tap dedupe.
 *
 * A module-level registry keyed by an ACTION IDENTITY string. The guard:
 *  - blocks a re-fire while the action is still in flight (async), and
 *  - blocks a re-fire within `cooldownMs` (default 600ms) of the last fire.
 *
 * UX rules:
 *  - SILENT: nothing is visually disabled, no opacity/loading change — the
 *    pressed element still shows its normal press feedback. Only the
 *    underlying action is deduped.
 *  - PER-ACTION, not global: key = action identity (destination href for
 *    navigation, operation + id for mutations). Tapping A then B in quick
 *    succession never blocks B; two different rows/CTAs that lead to the
 *    SAME action share a key and are deduped.
 *  - SELF-HEALING: in-flight entries hard-expire after MAX_INFLIGHT_MS and
 *    cooldown timestamps age out, so a guard can never get "stuck".
 *
 * Consumption points (all central, no per-button debounce logic):
 *  - `lib/guarded-navigation.ts` — patches the expo-router singleton.
 *  - `lib/supabase/*.ts` mutations — wrapped via `guardAsync`.
 *  - `hooks/useGuardedCallback.ts` + `guardKey` on shared Button/IconButton.
 *  - Root layout releases in-flight flags on every route change (screen
 *    blur), so state never leaks across navigations.
 */

const DEFAULT_COOLDOWN_MS = 600;
const MAX_INFLIGHT_MS     = 10_000;

interface Entry {
  inflight:   boolean;
  lastFired:  number;
  /** In-flight call promise — later calls with the same key JOIN it. */
  promise?:   Promise<unknown>;
}

const registry = new Map<string, Entry>();

/**
 * Try to acquire the action identified by `key`.
 * Returns true (and marks it in flight) if it's not currently running and
 * not inside its cooldown window — otherwise false.
 */
export function tryAcquireAction(
  key: string,
  cooldownMs: number = DEFAULT_COOLDOWN_MS
): boolean {
  const now = Date.now();
  const entry = registry.get(key);

  if (entry) {
    if (entry.inflight) {
      if (now - entry.lastFired < MAX_INFLIGHT_MS) return false;
    } else if (now - entry.lastFired < cooldownMs) {
      return false;
    }
  }

  registry.set(key, { inflight: true, lastFired: now });
  return true;
}

/** Mark the action as finished; the cooldown window continues from here. */
export function releaseAction(key: string): void {
  const entry = registry.get(key);
  if (entry) {
    entry.inflight = false;
    entry.lastFired = Date.now();
  }
}

/** Release every in-flight flag (called on route change — screen blur). */
export function releaseAllActions(): void {
  for (const entry of registry.values()) {
    entry.inflight = false;
    entry.promise = undefined;
  }
}

/**
 * Run `fn` guarded, keyed by action identity.
 *
 * - While `key` is IN FLIGHT: a repeat call joins the first call's promise
 *   and resolves with the same result — callers that read the return value
 *   (e.g. add-bill's `const bill = await createBill(...)`) stay safe.
 * - Within the cooldown window after completion: resolves `undefined`
 *   (silent no-op — the first call's result is the one that counts).
 * - The key stays locked until the promise settles.
 *
 * `fn`'s callers generally declare non-optional return types; the blocked
 * path only produces `undefined` inside the cooldown window, so chokepoint
 * wrappers cast the result to their declared type (contained at one place
 * per function).
 */
export async function guardAsync<T>(
  key: string,
  fn: () => Promise<T>,
  cooldownMs?: number
): Promise<T | undefined> {
  const existing = registry.get(key);
  if (existing?.inflight && existing.promise) {
    return existing.promise as Promise<T>;
  }
  if (!tryAcquireAction(key, cooldownMs)) return undefined;

  const promise = (async () => {
    try {
      return await fn();
    } finally {
      releaseAction(key);
    }
  })();
  const entry = registry.get(key);
  if (entry) entry.promise = promise;
  return promise;
}
