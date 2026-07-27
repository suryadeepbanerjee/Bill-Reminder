import { motion } from "framer-motion";
import { Link } from "react-router-dom";

/* Bill row shown in the phone mockup — supports upcoming, overdue, paid, recurring */
function BillCard({
  emoji, name, amount, category, daysLeft, paid, overdue, recurring,
}: {
  emoji: string; name: string; amount: string;
  category: string; daysLeft?: number; paid?: boolean; overdue?: boolean; recurring?: boolean;
}) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10,
      padding: "10px 0",
      borderBottom: "1px solid rgba(255,255,255,0.06)",
    }}>
      <div style={{
        width: 34, height: 34, borderRadius: 9,
        background: overdue ? "rgba(248,113,113,0.14)" : "rgba(255,255,255,0.08)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 16, flexShrink: 0,
      }}>
        {emoji}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: "#ffffff" }}>{name}</p>
          {recurring && (
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 2,
              fontSize: 8, fontWeight: 600, color: "#d4d4d4",
              background: "rgba(255,255,255,0.10)", borderRadius: 4,
              padding: "1px 4px", lineHeight: 1.4,
            }}>
              ↻ recurring
            </span>
          )}
        </div>
        <p style={{ fontSize: 10, color: "rgba(255,255,255,0.45)", marginTop: 2 }}>{category}</p>
      </div>
      <div style={{ textAlign: "right", flexShrink: 0 }}>
        <p style={{ fontSize: 12, fontWeight: 700, color: "#ffffff", marginBottom: 2 }}>{amount}</p>
        {paid ? (
          <p style={{ fontSize: 10, color: "#34d399" }}>✓ Paid</p>
        ) : overdue ? (
          <p style={{ fontSize: 10, color: "#f87171", fontWeight: 600 }}>Overdue</p>
        ) : (
          <p style={{ fontSize: 10, color: daysLeft! <= 2 ? "#fbbf24" : "rgba(255,255,255,0.45)" }}>
            {daysLeft === 0 ? "Due today" : `${daysLeft}d left`}
          </p>
        )}
      </div>
    </div>
  );
}

