import type { Location } from "react-router-dom";

/** sessionStorage key for the destination to return to after signing in. */
const STORAGE_KEY = "br_pending_after_auth";

/**
 * Save where the user was headed so they land back there after auth.
 * Used by the deep-link flow (/bill/:id) and the /app/* guard redirect.
 */
export function savePendingPath(location: Pick<Location, "pathname" | "search">): void {
  const target = location.pathname + location.search;
  if (!target || target === "/") return;
  try {
    const existing = sessionStorage.getItem(STORAGE_KEY);
    sessionStorage.setItem(STORAGE_KEY, target);
    void existing;
  } catch {
    // storage unavailable (private mode / blocked) — degrade to default redirect
  }
}

/** Read + clear the saved destination after a successful sign-in. */
export function takePendingPath(): string | null {
  try {
    const target = sessionStorage.getItem(STORAGE_KEY);
    if (target) sessionStorage.removeItem(STORAGE_KEY);
    return target;
  } catch {
    return null;
  }
}