import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "../lib/supabase";
import { withCaptcha } from "../lib/captcha";
import { humanize } from "@shared/utils/errors";
import AuthLayout from "../components/layout/AuthLayout";
import { Button } from "../components/ui/Button";
import { TextInput } from "../components/ui/TextInput";

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
  if (pw.length >= 8) s++;
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


export default function SignUp() {
  const navigate = useNavigate();
  const [name, setName]         = useState("");
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw]     = useState(false);
  const [error, setError]       = useState<{ msg: string; isDuplicate?: boolean } | null>(null);
  const [loading, setLoading]   = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [sent, setSent]         = useState(false);
  const [otpCode, setOtpCode]   = useState("");
  const [verifyLoading, setVerifyLoading] = useState(false);

  const anyLoading = loading || googleLoading;

  const strength = passwordStrength(password);
  const meta     = STRENGTH[strength];
  const metaText = STRENGTH_TEXT[strength];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim())           { setError({ msg: "Please enter your name." }); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setError({ msg: "Please enter a valid email address." }); return; }
    if (password.length < 8)   { setError({ msg: "Password must be at least 8 characters." }); return; }

    setLoading(true);
    try {
      const { data, error: authError } = await withCaptcha("signup", (o) =>
        supabase.auth.signUp({
          email, password,
          options: {
            data: { display_name: name.trim() },
            emailRedirectTo: `${window.location.origin}/auth/callback`,
            ...o,
          },
        })
      );

      if (authError) {
        if (authError.message.toLowerCase().includes("rate limit")) {
          setError({ msg: "Too many sign-up attempts. Please wait a few minutes and try again." });
        } else {
          setError({ msg: humanize(authError, "auth") });
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
      setError({ msg: humanize(e, "auth") });
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

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!otpCode || otpCode.length !== 6 || !/^\d+$/.test(otpCode)) {
      setError({ msg: "Please enter a valid 6-digit code." });
      return;
    }
    setVerifyLoading(true);
    try {
      const { error: verifyError } = await withCaptcha("otp_verify", (o) =>
        supabase.auth.verifyOtp({
          email,
          token: otpCode,
          type: "signup",
          options: o,
        })
      );
      if (verifyError) {
        setError({ msg: humanize(verifyError, "auth") });
        return;
      }
      navigate("/app/dashboard");
    } catch (err: any) {
      setError({ msg: humanize(err, "auth") });
    } finally {
      setVerifyLoading(false);
    }
  };

  if (sent) {
    return (
      <AuthLayout title="Check your email" subtitle={`We sent a 6-digit code to ${email}`}>
        <form onSubmit={handleVerify} noValidate className="py-2">
          {error && (
            <div className="flex items-start gap-2.5 p-3 rounded-lg bg-error/10 border border-error/20 text-error text-[13.5px] leading-relaxed mb-4">
              <span>{error.msg}</span>
            </div>
          )}
          
          <div className="mb-4 text-center">
            <div className="w-[52px] h-[52px] rounded-full bg-accent/10 border border-accent/20 flex items-center justify-center mx-auto mb-4 text-accent">
              <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"/>
              </svg>
            </div>
          </div>

          <div className="mb-6">
            <TextInput
              label="Verification Code"
              id="su-otp"
              type="text"
              inputMode="numeric"
              maxLength={6}
              required
              autoFocus
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
              placeholder="123456"
              className="text-center tracking-widest text-lg"
            />
          </div>

          <div className="flex flex-col gap-2.5">
            <Button type="submit" disabled={verifyLoading || otpCode.length !== 6} loading={verifyLoading} className="w-full justify-center h-11">
              Verify & continue
            </Button>
            <Button type="button" variant="secondary" onClick={() => { setSent(false); setEmail(""); setOtpCode(""); setError(null); }} className="w-full justify-center h-11">
              Use a different email
            </Button>
          </div>
          
          <p className="text-xs text-secondary/70 mt-6 text-center">
            Can't find it? Check your spam folder. The code expires in 24 hours.
          </p>
        </form>
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
              className="flex items-start gap-2.5 p-3 rounded-lg bg-error/10 border border-error/20 text-error text-[13.5px] leading-relaxed mb-4"
              role="alert"
            >
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} className="shrink-0 mt-0.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
              <div>
                <span>{error.msg}</span>
                {/* Contextual actions for duplicate account */}
                {error.isDuplicate && (
                  <div className="mt-2.5 flex gap-3">
                    <Link to="/sign-in">
                      <Button size="sm">Sign In</Button>
                    </Link>
                    <Link to="/forgot-password">
                      <Button variant="secondary" size="sm">Forgot Password?</Button>
                    </Link>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Name */}
        <div className="mb-4">
          <TextInput
            label="Your name"
            id="su-name"
            type="text"
            autoComplete="name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="How should we call you?"
            maxLength={50}
          />
        </div>

        {/* Email */}
        <div className="mb-4">
          <TextInput
            label="Email"
            id="su-email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your@email.com"
          />
        </div>

        {/* Password */}
        <div className="mb-4">
          <TextInput
            label="Password"
            id="su-password"
            type={showPw ? "text" : "password"}
            autoComplete="new-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Minimum 8 characters"
            className="pr-2"
            trailingElement={
              <button
                type="button"
                onClick={() => setShowPw(v => !v)}
                className="bg-transparent border-none cursor-pointer text-secondary/70 hover:text-secondary p-0.5 flex items-center"
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
            }
          />
          {/* Strength meter */}
          {password.length > 0 && (
            <div className="mt-2">
              <div className="flex gap-1 mb-1">
                {[1,2,3,4].map(i => (
                  <div key={i} className={`flex-1 h-[3px] rounded-full transition-colors duration-200 ${i <= strength ? meta.color : "bg-border"}`} />
                ))}
              </div>
              {strength > 0 && (
                <p className={`text-[11px] ${metaText.color}`}>{meta.label}</p>
              )}
            </div>
          )}
        </div>

        {/* Terms */}
        <p className="text-xs text-secondary leading-[1.6] mb-5">
          By creating an account you agree to our{" "}
          <Link to="/terms" className="text-secondary no-underline hover:text-primary underline underline-offset-2">Terms</Link>
          {" "}and{" "}
          <Link to="/privacy" className="text-secondary no-underline hover:text-primary underline underline-offset-2">Privacy Policy</Link>.
        </p>

        <Button type="submit" disabled={anyLoading} className="w-full justify-center h-11" loading={loading}>
          Create account
        </Button>

        <div className="flex items-center gap-3 my-5">
          <div className="h-px bg-border flex-1" />
          <span className="text-xs text-secondary/70">or</span>
          <div className="h-px bg-border flex-1" />
        </div>

        {/* Google OAuth */}
        <Button
          type="button"
          disabled={anyLoading}
          onClick={handleGoogle}
          variant="secondary"
          className="w-full justify-center gap-2.5 h-11"
          loading={googleLoading}
          icon={!googleLoading && <GoogleIcon />}
        >
          {googleLoading ? "Redirecting…" : "Continue with Google"}
        </Button>

        {/* Google OAuth scope disclosure */}
        <p className="text-[11.5px] text-secondary/60 text-center mt-2 leading-relaxed">
          Google Sign-In is used for authentication only. We access your name and email address — not Gmail, Drive, Calendar, Photos, or Contacts.{" "}
          <Link to="/privacy" className="underline underline-offset-2 hover:text-secondary transition-colors">
            Privacy Policy
          </Link>
        </p>
      </form>

      <p className="text-center text-[13px] text-secondary mt-6">
        Already have an account?{" "}
        <Link to="/sign-in" className="text-accent no-underline font-medium hover:underline">Sign in</Link>
      </p>
    </AuthLayout>
  );
}
