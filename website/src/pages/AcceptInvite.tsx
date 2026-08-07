import { useEffect, useState } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { supabase } from "../lib/supabase";
import { friendlyError } from "@shared/utils/errors";
import Navbar from "../components/layout/Navbar";
import Footer from "../components/layout/Footer";

type Status = "loading" | "accepting" | "success" | "error" | "need_login";

const supabaseUrl   = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnon  = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export default function AcceptInvite() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const code = searchParams.get("code");   // invite row ID — one-time token
  const hid  = searchParams.get("hid");    // household ID for verification

  const [status, setStatus]         = useState<Status>("loading");
  const [errorMsg, setErrorMsg]     = useState("");
  const [mismatchEmail, setMismatchEmail] = useState<string | null>(null);

  useEffect(() => {
    // ── New flow: code present → no login required ──────────────────────────
    if (code && hid) {
      setStatus("accepting");
      fetch(`${supabaseUrl}/functions/v1/accept-invite-by-code`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": supabaseAnon,
        },
        body: JSON.stringify({ code, householdId: hid }),
      })
        .then(async (res) => {
          const body = await res.json();
          if (!res.ok) {
            setStatus("error");
            setErrorMsg(body.error ?? "Failed to accept invitation.");
            return;
          }
          setStatus("success");
        })
        .catch((e) => {
          setStatus("error");
          setErrorMsg(friendlyError(e));
        });
      return;
    }

    // ── Legacy / fallback: only hid, no code → require login ───────────────
    if (!hid) {
      setStatus("error");
      setErrorMsg("Invalid invitation link. Please ask for a new invite.");
      return;
    }

    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          setStatus("need_login");
          return;
        }
        setStatus("accepting");
        const res = await fetch(`${supabaseUrl}/functions/v1/accept-invite`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
            "apikey": supabaseAnon,
          },
          body: JSON.stringify({ householdId: hid }),
        });
        const body = await res.json();
        if (!res.ok) {
          if (body.sentTo) setMismatchEmail(body.sentTo);
          setStatus("error");
          setErrorMsg(body.error ?? "Failed to accept invitation.");
          return;
        }
        setStatus("success");
      } catch (e: any) {
        setStatus("error");
        setErrorMsg(friendlyError(e));
      }
    })();
  }, [code, hid]);

  const handleSignIn = () => {
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
          {/* ── Loading / Accepting spinners ── */}
          {(status === "loading" || status === "accepting") && (
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
                {status === "loading" ? "You're Invited!" : "Joining household…"}
              </h1>
              <p style={{ fontSize: 15, color: "var(--ink-2)", lineHeight: 1.7, marginBottom: 24 }}>
                {status === "loading" ? "Checking invitation…" : "Please wait while we add you to the household."}
              </p>
              <div style={{ width: 24, height: 24, border: "3px solid var(--border)", borderTopColor: "var(--accent)", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto" }} />
              <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
            </>
          )}

          {/* ── Success ── */}
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
                You've successfully joined the household. Open the Bill Reminder app to see and manage shared bills.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 12, alignItems: "center" }}>
                <Link to="/" className="btn-primary" style={{ minWidth: 200, textDecoration: "none" }}>
                  Go to Homepage
                </Link>
              </div>
            </>
          )}

          {/* ── Need login (legacy links without code) ── */}
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
                This invite link is outdated. Please ask the household admin to resend the invitation, or sign in and accept from the app.
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

          {/* ── Error ── */}
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
        </motion.div>
      </main>
      <Footer />
    </div>
  );
}
