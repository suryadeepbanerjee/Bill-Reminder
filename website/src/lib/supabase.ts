import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing Supabase environment variables. Check .env file.");
}

// Session storage adapter — keeps access/refresh tokens out of localStorage.
// localStorage persists tokens indefinitely and is readable by any injected
// script; sessionStorage clears them when the tab closes, shrinking the
// exposure window (security audit finding F2).
const sessionStorageAdapter = {
  getItem: (key: string) => window.sessionStorage.getItem(key),
  setItem: (key: string, value: string) => window.sessionStorage.setItem(key, value),
  removeItem: (key: string) => window.sessionStorage.removeItem(key),
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    storage: sessionStorageAdapter,
    detectSessionInUrl: false, // AuthCallback.tsx handles all redirects manually
    flowType: "pkce",
  },
});

export const SITE_URL = "https://billreminder.suryadeepbanerjee.in";
export const APP_SCHEME = "bill-reminder";
