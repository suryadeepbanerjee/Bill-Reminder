import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "../lib/supabase";
import AuthLayout from "../components/layout/AuthLayout";

const RESEND_COOLDOWN = 60;

type Stage = "form" | "otp";

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

export default function SignIn() {
  const navigate = useNavigate();

  // ── Password sign-in ──────────────────────────────────────────────────────
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw]     = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [loading, setLoading]   = useState(false);

  // ── OTP flow ──────────────────────────────────────────────────────────────
  const [stage, setStage]           = useState<Stage>("form");
  const [otpEmail, setOtpEmail]     = useState("");
  const [otpCode, setOtpCode]       = useState("");
  const [otpError, setOtpError]     = useState<string | null>(null);
  const [otpSuccess, setOtpSuccess] = useState<string | null>(null);
  const [sendLoading, setSendLoading]     = useState(false);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [cooldown, setCooldown]     = useState(0);

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  // ── Password sign-in ──────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { error: err } = await supabase.auth.signInWithPassword({ email, password });
      if (err) {
        const msg = err.message.toLowerCase();
        if (msg.includes("invalid login") || msg.includes("invalid credentials")) {
          setError("Incorrect email or password.");
        } else if (msg.includes("email not confirmed")) {
          setError("Please verify your email first. Check your inbox.");
        } else {
          setError(err.message);
        }
        return;
      }
      navigate("/");
    } catch { setError("Something went wrong. Please try again."); }
    finally { setLoading(false); }
  };

  // ── Send OTP ──────────────────────────────────────────────────────────────
  const startCooldown = () => {
    setCooldown(RESEND_COOLDOWN);
    const timer = setInterval(() => {
      setCooldown((c) => { if (c <= 1) { clearInterval(timer); return 0; } return c - 1; });
    }, 1000);
  };

  const sendOtp = async (targetEmail: string): Promise<boolean> => {
    const { error: err } = await supabase.auth.signInWithOtp({
      email: targetEmail,
      options: { shouldCreateUser: false },
    });
    if (err) { setOtpError(err.message); return false; }
    return true;
  };

  const handleSendCode = async () => {
    if (!emailValid) { setError("Enter a valid email address first."); return; }
    setError(null);
    setSendLoading(true);
    try {
      const ok = await sendOtp(email);
      if (!ok) return;
      setOtpEmail(email);
      setStage("otp");
      startCooldown();
    } catch { setError("Something went wrong. Please try again."); }
    finally { setSendLoading(false); }
  };

  const handleResend = async () => {
    setOtpError(null);
    setOtpSuccess(null);
    setOtpCode("");
    setSendLoading(true);
    try {
      const ok = await sendOtp(otpEmail);
      if (!ok) return;
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
      const { error: err } = await supabase.auth.verifyOtp({
        email: otpEmail,
        token: code,
        type:  "email",
      });
      if (err) {
        const msg = err.message.toLowerCase();
        if (msg.includes("expired") || msg.includes("otp") || msg.includes("invalid")) {
          setOtpError("Incorrect or expired code. Request a new one.");
        } else {
          setOtpError(err.message);
        }
        return;
      }
      navigate("/");
    } catch { setOtpError("Could not verify. Please try again."); }
    finally { setVerifyLoading(false); }
  };

  // ── OTP code entry screen ─────────────────────────────────────────────────
  if (stage === "otp") {
    return (
      <AuthLayout title="Enter your code" subtitle={`We sent a 6-digit code to ${otpEmail}`}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{
            width: 52, height: 52, borderRadius: 14,
            background: "var(--brand-faint)", border: "1px solid var(--brand-border)",
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 0",color: "var(--brand)",
          }}>
            <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"/>
            </svg>
          </div>
        </div>

        {otpError   && <ErrorAlert   message={otpError}   />}
        {otpSuccess  && <SuccessAlert message={otpSuccess} />}

        <Field label="6-digit code" id="otp-code">
          <input
            id="otp-code"
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
          onClick={() => { setStage("form"); setOtpCode(""); setOtpError(null); setOtpSuccess(null); setCooldown(0); }}
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

  // ── Sign-in form ──────────────────────────────────────────────────────────
  return (
    <AuthLayout title="Welcome back" subtitle="Sign in to continue tracking your bills">
      <form onSubmit={handleSubmit} noValidate>
        {error && <ErrorAlert message={error} />}

        <Field label="Email" id="si-email">
          <input
            id="si-email" type="email" autoComplete="email" required
            value={email} onChange={e => setEmail(e.target.value)}
            className="auth-input" placeholder="your@email.com"
          />
        </Field>

        <Field label="Password" id="si-password">
          <div style={{ position: "relative" }}>
            <input
              id="si-password" type={showPw ? "text" : "password"} autoComplete="current-password" required
              value={password} onChange={e => setPassword(e.target.value)}
              className="auth-input" placeholder="Your password"
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
          <div style={{ textAlign: "right", marginTop: 6 }}>
            <Link to="/forgot-password" style={{ fontSize: 12, color: "var(--brand)", textDecoration: "none" }}>
              Forgot password?
            </Link>
          </div>
        </Field>

        <button type="submit" disabled={loading} className="btn-primary" style={{ width: "100%", justifyContent: "center", marginTop: 4 }}>
          {loading && <div className="spinner" />}
          {loading ? "Signing in…" : "Sign in"}
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "20px 0" }}>
          <div className="divider" style={{ flex: 1 }} />
          <span style={{ fontSize: 12, color: "var(--ink-3)" }}>or</span>
          <div className="divider" style={{ flex: 1 }} />
        </div>

        {/* OTP code sign-in — no link, no browser redirect */}
        <button
          type="button"
          disabled={sendLoading || loading}
          onClick={handleSendCode}
          className="btn-outline"
          style={{ width: "100%", justifyContent: "center" }}
        >
          {sendLoading ? <div className="spinner" style={{ borderTopColor: "var(--brand)" }} /> : (
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"/>
            </svg>
          )}
          {sendLoading ? "Sending…" : "Sign in with code"}
        </button>
      </form>

      <p style={{ textAlign: "center", fontSize: 13, color: "var(--ink-3)", marginTop: 24 }}>
        Don't have an account?{" "}
        <Link to="/sign-up" style={{ color: "var(--brand)", textDecoration: "none", fontWeight: 500 }}>Sign up</Link>
      </p>
    </AuthLayout>
  );
}
