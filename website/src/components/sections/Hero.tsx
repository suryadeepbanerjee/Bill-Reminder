import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { Link } from "react-router-dom";

// Animated grid dots background
function GridBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {/* Grid lines */}
      <div className="absolute inset-0 grid-bg opacity-60" />

      {/* Central radial glow */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full opacity-20 animate-glow-pulse"
        style={{
          background: "radial-gradient(ellipse at center, rgba(91,91,214,0.5) 0%, rgba(91,91,214,0.15) 40%, transparent 70%)",
        }}
      />

      {/* Top center highlight */}
      <div
        className="absolute -top-32 left-1/2 -translate-x-1/2 w-[600px] h-[300px]"
        style={{
          background: "radial-gradient(ellipse at top, rgba(91,91,214,0.18) 0%, transparent 70%)",
        }}
      />

      {/* Floating orbs */}
      <div
        className="absolute top-1/4 left-1/4 w-48 h-48 rounded-full blur-3xl animate-float"
        style={{ background: "rgba(99,102,241,0.1)", animationDelay: "0s" }}
      />
      <div
        className="absolute top-1/3 right-1/4 w-64 h-64 rounded-full blur-3xl animate-float"
        style={{ background: "rgba(67,56,202,0.08)", animationDelay: "-3s" }}
      />
    </div>
  );
}

// Phone mockup with bill card UI
function PhoneMockup() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 32, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.8, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className="relative mx-auto w-[280px]"
    >
      {/* Glow behind phone */}
      <div
        className="absolute inset-0 blur-3xl rounded-full scale-90 translate-y-8"
        style={{ background: "radial-gradient(ellipse, rgba(91,91,214,0.35) 0%, transparent 70%)" }}
      />

      {/* Phone frame */}
      <div className="relative glass rounded-[40px] p-3 border border-white/10 shadow-2xl">
        <div className="rounded-[32px] bg-surface-1 overflow-hidden" style={{ aspectRatio: "9/19" }}>
          {/* Status bar */}
          <div className="flex items-center justify-between px-5 pt-3 pb-2">
            <span className="text-white/50 text-[10px] font-medium">9:41</span>
            <div className="flex gap-1">
              <div className="w-3 h-1.5 bg-white/30 rounded-full" />
              <div className="w-1 h-1.5 bg-white/30 rounded-full" />
              <div className="w-1 h-1.5 bg-white/30 rounded-full" />
            </div>
          </div>

          {/* App content */}
          <div className="px-4 pb-4">
            {/* Header */}
            <div className="mb-5">
              <p className="text-white/40 text-[10px] mb-0.5">Good morning</p>
              <p className="text-white font-semibold text-sm">Surya 👋</p>
            </div>

            {/* Summary cards */}
            <div className="grid grid-cols-2 gap-2 mb-4">
              {[
                { label: "Due this month", value: "₹4,850", color: "rgba(91,91,214,0.2)" },
                { label: "Overdue", value: "₹0", color: "rgba(16,185,129,0.15)" },
              ].map((card) => (
                <div
                  key={card.label}
                  className="rounded-xl p-2.5"
                  style={{ background: card.color, border: "1px solid rgba(255,255,255,0.07)" }}
                >
                  <p className="text-white/50 text-[8px] mb-1">{card.label}</p>
                  <p className="text-white font-semibold text-sm">{card.value}</p>
                </div>
              ))}
            </div>

            {/* Bill cards */}
            <p className="text-white/40 text-[9px] uppercase tracking-wider mb-2 font-medium">Today</p>
            {[
              { name: "Netflix", amount: "₹649", color: "#DC2626", emoji: "🎬" },
              { name: "Spotify", amount: "₹119", color: "#22C55E", emoji: "🎵" },
              { name: "iCloud", amount: "₹75", color: "#3B82F6", emoji: "☁️" },
            ].map((bill) => (
              <div
                key={bill.name}
                className="flex items-center gap-2.5 py-2 border-b last:border-b-0"
                style={{ borderColor: "rgba(255,255,255,0.05)" }}
              >
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-sm flex-shrink-0"
                  style={{ background: bill.color + "20" }}
                >
                  <span style={{ fontSize: 12 }}>{bill.emoji}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-[11px] font-medium">{bill.name}</p>
                  <p className="text-white/40 text-[9px]">Monthly</p>
                </div>
                <span className="text-white text-[11px] font-semibold tabular-nums">{bill.amount}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export default function Hero() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true });

  return (
    <section
      ref={ref}
      className="relative min-h-screen flex items-center pt-24 pb-16 overflow-hidden"
      aria-labelledby="hero-heading"
    >
      <GridBackground />

      <div className="relative z-10 max-w-6xl mx-auto px-5 w-full">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          {/* Left: Copy */}
          <div>
            {/* Badge */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="inline-flex items-center gap-2 glass-accent rounded-full px-4 py-1.5 mb-8"
            >
              <div className="w-1.5 h-1.5 rounded-full bg-accent-400 animate-pulse" />
              <span className="text-accent-300 text-xs font-medium tracking-tight">
                Now available on Android
              </span>
            </motion.div>

            {/* Headline */}
            <motion.h1
              id="hero-heading"
              initial={{ opacity: 0, y: 20 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, delay: 0.15 }}
              className="text-5xl sm:text-6xl lg:text-[64px] font-bold tracking-tight leading-[1.06] text-balance mb-6"
            >
              Never miss{" "}
              <span className="gradient-text">another</span>
              <br />
              bill again.
            </motion.h1>

            {/* Subheading */}
            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, delay: 0.22 }}
              className="text-lg text-white/50 leading-relaxed max-w-lg mb-10 text-balance"
            >
              Bill Reminder tracks every recurring payment — subscriptions, utilities, EMIs — and sends smart reminders before they're due. Offline-first, beautifully organised.
            </motion.p>

            {/* CTA buttons */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="flex flex-wrap items-center gap-4"
            >
              <a
                href="/#download"
                className="btn-primary text-base px-7 py-3.5 gap-2.5"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download App
              </a>
              <Link to="/sign-in" className="btn-secondary text-base px-7 py-3.5">
                Sign In
                <svg className="w-4 h-4 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </motion.div>

            {/* Social proof */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={inView ? { opacity: 1 } : {}}
              transition={{ duration: 0.6, delay: 0.45 }}
              className="mt-12 flex items-center gap-6"
            >
              <div className="flex -space-x-2">
                {["#4338CA", "#7C3AED", "#2563EB", "#059669"].map((color, i) => (
                  <div
                    key={i}
                    className="w-8 h-8 rounded-full border-2 flex items-center justify-center text-xs font-bold"
                    style={{ borderColor: "#080810", background: color }}
                  >
                    {String.fromCharCode(65 + i)}
                  </div>
                ))}
              </div>
              <p className="text-sm text-white/40">
                <span className="text-white/70 font-medium">Open source</span> · MIT Licensed
              </p>
            </motion.div>
          </div>

          {/* Right: Phone mockup */}
          <div className="flex justify-center lg:justify-end">
            <PhoneMockup />
          </div>
        </div>

        {/* Scroll indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2, duration: 0.6 }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
        >
          <motion.div
            animate={{ y: [0, 8, 0] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
            className="w-5 h-8 rounded-full border border-white/20 flex items-start justify-center pt-1.5"
          >
            <div className="w-1 h-2 bg-white/40 rounded-full" />
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
