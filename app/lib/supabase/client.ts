import { makeRedirectUri } from "expo-auth-session";
import { createClient } from "@supabase/supabase-js";
import * as SecureStore from "expo-secure-store";

const ExpoSecureStoreAdapter = {
	getItem: (key: string) => SecureStore.getItemAsync(key),
	setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
	removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

const supabaseUrl     = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
	auth: {
		storage:            ExpoSecureStoreAdapter,
		autoRefreshToken:   true,
		persistSession:     true,
		detectSessionInUrl: false,
		// Must be "implicit" — not "pkce" (the default).
		//
		// Email verification links are clicked in a browser, which redirects
		// to our website's /auth/callback. PKCE stores a code_verifier in
		// the mobile app's SecureStore; the website cannot access it, so
		// exchangeCodeForSession() always fails ("expired / already used").
		//
		// With "implicit", Supabase redirects with #access_token=... in the
		// URL hash instead, which AuthCallback.tsx handles without needing
		// any verifier.
		flowType: "implicit",
	},
});

/**
 * Deep-link URI — used only for OAuth (Google, etc.) where the callback
 * comes back to the native app directly.
 */
export const redirectUri = "bill-reminder://callback";

/**
 * Web callback URI — used for ALL email-based flows:
 *   • Email verification (signup)
 *   • Resend verification
 *   • Password reset
 *
 * Must point to the website's /auth/callback page, NOT the deep-link scheme,
 * because verification emails are clicked in a desktop/mobile browser.
 *
 * The website's AuthCallback.tsx handles the token exchange and redirects
 * to /success.html on success, or /auth/error on failure.
 */
export const webRedirectUri = "https://billreminder.suryadeepbanerjee.in/auth/callback";
