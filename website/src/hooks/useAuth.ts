import { useEffect } from "react";
import { supabase } from "../lib/supabase";
import { useAuthStore } from "../stores/auth-store";
import { useHouseholdStore } from "../stores/household-store";

/**
 * Restores the Supabase session on mount and keeps the auth store
 * in sync with onAuthStateChange for the lifetime of the app.
 */
export function useAuth() {
  const { setSession, setLoading } = useAuthStore();

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!active) return;
      setSession(session);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (!session) {
        useHouseholdStore.getState().reset();
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [setSession, setLoading]);
}