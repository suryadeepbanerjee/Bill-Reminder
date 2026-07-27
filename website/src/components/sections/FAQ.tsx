import { motion, useInView } from "framer-motion";
import { useRef } from "react";

const faqs = [
  {
    q: "Is Bill Reminder free?",
    a: "Yes — completely free. There are no subscription tiers, no feature gates, and no in-app purchases. It's MIT licensed open source software.",
  },
  {
    q: "Does it store my bank credentials?",
    a: "No. Bill Reminder never asks for bank credentials, card numbers, or financial institution access. You manually enter bill names and amounts. Nothing is connected to your bank.",
  },
  {
    q: "Does it work without internet?",
    a: "Yes. Every feature is available offline. When you reconnect, changes sync automatically across your devices via Supabase.",
  },
  {
    q: "Is there an iOS version?",
    a: "Not yet. The app currently ships on Android. iOS is on the roadmap — star the GitHub repository to follow progress.",
  },
  {
    q: "Can I export my data?",
    a: "Yes. You can request a full export of your data at any time by emailing support. We'll respond within 30 days.",
  },
  {
    q: "Who can see my bills?",
    a: "Only you. Each account uses row-level security at the database layer — no query, even from the server, can read another user's data.",
  },
];

export default function FAQ() {
  const ref    = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <section id="faq" ref={ref} className="section" aria-labelledby="faq-heading">
      <div className="container">
        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 48 }} className="faq-grid">
          {/* Left: heading */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5 }}
          >
            <h2 id="faq-heading" style={{
              fontSize: "clamp(1.8rem, 3.5vw, 2.6rem)",
              fontWeight: 800, letterSpacing: "-0.025em", color: "var(--ink)",
              textWrap: "balance" as any, marginBottom: 14,
            }}>
              Frequently asked questions
            </h2>
            <p style={{ fontSize: 15, color: "var(--ink-2)", maxWidth: "36ch", lineHeight: 1.65 }}>
              Still have questions?{" "}
              <a href="https://github.com/suryadeepbanerjee/Bill-Reminder/issues" target="_blank" rel="noopener noreferrer"
                style={{ color: "var(--brand)", textDecoration: "none" }}>
                Open an issue on GitHub.
              </a>
            </p>
          </motion.div>

          {/* Right: Q&A */}
          <div>
            {faqs.map((faq, i) => (
              <motion.div
                key={faq.q}
                initial={{ opacity: 0, y: 16 }}
                animate={inView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.4, delay: i * 0.07 }}
                style={{
                  paddingBottom: 24, marginBottom: 24,
                  borderBottom: i < faqs.length - 1 ? "1px solid var(--border)" : "none",
                }}
              >
                <h3 style={{
                  fontSize: 15, fontWeight: 600, color: "var(--ink)",
                  letterSpacing: "-0.01em", marginBottom: 8,
                }}>
                  {faq.q}
                </h3>
                <p style={{ fontSize: 13.5, color: "var(--ink-2)", lineHeight: 1.65, maxWidth: "58ch" }}>
                  {faq.a}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      <style>{`
        @media (min-width: 820px) {
          .faq-grid { grid-template-columns: 1fr 1.8fr !important; }
        }
      `}</style>
    </section>
  );
}
