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

/** Inject the tiny amount of CSS the inline captcha overlay needs (once). */
let captchaStylesInjected = false;
function ensureCaptchaStyles(): void {
  if (captchaStylesInjected) return;
  captchaStylesInjected = true;
  // Tokens mirror the site design system (--color-surface / border / secondary
  // / accent) so the overlay never drifts from the theme. Motion follows the
  // brand rhythm: 200ms ease-out, one subtle rise, no bounce.
  const style = document.createElement("style");
  style.textContent = `
    .br-captcha-overlay { animation: br-captcha-fade 160ms ease-out; }
    .br-captcha-card { animation: br-captcha-rise 220ms ease-out; }
    @keyframes br-captcha-fade { from { opacity: 0; } }
    @keyframes br-captcha-rise { from { opacity: 0; transform: translateY(8px); } }
    .br-captcha-spinner {
      width: 26px; height: 26px;
      border-radius: 50%;
      border: 2.5px solid rgba(186, 150, 24, 0.2);
      border-top-color: var(--color-accent);
      animation: br-captcha-spin 0.85s linear infinite;
    }
    @keyframes br-captcha-spin { to { transform: rotate(360deg); } }
    .br-captcha-label {
      margin: 16px 0 0;
      color: var(--color-secondary);
      font-size: 13px; font-weight: 500; letter-spacing: 0.01em;
      font-family: Inter, system-ui, sans-serif;
      animation: br-captcha-breathe 2.6s ease-in-out 0.5s infinite;
    }
    @keyframes br-captcha-breathe { 50% { opacity: 0.72; } }
    @media (prefers-reduced-motion: reduce) {
      .br-captcha-overlay,
      .br-captcha-card,
      .br-captcha-spinner,
      .br-captcha-label { animation: none; }
    }
  `;
  document.head.appendChild(style);
}

/**
 * Generate a fresh single-use Turnstile token.
 *
 * Renders a compact Turnstile widget (65 px tall) inside a visible centered
 * overlay card. The compact widget:
 *   - Silently auto-verifies clean traffic (spinner → check, < 1 s).
 *   - Shows an interactive checkbox challenge for suspicious IPs (VPN, proxy,
 *     WebView), which the user solves in-place — no invisible iframe, no
 *     hidden container, no timeout.
 *
 * The overlay stays mounted after the token arrives (label → "Confirming…")
 * so it never vanishes before the guarded auth call finishes — the caller
 * closes it with `closeCaptchaOverlay()`. Errors/timeouts tear it down here.
 */

/** Overlay left open after a successful token, awaiting the auth call. */
let heldOverlay: { close: () => void } | null = null;

/** Close the "Confirming…" overlay once the wrapped auth call has settled. */
export function closeCaptchaOverlay(): void {
  heldOverlay?.close();
  heldOverlay = null;
}



function getToken(): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    ensureCaptchaStyles();

    const overlay = document.createElement("div");
    overlay.className = "br-captcha-overlay";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-label", "Security check");
    overlay.setAttribute("aria-busy", "true");
    overlay.style.cssText = [
      "position:fixed",
      "inset:0",
      "z-index:99999",
      "display:flex",
      "align-items:center",
      "justify-content:center",
      "padding:24px",
      "background:rgba(10,10,12,0.6)",
    ].join(";");

    const card = document.createElement("div");
    card.className = "br-captcha-card";
    card.style.cssText = [
      "width:360px",
      "max-width:100%",
      "box-sizing:border-box",
      "border-radius:16px",
      "background:var(--color-surface)",
      "border:1px solid var(--color-border)",
      "box-shadow:0 24px 64px rgba(0,0,0,0.3)",
      "padding:24px 28px 22px",
      "text-align:center",
    ].join(";");

    // Branded shield mark so the box reads as a security check, not a blank popup.
    const badgeWrap = document.createElement("div");
    badgeWrap.style.cssText =
      "display:flex;justify-content:center;margin-bottom:14px;";
    const badge = document.createElement("div");
    badge.style.cssText = [
      "width:40px;height:40px;border-radius:12px",
      "background:rgba(186,150,24,0.12)",
      "border:1px solid rgba(186,150,24,0.25)",
      "display:flex;align-items:center;justify-content:center",
    ].join(";");
    badge.innerHTML = [
      '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">',
      '<path d="M12 22s8-3.5 8-10V5l-8-3-8 3v7c0 6.5 8 10 8 10z"/>',
      '<path d="M9 12l2 2 4-4"/>',
      "</svg>",
    ].join("");
    badgeWrap.appendChild(badge);

    const spinner = document.createElement("div");
    spinner.className = "br-captcha-spinner";
    spinner.setAttribute("role", "status");
    spinner.setAttribute("aria-label", "Verifying");
    spinner.style.cssText = "margin:0 auto;";

    const label = document.createElement("p");
    label.className = "br-captcha-label";
    label.textContent = "Verifying you're human…";

    // Widget container — min-height so the compact Turnstile widget (65 px)
    // is never clipped. Iframes inside a height:0 parent are invisible even
    // with overflow:visible, which is why the old hidden approach failed.
    const widget = document.createElement("div");
    widget.setAttribute("aria-hidden", "true");
    widget.style.cssText = [
      "width:300px",
      "max-width:100%",
      "min-height:68px",
      "margin:16px auto 0",
      "display:flex",
      "align-items:center",
      "justify-content:center",
    ].join(";");



    card.appendChild(badgeWrap);
    card.appendChild(spinner);
    card.appendChild(label);
    card.appendChild(widget);
    overlay.appendChild(card);
    document.body.appendChild(overlay);

    const cleanup = () => {
      window.clearTimeout(timeout);
      window.turnstile?.remove(widget);
      overlay.remove();
    };

    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error("CAPTCHA timed out"));
    }, TOKEN_TIMEOUT_MS);

    window.turnstile?.render(widget, {
      sitekey: SITE_KEY,
      // compact: always-visible 65px widget. Silently auto-passes for clean
      // traffic; shows an interactive checkbox for VPN/proxy/WebView traffic.
      // Never fires error-callback just because of IP reputation.
      size: "compact",
      theme: "dark",
      callback: (token) => {
        // Verification succeeded — keep the card up in a "Confirming…" state
        // until the wrapped auth call finishes, so the box never vanishes
        // before the next step appears. `closeCaptchaOverlay()` tears it down.
        window.clearTimeout(timeout);
        spinner.style.display = "none";
        label.textContent = "Confirming…";
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
