import { create } from "zustand";
import type { Session, User } from "@supabase/supabase-js";

interface AuthState {
  user:      User | null;
  session:   Session | null;
  isLoading: boolean;
  setSession: (session: Session | null) => void;
  setUser:    (user: User | null) => void;
  setLoading: (loading: boolean) => void;
  reset:      () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user:      null,
  session:   null,
  isLoading: true,

  setSession: (session) => set({ session, user: session?.user ?? null }),
  setUser:    (user) => set({ user }),
  setLoading: (loading) => set({ isLoading: loading }),
  reset:      () => set({ user: null, session: null, isLoading: false }),
}));