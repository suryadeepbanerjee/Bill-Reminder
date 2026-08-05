/**
 * Error sanitization — every user-facing error passes through `humanize()`
 * or `friendlyError()`. Never show raw e.message in the UI.
 * Ported from app/lib/errors.ts.
 */

const SAFE_MESSAGES = new Set([
  "An account with this email already exists. Please sign in or reset your password.",
  "Too many attempts. Please wait a few minutes and try again.",
  "Too many attempts. Please wait a moment and try again.",
  "An unexpected error occurred. Please try again.",
  "Could not update email preferences",
  "Could not export your data.",
  "Failed to load dashboard.",
  "Failed to load bills.",
  "Failed to load bill.",
  "Something went wrong. Please try again.",
  "Invalid verification code. Please try again.",
  "Please fill all required fields correctly.",
  "Invalid invitation link.",
]);

const FALLBACKS = {
  auth:        "Something went wrong. Please try again.",
  network:     "Please check your internet connection and try again.",
  session:     "Your session has expired. Please sign in again.",
  permission:  "Permission denied.",
  notFound:    "The requested resource was not found.",
  validation:  "Please check your input and try again.",
  server:      "A server error occurred. Please try again later.",
  unknown:     "Something went wrong. Please try again.",
} as const;

type ErrorContext = keyof typeof FALLBACKS;

export function humanize(error: unknown, context: ErrorContext = "unknown"): string {
  const raw = extractMessage(error);

  if (import.meta.env.DEV) {
    console.warn(`[Error:${context}]`, raw, error);
  } else {
    console.warn(`[Error:${context}]`, raw);
  }

  if (raw && SAFE_MESSAGES.has(raw)) return raw;

  if (raw) {
    const lower = raw.toLowerCase();

    if (lower.includes("network") || lower.includes("internet") || lower.includes("fetch")) {
      return FALLBACKS.network;
    }

    if (lower.includes("invalid otp") || lower.includes("invalid token") || (lower.includes("token") && (lower.includes("invalid") || lower.includes("expired")))) {
      return "Invalid code. Please try again.";
    }

    if (lower.includes("session") && (lower.includes("expired") || lower.includes("invalid"))) {
      return FALLBACKS.session;
    }
    if (lower.includes("jwt") && lower.includes("expired")) {
      return FALLBACKS.session;
    }

    if (lower.includes("before sending another invite") || lower.includes("invites sent to this email")) {
      return raw;
    }

    if (lower.includes("rate limit") || lower.includes("too many") || lower.includes("security purposes") || lower.includes("once every")) {
      return "Too many attempts. Please wait a few minutes and try again.";
    }

    if (lower.includes("already") && (lower.includes("registered") || lower.includes("exists"))) {
      return "An account with this email already exists. Please sign in or reset your password.";
    }

    if (lower.includes("invalid") && (lower.includes("credentials") || lower.includes("password") || lower.includes("email"))) {
      return "Invalid email or password. Please try again.";
    }

    if (lower.includes("email not confirmed") || lower.includes("not confirmed")) {
      return "Please verify your email address before signing in.";
    }

    if (lower.includes("user not found") || lower.includes("no user")) {
      return "No account found with this email. Please sign up.";
    }

    if (lower.includes("password") && lower.includes("short")) {
      return "Password must be at least 12 characters.";
    }

    if (lower.includes("expired")) {
      return "Invalid code. Please try again.";
    }

    if (lower.includes("rpc") || (lower.includes("function") && lower.includes("not"))) {
      return "A server error occurred. Please try again later.";
    }
  }

  return FALLBACKS[context] ?? FALLBACKS.unknown;
}

function extractMessage(error: unknown): string {
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message: unknown }).message);
  }
  return "";
}

export function authError(error: unknown): string {
  return humanize(error, "auth");
}

export function networkError(error: unknown): string {
  return humanize(error, "network");
}

export function friendlyError(error: unknown): string {
  return humanize(error, "unknown");
}