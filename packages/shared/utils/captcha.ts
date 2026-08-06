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
 * Wrap a Supabase auth call with CAPTCHA.
 *
 * 1. Generates a captchaToken (no-op when CAPTCHA isn't configured).
 * 2. Runs the call with `options.captchaToken` attached.
 * 3. If the server rejects the token (stale/expired single-use token),
 *    retries ONCE with a fresh token.
 *
 * Returns exactly what `execute` returns, so existing call sites that
 * destructure `{ data, error }` keep working unchanged.
 */
export async function runWithCaptcha<T extends { error: unknown }>(
  execute: (options: CaptchaOptions) => Promise<T>,
  getCaptchaOptions: () => Promise<CaptchaOptions>,
): Promise<T> {
  const first = await execute(await getCaptchaOptions());

  if (isCaptchaError(first.error)) {
    // hCaptcha tokens are single-use and short-lived — refresh and retry once.
    const fresh = await getCaptchaOptions();
    if (fresh.captchaToken) {
      return execute(fresh);
    }
  }

  return first;
}