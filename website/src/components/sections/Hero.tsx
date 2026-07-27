import { motion } from "framer-motion";
import { Link } from "react-router-dom";

/* Bill card shown in the phone mockup */
function BillCard({
  emoji, name, amount, category, daysLeft, paid,
}: {
  emoji: string; name: string; amount: string;
  category: string; daysLeft?: number; paid?: boolean;
}) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10,
      padding: "10px 0",
      borderBottom: "1px solid rgba(255,255,255,0.06)",
    }}>
      <div style={{
        width: 34, height: 34, borderRadius: 9,
        background: "rgba(130,119,247,0.12)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 16, flexShrink: 0,
      }}>
        {emoji}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 12, fontWeight: 600, color: "#e8e8f0", marginBottom: 2 }}>{name}</p>
        <p style={{ fontSize: 10, color: "rgba(232,232,240,0.45)" }}>{category}</p>
      </div>
      <div style={{ textAlign: "right", flexShrink: 0 }}>
        <p style={{ fontSize: 12, fontWeight: 700, color: "#e8e8f0", marginBottom: 2 }}>{amount}</p>
        {paid ? (
          <p style={{ fontSize: 10, color: "#34d399" }}>✓ Paid</p>
        ) : (
          <p style={{ fontSize: 10, color: daysLeft! <= 2 ? "#f87171" : "rgba(232,232,240,0.45)" }}>
            {daysLeft === 0 ? "Due today" : `${daysLeft}d left`}
          </p>
        )}
      </div>
    </div>
  );
}

function PhoneMockup() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24, rotateX: 6 }}
      animate={{ opacity: 1, y: 0, rotateX: 0 }}
      transition={{ duration: 0.9, delay: 0.35, ease: [0.16, 1, 0.3, 1] }}
      style={{ perspective: 1000 }}
    >
      <div style={{
        width: 260,
        background: "#0c0c1a",
        border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: 32,
        padding: 12,
        boxShadow: "0 32px 64px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.05)",
        position: "relative",
      }}>
        {/* Screen */}
        <div style={{
          borderRadius: 22,
          overflow: "hidden",
          background: "#07070f",
        }}>
          {/* Status bar */}
          <div style={{ padding: "10px 16px 6px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 10, color: "rgba(232,232,240,0.5)", fontWeight: 600 }}>9:41</span>
            <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
              <div style={{ width: 12, height: 6, background: "#34d399", borderRadius: 2, opacity: 0.6 }} />
            </div>
          </div>

          {/* App content */}
          <div style={{ padding: "4px 14px 14px" }}>
            {/* Header */}
            <div style={{ marginBottom: 14 }}>
              <p style={{ fontSize: 10, color: "rgba(232,232,240,0.4)", marginBottom: 2 }}>Good morning,</p>
              <p style={{ fontSize: 15, fontWeight: 700, color: "#e8e8f0", letterSpacing: "-0.02em" }}>Surya 👋</p>
            </div>

            {/* Summary bar */}
            <div style={{
              display: "flex", gap: 8, marginBottom: 14,
            }}>
              {[
                { label: "Due this month", value: "₹4,850", color: "rgba(130,119,247,0.15)" },
                { label: "Overdue", value: "₹0", color: "rgba(52,211,153,0.1)" },
              ].map(c => (
                <div key={c.label} style={{
                  flex: 1, padding: "8px 10px", borderRadius: 10,
                  background: c.color, border: "1px solid rgba(255,255,255,0.06)",
                }}>
                  <p style={{ fontSize: 8, color: "rgba(232,232,240,0.45)", marginBottom: 3 }}>{c.label}</p>
                  <p style={{ fontSize: 13, fontWeight: 700, color: "#e8e8f0" }}>{c.value}</p>
                </div>
              ))}
            </div>

            {/* Bills */}
            <p style={{ fontSize: 9, color: "rgba(232,232,240,0.35)", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 4 }}>Upcoming</p>
            <BillCard emoji="📺" name="Netflix"   amount="₹649" category="Streaming"   daysLeft={2} />
            <BillCard emoji="🎵" name="Spotify"   amount="₹119" category="Music"       daysLeft={5} />
            <BillCard emoji="☁️" name="iCloud"    amount="₹75"  category="Storage"     paid />
            <BillCard emoji="⚡" name="Electricity" amount="₹1,200" category="Utilities" daysLeft={0} />
          </div>
        </div>

        {/* Home indicator */}
        <div style={{ display: "flex", justifyContent: "center", paddingTop: 8 }}>
          <div style={{ width: 60, height: 3, borderRadius: 99, background: "rgba(255,255,255,0.25)" }} />
        </div>
      </div>
    </motion.div>
  );
}

