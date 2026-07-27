import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { supabase, APP_SCHEME } from "../lib/supabase";
import AuthLayout from "../components/layout/AuthLayout";

type CallbackState =
  | "loading"
  | "verified"
  | "password_reset"
  | "email_changed"
  | "already_verified"
  | "expired"
  | "invalid"
  | "error";

interface CallbackResult {
  state: CallbackState;
  message?: string;
}

function parseCallbackResult(): Promise<CallbackResult> {
  return new Promise((resolve) => {
    const url    = new URL(window.location.href);
    const code   = url.searchParams.get("code");
    const type   = url.searchParams.get("type");
    const error  = url.searchParams.get("error");
    const errDesc = url.searchParams.get("error_description");
    const hash   = window.location.hash;

    // ── Error from Supabase (e.g. expired link) ──────────────────────
    if (error) {
      const desc = errDesc?.toLowerCase() ?? "";
      if (desc.includes("expired") || desc.includes("otp_expired")) {
        resolve({ state: "expired", message: errDesc ?? undefined });
      } else if (desc.includes("already") || desc.includes("already confirmed")) {
        resolve({ state: "already_verified" });
      } else {
        resolve({ state: "invalid", message: errDesc ?? error });
      }
      return;
    }

    // ── Hash fragment — recovery / email_change (old implicit flow) ──
    if (hash.includes("access_token") && hash.includes("type=recovery")) {
      // Supabase already set the session via detectSessionInUrl — check
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) {
          resolve({ state: "password_reset" });
        } else {
          resolve({ state: "expired" });
        }
      });
      return;
    }

    if (hash.includes("access_token") && hash.includes("type=email_change")) {
      resolve({ state: "email_changed" });
      return;
    }

    // ── PKCE code exchange ───────────────────────────────────────────
    if (code) {
      supabase.auth
        .exchangeCodeForSession(code)
        .then(({ data, error: exchError }) => {
          if (exchError) {
            const msg = exchError.message.toLowerCase();
            if (msg.includes("expired") || msg.includes("used")) {
              resolve({ state: "expired" });
            } else if (msg.includes("invalid")) {
              resolve({ state: "invalid", message: exchError.message });
            } else {
              resolve({ state: "error", message: exchError.message });
            }
            return;
          }

          // Determine intent from the Supabase session
          const session = data.session;
          if (!session) { resolve({ state: "error" }); return; }

          // type from query param beats everything
          if (type === "recovery") { resolve({ state: "password_reset" }); return; }
          if (type === "email_change") { resolve({ state: "email_changed" }); return; }

          // Default — email verification / magic link sign-in
          resolve({ state: "verified" });
        })
        .catch(() => resolve({ state: "error" }));
      return;
    }

    // ── No code, no hash, no error ──────────────────────────────────
    resolve({ state: "invalid" });
  });
}

// ── UI States ─────────────────────────────────────────────────────────────────

function LoadingState() {
  return (
    <AuthLayout title="Verifying…" subtitle="Completing your authentication">
      <div className="flex flex-col items-center py-8 gap-4">
        <div className="relative w-14 h-14">
          <div className="absolute inset-0 rounded-full border-2 border-accent-500/20" />
          <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-accent-500 animate-spin" />
        </div>
        <p className="text-sm text-white/35 text-center">
          This takes just a moment…
        </p>
      </div>
    </AuthLayout>
  );
}

function VerifiedState() {
  const openApp = () => { window.location.href = `${APP_SCHEME}://signin`; };

  return (
    <AuthLayout title="Email verified" subtitle="Your account is now active and ready to use">
      <div className="text-center py-2">
        <motion.div
          initial={{ scale: 0.7, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 18 }}
          className="w-16 h-16 rounded-2xl bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center mx-auto mb-5"
        >
          <svg className="w-8 h-8 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </motion.div>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="text-sm text-white/50 mb-8 leading-relaxed"
        >
          Your email has been successfully verified. You can now sign in to Bill Reminder on any device.
        </motion.p>
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="space-y-3"
        >
          <button onClick={openApp} className="btn-primary w-full justify-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
            Open App
          </button>
          <Link to="/sign-in" className="btn-secondary w-full justify-center">
            Sign in on web
          </Link>
        </motion.div>
        <p className="text-xs text-white/25 mt-6">
          "Open App" launches the Bill Reminder app if installed on this device.
        </p>
      </div>
    </AuthLayout>
  );
}

function PasswordResetReadyState() {
  const navigate = useNavigate();
  useEffect(() => { navigate("/reset-password", { replace: true }); }, [navigate]);
  return <LoadingState />;
}

