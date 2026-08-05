import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "../lib/supabase";
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

function Field({ label, id, children }: { label: string; id: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <label htmlFor={id} className="block text-[13px] font-medium text-secondary mb-1.5">
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

export default function SignIn() {
  const navigate = useNavigate();
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw]     = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [loading, setLoading]   = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const anyLoading = loading || googleLoading;

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
      // After sign-in, check if there's a pending invite to accept
      const pendingHid = sessionStorage.getItem("pending_invite_hid");
      if (pendingHid) {
        sessionStorage.removeItem("pending_invite_hid");
        navigate(`/accept-invite?hid=${pendingHid}`);
      } else {
        navigate("/app/dashboard");
      }
    } catch { setError("Something went wrong. Please try again."); }
    finally { setLoading(false); }
  };

  const handleGoogle = async () => {
    setError(null);
    setGoogleLoading(true);
    try {
      // Store pending invite before OAuth redirect (sessionStorage persists across redirects)
      const pendingHid = sessionStorage.getItem("pending_invite_hid");
      const redirectTo = pendingHid
        ? `${window.location.origin}/accept-invite?hid=${pendingHid}`
        : `${window.location.origin}/auth/callback`;
      await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo },
      });
    } catch {
      setError("Could not start Google sign-in. Please try again.");
      setGoogleLoading(false);
    }
  };

  return (
    <AuthLayout title="Welcome back" subtitle="Sign in to continue tracking your bills">
      <form onSubmit={handleSubmit} noValidate>
        {error && <ErrorAlert message={error} />}

        <div className="mb-4">
          <TextInput
            label="Email"
            id="si-email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your@email.com"
          />
        </div>

        <div className="mb-1">
          <div className="relative">
            <TextInput
              label="Password"
              id="si-password"
              type={showPw ? "text" : "password"}
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Your password"
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPw(v => !v)}
              className="absolute right-3 top-[26px] bg-transparent border-none cursor-pointer text-secondary/70 hover:text-secondary p-0.5"
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
          <div className="text-right mt-1.5">
            <Link to="/forgot-password" className="text-xs text-accent no-underline hover:underline">
              Forgot password?
            </Link>
          </div>
        </div>

        <Button type="submit" disabled={anyLoading} className="w-full justify-center mt-4 h-11" loading={loading}>
          Sign in
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

        {/* OTP code — separate page */}
        <Link to="/sign-in-code" className="mt-3 no-underline">
          <Button variant="ghost" className="w-full justify-center flex gap-2 h-11" icon={
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"/>
            </svg>
          }>
            Sign in with code
          </Button>
        </Link>
      </form>

      <p className="text-center text-[13px] text-secondary mt-6">
        Don't have an account?{" "}
        <Link to="/sign-up" className="text-accent no-underline font-medium hover:underline">Sign up</Link>
      </p>
    </AuthLayout>
  );
}
