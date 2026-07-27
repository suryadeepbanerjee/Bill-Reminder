import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { supabase } from "../lib/supabase";
import Logo from "../components/ui/Logo";

/* ─────────────────────────────────────────────────────────────────
   AuthCallback — handles every possible Supabase auth redirect.

   Supabase sends two kinds of links:
   • PKCE (default): /auth/callback?code=xxx&type=yyy
   • Legacy implicit:  /auth/callback#access_token=...&type=yyy

   We handle both, map every outcome to a distinct UI state, and
   NEVER show a blank page.
───────────────────────────────────────────────────────────────── */

type State =
  | { kind: "loading" }
  | { kind: "verified" }
  | { kind: "reset_ready" }
  | { kind: "email_changed" }
  | { kind: "already_verified" }
  | { kind: "expired" }
  | { kind: "invalid"; detail?: string }
  | { kind: "error"; detail?: string };

async function resolve(): Promise<State> {
  const params  = new URLSearchParams(window.location.search);
  const code    = params.get("code");
  const type    = params.get("type");   // "recovery" | "email_change" | "signup"
  const err     = params.get("error");
  const errDesc = params.get("error_description") ?? undefined;
  const hash    = window.location.hash;

  // ── Supabase forwarded an error ──────────────────────────────────
  if (err) {
    const d = (errDesc ?? "").toLowerCase();
    if (d.includes("expired") || d.includes("otp_expired")) return { kind: "expired" };
    if (d.includes("already confirmed") || d.includes("already verified")) return { kind: "already_verified" };
    return { kind: "invalid", detail: errDesc };
  }

  // ── Hash fragment — implicit flow (older links) ──────────────────
  if (hash.includes("access_token")) {
    if (hash.includes("type=recovery")) {
      const { data } = await supabase.auth.getSession();
      return data.session ? { kind: "reset_ready" } : { kind: "expired" };
    }
    if (hash.includes("type=email_change")) return { kind: "email_changed" };
    // magic-link or email verification
    const { data } = await supabase.auth.getSession();
    return data.session ? { kind: "verified" } : { kind: "expired" };
  }

  // ── PKCE code exchange ───────────────────────────────────────────
  if (code) {
    const { data, error: exchErr } = await supabase.auth.exchangeCodeForSession(code);
    if (exchErr) {
      const msg = exchErr.message.toLowerCase();
      if (msg.includes("expired") || msg.includes("already been used") || msg.includes("single use")) {
        return { kind: "expired" };
      }
      return { kind: "error", detail: exchErr.message };
    }
    if (!data.session) return { kind: "error" };
    if (type === "recovery")     return { kind: "reset_ready" };
    if (type === "email_change") return { kind: "email_changed" };
    return { kind: "verified" };
  }

  // ── No meaningful params at all ──────────────────────────────────
  return { kind: "invalid" };
}

/* ─── Layout wrapper ─────────────────────────────────────────── */
function Page({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      minHeight: "100vh",
      background: "var(--bg)",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: "24px",
    }}>
      {/* Logo */}
      <Link to="/" style={{
        position: "absolute", top: 24, left: 24,
        display: "flex", alignItems: "center", gap: 8,
        textDecoration: "none", color: "var(--ink-3)",
        fontSize: 14, fontWeight: 500,
        transition: "color 150ms",
      }}>
        <Logo size={20} />
        Bill Reminder
      </Link>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        style={{
          width: "100%",
          maxWidth: 400,
          background: "var(--surface-1)",
          border: "1px solid var(--border)",
          borderRadius: "var(--r-xl)",
          padding: "40px 36px",
          textAlign: "center",
        }}
      >
        {children}
      </motion.div>
    </div>
  );
}

/* ─── Icon component ─────────────────────────────────────────── */
function StatusIcon({ type }: { type: "success" | "warning" | "error" | "info" }) {
  const configs = {
    success: { bg: "rgba(52,211,153,0.1)", border: "rgba(52,211,153,0.22)", color: "#34d399" },
    warning: { bg: "rgba(251,191,36,0.1)",  border: "rgba(251,191,36,0.22)",  color: "#fbbf24" },
    error:   { bg: "rgba(248,113,113,0.1)", border: "rgba(248,113,113,0.22)", color: "#f87171" },
    info:    { bg: "var(--brand-faint)",    border: "var(--brand-border)",    color: "var(--brand)" },
  };
  const c = configs[type];
  return (
    <div style={{
      width: 56, height: 56, borderRadius: 14,
      background: c.bg, border: `1px solid ${c.border}`,
      display: "flex", alignItems: "center", justifyContent: "center",
      margin: "0 auto 20px",
    }}>
      {type === "success" && (
        <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke={c.color} strokeWidth={2.2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
        </svg>
      )}
      {type === "warning" && (
        <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke={c.color} strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
        </svg>
      )}
      {type === "error" && (
        <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke={c.color} strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
        </svg>
      )}
      {type === "info" && (
        <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke={c.color} strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
        </svg>
      )}
    </div>
  );
}

function H({ children }: { children: React.ReactNode }) {
  return <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--ink)", letterSpacing: "-0.02em", marginBottom: 8 }}>{children}</h1>;
}
function Sub({ children }: { children: React.ReactNode }) {
  return <p style={{ fontSize: 14, color: "var(--ink-2)", lineHeight: 1.6, marginBottom: 28, maxWidth: 300, margin: "0 auto 28px" }}>{children}</p>;
}
function Actions({ children }: { children: React.ReactNode }) {
  return <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>{children}</div>;
}

