import { AlertCircle, CheckCircle2, Info } from "lucide-react";

interface AlertBadgeProps {
  variant: "error" | "warning" | "success" | "info";
  children: React.ReactNode;
  className?: string;
}

const styles = {
  error:   "bg-error/10 border-error/25 text-error",
  warning: "bg-warning/10 border-warning/25 text-warning",
  success: "bg-success/10 border-success/25 text-success",
  info:    "bg-accent/10 border-accent/25 text-accent",
};

const icons = {
  error:   <AlertCircle size={15} className="shrink-0 mt-0.5" />,
  warning: <AlertCircle size={15} className="shrink-0 mt-0.5" />,
  success: <CheckCircle2 size={15} className="shrink-0 mt-0.5" />,
  info:    <Info size={15} className="shrink-0 mt-0.5" />,
};

export default function AlertBadge({ variant, children, className = "" }: AlertBadgeProps) {
  return (
    <div className={`flex items-start gap-2.5 p-3 rounded-lg border text-[13px] leading-relaxed ${styles[variant]} ${className}`}>
      {icons[variant]}
      <span className="min-w-0">{children}</span>
    </div>
  );
}