/**
 * Shared utility functions for formatting and display logic.
 * Pure functions — no side effects, no imports from React/RN.
 */

// ── Currency formatting (tabular figures, per spec) ──────────────────────────

export function formatCurrency(
  amount: number | null | undefined,
  currency = "INR"
): string {
  if (amount == null) return "—";
  try {
    return new Intl.NumberFormat("en-IN", {
      style:                "currency",
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

// ── Date formatting ──────────────────────────────────────────────────────────

export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-IN", {
    day:   "numeric",
    month: "short",
    year:  "numeric",
  });
}

export function formatDateShort(date: string | Date | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export function formatRelativeDate(date: string | Date | null | undefined): string {
  if (!date) return "—";
  const d   = typeof date === "string" ? new Date(date) : date;
  const now = new Date();
  const diffMs   = d.getTime() - now.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0)  return "Today";
  if (diffDays === 1)  return "Tomorrow";
  if (diffDays === -1) return "Yesterday";
  if (diffDays > 1  && diffDays <= 7)  return `In ${diffDays} days`;
  if (diffDays < -1 && diffDays >= -7) return `${Math.abs(diffDays)} days ago`;
  return formatDateShort(d);
}

/** Returns positive number if date is in the past (overdue), negative if future */
export function daysUntil(date: string | Date | null | undefined): number | null {
  if (!date) return null;
  const d      = typeof date === "string" ? new Date(date) : date;
  const now    = new Date();
  const diffMs = d.getTime() - now.getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

export function formatOverdueLabel(date: string | Date | null | undefined): string {
  const days = daysUntil(date);
  if (days == null) return "Overdue";
  const abs = Math.abs(days);
  if (abs === 0) return "Due today";
  if (abs === 1) return days < 0 ? "1 day overdue" : "Due tomorrow";
  return days < 0 ? `${abs} days overdue` : `Due in ${abs} days`;
}

// ── Repeat kind labels ────────────────────────────────────────────────────────

export function formatRepeatKind(kind: string, interval?: number | null): string {
  switch (kind) {
    case "monthly":       return "Monthly";
    case "yearly":        return "Yearly";
    case "every_x_days":  return interval ? `Every ${interval} days`   : "Every N days";
    case "every_x_weeks": return interval ? `Every ${interval} weeks`  : "Every N weeks";
    case "every_x_months":return interval ? `Every ${interval} months` : "Every N months";
    case "none":          return "One-time";
    default:              return kind;
  }
}

// ── Behavior type labels ──────────────────────────────────────────────────────

export function formatBehaviorType(type: string): string {
  switch (type) {
    case "fixed_due_date":    return "Fixed due date";
    case "prepaid_validity":  return "Prepaid / Validity";
    case "wallet_balance":    return "Wallet / Balance";
    default:                  return type;
  }
}

// ── Icon name mapping: Lucide (DB) → Ionicons ────────────────────────────────

export const LUCIDE_TO_IONICONS: Record<string, string> = {
  "credit-card":  "card-outline",
  "smartphone":   "phone-portrait-outline",
  "wifi":         "wifi-outline",
  "zap":          "flash-outline",
  "droplets":     "water-outline",
  "flame":        "flame-outline",
  "shield":       "shield-outline",
  "calendar":     "calendar-outline",
  "home":         "home-outline",
  "landmark":     "business-outline",
  "tv":           "tv-outline",
  "music":        "musical-notes-outline",
  "cloud":        "cloud-outline",
  "server":       "server-outline",
  "globe":        "globe-outline",
  "book-open":    "book-outline",
  "dumbbell":     "barbell-outline",
  "heart-pulse":  "heart-outline",
  "trending-up":  "trending-up-outline",
  "repeat":       "repeat-outline",
  "layers":       "layers-outline",
};

export function resolveIcon(lucideKey: string): string {
  return LUCIDE_TO_IONICONS[lucideKey] ?? "layers-outline";
}
