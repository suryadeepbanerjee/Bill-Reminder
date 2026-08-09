/**
 * CaptchaHost — popup "Security check" modal hosting the Turnstile widget.
 *
 * Rendered LAZILY in the root layout (native WebView module never loads on
 * the cold-start path — see Startup & Performance). When a token is requested
 * it slides in a centered card: spinner while the widget buffers, then the
 * Cloudflare widget (normal 300×65 checkbox; interactive challenges render
 * inside for VPN/suspicious IPs). On failure the card stays open with a
 * "Try again" action so the user can redo the challenge instead of being
 * kicked back to the form. The page posts the token (or an error) back via
 * ReactNativeWebView.postMessage → completeCaptcha().
 */

import { useCallback, useEffect, useState } from "react";
import { View, Text, Pressable, Modal, ActivityIndicator } from "react-native";
import { WebView } from "react-native-webview";

import {
  CAPTCHA_SITE_KEY,
  isCaptchaEnabled,
  subscribeCaptchaActive,
  subscribeCaptchaRequest,
  completeCaptcha,
} from "../../lib/captcha";

const WIDGET_TIMEOUT_MS = 90000;

function buildHtml(siteKey: string, nonce: number): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<style>
  html, body {
    height: 100%;
    margin: 0;
    padding: 0;
    background: transparent;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  #widget-host {
    min-height: 65px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
</style>
<script src="https://challenges.cloudflare.com/turnstile/v0/api.js?onload=__brTurnstileReady&render=explicit" async defer>
</script>
</head>
<body>
<div id="widget-host"></div>
<script>
function post(type, extra) {
  var payload = { type: type };
  if (extra) { for (var k in extra) { payload[k] = extra[k]; } }
  if (window.ReactNativeWebView) {
    window.ReactNativeWebView.postMessage(JSON.stringify(payload));
  }
}
function __brTurnstileReady() {
  if (!window.turnstile) {
    post("error", { message: "widget unavailable" });
    return;
  }
  var host = document.getElementById("widget-host");
  try {
    window.turnstile.render(host, {
      sitekey: "${siteKey}",
      // "normal" = standard 300×65 Cloudflare checkbox widget.
      // Auto-passes silently for clean traffic; shows interactive puzzle
      // for WebView/VPN traffic. Always visible, never clipped.
      size: "normal",
      theme: "dark",
      callback: function (token) { post("token", { token: token }); },
      "error-callback": function () { post("error", { message: "challenge failed" }); },
      "expired-callback": function () { post("error", { message: "challenge expired" }); },
    });
  } catch (e) {
    post("error", { message: "init failed" });
    return;
  }
  // Only when Turnstile's checkbox iframe actually appears in the DOM do we
  // tell the app the widget is on screen. Until then the app keeps showing
  // its buffering spinner instead of a premature "tick the checkbox" prompt.
  var reported = false;
  function reportReady() {
    if (reported) return;
    reported = true;
    post("widget-ready");
  }
  var attempts = 0;
  var poll = window.setInterval(function () {
    attempts += 1;
    if (host.querySelector("iframe[src*='challenges.cloudflare.com']")) {
      window.clearInterval(poll);
      window.setTimeout(reportReady, 250); // let it paint
    } else if (attempts > 300) {
      window.clearInterval(poll); // 60s max wait — outer timeout posts anyway
    }
  }, 200);
}
setTimeout(function () { post("timeout"); }, ${WIDGET_TIMEOUT_MS});
</script>
</body>
</html>`;
}

export function CaptchaHost() {
  const [active, setActive] = useState(false);
  const [widgetReady, setWidgetReady] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [solved, setSolved] = useState(false);
  const [nonce, setNonce] = useState(() => Date.now());

  useEffect(() => subscribeCaptchaActive(setActive), []);
  useEffect(() => subscribeCaptchaRequest(setNonce), []);

  // Every activation gets a fresh widget run (nonce changes the html source
  // so the WebView reloads and Turnstile issues a brand-new token). The
  // buffering spinner stays up until the widget itself reports checkbox.
  useEffect(() => {
    if (active) {
      setWidgetReady(false);
      setFailed(null);
      setSolved(false);
    }
  }, [active, nonce]);

  const retry = useCallback(() => {
    setWidgetReady(false);
    setFailed(null);
    setSolved(false);
    setNonce(Date.now());
  }, []);

  const handleMessage = useCallback((event: { nativeEvent: { data: string } }) => {
    let msg: { type?: string; token?: string; message?: string };
    try {
      msg = JSON.parse(event.nativeEvent.data);
    } catch {
      return;
    }
    if (msg.type === "widget-ready") {
      setWidgetReady(true);
    } else if (msg.type === "token" && typeof msg.token === "string" && msg.token) {
      setFailed(null);
      setSolved(true);
      completeCaptcha(msg.token, undefined, true);
    } else if (msg.type === "error") {
      // Keep the popup open with a retry option — the pending request stays
      // alive until the user retries or cancels.
      setFailed(msg.message ?? "CAPTCHA challenge failed");
    } else if (msg.type === "timeout") {
      setFailed("Security check timed out — please try again");
    }
  }, []);

  const handleLoadFailure = useCallback(() => {
    setFailed("Could not load the security check — check your connection");
  }, []);

  const handleCancel = useCallback(() => {
    completeCaptcha(undefined, "CAPTCHA dismissed");
  }, []);

  if (!isCaptchaEnabled) return null;

  return (
    <Modal
      visible={active}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={handleCancel}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.55)",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
        }}
      >
        <View
          style={{
            width: "100%",
            maxWidth: 360,
            backgroundColor: "#1E1E1E",
            borderRadius: 16,
            overflow: "hidden",
            borderWidth: 1,
            borderColor: "#333333",
          }}
        >
          {/* Header */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              paddingHorizontal: 16,
              paddingVertical: 12,
              borderBottomWidth: 1,
              borderBottomColor: "#333333",
            }}
          >
            <Text style={{ color: "#F9FAFB", fontSize: 14, fontWeight: "600" }}>
              Security check
            </Text>
            <Pressable
              onPress={handleCancel}
              hitSlop={8}
              accessibilityLabel="Cancel security check"
            >
              <Text style={{ color: "#A3A3A3", fontSize: 18, lineHeight: 20 }}>✕</Text>
            </Pressable>
          </View>

          {/* Body */}
          {failed ? (
            <View
              style={{
                alignItems: "center",
                padding: 24,
                gap: 14,
              }}
            >
              <Text
                style={{
                  color: "#F9FAFB",
                  fontSize: 13,
                  textAlign: "center",
                  lineHeight: 19,
                }}
              >
                {failed}
              </Text>
              <Pressable
                onPress={retry}
                accessibilityRole="button"
                accessibilityLabel="Try the security check again"
                style={{
                  backgroundColor: "#D1A920",
                  borderRadius: 10,
                  paddingHorizontal: 20,
                  paddingVertical: 10,
                }}
              >
                <Text style={{ color: "#121212", fontSize: 13, fontWeight: "600" }}>
                  Try again
                </Text>
              </Pressable>
            </View>
          ) : !widgetReady ? (
            <View style={{ alignItems: "center", padding: 32, gap: 12 }}>
              <ActivityIndicator size="small" color="#D1A920" />
              <Text
                style={{
                  color: "#9CA3AF",
                  fontSize: 13,
                  textAlign: "center",
                }}
              >
                Checking your browser…
              </Text>
            </View>
          ) : (
            <View
              style={{
                alignItems: "center",
                paddingTop: 14,
                paddingBottom: 12,
                paddingHorizontal: 24,
              }}
            >
              <Text
                style={{
                  color: solved ? "#34D399" : "#9CA3AF",
                  fontSize: 13,
                  fontWeight: solved ? "600" : "400",
                  textAlign: "center",
                }}
              >
                {solved ? "✓ Verification passed — confirming…" : "Tick the checkbox to verify you're human"}
              </Text>
            </View>
          )}

          <WebView
            key={nonce}
            source={{ html: buildHtml(CAPTCHA_SITE_KEY, nonce), baseUrl: "https://billreminder.suryadeepbanerjee.in" }}
            style={[
              {
                width: "100%",
                // Tall enough for BOTH the 300×65 checkbox AND the expanded
                // interactive challenge (~300×300) Turnstile opens for
                // VPN/suspicious IPs — a short WebView clips the puzzle.
                height: 300,
                backgroundColor: "transparent",
              },
              (!widgetReady || !!failed) && { display: "none" },
            ]}
            originWhitelist={["*"]}
            javaScriptEnabled
            setSupportMultipleWindows={false}
            onMessage={handleMessage}
            onError={handleLoadFailure}
            onHttpError={handleLoadFailure}
          />
        </View>
      </View>
    </Modal>
  );
}