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
  category_id: z.string().uuid("Please select a category"),

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

  repeat_kind:     repeatKindSchema,
  repeat_interval: z.number().int().positive().optional().nullable(),

  due_day_offset: z
    .number()
    .int()
    .min(0, "Day must be 0 (last) or 1–31")
    .max(31, "Day cannot exceed 31")
    .optional()
    .nullable(),

  anchor_month: z.number().int().min(1).max(12).optional().nullable(),
  anchor_day:   z.number().int().min(1).max(31).optional().nullable(),
  anchor_year:  z
    .number()
    .int()
    .min(MIN_YEAR, `Year must be ${MIN_YEAR} or later`)
    .max(MAX_YEAR, `Year cannot exceed ${MAX_YEAR}`)
    .optional()
    .nullable(),

  generation_day_offset:       z.number().int().optional().nullable(),
  expected_payment_day_offset: z.number().int().optional().nullable(),

  household_id: z.string().uuid(),
});

export const createBillSchema = createBillBaseSchema.superRefine((data, ctx) => {
  const add = (path: string, message: string) =>
    ctx.addIssue({ code: z.ZodIssueCode.custom, message, path: [path] });

  const rk = data.repeat_kind;
  const bt = data.behavior_type;

  if (
    ["every_x_days", "every_x_weeks", "every_x_months"].includes(rk) &&
    !data.repeat_interval
  ) {
    add("repeat_interval", "Enter a number greater than 0");
  }

  if (bt === "fixed_due_date") {
    if (rk === "monthly") {
      if (data.due_day_offset == null) {
        add("due_day_offset", "Day of month is required");
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
    }
  }

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

    if (
      ["every_x_days", "every_x_weeks", "every_x_months"].includes(rk) &&
      !data.repeat_interval
    ) {
      add("repeat_interval", "Enter a number greater than 0");
    }

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

    if (rk === "none" && data.anchor_year != null && data.anchor_year > DUE_DATE_YEAR_MAX) {
      add("anchor_year", `Year cannot exceed ${DUE_DATE_YEAR_MAX}`);
    }
  });

export type UpdateBillFormData = z.infer<typeof updateBillSchema>;