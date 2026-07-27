import { ReactNode } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";

interface AuthLayoutProps {
  children: ReactNode;
  title: string;
  subtitle: string;
}

export default function AuthLayout({ children, title, subtitle }: AuthLayoutProps) {
  return (
    <div style={{
      minHeight: "100vh",
      background: "var(--bg)",
      display: "flex",
      flexDirection: "column",
    }}>
      {/* Top nav */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        maxWidth: 1120, margin: "0 auto", width: "100%",
        padding: "18px 24px",
      }}>
        <Link to="/" style={{
          display: "flex", alignItems: "center", gap: 8,
          textDecoration: "none", color: "var(--ink-2)",
          fontWeight: 600, fontSize: 14, letterSpacing: "-0.01em",
          transition: "color 150ms",
        }}
          onMouseEnter={e => (e.currentTarget.style.color = "var(--ink)")}
          onMouseLeave={e => (e.currentTarget.style.color = "var(--ink-2)")}
        >
          <div style={{
            width: 26, height: 26, borderRadius: 7,
            background: "var(--brand)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <svg width="14" height="14" viewBox="0 0 18 18" fill="none">
              <path d="M9 2C6.79 2 5 3.68 5 5.75V11H13V5.75C13 3.68 11.21 2 9 2Z" fill="white"/>
              <rect x="4" y="10.5" width="10" height="1.25" rx="0.625" fill="white"/>
              <circle cx="9" cy="13.5" r="1.2" fill="white"/>
            </svg>
          </div>
          Bill Reminder
        </Link>
        <Link to="/" style={{
          fontSize: 13, color: "var(--ink-3)", textDecoration: "none",
          transition: "color 150ms",
        }}
          onMouseEnter={e => (e.currentTarget.style.color = "var(--ink-2)")}
          onMouseLeave={e => (e.currentTarget.style.color = "var(--ink-3)")}
        >
          ← Back to home
        </Link>
      </div>

      {/* Card area */}
      <div style={{
        flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
        padding: "16px 24px 48px",
      }}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          style={{ width: "100%", maxWidth: 400 }}
        >
          <div className="card" style={{ padding: "36px 36px" }}>
            <div style={{ marginBottom: 28 }}>
              <h1 style={{
                fontSize: 22, fontWeight: 800, color: "var(--ink)",
                letterSpacing: "-0.025em", marginBottom: 6,
              }}>
                {title}
              </h1>
              <p style={{ fontSize: 14, color: "var(--ink-2)", lineHeight: 1.6 }}>
                {subtitle}
              </p>
            </div>
            {children}
          </div>
        </motion.div>
      </div>

      {/* Footer note */}
      <div style={{ textAlign: "center", paddingBottom: 24 }}>
        <p style={{ fontSize: 12, color: "var(--ink-4)" }}>
          © {new Date().getFullYear()} Bill Reminder ·{" "}
          <Link to="/privacy" style={{ color: "var(--ink-3)", textDecoration: "none" }}>Privacy</Link>
          {" · "}
          <Link to="/terms" style={{ color: "var(--ink-3)", textDecoration: "none" }}>Terms</Link>
        </p>
      </div>
    </div>
  );
}
