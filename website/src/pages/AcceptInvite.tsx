import { useSearchParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import Navbar from "../components/layout/Navbar";
import Footer from "../components/layout/Footer";

export default function AcceptInvite() {
  const [searchParams] = useSearchParams();
  const hid = searchParams.get("hid");

  const deepLink = `bill-reminder://accept-invite?hid=${hid || ""}`;

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
          {/* House emoji */}
          <motion.div
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            style={{ fontSize: 48, marginBottom: 16 }}
          >
            🏠
          </motion.div>

          {/* Heading */}
          <h1 style={{
            fontSize: "clamp(1.5rem, 3.5vw, 2rem)",
            fontWeight: 700,
            letterSpacing: "-0.025em",
            color: "var(--ink)",
            marginBottom: 14,
          }}>
            You're Invited!
          </h1>

          {/* Subtext */}
          <p style={{
            fontSize: 15,
            color: "var(--ink-2)",
            lineHeight: 1.7,
            marginBottom: 32,
            maxWidth: 360,
            margin: "0 auto 32px",
          }}>
            You've been invited to join a household on Bill Reminder. Open the app to accept this invitation.
          </p>

          {/* Actions */}
          <div style={{
            display: "flex",
            flexDirection: "column",
            gap: 12,
            alignItems: "center",
          }}>
            <a
              href={deepLink}
              className="btn-primary"
              style={{ minWidth: 200, textDecoration: "none" }}
            >
              Open in App
            </a>

            <Link to="/" className="btn-outline" style={{ minWidth: 200 }}>
              Go to Homepage
            </Link>
          </div>

          {/* Install prompt */}
          <div style={{
            marginTop: 48,
            padding: "16px 20px",
            borderRadius: 12,
            border: "1px solid var(--border)",
            background: "var(--surface)",
          }}>
            <p style={{
              fontSize: 13,
              color: "var(--ink-3)",
              lineHeight: 1.6,
              margin: 0,
            }}>
              Don't have the app?{" "}
              <a
                href="https://play.google.com/store/apps/details?id=com.billreminder.app"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: "var(--accent)", textDecoration: "none", fontWeight: 600 }}
              >
                Install on Android
              </a>
              {" "}or{" "}
              <a
                href="https://apps.apple.com/app/bill-reminder/id0000000000"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: "var(--accent)", textDecoration: "none", fontWeight: 600 }}
              >
                iOS
              </a>
            </p>
          </div>

          {hid && (
            <div style={{
              marginTop: 16,
              fontSize: 11,
              color: "var(--ink-4)",
            }}>
              Invitation ID: <code style={{ fontSize: 11 }}>{hid}</code>
            </div>
          )}
        </motion.div>
      </main>
      <Footer />
    </div>
  );
}
