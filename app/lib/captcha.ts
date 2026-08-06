/**
 * Native CAPTCHA helper (Expo).
 *
 * Token generation runs in a hidden WebView (see components/ui/CaptchaHost)
 * loading hCaptcha's JS widget in invisible mode. This module is the
 * coordination point:
 *   - `requestCaptchaToken()` queues a token request and tells CaptchaHost to
 *     show itself; the WebView runs hCaptcha and posts the token back.
 *   - `completeCaptcha()` resolves/rejects the pending request.
 *   - `captchaOptions()` / `withCaptcha()` are the public API screens use —
 *     identical shape to the web helper in website/src/lib/captcha.ts.
 *
 * When EXPO_PUBLIC_CAPTCHA_SITE_KEY is not set, everything is a no-op
 * (behaves exactly like before CAPTCHA was enabled).
 */

import { runWithCaptcha, type CaptchaOptions } from "@shared/utils/captcha";

export const CAPTCHA_SITE_KEY = process.env.EXPO_PUBLIC_CAPTCHA_SITE_KEY ?? "";
export const isCaptchaEnabled = CAPTCHA_SITE_KEY.length > 0;

interface PendingRequest {
  resolve: (token: string) => void;
  reject: (err: Error) => void;
}

let pending: PendingRequest | null = null;
const activeListeners = new Set<(active: boolean) => void>();

/** CaptchaHost subscribes here to show/hide its modal overlay. */
export function subscribeCaptchaActive(listener: (active: boolean) => void): () => void {
  activeListeners.add(listener);
  listener(Boolean(pending));
  return () => {
    activeListeners.delete(listener);
  };
}

function setActive(active: boolean): void {
  activeListeners.forEach((listener) => listener(active));
}

/** Queue a captcha token request; CaptchaHost wakes up and runs the widget. */
export function requestCaptchaToken(): Promise<string> {
  if (!isCaptchaEnabled) {
    return Promise.reject(new Error("CAPTCHA not configured"));
  }
  return new Promise<string>((resolve, reject) => {
    if (pending) {
      pending.reject(new Error("CAPTCHA request superseded"));
    }
    pending = { resolve, reject };
    setActive(true);
  });
}

/** Called by CaptchaHost when the widget finishes (token or failure/timeout). */
export function completeCaptcha(token?: string, errorMessage?: string): void {
  const request = pending;
  pending = null;
  setActive(false);
  if (!request) return;
  if (token) {
    request.resolve(token);
  } else {
    request.reject(new Error(errorMessage ?? "CAPTCHA failed"));
  }
}

/** CAPTCHA options for a Supabase auth call — `{}` when not configured. */
export async function captchaOptions(): Promise<CaptchaOptions> {
  if (!isCaptchaEnabled) return {};
  return { captchaToken: await requestCaptchaToken() };
}

/**
 * Wrap a Supabase auth call so it sends `options.captchaToken` and retries
 * once with a fresh token if the server rejects the first one.
 */
export function withCaptcha<T extends { error: unknown }>(
  execute: (options: CaptchaOptions) => Promise<T>,
): Promise<T> {
  return runWithCaptcha(execute, captchaOptions);
}