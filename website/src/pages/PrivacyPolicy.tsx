import { Link } from "react-router-dom";
import Navbar from "../components/layout/Navbar";
import Footer from "../components/layout/Footer";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 36 }}>
      <h2 style={{ fontSize: 17, fontWeight: 700, color: "var(--ink)", letterSpacing: "-0.015em", marginBottom: 12 }}>{title}</h2>
      <div style={{ fontSize: 14, color: "var(--ink-2)", lineHeight: 1.75 }}>{children}</div>
    </section>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return <p style={{ marginBottom: 12 }}>{children}</p>;
}

function UL({ items }: { items: string[] }) {
  return (
    <ul style={{ paddingLeft: 20, marginBottom: 12 }}>
      {items.map((i, idx) => <li key={idx} style={{ marginBottom: 6 }}>{i}</li>)}
    </ul>
  );
}

export default function PrivacyPolicy() {
  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <Navbar />
      <main style={{ maxWidth: 720, margin: "0 auto", padding: "120px 24px 80px" }}>
        <div style={{ marginBottom: 48 }}>
          <p style={{ fontSize: 12, color: "var(--brand)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>Legal</p>
          <h1 style={{ fontSize: "clamp(1.8rem, 3vw, 2.4rem)", fontWeight: 800, letterSpacing: "-0.025em", color: "var(--ink)", marginBottom: 8 }}>
            Privacy Policy
          </h1>
          <p style={{ fontSize: 13, color: "var(--ink-3)" }}>Last updated: August 2026</p>
        </div>

        <div className="card" style={{ padding: "36px 36px" }}>
          <Section title="Overview">
            <P>Bill Reminder is committed to protecting your privacy. We built this app with a privacy-first philosophy — your financial data belongs to you and only you. This policy explains what data we collect, why we collect it, and how it is used.</P>
          </Section>

          <Section title="Data we collect">
            <P>We collect only what is strictly necessary to provide the service:</P>
            <UL items={[
              "Email address — for authentication and account recovery only.",
              "Display name — optional, used to personalise your experience.",
              "Bill data — names, amounts, due dates, and categories you enter. Stored in your private, isolated account.",
            ]} />
            <P>We do <strong>not</strong> collect payment card numbers, bank credentials, government IDs, or any financial institution data.</P>
          </Section>

          <Section title="How your data is stored">
            <P>All data is stored in Supabase, a cloud database protected by Row-Level Security (RLS). This means database-level enforcement prevents any query from accessing another user's data, even if application code has a bug.</P>
            <P>Supabase encrypts data at rest and in transit. For details on Supabase's security posture, see <a href="https://supabase.com/security" target="_blank" rel="noopener noreferrer" style={{ color: "var(--brand)", textDecoration: "none" }}>supabase.com/security</a>.</P>
          </Section>

          <Section title="Third-party services">
            <P>We use the following third parties:</P>
            <UL items={[
              "Supabase — database, authentication, PostgreSQL, Row-Level Security, and backend/Edge Functions.",
              "Resend — transactional email for verification, password reset, and bill reminders. Your email address is shared when an email is sent.",
              "Vercel — website hosting and serverless infrastructure. Standard web logs such as IP address and user agent may apply.",
              "Upstash — Redis-based rate limiting and request protection. Limited request metadata is processed to enforce rate limits.",
              "Cloudflare Turnstile — CAPTCHA and bot protection for authentication and sensitive operations.",
              "Google OAuth — optional Google sign-in. Google provides your name and email address when you authenticate with Google. No access to Gmail, Drive, Calendar, Photos, or Contacts is requested.",
              "Expo Notifications — mobile push notification delivery for bill reminders. Device notification identifiers and related delivery data may be processed.",
              "Firebase — Android notification infrastructure and Google services used by the mobile application, where enabled.",
            ]} />
            <P>We do <strong>not</strong> sell, share, or monetise your data with advertisers or data brokers.</P>
          </Section>

          <Section title="Your rights">
            <P>You may at any time:</P>
            <UL items={[
              "Request a full export of your data.",
              "Request deletion of your account and all associated data.",
              "Update your email address or display name from within the app.",
            ]} />
            <P>To exercise any of these rights, email <a href="mailto:official@suryadeepbanerjee.in" style={{ color: "var(--brand)", textDecoration: "none" }}>official@suryadeepbanerjee.in</a>. We aim to respond to privacy requests as soon as reasonably practicable, and generally within 30 days.</P>
          </Section>

          <Section title="Changes to this policy">
            <P>We will notify you of material changes via email. The "last updated" date above always reflects the most recent revision.</P>
          </Section>
        </div>

        <div style={{ marginTop: 24, textAlign: "center" }}>
          <Link to="/" style={{ fontSize: 13, color: "var(--ink-3)", textDecoration: "none" }}>← Back to home</Link>
        </div>
      </main>
      <Footer />
    </div>
  );
}
