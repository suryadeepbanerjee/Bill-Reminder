import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { supabase } from "../lib/supabase";
import AuthLayout from "../components/layout/AuthLayout";

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

export default function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword]   = useState("");
  const [confirm, setConfirm]     = useState("");
  const [showPw, setShowPw]       = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [loading, setLoading]     = useState(false);
  const [done, setDone]           = useState(false);
  const [checking, setChecking]   = useState(true);
  const [noSession, setNoSession] = useState(false);

  const strength = passwordStrength(password);
  const meta     = STRENGTH[strength];

  // Verify there's an active session from the reset link
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) setNoSession(true);
      setChecking(false);
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 12) { setError("Password must be at least 12 characters."); return; }
    if (password !== confirm)  { setError("Passwords do not match."); return; }

    setLoading(true);
    try {
      const { error: authError } = await supabase.auth.updateUser({ password });
      if (authError) { setError(authError.message); return; }
      setDone(true);
      await supabase.auth.signOut();
      setTimeout(() => navigate("/sign-in"), 3000);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Loading session check
  if (checking) {
    return (
      <AuthLayout title="Verifying link…" subtitle="Please wait a moment">
        <div style={{ display: "flex", justifyContent: "center", padding: "24px 0" }}>
          <div className="spinner" style={{ width: 24, height: 24, borderWidth: 2 }} />
        </div>
      </AuthLayout>
    );
  }

  // No valid session — link expired/invalid
  if (noSession) {
    return (
      <AuthLayout title="Link expired" subtitle="This password reset link is no longer valid">
        <div style={{ textAlign: "center", padding: "8px 0" }}>
          <div style={{
            width: 52, height: 52, borderRadius: 14,
            background: "rgba(251,191,36,0.1)", border: "1px solid rgba(251,191,36,0.22)",
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 16px",
          }}>
            <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="#fbbf24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
          </div>
          <p style={{ fontSize: 14, color: "var(--ink-2)", lineHeight: 1.65, marginBottom: 24 }}>
            Reset links expire after 1 hour and can only be used once. Request a new one below.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <Link to="/forgot-password" className="btn-primary" style={{ justifyContent: "center" }}>
              Request new link
            </Link>
            <Link to="/sign-in" className="btn-outline" style={{ justifyContent: "center" }}>
              Back to Sign In
            </Link>
          </div>
        </div>
      </AuthLayout>
    );
  }

  // Success
  if (done) {
    return (
      <AuthLayout title="Password changed" subtitle="Your password has been updated successfully">
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
          <p style={{ fontSize: 14, color: "var(--ink-2)", lineHeight: 1.65, marginBottom: 24 }}>
            Your password has been changed. Redirecting to sign in…
          </p>
          <Link to="/sign-in" className="btn-primary" style={{ justifyContent: "center" }}>
            Sign in now
          </Link>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Set new password" subtitle="Choose a strong password for your account">
      <form onSubmit={handleSubmit} noValidate>
        {error && (
          <div className="alert alert-error" style={{ marginBottom: 16 }} role="alert">
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} style={{ flexShrink: 0 }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
            {error}
          </div>
        )}

        {/* New password */}
        <div style={{ marginBottom: 16 }}>
          <label htmlFor="rp-pw" style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--ink-2)", marginBottom: 6 }}>
            New password
          </label>
          <div style={{ position: "relative" }}>
            <input
              id="rp-pw" type={showPw ? "text" : "password"} autoComplete="new-password" required autoFocus
              value={password} onChange={e => setPassword(e.target.value)}
              className="auth-input" placeholder="Minimum 12 characters"
              style={{ paddingRight: 40 }}
            />
            <button type="button" onClick={() => setShowPw(v => !v)}
              style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "var(--ink-3)", padding: 2 }}
              aria-label={showPw ? "Hide" : "Show"}
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
              {strength > 0 && <p style={{ fontSize: 11, color: meta.color }}>{meta.label}</p>}
            </div>
          )}
        </div>

        {/* Confirm */}
        <div style={{ marginBottom: 24 }}>
          <label htmlFor="rp-confirm" style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--ink-2)", marginBottom: 6 }}>
            Confirm password
          </label>
          <div style={{ position: "relative" }}>
            <input
              id="rp-confirm" type={showPw ? "text" : "password"} autoComplete="new-password" required
              value={confirm} onChange={e => setConfirm(e.target.value)}
              className={`auth-input ${confirm.length > 0 && confirm !== password ? "error" : ""}`}
              placeholder="Repeat your password"
              style={{ paddingRight: 40 }}
            />
            {confirm.length > 0 && (
              <div style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)" }}>
                {confirm === password ? (
                  <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="#34d399" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
                  </svg>
                ) : (
                  <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="#f87171" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
                  </svg>
                )}
              </div>
            )}
          </div>
        </div>

        <button
          type="submit"
          disabled={loading || password.length < 12 || password !== confirm}
          className="btn-primary"
          style={{ width: "100%", justifyContent: "center" }}
        >
          {loading && <div className="spinner" />}
          {loading ? "Updating…" : "Update password"}
        </button>
      </form>
    </AuthLayout>
  );
}
