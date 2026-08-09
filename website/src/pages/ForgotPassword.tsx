import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { supabase } from "../lib/supabase";
import { withCaptcha } from "../lib/captcha";
import { humanize } from "@shared/utils/errors";
import AuthLayout from "../components/layout/AuthLayout";
import { Button } from "../components/ui/Button";
import { TextInput } from "../components/ui/TextInput";
import CaptchaField from "../components/ui/CaptchaField";

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
      const { error: authError } = await withCaptcha("recover", (o) =>
        supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/auth/callback`,
          ...o,
        })
      );
      if (authError) { setError(humanize(authError, "auth")); return; }
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
          <p className="text-sm text-secondary leading-[1.65] mb-2">
            We've sent a reset link to <strong className="text-primary font-semibold">{email}</strong>.
          </p>
          <p className="text-xs text-secondary/70 mb-7">
            The link is valid for 1 hour. Check your spam folder if it doesn't arrive.
          </p>
          <div className="flex flex-col gap-2.5">
            <Link to="/sign-in" className="no-underline block">
              <Button className="w-full justify-center">Back to Sign In</Button>
            </Link>
            <Button
              variant="ghost"
              onClick={() => { setSent(false); setEmail(""); }}
              className="w-full justify-center"
            >
              Try a different email
            </Button>
          </div>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Forgot your password?" subtitle="Enter your email and we'll send a reset link">
      <form onSubmit={handleSubmit} noValidate>
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
          <CaptchaField theme="dark" />
          <Button type="submit" disabled={loading} loading={loading} className="w-full justify-center h-11">
            Send reset link
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
