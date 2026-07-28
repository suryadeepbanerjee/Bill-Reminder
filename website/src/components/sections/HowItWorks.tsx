import { motion, useInView } from "framer-motion";
import { useRef } from "react";

const steps = [
  {
    title: "Add your bills",
    body: "Enter any recurring payment in seconds — subscriptions, utilities, EMIs, rent, or insurance. Set the amount, start date, and billing cycle.",
    detail: (
      <div className="mt-4">
        {[
          { name: "Netflix", cycle: "Monthly", amount: "₹649" },
          { name: "Home Loan EMI", cycle: "Monthly", amount: "₹18,000" },
          { name: "Electricity", cycle: "Bi-monthly", amount: "₹1,200" },
        ].map((b, i) => (
          <div key={i} className="flex justify-between items-center p-2 mb-1.5 bg-canvas rounded-lg border border-border">
            <div>
              <p className="text-xs font-semibold text-primary">{b.name}</p>
              <p className="text-[10px] text-secondary">{b.cycle}</p>
            </div>
            <span className="text-[13px] font-bold text-primary font-mono tabular-nums">{b.amount}</span>
          </div>
        ))}
      </div>
    ),
  },
  {
    title: "Set your reminders",
    body: "Choose when you want to be notified — 7 days before, 3 days, the day before, and on the due date. Push and email notifications both supported.",
    detail: (
      <div className="mt-4">
        {[
          { label: "7 days before", on: true },
          { label: "3 days before", on: true },
          { label: "Day before",    on: true },
          { label: "On due date",   on: true },
          { label: "Day after (overdue)", on: false },
        ].map((r, i) => (
          <div key={i} className={`flex items-center gap-2.5 py-1.5 ${i < 4 ? 'border-b border-border' : ''}`}>
            <div className={`w-4 h-4 rounded shrink-0 flex items-center justify-center border ${r.on ? "bg-accent border-accent" : "bg-transparent border-border"}`}>
              {r.on && (
                <svg width="10" height="10" fill="none" viewBox="0 0 10 10" stroke="var(--color-accent-text)" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M1.5 5l2.5 2.5L8.5 2" />
                </svg>
              )}
            </div>
            <span className={`text-xs ${r.on ? "text-primary" : "text-secondary"}`}>{r.label}</span>
          </div>
        ))}
      </div>
    ),
  },
  {
    title: "Mark as paid — or don't",
    body: "One tap to mark a bill as paid. Bill Reminder tracks the full history so you always know what's been settled and what's still pending.",
    detail: (
      <div className="mt-4">
        <div className="p-3 bg-surface/50 border border-border rounded-lg mb-2.5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-surface border border-border flex items-center justify-center text-accent">
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            </div>
            <div>
              <p className="text-xs font-semibold text-primary">Netflix due in 2 days</p>
              <p className="text-[10px] text-secondary">₹649 · Tap to mark as paid</p>
            </div>
          </div>
        </div>
        <div className="flex gap-2 items-center px-3.5 py-2.5 bg-canvas border border-border rounded-lg">
          <div className="w-5 h-5 rounded-full bg-success/10 border border-success/30 flex items-center justify-center text-success">
            <svg width="11" height="11" fill="none" viewBox="0 0 11 11" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M1.5 5.5L4 8 9.5 2.5" />
            </svg>
          </div>
          <div className="flex-1">
            <p className="text-xs font-semibold text-primary">Spotify</p>
            <p className="text-[10px] text-success">Paid · 4 days ago</p>
          </div>
          <span className="text-xs font-bold text-secondary font-mono tabular-nums">₹119</span>
        </div>
      </div>
    ),
  },
];

export default function HowItWorks() {
  const ref    = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <section id="how-it-works" ref={ref} className="section bg-canvas border-y border-border" aria-labelledby="how-it-works-heading">
      <div className="container">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.55 }}
          className="mb-14"
        >
          <h2 id="how-it-works-heading" className="text-[clamp(1.8rem,3.5vw,2.6rem)] font-extrabold tracking-tight text-primary mb-3.5" style={{ textWrap: "balance" as any }}>
            Up and running in under a minute.
          </h2>
          <p className="text-base text-secondary max-w-[48ch] leading-[1.65]">
            Three steps. No manual required.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {steps.map((step, i) => (
            <motion.div
              key={step.title}
              initial={{ opacity: 0, y: 24 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="p-7 bg-surface border border-border rounded-card shadow-resting"
            >
              <div className="flex gap-4 items-start">
                <div className="w-8 h-8 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center shrink-0 font-mono text-[13px] font-bold text-accent">
                  {String(i + 1).padStart(2, "0")}
                </div>
                <div className="flex-1">
                  <h3 className="text-base font-bold text-primary tracking-tight mb-2">
                    {step.title}
                  </h3>
                  <p className="text-[13.5px] text-secondary leading-[1.65] max-w-[42ch]">
                    {step.body}
                  </p>
                  {step.detail}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
