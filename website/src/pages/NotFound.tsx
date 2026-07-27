import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import Navbar from "../components/layout/Navbar";
import Footer from "../components/layout/Footer";

export default function NotFound() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "var(--bg)" }}>
      <Navbar />
      <main style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "120px 24px 64px" }}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          style={{ textAlign: "center", maxWidth: 400 }}
        >
          <p style={{ fontFamily: "monospace", fontSize: 13, color: "var(--brand)", fontWeight: 700, marginBottom: 16, letterSpacing: "0.04em" }}>
            404
          </p>
          <h1 style={{
            fontSize: "clamp(1.6rem, 3vw, 2.2rem)",
            fontWeight: 800, letterSpacing: "-0.025em",
            color: "var(--ink)", marginBottom: 12,
          }}>
            Page not found
          </h1>
          <p style={{ fontSize: 15, color: "var(--ink-2)", lineHeight: 1.65, marginBottom: 36 }}>
            This page doesn't exist or has been moved. Head back home and we'll get you sorted.
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <Link to="/" className="btn-primary">Go home</Link>
            <Link to="/sign-in" className="btn-outline">Sign in</Link>
          </div>
        </motion.div>
      </main>
      <Footer />
    </div>
  );
}
