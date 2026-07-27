import { create } from "zustand";
import { User, Session } from "@supabase/supabase-js";

interface AuthState {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isEmailVerified: boolean;
  setSession: (session: Session | null) => void;
  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
  setEmailVerified: (verified: boolean) => void;
  reset: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  session: null,
  isLoading: true,
  isEmailVerified: false,
  setSession: (session) => set({ session, user: session?.user ?? null }),
  setUser: (user) => set({ user }),
  setLoading: (loading) => set({ isLoading: loading }),
  setEmailVerified: (verified) => set({ isEmailVerified: verified }),
  reset: () =>
    set({
      user: null,
      session: null,
      isLoading: false,
      isEmailVerified: false,
    }),
}));
