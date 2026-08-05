interface SectionHeaderProps {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
}

export default function SectionHeader({ title, actionLabel, onAction }: SectionHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-3 mt-2 px-0.5">
      <h2 className="text-[11px] font-bold uppercase tracking-[0.08em] text-secondary">
        {title}
      </h2>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="text-xs font-semibold text-accent hover:underline"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}