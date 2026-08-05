import { ReactNode } from "react";
import { Receipt, Search, Sparkles } from "lucide-react";

interface EmptyStateProps {
  variant?:  "bills" | "search" | "custom";
  title?:    string;
  message?:  string;
  ctaLabel?: string;
  onCta?:    () => void;
  icon?:     ReactNode;
}

export default function EmptyState({
  variant = "bills",
  title,
  message,
  ctaLabel,
  onCta,
  icon,
}: EmptyStateProps) {
  if (variant === "search") {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
        <div className="w-14 h-14 rounded-full bg-input flex items-center justify-center mb-4">
          <Search size={22} className="text-secondary" />
        </div>
        <p className="text-sm font-medium text-primary mb-1">No results found</p>
        <p className="text-[13px] text-secondary max-w-[260px]">
          Try a different search term or clear the filters.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-14 px-6 text-center">
      <div className="w-16 h-16 rounded-full bg-input flex items-center justify-center mb-5">
        {icon ?? (
          variant === "bills" ? (
            <Receipt size={26} className="text-secondary" />
          ) : (
            <Sparkles size={26} className="text-secondary" />
          )
        )}
      </div>
      <p className="text-base font-semibold text-primary mb-1.5">
        {title ?? "No bills yet"}
      </p>
      <p className="text-sm text-secondary max-w-[300px] leading-relaxed mb-6">
        {message ?? "Add your first bill to start tracking due dates and payments."}
      </p>
      {ctaLabel && onCta && (
        <button
          type="button"
          onClick={onCta}
          className="px-5 py-2.5 rounded-input bg-accent text-accent-text text-sm font-semibold hover:bg-accent-hover transition-colors"
        >
          {ctaLabel}
        </button>
      )}
    </div>
  );
}