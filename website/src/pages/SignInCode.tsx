import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "../lib/supabase";
import AuthLayout from "../components/layout/AuthLayout";

const RESEND_COOLDOWN = 60;
type Stage = "email" | "otp";

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

function SuccessAlert({ message }: { message: string }) {
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -8, height: 0 }}
        animate={{ opacity: 1, y: 0, height: "auto" }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="alert alert-success"
        style={{ marginBottom: 16 }}
        role="status"
      >
        <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} style={{ flexShrink: 0, marginTop: 1 }}>
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
    const { error } = await supabase.auth.signInWithOtp({
      email: target,
      options: { shouldCreateUser: false },
    });
    if (error) { setEmailError(error.message); return false; }
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
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { shouldCreateUser: false },
      });
      if (error) { setOtpError(error.message); return; }
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
      const { error } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: code,
        type:  "email",
      });
      if (error) {
        const msg = error.message.toLowerCase();
        if (msg.includes("expired") || msg.includes("otp") || msg.includes("invalid")) {
          setOtpError("Incorrect or expired code. Request a new one.");
        } else {
          setOtpError(error.message);
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

        <Field label="Email" id="sic-email">
          <input
            id="sic-email"
            type="email"
            autoComplete="email"
            autoFocus
            value={email}
            onChange={e => { setEmail(e.target.value); setEmailError(null); }}
            onKeyDown={e => { if (e.key === "Enter") handleSendCode(); }}
            className="auth-input"
            placeholder="your@email.com"
          />
        </Field>

        <button
          type="button"
          onClick={handleSendCode}
          disabled={sendLoading}
          className="btn-primary"
          style={{ width: "100%", justifyContent: "center", marginBottom: 10 }}
        >
          {sendLoading && <div className="spinner" />}
          {sendLoading ? "Sending…" : "Send code"}
        </button>

        <Link to="/sign-in" className="btn-outline" style={{ width: "100%", justifyContent: "center", display: "flex" }}>
          Back to sign in
        </Link>

        <p style={{ textAlign: "center", fontSize: 13, color: "var(--ink-3)", marginTop: 24 }}>
          Don't have an account?{" "}
          <Link to="/sign-up" style={{ color: "var(--brand)", textDecoration: "none", fontWeight: 500 }}>Sign up</Link>
        </p>
      </AuthLayout>
    );
  }

  // ── Stage 2: Code entry ───────────────────────────────────────────────────
  return (
    <AuthLayout title="Enter your code" subtitle={`We sent a 6-digit code to ${email}. Open your email and enter it below.`}>
      <div style={{ textAlign: "center", marginBottom: 24 }}>
        <div style={{
          width: 52, height: 52, borderRadius: 14,
          background: "var(--brand-faint)", border: "1px solid var(--brand-border)",
          display: "flex", alignItems: "center", justifyContent: "center",
          margin: "0 auto", color: "var(--brand)",
        }}>
          <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"/>
          </svg>
        </div>
      </div>

      {otpError   && <ErrorAlert   message={otpError}   />}
      {otpSuccess  && <SuccessAlert message={otpSuccess} />}

      <Field label="6-digit code" id="sic-otp">
        <input
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
          className="auth-input"
          placeholder="123456"
          style={{ letterSpacing: "0.3em", fontSize: 22, textAlign: "center" }}
        />
      </Field>

      <button
        type="button"
        onClick={handleVerify}
        disabled={verifyLoading || otpCode.length !== 6}
        className="btn-primary"
        style={{ width: "100%", justifyContent: "center", marginBottom: 10 }}
      >
        {verifyLoading && <div className="spinner" />}
        {verifyLoading ? "Verifying…" : "Verify & sign in"}
      </button>

      <button
        type="button"
        onClick={handleResend}
        disabled={cooldown > 0 || sendLoading || verifyLoading}
        className="btn-outline"
        style={{ width: "100%", justifyContent: "center", marginBottom: 10 }}
      >
        {sendLoading && <div className="spinner" style={{ borderTopColor: "var(--brand)" }} />}
        {cooldown > 0 ? `Resend code in ${cooldown}s` : sendLoading ? "Sending…" : "Resend code"}
      </button>

      <button
        type="button"
        onClick={() => { setStage("email"); setOtpCode(""); setOtpError(null); setOtpSuccess(null); setCooldown(0); }}
        className="btn-ghost"
        style={{ width: "100%", justifyContent: "center" }}
      >
        Use a different email
      </button>

      <p style={{ textAlign: "center", fontSize: 12, color: "var(--ink-3)", marginTop: 20 }}>
        Can't find it? Check your spam folder. Code expires in 10 minutes.
      </p>
    </AuthLayout>
  );
}
