import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { supabase } from "../lib/supabase";
import Navbar from "../components/layout/Navbar";
import Footer from "../components/layout/Footer";

type Status = "loading" | "accepting" | "success" | "error" | "need_login";

export default function AcceptInvite() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const hid = searchParams.get("hid");
  const [status, setStatus] = useState<Status>("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const [mismatchEmail, setMismatchEmail] = useState<string | null>(null);

  useEffect(() => {
    if (!hid) {
      setStatus("error");
      setErrorMsg("Invalid invitation link.");
      return;
    }

    (async () => {
      try {
        // Check if user is logged in
        const { data: { session } } = await supabase.auth.getSession();

        if (!session) {
          // Not logged in — redirect to sign-in, come back after
          setStatus("need_login");
          return;
        }

        // Logged in — auto-accept the invite
        setStatus("accepting");

        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
        const res = await fetch(`${supabaseUrl}/functions/v1/accept-invite`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
            "apikey": import.meta.env.VITE_SUPABASE_ANON_KEY as string,
          },
          body: JSON.stringify({ householdId: hid }),
        });

        const body = await res.json();

        if (!res.ok) {
          if (body.sentTo) {
            setMismatchEmail(body.sentTo);
          }
          setStatus("error");
          setErrorMsg(body.error ?? "Failed to accept invitation.");
          return;
        }

        setStatus("success");
      } catch (e: any) {
        setStatus("error");
        setErrorMsg(e.message ?? "Something went wrong.");
      }
    })();
  }, [hid]);

  const handleSignIn = () => {
    // Store hid in sessionStorage so we can resume after sign-in
    if (hid) sessionStorage.setItem("pending_invite_hid", hid);
    navigate("/sign-in");
  };

  const handleSwitchAccount = async () => {
    if (hid) sessionStorage.setItem("pending_invite_hid", hid);
    await supabase.auth.signOut();
    navigate("/sign-in");
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "var(--bg)" }}>
      <Navbar />
      <main style={{
        flex: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "120px 24px 64px",
      }}>
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          style={{ textAlign: "center", maxWidth: 480 }}
        >
          {status === "loading" && (
            <>
              <motion.div
                initial={{ opacity: 0, scale: 0.92 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.6 }}
                style={{ fontSize: 48, marginBottom: 16 }}
              >
                🏠
              </motion.div>
              <h1 style={{ fontSize: "clamp(1.5rem, 3.5vw, 2rem)", fontWeight: 700, color: "var(--ink)", marginBottom: 14 }}>
                You're Invited!
              </h1>
              <p style={{ fontSize: 15, color: "var(--ink-2)", lineHeight: 1.7, marginBottom: 24 }}>
                Checking invitation...
              </p>
              <div className="spinner" style={{ width: 24, height: 24, border: "3px solid var(--border)", borderTopColor: "var(--accent)", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto" }} />
              <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
            </>
          )}

          {status === "accepting" && (
            <>
              <motion.div
                initial={{ opacity: 0, scale: 0.92 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.6 }}
                style={{ fontSize: 48, marginBottom: 16 }}
              >
                🏠
              </motion.div>
              <h1 style={{ fontSize: "clamp(1.5rem, 3.5vw, 2rem)", fontWeight: 700, color: "var(--ink)", marginBottom: 14 }}>
                Joining household...
              </h1>
              <p style={{ fontSize: 15, color: "var(--ink-2)", lineHeight: 1.7, marginBottom: 24 }}>
                Please wait while we accept your invitation.
              </p>
              <div style={{ width: 24, height: 24, border: "3px solid var(--border)", borderTopColor: "var(--accent)", borderRadius: "50", animation: "spin 0.8s linear infinite", margin: "0 auto" }} />
              <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
            </>
          )}

          {status === "need_login" && (
            <>
              <motion.div
                initial={{ opacity: 0, scale: 0.92 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.6 }}
                style={{ fontSize: 48, marginBottom: 16 }}
              >
                🔐
              </motion.div>
              <h1 style={{ fontSize: "clamp(1.5rem, 3.5vw, 2rem)", fontWeight: 700, color: "var(--ink)", marginBottom: 14 }}>
                Sign in required
              </h1>
              <p style={{ fontSize: 15, color: "var(--ink-2)", lineHeight: 1.7, marginBottom: 32, maxWidth: 360, margin: "0 auto 32px" }}>
                You need to sign in to accept this household invitation. If you don't have an account, create one first.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 12, alignItems: "center" }}>
                <button onClick={handleSignIn} className="btn-primary" style={{ minWidth: 200 }}>
                  Sign in to accept
                </button>
                <a href="/" className="btn-outline" style={{ minWidth: 200, textDecoration: "none" }}>
                  Go to Homepage
                </a>
              </div>
            </>
          )}

          {status === "success" && (
            <>
              <motion.div
                initial={{ opacity: 0, scale: 0.92 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.6 }}
                style={{ fontSize: 48, marginBottom: 16 }}
              >
                ✅
              </motion.div>
              <h1 style={{ fontSize: "clamp(1.5rem, 3.5vw, 2rem)", fontWeight: 700, color: "var(--ink)", marginBottom: 14 }}>
                Welcome to the household!
              </h1>
              <p style={{ fontSize: 15, color: "var(--ink-2)", lineHeight: 1.7, marginBottom: 32, maxWidth: 360, margin: "0 auto 32px" }}>
                You've joined the household. Open the Bill Reminder app to see and manage shared bills.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 12, alignItems: "center" }}>
                <a href={`bill-reminder://accept-invite?hid=${hid}`} className="btn-primary" style={{ minWidth: 200, textDecoration: "none" }}>
                  Open in App
                </a>
                <a href="/" className="btn-outline" style={{ minWidth: 200, textDecoration: "none" }}>
                  Go to Homepage
                </a>
              </div>
            </>
          )}

          {status === "error" && (
            <>
              <motion.div
                initial={{ opacity: 0, scale: 0.92 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.6 }}
                style={{ fontSize: 48, marginBottom: 16 }}
              >
                ❌
              </motion.div>
              <h1 style={{ fontSize: "clamp(1.5rem, 3.5vw, 2rem)", fontWeight: 700, color: "var(--ink)", marginBottom: 14 }}>
                Something went wrong
              </h1>
              <p style={{ fontSize: 15, color: "var(--ink-2)", lineHeight: 1.7, marginBottom: 32, maxWidth: 360, margin: "0 auto 32px" }}>
                {errorMsg}
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 12, alignItems: "center" }}>
                {mismatchEmail && (
                  <>
                    <button onClick={handleSwitchAccount} className="btn-primary" style={{ minWidth: 200 }}>
                      Sign in as {mismatchEmail}
                    </button>
                    <a href="/" className="btn-outline" style={{ minWidth: 200, textDecoration: "none" }}>
                      Go to Homepage
                    </a>
                  </>
                )}
                {!mismatchEmail && (
                  <a href="/" className="btn-primary" style={{ minWidth: 200, textDecoration: "none" }}>
                    Go to Homepage
                  </a>
                )}
              </div>
            </>
          )}

          {hid && status !== "loading" && status !== "accepting" && (
            <div style={{ marginTop: 32, fontSize: 11, color: "var(--ink-4)" }}>
              Invitation ID: <code style={{ fontSize: 11 }}>{hid}</code>
            </div>
          )}
        </motion.div>
      </main>
      <Footer />
    </div>
  );
}
