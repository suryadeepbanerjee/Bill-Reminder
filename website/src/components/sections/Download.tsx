import { motion, useInView } from "framer-motion";
import { useRef } from "react";

export default function Download() {
  const ref    = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <section id="download" ref={ref} className="section"
      style={{ background: "var(--surface-1)", borderTop: "1px solid var(--border)" }}
      aria-labelledby="download-heading"
    >
      <div className="container">
        <div style={{ maxWidth: 560 }}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.55 }}
          >
            <h2 id="download-heading" style={{
              fontSize: "clamp(1.8rem, 3.5vw, 2.6rem)",
              fontWeight: 800, letterSpacing: "-0.025em", color: "var(--ink)",
              textWrap: "balance" as any, marginBottom: 14,
            }}>
              Start tracking today. It's free.
            </h2>
            <p style={{ fontSize: 16, color: "var(--ink-2)", lineHeight: 1.65, marginBottom: 32 }}>
              Download the Android APK directly from GitHub Releases. No app store, no registration required to run the app.
            </p>

            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <motion.a
                href="https://github.com/suryadeepbanerjee/Bill-Reminder/releases/latest"
                target="_blank"
                rel="noopener noreferrer"
                className="btn-primary"
                style={{ padding: "12px 24px", fontSize: 15 }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
                </svg>
                Download APK
              </motion.a>

              <motion.a
                href="https://github.com/suryadeepbanerjee/Bill-Reminder"
                target="_blank"
                rel="noopener noreferrer"
                className="btn-outline"
                style={{ padding: "11px 24px", fontSize: 15 }}
                whileHover={{ scale: 1.01 }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/>
                </svg>
                View on GitHub
              </motion.a>
            </div>

            <p style={{ marginTop: 20, fontSize: 13, color: "var(--ink-3)" }}>
              iOS version is planned.{" "}
              <a href="https://github.com/suryadeepbanerjee/Bill-Reminder" target="_blank" rel="noopener noreferrer"
                style={{ color: "var(--ink-2)", textDecoration: "underline", textUnderlineOffset: 3 }}>
                Star the repo
              </a>{" "}
              to follow progress.
            </p>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
