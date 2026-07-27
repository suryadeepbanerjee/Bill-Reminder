import { motion, useInView } from "framer-motion";
import { useRef } from "react";

const comparisons = [
  {
    title: "vs. Spreadsheets",
    them: "Manual updates, no reminders, easy to forget",
    us: "Automatic tracking, smart reminders, zero effort",
  },
  {
    title: "vs. Banking Apps",
    them: "Shows history only, no forward-looking reminders",
    us: "Proactive alerts before bills are due",
  },
  {
    title: "vs. Calendar",
    them: "No payment tracking, no history, clutters your events",
    us: "Dedicated bill timeline with payment history",
  },
  {
    title: "vs. Other Apps",
    them: "Subscription required, data sold to advertisers",
    us: "Open source, privacy-first, your data is yours",
  },
];

export default function WhyBillReminder() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <section className="py-32 relative" ref={ref} aria-labelledby="why-heading">
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse 60% 40% at 20% 60%, rgba(91,91,214,0.05) 0%, transparent 60%)" }}
      />

      <div className="max-w-6xl mx-auto px-5 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          {/* Left: Text */}
          <motion.div
            initial={{ opacity: 0, x: -24 }}
            animate={inView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="inline-flex items-center gap-2 glass-accent rounded-full px-4 py-1.5 mb-6">
              <span className="text-accent-300 text-xs font-medium">Why choose us</span>
            </div>
            <h2 id="why-heading" className="text-4xl sm:text-5xl font-bold tracking-tight mb-6 text-balance">
              The only app built{" "}
              <span className="gradient-text">exclusively</span> for bills
            </h2>
            <p className="text-lg text-white/45 leading-relaxed mb-8">
              General finance apps try to do everything. Bill Reminder does one thing exceptionally well — making sure you never miss a payment.
            </p>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-6">
              {[
                { value: "100%", label: "Open source" },
                { value: "0", label: "Data sold" },
                { value: "∞", label: "Bills tracked" },
              ].map((stat) => (
                <div key={stat.label}>
                  <p className="text-3xl font-bold gradient-text-accent mb-1">{stat.value}</p>
                  <p className="text-xs text-white/40">{stat.label}</p>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Right: Comparison cards */}
          <motion.div
            initial={{ opacity: 0, x: 24 }}
            animate={inView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.7, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
            className="space-y-3"
          >
            {comparisons.map((c, i) => (
              <motion.div
                key={c.title}
                initial={{ opacity: 0, y: 16 }}
                animate={inView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.5, delay: 0.15 + i * 0.08 }}
                className="glass rounded-2xl p-5"
              >
                <p className="text-xs font-semibold text-accent-400 mb-3">{c.title}</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-start gap-2">
                    <div className="w-4 h-4 rounded-full bg-red-500/20 border border-red-500/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-red-400 text-[8px] font-bold">✕</span>
                    </div>
                    <p className="text-xs text-white/40 leading-relaxed">{c.them}</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="w-4 h-4 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-emerald-400 text-[8px] font-bold">✓</span>
                    </div>
                    <p className="text-xs text-white/70 leading-relaxed">{c.us}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  );
}
