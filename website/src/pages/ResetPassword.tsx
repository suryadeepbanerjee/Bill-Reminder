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

const strengthMeta = [
  { label: "", color: "" },
  { label: "Weak", color: "#EF4444" },
  { label: "Fair", color: "#F59E0B" },
  { label: "Good", color: "#38BDF8" },
  { label: "Strong", color: "#10B981" },
] as const;

export default function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword]     = useState("");
  const [confirm, setConfirm]       = useState("");
  const [showPw, setShowPw]         = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [loading, setLoading]       = useState(false);
  const [done, setDone]             = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [sessionError, setSessionError] = useState(false);

  const strength = passwordStrength(password);
  const meta     = strengthMeta[strength];

  // Supabase password-reset links come in as hash fragments:
  // /auth/callback#access_token=...&type=recovery
  // The AuthCallback page forwards them here after exchangeCodeForSession.
  // However if the user lands directly we also handle it here.
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setSessionReady(true);
      } else {
        // No active session — the link may have already been consumed or is invalid
        setSessionError(true);
      }
    });
  }, []);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 12) { setError("Password must be at least 12 characters."); return; }
    if (password !== confirm) { setError("Passwords do not match."); return; }

    setLoading(true);
    try {
      const { error: authError } = await supabase.auth.updateUser({ password });
      if (authError) { setError(authError.message); return; }
      setDone(true);
      // Sign out to clear the recovery session; user should sign in fresh
      await supabase.auth.signOut();
      setTimeout(() => navigate("/sign-in"), 3000);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (sessionError) {
    return (
      <AuthLayout title="Link expired" subtitle="This password reset link is no longer valid">
        <div className="text-center py-2">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/15 border border-amber-500/25 flex items-center justify-center mx-auto mb-5">
            <svg className="w-7 h-7 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-sm text-white/50 mb-8 leading-relaxed">
            Password reset links expire after 1 hour and can only be used once. Request a new one to continue.
          </p>
          <div className="space-y-3">
            <Link to="/forgot-password" className="btn-primary w-full justify-center">
              Request new link
            </Link>
            <Link to="/sign-in" className="btn-secondary w-full justify-center">
              Back to Sign In
            </Link>
          </div>
        </div>
      </AuthLayout>
    );
  }

  if (done) {
    return (
      <AuthLayout title="Password changed" subtitle="Your password has been updated successfully">
        <div className="text-center py-2">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            className="w-16 h-16 rounded-2xl bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center mx-auto mb-5"
          >
            <svg className="w-8 h-8 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </motion.div>
          <p className="text-sm text-white/50 mb-6 leading-relaxed">
            Your password has been changed. Redirecting to sign in…
          </p>
          <Link to="/sign-in" className="btn-primary w-full justify-center">
            Sign in now
          </Link>
        </div>
      </AuthLayout>
    );
  }

  if (!sessionReady) {
    return (
      <AuthLayout title="Verifying link…" subtitle="Please wait while we verify your reset link">
        <div className="flex justify-center py-8">
          <svg className="w-8 h-8 text-accent-400 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Set new password" subtitle="Choose a strong password for your account">
      <form onSubmit={handleReset} noValidate>
        <div className="space-y-4">
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-start gap-2.5 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/25"
            >
              <svg className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm text-red-300">{error}</p>
            </motion.div>
          )}

          {/* New password */}
          <div>
            <label htmlFor="reset-password" className="block text-sm font-medium text-white/60 mb-1.5">
              New password
            </label>
            <div className="relative">
              <input
                id="reset-password"
                type={showPw ? "text" : "password"}
                autoComplete="new-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="auth-input pr-11"
                placeholder="Minimum 12 characters"
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors p-1"
                aria-label={showPw ? "Hide password" : "Show password"}
              >
                {showPw ? (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>
            {password.length > 0 && (
              <div className="mt-2">
                <div className="flex gap-1 mb-1">
                  {[1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className="flex-1 h-1 rounded-full transition-all duration-300"
                      style={{ background: i <= strength ? meta.color : "rgba(255,255,255,0.08)" }}
                    />
                  ))}
                </div>
                {strength > 0 && (
                  <p className="text-xs" style={{ color: meta.color }}>{meta.label}</p>
                )}
              </div>
            )}
          </div>

          {/* Confirm */}
          <div>
            <label htmlFor="reset-confirm" className="block text-sm font-medium text-white/60 mb-1.5">
              Confirm password
            </label>
            <div className="relative">
              <input
                id="reset-confirm"
                type={showPw ? "text" : "password"}
                autoComplete="new-password"
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className={`auth-input ${
                  confirm.length > 0 && confirm !== password ? "border-red-500/50" : ""
                }`}
                placeholder="Repeat your password"
              />
              {confirm.length > 0 && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  {confirm === password ? (
                    <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  )}
                </div>
              )}
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || password !== confirm || password.length < 12}
            className="btn-primary w-full justify-center mt-2"
          >
            {loading ? (
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : null}
            {loading ? "Updating…" : "Update password"}
          </button>
        </div>
      </form>
    </AuthLayout>
  );
}
