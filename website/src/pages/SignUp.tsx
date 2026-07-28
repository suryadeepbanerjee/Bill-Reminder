import { useState } from "react";
import { Link } from "react-router-dom";
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

function passwordStrength(pw: string): 0 | 1 | 2 | 3 | 4 {
  let s = 0;
  if (pw.length >= 12) s++;
  if (/[A-Z]/.test(pw)) s++;
  if (/[0-9]/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  return s as 0 | 1 | 2 | 3 | 4;
}

const STRENGTH = [
  { label: "",        color: "var(--border)" },
  { label: "Weak",   color: "#f87171" },
  { label: "Fair",   color: "#fbbf24" },
  { label: "Good",   color: "#38bdf8" },
  { label: "Strong", color: "#34d399" },
] as const;

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

export default function SignUp() {
  const [name, setName]         = useState("");
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw]     = useState(false);
  const [error, setError]       = useState<{ msg: string; isDuplicate?: boolean } | null>(null);
  const [loading, setLoading]   = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [sent, setSent]         = useState(false);

  const anyLoading = loading || googleLoading;

  const strength = passwordStrength(password);
  const meta     = STRENGTH[strength];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim())           { setError({ msg: "Please enter your name." }); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setError({ msg: "Please enter a valid email address." }); return; }
    if (password.length < 12)   { setError({ msg: "Password must be at least 12 characters." }); return; }

    setLoading(true);
    try {
      const { data, error: authError } = await supabase.auth.signUp({
        email, password,
        options: {
          data: { display_name: name.trim() },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (authError) {
        if (authError.message.toLowerCase().includes("rate limit")) {
          setError({ msg: "Too many sign-up attempts. Please wait a few minutes and try again." });
        } else {
          setError({ msg: authError.message });
        }
        return;
      }

      // Supabase signals a duplicate account by returning a user with empty identities
      if (data.user?.identities?.length === 0) {
        setError({
          msg: "An account with this email already exists.",
          isDuplicate: true,
        });
        return;
      }

      setSent(true);
    } catch (e: any) {
      setError({ msg: e.message || "An error occurred." });
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setError(null);
    setGoogleLoading(true);
    try {
      await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/auth/callback` },
      });
    } catch {
      setError({ msg: "Could not start Google sign-up. Please try again." });
      setGoogleLoading(false);
    }
  };

  if (sent) {
    return (
      <AuthLayout title="Check your inbox" subtitle={`We sent a verification link to ${email}`}>
        <div style={{ textAlign: "center", padding: "8px 0" }}>
          <motion.div
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 280, damping: 20 }}
            style={{
              width: 52, height: 52, borderRadius: 14,
              background: "var(--brand-faint)", border: "1px solid var(--brand-border)",
              display: "flex", alignItems: "center", justifyContent: "center",
              margin: "0 auto 16px", color: "var(--brand)",
            }}
          >
            <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
            </svg>
          </motion.div>
          <p style={{ fontSize: 14, color: "var(--ink-2)", lineHeight: 1.65, marginBottom: 8 }}>
            Open the email and tap the verification link to activate your account.
          </p>
          <p style={{ fontSize: 12, color: "var(--ink-3)", marginBottom: 24 }}>
            Can't find it? Check your spam folder. The link expires in 24 hours.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <Link to="/sign-in" className="btn-primary" style={{ justifyContent: "center" }}>
              Go to Sign In
            </Link>
            <button onClick={() => { setSent(false); setEmail(""); }} className="btn-outline" style={{ width: "100%", justifyContent: "center" }}>
              Use a different email
            </button>
          </div>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Create your account" subtitle="Start tracking bills and never miss a payment">
      <form onSubmit={handleSubmit} noValidate>
        {/* Error */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -8, height: 0 }}
              animate={{ opacity: 1, y: 0, height: "auto" }}
              exit={{ opacity: 0 }}
              className="alert alert-error"
              style={{ marginBottom: 16 }}
              role="alert"
            >
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} style={{ flexShrink: 0, marginTop: 1 }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
              <div>
                <span>{error.msg}</span>
                {/* Contextual actions for duplicate account */}
                {error.isDuplicate && (
                  <div style={{ marginTop: 10, display: "flex", gap: 12 }}>
                    <Link to="/sign-in" className="btn-primary" style={{ padding: "6px 14px", fontSize: 13 }}>
                      Sign In
                    </Link>
                    <Link to="/forgot-password" className="btn-outline" style={{ padding: "5px 14px", fontSize: 13 }}>
                      Forgot Password?
                    </Link>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Name */}
        <Field label="Your name" id="su-name">
          <input
            id="su-name" type="text" autoComplete="name" required
            value={name} onChange={e => setName(e.target.value)}
            className="auth-input" placeholder="How should we call you?"
            maxLength={50}
          />
        </Field>

        {/* Email */}
        <Field label="Email" id="su-email">
          <input
            id="su-email" type="email" autoComplete="email" required
            value={email} onChange={e => setEmail(e.target.value)}
            className="auth-input" placeholder="your@email.com"
          />
        </Field>

        {/* Password */}
        <Field label="Password" id="su-password">
          <div style={{ position: "relative" }}>
            <input
              id="su-password" type={showPw ? "text" : "password"} autoComplete="new-password" required
              value={password} onChange={e => setPassword(e.target.value)}
              className="auth-input" placeholder="Minimum 12 characters"
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
          {/* Strength meter */}
          {password.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <div style={{ display: "flex", gap: 4, marginBottom: 4 }}>
                {[1,2,3,4].map(i => (
                  <div key={i} style={{
                    flex: 1, height: 3, borderRadius: 99,
                    background: i <= strength ? meta.color : "var(--border)",
                    transition: "background 200ms",
                  }} />
                ))}
              </div>
              {strength > 0 && (
                <p style={{ fontSize: 11, color: meta.color }}>{meta.label}</p>
              )}
            </div>
          )}
        </Field>

        {/* Terms */}
        <p style={{ fontSize: 12, color: "var(--ink-3)", lineHeight: 1.6, marginBottom: 20 }}>
          By creating an account you agree to our{" "}
          <Link to="/terms" style={{ color: "var(--ink-2)", textDecoration: "underline", textUnderlineOffset: 3 }}>Terms</Link>
          {" "}and{" "}
          <Link to="/privacy" style={{ color: "var(--ink-2)", textDecoration: "underline", textUnderlineOffset: 3 }}>Privacy Policy</Link>.
        </p>

        <button type="submit" disabled={anyLoading} className="btn-primary" style={{ width: "100%", justifyContent: "center" }}>
          {loading && <div className="spinner" />}
          {loading ? "Creating account…" : "Create account"}
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
      </form>

      <p style={{ textAlign: "center", fontSize: 13, color: "var(--ink-3)", marginTop: 24 }}>
        Already have an account?{" "}
        <Link to="/sign-in" style={{ color: "var(--brand)", textDecoration: "none", fontWeight: 500 }}>Sign in</Link>
      </p>
    </AuthLayout>
  );
}
