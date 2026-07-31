import { z } from "zod";

// ── Behavior types ────────────────────────────────────────────────────────────

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

// ── Amount (numeric, never float) ─────────────────────────────────────────────

const amountSchema = z
  .string()
  .optional()
  .transform((v) => (v ? parseFloat(v) : undefined))
  .refine((v) => v === undefined || (v >= 0 && isFinite(v)), {
    message: "Amount must be a positive number",
  });

// ── Base object schema (no superRefine — keeps it as ZodObject so .partial() works) ──

const createBillBaseSchema = z.object({
  // Step 1 — Category
  category_id: z.string().uuid("Please select a category"),

  // Step 2 — Details
  title: z
    .string()
    .min(1, "Title is required")
    .max(120, "Title must be 120 characters or less"),
  provider_name: z
    .string()
    .max(80, "Provider name must be 80 characters or less")
    .optional(),
  behavior_type: behaviorTypeSchema,
  amount_expected: amountSchema,
  currency: z.string().default("INR"),

  // Step 3 — Recurrence
  repeat_kind:     repeatKindSchema,
  repeat_interval: z.number().int().positive().optional().nullable(),

  // Fixed due date fields
  generation_day_offset:       z.number().int().optional().nullable(),
  expected_payment_day_offset: z.number().int().optional().nullable(),
  due_day_offset:              z.number().int().optional().nullable(),

  // Prepaid validity fields
  validity_days: z.number().int().positive().optional().nullable(),

  // Wallet balance fields
  check_interval_days: z.number().int().positive().optional().nullable(),
  minimum_balance:     z.number().nonnegative().optional().nullable(),
  balance_notes:       z.string().max(500).optional().nullable(),

  // Meta
  household_id: z.string().uuid(),
});

// ── Cross-field refinement ────────────────────────────────────────────────────
// Applied on top of the base schema. Cross-field rules can't be in .partial()
// anyway, so this is the correct separation.

export const createBillSchema = createBillBaseSchema.superRefine((data, ctx) => {
  if (
    ["every_x_days", "every_x_weeks", "every_x_months"].includes(data.repeat_kind) &&
    !data.repeat_interval
  ) {
    ctx.addIssue({
      code:    z.ZodIssueCode.custom,
      message: "Interval is required for this repeat type",
      path:    ["repeat_interval"],
    });
  }

  if (data.behavior_type === "prepaid_validity" && !data.validity_days) {
    ctx.addIssue({
      code:    z.ZodIssueCode.custom,
      message: "Validity days is required for prepaid bills",
      path:    ["validity_days"],
    });
  }

  if (data.behavior_type === "wallet_balance" && !data.check_interval_days) {
    ctx.addIssue({
      code:    z.ZodIssueCode.custom,
      message: "Check interval is required for wallet/balance bills",
      path:    ["check_interval_days"],
    });
  }

  if (data.behavior_type === "fixed_due_date" && data.due_day_offset == null) {
    ctx.addIssue({
      code:    z.ZodIssueCode.custom,
      message: "Due day is required for fixed due date bills",
      path:    ["due_day_offset"],
    });
  }
});

export type CreateBillFormData = z.infer<typeof createBillSchema>;

// ── Update Bill (partial) ─────────────────────────────────────────────────────
// Use the BASE schema (ZodObject) for .partial() — ZodEffects doesn't support it.

export const updateBillSchema = createBillBaseSchema
  .partial()
  .omit({ household_id: true });

export type UpdateBillFormData = z.infer<typeof updateBillSchema>;

// ── Mark Paid form schema ─────────────────────────────────────────────────────

export const markPaidSchema = z.object({
  paid_amount: z
    .string()
    .min(1, "Amount is required")
    .transform((v) => parseFloat(v))
    .refine((v) => v >= 0 && isFinite(v), { message: "Enter a valid amount" }),
  paid_at: z.string().min(1, "Date is required"),
  payment_notes: z
    .string()
    .max(1000, "Notes must be 1000 characters or less")
    .optional(),
  occurrence_id: z.string().uuid(),
});

export type MarkPaidFormData = z.infer<typeof markPaidSchema>;
