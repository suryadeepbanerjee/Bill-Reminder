import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "../lib/supabase";
import { withCaptcha } from "../lib/captcha";
import { humanize } from "@shared/utils/errors";
import AuthLayout from "../components/layout/AuthLayout";
import { Button } from "../components/ui/Button";
import { TextInput } from "../components/ui/TextInput";

const RESEND_COOLDOWN = 60;
type Stage = "email" | "otp";

function ErrorAlert({ message }: { message: string }) {
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -8, height: 0 }}
        animate={{ opacity: 1, y: 0, height: "auto" }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="flex items-start gap-2.5 p-3 rounded-lg bg-error/10 border border-error/20 text-error text-[13.5px] leading-relaxed mb-4"
        role="alert"
      >
        <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} className="shrink-0 mt-0.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
        </svg>
        <span>{message}</span>
      </motion.div>
    </AnimatePresence>
  );
}

function SuccessAlert({ message }: { message: string }) {
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -8, height: 0 }}
        animate={{ opacity: 1, y: 0, height: "auto" }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="flex items-start gap-2.5 p-3 rounded-lg bg-success/10 border border-success/20 text-success text-[13.5px] leading-relaxed mb-4"
        role="status"
      >
        <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} className="shrink-0 mt-0.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
        </svg>
        <span>{message}</span>
      </motion.div>
    </AnimatePresence>
  );
}

