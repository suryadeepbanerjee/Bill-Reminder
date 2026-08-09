import { Search, X } from "lucide-react";

interface SearchFieldProps {
  value:    string;
  onChange: (value: string) => void;
  placeholder?: string;
  onClear?: () => void;
}

export default function SearchField({ value, onChange, placeholder, onClear }: SearchFieldProps) {
  return (
    <div className="relative">
      <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-secondary" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        maxLength={120}
        placeholder={placeholder ?? "Search…"}
        className="w-full pl-10 pr-9 py-2.5 rounded-input bg-input border border-border text-sm text-primary placeholder:text-secondary focus:outline-none focus:border-accent focus:bg-surface transition-colors"
      />
      {value && (
        <button
          type="button"
          onClick={() => {
            onChange("");
            onClear?.();
          }}
          aria-label="Clear search"
          className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 text-secondary hover:text-primary"
        >
          <X size={15} />
        </button>
      )}
    </div>
  );
}