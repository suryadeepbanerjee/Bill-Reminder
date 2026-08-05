import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, AlertCircle, Info } from "lucide-react";

type ToastVariant = "success" | "error" | "info";

interface ToastState {
  message: string;
  variant: ToastVariant;
  visible: boolean;
}

interface ToastContextValue {
  toast:     ToastState;
  showToast: (message: string, variant?: ToastVariant) => void;
  onDismiss: () => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState>({ message: "", variant: "success", visible: false });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((message: string, variant: ToastVariant = "success") => {
    if (timer.current) clearTimeout(timer.current);
    setToast({ message, variant, visible: true });
    timer.current = setTimeout(() => {
      setToast((t) => ({ ...t, visible: false }));
    }, 2600);
  }, []);

  const onDismiss = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    setToast((t) => ({ ...t, visible: false }));
  }, []);

  return (
    <ToastContext.Provider value={{ toast, showToast, onDismiss }}>
      {children}
      <div className="fixed bottom-20 lg:bottom-8 left-1/2 -translate-x-1/2 z-[100] pointer-events-none">
        <AnimatePresence>
          {toast.visible && (
            <motion.div
              initial={{ opacity: 0, y: 16, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.97 }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              className="flex items-center gap-2.5 px-4 py-3 rounded-input bg-primary text-canvas shadow-raised text-sm font-medium max-w-[90vw]"
            >
              {toast.variant === "success" && <CheckCircle2 size={17} className="text-success shrink-0" />}
              {toast.variant === "error" && <AlertCircle size={17} className="text-error shrink-0" />}
              {toast.variant === "info" && <Info size={17} className="text-accent shrink-0" />}
              <span className="min-w-0">{toast.message}</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}