/**
 * Error sanitization — ensures no internal/technical error messages
 * are ever shown to the user. Every error displayed in the UI must
 * pass through `humanize()` or one of the category helpers.
 *
 * Internal errors are still logged to the console for debugging.
 */

/** Known user-facing messages that are already safe to display. */
const SAFE_MESSAGES = new Set([
  "An account with this email already exists. Please sign in or reset your password.",
  "Too many attempts. Please wait a few minutes and try again.",
  "Too many attempts. Please wait a moment and try again.",
  "An unexpected error occurred. Please try again.",
  "Google sign-in failed. Please try again.",
  "Could not send the code. Please try again.",
  "Could not resend. Please try again.",
  "Could not verify the code. Please try again.",
  "Invalid code. Please try again.",
  "Enter the 6-digit code from your email.",
  "The code must be exactly 6 digits.",
  "Please enter a valid email address.",
  "We couldn't find your email address. Please sign up again.",
  "Could not send the email. Please try again.",
  "Name cannot be empty.",
  "Name must be 50 characters or less.",
  "Enter a valid amount.",
  "Bill name is required.",
  "Please select a category.",
  "Household not found. Please try again.",
  "Please fill all required fields correctly.",
  "Could not update email preferences",
  "Could not export your data.",
  "Failed to load dashboard.",
  "Failed to load bills.",
  "Failed to load bill.",
  "Something went wrong. Please try again.",
  "Invalid verification code. Please try again.",
  "We couldn't verify you're human. Please try again.",
  // Household invite messages (from invite-member edge function)
  "No account found with this email. They must sign up first.",
  "Only the household owner can invite members.",
  "This user is already a member of this household.",
  "This invite has reached the maximum number of sends.",
  // Account deletion guard (from delete-account edge function)
  "You still own a household with other members. Transfer ownership to another member before deleting your account.",
]);

/** Generic fallback messages by context. */
const FALLBACKS = {
  auth:        "Something went wrong. Please try again.",
  network:     "Please check your internet connection and try again.",
  session:     "Your session has expired. Please sign in again.",
  permission:  "Permission denied. Please check your device settings.",
  notFound:    "The requested resource was not found.",
  validation:  "Please check your input and try again.",
  server:      "A server error occurred. Please try again later.",
  unknown:     "Something went wrong. Please try again.",
} as const;

type ErrorContext = keyof typeof FALLBACKS;

/**
 * Sanitize any error into a user-safe message.
 * - If the message is already in the safe list, return it as-is.
 * - Otherwise, return a generic fallback based on context.
 * - Always log the original error to console for debugging.
 */
export function humanize(error: unknown, context: ErrorContext = "unknown"): string {
  const raw = extractMessage(error);

  // Log the sanitized message only — never the raw error object, which can
  // embed session/user payloads in Supabase errors (audit finding).
  console.warn(`[Error:${context}]`, raw);

  // Already safe
  if (raw && SAFE_MESSAGES.has(raw)) {
    return raw;
  }

  // Pattern-match for specific known issues
  if (raw) {
    const lower = raw.toLowerCase();

    // Network errors
    if (lower.includes("network") || lower.includes("internet") || lower.includes("fetch")) {
      return FALLBACKS.network;
    }

    // CAPTCHA rejections — before the token/code checks so "Captcha token
    // expired" never surfaces as a wrong-code message.
    if (lower.includes("captcha") || lower.includes("hcaptcha") || lower.includes("turnstile") || lower.includes("challenge")) {
      return "We couldn't verify you're human. Please try again.";
    }

    // Verification code issues — must come before generic token/session checks
    if (lower.includes("invalid otp") || lower.includes("invalid token") || lower.includes("token") && (lower.includes("invalid") || lower.includes("expired"))) {
      return "Invalid code. Please try again.";
    }

    // Session/auth expiry
    if (lower.includes("session") && (lower.includes("expired") || lower.includes("invalid"))) {
      return FALLBACKS.session;
    }
    if (lower.includes("jwt") && lower.includes("expired")) {
      return FALLBACKS.session;
    }

    // Invite resend rate-limit messages (server-generated, safe to show verbatim)
    if (lower.includes("before sending another invite") || lower.includes("invites sent to this email")) {
      return raw;
    }

    // Invite member-specific messages (from edge function, safe to show)
    if (lower.includes("must sign up first") || lower.includes("household owner") || lower.includes("already a member")) {
      return raw;
    }

    // Rate limiting
    if (lower.includes("rate limit") || lower.includes("too many") || lower.includes("security purposes") || lower.includes("once every")) {
      return "Too many attempts. Please wait a few minutes and try again.";
    }

    // Email already exists
    if (lower.includes("already") && (lower.includes("registered") || lower.includes("exists"))) {
      return "An account with this email already exists. Please sign in or reset your password.";
    }

    // Invalid credentials
    if (lower.includes("invalid") && (lower.includes("credentials") || lower.includes("password") || lower.includes("email"))) {
      return "Invalid email or password. Please try again.";
    }

    // Email not confirmed
    if (lower.includes("email not confirmed") || lower.includes("not confirmed")) {
      return "Please verify your email address before signing in.";
    }

    // User not found
    if (lower.includes("user not found") || lower.includes("no user")) {
      return "No account found with this email. Please sign up.";
    }

    // Password too short — echo GoTrue's actual requirement so the message
    // stays truthful whether the auth minimum is 8, 12, or anything else.
    if (
      lower.includes("password") &&
      (lower.includes("short") || lower.includes("at least") || lower.includes("weaker"))
    ) {
      const lenMatch = raw.match(/at least\s+(\d+)\s+characters?/i);
      return lenMatch
        ? `Password must be at least ${lenMatch[1]} characters.`
        : "Password must be at least 8 characters.";
    }

    // Generic expired token
    if (lower.includes("expired")) {
      return "Invalid code. Please try again.";
    }

    // Google/OAuth specific
    if (lower.includes("cancelled") || lower.includes("canceled")) {
      return "Sign-in was cancelled.";
    }
    if (lower.includes("play services") || lower.includes("play_services")) {
      return "Google Play Services are required. Please update Google Play Services.";
    }
    if (lower.includes("developer_error") || lower.includes("sha-1") || lower.includes("webclientid")) {
      return "Sign-in configuration error. Please try again or contact support.";
    }
    if (lower.includes("network") && lower.includes("error")) {
      return FALLBACKS.network;
    }

    // RPC / database errors
    if (lower.includes("rpc") || lower.includes("function") && lower.includes("not")) {
      return "A server error occurred. Please try again later.";
    }
  }

  const fallback = FALLBACKS[context] ?? FALLBACKS.unknown;
  return fallback;
}

/** Extract a string message from any error-like value. */
function extractMessage(error: unknown): string {
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message: unknown }).message);
  }
  return "";
}

/** Convenience: humanize for auth errors. */
export function authError(error: unknown): string {
  return humanize(error, "auth");
}

/** Convenience: humanize for network errors. */
export function networkError(error: unknown): string {
  return humanize(error, "network");
}

/** Convenience: humanize for generic errors with no specific context. */
export function friendlyError(error: unknown): string {
  return humanize(error, "unknown");
}