/* ─── State views ────────────────────────────────────────────── */

function Verified() {
  const APP_SCHEME = "bill-reminder";
  return (
    <Page>
      <StatusIcon type="success" />
      <H>Email Verified</H>
      <Sub>Your email has been successfully verified. You can now sign in to Bill Reminder.</Sub>
      <Actions>
        <a href={`${APP_SCHEME}://signin`} className="btn-primary" style={{ justifyContent: "center" }}>
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"/>
          </svg>
          Open App
        </a>
        <Link to="/sign-in" className="btn-outline" style={{ justifyContent: "center" }}>
          Sign in on Web
        </Link>
      </Actions>
      <p style={{ marginTop: 20, fontSize: 12, color: "var(--ink-4)" }}>
        "Open App" launches the Bill Reminder app if installed on this device.
      </p>
    </Page>
  );
}

function ResetReady() {
  const navigate = useNavigate();
  useEffect(() => { navigate("/reset-password", { replace: true }); }, [navigate]);
  return (
    <Page>
      <div className="spinner" style={{ margin: "0 auto 16px" }} />
      <p style={{ color: "var(--ink-3)", fontSize: 14 }}>Redirecting…</p>
    </Page>
  );
}

function EmailChanged() {
  return (
    <Page>
      <StatusIcon type="info" />
      <H>Email Updated</H>
      <Sub>Your email address has been changed successfully. Sign in with your new address going forward.</Sub>
      <Actions>
        <Link to="/sign-in" className="btn-primary" style={{ justifyContent: "center" }}>Sign In</Link>
      </Actions>
    </Page>
  );
}

function AlreadyVerified() {
  return (
    <Page>
      <StatusIcon type="info" />
      <H>Already Verified</H>
      <Sub>This email address has already been confirmed. You can sign in right now.</Sub>
      <Actions>
        <Link to="/sign-in" className="btn-primary" style={{ justifyContent: "center" }}>Sign In</Link>
      </Actions>
    </Page>
  );
}

function Expired() {
  return (
    <Page>
      <StatusIcon type="warning" />
      <H>Link Expired</H>
      <Sub>This verification link has expired or been used already. Links are valid for 24 hours — request a new one below.</Sub>
      <Actions>
        <Link to="/sign-up" className="btn-primary" style={{ justifyContent: "center" }}>Create New Account</Link>
        <Link to="/sign-in" className="btn-outline" style={{ justifyContent: "center" }}>Sign In</Link>
      </Actions>
      <p style={{ marginTop: 20, fontSize: 12, color: "var(--ink-4)" }}>
        If you keep seeing this,{" "}
        <a href="mailto:support@billreminder.app" style={{ color: "var(--ink-3)", textDecoration: "underline" }}>
          contact support
        </a>.
      </p>
    </Page>
  );
}

function Invalid({ detail }: { detail?: string }) {
  return (
    <Page>
      <StatusIcon type="error" />
      <H>Invalid Link</H>
      <Sub>This verification link is malformed or has already been used. Please request a new one.</Sub>
      <Actions>
        <Link to="/sign-up" className="btn-primary" style={{ justifyContent: "center" }}>Create Account</Link>
        <Link to="/sign-in" className="btn-outline" style={{ justifyContent: "center" }}>Sign In</Link>
      </Actions>
      {detail && (
        <p style={{ marginTop: 16, fontSize: 11, color: "var(--ink-4)", fontFamily: "monospace", wordBreak: "break-all" }}>
          {detail}
        </p>
      )}
    </Page>
  );
}

function ErrorState({ detail }: { detail?: string }) {
  return (
    <Page>
      <StatusIcon type="error" />
      <H>Something Went Wrong</H>
      <Sub>We couldn't complete your verification. Please try again or contact support if this persists.</Sub>
      <Actions>
        <Link to="/sign-in" className="btn-primary" style={{ justifyContent: "center" }}>Go to Sign In</Link>
      </Actions>
      {detail && (
        <p style={{ marginTop: 16, fontSize: 11, color: "var(--ink-4)", fontFamily: "monospace", wordBreak: "break-all" }}>
          {detail}
        </p>
      )}
    </Page>
  );
}

function Loading() {
  return (
    <Page>
      <div className="spinner" style={{ margin: "0 auto 16px" }} />
      <p style={{ color: "var(--ink-3)", fontSize: 14 }}>Verifying your link…</p>
    </Page>
  );
}

/* ─── Main export ───────────────────────────────────────────── */
export default function AuthCallback() {
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => { resolve().then(setState); }, []);

  switch (state.kind) {
    case "loading":          return <Loading />;
    case "verified":         return <Verified />;
    case "reset_ready":      return <ResetReady />;
    case "email_changed":    return <EmailChanged />;
    case "already_verified": return <AlreadyVerified />;
    case "expired":          return <Expired />;
    case "invalid":          return <Invalid detail={state.detail} />;
    case "error":            return <ErrorState detail={state.detail} />;
  }
}
