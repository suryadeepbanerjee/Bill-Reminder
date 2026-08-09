/**
 * Web CAPTCHA helper (Vite + Cloudflare Turnstile).
 *
 * The Turnstile widget is NEVER embedded inside the page. Submitting a
 * protected action opens a modal popup block with the checkbox; the submit
 * continues automatically once the challenge completes.
 *
 * Contract:
 *   captchaOptions()   – opens the popup, resolves with a fresh token
 *   withCaptcha(action, execute) – token + abuse-prevention gate + retry
 *   closeCaptchaOverlay() – programmatically close the popup
 *
 * Each captchaOptions() call creates a brand-new single-use token. Clean
 * traffic auto-passes instantly; challenged traffic re-asks for the checkbox
 * interaction inside the popup. Closing the popup cancels the action.
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
  getResponse(container: string | HTMLElement): string | undefined;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
    __brTurnstileReady?: () => void;
  }
}

let scriptPromise: Promise<void> | null = null;
const SCRIPT_LOAD_TIMEOUT_MS = 15000;

function removeScriptTag(): void {
  const existing = document.getElementById("turnstile-script");
  existing?.remove();
}

/**
 * Load Turnstile's api.js exactly once and make sure `window.turnstile` is
 * actually usable before resolving. Self-healing: a stale/failed script tag
 * is removed and retried instead of poison-pill-resolving without the API.
 */
function loadTurnstileScript(): Promise<void> {
  if (!isCaptchaEnabled) {
    return Promise.reject(new Error("CAPTCHA not configured"));
  }
  if (!scriptPromise) {
    scriptPromise = new Promise<void>((resolve, reject) => {
      const attempt = (): void => {
        removeScriptTag();
        if (window.turnstile) {
          resolve();
          return;
        }
        window.__brTurnstileReady = () => {
          if (window.turnstile) {
            resolve();
          } else {
            // onload fired but the API is still missing — kill and retry.
            removeScriptTag();
            scriptPromise = null;
            reject(new Error("CAPTCHA widget is not ready"));
          }
        };
        const script = document.createElement("script");
        script.id = "turnstile-script";
        script.src =
          "https://challenges.cloudflare.com/turnstile/v0/api.js?onload=__brTurnstileReady&render=explicit";
        script.async = true;
        script.onerror = () => {
          removeScriptTag();
          scriptPromise = null;
          reject(new Error("Could not load the CAPTCHA widget"));
        };
        document.head.appendChild(script);
      };
      attempt();
      // If the CDN hangs without firing onload/onerror, surface it promptly.
      window.setTimeout(() => {
        if (!window.turnstile) {
          removeScriptTag();
          scriptPromise = null;
          reject(new Error("Could not load the CAPTCHA widget"));
        }
      }, SCRIPT_LOAD_TIMEOUT_MS);
    });
  }
  return scriptPromise;
}

// ── Modal popup ───────────────────────────────────────────────────────────────
// Single popup at a time. The widget only exists inside the popup — the page
// itself never embeds Turnstile.

let heldOverlay: { close: () => void } | null = null;

export function closeCaptchaOverlay(): void {
  heldOverlay?.close();
  heldOverlay = null;
}

const TOKEN_TIMEOUT_MS = 90000;
const MAX_WIDGET_ERRORS = 3;

const POPUP_STYLES = {
  backdrop: [
    "position:fixed",
    "inset:0",
    "z-index:99999",
    "display:flex",
    "align-items:center",
    "justify-content:center",
    "background:rgba(9,10,14,0.72)",
    "padding:20px",
  ].join(";"),
  panel: [
    "position:relative",
    "width:min(92vw, 360px)",
    "background:#131418",
    "border:1px solid #282b34",
    "border-radius:16px",
    "padding:24px 20px 18px",
    "box-shadow:0 24px 64px rgba(0,0,0,0.55)",
    "text-align:center",
    "font-family:Inter, system-ui, -apple-system, sans-serif",
  ].join(";"),
  title: [
    "margin:0",
    "font-size:15px",
    "font-weight:700",
    "color:#fafafa",
    "letter-spacing:-0.01em",
  ].join(";"),
  sub: [
    "margin:6px 0 16px",
    "font-size:12.5px",
    "line-height:1.45",
    "color:#8e929e",
  ].join(";"),
  widgetHost: [
    "min-height:65px",
    "display:flex",
    "align-items:center",
    "justify-content:center",
  ].join(";"),
  status: [
    "margin:14px 0 0",
    "min-height:18px",
    "font-size:12px",
    "color:#8e929e",
  ].join(";"),
  cancel: [
    "margin:12px auto 0",
    "display:block",
    "background:none",
    "border:none",
    "padding:4px 10px",
    "font-size:12.5px",
    "font-weight:600",
    "color:#8e929e",
    "cursor:pointer",
  ].join(";"),
} as const;

