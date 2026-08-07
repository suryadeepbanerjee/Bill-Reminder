import { supabase } from "../supabase/client";
import {
  GoogleSignin,
  statusCodes,
  isErrorWithCode,
  isSuccessResponse,
  isCancelledResponse,
} from "@react-native-google-signin/google-signin";

export type GoogleSignInResult =
  | { status: "success" }
  | { status: "cancelled" }
  | { status: "error"; message: string };

/**
 * Configure Google Sign-In native SDK.
 *
 * webClientId: the WEB OAuth client ID from Google Cloud.
 * Must match the Client ID set in Supabase Dashboard → Auth → Providers → Google.
 * When set, Google issues an ID token whose `aud` claim equals this client ID,
 * which is what Supabase verifies during signInWithIdToken.
 */
GoogleSignin.configure({
  webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
  offlineAccess: false,
});

export async function signInWithGoogle(): Promise<GoogleSignInResult> {
  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

    const response = await GoogleSignin.signIn();

    // v16+ returns a typed response instead of throwing for cancellation.
    if (isCancelledResponse(response)) {
      return { status: "cancelled" };
    }

    if (!isSuccessResponse(response)) {
      return { status: "cancelled" };
    }

    const idToken = response.data?.idToken;

    if (!idToken) {
      console.warn("[GoogleAuth] No ID token in sign-in response — check webClientId config");
      return {
        status: "error",
        message: "Google sign-in failed. Please try again.",
      };
    }

    // Exchange the Google ID token for a Supabase session.
    // The token's `aud` claim (= webClientId) must match what is configured in Supabase.
    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: "google",
      token: idToken,
    });

    if (error) {
      console.warn("[GoogleAuth] Supabase token exchange failed:", error.message, "code:", error.code);
      return { status: "error", message: "Google sign-in failed. Please try again." };
    }

    if (!data?.session) {
      console.warn("[GoogleAuth] No session after token exchange");
      return { status: "error", message: "Google sign-in failed. Please try again." };
    }

    return { status: "success" };

  } catch (error: any) {
    if (isErrorWithCode(error)) {
      switch (error.code) {
        // Older API: cancellation thrown as error
        case statusCodes.SIGN_IN_CANCELLED:
        case "12501":
          return { status: "cancelled" };

        case statusCodes.IN_PROGRESS:
          return { status: "error", message: "Sign-in is already in progress. Please wait." };

        case statusCodes.PLAY_SERVICES_NOT_AVAILABLE:
          return { status: "error", message: "Google Play Services are required. Please update Google Play Services." };

        case "10":
          console.warn(
            "[GoogleAuth] DEVELOPER_ERROR — code 10. Check webClientId / SHA-1 fingerprint:",
            error?.message
          );
          return {
            status: "error",
            message: "Google sign-in is not configured. Please re-install the app.",
          };

        case "7":
          return { status: "error", message: "No internet connection. Please check and try again." };

        case "12500":
          return { status: "error", message: "Google sign-in failed. Please try again." };

        default:
          console.warn(`[GoogleAuth] Error code ${error.code}:`, error.message);
          return { status: "error", message: "Google sign-in failed. Please try again." };
      }
    }

    console.warn("[GoogleAuth] Unexpected error:", error?.message);
    return { status: "error", message: "Google sign-in failed. Please try again." };
  }
}

export async function signOutGoogle(): Promise<void> {
  try {
    await GoogleSignin.signOut();
  } catch {
    // Non-fatal
  }
}