export default function Hero() {
  return (
    <section
      aria-labelledby="hero-heading"
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        paddingTop: 100,
        paddingBottom: 64,
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Ambient light — subtle, not decorative grid */}
      <div style={{
        position: "absolute",
        top: 0, left: 0, right: 0,
        height: 500,
        background: "radial-gradient(ellipse 80% 50% at 50% -10%, rgba(130,119,247,0.12) 0%, transparent 70%)",
        pointerEvents: "none",
      }} aria-hidden="true" />

      <div className="container">
        <div style={{
          display: "grid",
          gridTemplateColumns: "1fr",
          gap: 48,
          alignItems: "center",
        }} className="hero-grid">
          {/* ── Left: Copy ── */}
          <div style={{ maxWidth: 560 }}>
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
            >
              {/* Status badge — singular, earns its place */}
              <div style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "5px 12px 5px 8px",
                background: "var(--brand-faint)",
                border: "1px solid var(--brand-border)",
                borderRadius: 99,
                marginBottom: 28,
              }}>
                <div style={{
                  width: 18, height: 18, borderRadius: 5,
                  background: "var(--brand)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                    <path d="M5 1C3.34 1 2 2.27 2 3.83V7h6V3.83C8 2.27 6.66 1 5 1Z" fill="white"/>
                    <rect x="1.5" y="6.75" width="7" height="0.9" rx="0.45" fill="white"/>
                    <circle cx="5" cy="8.5" r="0.75" fill="white"/>
                  </svg>
                </div>
                <span style={{ fontSize: 12, fontWeight: 500, color: "var(--brand)" }}>
                  Open source · MIT License
                </span>
              </div>

              <h1
                id="hero-heading"
                style={{
                  fontSize: "clamp(2.6rem, 5.5vw, 4.5rem)",
                  fontWeight: 800,
                  letterSpacing: "-0.03em",
                  lineHeight: 1.05,
                  color: "var(--ink)",
                  textWrap: "balance" as any,
                  marginBottom: 20,
                }}
              >
                Never miss another<br />
                <span style={{ color: "var(--brand)" }}>bill again.</span>
              </h1>

              <p style={{
                fontSize: "clamp(15px, 2vw, 17px)",
                color: "var(--ink-2)",
                lineHeight: 1.7,
                maxWidth: "60ch",
                marginBottom: 36,
              }}>
                Bill Reminder helps you stay ahead of recurring payments with intelligent reminders, offline support, cloud sync, and a clean experience designed to eliminate late fees and forgotten bills.
              </p>

              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <a
                  href="https://github.com/suryadeepbanerjee/Bill-Reminder/releases/latest"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-primary"
                  style={{ padding: "12px 24px", fontSize: 15 }}
                >
                  <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
                  </svg>
                  Download App
                </a>
                <Link to="/sign-in" className="btn-outline" style={{ padding: "11px 24px", fontSize: 15 }}>
                  Sign In
                </Link>
              </div>

              {/* Metrics — real, honest numbers */}
              <div style={{ display: "flex", gap: 28, marginTop: 44, flexWrap: "wrap" }}>
                {[
                  { value: "Free",     label: "No subscription fee" },
                  { value: "Offline",  label: "Works without internet" },
                  { value: "Private",  label: "Your data, your rules" },
                ].map(m => (
                  <div key={m.value}>
                    <p style={{ fontSize: 17, fontWeight: 700, color: "var(--ink)", letterSpacing: "-0.02em", marginBottom: 3 }}>{m.value}</p>
                    <p style={{ fontSize: 12, color: "var(--ink-3)" }}>{m.label}</p>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>

          {/* ── Right: Phone ── */}
          <div style={{ display: "flex", justifyContent: "center", position: "relative" }}>
            {/* Glow behind phone */}
            <div style={{
              position: "absolute",
              inset: -40,
              background: "radial-gradient(ellipse at center, rgba(130,119,247,0.15) 0%, transparent 65%)",
              borderRadius: "50%",
              pointerEvents: "none",
            }} aria-hidden="true" />
            <PhoneMockup />
          </div>
        </div>
      </div>

      <style>{`
        @media (min-width: 900px) {
          .hero-grid { grid-template-columns: 1fr 1fr !important; }
        }
      `}</style>
    </section>
  );
}
