import { ChevronDown } from "lucide-react";

export interface SelectOption<T extends string = string> {
  value: T;
  label: string;
}

interface SelectPickerProps<T extends string = string> {
  label?:   string;
  value:    T | null | undefined;
  onChange: (value: T) => void;
  options:  SelectOption<T>[];
  placeholder?: string;
}

export default function SelectPicker<T extends string = string>({
  label,
  value,
  onChange,
  options,
  placeholder,
}: SelectPickerProps<T>) {
  const selected = options.find((o) => o.value === value);

  return (
    <div className="mb-4 w-full">
      {label && (
        <label className="block text-sm font-medium text-primary mb-2">{label}</label>
      )}
      <div className="relative">
        <select
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value as T)}
          className="w-full appearance-none px-3.5 py-3 pr-10 rounded-input bg-input border border-border text-sm text-primary focus:outline-none focus:border-accent focus:bg-surface transition-colors cursor-pointer"
        >
          <option value="" disabled>
            {placeholder ?? "Select…"}
          </option>
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <ChevronDown size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-secondary pointer-events-none" />
      </div>
    </div>
  );
}