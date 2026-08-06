import { useCallback } from "react";
import { tryAcquireAction, releaseAction } from "@shared/utils/action-guard";

/**
 * Wraps any callback (sync or async) with a silent per-action dedupe guard.
 *
 * - The returned function no-ops (returns undefined) while the SAME action
 *   key is in flight or inside its cooldown window — the pressed element
 *   itself never shows a disabled state.
 * - Keys are per action identity: give it a stable string per logical
 *   action (e.g. `"toggle-alert:${occurrenceId}"`), NOT a component-local
 *   id — callers sharing the same key are deduped together (same action
 *   from different entry points).
 * - The lock is released when the returned promise settles (or immediately
 *   for sync callbacks), so it can never stick.
 *
 * @param key       action identity — unique per logical action
 * @param callback  the underlying action (async allowed)
 * @param cooldownMs optional override (default 600ms)
 */
export function useGuardedCallback<T extends (...args: any[]) => any>(
  key: string,
  callback: T,
  cooldownMs?: number
): T {
  return useCallback(((...args: any[]) => {
    if (!tryAcquireAction(key, cooldownMs)) return undefined;

    let result: any;
    try {
      result = callback(...args);
    } catch (e) {
      releaseAction(key);
      throw e;
    }

    if (result && typeof result.then === "function") {
      result.catch(() => {}).finally(() => releaseAction(key));
    } else {
      releaseAction(key);
    }
    return result;
  }) as T, [key, callback, cooldownMs]);
}
