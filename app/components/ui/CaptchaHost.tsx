/**
 * CaptchaHost — mounts the native Turnstile WebView.
 *
 * Rendered ONCE in the root layout. Invisible Turnstile widget; when a token
 * is requested it slides in a centered modal card (Turnstile's interactive
 * challenge, when required, renders inside this WebView so users can solve
 * it). Silent checks resolve in under a second. The page posts the token (or
 * an error) back via ReactNativeWebView.postMessage → completeCaptcha().
 */

import { useCallback, useEffect, useState } from "react";
import { View, Modal, Text, Pressable } from "react-native";
import { WebView } from "react-native-webview";

import {
  CAPTCHA_SITE_KEY,
  isCaptchaEnabled,
  subscribeCaptchaActive,
  subscribeCaptchaRequest,
  completeCaptcha,
  closeCaptchaOverlay,
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
</style>
<script src="https://challenges.cloudflare.com/turnstile/v0/api.js?onload=__brTurnstileReady&render=explicit" async defer></script>
</head>
<body>
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
  try {
    window.turnstile.render(document.body, {
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
  }
}
setTimeout(function () { post("timeout"); }, ${WIDGET_TIMEOUT_MS});
</script>
</body>
</html>`;
}

export function CaptchaHost() {
  const [active, setActive] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [done, setDone] = useState(false);
  const [nonce, setNonce] = useState(() => Date.now());

  useEffect(() => subscribeCaptchaActive(setActive), []);
  useEffect(() => subscribeCaptchaRequest(setNonce), []);

  // Every activation gets a fresh widget run (nonce changes the html source
  // so the WebView reloads and Turnstile issues a brand-new token).
  useEffect(() => {
    if (active) {
      setLoaded(false);
      setDone(false);
    }
  }, [active]);

  const handleMessage = useCallback((event: { nativeEvent: { data: string } }) => {
    let msg: { type?: string; token?: string; message?: string };
    try {
      msg = JSON.parse(event.nativeEvent.data);
    } catch {
      return;
    }
    if (msg.type === "token" && typeof msg.token === "string" && msg.token) {
      setDone(true);
      completeCaptcha(msg.token, undefined, true);
    } else if (msg.type === "error") {
      completeCaptcha(undefined, msg.message ?? "CAPTCHA failed");
    } else if (msg.type === "timeout") {
      completeCaptcha(undefined, "CAPTCHA timed out");
    }
    // "challenge"/"open"/"close" are not sent in compact mode.
  }, []);

  const handleLoadFailure = useCallback(() => {
    completeCaptcha(undefined, "CAPTCHA could not be loaded");
  }, []);

  if (!isCaptchaEnabled) return null;

  return (
    <Modal
      visible={active}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={() => completeCaptcha(undefined, "CAPTCHA dismissed")}
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
            backgroundColor: "#141420",
            borderRadius: 16,
            overflow: "hidden",
            borderWidth: 1,
            borderColor: "#262626",
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              paddingHorizontal: 16,
              paddingVertical: 12,
            }}
          >
            <Text style={{ color: "#F5F5F5", fontSize: 14, fontWeight: "600" }}>
              Security check
            </Text>
            <Pressable
              onPress={() => completeCaptcha(undefined, "CAPTCHA dismissed")}
              hitSlop={8}
              accessibilityLabel="Cancel security check"
            >
              <Text style={{ color: "#A3A3A3", fontSize: 18, lineHeight: 20 }}>✕</Text>
            </Pressable>
          </View>

      {!done && (
            <View
              style={{
                alignItems: "center",
                paddingTop: 20,
                paddingBottom: 8,
                paddingHorizontal: 24,
              }}
            >
              <Text
                style={{
                  color: "#A3A3A3",
                  fontSize: 13,
                  textAlign: "center",
                }}
              >
                Complete the security check below
              </Text>
            </View>
          )}

          <WebView
            key={nonce}
            source={{ html: buildHtml(CAPTCHA_SITE_KEY, nonce), baseUrl: "https://billreminder.suryadeepbanerjee.in" }}
            style={[
              {
                width: "100%",
                // normal widget is 300×65px; give 100px to breathe.
                height: 100,
                backgroundColor: "transparent",
              },
              !loaded && { display: "none" },
            ]}
            originWhitelist={["*"]}
            javaScriptEnabled
            setSupportMultipleWindows={false}
            onMessage={handleMessage}
            onLoadStart={() => setLoaded(false)}
            onLoadEnd={() => setLoaded(true)}
            onError={handleLoadFailure}
            onHttpError={handleLoadFailure}
          />
        </View>
      </View>
    </Modal>
  );
}