import Navbar from "../components/layout/Navbar";
import Footer from "../components/layout/Footer";
import Hero from "../components/sections/Hero";
import About from "../components/sections/About";
import Features from "../components/sections/Features";
import HowItWorks from "../components/sections/HowItWorks";
import Download from "../components/sections/Download";
import FAQ from "../components/sections/FAQ";

export default function Home() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <About />
        <Features />
        <HowItWorks />
        <FAQ />
        <Download />
      </main>
      <Footer />
    </>
  );
}
