import { useCallback, useRef } from "react";

/**
 * Guards a control against rapid repeat presses ("impatient" double-taps).
 *
 * Returns `true` when a press is allowed, `false` when it lands within
 * `intervalMs` of the previously accepted press. The timestamp lives in a
 * ref, so the guard survives re-renders and causes none itself.
 *
 * UX rules:
 *  - Per-control instance: tapping a DIFFERENT control (e.g. another
 *    category) is never blocked — only the same control's repeats are.
 *  - Interval is short (300ms default) — a deliberate second tap is far
 *    slower than this, so nothing is ever eaten.
 */
export function useTapGuard(intervalMs = 300): () => boolean {
  const lastAcceptedAt = useRef(0);

  return useCallback(() => {
    const now = Date.now();
    if (now - lastAcceptedAt.current < intervalMs) return false;
    lastAcceptedAt.current = now;
    return true;
  }, [intervalMs]);
}
