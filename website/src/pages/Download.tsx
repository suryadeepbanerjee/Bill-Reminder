import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import Navbar from "../components/layout/Navbar";
import Footer from "../components/layout/Footer";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";

/**
 * APK assets are hosted exclusively on GitHub Releases (v1.0.0).
 * This page only links to the direct asset URLs — no binaries live here.
 */
const VERSION = "v1.0.0";
const RELEASE_URL =
  "https://github.com/suryadeepbanerjee/Bill-Reminder/releases/tag/v1.0.0";
const ASSET_BASE =
  "https://github.com/suryadeepbanerjee/Bill-Reminder/releases/download/v1.0.0";

const UNIVERSAL = {
  name: "Universal Download",
  file: "Bill-Reminder-Universal.apk",
  size: "86.9 MB",
  description: "Works across supported Android architectures.",
};

const VARIANTS = [
  { name: "ARM64-v8a", file: "Bill-Reminder-arm64-v8a.apk", size: "36.8 MB", description: "Modern Android phones / most devices" },
  { name: "ARMv7", file: "Bill-Reminder-armeabi-v7a.apk", size: "31.2 MB", description: "Older 32-bit ARM devices" },
  { name: "x86_64", file: "Bill-Reminder-x86_64.apk", size: "37.3 MB", description: "64-bit Intel devices / emulators" },
  { name: "x86", file: "Bill-Reminder-x86.apk", size: "37.7 MB", description: "Older Intel devices / emulators" },
];

const assetUrl = (file: string) => `${ASSET_BASE}/${file}`;

const DownloadIcon = (
  <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
  </svg>
);

const focusRing =
  "rounded-input focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas";

function Reveal({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 20 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.55, delay }}
    >
      {children}
    </motion.div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2.5 border-b border-border last:border-0">
      <dt className="text-sm text-secondary">{label}</dt>
      <dd className="text-sm font-semibold text-primary">{value}</dd>
    </div>
  );
}

export default function Download() {
  return (
    <div className="min-h-screen bg-canvas">
      <Navbar />
      <main className="container mx-auto px-6" style={{ maxWidth: 1080 }}>
        {/* ── Hero ─────────────────────────────────────────────── */}
        <section className="pt-20 pb-12 text-center" aria-labelledby="download-hero-heading">
          <Reveal>
            <img
              src="/logo-mark.png"
              alt="Bill Reminder logo"
              className="h-16 w-auto object-contain mx-auto mb-6"
            />
            <h1
              id="download-hero-heading"
              className="text-[clamp(2rem,4.2vw,3rem)] font-extrabold tracking-tight text-primary mb-3"
              style={{ textWrap: "balance" as any }}
            >
              Download Bill Reminder
            </h1>
            <p className="text-[clamp(15px,2vw,17px)] text-primary/70 leading-relaxed max-w-[56ch] mx-auto">
              Get the latest Android version of Bill Reminder.
            </p>
          </Reveal>
        </section>

        {/* ── Recommended download ─────────────────────────────── */}
        <section aria-labelledby="recommended-heading">
          <Reveal>
            <Card className="max-w-lg mx-auto p-6 md:p-8 text-center">
              <span className="inline-flex items-center px-3 py-1 rounded-pill bg-accent text-accent-text text-xs font-bold uppercase tracking-[0.08em] mb-5">
                Recommended
              </span>
              <h2
                id="recommended-heading"
                className="text-xl font-extrabold tracking-tight text-primary mb-2"
              >
                {UNIVERSAL.name}
              </h2>
              <p className="text-sm text-secondary leading-relaxed mb-6">
                {UNIVERSAL.description}
              </p>

              <dl>
                <Meta label="Version" value={VERSION} />
                <Meta label="Size" value={UNIVERSAL.size} />
                <Meta label="Platform" value="Android" />
              </dl>

              <a
                href={assetUrl(UNIVERSAL.file)}
                className={`inline-block w-full mt-7 ${focusRing}`}
                aria-label={`Download Universal APK, ${UNIVERSAL.size}`}
              >
                <Button size="lg" icon={DownloadIcon} fullWidth>
                  Download Universal APK
                </Button>
              </a>
            </Card>
          </Reveal>
        </section>

        {/* ── Architecture-specific ────────────────────────────── */}
        <section className="pt-16 pb-12" aria-labelledby="variants-heading">
          <Reveal>
            <div className="text-center mb-8">
              <h2
                id="variants-heading"
                className="text-[clamp(1.3rem,2.6vw,1.7rem)] font-extrabold tracking-tight text-primary mb-2.5"
              >
                Architecture-specific downloads
              </h2>
              <p className="text-sm text-secondary leading-relaxed max-w-[52ch] mx-auto">
                If you know your device architecture, these smaller APKs can reduce the download size.
              </p>
            </div>
          </Reveal>

          <Reveal delay={0.08}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-3xl mx-auto">
              {VARIANTS.map((v) => (
                <Card key={v.file} padding={false} className="p-5">
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <h3 className="text-[15px] font-bold text-primary">{v.name}</h3>
                      <p className="text-sm text-secondary mt-0.5">{v.size}</p>
                      <p className="text-[13px] text-secondary leading-snug mt-1.5">
                        {v.description}
                      </p>
                    </div>
                    <a
                      href={assetUrl(v.file)}
                      className={`shrink-0 ${focusRing}`}
                      aria-label={`Download ${v.name} APK, ${v.size}`}
                    >
                      <Button variant="secondary" size="md" icon={DownloadIcon}>
                        Download
                      </Button>
                    </a>
                  </div>
                </Card>
              ))}
            </div>
          </Reveal>
        </section>

        {/* ── Which one should I choose? ───────────────────────── */}
        <section className="pb-14" aria-labelledby="help-heading">
          <Reveal>
            <Card padding={false} className="max-w-lg mx-auto p-6 text-center bg-input/60">
              <h2
                id="help-heading"
                className="text-base font-bold text-primary mb-2"
              >
                Not sure which one to download?
              </h2>
              <p className="text-sm text-secondary leading-relaxed">
                For most Android phones, use the Universal APK. If you specifically
                know your device uses ARM64, the ARM64-v8a APK is smaller.
              </p>
            </Card>
          </Reveal>
        </section>
      </main>

      {/* ── Version information ───────────────────────────────── */}
      <section className="border-t border-border" aria-label="Version information">
        <Reveal>
          <div className="container mx-auto px-6 py-10 flex flex-col items-center gap-2 text-center">
            <img
              src="/logo-mark.png"
              alt="Bill Reminder logo"
              className="h-9 w-auto object-contain"
            />
            <p className="text-sm font-semibold text-primary">Bill Reminder</p>
            <p className="text-[13px] text-secondary">
              Version {VERSION} &middot; Android
            </p>
            <a
              href={RELEASE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className={`mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-secondary hover:text-primary transition-colors ${focusRing}`}
            >
              View release on GitHub
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </a>
          </div>
        </Reveal>
      </section>

      <Footer />
    </div>
  );
}
