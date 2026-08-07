// About.tsx — factual description of Bill Reminder for Google OAuth branding review
// No new design tokens. Uses existing bg, border, text-* classes from the design system.
import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { Link } from "react-router-dom";

const blocks = [
  {
    heading: "What is Bill Reminder?",
    body: "Bill Reminder is a personal finance application for tracking recurring bills and scheduled payments. It helps individuals and households manage subscriptions, utility bills, rent, EMIs, mobile recharges, insurance premiums, and any other payment that repeats on a regular schedule.",
  },
  {
    heading: "Who is it for?",
    body: "Anyone who pays recurring bills. Bill Reminder supports household sharing, so multiple family members can track and manage bills together under a single account.",
  },
  {
    heading: "How do reminders work?",
    body: "You add a bill with its name, amount, due date, and billing cycle. Bill Reminder generates upcoming occurrences and sends email and push notification reminders before each due date — at intervals you choose (for example, 7 days, 3 days, and 1 day before). Once paid, you mark it done and the history is logged.",
  },
  {
    heading: "Why does Bill Reminder use Google Sign-In?",
    body: "Google Sign-In is used only for secure authentication and cloud synchronization. It allows you to sign in without creating a separate username and password. Your identity is verified by Google and your account is linked to your Google email address.",
  },
];

export default function About() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <section
      id="about"
      ref={ref}
      className="section"
      aria-labelledby="about-heading"
    >
      <div className="container max-w-5xl mx-auto px-6 md:px-10">
        {/* Section header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.55 }}
          className="mb-14 text-center"
        >
          <h2
            id="about-heading"
            className="text-[clamp(1.8rem,3.5vw,2.6rem)] font-extrabold tracking-tight text-primary mb-4"
            style={{ textWrap: "balance" } as React.CSSProperties}
          >
            About Bill Reminder
          </h2>
          <p className="text-base text-secondary max-w-[52ch] leading-[1.65] mx-auto">
            A factual overview of what the application does, who it is for, and how your Google account is used.
          </p>
        </motion.div>

        {/* Info grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
          {blocks.map((block, i) => (
            <motion.div
              key={block.heading}
              initial={{ opacity: 0, y: 16 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.45, delay: i * 0.07 }}
              className="p-6 rounded-2xl border border-border bg-surface"
            >
              <h3 className="text-base font-semibold text-primary mb-2">{block.heading}</h3>
              <p className="text-sm text-secondary leading-relaxed">{block.body}</p>
            </motion.div>
          ))}
        </div>

        {/* Google Sign-In transparency card — visually distinct */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, delay: 0.32 }}
          className="rounded-2xl border border-accent/25 bg-accent/5 p-6 md:p-8"
          aria-label="Google Sign-In data access disclosure"
        >
          <div className="flex items-start gap-4">
            {/* Lock icon */}
            <div className="shrink-0 w-10 h-10 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center text-accent">
              <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <rect x="3" y="11" width="18" height="10" rx="2" />
                <path strokeLinecap="round" d="M7 11V7a5 5 0 0110 0v4" />
              </svg>
            </div>

            <div className="flex-1 min-w-0">
              <h3 className="text-base font-semibold text-primary mb-1">
                Google Sign-In — Data Access Disclosure
              </h3>
              <p className="text-sm text-secondary leading-relaxed mb-4">
                Bill Reminder requests only the minimum Google OAuth scopes required for authentication:{" "}
                <code className="text-xs font-mono bg-white/5 border border-white/10 px-1.5 py-0.5 rounded">openid</code>,{" "}
                <code className="text-xs font-mono bg-white/5 border border-white/10 px-1.5 py-0.5 rounded">email</code>, and{" "}
                <code className="text-xs font-mono bg-white/5 border border-white/10 px-1.5 py-0.5 rounded">profile</code>.
                This means we receive your name and email address — nothing else.
              </p>

              {/* What we do NOT access */}
              <div className="space-y-2 mb-4">
                <p className="text-xs font-semibold text-secondary uppercase tracking-wider">We do NOT access:</p>
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-sm text-secondary">
                  {[
                    "Gmail (read, send, or delete emails)",
                    "Google Drive (files or documents)",
                    "Google Calendar (events or schedules)",
                    "Google Photos (images or albums)",
                    "Google Contacts (address book)",
                    "Any financial or payment data",
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="shrink-0 mt-0.5 text-error/70">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* What we DO use */}
              <div className="space-y-2 mb-5">
                <p className="text-xs font-semibold text-secondary uppercase tracking-wider">We use only:</p>
                <ul className="space-y-1.5 text-sm text-secondary">
                  {[
                    "Your email address — to create and identify your account",
                    "Your display name — shown in the application interface",
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="shrink-0 mt-0.5 text-success">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="flex items-center gap-4 pt-4 border-t border-border flex-wrap">
                <Link
                  to="/privacy"
                  className="text-sm text-accent hover:underline underline-offset-2 no-underline font-medium"
                >
                  Read our Privacy Policy →
                </Link>
                <Link
                  to="/terms"
                  className="text-sm text-secondary hover:text-primary transition-colors no-underline"
                >
                  Terms of Service
                </Link>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
