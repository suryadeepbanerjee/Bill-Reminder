import { motion, useInView } from "framer-motion";
import { useRef } from "react";

const features = [
  {
    title: "Smart Reminders",
    body: "Customisable alerts at 7 days, 3 days, 1 day, and on the due date. Never pay a late fee again.",
    icon: (
      <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
      </svg>
    ),
  },
  {
    title: "Any Billing Cycle",
    body: "Weekly, monthly, quarterly, annually — any recurring payment across subscriptions, utilities, EMIs, and insurance.",
    icon: (
      <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    title: "Offline First",
    body: "Every feature works without internet. Your bills are always accessible, and changes sync automatically.",
    icon: (
      <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 5.636a9 9 0 010 12.728M15.536 8.464a5 5 0 010 7.072M6.343 6.343a9 9 0 000 12.728M9.172 9.172a5 5 0 000 7.071M12 12h.01" />
      </svg>
    ),
  },
  {
    title: "Categories",
    body: "Group bills into labelled categories with custom colours. See exactly where your money goes each month.",
    icon: (
      <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
      </svg>
    ),
  },
  {
    title: "Payment History",
    body: "Every bill, every cycle, every payment — logged. Review past payments and track spending trends over time.",
    icon: (
      <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
      </svg>
    ),
  },
  {
    title: "Secure Cloud Sync",
    body: "Row-level security means no query can ever read another user's data. Your financial data is private by design.",
    icon: (
      <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
      </svg>
    ),
  },
];

export default function Features() {
  const ref    = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <section id="features" ref={ref} className="section" style={{ position: "relative" }} aria-labelledby="features-heading">
      {/* Subtle side ambient — not a decorative grid */}
      <div style={{
        position: "absolute", top: 0, right: 0,
        width: 400, height: 400,
        background: "radial-gradient(ellipse at top right, rgba(130,119,247,0.06) 0%, transparent 70%)",
        pointerEvents: "none",
      }} aria-hidden="true" />

      <div className="container">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.55 }}
          style={{ marginBottom: 56 }}
        >
          <h2 id="features-heading" style={{
            fontSize: "clamp(1.8rem, 3.5vw, 2.6rem)",
            fontWeight: 800,
            letterSpacing: "-0.025em",
            color: "var(--ink)",
            textWrap: "balance" as any,
            marginBottom: 14,
          }}>
            One purpose. Done right.
          </h2>
          <p style={{ fontSize: 16, color: "var(--ink-2)", maxWidth: "52ch", lineHeight: 1.65 }}>
            No bloat, no subscription tiers, no dark patterns. Bill Reminder does exactly one thing — and it does it exceptionally well.
          </p>
        </motion.div>

        {/* Feature list — not identical card grid; uses size variation */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: 2,
        }}>
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 20 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.45, delay: i * 0.06 }}
              style={{
                padding: "28px 28px",
                border: "1px solid var(--border)",
                borderRadius: 0,
                background: "transparent",
                transition: "background 180ms",
                // First item spans 2 cols on large screen for size variation
              }}
              className={i === 0 ? "feature-hero" : ""}
              onMouseEnter={e => (e.currentTarget.style.background = "var(--surface-1)")}
              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
            >
              <div style={{
                width: 36, height: 36, borderRadius: 9,
                background: "var(--surface-2)",
                border: "1px solid var(--border)",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "var(--brand)",
                marginBottom: 16,
              }}>
                {f.icon}
              </div>
              <h3 style={{
                fontSize: 15, fontWeight: 600, color: "var(--ink)",
                letterSpacing: "-0.015em", marginBottom: 8,
              }}>
                {f.title}
              </h3>
              <p style={{ fontSize: 13.5, color: "var(--ink-2)", lineHeight: 1.65, maxWidth: "32ch" }}>
                {f.body}
              </p>
            </motion.div>
          ))}
        </div>
      </div>

      <style>{`
        @media (min-width: 900px) {
          .feature-hero { grid-column: span 2; }
        }
      `}</style>
    </section>
  );
}
