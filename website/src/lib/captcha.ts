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
  size?: "normal" | "compact";
  // "interaction-only" = silent for clean traffic, shows challenge for suspicious IPs (VPN etc.)
  appearance?: "always" | "execute" | "interaction-only";
  callback?: (token: string) => void;
  "error-callback"?: () => void;
  "expired-callback"?: () => void;
  "before-interactive-callback"?: () => void;
  "unsupported-browser"?: () => void;
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
 * Generate a fresh Turnstile token.
 *
 * Opens a plain semi-transparent backdrop with the raw Cloudflare widget
 * rendered at `size: "normal"` (300×65 px checkbox). No custom card or
 * spinner — just the native CF UI. Auto-passes silently for clean traffic;
 * shows the interactive checkbox/puzzle for VPN or suspicious IPs.
 */

/** Overlay left open after a successful token, awaiting the auth call. */
let heldOverlay: { close: () => void } | null = null;

/** Close the overlay once the wrapped auth call has settled. */
export function closeCaptchaOverlay(): void {
  heldOverlay?.close();
  heldOverlay = null;
}

function getToken(): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    // Plain semi-transparent backdrop — Cloudflare widget sits in the center.
    // No custom card / spinner / label: just the native CF checkbox so it
    // always works regardless of IP reputation or browser environment.
    const backdrop = document.createElement("div");
    backdrop.setAttribute("role", "dialog");
    backdrop.setAttribute("aria-modal", "true");
    backdrop.setAttribute("aria-label", "Security check");
    backdrop.style.cssText = [
      "position:fixed",
      "inset:0",
      "z-index:99999",
      "display:flex",
      "align-items:center",
      "justify-content:center",
      "background:rgba(0,0,0,0.55)",
    ].join(";");

    // The widget div — Cloudflare renders its own iframe inside this.
    const widget = document.createElement("div");
    backdrop.appendChild(widget);
    document.body.appendChild(backdrop);

    const cleanup = () => {
      window.clearTimeout(timeout);
      window.turnstile?.remove(widget);
      backdrop.remove();
    };

    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error("CAPTCHA timed out"));
    }, TOKEN_TIMEOUT_MS);

    window.turnstile?.render(widget, {
      sitekey: SITE_KEY,
      // "normal" = standard 300×65 Cloudflare checkbox widget.
      // Auto-passes silently for clean traffic; shows interactive puzzle
      // for VPN/suspicious IPs. Always visible, never clipped.
      size: "normal",
      theme: "dark",
      callback: (token) => {
        window.clearTimeout(timeout);
        // Keep backdrop up briefly so it doesn't flash away before auth runs.
        heldOverlay = { close: cleanup };
        resolve(token);
      },
      "error-callback": () => {
        cleanup();
        reject(new Error("CAPTCHA challenge failed"));
      },
      "expired-callback": () => {
        cleanup();
        reject(new Error("CAPTCHA token expired"));
      },
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
  // A stale "Confirming…" overlay (e.g. from a retry) must go before we open
  // a fresh token attempt.
  closeCaptchaOverlay();
  return { captchaToken: await getToken() };
}

/**
 * Abuse-protection preflight: calls the turnstile-guard edge function, which
 * verifies the token with Cloudflare and enforces per-IP/per-account rate
 * limits. Returns a friendly error message when the guard denies the request,
 * or null to proceed. Fails OPEN only when the guard is completely
 * unreachable (transport error) — any guard response is honored.
 */
async function runGuard(action: string, token?: string): Promise<string | null> {
  const { supabase } = await import("./supabase");
  const { data, error } = await supabase.functions.invoke("turnstile-guard", {
    body: { action, captchaToken: token },
  });

  const payload = (data ?? null) as { ok?: boolean; error?: string } | null;
  if (payload) {
    if (payload.ok === true) return null;
    return payload.error ?? "We couldn't verify your request. Please try again.";
  }

  // Non-2xx — read the error body from the FunctionsHttpError context.
  if (error && error instanceof Error && (error as { context?: unknown }).context instanceof Response) {
    try {
      const resp = (error as { context?: unknown }).context as Response;
      const body = (await resp.clone().json()) as { error?: string } | null;
      if (body?.error) return body.error;
    } catch {
      /* not JSON — fall through */
    }
  }

  console.error("turnstile-guard unreachable:", error?.message ?? error);
  return null; // fail open on transport failure only
}

/**
 * Wrap a Supabase auth call so it sends `options.captchaToken`, runs the
 * abuse-prevention gate for `action`, and retries once with a fresh token if
 * the server rejects the first one.
 */
export function withCaptcha<T extends { error: unknown }>(
  action: string,
  execute: (options: CaptchaOptions) => Promise<T>,
): Promise<T> {
  return runWithCaptcha(execute, captchaOptions, async (token) => {
    const denied = await runGuard(action, token);
    if (denied) return { error: new Error(denied) } as T;
    return null;
  }).finally(() => closeCaptchaOverlay());
}
