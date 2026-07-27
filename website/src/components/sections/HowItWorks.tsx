import { motion, useInView } from "framer-motion";
import { useRef } from "react";

const steps = [
  {
    number: "01",
    title: "Add your bills",
    description: "Enter any recurring payment — subscription, utility, EMI, or insurance. Set the amount, due date, and billing cycle in seconds.",
    visual: (
      <div className="glass rounded-xl p-4 space-y-2.5">
        {[
          { emoji: "📱", name: "Netflix", sub: "Monthly · ₹649", bar: 90 },
          { emoji: "🎵", name: "Spotify", sub: "Monthly · ₹119", bar: 60 },
          { emoji: "☁️", name: "iCloud", sub: "Monthly · ₹75", bar: 40 },
        ].map((b) => (
          <div key={b.name} className="flex items-center gap-3">
            <span className="text-lg">{b.emoji}</span>
            <div className="flex-1">
              <div className="flex justify-between mb-1">
                <span className="text-xs font-medium text-white/80">{b.name}</span>
                <span className="text-xs text-white/40">{b.sub}</span>
              </div>
              <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-accent-500"
                  style={{ width: `${b.bar}%`, opacity: 0.7 }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    ),
  },
  {
    number: "02",
    title: "Set your reminders",
    description: "Choose when and how you want to be notified — 7 days before, 3 days, or on the due date. Push and email notifications both supported.",
    visual: (
      <div className="space-y-2.5">
        {[
          { label: "7 days before", checked: true, color: "#5B5BD6" },
          { label: "3 days before", checked: true, color: "#5B5BD6" },
          { label: "On due date", checked: true, color: "#10B981" },
          { label: "Day after (overdue)", checked: false, color: "#F59E0B" },
        ].map((r) => (
          <div key={r.label} className="glass rounded-xl flex items-center gap-3 px-4 py-3">
            <div
              className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0"
              style={{
                background: r.checked ? r.color : "rgba(255,255,255,0.08)",
                border: `1px solid ${r.checked ? r.color : "rgba(255,255,255,0.12)"}`,
              }}
            >
              {r.checked && (
                <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 10 10" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M1.5 5l2.5 2.5 4.5-4" />
                </svg>
              )}
            </div>
            <span className="text-sm text-white/70">{r.label}</span>
          </div>
        ))}
      </div>
    ),
  },
  {
    number: "03",
    title: "Never miss a payment",
    description: "Receive timely notifications across all your devices. Mark bills as paid with one tap and build a complete payment history.",
    visual: (
      <div className="space-y-3">
        {/* Notification card */}
        <div className="glass-accent rounded-xl p-4">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-accent-500/20 border border-accent-500/30 flex items-center justify-center flex-shrink-0 mt-0.5">
              <svg className="w-4 h-4 text-accent-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            </div>
            <div>
              <p className="text-xs font-semibold text-white/90">Netflix due in 3 days</p>
              <p className="text-xs text-white/50 mt-0.5">₹649 · Tap to mark as paid</p>
            </div>
          </div>
        </div>
        {/* Paid status */}
        <div className="glass rounded-xl flex items-center gap-3 px-4 py-3">
          <div className="w-6 h-6 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
            <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div>
            <p className="text-xs font-medium text-white/80">Netflix</p>
            <p className="text-xs text-emerald-400/70">Paid · 3 days ago</p>
          </div>
          <span className="ml-auto text-xs font-medium text-white/60 tabular-nums">₹649</span>
        </div>
      </div>
    ),
  },
];

export default function HowItWorks() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <section id="how-it-works" className="py-32 relative" ref={ref} aria-labelledby="how-it-works-heading">
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse 60% 40% at 80% 50%, rgba(91,91,214,0.05) 0%, transparent 60%)" }}
      />

      <div className="max-w-6xl mx-auto px-5 relative z-10">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-20"
        >
          <div className="inline-flex items-center gap-2 glass-accent rounded-full px-4 py-1.5 mb-6">
            <span className="text-accent-300 text-xs font-medium">Simple by design</span>
          </div>
          <h2 id="how-it-works-heading" className="text-4xl sm:text-5xl font-bold tracking-tight mb-5">
            Up and running in{" "}
            <span className="gradient-text">under a minute</span>
          </h2>
          <p className="text-lg text-white/45 max-w-xl mx-auto">
            Three steps from download to complete peace of mind.
          </p>
        </motion.div>

        {/* Steps */}
        <div className="space-y-6 lg:space-y-0 lg:grid lg:grid-cols-3 lg:gap-8">
          {steps.map((step, i) => (
            <motion.div
              key={step.number}
              initial={{ opacity: 0, y: 28 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, delay: i * 0.12, ease: [0.16, 1, 0.3, 1] }}
              className="relative"
            >
              {/* Connector line (desktop) */}
              {i < steps.length - 1 && (
                <div className="hidden lg:block absolute top-8 left-full w-8 h-px bg-gradient-to-r from-accent-500/30 to-transparent z-10 -translate-x-4" />
              )}

              <div className="glass rounded-2xl p-6 h-full">
                {/* Step number */}
                <div className="flex items-center gap-3 mb-5">
                  <span className="font-mono text-accent-500 font-bold text-sm">{step.number}</span>
                  <div className="flex-1 h-px bg-white/[0.06]" />
                </div>

                {/* Visual */}
                <div className="mb-6">{step.visual}</div>

                {/* Text */}
                <h3 className="font-semibold text-white text-lg mb-2">{step.title}</h3>
                <p className="text-sm text-white/45 leading-relaxed">{step.description}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
