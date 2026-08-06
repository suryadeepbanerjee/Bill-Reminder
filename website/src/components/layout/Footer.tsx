import { Link } from "react-router-dom";
import Logo from "../ui/Logo";

export default function Footer() {
  const year = new Date().getFullYear();

  const linkClass = "text-[13px] text-secondary no-underline transition-colors hover:text-primary";
  const headingClass = "text-[11px] font-semibold text-secondary tracking-widest uppercase mb-3";

  return (
    <footer className="border-t border-border pt-12 pb-8 bg-canvas">
      <div className="container mx-auto px-6">
        {/* Top row */}
        <div className="flex flex-wrap gap-8 justify-between mb-10">
          {/* Brand */}
          <div className="flex-[1_1_220px] max-w-[280px]">
            <Link to="/" className="no-underline text-primary font-semibold text-[15px] flex items-center gap-2 mb-2.5">
              <Logo size={24} />
              Bill Reminder
            </Link>
            <p className="text-[13px] text-secondary leading-[1.65] max-w-[220px]">
              Track recurring bills. Get reminders. Never pay a late fee again.
            </p>
          </div>

          {/* Links */}
          <div className="flex gap-12 flex-wrap">
            <div>
              <p className={headingClass}>Product</p>
              <div className="flex flex-col gap-2.5">
                {[
                  { label: "Features", href: "/#features" },
                  { label: "How it Works", href: "/#how-it-works" },
                  { label: "Download", href: "/#download" },
                  { label: "FAQ", href: "/#faq" },
                ].map(l => (
                  <a key={l.label} href={l.href} className={linkClass}>
                    {l.label}
                  </a>
                ))}
              </div>
            </div>

            <div>
              <p className={headingClass}>Legal</p>
              <div className="flex flex-col gap-2.5">
                <Link to="/privacy" className={linkClass}>Privacy</Link>
                <Link to="/terms" className={linkClass}>Terms</Link>
              </div>
            </div>

            <div>
              <p className={headingClass}>Links</p>
              <div className="flex flex-col gap-2.5">
                <a href="https://github.com/suryadeepbanerjee/Bill-Reminder" target="_blank" rel="noopener noreferrer" className={linkClass}>GitHub</a>
                <Link to="/sign-in" className={linkClass}>Sign In</Link>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="h-px bg-border" />
        <div className="mt-6 flex justify-between items-center flex-wrap gap-3">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <p className="text-xs text-secondary/70">
              © {year} Suryadeep Banerjee
            </p>
            <a
              href="mailto:official@suryadeepbanerjee.in"
              className="text-xs text-secondary/70 hover:text-primary transition-colors no-underline"
            >
              official@suryadeepbanerjee.in
            </a>
          </div>
          <div className="flex gap-3 items-center flex-wrap">
            <Link to="/privacy" className="text-xs text-secondary/70 hover:text-primary transition-colors no-underline">Privacy</Link>
            <Link to="/terms" className="text-xs text-secondary/70 hover:text-primary transition-colors no-underline">Terms</Link>
            <span className="text-[11px] font-mono text-secondary/70 bg-surface px-2 py-0.5 rounded-md border border-border">
              MIT License
            </span>
            <a
              href="https://github.com/suryadeepbanerjee/Bill-Reminder"
              target="_blank"
              rel="noopener noreferrer"
              className="text-secondary/70 hover:text-primary transition-colors"
              aria-label="GitHub"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/>
              </svg>
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
