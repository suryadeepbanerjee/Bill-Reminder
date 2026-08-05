import { z } from "zod";

// ── Enums ─────────────────────────────────────────────────────────────────────

export const behaviorTypeSchema = z.enum([
  "fixed_due_date",
  "prepaid_validity",
  "wallet_balance",
]);

export const repeatKindSchema = z.enum([
  "monthly",
  "yearly",
  "every_x_days",
  "every_x_weeks",
  "every_x_months",
  "none",
]);

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Max days per month (1-indexed). Feb = 29 — engine clamps in non-leap years. */
export const MAX_DAYS_IN_MONTH: Record<number, number> = {
  1: 31, 2: 29, 3: 31, 4: 30,  5: 31,  6: 30,
  7: 31, 8: 31, 9: 30, 10: 31, 11: 30, 12: 31,
};

export const MONTH_NAMES = [
  "January", "February", "March",     "April",   "May",      "June",
  "July",    "August",   "September", "October", "November", "December",
];

const MIN_YEAR = new Date().getFullYear();
const MAX_YEAR = new Date().getFullYear() + 10;

// Due-date (one-time) year selection: current year through current + 9
// (2026 → 2035 today). Shared by the UI pickers and validation so the
// backend always reflects what the picker offers.
export const DUE_DATE_YEAR_MIN = new Date().getFullYear();
export const DUE_DATE_YEAR_MAX = new Date().getFullYear() + 9;

// ── Numeric amount ─────────────────────────────────────────────────────────────

const amountSchema = z
  .coerce
  .number()
  .nonnegative("Amount must be 0 or greater")
  .optional()
  .nullable();

// ── Base object schema ────────────────────────────────────────────────────────

const createBillBaseSchema = z.object({
  // ── Step 1 ─────────────────────────────────────────────────────────────────
  category_id: z.string().uuid("Please select a category"),

  // ── Step 2 ─────────────────────────────────────────────────────────────────
  title: z
    .string()
    .trim()
    .min(1, "Title is required")
    .max(120, "Title must be 120 characters or less"),
  provider_name: z
    .string()
    .trim()
    .max(80, "Provider name must be 80 characters or less")
    .optional(),
  behavior_type: behaviorTypeSchema,
  amount_expected: amountSchema,
  currency: z.string().default("INR"),

  // ── Step 3: Recurrence ─────────────────────────────────────────────────────
  repeat_kind:     repeatKindSchema,
  repeat_interval: z.number().int().positive().optional().nullable(),

  // Fixed monthly: day-of-month (1–31, 0 = last day of month)
  due_day_offset: z
    .number()
    .int()
    .min(0, "Day must be 0 (last) or 1–31")
    .max(31, "Day cannot exceed 31")
    .optional()
    .nullable(),

  // Anchor date components
  anchor_month: z.number().int().min(1).max(12).optional().nullable(),
  anchor_day:   z.number().int().min(1).max(31).optional().nullable(),
  anchor_year:  z
    .number()
    .int()
    .min(MIN_YEAR, `Year must be ${MIN_YEAR} or later`)
    .max(MAX_YEAR, `Year cannot exceed ${MAX_YEAR}`)
    .optional()
    .nullable(),

  // Fixed billing: generation/payment lead times
  generation_day_offset:       z.number().int().optional().nullable(),
  expected_payment_day_offset: z.number().int().optional().nullable(),

  // Meta
  household_id: z.string().uuid(),
});

// ── Cross-field validation ────────────────────────────────────────────────────

