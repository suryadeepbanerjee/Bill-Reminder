import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { supabase } from "../lib/supabase";
import AuthLayout from "../components/layout/AuthLayout";

function passwordStrength(pw: string): 0 | 1 | 2 | 3 | 4 {
  let score = 0;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  return score as 0 | 1 | 2 | 3 | 4;
}

const strengthMeta = [
  { label: "", color: "" },
  { label: "Weak", color: "#EF4444" },
  { label: "Fair", color: "#F59E0B" },
  { label: "Good", color: "#38BDF8" },
  { label: "Strong", color: "#10B981" },
] as const;

export default function SignUp() {
  const navigate  = useNavigate();
  const [name, setName]       = useState("");
  const [email, setEmail]     = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw]   = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent]       = useState(false);

  const strength = passwordStrength(password);
  const meta     = strengthMeta[strength];

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) { setError("Please enter your name."); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setError("Please enter a valid email address."); return; }
    if (password.length < 12) { setError("Password must be at least 12 characters."); return; }

    setLoading(true);
    try {
      const { data, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { display_name: name.trim() },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (authError) {
        // Map common Supabase errors to friendly messages
        if (authError.message.toLowerCase().includes("rate limit")) {
          setError("Too many sign-up attempts. Please wait a few minutes and try again.");
        } else {
          setError(authError.message);
        }
        return;
      }

      // Detect duplicate user — Supabase returns empty identities array for existing users
      if (data.user && data.user.identities && data.user.identities.length === 0) {
        setError("An account with this email already exists. Please sign in instead.");
        return;
      }

      setSent(true);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <AuthLayout title="Check your inbox" subtitle={`We sent a verification link to ${email}`}>
        <div className="text-center py-2">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            className="w-16 h-16 rounded-2xl bg-accent-500/15 border border-accent-500/25 flex items-center justify-center mx-auto mb-5"
          >
            <svg className="w-8 h-8 text-accent-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </motion.div>
          <p className="text-sm text-white/50 mb-2 leading-relaxed">
            Open the email and tap the verification link to activate your account.
          </p>
          <p className="text-xs text-white/30 mb-8">
            Can't find it? Check your spam folder. The link expires in 24 hours.
          </p>
          <div className="space-y-3">
            <Link to="/sign-in" className="btn-primary w-full justify-center">
              Go to Sign In
            </Link>
            <button onClick={() => setSent(false)} className="btn-secondary w-full justify-center">
              Use a different email
            </button>
          </div>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Create your account" subtitle="Start tracking your bills and never miss a payment">
      <form onSubmit={handleSignUp} noValidate>
        <div className="space-y-4">
          {/* Error */}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-start gap-2.5 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/25"
            >
              <svg className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <p className="text-sm text-red-300">{error}</p>
                {error.includes("already exists") && (
                  <div className="flex gap-3 mt-2">
                    <Link to="/sign-in" className="text-xs text-accent-400 hover:text-accent-300 font-medium">
                      Sign in →
                    </Link>
                    <Link to="/forgot-password" className="text-xs text-white/40 hover:text-white/60">
                      Forgot password?
                    </Link>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* Name */}
          <div>
            <label htmlFor="signup-name" className="block text-sm font-medium text-white/60 mb-1.5">
              Your name
            </label>
            <input
              id="signup-name"
              type="text"
              autoComplete="name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="auth-input"
              placeholder="How should we call you?"
              maxLength={50}
            />
          </div>

          {/* Email */}
          <div>
            <label htmlFor="signup-email" className="block text-sm font-medium text-white/60 mb-1.5">
              Email
            </label>
            <input
              id="signup-email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="auth-input"
              placeholder="your@email.com"
            />
          </div>

          {/* Password + strength */}
          <div>
            <label htmlFor="signup-password" className="block text-sm font-medium text-white/60 mb-1.5">
              Password
            </label>
            <div className="relative">
              <input
                id="signup-password"
                type={showPw ? "text" : "password"}
                autoComplete="new-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="auth-input pr-11"
                placeholder="Minimum 12 characters"
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
            {/* Strength bar */}
            {password.length > 0 && (
              <div className="mt-2">
                <div className="flex gap-1 mb-1">
                  {[1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className="flex-1 h-1 rounded-full transition-all duration-300"
                      style={{
                        background: i <= strength ? meta.color : "rgba(255,255,255,0.08)",
                      }}
                    />
                  ))}
                </div>
                {strength > 0 && (
                  <p className="text-xs" style={{ color: meta.color }}>
                    {meta.label}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Terms */}
          <p className="text-xs text-white/30 leading-relaxed">
            By creating an account you agree to our{" "}
            <Link to="/terms" className="text-white/50 hover:text-white/80 underline underline-offset-2">
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link to="/privacy" className="text-white/50 hover:text-white/80 underline underline-offset-2">
              Privacy Policy
            </Link>
            .
          </p>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full justify-center"
          >
            {loading ? (
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : null}
            {loading ? "Creating account…" : "Create account"}
          </button>
        </div>
      </form>

      <p className="text-center text-sm text-white/35 mt-8">
        Already have an account?{" "}
        <Link to="/sign-in" className="text-accent-400 hover:text-accent-300 font-medium transition-colors">
          Sign in
        </Link>
      </p>
    </AuthLayout>
  );
}
