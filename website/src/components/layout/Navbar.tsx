import { Link, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";
import Logo from "../ui/Logo";

const navLinks = [
  { label: "Features", href: "/#features" },
  { label: "How It Works", href: "/#how-it-works" },
  { label: "Download", href: "/#download" },
  { label: "GitHub", href: "https://github.com/suryadeepbanerjee/Bill-Reminder", external: true },
];

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 24);
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  useEffect(() => setMenuOpen(false), [location.pathname]);

  const isAuthPage = ["/sign-in", "/sign-up", "/forgot-password", "/reset-password"].includes(location.pathname);

  return (
    <motion.header
      initial={{ y: -16, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled ? "py-3" : "py-5"
      }`}
    >
      <div
        className={`mx-auto max-w-6xl px-5 flex items-center justify-between transition-all duration-300 ${
          scrolled ? "glass rounded-2xl py-2 mx-5" : ""
        }`}
      >
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2.5 group" aria-label="Bill Reminder home">
          <Logo size={32} />
          <span className="font-semibold text-white/90 group-hover:text-white transition-colors text-[15px] tracking-tight">
            Bill Reminder
          </span>
        </Link>

        {/* Desktop nav */}
        {!isAuthPage && (
          <nav className="hidden md:flex items-center gap-1" role="navigation" aria-label="Main navigation">
            {navLinks.map((link) =>
              link.external ? (
                <a
                  key={link.label}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-ghost text-sm"
                >
                  {link.label}
                </a>
              ) : (
                <a key={link.label} href={link.href} className="btn-ghost text-sm">
                  {link.label}
                </a>
              )
            )}
          </nav>
        )}

        {/* CTA */}
        <div className="hidden md:flex items-center gap-3">
          <Link to="/sign-in" className="btn-ghost text-sm">
            Sign in
          </Link>
          <Link to="/sign-up" className="btn-primary text-sm px-5 py-2.5">
            Get started
          </Link>
        </div>

        {/* Mobile hamburger */}
        <button
          onClick={() => setMenuOpen((v) => !v)}
          className="md:hidden btn-ghost p-2"
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          aria-expanded={menuOpen}
        >
          <div className="w-5 flex flex-col gap-1.5">
            <motion.span
              animate={menuOpen ? { rotate: 45, y: 7 } : { rotate: 0, y: 0 }}
              className="block h-0.5 bg-white/70 rounded-full origin-center transition-colors"
            />
            <motion.span
              animate={menuOpen ? { opacity: 0, scaleX: 0 } : { opacity: 1, scaleX: 1 }}
              className="block h-0.5 bg-white/70 rounded-full"
            />
            <motion.span
              animate={menuOpen ? { rotate: -45, y: -7 } : { rotate: 0, y: 0 }}
              className="block h-0.5 bg-white/70 rounded-full origin-center"
            />
          </div>
        </button>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="md:hidden mx-5 mt-2 overflow-hidden"
          >
            <nav className="glass rounded-2xl p-4 flex flex-col gap-1">
              {navLinks.map((link) =>
                link.external ? (
                  <a
                    key={link.label}
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2.5 rounded-xl text-white/70 hover:text-white hover:bg-white/5 text-sm font-medium transition-all"
                  >
                    {link.label}
                  </a>
                ) : (
                  <a
                    key={link.label}
                    href={link.href}
                    className="px-4 py-2.5 rounded-xl text-white/70 hover:text-white hover:bg-white/5 text-sm font-medium transition-all"
                  >
                    {link.label}
                  </a>
                )
              )}
              <div className="h-px bg-white/10 my-2" />
              <Link to="/sign-in" className="px-4 py-2.5 rounded-xl text-white/70 hover:text-white hover:bg-white/5 text-sm font-medium transition-all">
                Sign in
              </Link>
              <Link to="/sign-up" className="btn-primary text-sm mt-1 w-full justify-center">
                Get started free
              </Link>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  );
}
