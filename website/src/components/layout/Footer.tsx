import { Link } from "react-router-dom";
import Logo from "../ui/Logo";

export default function Footer() {
  const year = new Date().getFullYear();

  const linkStyle = {
    color: "var(--ink-3)",
    textDecoration: "none",
    fontSize: 13,
    transition: "color 150ms",
  } as const;

  return (
    <footer style={{
      borderTop: "1px solid var(--border)",
      padding: "48px 0 32px",
    }}>
      <div className="container">
        {/* Top row */}
        <div style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 32,
          justifyContent: "space-between",
          marginBottom: 40,
        }}>
          {/* Brand */}
          <div style={{ flex: "1 1 220px", maxWidth: 280 }}>
            <Link to="/" style={{ textDecoration: "none", color: "var(--ink)", fontWeight: 600, fontSize: 15, display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <Logo size={24} />
              Bill Reminder
            </Link>
            <p style={{ fontSize: 13, color: "var(--ink-3)", lineHeight: 1.65, maxWidth: 220 }}>
              Track recurring bills. Get reminders. Never pay a late fee again.
            </p>
          </div>

          {/* Links */}
          <div style={{ display: "flex", gap: 48, flexWrap: "wrap" }}>
            <div>
              <p style={{ fontSize: 11, fontWeight: 600, color: "var(--ink-4)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 12 }}>Product</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {[
                  { label: "Features", href: "/#features" },
                  { label: "How it Works", href: "/#how-it-works" },
                  { label: "Download", href: "/#download" },
                  { label: "FAQ", href: "/#faq" },
                ].map(l => (
                  <a key={l.label} href={l.href} style={linkStyle}
                    onMouseEnter={e => (e.currentTarget.style.color = "var(--ink)")}
                    onMouseLeave={e => (e.currentTarget.style.color = "var(--ink-3)")}
                  >
                    {l.label}
                  </a>
                ))}
              </div>
            </div>

            <div>
              <p style={{ fontSize: 11, fontWeight: 600, color: "var(--ink-4)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 12 }}>Legal</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <Link to="/privacy" style={linkStyle}
                  onMouseEnter={e => (e.currentTarget.style.color = "var(--ink)")}
                  onMouseLeave={e => (e.currentTarget.style.color = "var(--ink-3)")}
                >Privacy</Link>
                <Link to="/terms" style={linkStyle}
                  onMouseEnter={e => (e.currentTarget.style.color = "var(--ink)")}
                  onMouseLeave={e => (e.currentTarget.style.color = "var(--ink-3)")}
                >Terms</Link>
              </div>
            </div>

            <div>
              <p style={{ fontSize: 11, fontWeight: 600, color: "var(--ink-4)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 12 }}>Links</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <a href="https://github.com/suryadeepbanerjee/Bill-Reminder" target="_blank" rel="noopener noreferrer" style={linkStyle}
                  onMouseEnter={e => (e.currentTarget.style.color = "var(--ink)")}
                  onMouseLeave={e => (e.currentTarget.style.color = "var(--ink-3)")}
                >GitHub</a>
                <Link to="/sign-in" style={linkStyle}
                  onMouseEnter={e => (e.currentTarget.style.color = "var(--ink)")}
                  onMouseLeave={e => (e.currentTarget.style.color = "var(--ink-3)")}
                >Sign In</Link>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="divider" />
        <div style={{ marginTop: 24, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <p style={{ fontSize: 12, color: "var(--ink-4)" }}>
            © {year} Bill Reminder — Built with care in India
          </p>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{ fontSize: 11, fontFamily: "monospace", color: "var(--ink-4)", background: "var(--surface-2)", padding: "2px 8px", borderRadius: 6, border: "1px solid var(--border)" }}>
              MIT License
            </span>
            <a
              href="https://github.com/suryadeepbanerjee/Bill-Reminder"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "var(--ink-4)", transition: "color 150ms" }}
              aria-label="GitHub"
              onMouseEnter={e => (e.currentTarget.style.color = "var(--ink)")}
              onMouseLeave={e => (e.currentTarget.style.color = "var(--ink-4)")}
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
