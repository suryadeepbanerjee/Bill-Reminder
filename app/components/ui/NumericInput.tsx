import { useState, useEffect } from "react";
import { TextInput } from "./TextInput";

interface NumericInputProps {
  label?: string;
  placeholder?: string;
  hint?: string;
  error?: string;
  leadingIcon?: React.ReactNode;
  keyboardType?: "number-pad" | "decimal-pad";
  returnKeyType?: "done" | "next";
  value: number | null | undefined;
  onChange: (v: number | undefined) => void;
  onBlur?: () => void;
  disabled?: boolean;
}

function toText(v: number | null | undefined): string {
  if (v == null) return "";
  return String(v);
}

export function NumericInput({
  value,
  onChange,
  onBlur: onBlurProp,
  ...rest
}: NumericInputProps) {
  const [text, setText] = useState(toText(value));

  useEffect(() => {
    setText(toText(value));
  }, [value]);

  // Parse and commit a raw text string → calls onChange with the number or undefined
  const commit = (raw: string) => {
    const trimmed = raw.trim();
    if (trimmed === "") {
      onChange(undefined);
      return;
    }
    const num = rest.keyboardType === "decimal-pad"
      ? parseFloat(trimmed)
      : parseInt(trimmed, 10);
    onChange(isNaN(num) ? undefined : num);
  };

  return (
    <TextInput
      {...rest}
      value={text}
      onChangeText={(t) => {
        setText(t);
        // Immediately propagate to react-hook-form so "Save" works
        // even if the field hasn't lost focus yet.
        commit(t);
      }}
      onBlur={() => {
        // Cleanup: ensure the displayed text matches the committed value.
        commit(text);
        onBlurProp?.();
      }}
    />
  );
}
