import Navbar from "../components/layout/Navbar";
import Footer from "../components/layout/Footer";
import Hero from "../components/sections/Hero";
import Features from "../components/sections/Features";
import HowItWorks from "../components/sections/HowItWorks";
import WhyBillReminder from "../components/sections/WhyBillReminder";
import Download from "../components/sections/Download";

export default function Home() {
  return (
    <div className="min-h-screen bg-[#080810]">
      <Navbar />
      <main>
        <Hero />

        {/* Separator */}
        <div className="max-w-6xl mx-auto px-5">
          <div className="h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
        </div>

        <Features />

        <div className="max-w-6xl mx-auto px-5">
          <div className="h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
        </div>

        <HowItWorks />

        <div className="max-w-6xl mx-auto px-5">
          <div className="h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
        </div>

        <WhyBillReminder />

        <div className="max-w-6xl mx-auto px-5">
          <div className="h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
        </div>

        <Download />
      </main>
      <Footer />
    </div>
  );
}
