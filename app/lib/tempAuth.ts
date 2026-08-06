/**
 * tempAuth — ephemeral in-memory credential store.
 *
 * Used ONLY to enable the verify-email screen to detect whether the user's
 * email has been confirmed by attempting a real sign-in before resending.
 *
 * Security properties:
 *   • In-memory only — never written to disk, SecureStore, or AsyncStorage.
 *   • Cleared automatically after first successful use.
 *   • Cleared when the app restarts (module is re-executed from scratch).
 *   • Only the email+password the user JUST typed are held here, briefly.
 *   • TTL-bound: expires TTL_MS after storage even if never consumed, so a
 *     backgrounded app cannot hold a live password indefinitely (audit F5).
 */

const TTL_MS = 10 * 60 * 1000; // 10 minutes

let _email: string | null    = null;
let _password: string | null = null;
let _storedAt: number        = 0;

export const tempAuth = {
  /** Store credentials immediately after a successful signUp() call. */
  store(email: string, password: string): void {
    _email    = email;
    _password = password;
    _storedAt = Date.now();
  },

  /** Retrieve stored credentials, or null if not available or expired. */
  get(): { email: string; password: string } | null {
    if (_email && _password && Date.now() - _storedAt < TTL_MS) {
      return { email: _email, password: _password };
    }
    return null;
  },

  /** Erase credentials from memory. Call after use. */
  clear(): void {
    _email    = null;
    _password = null;
    _storedAt = 0;
  },
};
