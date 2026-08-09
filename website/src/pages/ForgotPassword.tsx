import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { supabase } from "../lib/supabase";
import { withCaptcha } from "../lib/captcha";
import { humanize } from "@shared/utils/errors";
import AuthLayout from "../components/layout/AuthLayout";
import { Button } from "../components/ui/Button";
import { TextInput } from "../components/ui/TextInput";

type Step = "request" | "verify" | "done";

export default function ForgotPassword() {
  const [email, setEmail]          = useState("");
  const [loading, setLoading]      = useState(false);
  const [error, setError]          = useState<string | null>(null);
  const [step, setStep]            = useState<Step>("request");

  const [otp, setOtp]              = useState("");
  const [password, setPassword]    = useState("");
  const [confirm, setConfirm]      = useState("");

  const [otpVerified, setOtpVerified] = useState(false);

  const sendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Please enter a valid email address.");
      return;
    }
    setStep("request");
    const prev = step;
    try {
      // No account-existence pre-check: GoTrue always returns 200 for unknown
      // emails, and it avoids an enumeration surface (same as the app).
      const { error: authError } = await withCaptcha("recover", (o) =>
        supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/auth/callback`,
          ...o,
        })
      );
      if (authError) { setError(humanize(authError, "auth")); return; }
      setStep("verify");
    } catch {
      setStep(prev);
      setError("Something went wrong. Please try again.");
    }
  };

  const resetWithOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!otp || otp.length < 6) { setError("Please enter a valid 6-digit code."); return; }
    if (!password || password.length < 8) { setError("Password must be at least 8 characters."); return; }
    if (password !== confirm) { setError("Passwords do not match."); return; }

    try {
      if (!otpVerified) {
        // 1. Verify the 6-digit code from the email
        const { error: verifyError } = await withCaptcha("otp_verify", (o) =>
          supabase.auth.verifyOtp({
            email,
            token: otp.trim(),
            type: "recovery",
            options: o,
          })
        );
        if (verifyError) { setError(humanize(verifyError, "auth")); return; }
        // Same code must not be reused if updateUser fails
        setOtpVerified(true);
      }

      // 2. Set the new password
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) { setError(humanize(updateError, "auth")); return; }

      setStep("done");
    } catch {
      setError("Something went wrong. Please try again.");
    }
  };

  if (step === "done") {
    return (
      <AuthLayout title="Password updated" subtitle="Your password has been changed successfully.">
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
          <p className="text-sm text-secondary leading-[1.65] mb-7">
            You can now sign in with your new password.
          </p>
          <Link to="/sign-in" className="no-underline block">
            <Button className="w-full justify-center">Back to Sign In</Button>
          </Link>
        </div>
      </AuthLayout>
    );
  }

  if (step === "verify") {
    return (
      <AuthLayout
        title="Check your email"
        subtitle={`We sent a 6-digit code to ${email}. Enter it below along with your new password.`}
      >
        <form onSubmit={resetWithOtp} noValidate>
          {error && (
            <div className="flex items-start gap-2.5 p-3 rounded-lg bg-error/10 border border-error/20 text-error text-[13.5px] leading-relaxed mb-4" role="alert">
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} className="shrink-0 mt-0.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
              {error}
            </div>
          )}

          <TextInput
            label="Verification code"
            id="fp-otp"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            required
            maxLength={6}
            autoFocus
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="6-digit code"
            hint="Enter the code from the email we just sent."
          />

          <TextInput
            label="New password"
            id="fp-password"
            type="password"
            autoComplete="new-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Minimum 8 characters"
          />

          <TextInput
            label="Confirm password"
            id="fp-confirm"
            type="password"
            autoComplete="new-password"
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Repeat your password"
            className={confirm.length > 0 && confirm !== password ? "border-error" : ""}
          />

          <div className="flex flex-col gap-2.5">
            <Button
              type="submit"
              disabled={otp.length < 6 || !password || !confirm}
              className="w-full justify-center h-11"
            >
              Reset password
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setStep("request");
                setOtp("");
                setPassword("");
                setConfirm("");
                setError(null);
                setOtpVerified(false);
              }}
              className="w-full justify-center"
            >
              Try a different email
            </Button>
          </div>
        </form>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Reset password" subtitle="Enter your email and we'll send a code to reset your password">
      <form onSubmit={sendCode} noValidate>
        {error && (
          <div className="flex items-start gap-2.5 p-3 rounded-lg bg-error/10 border border-error/20 text-error text-[13.5px] leading-relaxed mb-4" role="alert">
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} className="shrink-0 mt-0.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
            {error}
          </div>
        )}

        <div className="mb-5">
          <TextInput
            label="Email address"
            id="fp-email"
            type="email"
            autoComplete="email"
            required
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your@email.com"
          />
        </div>

        <div className="flex flex-col gap-2.5">
          <Button type="submit" disabled={loading} loading={loading} className="w-full justify-center h-11">
            Send reset code
          </Button>
          <Link to="/sign-in" className="no-underline block">
            <Button variant="secondary" className="w-full justify-center h-11">
              ← Back to Sign In
            </Button>
          </Link>
        </div>
      </form>
    </AuthLayout>
  );
}