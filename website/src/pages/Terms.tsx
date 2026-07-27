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

export default function Terms() {
  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <Navbar />
      <main style={{ maxWidth: 720, margin: "0 auto", padding: "120px 24px 80px" }}>
        <div style={{ marginBottom: 48 }}>
          <p style={{ fontSize: 12, color: "var(--brand)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>Legal</p>
          <h1 style={{ fontSize: "clamp(1.8rem, 3vw, 2.4rem)", fontWeight: 800, letterSpacing: "-0.025em", color: "var(--ink)", marginBottom: 8 }}>
            Terms of Service
          </h1>
          <p style={{ fontSize: 13, color: "var(--ink-3)" }}>Last updated: January 2025</p>
        </div>

        <div className="card" style={{ padding: "36px 36px" }}>
          <Section title="Acceptance">
            <P>By accessing or using Bill Reminder ("the Service"), you agree to be bound by these Terms of Service. If you do not agree, do not use the Service.</P>
          </Section>

          <Section title="Description of service">
            <P>Bill Reminder is a personal bill and subscription tracking application. It allows you to record recurring payments, set reminders, and review payment history. The Service does not connect to banks, process payments, or provide financial advice.</P>
          </Section>

          <Section title="Your account">
            <P>You are responsible for:</P>
            <UL items={[
              "Maintaining the security of your account credentials.",
              "All activity that occurs under your account.",
              "Notifying us immediately of any unauthorised access at privacy@billreminder.suryadeepbanerjee.in.",
            ]} />
          </Section>

          <Section title="Acceptable use">
            <P>You agree not to:</P>
            <UL items={[
              "Use the Service to store unlawful, fraudulent, or harmful content.",
              "Reverse-engineer, decompile, or create derivative works of the Service.",
              "Attempt to access other users' accounts or data.",
              "Use automated means to access or scrape the Service.",
            ]} />
          </Section>

          <Section title="Data and privacy">
            <P>Your use of the Service is also governed by our <Link to="/privacy" style={{ color: "var(--brand)", textDecoration: "none" }}>Privacy Policy</Link>, which is incorporated into these Terms by reference.</P>
          </Section>

          <Section title="Open source">
            <P>The client-side source code of Bill Reminder is available under the MIT License at <a href="https://github.com/suryadeepbanerjee/Bill-Reminder" target="_blank" rel="noopener noreferrer" style={{ color: "var(--brand)", textDecoration: "none" }}>github.com/suryadeepbanerjee/Bill-Reminder</a>. The MIT License applies to the code itself; these Terms apply to the hosted Service.</P>
          </Section>

          <Section title="Disclaimer">
            <P>The Service is provided "as is" without warranties of any kind. We do not guarantee that the Service will be uninterrupted, error-free, or that reminders will be delivered at the exact scheduled time. Do not rely solely on this Service for critical financial obligations.</P>
          </Section>

          <Section title="Limitation of liability">
            <P>To the maximum extent permitted by law, we are not liable for any indirect, incidental, or consequential damages arising from your use of the Service, including missed payments or financial penalties.</P>
          </Section>

          <Section title="Changes">
            <P>We reserve the right to modify these Terms at any time. Material changes will be communicated by email. Continued use after notification constitutes acceptance of the revised Terms.</P>
          </Section>

          <Section title="Contact">
            <P>Questions about these Terms? Email us at <a href="mailto:legal@billreminder.suryadeepbanerjee.in" style={{ color: "var(--brand)", textDecoration: "none" }}>legal@billreminder.suryadeepbanerjee.in</a>.</P>
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