export default function SignInCode() {
  const navigate = useNavigate();

  const [stage, setStage]     = useState<Stage>("email");
  const [email, setEmail]     = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);

  const [otpCode, setOtpCode]         = useState("");
  const [otpError, setOtpError]       = useState<string | null>(null);
  const [otpSuccess, setOtpSuccess]   = useState<string | null>(null);
  const [sendLoading, setSendLoading]         = useState(false);
  const [verifyLoading, setVerifyLoading]     = useState(false);
  const [cooldown, setCooldown]       = useState(0);

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  const startCooldown = () => {
    setCooldown(RESEND_COOLDOWN);
    const timer = setInterval(() => {
      setCooldown(c => { if (c <= 1) { clearInterval(timer); return 0; } return c - 1; });
    }, 1000);
  };

  // ── Send OTP ──────────────────────────────────────────────────────────────
  const sendOtp = async (target: string): Promise<boolean> => {
    const { error } = await withCaptcha((o) =>
      supabase.auth.signInWithOtp({
        email: target,
        options: { shouldCreateUser: false, ...o },
      })
    );
    if (error) { setEmailError(humanize(error, "auth")); return false; }
    return true;
  };

  const handleSendCode = async () => {
    setEmailError(null);
    if (!emailValid) { setEmailError("Please enter a valid email address."); return; }
    setSendLoading(true);
    try {
      const ok = await sendOtp(email.trim());
      if (!ok) return;
      setStage("otp");
      startCooldown();
    } catch { setEmailError("Something went wrong. Please try again."); }
    finally { setSendLoading(false); }
  };

  // ── Resend OTP ────────────────────────────────────────────────────────────
  const handleResend = async () => {
    setOtpError(null);
    setOtpSuccess(null);
    setOtpCode("");
    setSendLoading(true);
    try {
      const { error } = await withCaptcha((o) =>
        supabase.auth.signInWithOtp({
          email: email.trim(),
          options: { shouldCreateUser: false, ...o },
        })
      );
      if (error) { setOtpError(humanize(error, "auth")); return; }
      setOtpSuccess("New code sent — check your inbox.");
      startCooldown();
    } catch { setOtpError("Could not resend. Please try again."); }
    finally { setSendLoading(false); }
  };

  // ── Verify OTP ────────────────────────────────────────────────────────────
  const handleVerify = async () => {
    const code = otpCode.trim();
    setOtpError(null);
    setOtpSuccess(null);
    if (!code || code.length !== 6 || !/^\d+$/.test(code)) {
      setOtpError("Enter the 6-digit code from your email.");
      return;
    }
    setVerifyLoading(true);
    try {
      const { error } = await withCaptcha((o) =>
        supabase.auth.verifyOtp({
          email: email.trim(),
          token: code,
          type:  "email",
          options: o,
        })
      );
      if (error) {
        const msg = error.message.toLowerCase();
        if (msg.includes("expired") || msg.includes("otp") || msg.includes("invalid")) {
          setOtpError("Incorrect or expired code. Request a new one.");
        } else {
          setOtpError(humanize(error, "auth"));
        }
        return;
      }
      navigate("/");
    } catch { setOtpError("Could not verify. Please try again."); }
    finally { setVerifyLoading(false); }
  };

  // ── Stage 1: Email entry ──────────────────────────────────────────────────
  if (stage === "email") {
    return (
      <AuthLayout title="Sign in with code" subtitle="Enter your email and we'll send you a 6-digit sign-in code.">
        {emailError && <ErrorAlert message={emailError} />}

        <div className="mb-4">
          <TextInput
            label="Email"
            id="sic-email"
            type="email"
            autoComplete="email"
            autoFocus
            value={email}
            onChange={e => { setEmail(e.target.value); setEmailError(null); }}
            onKeyDown={e => { if (e.key === "Enter") handleSendCode(); }}
            placeholder="your@email.com"
          />
        </div>

        <Button
          type="button"
          onClick={handleSendCode}
          disabled={sendLoading}
          loading={sendLoading}
          className="w-full justify-center mb-3 h-11"
        >
          Send code
        </Button>

        <Link to="/sign-in" className="no-underline block">
          <Button variant="secondary" className="w-full justify-center h-11">
            Back to sign in
          </Button>
        </Link>

        <p className="text-center text-[13px] text-secondary mt-6">
          Don't have an account?{" "}
          <Link to="/sign-up" className="text-accent no-underline font-medium hover:underline">Sign up</Link>
        </p>
      </AuthLayout>
    );
  }

  // ── Stage 2: Code entry ───────────────────────────────────────────────────
  return (
    <AuthLayout title="Enter your code" subtitle={`We sent a 6-digit code to ${email}. Open your email and enter it below.`}>
      <div className="text-center mb-6">
        <div className="w-[52px] h-[52px] rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center mx-auto text-accent">
          <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"/>
          </svg>
        </div>
      </div>

      {otpError   && <ErrorAlert   message={otpError}   />}
      {otpSuccess  && <SuccessAlert message={otpSuccess} />}

      <div className="mb-4">
        <TextInput
          label="6-digit code"
          id="sic-otp"
          type="text"
          inputMode="numeric"
          pattern="\d{6}"
          maxLength={6}
          autoFocus
          autoComplete="one-time-code"
          value={otpCode}
          onChange={e => { setOtpCode(e.target.value.replace(/\D/g, "")); setOtpError(null); }}
          onKeyDown={e => { if (e.key === "Enter") handleVerify(); }}
          placeholder="123456"
          className="tracking-[0.3em] text-[22px] text-center"
        />
      </div>

      <Button
        type="button"
        onClick={handleVerify}
        disabled={verifyLoading || otpCode.length !== 6}
        loading={verifyLoading}
        className="w-full justify-center mb-2.5 h-11"
      >
        Verify & sign in
      </Button>

      <Button
        type="button"
        onClick={handleResend}
        disabled={cooldown > 0 || sendLoading || verifyLoading}
        loading={sendLoading}
        variant="secondary"
        className="w-full justify-center mb-2.5 h-11"
      >
        {cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}
      </Button>

      <Button
        type="button"
        onClick={() => { setStage("email"); setOtpCode(""); setOtpError(null); setOtpSuccess(null); setCooldown(0); }}
        variant="ghost"
        className="w-full justify-center h-11"
      >
        Use a different email
      </Button>

      <p className="text-center text-xs text-secondary/70 mt-5">
        Can't find it? Check your spam folder. Code expires in 10 minutes.
      </p>
    </AuthLayout>
  );
}
