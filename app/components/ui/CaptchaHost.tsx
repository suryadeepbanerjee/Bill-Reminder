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
import { View, Modal, Text, Pressable, ActivityIndicator } from "react-native";
import { WebView } from "react-native-webview";
import { Ionicons } from "@expo/vector-icons";
import {
  CAPTCHA_SITE_KEY,
  isCaptchaEnabled,
  subscribeCaptchaActive,
  completeCaptcha,
} from "../../lib/captcha";
import { Colors } from "../../lib/theme";

const WIDGET_TIMEOUT_MS = 90000;

function buildHtml(siteKey: string, nonce: number): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<style>
  html, body { height: 100%; margin: 0; padding: 0; background: transparent; }
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
      size: "invisible",
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
  const [nonce, setNonce] = useState(() => Date.now());

  useEffect(() => subscribeCaptchaActive(setActive), []);

  // Every activation gets a fresh widget run (nonce changes the html source
  // so the WebView reloads and hCaptcha issues a brand-new token).
  useEffect(() => {
    if (active) setNonce(Date.now());
  }, [active]);

  const handleMessage = useCallback((event: { nativeEvent: { data: string } }) => {
    let msg: { type?: string; token?: string; message?: string };
    try {
      msg = JSON.parse(event.nativeEvent.data);
    } catch {
      return;
    }
    if (msg.type === "token" && typeof msg.token === "string" && msg.token) {
      completeCaptcha(msg.token);
    } else if (msg.type === "error") {
      completeCaptcha(undefined, msg.message ?? "CAPTCHA failed");
    } else if (msg.type === "timeout") {
      completeCaptcha(undefined, "CAPTCHA timed out");
    }
    // "open"/"close" are informational — wait for token/error/timeout.
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
              <Ionicons name="close" size={20} color="#A3A3A3" />
            </Pressable>
          </View>

          {!loaded && (
            <View style={{ height: 200, alignItems: "center", justifyContent: "center", gap: 12 }}>
              <ActivityIndicator size="small" color={Colors.accent[500]} />
              <Text style={{ color: "#A3A3A3", fontSize: 13 }}>Starting security check…</Text>
            </View>
          )}

          <WebView
            key={nonce}
            source={{ html: buildHtml(CAPTCHA_SITE_KEY, nonce) }}
            style={[
              { width: "100%", height: 320, backgroundColor: "transparent" },
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