export const createBillSchema = createBillBaseSchema.superRefine((data, ctx) => {
  const add = (path: string, message: string) =>
    ctx.addIssue({ code: z.ZodIssueCode.custom, message, path: [path] });

  const rk = data.repeat_kind;
  const bt = data.behavior_type;

  // ── Interval required for every_x_* ────────────────────────────────────────
  if (
    ["every_x_days", "every_x_weeks", "every_x_months"].includes(rk) &&
    !data.repeat_interval
  ) {
    add("repeat_interval", "Enter a number greater than 0");
  }

  // ── FIXED DUE DATE ─────────────────────────────────────────────────────────
  if (bt === "fixed_due_date") {
    if (rk === "monthly") {
      // Monthly: need due_day_offset
      if (data.due_day_offset == null) {
        add("due_day_offset", "Day of month is required");
      }
    } else if (rk === "yearly") {
      // Yearly: need anchor_month + anchor_day
      if (!data.anchor_month) add("anchor_month", "Month is required");
      if (!data.anchor_day)   add("anchor_day",   "Day is required");
      if (data.anchor_month && data.anchor_day) {
        const maxDay = MAX_DAYS_IN_MONTH[data.anchor_month];
        if (data.anchor_day > maxDay) {
          add("anchor_day", `${MONTH_NAMES[data.anchor_month - 1]} cannot have day ${data.anchor_day}`);
        }
      }
    } else if (rk === "none") {
      // One-time: need full date
      if (!data.anchor_month) add("anchor_month", "Month is required");
      if (!data.anchor_day)   add("anchor_day",   "Day is required");
      if (!data.anchor_year)  add("anchor_year",  "Year is required");
      if (data.anchor_month && data.anchor_day && data.anchor_year) {
        const test = new Date(data.anchor_year, data.anchor_month - 1, data.anchor_day);
        if (test.getMonth() !== data.anchor_month - 1) {
          add("anchor_day", `${data.anchor_day} ${MONTH_NAMES[data.anchor_month - 1]} ${data.anchor_year} is not a valid date`);
        }
      }
    }
    // every_x_* not allowed for fixed_due_date — silently ignored
  }

  // ── PREPAID / WALLET ───────────────────────────────────────────────────────
  if (bt === "prepaid_validity" || bt === "wallet_balance") {
    if (rk === "monthly") {
      if (!data.anchor_month) add("anchor_month", "Month is required");
      if (!data.anchor_day)   add("anchor_day",   "Day is required");
      if (data.anchor_month && data.anchor_day) {
        const maxDay = MAX_DAYS_IN_MONTH[data.anchor_month];
        if (data.anchor_day > maxDay) {
          add("anchor_day", `${MONTH_NAMES[data.anchor_month - 1]} cannot have day ${data.anchor_day}`);
        }
      }
    } else if (rk === "yearly") {
      if (!data.anchor_month) add("anchor_month", "Month is required");
      if (!data.anchor_day)   add("anchor_day",   "Day is required");
      if (data.anchor_month && data.anchor_day) {
        const maxDay = MAX_DAYS_IN_MONTH[data.anchor_month];
        if (data.anchor_day > maxDay) {
          add("anchor_day", `${MONTH_NAMES[data.anchor_month - 1]} cannot have day ${data.anchor_day}`);
        }
      }
    } else if (rk === "none") {
      if (!data.anchor_month) add("anchor_month", "Month is required");
      if (!data.anchor_day)   add("anchor_day",   "Day is required");
      if (!data.anchor_year)  add("anchor_year",  "Year is required");
      if (data.anchor_month && data.anchor_day && data.anchor_year) {
        const test = new Date(data.anchor_year, data.anchor_month - 1, data.anchor_day);
        if (test.getMonth() !== data.anchor_month - 1) {
          add("anchor_day", `${data.anchor_day} ${MONTH_NAMES[data.anchor_month - 1]} ${data.anchor_year} is not a valid date`);
        }
      }
    } else if (["every_x_days", "every_x_weeks", "every_x_months"].includes(rk)) {
      if (!data.anchor_month) add("anchor_month", "Month is required");
      if (!data.anchor_day)   add("anchor_day",   "Day is required");
      
      // every_x_days and every_x_weeks also require a year in the UI
      if (["every_x_days", "every_x_weeks"].includes(rk) && !data.anchor_year) {
        add("anchor_year", "Year is required");
      }

      if (data.anchor_month && data.anchor_day) {
        if (data.anchor_year) {
          const test = new Date(data.anchor_year, data.anchor_month - 1, data.anchor_day);
          if (test.getMonth() !== data.anchor_month - 1) {
            add("anchor_day", `${data.anchor_day} ${MONTH_NAMES[data.anchor_month - 1]} ${data.anchor_year} is not a valid date`);
          }
        } else {
          const maxDay = MAX_DAYS_IN_MONTH[data.anchor_month];
          if (data.anchor_day > maxDay) {
            add("anchor_day", `${MONTH_NAMES[data.anchor_month - 1]} cannot have day ${data.anchor_day}`);
          }
        }
      }
    }
    // repeat_interval already validated above
  }

  // Due-date (one-time) years are capped at the supported horizon
  if (rk === "none" && data.anchor_year != null && data.anchor_year > DUE_DATE_YEAR_MAX) {
    add("anchor_year", `Year cannot exceed ${DUE_DATE_YEAR_MAX}`);
  }
});

export type CreateBillFormData = z.infer<typeof createBillSchema>;

// ── Update Bill (partial) ─────────────────────────────────────────────────────

