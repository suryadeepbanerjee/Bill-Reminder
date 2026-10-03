import { useState, useEffect, useRef } from "react";
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
  // Track whether the field is currently focused so we don't
  // overwrite the user's in-progress text with an incoming value prop.
  const isFocused = useRef(false);

  useEffect(() => {
    // Only sync from parent value when the user is NOT actively editing.
    // This prevents the "auto-refill" bug where clearing the field causes
    // RHF to re-render which triggers this effect and re-fills the input.
    if (!isFocused.current) {
      setText(toText(value));
    }
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
        commit(t);
      }}
      onFocus={() => {
        isFocused.current = true;
      }}
      onBlur={() => {
        isFocused.current = false;
        commit(text);
        onBlurProp?.();
      }}
    />
  );
}
