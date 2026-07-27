import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { supabase } from "../lib/supabase";
import AuthLayout from "../components/layout/AuthLayout";

export default function ForgotPassword() {
  const [email, setEmail]     = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [sent, setSent]       = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Please enter a valid email address.");
      return;
    }
    setLoading(true);
    try {
      const { error: authError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/callback`,
      });
      if (authError) { setError(authError.message); return; }
      setSent(true);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <AuthLayout title="Check your email" subtitle="We sent a password reset link">
        <div style={{ textAlign: "center", padding: "8px 0" }}>
          <motion.div
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 280, damping: 20 }}
            style={{
              width: 52, height: 52, borderRadius: 14,
              background: "rgba(52,211,153,0.1)", border: "1px solid rgba(52,211,153,0.22)",
              display: "flex", alignItems: "center", justifyContent: "center",
              margin: "0 auto 16px",
            }}
          >
            <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="#34d399" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
            </svg>
          </motion.div>
          <p style={{ fontSize: 14, color: "var(--ink-2)", lineHeight: 1.65, marginBottom: 8 }}>
            We've sent a reset link to <strong style={{ color: "var(--ink)" }}>{email}</strong>.
          </p>
          <p style={{ fontSize: 12, color: "var(--ink-3)", marginBottom: 28 }}>
            The link is valid for 1 hour. Check your spam folder if it doesn't arrive.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <Link to="/sign-in" className="btn-primary" style={{ justifyContent: "center" }}>
              Back to Sign In
            </Link>
            <button
              onClick={() => { setSent(false); setEmail(""); }}
              className="btn-ghost"
              style={{ width: "100%", justifyContent: "center", color: "var(--ink-3)" }}
            >
              Try a different email
            </button>
          </div>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Forgot your password?" subtitle="Enter your email and we'll send a reset link">
      <form onSubmit={handleSubmit} noValidate>
        {error && (
          <div className="alert alert-error" style={{ marginBottom: 16 }} role="alert">
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} style={{ flexShrink: 0 }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
            {error}
          </div>
        )}

        <div style={{ marginBottom: 20 }}>
          <label htmlFor="fp-email" style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--ink-2)", marginBottom: 6 }}>
            Email address
          </label>
          <input
            id="fp-email" type="email" autoComplete="email" required autoFocus
            value={email} onChange={e => setEmail(e.target.value)}
            className="auth-input" placeholder="your@email.com"
          />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <button type="submit" disabled={loading} className="btn-primary" style={{ justifyContent: "center" }}>
            {loading && <div className="spinner" />}
            {loading ? "Sending…" : "Send reset link"}
          </button>
          <Link to="/sign-in" className="btn-outline" style={{ justifyContent: "center" }}>
            ← Back to Sign In
          </Link>
        </div>
      </form>
    </AuthLayout>
  );
}
