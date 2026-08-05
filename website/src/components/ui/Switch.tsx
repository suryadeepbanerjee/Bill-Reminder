interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  label?: string;
}

export default function Switch({ checked, onChange, disabled, label }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-[26px] w-[46px] shrink-0 items-center rounded-pill transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
        checked ? "bg-accent" : "bg-neutral-400/50 dark:bg-neutral-600"
      } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
    >
      <span
        className={`inline-block h-[22px] w-[22px] transform rounded-full bg-white shadow-sm transition-transform duration-150 ${
          checked ? "translate-x-[22px]" : "translate-x-[2px]"
        }`}
      />
    </button>
  );
}