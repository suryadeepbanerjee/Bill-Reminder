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
  subscribeCaptchaRequest,
  completeCaptcha,
  closeCaptchaOverlay,
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
    // Invisible mode keeps the page at zero height until an interactive puzzle
    // actually appears; when it does, expand so the puzzle is tappable.
    var _obs = new ResizeObserver(function () {
      if (document.body.scrollHeight > 100) {
        _obs.disconnect();
        post("challenge");
      }
    });
    _obs.observe(document.body);
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
  const [challenge, setChallenge] = useState(false);
  const [done, setDone] = useState(false);
  const [nonce, setNonce] = useState(() => Date.now());

  useEffect(() => subscribeCaptchaActive(setActive), []);
  useEffect(() => subscribeCaptchaRequest(setNonce), []);

  // Every activation gets a fresh widget run (nonce changes the html source
  // so the WebView reloads and Turnstile issues a brand-new token).
  useEffect(() => {
    if (active) {
      setLoaded(false);
      setChallenge(false);
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
    } else if (msg.type === "challenge") {
      setChallenge(true);
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

          {(!challenge || done) && (
            <View
              style={{
                alignItems: "center",
                paddingVertical: 28,
                paddingHorizontal: 24,
              }}
            >
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  backgroundColor: "rgba(217,170,32,0.12)",
                  borderWidth: 1,
                  borderColor: "rgba(217,170,32,0.25)",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 2,
                }}
              >
                <Ionicons name="shield-checkmark" size={20} color={Colors.accent[400]} />
              </View>
              <ActivityIndicator
                size="large"
                color={Colors.accent[500]}
                style={{ marginTop: 14 }}
              />
              <Text
                style={{
                  marginTop: 12,
                  color: "#A3A3A3",
                  fontSize: 13,
                  textAlign: "center",
                }}
              >
                {done ? "Confirming…" : "Verifying you're human…"}
              </Text>
            </View>
          )}

          <WebView
            key={nonce}
            source={{ html: buildHtml(CAPTCHA_SITE_KEY, nonce) }}
            style={[
              {
                width: "100%",
                height: challenge ? 260 : 0,
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