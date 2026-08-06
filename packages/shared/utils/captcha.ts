/**
 * CAPTCHA (hCaptcha / Cloudflare Turnstile) support for Supabase Auth.
 *
 * Supabase validates a captcha token on these endpoints:
 *   /signup, /otp, /verify, /recover, /resend, /token?grant_type=password
 * It is NOT required for OAuth (Google), PKCE exchange, session refresh, or
 * updateUser — so those flows are left untouched.
 *
 * This module is platform-agnostic: the actual token generation lives in each
 * platform's `lib/captcha.ts` (native WebView on mobile, script injection on
 * web). Both expose `captchaOptions()` and `withCaptcha()` with identical
 * behavior so screens never duplicate CAPTCHA logic.
 */

export type CaptchaOptions = {
  captchaToken?: string;
};

export const CAPTCHA_FRIENDLY_ERROR =
  "We couldn't verify you're human. Please try again.";

/** True when an error is a CAPTCHA rejection (missing/expired/invalid token). */
export function isCaptchaError(error: unknown): boolean {
  if (!error) return false;
  let raw = "";
  if (typeof error === "string") raw = error;
  else if (error instanceof Error) raw = error.message;
  else if (typeof error === "object" && "message" in error) {
    raw = String((error as { message: unknown }).message ?? "");
  }
  const lower = raw.toLowerCase();
  return (
    lower.includes("captcha") ||
    lower.includes("hcaptcha") ||
    lower.includes("turnstile") ||
    lower.includes("verification failed")
  );
}

/**
 * Wrap a Supabase auth call with CAPTCHA + the abuse-prevention gate.
 *
 * 1. Generates a captchaToken (no-op when CAPTCHA isn't configured).
 * 2. Runs `preflight` — our turnstile-guard edge function verifies the
 *    token and applies per-IP/per-account rate limits. A guard rejection
 *    short-circuits and its friendly `{ error }` result is returned as-is,
 *    so screens just render `result.error` like any auth error.
 * 3. Runs `execute` with `options.captchaToken` attached.
 * 4. If the server rejects the token (stale/expired single-use token),
 *    retries ONCE with a fresh token.
 *
 * Returns exactly what `execute` returns, so existing call sites that
 * destructure `{ data, error }` keep working unchanged.
 */
export async function runWithCaptcha<T extends { error: unknown }>(
  execute: (options: CaptchaOptions) => Promise<T>,
  getCaptchaOptions: () => Promise<CaptchaOptions>,
  preflight: (token: string | undefined) => Promise<T | null> = async () => null,
): Promise<T> {
  const attempt = async (): Promise<T> => {
    try {
      const opts = await getCaptchaOptions();
      const blocked = await preflight(opts.captchaToken);
      if (blocked) return blocked;
      return await execute(opts);
    } catch (err) {
      // Widget load failures / challenge timeouts surface as auth errors
      // so screens render a friendly message instead of swallowing them.
      return {
        error: err instanceof Error ? err : new Error(String(err)),
      } as T;
    }
  };

  const first = await attempt();

  if (isCaptchaError(first.error)) {
    // CAPTCHA tokens are single-use and short-lived — refresh and retry once.
    const fresh = await getCaptchaOptions().catch(() => null);
    if (fresh?.captchaToken) {
      const blocked = await preflight(fresh.captchaToken);
      if (blocked) return blocked;
      return execute(fresh);
    }
  }

  return first;
}