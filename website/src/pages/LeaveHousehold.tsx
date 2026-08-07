import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { friendlyError } from "@shared/utils/errors";
import Navbar from "../components/layout/Navbar";
import Footer from "../components/layout/Footer";

type Status = "loading" | "confirming" | "success" | "error" | "invalid";

const supabaseUrl  = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnon = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export default function LeaveHousehold() {
  const [searchParams] = useSearchParams();
  const code = searchParams.get("code");   // membership row ID — one-time token
  const hid  = searchParams.get("hid");    // household ID for verification

  const [status, setStatus] = useState<Status>("loading");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (!code || !hid) {
      setStatus("invalid");
      return;
    }

    setStatus("confirming");
    fetch(`${supabaseUrl}/functions/v1/leave-household-by-code`, {
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
          setErrorMsg(body.error ?? "Failed to leave the household.");
          return;
        }
        setStatus("success");
      })
      .catch((e) => {
        setStatus("error");
        setErrorMsg(friendlyError(e));
      });
  }, [code, hid]);

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
          {/* ── Loading / Confirming spinner ── */}
          {(status === "loading" || status === "confirming") && (
            <>
              <motion.div
                initial={{ opacity: 0, scale: 0.92 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.6 }}
                style={{ fontSize: 48, marginBottom: 16 }}
              >
                🚪
              </motion.div>
              <h1 style={{ fontSize: "clamp(1.5rem, 3.5vw, 2rem)", fontWeight: 700, color: "var(--ink)", marginBottom: 14 }}>
                {status === "loading" ? "One more step…" : "Leaving the household…"}
              </h1>
              <p style={{ fontSize: 15, color: "var(--ink-2)", lineHeight: 1.7, marginBottom: 24 }}>
                {status === "loading" ? "Checking the link…" : "Please wait while we confirm your leave."}
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
                👋
              </motion.div>
              <h1 style={{ fontSize: "clamp(1.5rem, 3.5vw, 2rem)", fontWeight: 700, color: "var(--ink)", marginBottom: 14 }}>
                You've left the household
              </h1>
              <p style={{ fontSize: 15, color: "var(--ink-2)", lineHeight: 1.7, marginBottom: 32, maxWidth: 360, margin: "0 auto 32px" }}>
                You no longer have access to that household's bills. The household admin can invite you back anytime.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 12, alignItems: "center" }}>
                <Link to="/" className="btn-primary" style={{ minWidth: 200, textDecoration: "none" }}>
                  Go to Homepage
                </Link>
              </div>
            </>
          )}

          {/* ── Invalid link ── */}
          {status === "invalid" && (
            <>
              <motion.div
                initial={{ opacity: 0, scale: 0.92 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.6 }}
                style={{ fontSize: 48, marginBottom: 16 }}
              >
                🔗
              </motion.div>
              <h1 style={{ fontSize: "clamp(1.5rem, 3.5vw, 2rem)", fontWeight: 700, color: "var(--ink)", marginBottom: 14 }}>
                Invalid link
              </h1>
              <p style={{ fontSize: 15, color: "var(--ink-2)", lineHeight: 1.7, marginBottom: 32, maxWidth: 360, margin: "0 auto 32px" }}>
                This confirmation link is missing required information. Please request to leave again from the app.
              </p>
              <Link to="/" className="btn-primary" style={{ minWidth: 200, textDecoration: "none" }}>
                Go to Homepage
              </Link>
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
              <Link to="/" className="btn-primary" style={{ minWidth: 200, textDecoration: "none" }}>
                Go to Homepage
              </Link>
            </>
          )}
        </motion.div>
      </main>
      <Footer />
    </div>
  );
}