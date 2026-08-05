import { useEffect, useCallback, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";

export interface ModalProps {
  open:       boolean;
  onClose:    () => void;
  title?:     string;
  subtitle?:  ReactNode;
  children?:  ReactNode;
  footer?:    ReactNode;
  size?:      "sm" | "md" | "lg";
  closeOnBackdrop?: boolean;
  dismissable?: boolean;
}

const sizeClasses: Record<NonNullable<ModalProps["size"]>, string> = {
  sm: "max-w-[420px]",
  md: "max-w-[480px]",
  lg: "max-w-[600px]",
};

export default function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  size = "md",
  closeOnBackdrop = true,
  dismissable = true,
}: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && dismissable) onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, dismissable, onClose]);

  const handleBackdrop = useCallback(() => {
    if (closeOnBackdrop && dismissable) onClose();
  }, [closeOnBackdrop, dismissable, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-6">
          <motion.div
            className="absolute inset-0 bg-black/60 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleBackdrop}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className={`relative w-full ${size} bg-surface border border-border rounded-t-card sm:rounded-card shadow-raised max-h-[92vh] flex flex-col`}
          >
            {(title || dismissable) && (
              <div className="flex items-start justify-between px-6 pt-6 pb-3 shrink-0">
                <div>
                  {title && <h2 className="text-lg font-semibold text-primary tracking-tight">{title}</h2>}
                  {subtitle && <div className="text-xs text-secondary mt-1">{subtitle}</div>}
                </div>
                {dismissable && (
                  <button
                    type="button"
                    onClick={onClose}
                    aria-label="Close"
                    className="p-1.5 -m-1 rounded-lg text-secondary hover:bg-input hover:text-primary transition-colors"
                  >
                    <X size={18} />
                  </button>
                )}
              </div>
            )}
            <div className="px-6 pb-6 overflow-y-auto flex-1 min-h-0">{children}</div>
            {footer && (
              <div className="px-6 py-4 border-t border-border shrink-0 bg-input/40 rounded-b-card flex gap-3">
                {footer}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}