import { Platform } from "react-native";
import { supabase } from "../supabase/client";
import {
  GoogleSignin,
  statusCodes,
  isErrorWithCode,
} from "@react-native-google-signin/google-signin";

export type GoogleSignInResult =
  | { status: "success" }
  | { status: "cancelled" }
  | { status: "error"; message: string };

/**
 * Configure Google Sign-In native SDK.
 * 
 * webClientId: Must be the WEB application client ID from Google Cloud, NOT the Android client ID.
 */
GoogleSignin.configure({
  webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
});

export async function signInWithGoogle(): Promise<GoogleSignInResult> {
  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const userInfo = await GoogleSignin.signIn();
    
    // Support for both older (v13-) and newer (v14+) @react-native-google-signin APIs
    const idToken = userInfo?.data?.idToken || (userInfo as any)?.idToken;

    if (!idToken) {
      console.warn("[GoogleAuth] No ID token returned — check webClientId config");
      return { 
        status: "error", 
        message: "Google sign-in failed. Please try again." 
      };
    }

    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: "google",
      token: idToken,
    });

    if (error) {
      console.warn("[GoogleAuth] Supabase token exchange failed:", error.message);
      return { status: "error", message: "Google sign-in failed. Please try again." };
    }

    if (!data?.session) {
      console.warn("[GoogleAuth] No session created after token exchange");
      return { status: "error", message: "Google sign-in failed. Please try again." };
    }

    return { status: "success" };

  } catch (error: any) {
    if (isErrorWithCode(error)) {
      switch (error.code) {
        case statusCodes.SIGN_IN_CANCELLED:
        case "12501":
          return { status: "cancelled" };
        
        case statusCodes.IN_PROGRESS:
          console.warn("[GoogleAuth] Sign-in already in progress");
          return { status: "error", message: "Sign-in is already in progress. Please wait." };
          
        case statusCodes.PLAY_SERVICES_NOT_AVAILABLE:
          console.warn("[GoogleAuth] Play Services not available");
          return { status: "error", message: "Google Play Services are required. Please update Google Play Services." };
          
        case "10":
          console.warn("[GoogleAuth] DEVELOPER_ERROR — check SHA-1, package name, webClientId");
          return { status: "error", message: "Sign-in configuration error. Please try again or contact support." };
          
        case "7":
          console.warn("[GoogleAuth] Network error");
          return { status: "error", message: "Please check your internet connection and try again." };
          
        case "12500":
          console.warn("[GoogleAuth] Token exchange error (12500)");
          return { status: "error", message: "Google sign-in failed. Please try again." };
          
        default:
          console.warn(`[GoogleAuth] Unknown error code: ${error.code}`, error.message);
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
  } catch (error) {
    // Non-fatal — Google sign-out can fail if user wasn't signed in via Google
  }
}
