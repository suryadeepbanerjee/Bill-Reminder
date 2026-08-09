import { useEffect, useRef, useState } from "react";
import {
  isCaptchaEnabled,
  mountCaptchaWidget,
  type CaptchaMountHandle,
  type CaptchaWidgetState,
} from "../../lib/captcha";

const STATE_LABELS: Record<CaptchaWidgetState, { text: string; tone: string }> = {
  idle:    { text: "Verify you're human below", tone: "text-secondary" },
  solving: { text: "Completing security check…", tone: "text-secondary" },
  solved:  { text: "Verification complete", tone: "text-success" },
  expired: { text: "Security check expired — solve it again", tone: "text-error" },
  error:   { text: "Security check failed — please reload", tone: "text-error" },
};

interface CaptchaFieldProps {
  theme?: "dark" | "light" | "auto";
}

/**
 * ALWAYS-VISIBLE Turnstile widget. Renders the standard Cloudflare checkbox
 * inline in the form — no popup, no hidden execution. The token is consumed
 * by captchaOptions()/withCaptcha() at submit time.
 */
export default function CaptchaField({ theme = "auto" }: CaptchaFieldProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const handleRef = useRef<CaptchaMountHandle | null>(null);
  const [state, setState] = useState<CaptchaWidgetState>("idle");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!isCaptchaEnabled) return;
    const host = hostRef.current;
    if (!host) return;

    let cancelled = false;
    handleRef.current?.destroy();
    handleRef.current = null;
    setLoadError(null);
    setState("idle");

    mountCaptchaWidget(host, (next) => {
      if (!cancelled) setState(next);
    }, { theme })
      .then((handle) => {
        if (!cancelled) handleRef.current = handle;
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : "Could not load the security check");
        }
      });

    return () => {
      cancelled = true;
      handleRef.current?.destroy();
      handleRef.current = null;
    };
  }, [attempt]);

  if (!isCaptchaEnabled) return null;

  const label = STATE_LABELS[state];

  return (
    <div className="space-y-1.5">
      <div className="flex justify-center">
        <div ref={hostRef} className="min-h-[65px] overflow-x-auto" />
      </div>

      {loadError ? (
        <div className="flex flex-col items-center gap-2">
          <p className="text-xs text-error text-center">{loadError}</p>
          <button
            type="button"
            onClick={() => setAttempt((n) => n + 1)}
            className="text-xs font-semibold text-accent hover:underline"
          >
            Reload security check
          </button>
        </div>
      ) : (
        <p className={`text-center text-[11px] font-medium ${label.tone}`}>{label.text}</p>
      )}
    </div>
  );
}