import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import Navbar from "../components/layout/Navbar";
import Footer from "../components/layout/Footer";

export default function NotFound() {
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
          {/* Large 404 */}
          <motion.div
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            style={{
              fontSize: "clamp(6rem, 18vw, 10rem)",
              fontWeight: 900,
              letterSpacing: "-0.06em",
              lineHeight: 1,
              color: "transparent",
              backgroundImage: "linear-gradient(135deg, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0.22) 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
              marginBottom: 24,
              userSelect: "none",
            }}
            aria-hidden="true"
          >
            404
          </motion.div>

          {/* Heading */}
          <h1 style={{
            fontSize: "clamp(1.5rem, 3.5vw, 2rem)",
            fontWeight: 700,
            letterSpacing: "-0.025em",
            color: "var(--ink)",
            marginBottom: 14,
          }}>
            Page not found
          </h1>

          {/* Subtext */}
          <p style={{
            fontSize: 15,
            color: "var(--ink-2)",
            lineHeight: 1.7,
            marginBottom: 40,
            maxWidth: 360,
            margin: "0 auto 40px",
          }}>
            This page doesn't exist or may have been moved. It's also possible you arrived here by following an old link.
          </p>

          {/* Actions */}
          <div style={{
            display: "flex",
            gap: 12,
            justifyContent: "center",
            flexWrap: "wrap",
          }}>
            <Link to="/" className="btn-primary">
              Return home
            </Link>
            <Link to="/sign-in" className="btn-outline">
              Sign in
            </Link>
            <a
              href="https://github.com/suryadeepbanerjee/Bill-Reminder"
              target="_blank"
              rel="noopener noreferrer"
              className="btn-ghost"
            >
              <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/>
              </svg>
              GitHub
            </a>
          </div>

          {/* Subtle decoration */}
          <div
            style={{
              marginTop: 60,
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "6px 14px",
              borderRadius: 99,
              border: "1px solid var(--border)",
              color: "var(--ink-4)",
              fontSize: 12,
            }}
          >
            <span aria-hidden="true">↩</span>
            Go back in your browser to the previous page
          </div>
        </motion.div>
      </main>
      <Footer />
    </div>
  );
}