function EmailChangedState() {
  return (
    <AuthLayout title="Email updated" subtitle="Your email address has been changed successfully">
      <div className="text-center py-2">
        <motion.div
          initial={{ scale: 0.7, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 18 }}
          className="w-16 h-16 rounded-2xl bg-accent-500/15 border border-accent-500/25 flex items-center justify-center mx-auto mb-5"
        >
          <svg className="w-8 h-8 text-accent-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </motion.div>
        <p className="text-sm text-white/50 mb-8 leading-relaxed">
          Your email address has been changed. Sign in with your new email going forward.
        </p>
        <Link to="/sign-in" className="btn-primary w-full justify-center">
          Sign in
        </Link>
      </div>
    </AuthLayout>
  );
}

function AlreadyVerifiedState() {
  return (
    <AuthLayout title="Already verified" subtitle="This account has already been confirmed">
      <div className="text-center py-2">
        <div className="w-14 h-14 rounded-2xl bg-accent-500/15 border border-accent-500/25 flex items-center justify-center mx-auto mb-5">
          <svg className="w-7 h-7 text-accent-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
        </div>
        <p className="text-sm text-white/50 mb-8 leading-relaxed">
          Your email is already confirmed. You can sign in to your account right now.
        </p>
        <div className="space-y-3">
          <Link to="/sign-in" className="btn-primary w-full justify-center">
            Sign in
          </Link>
        </div>
      </div>
    </AuthLayout>
  );
}

function ExpiredState() {
  return (
    <AuthLayout title="Link expired" subtitle="This link is no longer valid">
      <div className="text-center py-2">
        <div className="w-14 h-14 rounded-2xl bg-amber-500/15 border border-amber-500/25 flex items-center justify-center mx-auto mb-5">
          <svg className="w-7 h-7 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <p className="text-sm text-white/50 mb-2 leading-relaxed">
          Verification links expire after 24 hours for security. Request a new one to continue.
        </p>
        <p className="text-xs text-white/30 mb-8">
          Make sure to click the link within 24 hours of receiving it.
        </p>
        <div className="space-y-3">
          <Link to="/sign-up" className="btn-primary w-full justify-center">
            Create new account
          </Link>
          <Link to="/sign-in" className="btn-secondary w-full justify-center">
            Sign in
          </Link>
        </div>
        <p className="text-xs text-white/25 mt-6">
          Need help?{" "}
          <a
            href="mailto:support@billreminder.suryadeepbanerjee.in"
            className="hover:text-white/50 transition-colors underline underline-offset-2"
          >
            Contact support
          </a>
        </p>
      </div>
    </AuthLayout>
  );
}

function InvalidState({ message }: { message?: string }) {
  return (
    <AuthLayout title="Invalid link" subtitle="This verification link is not recognised">
      <div className="text-center py-2">
        <div className="w-14 h-14 rounded-2xl bg-red-500/15 border border-red-500/25 flex items-center justify-center mx-auto mb-5">
          <svg className="w-7 h-7 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <p className="text-sm text-white/50 mb-2 leading-relaxed">
          This link appears to be malformed or has already been used.
        </p>
        {message && (
          <p className="text-xs text-white/25 mb-6 font-mono px-2 py-1.5 bg-white/[0.03] rounded-lg">
            {message}
          </p>
        )}
        <div className="space-y-3 mt-4">
          <Link to="/sign-in" className="btn-primary w-full justify-center">
            Go to Sign In
          </Link>
          <Link to="/sign-up" className="btn-secondary w-full justify-center">
            Create new account
          </Link>
        </div>
        <p className="text-xs text-white/25 mt-6">
          Need help?{" "}
          <a
            href="mailto:support@billreminder.suryadeepbanerjee.in"
            className="hover:text-white/50 transition-colors underline underline-offset-2"
          >
            Contact support
          </a>
        </p>
      </div>
    </AuthLayout>
  );
}

function ErrorState({ message }: { message?: string }) {
  return (
    <AuthLayout title="Something went wrong" subtitle="We couldn't complete your verification">
      <div className="text-center py-2">
        <div className="w-14 h-14 rounded-2xl bg-red-500/15 border border-red-500/25 flex items-center justify-center mx-auto mb-5">
          <svg className="w-7 h-7 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <p className="text-sm text-white/50 mb-8 leading-relaxed">
          An unexpected error occurred. Please try again or contact support if the problem persists.
        </p>
        <div className="space-y-3">
          <Link to="/sign-in" className="btn-primary w-full justify-center">
            Go to Sign In
          </Link>
        </div>
        {message && (
          <p className="text-xs text-white/20 mt-6 font-mono">{message}</p>
        )}
      </div>
    </AuthLayout>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export default function AuthCallback() {
  const [result, setResult] = useState<CallbackResult>({ state: "loading" });

  useEffect(() => {
    parseCallbackResult().then(setResult);
  }, []);

  switch (result.state) {
    case "loading":         return <LoadingState />;
    case "verified":        return <VerifiedState />;
    case "password_reset":  return <PasswordResetReadyState />;
    case "email_changed":   return <EmailChangedState />;
    case "already_verified": return <AlreadyVerifiedState />;
    case "expired":         return <ExpiredState />;
    case "invalid":         return <InvalidState message={result.message} />;
    case "error":           return <ErrorState message={result.message} />;
  }
}
