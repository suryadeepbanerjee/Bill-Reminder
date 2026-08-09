import { useLayoutEffect } from "react";
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
  useLayoutEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <Navbar />
      <main style={{ maxWidth: 720, margin: "0 auto", padding: "120px 24px 80px" }}>
        <div style={{ marginBottom: 48 }}>
          <p style={{ fontSize: 12, color: "var(--brand)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>Legal</p>
          <h1 style={{ fontSize: "clamp(1.8rem, 3vw, 2.4rem)", fontWeight: 800, letterSpacing: "-0.025em", color: "var(--ink)", marginBottom: 8 }}>
            Terms of Service
          </h1>
          <p style={{ fontSize: 13, color: "var(--ink-3)" }}>Last updated: August 10, 2026</p>
        </div>

        <div className="card" style={{ padding: "36px 36px" }}>
          <Section title="Acceptance">
            <P>By downloading, accessing, or using the Bill Reminder mobile app or website (together, "the Service"), you agree to be bound by these Terms of Service. If you do not agree, please do not use the Service.</P>
          </Section>

          <Section title="Description of service">
            <P>Bill Reminder is a personal bill and subscription tracking application for individuals and households. It lets you record recurring bills, subscriptions, and other repeating expenses, set up reminders, and review payment history and upcoming payment schedules. You may also invite other people to a household so bills and reminders can be shared and tracked together.</P>
            <P>Reminders are sent by email, and, if you use the Bill Reminder mobile app, by push notification as well. Reminders are a convenience to help you keep track of what's due — they are not a payment mechanism.</P>
            <P>Bill Reminder does not process payments. We do not connect to your bank or any financial institution to move money on your behalf, we do not pay your bills for you, and we do not provide financial, banking, lending, investment, or advisory services. Bill Reminder is strictly an organizational and reminder tool.</P>
          </Section>

          <Section title="Eligibility">
            <P>You must be able to form a legally binding contract to use Bill Reminder. By creating an account, you confirm that you have the legal capacity to agree to these Terms under the laws that apply to you.</P>
          </Section>

          <Section title="Your account">
            <P>To use features such as cloud sync and household sharing, you need to create an account. Please provide accurate information when you register, particularly your email address, since it's how reminders and account-related messages reach you.</P>
            <P>You are responsible for keeping your login credentials confidential and for all activity that occurs under your account. If you believe someone has gained unauthorized access to your account, please notify us immediately at <a href="mailto:official@suryadeepbanerjee.in" style={{ color: "var(--brand)", textDecoration: "none" }}>official@suryadeepbanerjee.in</a>.</P>
          </Section>

          <Section title="Household sharing">
            <P>Bill Reminder lets you invite other people to a household so bills, reminders, and payment history can be shared. Household members can be assigned different roles, which control what they can see and do — for example, some members may be able to add, edit, or mark bills as paid, while others may only be able to view them.</P>
            <P>If you invite someone to your household, you are responsible for making sure you have their permission to share the relevant information with them. Please use household sharing responsibly, and do not use it to send unwanted or unsolicited communications to others.</P>
          </Section>

          <Section title="Acceptable use">
            <P>You agree not to:</P>
            <UL items={[
              "Use the Service for any illegal, fraudulent, or unauthorized purpose.",
              "Attempt to gain unauthorized access to another user's account or data.",
              "Reverse-engineer, decompile, or scrape the Service beyond what the open-source license below permits.",
              "Upload malicious code, viruses, or anything designed to disrupt the Service.",
              "Use household sharing to harass, spam, or send unsolicited communications to others.",
            ]} />
            <P>We may suspend or terminate accounts that violate these rules.</P>
          </Section>

          <Section title="Your data">
            <P>You own the data you enter into Bill Reminder — such as bill names, amounts, due dates, and payment history. By using the Service, you grant us a license to host, store, and process that data for the purpose of providing the Service to you, such as syncing it across your devices and sending you reminders. We do not claim ownership of your data.</P>
          </Section>

          <Section title="Intellectual property">
            <P>Aside from the open-source components described below, we own Bill Reminder, including its design, features, and branding. We grant you a limited, non-exclusive, non-transferable, and revocable license to use the app for your personal, non-commercial use, subject to these Terms.</P>
          </Section>

          <Section title="Open source">
            <P>The client-side source code of Bill Reminder is available under the MIT License at <a href="https://github.com/suryadeepbanerjee/Bill-Reminder" target="_blank" rel="noopener noreferrer" style={{ color: "var(--brand)", textDecoration: "none" }}>github.com/suryadeepbanerjee/Bill-Reminder</a>. The MIT License applies to that source code; these Terms apply to your use of the hosted Service (the mobile app and website).</P>
          </Section>

          <Section title="Free service">
            <P>Bill Reminder is currently provided as a free service. We do not charge you to download the app, create an account, or use its core bill-tracking and reminder features. Because we do not process your actual bill payments, you will not see a charge from Bill Reminder on your bank or card statement for the bills you track.</P>
            <P> If we introduce optional paid features in the future, the applicable pricing and terms will be presented before you are charged.</P>
          </Section>

          <Section title="Notifications and missed payments">
            <P>We send reminders to help you stay on top of your bills, but reminders can fail or be delayed for reasons outside our control — including your device's settings, operating system, notification or battery-optimization settings, network conditions, and your email provider's spam filtering.</P>
            <P>You remain responsible for paying your bills on time. Bill Reminder is an organizational and reminder tool, and should not be relied on as your sole means of tracking critical financial obligations. We are not responsible for late fees, penalties, service cancellations, or other consequences of a missed or late payment.</P>
          </Section>

          <Section title="Service availability">
            <P>We provide the Service on an "as is" and "as available" basis. We do not guarantee that the Service will be uninterrupted, error-free, or available at all times.</P>
          </Section>

          <Section title="Suspension & termination">
            <P>We may suspend or terminate your access to the Service if you violate these Terms, misuse the Service, create a security or legal risk, or if we discontinue the Service.</P>
            <P>You can stop using Bill Reminder and delete your account at any time from within the app's settings. Deleting your account removes your access to the Service and initiates removal of your associated data, as described in our Privacy Policy.</P>
          </Section>

          <Section title="Privacy">
            <P>Your use of the Service is also governed by our <Link to="/privacy" style={{ color: "var(--brand)", textDecoration: "none" }}>Privacy Policy</Link>, which is incorporated into these Terms by reference.</P>
          </Section>

          <Section title="Changes">
            <P>We may update these Terms from time to time. If we make material changes, we will notify you by email or through a notice in the app before the changes take effect. Continuing to use Bill Reminder after that means you accept the updated Terms.</P>
          </Section>

          <Section title="Limitation of liability">
            <P>To the maximum extent permitted by law, we are not liable for any indirect, incidental, special, or consequential damages arising from your use of the Service, including missed payments or financial penalties. In jurisdictions that do not allow certain limitations, our liability is limited to the greatest extent permitted by applicable law.</P>
          </Section>

          <Section title="Contact">
            <P>Questions about these Terms? Email us at <a href="mailto:official@suryadeepbanerjee.in" style={{ color: "var(--brand)", textDecoration: "none" }}>official@suryadeepbanerjee.in</a> or visit <a href="https://billreminder.suryadeepbanerjee.in" target="_blank" rel="noopener noreferrer" style={{ color: "var(--brand)", textDecoration: "none" }}>billreminder.suryadeepbanerjee.in</a>.</P>
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
