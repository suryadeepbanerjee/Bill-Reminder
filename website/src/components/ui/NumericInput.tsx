import { forwardRef, useEffect, useState } from "react";

export interface NumericInputProps {
  value:    number | null | undefined;
  onChange: (value: number | undefined) => void;
  label?:   string;
  hint?:    string;
  error?:   string;
  placeholder?: string;
  prefix?:  string;
  integer?: boolean;
  id?:      string;
}

const DECIMAL_RE = /^\d*\.?\d*$/;
const INTEGER_RE = /^\d*$/;

const NumericInput = forwardRef<HTMLInputElement, NumericInputProps>(
  (
    { value, onChange, label, hint, error, placeholder, prefix, integer, id },
    ref
  ) => {
    const [draft, setDraft] = useState<string>(value == null ? "" : String(value));

    useEffect(() => {
      const parsed = draft.trim() === "" ? undefined : integer ? parseInt(draft, 10) : parseFloat(draft);
      const normalized = parsed == null || Number.isNaN(parsed) ? undefined : String(parsed);
      const current = value == null ? undefined : String(value);
      if (normalized !== current) {
        setDraft(value == null ? "" : String(value));
      }
    }, [value]);

    const commit = (raw: string) => {
      const pattern = integer ? INTEGER_RE : DECIMAL_RE;
      if (!pattern.test(raw)) return;
      setDraft(raw);
      if (raw.trim() === "") { onChange(undefined); return; }
      const num = integer ? parseInt(raw, 10) : parseFloat(raw);
      onChange(Number.isNaN(num) ? undefined : num);
    };

    return (
      <div className="mb-4 w-full">
        {label && (
          <label htmlFor={id} className="block text-sm font-medium text-primary mb-2">
            {label}
          </label>
        )}
        <div
          className={`flex items-center w-full bg-input border rounded-input overflow-hidden transition-colors duration-150 h-11 ${
            error ? "border-error" : "border-border focus-within:border-accent focus-within:bg-surface"
          }`}
        >
          {prefix && <span className="pl-3.5 pr-0.5 text-secondary text-sm">{prefix}</span>}
          <input
            ref={ref}
            id={id}
            inputMode={integer ? "numeric" : "decimal"}
            value={draft}
            onChange={(e) => commit(e.target.value)}
            placeholder={placeholder}
            className="flex-1 px-3.5 py-2.5 bg-transparent text-primary placeholder:text-secondary focus:outline-none w-full tabular-nums"
          />
        </div>
        {error ? (
          <p className="text-xs font-medium text-error mt-2" role="alert">{error}</p>
        ) : hint ? (
          <p className="text-xs text-secondary mt-2">{hint}</p>
        ) : null}
      </div>
    );
  }
);
NumericInput.displayName = "NumericInput";

export default NumericInput;