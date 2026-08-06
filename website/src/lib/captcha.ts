/**
 * Web CAPTCHA helper (Vite + hCaptcha).
 *
 * Loads hCaptcha's script once and runs it in invisible mode
 * (`render: explicit` + `execute(siteKey, { async: true })`). Interactive
 * challenges render in hCaptcha's standard modal — native web UX.
 *
 * Public API matches the native helper in app/lib/captcha.ts:
 *   captchaOptions() / withCaptcha()
 * No-op when no site key is configured (dev / CAPTCHA disabled).
 *
 * Site key comes from EXPO_PUBLIC_CAPTCHA_SITE_KEY (task requirement) with
 * VITE_CAPTCHA_SITE_KEY as the conventional Vite fallback. Vite is configured
 * with envPrefix ["VITE_", "EXPO_PUBLIC_"] so both work in .env / CI env.
 */

import { runWithCaptcha, type CaptchaOptions } from "@shared/utils/captcha";

const SITE_KEY =
  (import.meta.env.EXPO_PUBLIC_CAPTCHA_SITE_KEY as string | undefined) ||
  (import.meta.env.VITE_CAPTCHA_SITE_KEY as string | undefined) ||
  "";

export const isCaptchaEnabled = SITE_KEY.length > 0;

interface HCaptchaApi {
  execute(siteKey: string, options: { async: true }): Promise<string>;
}

declare global {
  interface Window {
    hcaptcha?: HCaptchaApi;
    __brHCaptchaReady?: () => void;
  }
}

let scriptPromise: Promise<void> | null = null;

function loadHcaptchaScript(): Promise<void> {
  if (!isCaptchaEnabled) {
    return Promise.reject(new Error("CAPTCHA not configured"));
  }
  if (!scriptPromise) {
    scriptPromise = new Promise<void>((resolve, reject) => {
      if (document.getElementById("hcaptcha-script")) {
        resolve();
        return;
      }
      window.__brHCaptchaReady = () => resolve();
      const script = document.createElement("script");
      script.id = "hcaptcha-script";
      script.src = "https://js.hcaptcha.com/1/api.js?onload=__brHCaptchaReady&render=explicit";
      script.async = true;
      script.onerror = () => {
        scriptPromise = null;
        reject(new Error("Could not load the CAPTCHA widget"));
      };
      document.head.appendChild(script);
    });
  }
  return scriptPromise;
}

/** Generate a fresh single-use captcha token. */
async function getToken(): Promise<string> {
  await loadHcaptchaScript();
  if (!window.hcaptcha) {
    throw new Error("CAPTCHA widget is not ready");
  }
  return window.hcaptcha.execute(SITE_KEY, { async: true });
}

/** CAPTCHA options for a Supabase auth call — `{}` when not configured. */
export async function captchaOptions(): Promise<CaptchaOptions> {
  if (!isCaptchaEnabled) return {};
  return { captchaToken: await getToken() };
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