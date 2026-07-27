import { Link } from "react-router-dom";
import Navbar from "../components/layout/Navbar";
import Footer from "../components/layout/Footer";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="text-xl font-semibold text-white mb-3">{title}</h2>
      <div className="text-white/55 leading-relaxed space-y-3 text-[15px]">{children}</div>
    </section>
  );
}

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-[#080810]">
      <Navbar />
      <main className="max-w-3xl mx-auto px-5 pt-32 pb-24">
        <div className="mb-12">
          <p className="text-accent-400 text-sm font-medium mb-3">Legal</p>
          <h1 className="text-4xl font-bold tracking-tight mb-4">Privacy Policy</h1>
          <p className="text-white/40 text-sm">Last updated: January 2025</p>
        </div>

        <div className="glass rounded-2xl p-8 sm:p-10">
          <Section title="Overview">
            <p>
              Bill Reminder ("we", "us", "our") is committed to protecting your privacy. This policy explains what data we collect, why we collect it, and how it is handled. We built Bill Reminder with a privacy-first philosophy — your financial data belongs to you.
            </p>
          </Section>

          <Section title="Data we collect">
            <p>We collect only what is strictly necessary to provide the service:</p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li><strong className="text-white/80">Email address</strong> — for authentication and account recovery only.</li>
              <li><strong className="text-white/80">Display name</strong> — optional, used to personalise your experience.</li>
              <li><strong className="text-white/80">Bill data</strong> — names, amounts, due dates, and categories you enter. This is stored in your private, isolated account.</li>
            </ul>
            <p>We do <strong className="text-white/80">not</strong> collect payment card details, bank credentials, government IDs, or any financial institution data.</p>
          </Section>

          <Section title="How your data is stored">
            <p>
              All data is stored in Supabase, a cloud database protected by Row-Level Security (RLS). This means database queries are enforced at the database level — no query can access another user's data even if application code has a bug.
            </p>
            <p>
              Supabase encrypts data at rest and in transit. For details on Supabase's security posture, see{" "}
              <a href="https://supabase.com/security" target="_blank" rel="noopener noreferrer" className="text-accent-400 hover:text-accent-300 underline underline-offset-2">
                supabase.com/security
              </a>.
            </p>
          </Section>

          <Section title="Third parties">
            <p>We use the following third-party services:</p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li><strong className="text-white/80">Supabase</strong> — database and authentication.</li>
              <li><strong className="text-white/80">Resend</strong> — transactional email (verification, password reset). Only your email address is shared.</li>
              <li><strong className="text-white/80">Vercel</strong> — website hosting. Standard web logs (IP, user agent) apply.</li>
            </ul>
            <p>We do <strong className="text-white/80">not</strong> sell, share, or monetise your data with advertisers or data brokers.</p>
          </Section>

          <Section title="Your rights">
            <p>You may at any time:</p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>Request a full export of your data.</li>
              <li>Request deletion of your account and all associated data.</li>
              <li>Update your email address or display name from the app.</li>
            </ul>
            <p>
              To exercise any of these rights, email{" "}
              <a href="mailto:privacy@billreminder.suryadeepbanerjee.in" className="text-accent-400 hover:text-accent-300 underline underline-offset-2">
                privacy@billreminder.suryadeepbanerjee.in
              </a>
              . We will respond within 30 days.
            </p>
          </Section>

          <Section title="Changes to this policy">
            <p>
              We will notify you of material changes to this policy via email. The "last updated" date at the top of this page will always reflect the most recent revision.
            </p>
          </Section>
        </div>

        <div className="mt-8 text-center">
          <Link to="/" className="text-sm text-white/30 hover:text-white/60 transition-colors">
            ← Back to home
          </Link>
        </div>
      </main>
      <Footer />
    </div>
  );
}
