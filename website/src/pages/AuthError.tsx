import { Link, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import Logo from "../components/ui/Logo";

/*
 * AuthError — premium authentication error page.
 *
 * Receives a `reason` query param from AuthCallback:
 *   • expired      — link has expired or been used already
 *   • invalid      — link is malformed
 *   • already_verified — already confirmed (treated as success, shouldn't land here)
 *   • error        — unexpected/generic failure
 */

type Reason = "expired" | "invalid" | "already_verified" | "error";

interface Config {
  icon: React.ReactNode;
  color: string;
  bg: string;
  border: string;
  heading: string;
  body: string;
  primaryLabel: string;
  primaryHref: string;
  secondaryLabel?: string;
  secondaryHref?: string;
}

const configs: Record<Reason, Config> = {
  expired: {
    icon: (
      <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="#fbbf24" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
      </svg>
    ),
    color: "#fbbf24",
    bg: "rgba(251,191,36,0.08)",
    border: "rgba(251,191,36,0.22)",
    heading: "Link expired",
    body: "This verification link has expired or has already been used. Links are valid for 24 hours — request a new one below.",
    primaryLabel: "Sign in",
    primaryHref: "/sign-in",
    secondaryLabel: "Create account",
    secondaryHref: "/sign-up",
  },
  invalid: {
    icon: (
      <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="#f87171" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
      </svg>
    ),
    color: "#f87171",
    bg: "rgba(248,113,113,0.08)",
    border: "rgba(248,113,113,0.22)",
    heading: "Invalid link",
    body: "This verification link is malformed or has already been used. Please request a new one from the sign-in page.",
    primaryLabel: "Go to sign in",
    primaryHref: "/sign-in",
    secondaryLabel: "Create account",
    secondaryHref: "/sign-up",
  },
  already_verified: {
    icon: (
      <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="#34d399" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
      </svg>
    ),
    color: "#34d399",
    bg: "rgba(52,211,153,0.08)",
    border: "rgba(52,211,153,0.22)",
    heading: "Already verified",
    body: "This email address has already been confirmed. You can sign in right now.",
    primaryLabel: "Sign in",
    primaryHref: "/sign-in",
  },
  error: {
    icon: (
      <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="#f87171" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
      </svg>
    ),
    color: "#f87171",
    bg: "rgba(248,113,113,0.08)",
    border: "rgba(248,113,113,0.22)",
    heading: "Verification failed",
    body: "We couldn't complete your verification. This can happen with expired or malformed links. Please try again from the sign-in page.",
    primaryLabel: "Go to sign in",
    primaryHref: "/sign-in",
    secondaryLabel: "Return home",
    secondaryHref: "/",
  },
};

function isValidReason(r: string | null): r is Reason {
  return r === "expired" || r === "invalid" || r === "already_verified" || r === "error";
}

export default function AuthError() {
  const [params] = useSearchParams();
  const rawReason = params.get("reason");
  const reason: Reason = isValidReason(rawReason) ? rawReason : "error";
  const cfg = configs[reason];

  return (
    <div style={{
      minHeight: "100vh",
      background: "var(--bg)",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: "24px",
      position: "relative",
    }}>
      {/* Ambient glow */}
      <div style={{
        position: "fixed",
        top: 0, left: 0, right: 0,
        height: "60vh",
        background: "radial-gradient(ellipse 70% 50% at 50% 0%, rgba(255,255,255,0.04) 0%, transparent 70%)",
        pointerEvents: "none",
        zIndex: 0,
      }} />

      {/* Brand */}
      <Link to="/" style={{
        position: "fixed", top: 24, left: 24, zIndex: 2,
        display: "flex", alignItems: "center", gap: 8,
        textDecoration: "none", color: "var(--ink-3)",
        fontSize: 14, fontWeight: 500,
        transition: "color 150ms",
      }}>
        <Logo size={20} />
        Bill Reminder
      </Link>

      {/* Card */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        style={{
          width: "100%",
          maxWidth: 400,
          background: "var(--surface-1)",
          border: "1px solid var(--border)",
          borderRadius: "var(--r-xl)",
          padding: "44px 36px 36px",
          textAlign: "center",
          position: "relative",
          zIndex: 1,
        }}
      >
        {/* Icon */}
        <div style={{
          width: 56, height: 56,
          borderRadius: 14,
          background: cfg.bg,
          border: `1px solid ${cfg.border}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          margin: "0 auto 24px",
        }}>
          {cfg.icon}
        </div>

        {/* Heading */}
        <h1 style={{
          fontSize: 22,
          fontWeight: 700,
          color: "var(--ink)",
          letterSpacing: "-0.02em",
          marginBottom: 10,
        }}>
          {cfg.heading}
        </h1>

        {/* Body */}
        <p style={{
          fontSize: 14,
          color: "var(--ink-2)",
          lineHeight: 1.65,
          maxWidth: 300,
          margin: "0 auto 30px",
        }}>
          {cfg.body}
        </p>

        {/* Actions */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <Link to={cfg.primaryHref} className="btn-primary" style={{ justifyContent: "center" }}>
            {cfg.primaryLabel}
          </Link>
          {cfg.secondaryLabel && cfg.secondaryHref && (
            <Link to={cfg.secondaryHref} className="btn-outline" style={{ justifyContent: "center" }}>
              {cfg.secondaryLabel}
            </Link>
          )}
          {reason !== "already_verified" && (
            <Link to="/" className="btn-ghost" style={{ justifyContent: "center", marginTop: 4 }}>
              Return home
            </Link>
          )}
        </div>

        {/* Footnote */}
        <p style={{
          marginTop: 24,
          fontSize: 12,
          color: "var(--ink-4)",
          lineHeight: 1.6,
        }}>
          If you keep seeing this,{" "}
          <a
            href="mailto:support@billreminder.app"
            style={{ color: "var(--ink-3)", textDecoration: "underline" }}
          >
            contact support
          </a>.
        </p>
      </motion.div>
    </div>
  );
}