/* Floating card: category spend breakdown */
function CategoriesCard() {
  const cats = [
    { label: "Subscriptions", pct: 42, color: "#ffffff" },
    { label: "Utilities", pct: 31, color: "#9a9a9a" },
    { label: "Housing", pct: 27, color: "#4d4d4d" },
  ];
  return (
    <motion.div
      initial={{ opacity: 0, x: 24, y: -12 }}
      animate={{ opacity: 1, x: 0, y: 0 }}
      transition={{ duration: 0.7, delay: 0.9, ease: [0.16, 1, 0.3, 1] }}
      className="floating-card floating-card-top"
      style={{
        position: "absolute", top: -8, right: -28,
        width: 176, padding: "14px 16px",
        background: "rgba(13,13,13,0.92)",
        backdropFilter: "blur(16px)",
        border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: 16,
        boxShadow: "0 20px 40px rgba(0,0,0,0.45)",
      }}
    >
      <p style={{ fontSize: 9, fontWeight: 600, color: "rgba(255,255,255,0.4)", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 10 }}>
        By category
      </p>
      {/* stacked bar */}
      <div style={{ display: "flex", height: 6, borderRadius: 99, overflow: "hidden", marginBottom: 10 }}>
        {cats.map(c => (
          <div key={c.label} style={{ width: `${c.pct}%`, background: c.color }} />
        ))}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {cats.map(c => (
          <div key={c.label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 6, height: 6, borderRadius: 2, background: c.color, flexShrink: 0 }} />
            <span style={{ fontSize: 10, color: "rgba(255,255,255,0.6)", flex: 1 }}>{c.label}</span>
            <span style={{ fontSize: 10, fontWeight: 700, color: "#ffffff" }}>{c.pct}%</span>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

/* Floating card: payment timeline */
function TimelineCard() {
  const pts = [
    { label: "Today", state: "overdue" as const },
    { label: "Aug 2", state: "upcoming" as const },
    { label: "Aug 5", state: "upcoming" as const },
    { label: "Aug 9", state: "future" as const },
  ];
  const dot = { overdue: "#f87171", upcoming: "#ffffff", future: "rgba(255,255,255,0.25)" };
  return (
    <motion.div
      initial={{ opacity: 0, x: -20, y: 16 }}
      animate={{ opacity: 1, x: 0, y: 0 }}
      transition={{ duration: 0.7, delay: 1.05, ease: [0.16, 1, 0.3, 1] }}
      className="floating-card floating-card-bottom"
      style={{
        position: "absolute", bottom: 36, left: -36,
        width: 192, padding: "14px 16px",
        background: "rgba(13,13,13,0.92)",
        backdropFilter: "blur(16px)",
        border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: 16,
        boxShadow: "0 20px 40px rgba(0,0,0,0.45)",
      }}
    >
      <p style={{ fontSize: 9, fontWeight: 600, color: "rgba(255,255,255,0.4)", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 12 }}>
        Payment timeline
      </p>
      <div style={{ display: "flex", alignItems: "center" }}>
        {pts.map((p, i) => (
          <div key={p.label} style={{ display: "flex", alignItems: "center", flex: i < pts.length - 1 ? 1 : "none" }}>
            <div style={{
              width: 8, height: 8, borderRadius: "50%",
              background: dot[p.state], flexShrink: 0,
              boxShadow: p.state === "overdue" ? "0 0 0 3px rgba(248,113,113,0.18)" : "none",
            }} />
            {i < pts.length - 1 && (
              <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.12)" }} />
            )}
          </div>
        ))}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
        {pts.map(p => (
          <span key={p.label} style={{ fontSize: 9, color: "rgba(255,255,255,0.4)" }}>{p.label}</span>
        ))}
      </div>
    </motion.div>
  );
}

function PhoneMockup() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24, rotateX: 6 }}
      animate={{ opacity: 1, y: 0, rotateX: 0 }}
      transition={{ duration: 0.9, delay: 0.35, ease: [0.16, 1, 0.3, 1] }}
      style={{ perspective: 1000, position: "relative" }}
    >
      <div style={{
        width: 264,
        background: "#0d0d0d",
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
          background: "#000000",
        }}>
          {/* Status bar */}
          <div style={{ padding: "10px 16px 6px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", fontWeight: 600 }}>9:41</span>
            <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
              <div style={{ width: 12, height: 6, background: "#34d399", borderRadius: 2, opacity: 0.6 }} />
            </div>
          </div>

          {/* App content */}
          <div style={{ padding: "4px 14px 14px" }}>
            {/* Header */}
            <div style={{ marginBottom: 14, display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
              <div>
                <p style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", marginBottom: 2 }}>Good morning,</p>
                <p style={{ fontSize: 15, fontWeight: 700, color: "#ffffff", letterSpacing: "-0.02em" }}>Surya 👋</p>
              </div>
              <div style={{
                width: 26, height: 26, borderRadius: 8,
                background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.16)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <svg width="12" height="12" viewBox="0 0 18 18" fill="none">
                  <path d="M9 2C6.79 2 5 3.68 5 5.75V11H13V5.75C13 3.68 11.21 2 9 2Z" fill="#d4d4d4"/>
                  <rect x="4" y="10.5" width="10" height="1.25" rx="0.625" fill="#d4d4d4"/>
                  <circle cx="9" cy="13.5" r="1.2" fill="#d4d4d4"/>
                </svg>
              </div>
            </div>

            {/* Summary bar — monthly spending summary */}
            <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
              {[
                { label: "Due this month", value: "₹4,850", color: "rgba(255,255,255,0.10)" },
                { label: "Overdue", value: "₹1,200", color: "rgba(248,113,113,0.1)" },
                { label: "Paid", value: "₹794", color: "rgba(52,211,153,0.1)" },
              ].map(c => (
                <div key={c.label} style={{
                  flex: 1, padding: "7px 8px", borderRadius: 10,
                  background: c.color, border: "1px solid rgba(255,255,255,0.06)",
                }}>
                  <p style={{ fontSize: 7, color: "rgba(255,255,255,0.45)", marginBottom: 3 }}>{c.label}</p>
                  <p style={{ fontSize: 11.5, fontWeight: 700, color: "#ffffff" }}>{c.value}</p>
                </div>
              ))}
            </div>

            {/* Category filter chips */}
            <div style={{ display: "flex", gap: 6, marginBottom: 12, overflow: "hidden" }}>
              {["All", "Streaming", "Utilities", "Housing"].map((c, i) => (
                <span key={c} style={{
                  fontSize: 9, fontWeight: 600, padding: "4px 9px", borderRadius: 99,
                  background: i === 0 ? "var(--brand)" : "rgba(255,255,255,0.06)",
                  color: i === 0 ? "#000" : "rgba(255,255,255,0.55)",
                  whiteSpace: "nowrap",
                }}>
                  {c}
                </span>
              ))}
            </div>

            {/* Bills */}
            <p style={{ fontSize: 9, color: "rgba(255,255,255,0.35)", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 4 }}>Upcoming</p>
            <BillCard emoji="⚡" name="Electricity" amount="₹1,200" category="Utilities" overdue />
            <BillCard emoji="📺" name="Netflix"   amount="₹649" category="Streaming"   daysLeft={2} recurring />
            <BillCard emoji="🎵" name="Spotify"   amount="₹119" category="Music"       daysLeft={5} recurring />
            <BillCard emoji="☁️" name="iCloud"    amount="₹75"  category="Storage"     paid />
          </div>
        </div>

        {/* Home indicator */}
        <div style={{ display: "flex", justifyContent: "center", paddingTop: 8 }}>
          <div style={{ width: 60, height: 3, borderRadius: 99, background: "rgba(255,255,255,0.25)" }} />
        </div>
      </div>

      {/* Floating marketing cards — decorative, not part of the app UI */}
      <div className="hero-floating-cards">
        <CategoriesCard />
        <TimelineCard />
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
        background: "radial-gradient(ellipse 80% 50% at 50% -10%, rgba(255,255,255,0.08) 0%, transparent 70%)",
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
                    <path d="M5 1C3.34 1 2 2.27 2 3.83V7h6V3.83C8 2.27 6.66 1 5 1Z" fill="black"/>
                    <rect x="1.5" y="6.75" width="7" height="0.9" rx="0.45" fill="black"/>
                    <circle cx="5" cy="8.5" r="0.75" fill="black"/>
                  </svg>
                </div>
                <span style={{ fontSize: 12, fontWeight: 500, color: "var(--ink)" }}>
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
                <span
                  style={{
                    background: "linear-gradient(90deg, #ffffff 0%, #ffffff 40%, #6b6b6b 100%)",
                    WebkitBackgroundClip: "text",
                    backgroundClip: "text",
                    color: "transparent",
                  }}
                >
                  bill again.
                </span>
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
              background: "radial-gradient(ellipse at center, rgba(255,255,255,0.10) 0%, transparent 65%)",
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
        .hero-floating-cards { display: none; }
        @media (min-width: 1080px) {
          .hero-floating-cards { display: block; }
        }
      `}</style>
    </section>
  );
}
