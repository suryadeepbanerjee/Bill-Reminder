import { ReactNode } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";

interface AuthLayoutProps {
  children: ReactNode;
  title: string;
  subtitle: string;
}

export default function AuthLayout({ children, title, subtitle }: AuthLayoutProps) {
  return (
    <div className="min-h-screen bg-canvas flex flex-col">
      {/* Top nav */}
      <div className="flex items-center justify-between max-w-[1360px] mx-auto w-full px-5 pt-8 pb-4.5">
        <Link to="/" className="flex items-center gap-2 no-underline text-secondary font-semibold text-sm tracking-tight hover:text-primary transition-colors">
          <div className="w-[26px] h-[26px] rounded-lg overflow-hidden">
            <img src="/logo-mark.png" alt="Bill Reminder" className="w-[26px] h-[26px] object-cover" />
          </div>
          Bill Reminder
        </Link>
        <Link to="/" className="text-[13px] text-secondary/70 no-underline hover:text-secondary transition-colors">
          ← Back to home
        </Link>
      </div>

      {/* Card area */}
      <div className="flex-1 flex items-center justify-center px-6 pt-4 pb-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-[400px]"
        >
          <div className="p-9 bg-surface border border-border rounded-card shadow-raised">
            <div className="mb-7">
              <h1 className="text-[22px] font-extrabold text-primary tracking-tight mb-1.5">
                {title}
              </h1>
              <p className="text-sm text-secondary leading-[1.6]">
                {subtitle}
              </p>
            </div>
            {children}
          </div>
        </motion.div>
      </div>

      {/* Footer note */}
      <div className="text-center pb-6">
        <p className="text-xs text-secondary/50">
          © {new Date().getFullYear()} Bill Reminder ·{" "}
          <Link to="/privacy" className="text-secondary/70 no-underline hover:text-secondary transition-colors">Privacy</Link>
          {" · "}
          <Link to="/terms" className="text-secondary/70 no-underline hover:text-secondary transition-colors">Terms</Link>
        </p>
      </div>
    </div>
  );
}
