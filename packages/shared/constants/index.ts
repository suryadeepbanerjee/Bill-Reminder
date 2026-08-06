// Constants shared across app, website and (conceptually) edge functions.
// Single source of truth — never redefine these in platform code.

export {
  MAX_DAYS_IN_MONTH,
  MONTH_NAMES,
  DUE_DATE_YEAR_MIN,
  DUE_DATE_YEAR_MAX,
} from "../schemas/bill";

export {
  RESEND_COOLDOWN_MS,
  INVITE_MAX_SENDS,
  INVITE_LOCKOUT_MS,
} from "../utils/invite-resend";
