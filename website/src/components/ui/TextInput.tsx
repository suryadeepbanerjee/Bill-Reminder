import React, { forwardRef, useState } from "react";

export interface TextInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size"> {
  label?: string;
  error?: string;
  hint?: string;
  leadingIcon?: React.ReactNode;
  trailingElement?: React.ReactNode;
  maxCharacters?: number;
}

export const TextInput = forwardRef<HTMLInputElement, TextInputProps>(
  (
    {
      label,
      error,
      hint,
      leadingIcon,
      trailingElement,
      maxCharacters,
      onFocus,
      onBlur,
      value,
      className = "",
      ...props
    },
    ref
  ) => {
    const [isFocused, setIsFocused] = useState(false);

    const hasError = Boolean(error);
    const borderClass = hasError
      ? "border-error"
      : isFocused
      ? "border-accent"
      : "border-border";

    const bgClass = isFocused ? "bg-surface" : "bg-input";

    return (
      <div className="mb-4 w-full">
        {/* Label row */}
        {label && (
          <div className="flex justify-between items-center mb-2">
            <label className="text-sm font-medium text-primary">{label}</label>
            {maxCharacters && value !== undefined && (
              <span className="text-xs text-secondary">
                {String(value).length}/{maxCharacters}
              </span>
            )}
          </div>
        )}

        {/* Input container */}
        <div
          className={`flex items-center ${bgClass} border ${borderClass} rounded-input overflow-hidden transition-colors duration-150`}
        >
          {leadingIcon && <div className="pl-3 pr-1 text-secondary flex-shrink-0">{leadingIcon}</div>}
          <input
            ref={ref}
            className={`flex-1 px-4 py-3 bg-transparent text-primary placeholder:text-secondary focus:outline-none w-full ${className}`}
            value={value}
            onFocus={(e) => {
              setIsFocused(true);
              onFocus?.(e);
            }}
            onBlur={(e) => {
              setIsFocused(false);
              onBlur?.(e);
            }}
            maxLength={maxCharacters}
            {...props}
          />
          {trailingElement && (
            <div className="pr-3 pl-1 flex-shrink-0">{trailingElement}</div>
          )}
        </div>

        {/* Error / hint row */}
        {hasError ? (
          <p className="text-xs font-medium text-error mt-2" role="alert">
            {error}
          </p>
        ) : hint ? (
          <p className="text-xs text-secondary mt-2">{hint}</p>
        ) : null}
      </div>
    );
  }
);
TextInput.displayName = "TextInput";
