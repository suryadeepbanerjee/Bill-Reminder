import * as WebBrowser from "expo-web-browser";
import { supabase, webRedirectUri } from "../supabase/client";

export type GoogleSignInResult =
  | { status: "success" }
  | { status: "cancelled" }
  | { status: "error"; message: string };

/**
 * Google OAuth via Supabase + Expo WebBrowser.
 *
 * Flow:
 *   1. supabase.auth.signInWithOAuth (skipBrowserRedirect: true) → gets URL
 *   2. WebBrowser.openAuthSessionAsync watches for bill-reminder:// redirect
 *   3. Google → Supabase → billreminder.suryadeepbanerjee.in/auth/callback
 *   4. AuthCallback.tsx validates tokens → success.html fires deep link
 *   5. openAuthSessionAsync captures bill-reminder://callback?access_token=...
 *   6. Parse tokens → supabase.auth.setSession → onAuthStateChange fires
 *   7. _layout.tsx auth guard → dashboard
 *
 * Fallback: if openAuthSessionAsync doesn't capture the redirect (some Android
 * versions), the deep link fires independently → callback.tsx handles it.
 */
export async function signInWithGoogle(): Promise<GoogleSignInResult> {
  // Step 1: Get the Google OAuth URL — do NOT open browser automatically
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo:          webRedirectUri, // → /auth/callback → success.html → deep link
      skipBrowserRedirect: true,
    },
  });

  if (error || !data.url) {
    return {
      status:  "error",
      message: error?.message ?? "Could not start Google sign-in. Please try again.",
    };
  }

  // Step 2: Open OAuth URL in system browser; watch for bill-reminder:// redirect
  const result = await WebBrowser.openAuthSessionAsync(
    data.url,
    "bill-reminder://",
  );

  // User dismissed / cancelled the browser
  if (result.type === "cancel" || result.type === "dismiss") {
    return { status: "cancelled" };
  }

  if (result.type !== "success") {
    return { status: "error", message: "Sign-in did not complete." };
  }

  // Step 3: Parse tokens from the captured deep-link URL
  // Shape: bill-reminder://callback?access_token=... (forwarded by success.html)
  // Or: bill-reminder://callback#access_token=... (if caught directly on implicit redirect)
  const tokenPart    = result.url.split("?")[1] || result.url.split("#")[1] || "";
  const params       = new URLSearchParams(tokenPart);
  const accessToken  = params.get("access_token");
  const refreshToken = params.get("refresh_token") ?? "";

  if (!accessToken) {
    // Tokens not present in the URL — this can happen on Android when the
    // deep link fires independently and callback.tsx handles the session.
    // onAuthStateChange in _layout.tsx will pick up the session change.
    return { status: "success" };
  }

  // Step 4: Set session on the mobile Supabase client (stores in SecureStore)
  const { error: sessionError } = await supabase.auth.setSession({
    access_token:  accessToken,
    refresh_token: refreshToken,
  });

  if (sessionError) {
    return { status: "error", message: sessionError.message };
  }

  // Session is set — onAuthStateChange fires → _layout.tsx auth guard navigates
  return { status: "success" };
}
