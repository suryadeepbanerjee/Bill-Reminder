import { useState, useCallback, useRef } from "react";
import type { ToastVariant } from "../components/ui/Toast";

interface ToastState {
  visible:  boolean;
  message:  string;
  variant:  ToastVariant;
}

/**
 * Lightweight toast hook.
 *
 * Usage:
 *   const { toast, showToast } = useToast();
 *   showToast("Bill marked as paid!", "success");
 *   // In JSX: <Toast {...toast} onDismiss={toast.onDismiss} />
 */
export function useToast() {
  const [state, setState] = useState<ToastState>({
    visible:  false,
    message:  "",
    variant:  "info",
  });

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback(
    (message: string, variant: ToastVariant = "info", duration = 3000) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      setState({ visible: true, message, variant });
      timerRef.current = setTimeout(() => {
        setState((s) => ({ ...s, visible: false }));
      }, duration);
    },
    []
  );

  const hideToast = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setState((s) => ({ ...s, visible: false }));
  }, []);

  return {
    toast: { ...state, onDismiss: hideToast },
    showToast,
    hideToast,
  };
}
