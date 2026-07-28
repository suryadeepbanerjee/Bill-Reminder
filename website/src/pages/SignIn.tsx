import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "../lib/supabase";
import AuthLayout from "../components/layout/AuthLayout";

/** Google 'G' icon — official brand colours */
function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z" fill="#34A853"/>
      <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58Z" fill="#EA4335"/>
    </svg>
  );
}

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

function ErrorAlert({ message }: { message: string }) {
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
        <span>{message}</span>
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
  const [googleLoading, setGoogleLoading] = useState(false);
  const anyLoading = loading || googleLoading;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { error: err } = await supabase.auth.signInWithPassword({ email, password });
      if (err) {
        const msg = err.message.toLowerCase();
        if (msg.includes("invalid login") || msg.includes("invalid credentials")) {
          setError("Incorrect email or password.");
        } else if (msg.includes("email not confirmed")) {
          setError("Please verify your email first. Check your inbox.");
        } else {
          setError(err.message);
        }
        return;
      }
      navigate("/");
    } catch { setError("Something went wrong. Please try again."); }
    finally { setLoading(false); }
  };

  const handleGoogle = async () => {
    setError(null);
    setGoogleLoading(true);
    try {
      // Browser handles the full redirect: Google → Supabase → /auth/callback → /
      await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/auth/callback` },
      });
      // Page navigates away — no further action needed
    } catch {
      setError("Could not start Google sign-in. Please try again.");
      setGoogleLoading(false);
    }
  };

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

        <button type="submit" disabled={anyLoading} className="btn-primary" style={{ width: "100%", justifyContent: "center", marginTop: 4 }}>
          {loading && <div className="spinner" />}
          {loading ? "Signing in…" : "Sign in"}
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "20px 0" }}>
          <div className="divider" style={{ flex: 1 }} />
          <span style={{ fontSize: 12, color: "var(--ink-3)" }}>or</span>
          <div className="divider" style={{ flex: 1 }} />
        </div>

        {/* Google OAuth */}
        <button
          type="button"
          disabled={anyLoading}
          onClick={handleGoogle}
          className="btn-outline"
          style={{ width: "100%", justifyContent: "center", gap: 10 }}
        >
          {googleLoading ? <div className="spinner" style={{ borderTopColor: "#EA4335" }} /> : <GoogleIcon />}
          {googleLoading ? "Redirecting…" : "Continue with Google"}
        </button>

        {/* OTP code — separate page */}
        <Link
          to="/sign-in-code"
          className="btn-ghost"
          style={{ width: "100%", justifyContent: "center", display: "flex", gap: 8 }}
        >
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"/>
          </svg>
          Sign in with code
        </Link>
      </form>

      <p style={{ textAlign: "center", fontSize: 13, color: "var(--ink-3)", marginTop: 24 }}>
        Don't have an account?{" "}
        <Link to="/sign-up" style={{ color: "var(--brand)", textDecoration: "none", fontWeight: 500 }}>Sign up</Link>
      </p>
    </AuthLayout>
  );
}
