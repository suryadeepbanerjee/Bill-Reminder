import { motion, useInView } from "framer-motion";
import { useRef } from "react";

const steps = [
  {
    title: "Add your bills",
    body: "Enter any recurring payment in seconds — subscriptions, utilities, EMIs, rent, or insurance. Set the amount, start date, and billing cycle.",
    detail: (
      <div style={{ marginTop: 16 }}>
        {[
          { name: "Netflix", cycle: "Monthly", amount: "₹649" },
          { name: "Home Loan EMI", cycle: "Monthly", amount: "₹18,000" },
          { name: "Electricity", cycle: "Bi-monthly", amount: "₹1,200" },
        ].map((b, i) => (
          <div key={i} style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            padding: "8px 12px", marginBottom: 6,
            background: "var(--surface-2)", borderRadius: 8,
            border: "1px solid var(--border)",
          }}>
            <div>
              <p style={{ fontSize: 12, fontWeight: 600, color: "var(--ink)" }}>{b.name}</p>
              <p style={{ fontSize: 10, color: "var(--ink-3)" }}>{b.cycle}</p>
            </div>
            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", fontVariantNumeric: "tabular-nums" }}>{b.amount}</span>
          </div>
        ))}
      </div>
    ),
  },
  {
    title: "Set your reminders",
    body: "Choose when you want to be notified — 7 days before, 3 days, the day before, and on the due date. Push and email notifications both supported.",
    detail: (
      <div style={{ marginTop: 16 }}>
        {[
          { label: "7 days before", on: true },
          { label: "3 days before", on: true },
          { label: "Day before",    on: true },
          { label: "On due date",   on: true },
          { label: "Day after (overdue)", on: false },
        ].map((r, i) => (
          <div key={i} style={{
            display: "flex", alignItems: "center", gap: 10,
            padding: "7px 0",
            borderBottom: i < 4 ? "1px solid var(--border)" : "none",
          }}>
            <div style={{
              width: 16, height: 16, borderRadius: 4,
              border: `1px solid ${r.on ? "var(--brand)" : "var(--border)"}`,
              background: r.on ? "var(--brand)" : "transparent",
              display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0,
            }}>
              {r.on && (
                <svg width="10" height="10" fill="none" viewBox="0 0 10 10" stroke="white" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M1.5 5l2.5 2.5L8.5 2" />
                </svg>
              )}
            </div>
            <span style={{ fontSize: 12, color: r.on ? "var(--ink-2)" : "var(--ink-3)" }}>{r.label}</span>
          </div>
        ))}
      </div>
    ),
  },
  {
    title: "Mark as paid — or don't",
    body: "One tap to mark a bill as paid. Bill Reminder tracks the full history so you always know what's been settled and what's still pending.",
    detail: (
      <div style={{ marginTop: 16 }}>
        <div style={{
          padding: "12px 14px",
          background: "rgba(130,119,247,0.08)",
          border: "1px solid rgba(130,119,247,0.18)",
          borderRadius: 10, marginBottom: 10,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(130,119,247,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="var(--brand)" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            </div>
            <div>
              <p style={{ fontSize: 12, fontWeight: 600, color: "var(--ink)" }}>Netflix due in 2 days</p>
              <p style={{ fontSize: 10, color: "var(--ink-3)" }}>₹649 · Tap to mark as paid</p>
            </div>
          </div>
        </div>
        <div style={{
          display: "flex", gap: 8, alignItems: "center",
          padding: "10px 14px",
          background: "var(--surface-2)", border: "1px solid var(--border)",
          borderRadius: 10,
        }}>
          <div style={{ width: 20, height: 20, borderRadius: 10, background: "rgba(52,211,153,0.15)", border: "1px solid rgba(52,211,153,0.3)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="11" height="11" fill="none" viewBox="0 0 11 11" stroke="#34d399" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M1.5 5.5L4 8 9.5 2.5" />
            </svg>
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: "var(--ink)" }}>Spotify</p>
            <p style={{ fontSize: 10, color: "#34d399" }}>Paid · 4 days ago</p>
          </div>
          <span style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-2)", fontVariantNumeric: "tabular-nums" }}>₹119</span>
        </div>
      </div>
    ),
  },
];

export default function HowItWorks() {
  const ref    = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <section id="how-it-works" ref={ref} className="section" aria-labelledby="how-it-works-heading"
      style={{ background: "var(--surface-1)", borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)" }}
    >
      <div className="container">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.55 }}
          style={{ marginBottom: 56 }}
        >
          <h2 id="how-it-works-heading" style={{
            fontSize: "clamp(1.8rem, 3.5vw, 2.6rem)",
            fontWeight: 800, letterSpacing: "-0.025em", color: "var(--ink)",
            textWrap: "balance" as any, marginBottom: 14,
          }}>
            Up and running in under a minute.
          </h2>
          <p style={{ fontSize: 16, color: "var(--ink-2)", maxWidth: "48ch", lineHeight: 1.65 }}>
            Three steps. No manual required.
          </p>
        </motion.div>

        <div style={{
          display: "grid",
          gap: 24,
          gridTemplateColumns: "1fr",
        }} className="steps-grid">
          {steps.map((step, i) => (
            <motion.div
              key={step.title}
              initial={{ opacity: 0, y: 24 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="card"
              style={{ padding: "28px 28px" }}
            >
              <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 8,
                  background: "var(--brand-faint)", border: "1px solid var(--brand-border)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0, fontFamily: "monospace",
                  fontSize: 13, fontWeight: 700, color: "var(--brand)",
                }}>
                  {String(i + 1).padStart(2, "0")}
                </div>
                <div style={{ flex: 1 }}>
                  <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)", letterSpacing: "-0.015em", marginBottom: 8 }}>
                    {step.title}
                  </h3>
                  <p style={{ fontSize: 13.5, color: "var(--ink-2)", lineHeight: 1.65, maxWidth: "42ch" }}>
                    {step.body}
                  </p>
                  {step.detail}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      <style>{`
        @media (min-width: 900px) {
          .steps-grid { grid-template-columns: repeat(3, 1fr) !important; }
        }
      `}</style>
    </section>
  );
}
