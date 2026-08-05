interface ChipProps {
  label:    string;
  active:   boolean;
  onPress:  () => void;
}

export default function Chip({ label, active, onPress }: ChipProps) {
  return (
    <button
      type="button"
      onClick={onPress}
      aria-pressed={active}
      className={`shrink-0 px-3.5 py-1.5 rounded-pill text-[13px] font-medium transition-all duration-150 border ${
        active
          ? "bg-accent text-accent-text border-accent"
          : "bg-surface text-secondary border-border hover:border-accent/50 hover:text-primary"
      }`}
    >
      {label}
    </button>
  );
}