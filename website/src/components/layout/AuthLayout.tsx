import { ReactNode } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import Logo from "../../components/ui/Logo";

interface AuthLayoutProps {
  children: ReactNode;
  title: string;
  subtitle: string;
}

export default function AuthLayout({ children, title, subtitle }: AuthLayoutProps) {
  return (
    <div className="min-h-screen bg-[#080810] flex flex-col">
      {/* Background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
        <div className="grid-bg absolute inset-0 opacity-40" />
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px]"
          style={{ background: "radial-gradient(ellipse at top, rgba(91,91,214,0.14) 0%, transparent 70%)" }}
        />
        <div
          className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[400px] h-[300px]"
          style={{ background: "radial-gradient(ellipse at bottom, rgba(91,91,214,0.06) 0%, transparent 70%)" }}
        />
      </div>

      {/* Nav */}
      <div className="relative z-10 flex items-center justify-between max-w-5xl mx-auto w-full px-6 py-5">
        <Link to="/" className="flex items-center gap-2.5 group" aria-label="Go to homepage">
          <Logo size={28} />
          <span className="text-sm font-semibold text-white/80 group-hover:text-white transition-colors">
            Bill Reminder
          </span>
        </Link>
        <Link to="/" className="text-xs text-white/40 hover:text-white/70 transition-colors">
          ← Back to home
        </Link>
      </div>

      {/* Card */}
      <div className="relative z-10 flex-1 flex items-center justify-center px-5 py-12">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-[420px]"
        >
          <div className="glass rounded-3xl p-8 sm:p-10 border border-white/[0.07]">
            {/* Header */}
            <div className="mb-8">
              <h1 className="text-2xl font-bold text-white tracking-tight mb-2">{title}</h1>
              <p className="text-sm text-white/45 leading-relaxed">{subtitle}</p>
            </div>

            {children}
          </div>
        </motion.div>
      </div>

      {/* Footer note */}
      <div className="relative z-10 text-center pb-8">
        <p className="text-xs text-white/20">
          © {new Date().getFullYear()} Bill Reminder ·{" "}
          <Link to="/privacy" className="hover:text-white/50 transition-colors">Privacy</Link>
          {" · "}
          <Link to="/terms" className="hover:text-white/50 transition-colors">Terms</Link>
        </p>
      </div>
    </div>
  );
}
