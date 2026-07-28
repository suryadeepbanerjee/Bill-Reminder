import { Platform } from "react-native";
import * as WebBrowser from "expo-web-browser";
import { supabase, webRedirectUri } from "../supabase/client";

export type GoogleSignInResult =
  | { status: "success" }
  | { status: "cancelled" }
  | { status: "error"; message: string };

// Safely require the native module so it doesn't crash Metro or Expo Router
// if the developer hasn't rebuilt the native Android app yet.
let GoogleSignin: any = null;
let statusCodes: any = {};
let isErrorWithCode: any = () => false;

try {
  const GoogleModule = require("@react-native-google-signin/google-signin");
  GoogleSignin = GoogleModule.GoogleSignin;
  statusCodes = GoogleModule.statusCodes;
  isErrorWithCode = GoogleModule.isErrorWithCode;

  // Configure Google Sign-In for Android
  if (Platform.OS === "android" && GoogleSignin) {
    GoogleSignin.configure({
      webClientId: "625188477021-pfrvkjmjpfvrv4f9q2h3qo7j1cvlalcc.apps.googleusercontent.com",
      offlineAccess: true, // required for some features
    });
  }
} catch (error) {
  console.warn("Google Sign-In native module not found. Native Google auth will be unavailable until you rebuild the app.", error);
}

/**
 * Android: Fully native Google Sign-In via @react-native-google-signin/google-signin
 * iOS: Browser-based OAuth via Expo WebBrowser (legacy flow until iOS native is implemented)
 */
export async function signInWithGoogle(): Promise<GoogleSignInResult> {
  if (Platform.OS === "android") {
    return signInWithGoogleAndroid();
  }
  return signInWithGoogleIos();
}

/**
 * NATIVE ANDROID GOOGLE SIGN-IN
 */
async function signInWithGoogleAndroid(): Promise<GoogleSignInResult> {
  if (!GoogleSignin) {
    return { status: "error", message: "Google Sign-In native module is missing. Please rebuild the app." };
  }

  try {
    await GoogleSignin.hasPlayServices();
    const userInfo = await GoogleSignin.signIn();
    const idToken = userInfo.data?.idToken;

    if (!idToken) {
      return { status: "error", message: "No ID token found from Google Sign-In." };
    }

    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: "google",
      token: idToken,
    });

    if (error) {
      return { status: "error", message: error.message };
    }

    if (!data.session) {
      return { status: "error", message: "Failed to create Supabase session." };
    }

    return { status: "success" };
  } catch (error: any) {
    if (isErrorWithCode(error)) {
      switch (error.code) {
        case statusCodes.SIGN_IN_CANCELLED:
          return { status: "cancelled" };
        case statusCodes.IN_PROGRESS:
          return { status: "error", message: "Sign-in is already in progress." };
        case statusCodes.PLAY_SERVICES_NOT_AVAILABLE:
          return { status: "error", message: "Google Play Services are required but not available." };
        default:
          return { status: "error", message: "An unexpected Google Sign-In error occurred." };
      }
    } else {
      return { status: "error", message: error.message || "An unexpected error occurred." };
    }
  }
}

/**
 * BROWSER-BASED IOS GOOGLE SIGN-IN (LEGACY)
 */
async function signInWithGoogleIos(): Promise<GoogleSignInResult> {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: webRedirectUri,
      skipBrowserRedirect: true,
    },
  });

  if (error || !data.url) {
    return {
      status: "error",
      message: error?.message ?? "Could not start Google sign-in. Please try again.",
    };
  }

  const result = await WebBrowser.openAuthSessionAsync(
    data.url,
    "bill-reminder://",
  );

  if (result.type === "cancel" || result.type === "dismiss") {
    return { status: "cancelled" };
  }

  if (result.type !== "success") {
    return { status: "error", message: "Sign-in did not complete." };
  }

  const tokenPart = result.url.split("?")[1] || result.url.split("#")[1] || "";
  const params = new URLSearchParams(tokenPart);
  const accessToken = params.get("access_token");
  const refreshToken = params.get("refresh_token") ?? "";

  if (!accessToken) {
    return { status: "success" };
  }

  const { error: sessionError } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });

  if (sessionError) {
    return { status: "error", message: sessionError.message };
  }

  return { status: "success" };
}

/**
 * Sign out from Native Google Sign-In (Android only)
 * Call this when the user logs out so they can choose a different account next time.
 */
export async function signOutGoogle(): Promise<void> {
  if (Platform.OS === "android" && GoogleSignin) {
    try {
      await GoogleSignin.signOut();
    } catch (error) {
      console.warn("Failed to sign out from Google:", error);
    }
  }
}