export const updateBillSchema = createBillBaseSchema
  .partial()
  .omit({ household_id: true })
  .superRefine((data, ctx) => {
    const add = (path: string, message: string) =>
      ctx.addIssue({ code: z.ZodIssueCode.custom, message, path: [path] });

    const rk = data.repeat_kind;
    const bt = data.behavior_type;

    if (!rk || !bt) return;

    // ── Interval required for every_x_* ──────────────────────────────────────
    if (
      ["every_x_days", "every_x_weeks", "every_x_months"].includes(rk) &&
      !data.repeat_interval
    ) {
      add("repeat_interval", "Enter a number greater than 0");
    }

    // ── FIXED DUE DATE ───────────────────────────────────────────────────────
    if (bt === "fixed_due_date") {
      if (rk === "monthly" && data.due_day_offset == null) {
        add("due_day_offset", "Day of month is required");
      } else if (rk === "yearly") {
        if (!data.anchor_month) add("anchor_month", "Month is required");
        if (!data.anchor_day)   add("anchor_day",   "Day is required");
        if (data.anchor_month && data.anchor_day) {
          const maxDay = MAX_DAYS_IN_MONTH[data.anchor_month];
          if (data.anchor_day > maxDay) {
            add("anchor_day", `${MONTH_NAMES[data.anchor_month - 1]} cannot have day ${data.anchor_day}`);
          }
        }
      } else if (rk === "none") {
        if (!data.anchor_month) add("anchor_month", "Month is required");
        if (!data.anchor_day)   add("anchor_day",   "Day is required");
        if (!data.anchor_year)  add("anchor_year",  "Year is required");
        if (data.anchor_month && data.anchor_day && data.anchor_year) {
          const test = new Date(data.anchor_year, data.anchor_month - 1, data.anchor_day);
          if (test.getMonth() !== data.anchor_month - 1) {
            add("anchor_day", `${data.anchor_day} ${MONTH_NAMES[data.anchor_month - 1]} ${data.anchor_year} is not a valid date`);
          }
        }
      }
    }

    // ── PREPAID / WALLET ─────────────────────────────────────────────────────
    if (bt === "prepaid_validity" || bt === "wallet_balance") {
      if (rk === "monthly" || rk === "yearly") {
        if (!data.anchor_month) add("anchor_month", "Month is required");
        if (!data.anchor_day)   add("anchor_day",   "Day is required");
        if (data.anchor_month && data.anchor_day) {
          const maxDay = MAX_DAYS_IN_MONTH[data.anchor_month];
          if (data.anchor_day > maxDay) {
            add("anchor_day", `${MONTH_NAMES[data.anchor_month - 1]} cannot have day ${data.anchor_day}`);
          }
        }
      } else if (rk === "none") {
        if (!data.anchor_month) add("anchor_month", "Month is required");
        if (!data.anchor_day)   add("anchor_day",   "Day is required");
        if (!data.anchor_year)  add("anchor_year",  "Year is required");
        if (data.anchor_month && data.anchor_day && data.anchor_year) {
          const test = new Date(data.anchor_year, data.anchor_month - 1, data.anchor_day);
          if (test.getMonth() !== data.anchor_month - 1) {
            add("anchor_day", `${data.anchor_day} ${MONTH_NAMES[data.anchor_month - 1]} ${data.anchor_year} is not a valid date`);
          }
        }
      } else if (["every_x_days", "every_x_weeks", "every_x_months"].includes(rk)) {
        if (!data.anchor_month) add("anchor_month", "Month is required");
        if (!data.anchor_day)   add("anchor_day",   "Day is required");
        
        // every_x_days and every_x_weeks also require a year in the UI
        if (["every_x_days", "every_x_weeks"].includes(rk) && !data.anchor_year) {
          add("anchor_year", "Year is required");
        }

        if (data.anchor_month && data.anchor_day) {
          if (data.anchor_year) {
            const test = new Date(data.anchor_year, data.anchor_month - 1, data.anchor_day);
            if (test.getMonth() !== data.anchor_month - 1) {
              add("anchor_day", `${data.anchor_day} ${MONTH_NAMES[data.anchor_month - 1]} ${data.anchor_year} is not a valid date`);
            }
          } else {
            const maxDay = MAX_DAYS_IN_MONTH[data.anchor_month];
            if (data.anchor_day > maxDay) {
              add("anchor_day", `${MONTH_NAMES[data.anchor_month - 1]} cannot have day ${data.anchor_day}`);
            }
          }
        }
      }
    }

  // Due-date (one-time) years are capped at the supported horizon
  if (rk === "none" && data.anchor_year != null && data.anchor_year > DUE_DATE_YEAR_MAX) {
    add("anchor_year", `Year cannot exceed ${DUE_DATE_YEAR_MAX}`);
  }
});

export type UpdateBillFormData = z.infer<typeof updateBillSchema>;

// ── Mark Paid ─────────────────────────────────────────────────────────────────

export const markPaidSchema = z.object({
  paid_amount: z
    .string()
    .min(1, "Amount is required")
    .transform((v) => parseFloat(v))
    .refine((v) => v >= 0 && isFinite(v), { message: "Enter a valid amount" }),
  paid_at:        z.string().min(1, "Date is required"),
  payment_notes:  z.string().trim().max(1000, "Notes must be 1000 characters or less").optional(),
  occurrence_id:  z.string().uuid(),
});

export type MarkPaidFormData = z.infer<typeof markPaidSchema>;
