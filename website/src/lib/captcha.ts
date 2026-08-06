/**
 * Web CAPTCHA helper (Vite + Cloudflare Turnstile).
 *
 * Loads Turnstile's script once and runs it in invisible mode
 * (`render: explicit`). Silent challenges resolve without interaction;
 * when an interactive challenge is needed Turnstile presents it in its own
 * overlay — native web UX.
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

interface TurnstileOptions {
  sitekey: string;
  theme?: "light" | "dark" | "auto";
  size?: "normal" | "compact" | "invisible";
  callback?: (token: string) => void;
  "error-callback"?: () => void;
  "expired-callback"?: () => void;
}

interface TurnstileApi {
  render(container: HTMLElement, options: TurnstileOptions): string;
  remove(container: string | HTMLElement): void;
  reset(container: string | HTMLElement): void;
  execute(container: string | HTMLElement): void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
    __brTurnstileReady?: () => void;
  }
}

let scriptPromise: Promise<void> | null = null;

function loadTurnstileScript(): Promise<void> {
  if (!isCaptchaEnabled) {
    return Promise.reject(new Error("CAPTCHA not configured"));
  }
  if (!scriptPromise) {
    scriptPromise = new Promise<void>((resolve, reject) => {
      if (document.getElementById("turnstile-script")) {
        resolve();
        return;
      }
      window.__brTurnstileReady = () => resolve();
      const script = document.createElement("script");
      script.id = "turnstile-script";
      script.src =
        "https://challenges.cloudflare.com/turnstile/v0/api.js?onload=__brTurnstileReady&render=explicit";
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

const TOKEN_TIMEOUT_MS = 60000;

/**
 * Generate a fresh single-use Turnstile token.
 *
 * Renders an invisible widget on an off-screen container; the challenge
 * starts automatically on render and the token arrives via `callback`.
 * Tokens are single-use, so a fresh widget is created per call and removed
 * when the callback fires.
 */
function getToken(): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const container = document.createElement("div");
    container.style.cssText =
      "position:absolute;left:-9999px;top:-9999px;width:300px;height:65px;";
    document.body.appendChild(container);

    const finish = (err?: Error) => {
      window.clearTimeout(timeout);
      window.turnstile?.remove(container);
      if (container.parentNode) container.parentNode.removeChild(container);
      if (err) reject(err);
    };

    const timeout = window.setTimeout(
      () => finish(new Error("CAPTCHA timed out")),
      TOKEN_TIMEOUT_MS,
    );

    window.turnstile?.render(container, {
      sitekey: SITE_KEY,
      size: "invisible",
      theme: "dark",
      callback: (token) => {
        finish();
        resolve(token);
      },
      "error-callback": () => finish(new Error("CAPTCHA challenge failed")),
      "expired-callback": () => finish(new Error("CAPTCHA token expired")),
    });
  });
}

/** CAPTCHA options for a Supabase auth call — `{}` when not configured. */
export async function captchaOptions(): Promise<CaptchaOptions> {
  if (!isCaptchaEnabled) return {};
  await loadTurnstileScript();
  if (!window.turnstile) {
    throw new Error("CAPTCHA widget is not ready");
  }
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
