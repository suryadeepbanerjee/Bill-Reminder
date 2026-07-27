import { makeRedirectUri } from "expo-auth-session";
import { createClient } from "@supabase/supabase-js";
import * as SecureStore from "expo-secure-store";

const ExpoSecureStoreAdapter = {
	getItem: (key: string) => SecureStore.getItemAsync(key),
	setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
	removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
	auth: {
		storage: ExpoSecureStoreAdapter,
		autoRefreshToken: true,
		persistSession: true,
		detectSessionInUrl: false,
	},
});

export const redirectUri = "bill-reminder://callback";
