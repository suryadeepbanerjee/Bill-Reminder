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
 * ROOT CAUSE OF DEVELOPER_ERROR (code 10):
 * The previous implementation included `offlineAccess: true`. When offlineAccess is requested, 
 * Google Play Services expects the OAuth Client to be explicitly verified for server-side 
 * access in Google Cloud. If the consent screen or client isn't configured for it, it throws DEVELOPER_ERROR.
 * For Supabase signInWithIdToken, offlineAccess is NOT required. Removing it resolves the error 
 * assuming the SHA-1 and package name are correct.
 * 
 * webClientId: Must be the WEB application client ID from Google Cloud, NOT the Android client ID.
 */
GoogleSignin.configure({
  webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
  // offlineAccess: true, // REMOVED: Caused DEVELOPER_ERROR. Not needed for idToken retrieval.
  // iosClientId: "YOUR_IOS_CLIENT_ID.apps.googleusercontent.com", // Add this when setting up iOS native
});

export async function signInWithGoogle(): Promise<GoogleSignInResult> {
  console.log("[Google Auth] Starting NATIVE Google Sign-In flow...");

  try {
    console.log("[Google Auth] Checking Google Play Services...");
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

    console.log("[Google Auth] Calling GoogleSignin.signIn()...");
    const userInfo = await GoogleSignin.signIn();

    console.log("[Google Auth] Native Sign-In successful. Extracting ID Token...");
    
    // Support for both older (v13-) and newer (v14+) @react-native-google-signin APIs
    // In newer versions, userInfo is deeply nested: userInfo.data.idToken
    const idToken = userInfo?.data?.idToken || (userInfo as any)?.idToken;

    if (!idToken) {
      console.error("[Google Auth] Missing ID Token in Google response:", userInfo);
      return { 
        status: "error", 
        message: "Google authentication succeeded, but no ID token was returned. Verify webClientId." 
      };
    }

    console.log("[Google Auth] ID Token retrieved successfully. Authenticating with Supabase...");

    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: "google",
      token: idToken,
    });

    if (error) {
      console.error("[Google Auth] Supabase signInWithIdToken failed:", error.message);
      return { status: "error", message: `Supabase Auth Failed: ${error.message}` };
    }

    if (!data?.session) {
      console.error("[Google Auth] Supabase returned no session data.");
      return { status: "error", message: "Supabase authentication failed to create a session." };
    }

    console.log("[Google Auth] Supabase session established successfully.");
    return { status: "success" };

  } catch (error: any) {
    console.error("[Google Auth] Native Exception Caught:", error, error?.message, error?.code, error?.stack);

    if (isErrorWithCode(error)) {
      console.error(`[Google Auth] Error Code: ${error.code}`);
      
      let msg = error.message;
      switch (error.code) {
        case statusCodes.SIGN_IN_CANCELLED:
        case "12501": // Also SIGN_IN_CANCELLED on some devices
          console.log("[Google Auth] User cancelled the sign-in flow.");
          return { status: "cancelled" };
        
        case statusCodes.IN_PROGRESS:
          msg = "OAuth configuration error: Sign-in is already in progress.";
          break;
          
        case statusCodes.PLAY_SERVICES_NOT_AVAILABLE:
          msg = "Google Play Services unavailable: Required for native Android authentication.";
          break;
          
        case "10": // DEVELOPER_ERROR
          msg = "OAuth configuration error (DEVELOPER_ERROR): Check SHA-1, package name, or ensure webClientId is correct in Google Cloud.";
          break;
          
        case "7": // NETWORK_ERROR
          msg = "Network error: Please check your internet connection.";
          break;
          
        case "12500": // SIGN_IN_FAILED
          msg = "Token exchange failed: Google Sign-In failed unexpectedly.";
          break;
          
        default:
          msg = `Native Google Sign-In Error: ${error.message} (Code: ${error.code})`;
          break;
      }
      return { status: "error", message: msg };
    }

    console.error("[Google Auth] Unhandled Exception:", error);
    return { status: "error", message: error?.message || "An unexpected system error occurred." };
  }
}

export async function signOutGoogle(): Promise<void> {
  try {
    console.log("[Google Auth] Signing out of native Google session...");
    await GoogleSignin.signOut();
    console.log("[Google Auth] Native sign-out successful.");
  } catch (error) {
    console.error("[Google Auth] Failed to sign out from native Google module:", error);
  }
}
