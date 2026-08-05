import { forwardRef } from "react";

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

const NumericInput = forwardRef<HTMLInputElement, NumericInputProps>(
  (
    { value, onChange, label, hint, error, placeholder, prefix, integer, id },
    ref
  ) => {
    const display = value == null ? "" : String(value);

    const commit = (raw: string) => {
      const trimmed = raw.trim();
      if (trimmed === "") { onChange(undefined); return; }
      const num = integer ? parseInt(trimmed, 10) : parseFloat(trimmed);
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
            value={display}
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