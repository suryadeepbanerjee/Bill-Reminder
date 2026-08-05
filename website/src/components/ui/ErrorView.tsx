import { AlertTriangle } from "lucide-react";

interface ErrorViewProps {
  message: string;
  onRetry?: () => void;
}

export default function ErrorView({ message, onRetry }: ErrorViewProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div className="w-14 h-14 rounded-full bg-error/10 flex items-center justify-center mb-4">
        <AlertTriangle size={24} className="text-error" />
      </div>
      <p className="text-sm font-medium text-primary mb-1">{message}</p>
      <p className="text-[13px] text-secondary mb-5">Please try again in a moment.</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="px-4 py-2 rounded-input bg-surface border border-border text-primary text-sm font-medium hover:bg-input transition-colors"
        >
          Try again
        </button>
      )}
    </div>
  );
}