import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing Supabase environment variables. Check .env file.");
}

// Persistent storage adapter — keeps the session in localStorage so a signed-in
// user stays signed in across browser sessions/tabs, matching the standard
// "remember me" behavior of most sites (previously sessionStorage made users
// re-authenticate on every fresh visit; req: persistent sign-in).
const persistentStorageAdapter = {
  getItem: (key: string) => window.localStorage.getItem(key),
  setItem: (key: string, value: string) => window.localStorage.setItem(key, value),
  removeItem: (key: string) => window.localStorage.removeItem(key),
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    storage: persistentStorageAdapter,
    detectSessionInUrl: false, // AuthCallback.tsx handles all redirects manually
    flowType: "pkce",
  },
});

export const SITE_URL = "https://billreminder.suryadeepbanerjee.in";
export const APP_SCHEME = "bill-reminder";
