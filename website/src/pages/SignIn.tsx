import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "../lib/supabase";
import AuthLayout from "../components/layout/AuthLayout";

function Field({ label, id, children }: { label: string; id: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label htmlFor={id} style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--ink-2)", marginBottom: 6 }}>
        {label}
      </label>
      {children}
    </div>
  );
}

function ErrorAlert({ message, actions }: { message: string; actions?: React.ReactNode }) {
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -8, height: 0 }}
        animate={{ opacity: 1, y: 0, height: "auto" }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="alert alert-error"
        style={{ marginBottom: 16 }}
        role="alert"
      >
        <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} style={{ flexShrink: 0, marginTop: 1 }}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
        </svg>
        <div>
          <span>{message}</span>
          {actions && <div style={{ marginTop: 8, display: "flex", gap: 12 }}>{actions}</div>}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

export default function SignIn() {
  const navigate = useNavigate();
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw]     = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [loading, setLoading]   = useState(false);
  const [magic, setMagic]       = useState(false);
  const [magicLoading, setMagicLoading] = useState(false);

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { error: err } = await supabase.auth.signInWithPassword({ email, password });
      if (err) {
        if (err.message.toLowerCase().includes("invalid login") || err.message.toLowerCase().includes("invalid credentials")) {
          setError("Incorrect email or password.");
        } else if (err.message.toLowerCase().includes("email not confirmed")) {
          setError("Please verify your email first. Check your inbox for the verification link.");
        } else {
          setError(err.message);
        }
        return;
      }
      navigate("/");
    } catch { setError("Something went wrong. Please try again."); }
    finally { setLoading(false); }
  };

  const handleMagicLink = async () => {
    if (!emailValid) { setError("Enter a valid email address first."); return; }
    setError(null); setMagicLoading(true);
    try {
      const { error: err } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      });
      if (err) { setError(err.message); return; }
      setMagic(true);
    } catch { setError("Something went wrong. Please try again."); }
    finally { setMagicLoading(false); }
  };

  if (magic) {
    return (
      <AuthLayout title="Check your inbox" subtitle={`We sent a sign-in link to ${email}`}>
        <div style={{ textAlign: "center", padding: "8px 0" }}>
          <div style={{
            width: 52, height: 52, borderRadius: 14,
            background: "var(--brand-faint)", border: "1px solid var(--brand-border)",
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 16px", color: "var(--brand)",
          }}>
            <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
            </svg>
          </div>
          <p style={{ fontSize: 14, color: "var(--ink-2)", lineHeight: 1.6, marginBottom: 24 }}>
            Tap the link in the email to sign in instantly. The link expires in 1 hour.
          </p>
          <button onClick={() => setMagic(false)} className="btn-outline" style={{ width: "100%", justifyContent: "center" }}>
            Use password instead
          </button>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Welcome back" subtitle="Sign in to continue tracking your bills">
      <form onSubmit={handleSubmit} noValidate>
        {error && <ErrorAlert message={error} />}

        <Field label="Email" id="si-email">
          <input
            id="si-email" type="email" autoComplete="email" required
            value={email} onChange={e => setEmail(e.target.value)}
            className="auth-input" placeholder="your@email.com"
          />
        </Field>

        <Field label="Password" id="si-password">
          <div style={{ position: "relative" }}>
            <input
              id="si-password" type={showPw ? "text" : "password"} autoComplete="current-password" required
              value={password} onChange={e => setPassword(e.target.value)}
              className="auth-input" placeholder="Your password"
              style={{ paddingRight: 40 }}
            />
            <button type="button" onClick={() => setShowPw(v => !v)}
              style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "var(--ink-3)", padding: 2 }}
              aria-label={showPw ? "Hide password" : "Show password"}
            >
              {showPw ? (
                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"/>
                </svg>
              ) : (
                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                </svg>
              )}
            </button>
          </div>
          <div style={{ textAlign: "right", marginTop: 6 }}>
            <Link to="/forgot-password" style={{ fontSize: 12, color: "var(--brand)", textDecoration: "none" }}>
              Forgot password?
            </Link>
          </div>
        </Field>

        <button type="submit" disabled={loading} className="btn-primary" style={{ width: "100%", justifyContent: "center", marginTop: 4 }}>
          {loading && <div className="spinner" />}
          {loading ? "Signing in…" : "Sign in"}
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "20px 0" }}>
          <div className="divider" style={{ flex: 1 }} />
          <span style={{ fontSize: 12, color: "var(--ink-3)" }}>or</span>
          <div className="divider" style={{ flex: 1 }} />
        </div>

        <button type="button" disabled={magicLoading} onClick={handleMagicLink} className="btn-outline" style={{ width: "100%", justifyContent: "center" }}>
          {magicLoading ? <div className="spinner" style={{ borderTopColor: "var(--brand)" }} /> : (
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
            </svg>
          )}
          {magicLoading ? "Sending…" : "Send magic link"}
        </button>
      </form>

      <p style={{ textAlign: "center", fontSize: 13, color: "var(--ink-3)", marginTop: 24 }}>
        Don't have an account?{" "}
        <Link to="/sign-up" style={{ color: "var(--brand)", textDecoration: "none", fontWeight: 500 }}>Sign up</Link>
      </p>
    </AuthLayout>
  );
}
