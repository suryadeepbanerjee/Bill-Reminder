import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import Modal from "./Modal";
import { Button } from "./Button";

export interface ConfirmOptions {
  title:      string;
  message:    string;
  confirmLabel?: string;
  cancelLabel?:  string;
  destructive?:  boolean;
}

interface ConfirmContextValue {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

const ConfirmContext = createContext<ConfirmContextValue | null>(null);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<(ConfirmOptions & { resolve: (v: boolean) => void }) | null>(null);

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setState({ ...options, resolve });
    });
  }, []);

  const close = (result: boolean) => {
    state?.resolve(result);
    setState(null);
  };

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      <Modal
        open={state !== null}
        onClose={() => close(false)}
        title={state?.title}
        size="sm"
        footer={
          state && (
            <>
              <Button
                variant="secondary"
                fullWidth
                onClick={() => close(false)}
              >
                {state.cancelLabel ?? "Cancel"}
              </Button>
              <Button
                variant={state.destructive ? "destructive" : "primary"}
                fullWidth
                onClick={() => close(true)}
              >
                {state.confirmLabel ?? "Confirm"}
              </Button>
            </>
          )
        }
      >
        <p className="text-sm text-secondary leading-relaxed">{state?.message}</p>
      </Modal>
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm must be used within ConfirmProvider");
  return ctx;
}