function injectSpinnerStyle(): void {
  if (document.getElementById("br-captcha-spin-style")) return;
  const style = document.createElement("style");
  style.id = "br-captcha-spin-style";
  style.textContent = "@keyframes spinner-rotation{to{transform:rotate(360deg)}}";
  document.head.appendChild(style);
}

function spinnerElement(): HTMLElement {
  const el = document.createElement("div");
  el.style.cssText =
    "width:22px;height:22px;border:2px solid #2e2e37;border-top-color:#ba9618;border-radius:50%;animation:spinner-rotation 0.8s linear infinite";
  return el;
}

export async function captchaOptions(): Promise<CaptchaOptions> {
  if (!isCaptchaEnabled) return {};
  return { captchaToken: await getTokenViaOverlay() };
}

async function getTokenViaOverlay(): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const backdrop = document.createElement("div");
    backdrop.setAttribute("role", "dialog");
    backdrop.setAttribute("aria-modal", "true");
    backdrop.setAttribute("aria-label", "Security check");
    backdrop.style.cssText = POPUP_STYLES.backdrop;

    const panel = document.createElement("div");
    panel.style.cssText = POPUP_STYLES.panel;

    const title = document.createElement("p");
    title.style.cssText = POPUP_STYLES.title;
    title.textContent = "Security check";

    const sub = document.createElement("p");
    sub.style.cssText = POPUP_STYLES.sub;
    sub.textContent = "Complete the check below to continue";

    const widgetHost = document.createElement("div");
    widgetHost.style.cssText = POPUP_STYLES.widgetHost;

    const status = document.createElement("p");
    status.style.cssText = POPUP_STYLES.status;
    status.textContent = "";

    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.style.cssText = POPUP_STYLES.cancel;
    cancel.textContent = "Cancel";
    cancel.addEventListener("click", () => finishAbort());

    panel.append(title, sub, widgetHost, status, cancel);
    backdrop.appendChild(panel);
    backdrop.addEventListener("click", (e) => {
      if (e.target === backdrop) finishAbort();
    });
    document.body.appendChild(backdrop);

    let settled = false;
    let widgetErrors = 0;
    let cleanupDone = false;
    const destroy = () => {
      if (cleanupDone) return;
      cleanupDone = true;
      window.clearTimeout(timeout);
      try {
        window.turnstile?.remove(widgetHost);
      } catch {
        /* noop */
      }
      backdrop.remove();
      if (heldOverlay === overlayControl) heldOverlay = null;
    };
    const overlayControl = { close: destroy };

    const setStatus = (text: string): void => {
      status.textContent = text;
    };
    const showLoading = (): void => {
      widgetHost.textContent = "";
      widgetHost.appendChild(spinnerElement());
      setStatus("Loading security check…");
    };

    const fail = (message: string): void => {
      if (settled) return;
      settled = true;
      destroy();
      reject(new Error(message));
    };
    const finishAbort = (): void => {
      if (settled) return;
      settled = true;
      destroy();
      reject(new Error("Security check cancelled"));
    };

    const renderWidget = (): void => {
      widgetHost.textContent = "";
      if (!window.turnstile) {
        fail("CAPTCHA widget is not ready");
        return;
      }
      setStatus("");
      window.turnstile.render(widgetHost, {
        sitekey: SITE_KEY,
        size: "normal",
        theme: "dark",
        callback: (token) => {
          if (settled) return;
          settled = true;
          widgetHost.textContent = "";
          widgetHost.appendChild(spinnerElement());
          setStatus("Verifying…");
          heldOverlay = overlayControl; // keep open until server verifies
          resolve(token);
        },
        "error-callback": () => {
          if (settled) return;
          widgetErrors += 1;
          if (widgetErrors >= MAX_WIDGET_ERRORS) {
            fail("Security check failed — please try again.");
            return;
          }
          setStatus("Something went wrong — retrying…");
          window.setTimeout(() => {
            if (settled) return;
            window.turnstile?.remove(widgetHost);
            widgetHost.textContent = "";
            renderWidget();
          }, 900);
        },
        "expired-callback": () => {
          if (settled) return;
          // Token expired before use — silently re-ask.
          setStatus("Refreshing security check…");
          try {
            window.turnstile?.reset(widgetHost);
          } catch {
            /* noop */
          }
        },
      });
    };

    injectSpinnerStyle();
    showLoading();
    loadTurnstileScript()
      .then(() => {
        if (settled) return;
        if (widgetHost.isConnected) renderWidget();
      })
      .catch((err: unknown) =>
        fail(err instanceof Error ? err.message : "Could not load the CAPTCHA widget"),
      );

    const timeout = window.setTimeout(() => {
      fail("CAPTCHA timed out — please try again.");
    }, TOKEN_TIMEOUT_MS);
  });
}

// ── Guard + wrapper ──────────────────────────────────────────────────────────

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

/** Wrap a Supabase auth call — token comes from the modal popup. */
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