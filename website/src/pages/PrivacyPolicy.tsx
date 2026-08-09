import { useEffect } from "react";
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

function UL({ items }: { items: React.ReactNode[] }) {
  return (
    <ul style={{ paddingLeft: 20, marginBottom: 12 }}>
      {items.map((i, idx) => <li key={idx} style={{ marginBottom: 6 }}>{i}</li>)}
    </ul>
  );
}

export default function PrivacyPolicy() {
  // Always land at the top of the page on mount (covers both a hard refresh
  // and a client-side route change into this page). Scoped to this
  // component only, so it does not touch scroll behavior anywhere else.
  useEffect(() => {
    if (typeof window !== "undefined" && "scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }
    window.scrollTo(0, 0);
  }, []);

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <Navbar />
      <main style={{ maxWidth: 720, margin: "0 auto", padding: "120px 24px 80px" }}>
        <div style={{ marginBottom: 48 }}>
          <p style={{ fontSize: 12, color: "var(--brand)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>Legal</p>
          <h1 style={{ fontSize: "clamp(1.8rem, 3vw, 2.4rem)", fontWeight: 800, letterSpacing: "-0.025em", color: "var(--ink)", marginBottom: 8 }}>
            Privacy Policy
          </h1>
          <p style={{ fontSize: 13, color: "var(--ink-3)" }}>Last updated: August 10, 2026</p>
        </div>

        <div className="card" style={{ padding: "36px 36px" }}>
          <Section title="Overview">
            <P>Bill Reminder is a personal bill and subscription tracker for recurring payments — rent, utilities, EMIs, credit cards, subscriptions, and similar expenses. It helps you see what's due, what's overdue, and what's already been paid, on your phone and on the web.</P>
            <P>Bill Reminder is an organizational tool. It does not process payments and does not provide banking, lending, investment, or financial-advisory services — it only helps you keep track of bills you tell it about.</P>
            <P>This policy explains what we collect to run the service, why, how it's stored, and the choices you have. Access to your data is enforced at the database level (Row-Level Security), not only by application code, and we try to collect only what the app actually needs.</P>
          </Section>

          <Section title="Data we collect">
            <P><strong>Account &amp; authentication</strong></P>
            <UL items={[
              "Email address — required, to sign you in, recover your account, and deliver bill reminders, household invites, and account/security emails to you.",
              "Display name — optional, shown to you and to anyone you share a household with.",
              "Password — if you sign up with email and password, our authentication provider (Supabase Auth) stores it in hashed form; we never see or store it as plain text.",
              "Google name and email — only if you choose \u201cContinue with Google.\u201d We request the minimum OAuth scopes (openid, email, profile) and never request or receive access to your Gmail, Drive, Calendar, Photos, or Contacts.",
              "Profile picture — optional, if you set one.",
            ]} />
            <P><strong>Bills, payments and households</strong></P>
            <UL items={[
              "Bill details you enter — title, provider name, category, amount, currency, due dates, and recurrence settings.",
              "Payment records — amount paid, date, notes, and an optional receipt reference, created when you mark a bill as paid.",
              "Household information — a household name, and the roles and email addresses of anyone you invite (including people who haven't accepted yet).",
            ]} />
            <P><strong>Notifications &amp; devices</strong></P>
            <UL items={[
              "A push notification token (issued by Expo) and, optionally, a label for the device, so we know where to deliver your reminders.",
              "Whether you have push and/or email notifications turned on, at the account and per-bill level.",
            ]} />
            <P><strong>Technical &amp; security data</strong></P>
            <UL items={[
              "Your IP address, processed briefly by our bot-protection (Cloudflare Turnstile) and rate-limiting (Upstash Redis) systems on public, unauthenticated actions — to slow down things like sign-up spam or brute-force sign-in attempts. It's hashed before being written to any security log and isn't stored as part of your profile.",
              "Standard web request logs generated by our hosting provider (Vercel), which can include IP address and browser/user-agent information.",
            ]} />
            <P>We do <strong>not</strong> collect payment card numbers, bank credentials, government IDs, biometric data, or precise real-time location.</P>
          </Section>

          <Section title="Household sharing">
            <P>Bill Reminder supports shared households with three roles — Owner, Admin, and Member.</P>
            <UL items={[
              "If you create or join a household, your display name and the bills, payment history, and categories in that household are visible to its other active members, according to their role.",
              "Owners can manage the household (invite or remove members, change roles, transfer ownership, delete the household) plus everything below. Admins can add, edit, delete, and mark bills paid, and receive email reminders. Members have read-only access to bills and history, and receive push reminders only.",
              "Inviting someone by email shares that email address with us — and with our email provider, Resend, to deliver the invite — even before they accept and create an account.",
              "Sensitive actions — deleting your account, transferring household ownership — require a one-time verification code sent to your email. Every household is guaranteed to have exactly one Owner, which is enforced by the database itself rather than only by the app's interface.",
            ]} />
          </Section>

          <Section title="How we use your information">
            <UL items={[
              "To create and secure your account, and keep you signed in.",
              "To sync your bills, payments, and household data across your devices.",
              "To calculate due dates and send the push and/or email reminders you've configured.",
              "To let household members collaborate on shared bills, according to their role.",
              "To detect and slow down abuse of sign-up, sign-in, and invite flows (rate limiting, CAPTCHA).",
              "To fix bugs and understand aggregate usage of the website (see \u201cCookies &amp; analytics\u201d below).",
              "To comply with a legal obligation, such as a valid court order, if we're required to.",
            ]} />
            <P>We do not currently send marketing or promotional emails. Every email we send is tied to something you did — a reminder you set up, a household invite, a security code, or an account change. If that ever changes, we'll update this policy first.</P>
          </Section>

          <Section title="How your data is stored">
            <P>All application data (accounts, bills, payments, household records) lives in Supabase, on PostgreSQL, encrypted at rest and in transit. Access is enforced with household-scoped Row-Level Security (RLS): the database itself blocks a query from reading or writing another household's data, rather than relying solely on application code to get it right. Sensitive operations, like transferring household ownership, run through database functions with their own authorization checks and are recorded in an audit log. For more on Supabase's security practices, see <a href="https://supabase.com/security" target="_blank" rel="noopener noreferrer" style={{ color: "var(--brand)", textDecoration: "none" }}>supabase.com/security</a>.</P>
          </Section>

          <Section title="Third-party services">
            <P>We use the following third parties. We do not sell, share, or monetise your data with advertisers or data brokers.</P>
            <UL items={[
              "Supabase — our database, authentication, and backend. Stores your account, bill, payment, and household data, and issues/refreshes your session.",
              "Resend — sends transactional email: bill reminders, household invites, and account/security emails (verification, password reset, email-change confirmation). Your email address, and the relevant bill or household details for that message, are shared with Resend to send it.",
              "Vercel — hosts the website and its serverless infrastructure. Standard web logs (e.g., IP address, user agent) may apply as part of hosting.",
              "Vercel Web Analytics — measures aggregate website traffic (pages visited, referring site, approximate country, device/browser type). It doesn't use cookies; visitors are identified by a short-lived hash of the request rather than a personal identifier, and it can't tell one visit apart as belonging to a specific person.",
              "Upstash — Redis-based rate limiting on sign-up, sign-in, and household-invite endpoints. Processes your IP address (or, if you're signed in, your account ID) briefly to count requests; this data expires automatically within the relevant limit window (minutes to hours) and isn't kept long-term.",
              "Cloudflare Turnstile — a CAPTCHA-style check on sign-in, sign-up, and other sensitive account actions, used to tell humans from bots. It runs in a widget served from Cloudflare and may set its own cookies as part of that check.",
              "Google — optional \u201cContinue with Google\u201d sign-in. Google shares your name and email address with us; we request only the openid, email, and profile scopes and never request access to Gmail, Drive, Calendar, Photos, or Contacts.",
              "Expo — delivers push notifications to your device using a push token generated by the Expo push service.",
              "Firebase — Google's push-messaging infrastructure (FCM), used by Expo to deliver notifications on Android devices.",
            ]} />
          </Section>

          <Section title="Security">
            <P>We use TLS encryption for data in transit and encryption at rest through Supabase, database-level Row-Level Security to keep household data separated, and one-time email verification codes on sensitive actions like account deletion and household-ownership transfer. Rate limiting and CAPTCHA checks help slow down automated abuse of authentication endpoints.</P>
            <P>No method of transmission or storage is perfectly secure, and we can't guarantee absolute security. If we become aware of a security incident affecting your personal information, we'll investigate and, where required by law, notify affected users.</P>
          </Section>

          <Section title="Data retention">
            <UL items={[
              "Bill, payment, and household data — kept for as long as your account and the relevant household exist.",
              "Notification delivery records (what was sent and when) — deleted automatically after 90 days by a scheduled weekly cleanup job.",
              "Archived (settled) bill occurrences — deleted automatically after 1 year by the same job.",
              "Rate-limiting records (IP or account request counts) — expire automatically within the relevant limit window, typically minutes to hours; none of it is kept long-term.",
              "Household audit-log entries (records of sensitive actions like role changes or ownership transfers) — kept until the associated account is deleted.",
            ]} />
            <P>Backups maintained by our infrastructure providers may retain residual copies of deleted data for a short period until they're naturally overwritten in the normal backup cycle.</P>
          </Section>

          <Section title="Your rights">
            <P>You can, at any time:</P>
            <UL items={[
              "Update your display name, email, or password directly in the app's Settings.",
              "Export your data as a JSON file from Settings (share sheet on mobile, direct download on web).",
              "Delete your account from Settings, after confirming with a one-time code sent to your email. This removes your profile, your notification and audit-log records, your push notification tokens, and your membership in any households. If you're the sole member of a household, that household — including its bills and payment history — is deleted too; if you share a household with others, your membership is removed but the household's data remains for the remaining members.",
            ]} />
            <P>For anything you can't do directly in the app, email <a href="mailto:official@suryadeepbanerjee.in" style={{ color: "var(--brand)", textDecoration: "none" }}>official@suryadeepbanerjee.in</a> and we'll respond as soon as we reasonably can.</P>
          </Section>

          <Section title="Cookies & analytics">
            <P>The website doesn't use cookies for its own core functionality — you stay signed in via secure browser storage, not a cookie. Two things on the site involve limited tracking:</P>
            <UL items={[
              "Vercel Web Analytics (described above) is cookie-less and anonymized.",
              "Cloudflare Turnstile, shown during sign-in/sign-up to filter out bots, may set its own cookies as part of that check, the way any embedded CAPTCHA widget does.",
            ]} />
            <P>We don't use advertising or cross-site tracking cookies, and we don't run Google Analytics or similar tools.</P>
          </Section>

          <Section title="Children's privacy">
            <P>Bill Reminder is meant for adults and older teens managing their own or a household's bills, and isn't directed at young children. We don't knowingly collect personal information from children. If you believe a child has created an account or been added to a household without appropriate consent, contact us at <a href="mailto:official@suryadeepbanerjee.in" style={{ color: "var(--brand)", textDecoration: "none" }}>official@suryadeepbanerjee.in</a> and we'll remove the relevant information.</P>
          </Section>

          <Section title="International data processing">
            <P>Bill Reminder is available globally, and our infrastructure providers (Supabase, Vercel, Resend, Upstash, Cloudflare) run servers in multiple countries. This means your information may be processed outside the country you're in. We choose providers that encrypt data in transit and at rest, but we don't separately layer on additional cross-border transfer mechanisms beyond what those providers offer by default. Contact us if you have questions about where your data is processed.</P>
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
