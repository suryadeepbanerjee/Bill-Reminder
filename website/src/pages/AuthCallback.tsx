import { useEffect } from "react";
import { supabase } from "../lib/supabase";

/*
 * AuthCallback — handles every Supabase auth redirect.
 *
 * This component NEVER renders visible UI. Its sole job is to:
 *   1. Validate the incoming token / code
 *   2. Exchange the code for a session (PKCE flow)
 *   3. Set a short-lived sessionStorage gate token
 *   4. Redirect immediately to /success.html (success) or /auth/error (failure)
 *
 * Supabase sends two kinds of links:
 *   • PKCE (default): /auth/callback?code=xxx&type=yyy
 *   • Legacy implicit:  /auth/callback#access_token=...&type=yyy
 */

type Reason = "expired" | "invalid" | "already_verified" | "error";

function redirectError(reason: Reason, detail?: string): void {
  const url = new URL("/auth/error", window.location.origin);
  url.searchParams.set("reason", reason);
  if (detail) url.searchParams.set("detail", detail);
  window.location.replace(url.toString());
}

function redirectSuccess(): void {
  // Gate token — success.html will check for this before rendering.
  // Using sessionStorage so it's cleared when the tab is closed.
  // It is also cleared immediately by success.html after reading to prevent refresh bypass.
  sessionStorage.setItem("br_auth_verified", "1");
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
      // Already verified is still a "success" outcome — user can sign in
      return redirectSuccess();
    }
    return redirectError("invalid", errDesc);
  }

  // ── Hash fragment — implicit flow (mobile PKCE disabled) ────────────────
  if (hash.includes("access_token")) {
    // Parse tokens directly from the hash — don't rely on async getSession()
    // side-effect parsing which can return null before the hash is consumed.
    const hashParams = new URLSearchParams(hash.startsWith("#") ? hash.slice(1) : hash);
    const accessToken  = hashParams.get("access_token");
    const refreshToken = hashParams.get("refresh_token") ?? "";
    const type         = hashParams.get("type") ?? "";

    if (!accessToken) return redirectError("expired");

    const { error: setErr } = await supabase.auth.setSession({
      access_token:  accessToken,
      refresh_token: refreshToken,
    });

    if (setErr) return redirectError("expired");

    if (type === "recovery") {
      window.location.replace("/reset-password");
      return;
    }

    // signup, email_change, magic_link — all go to success
    return redirectSuccess();
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
      // Password reset — go to the password reset form
      window.location.replace("/reset-password");
      return;
    }
    if (type === "email_change") {
      return redirectSuccess();
    }
    // Signup, magic link, any other verification
    return redirectSuccess();
  }

  // ── No meaningful params ─────────────────────────────────────────────────
  return redirectError("invalid");
}

export default function AuthCallback() {
  useEffect(() => {
    // Kick off immediately — no await needed in useEffect body itself
    processCallback().catch(() => {
      redirectError("error");
    });
  }, []);

  // Return null — this component intentionally renders nothing.
  // The redirect happens before the user ever sees anything.
  return null;
}
