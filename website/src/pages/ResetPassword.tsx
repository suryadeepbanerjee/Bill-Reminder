import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { supabase } from "../lib/supabase";
import { humanize } from "@shared/utils/errors";
import AuthLayout from "../components/layout/AuthLayout";
import { Button } from "../components/ui/Button";
import { TextInput } from "../components/ui/TextInput";

function passwordStrength(pw: string): 0 | 1 | 2 | 3 | 4 {
  let s = 0;
  if (pw.length >= 12) s++;
  if (/[A-Z]/.test(pw)) s++;
  if (/[0-9]/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  return s as 0 | 1 | 2 | 3 | 4;
}

const STRENGTH = [
  { label: "",        color: "bg-border" },
  { label: "Weak",   color: "bg-[#f87171]" },
  { label: "Fair",   color: "bg-[#fbbf24]" },
  { label: "Good",   color: "bg-[#38bdf8]" },
  { label: "Strong", color: "bg-success" },
] as const;

const STRENGTH_TEXT = [
  { label: "",        color: "text-border" },
  { label: "Weak",   color: "text-[#f87171]" },
  { label: "Fair",   color: "text-[#fbbf24]" },
  { label: "Good",   color: "text-[#38bdf8]" },
  { label: "Strong", color: "text-success" },
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
  const metaText = STRENGTH_TEXT[strength];

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
      if (authError) { setError(humanize(authError, "auth")); return; }
      await supabase.auth.signOut();
      // Set the gate token so success.html renders, then redirect
      sessionStorage.setItem("br_auth_verified", "1");
      window.location.replace("/success.html");
      return;
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
        <div className="flex justify-center py-6">
          <div className="w-6 h-6 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
        </div>
      </AuthLayout>
    );
  }

  // No valid session — link expired/invalid
  if (noSession) {
    return (
      <AuthLayout title="Link expired" subtitle="This password reset link is no longer valid">
        <div className="text-center py-2">
          <div className="w-[52px] h-[52px] rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto mb-4 text-amber-500">
            <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
          </div>
          <p className="text-sm text-secondary leading-[1.65] mb-6">
            Reset links expire after 1 hour and can only be used once. Request a new one below.
          </p>
          <div className="flex flex-col gap-2.5">
            <Link to="/forgot-password" className="no-underline block">
              <Button className="w-full justify-center">Request new link</Button>
            </Link>
            <Link to="/sign-in" className="no-underline block">
              <Button variant="secondary" className="w-full justify-center">Back to Sign In</Button>
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
        <div className="text-center py-2">
          <motion.div
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 280, damping: 20 }}
            className="w-[52px] h-[52px] rounded-xl bg-success/10 border border-success/20 flex items-center justify-center mx-auto mb-4 text-success"
          >
            <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
            </svg>
          </motion.div>
          <p className="text-sm text-secondary leading-[1.65] mb-6">
            Your password has been changed. Redirecting to sign in…
          </p>
          <Link to="/sign-in" className="no-underline block">
            <Button className="w-full justify-center">Sign in now</Button>
          </Link>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Set new password" subtitle="Choose a strong password for your account">
      <form onSubmit={handleSubmit} noValidate>
        {error && (
          <div className="flex items-start gap-2.5 p-3 rounded-lg bg-error/10 border border-error/20 text-error text-[13.5px] leading-relaxed mb-4" role="alert">
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} className="shrink-0 mt-0.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
            {error}
          </div>
        )}

        {/* New password */}
        <div className="mb-4">
          <TextInput
            label="New password"
            id="rp-pw"
            type={showPw ? "text" : "password"}
            autoComplete="new-password"
            required
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Minimum 12 characters"
            className="pr-2"
            trailingElement={
              <button
                type="button"
                onClick={() => setShowPw(v => !v)}
                className="bg-transparent border-none cursor-pointer text-secondary/70 hover:text-secondary p-0.5 flex items-center"
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
            }
          />
          {password.length > 0 && (
            <div className="mt-2">
              <div className="flex gap-1 mb-1">
                {[1,2,3,4].map(i => (
                  <div key={i} className={`flex-1 h-[3px] rounded-full transition-colors duration-200 ${i <= strength ? meta.color : "bg-border"}`} />
                ))}
              </div>
              {strength > 0 && <p className={`text-[11px] ${metaText.color}`}>{meta.label}</p>}
            </div>
          )}
        </div>

        {/* Confirm */}
        <div className="mb-6">
          <TextInput
            label="Confirm password"
            id="rp-confirm"
            type={showPw ? "text" : "password"}
            autoComplete="new-password"
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Repeat your password"
            className={`pr-2 ${confirm.length > 0 && confirm !== password ? "border-error focus:ring-error/20" : ""}`}
            trailingElement={
              confirm.length > 0 ? (
                confirm === password ? (
                  <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} className="text-success">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
                  </svg>
                ) : (
                  <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} className="text-error">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
                  </svg>
                )
              ) : null
            }
          />
        </div>

        <Button
          type="submit"
          disabled={loading || password.length < 12 || password !== confirm}
          loading={loading}
          className="w-full justify-center h-11"
        >
          Update password
        </Button>
      </form>
    </AuthLayout>
  );
}
