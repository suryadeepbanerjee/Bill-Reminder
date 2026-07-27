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

export default function Terms() {
  return (
    <div className="min-h-screen bg-[#080810]">
      <Navbar />
      <main className="max-w-3xl mx-auto px-5 pt-32 pb-24">
        <div className="mb-12">
          <p className="text-accent-400 text-sm font-medium mb-3">Legal</p>
          <h1 className="text-4xl font-bold tracking-tight mb-4">Terms of Service</h1>
          <p className="text-white/40 text-sm">Last updated: January 2025</p>
        </div>

        <div className="glass rounded-2xl p-8 sm:p-10">
          <Section title="Acceptance">
            <p>
              By downloading, installing, or using Bill Reminder ("the App") or visiting billreminder.suryadeepbanerjee.in ("the Website"), you agree to be bound by these Terms of Service. If you do not agree, do not use the service.
            </p>
          </Section>

          <Section title="Description of service">
            <p>
              Bill Reminder is a personal finance tool for tracking recurring bills and payment reminders. The service is provided free of charge and is open source under the MIT License.
            </p>
          </Section>

          <Section title="Accounts">
            <ul className="list-disc pl-5 space-y-1.5">
              <li>You must provide a valid email address to create an account.</li>
              <li>You are responsible for maintaining the security of your account credentials.</li>
              <li>You must notify us immediately if you suspect unauthorised access.</li>
              <li>One account per person. Do not create accounts on behalf of others without their consent.</li>
            </ul>
          </Section>

          <Section title="Acceptable use">
            <p>You agree not to:</p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>Attempt to gain unauthorised access to any part of the service or its infrastructure.</li>
              <li>Use the service to store illegal content or engage in fraudulent activity.</li>
              <li>Reverse-engineer or attempt to extract proprietary components of the service.</li>
              <li>Abuse the service in ways that degrade performance for other users.</li>
            </ul>
          </Section>

          <Section title="Data and privacy">
            <p>
              Your use of the service is also governed by our{" "}
              <Link to="/privacy" className="text-accent-400 hover:text-accent-300 underline underline-offset-2">
                Privacy Policy
              </Link>
              , which is incorporated by reference into these Terms.
            </p>
          </Section>

          <Section title="Disclaimer of warranties">
            <p>
              The service is provided "as is" without warranties of any kind, express or implied. We do not guarantee uptime, data accuracy, or fitness for any particular purpose. Bill Reminder is a personal project, not a regulated financial service.
            </p>
          </Section>

          <Section title="Limitation of liability">
            <p>
              To the fullest extent permitted by law, Bill Reminder and its contributors shall not be liable for any indirect, incidental, or consequential damages arising from your use of the service, including missed payments or financial losses.
            </p>
          </Section>

          <Section title="Open source">
            <p>
              The source code of Bill Reminder is available on{" "}
              <a
                href="https://github.com/suryadeepbanerjee/Bill-Reminder"
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent-400 hover:text-accent-300 underline underline-offset-2"
              >
                GitHub
              </a>{" "}
              under the MIT License. Contributions are welcome and governed by that license.
            </p>
          </Section>

          <Section title="Changes">
            <p>
              We may update these Terms at any time. Continued use of the service after changes constitutes acceptance. Material changes will be notified via email.
            </p>
          </Section>

          <Section title="Contact">
            <p>
              For any questions about these Terms, email{" "}
              <a href="mailto:legal@billreminder.suryadeepbanerjee.in" className="text-accent-400 hover:text-accent-300 underline underline-offset-2">
                legal@billreminder.suryadeepbanerjee.in
              </a>.
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
