import { useEffect } from "react";
import { supabase } from "../lib/supabase";

/*
 * AuthCallback — handles every Supabase auth redirect.
 *
 * Job:
 *   1. Detect the incoming token type (hash fragment or PKCE code)
 *   2. Exchange / validate it
 *   3. Store access + refresh tokens in sessionStorage so success.html
 *      can build a deep link that auto-signs the user into the app
 *   4. Set br_auth_verified gate token
 *   5. Redirect to /success.html  OR  /auth/error
 *
 * Token types Supabase sends:
 *   • Implicit flow  →  /auth/callback#access_token=...&type=...
 *   • PKCE flow      →  /auth/callback?code=...&type=...
 *   • Error forward  →  /auth/callback?error=...&error_description=...
 */

type Reason = "expired" | "invalid" | "already_verified" | "error";

function redirectError(reason: Reason, detail?: string): void {
  const url = new URL("/auth/error", window.location.origin);
  url.searchParams.set("reason", reason);
  if (detail) url.searchParams.set("detail", detail);
  window.location.replace(url.toString());
}

function redirectSuccess(accessToken?: string, refreshToken?: string): void {
  // Gate token — success.html checks this before rendering.
  // Cleared immediately by success.html after reading (prevent refresh bypass).
  sessionStorage.setItem("br_auth_verified", "1");

  // Store session tokens so success.html can build the auto-signin deep link.
  // Cleared immediately by success.html after reading.
  if (accessToken) {
    sessionStorage.setItem(
      "br_auth_tokens",
      JSON.stringify({ access_token: accessToken, refresh_token: refreshToken ?? "" })
    );
  }

  window.location.replace("/success.html");
}

async function processCallback(): Promise<void> {
  const params  = new URLSearchParams(window.location.search);
  const code    = params.get("code");
  const type    = params.get("type");
  const err     = params.get("error");
  const errDesc = params.get("error_description") ?? "";
  const hash    = window.location.hash;

  // ── Supabase forwarded an error ──────────────────────────────────────────
  if (err) {
    const d = errDesc.toLowerCase();
    if (d.includes("expired") || d.includes("otp_expired")) {
      return redirectError("expired");
    }
    if (d.includes("already confirmed") || d.includes("already verified")) {
      // Already verified is a success outcome — user can sign in
      return redirectSuccess();
    }
    return redirectError("invalid", errDesc);
  }

  // ── Hash fragment — implicit flow ────────────────────────────────────────
  // Mobile app uses flowType:"implicit" so verification emails redirect here.
  if (hash.includes("access_token")) {
    const hashParams   = new URLSearchParams(hash.startsWith("#") ? hash.slice(1) : hash);
    const accessToken  = hashParams.get("access_token");
    const refreshToken = hashParams.get("refresh_token") ?? "";
    const hashType     = hashParams.get("type") ?? "";

    if (!accessToken) return redirectError("expired");

    const { error: setErr } = await supabase.auth.setSession({
      access_token:  accessToken,
      refresh_token: refreshToken,
    });

    if (setErr) return redirectError("expired");

    if (hashType === "recovery") {
      // Password reset — go to the reset-password form (no auto-signin needed)
      sessionStorage.setItem("br_auth_verified", "1");
      window.location.replace("/reset-password");
      return;
    }

    // signup, email_change, magic_link → success + store tokens for deep link
    return redirectSuccess(accessToken, refreshToken);
  }

  // ── PKCE code exchange ────────────────────────────────────────────────────
  if (code) {
    const { data, error: exchErr } = await supabase.auth.exchangeCodeForSession(code);
    if (exchErr) {
      const msg = exchErr.message.toLowerCase();
      if (msg.includes("expired") || msg.includes("already been used") || msg.includes("single use")) {
        return redirectError("expired");
      }
      return redirectError("error", exchErr.message);
    }
    if (!data.session) return redirectError("error");

    if (type === "recovery") {
      sessionStorage.setItem("br_auth_verified", "1");
      window.location.replace("/reset-password");
      return;
    }

    // signup, email_change, magic_link → success + store tokens for deep link
    return redirectSuccess(data.session.access_token, data.session.refresh_token);
  }

  // ── No meaningful params ─────────────────────────────────────────────────
  return redirectError("invalid");
}

export default function AuthCallback() {
  useEffect(() => {
    processCallback().catch(() => {
      redirectError("error");
    });
  }, []);

  // Renders nothing — redirect happens before user sees anything.
  return null;
}
