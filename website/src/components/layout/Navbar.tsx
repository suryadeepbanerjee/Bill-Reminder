import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import Logo from "../ui/Logo";

const NAV_LINKS = [
  { label: "Features",    href: "/#features" },
  { label: "How it Works", href: "/#how-it-works" },
  { label: "Download",    href: "/#download" },
  { label: "FAQ",         href: "/#faq" },
];

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen]         = useState(false);
  const { pathname }             = useLocation();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 32);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // close menu on route change
  useEffect(() => setOpen(false), [pathname]);

  const isAuth = ["/sign-in", "/sign-up", "/forgot-password", "/reset-password"].includes(pathname);

  return (
    <>
      <header
        role="banner"
        style={{
          position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
          padding: scrolled ? "8px 0" : "16px 0",
          transition: "padding 250ms ease",
        }}
      >
        <div style={{
          maxWidth: scrolled ? "calc(100% - 32px)" : "1360px",
          margin: "0 auto",
          padding: "0 20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: scrolled ? "rgba(7,7,15,0.88)" : "transparent",
          backdropFilter: scrolled ? "blur(12px)" : "none",
          borderRadius: scrolled ? "14px" : "0",
          border: scrolled ? "1px solid var(--border)" : "none",
          transition: "all 250ms ease",
        }}>
          {/* Logo */}
          <Link to="/" style={{
            display: "flex", alignItems: "center", gap: 8,
            textDecoration: "none", color: "var(--ink)",
            fontWeight: 600, fontSize: 15, letterSpacing: "-0.02em",
          }}>
            <Logo size={30} />
            Bill Reminder
          </Link>

          {/* Desktop nav */}
          {!isAuth && (
            <nav role="navigation" aria-label="Main navigation" style={{
              display: "flex", alignItems: "center", gap: 4,
            }} className="desktop-nav">
              {NAV_LINKS.map(l => (
                <a key={l.label} href={l.href} className="btn-ghost" style={{ fontSize: 14, color: "var(--ink-2)" }}>
                  {l.label}
                </a>
              ))}
              <a
                href="https://github.com/suryadeepbanerjee/Bill-Reminder"
                target="_blank"
                rel="noopener noreferrer"
                className="btn-ghost"
                style={{ fontSize: 14, color: "var(--ink-2)" }}
              >
                GitHub
              </a>
            </nav>
          )}

          {/* CTA */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }} className="desktop-cta">
            <Link to="/sign-in" className="btn-ghost" style={{ color: "var(--ink-2)" }}>Sign in</Link>
            <Link to="/sign-up" className="btn-primary" style={{ padding: "8px 16px", fontSize: 13 }}>
              Get started
            </Link>
          </div>

          {/* Mobile hamburger */}
          <button
            onClick={() => setOpen(v => !v)}
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            className="mobile-menu-btn"
            style={{
              background: "none", border: "none", cursor: "pointer",
              padding: 8, color: "var(--ink-2)",
              display: "none",
            }}
          >
            <svg width="20" height="20" fill="none" viewBox="0 0 20 20">
              {open ? (
                <path d="M5 5L15 15M15 5L5 15" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round"/>
              ) : (
                <path d="M3 6h14M3 10h14M3 14h14" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round"/>
              )}
            </svg>
          </button>
        </div>
      </header>

      {/* Mobile drawer */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
            style={{
              position: "fixed", top: 72, left: 16, right: 16,
              background: "var(--surface-1)",
              border: "1px solid var(--border)",
              borderRadius: "var(--r-xl)",
              padding: "12px",
              zIndex: 99,
            }}
          >
            {NAV_LINKS.map(l => (
              <a key={l.label} href={l.href} onClick={() => setOpen(false)} style={{
                display: "block", padding: "10px 14px",
                borderRadius: "var(--r-sm)",
                color: "var(--ink-2)", fontSize: 14, fontWeight: 500,
                textDecoration: "none",
                transition: "background 150ms, color 150ms",
              }}
              onMouseEnter={e => { (e.target as HTMLElement).style.background = "rgba(255,255,255,0.05)"; (e.target as HTMLElement).style.color = "var(--ink)"; }}
              onMouseLeave={e => { (e.target as HTMLElement).style.background = "transparent"; (e.target as HTMLElement).style.color = "var(--ink-2)"; }}
              >
                {l.label}
              </a>
            ))}
            <div className="divider" style={{ margin: "8px 0" }} />
            <Link to="/sign-in" onClick={() => setOpen(false)} className="btn-ghost" style={{ display: "block", width: "100%", textAlign: "center" }}>
              Sign in
            </Link>
            <Link to="/sign-up" onClick={() => setOpen(false)} className="btn-primary" style={{ display: "flex", justifyContent: "center", marginTop: 8 }}>
              Get started
            </Link>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        @media (max-width: 768px) {
          .desktop-nav, .desktop-cta { display: none !important; }
          .mobile-menu-btn { display: flex !important; }
        }
      `}</style>
    </>
  );
}
