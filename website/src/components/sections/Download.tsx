import { motion, useInView } from "framer-motion";
import { useRef } from "react";

export default function Download() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <section id="download" className="py-32 relative" ref={ref} aria-labelledby="download-heading">
      {/* Background glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse 70% 60% at 50% 100%, rgba(91,91,214,0.1) 0%, transparent 60%)" }}
      />

      <div className="max-w-4xl mx-auto px-5 relative z-10 text-center">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="inline-flex items-center gap-2 glass-accent rounded-full px-4 py-1.5 mb-6">
            <span className="text-accent-300 text-xs font-medium">Available now</span>
          </div>

          <h2 id="download-heading" className="text-4xl sm:text-5xl font-bold tracking-tight mb-5">
            Start tracking today.{" "}
            <span className="gradient-text">It's free.</span>
          </h2>
          <p className="text-lg text-white/45 max-w-xl mx-auto mb-12">
            Download Bill Reminder and take control of your recurring payments in minutes.
          </p>

          {/* Download options */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-xl mx-auto mb-8">
            {/* APK Download */}
            <motion.a
              href="https://github.com/suryadeepbanerjee/Bill-Reminder/releases/latest"
              target="_blank"
              rel="noopener noreferrer"
              whileHover={{ scale: 1.02, y: -2 }}
              whileTap={{ scale: 0.98 }}
              className="glass rounded-2xl p-5 flex items-center gap-4 hover:border-white/20 hover:bg-white/[0.06] transition-all duration-200 text-left group"
            >
              <div className="w-12 h-12 rounded-xl bg-accent-500/15 border border-accent-500/25 flex items-center justify-center flex-shrink-0 group-hover:bg-accent-500/25 transition-all">
                <svg className="w-6 h-6 text-accent-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
              </div>
              <div>
                <p className="text-xs text-white/40 mb-0.5">Direct download</p>
                <p className="font-semibold text-white">Android APK</p>
                <p className="text-xs text-white/40 mt-0.5">GitHub Releases</p>
              </div>
            </motion.a>

            {/* Play Store (coming soon) */}
            <motion.div
              whileHover={{ scale: 1.01 }}
              className="glass rounded-2xl p-5 flex items-center gap-4 opacity-50 cursor-not-allowed text-left"
            >
              <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6 text-white/30" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M3.18 23.76c.3.17.64.24.99.2l12.6-7.27-2.88-2.89L3.18 23.76zm16.65-9.59L17.46 12l2.37-2.17c.67-.61.67-1.55 0-2.16L12 3.04c-.35-.32-.8-.46-1.26-.41l9.09 9.09-1.27 1.27.07.18 1.2 1.2zM2.01 1.56c-.06.18-.01.38.06.56l8.01 8.01-7.63 8.81c-.35-.32-.45-.83-.45-1.34V2.4c0-.35.01-.61.01-.84zM13.76 12l2.88 2.89-12.6 7.27c-.35.2-.74.28-1.13.22l10.85-10.38z" />
                </svg>
              </div>
              <div>
                <p className="text-xs text-white/30 mb-0.5">Coming soon</p>
                <p className="font-semibold text-white/40">Google Play</p>
                <p className="text-xs text-white/30 mt-0.5">In review</p>
              </div>
            </motion.div>
          </div>

          {/* GitHub CTA */}
          <motion.a
            href="https://github.com/suryadeepbanerjee/Bill-Reminder"
            target="_blank"
            rel="noopener noreferrer"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="inline-flex items-center gap-2.5 px-6 py-3 rounded-xl glass border border-white/10 hover:border-white/20 hover:bg-white/[0.05] transition-all duration-200 text-white/70 hover:text-white font-medium text-sm"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
            </svg>
            View source on GitHub
          </motion.a>

          <p className="text-xs text-white/25 mt-8">
            iOS support is planned. Star the repository to follow progress.
          </p>
        </motion.div>
      </div>
    </section>
  );
}
