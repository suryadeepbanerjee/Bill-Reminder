/**
 * Web CAPTCHA helper (Vite + Cloudflare Turnstile).
 *
 * ALWAYS-VISIBLE widget: every sensitive form embeds the Turnstile checkbox
 * inline via <CaptchaField/> (see components/ui/CaptchaField.tsx). No more
 * hidden/overlay flow — the user sees and completes the checkbox themselves.
 *
 * Contract:
 *   mountCaptchaWidget(host, onState) – render the widget into a container
 *   hasSolvedCaptcha() / getWidgetState() – read-only widget state
 *   captchaOptions()                – fresh token per call (resets the widget)
 *   withCaptcha(action, execute)    – token + abuse-prevention gate + retry
 *
 * Each captchaOptions() call regenerates the token: the widget resets and the
 * promise resolves on its next callback. Clean traffic auto-passes instantly;
 * challenged traffic re-asks for the checkbox interaction.
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

// ── Widget registry ───────────────────────────────────────────────────────────
// A single visible widget per page. Pages mount it with <CaptchaField/> which
// calls `mountCaptchaWidget(host, { onState })`.

export type CaptchaWidgetState = "idle" | "solving" | "solved" | "expired" | "error";

let widgetHost: HTMLElement | null = null;
let widgetState: CaptchaWidgetState = "idle";

type StateListener = (next: CaptchaWidgetState) => void;
const stateListeners = new Set<StateListener>();

interface TokenWaiter {
  resolve: (token: string) => void;
  reject: (err: Error) => void;
}
let tokenWaiters: TokenWaiter[] = [];

function setWidgetState(next: CaptchaWidgetState): void {
  widgetState = next;
  stateListeners.forEach((l) => l(next));
}

function buildWidgetOptions(theme: "light" | "dark" | "auto" = "dark"): TurnstileOptions {
  return {
    sitekey: SITE_KEY,
    size: "normal", // 300×65 standard checkbox — always visible
    theme,
    callback: (token) => {
      const waiters = tokenWaiters;
      tokenWaiters = [];
      waiters.forEach((w) => w.resolve(token));
      setWidgetState("solved");
    },
    "error-callback": () => {
      const waiters = tokenWaiters;
      tokenWaiters = [];
      waiters.forEach((w) => w.reject(new Error("CAPTCHA challenge failed")));
      setWidgetState("error");
    },
    "expired-callback": () => {
      setWidgetState("expired");
    },
    "before-interactive-callback": () => {
      setWidgetState("solving");
    },
  };
}

export interface CaptchaMountHandle {
  readonly element: HTMLElement;
  destroy(): void;
}

/** Render the ALWAYS-VISIBLE Turnstile widget into `host` (a plain <div>). */
export async function mountCaptchaWidget(
  host: HTMLElement,
  onState?: (state: CaptchaWidgetState) => void,
  options?: { theme?: "light" | "dark" | "auto" },
): Promise<CaptchaMountHandle> {
  await loadTurnstileScript();
  if (!window.turnstile) throw new Error("CAPTCHA widget is not ready");
  if (widgetHost && widgetHost !== host) {
    try {
      window.turnstile.remove(widgetHost);
    } catch {
      /* noop */
    }
  }
  widgetHost = host;
  window.turnstile.render(host, buildWidgetOptions(options?.theme));
  if (onState) stateListeners.add(onState);
  return {
    element: host,
    destroy: () => {
      try {
        window.turnstile?.remove(host);
      } catch {
        /* noop */
      }
      if (widgetHost === host) {
        widgetHost = null;
      }
      if (onState) stateListeners.delete(onState);
    },
  };
}

/** True when the widget holds a solved (unused) token. */
export function hasSolvedCaptcha(): boolean {
  return widgetState === "solved";
}

/** Current widget state — mirrors <CaptchaField/> states. */
export function getWidgetState(): CaptchaWidgetState {
  return widgetState;
}

function clearTokenWaiters(): void {
  const waiters = tokenWaiters;
  tokenWaiters = [];
  waiters.forEach((w) => w.reject(new Error("CAPTCHA request superseded")));
}

/**
 * Fresh token: resets the widget so Turnstile issues a brand-new single-use
 * token, then resolves when its callback fires. The checkbox stays visible
 * the whole time — this is the "always visible" path.
 */
async function nextTokenFromWidget(): Promise<string> {
  if (!widgetHost) throw new Error("CAPTCHA widget is not mounted");
  await loadTurnstileScript();
  clearTokenWaiters();
  setWidgetState("idle");
  window.turnstile?.reset(widgetHost);
  return new Promise<string>((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      clearTokenWaiters();
      reject(new Error("CAPTCHA timed out — please refresh the security check"));
    }, 90000);
    tokenWaiters.push({
      resolve: (token) => {
        window.clearTimeout(timeout);
        resolve(token);
      },
      reject: (err) => {
        window.clearTimeout(timeout);
        reject(err);
      },
    });
  });
}

// ── Fallback overlay (only when no inline widget is mounted) ─────────────────

let heldOverlay: { close: () => void } | null = null;

export function closeCaptchaOverlay(): void {
  heldOverlay?.close();
  heldOverlay = null;
}

const TOKEN_TIMEOUT_MS = 60000;

async function getTokenViaOverlay(): Promise<string> {
  if (!window.turnstile) throw new Error("CAPTCHA widget is not ready");
  return new Promise<string>((resolve, reject) => {
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

    window.turnstile!.render(widget, {
      sitekey: SITE_KEY,
      size: "normal",
      theme: "dark",
      callback: (token) => {
        window.clearTimeout(timeout);
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

/** CAPTCHA options for a Supabase auth call — fresh token from the visible widget. */
export async function captchaOptions(): Promise<CaptchaOptions> {
  if (!isCaptchaEnabled) return {};
  const token = widgetHost ? await nextTokenFromWidget() : await getTokenViaOverlay();
  return { captchaToken: token };
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

/** Wrap a Supabase auth call — same shape as before, token from the visible widget. */
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