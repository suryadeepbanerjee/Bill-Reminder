import { z } from "zod";

export const reminderAnchorSchema = z.enum(["generation", "expected_payment", "due_date"]);
export const reminderChannelSchema = z.enum(["push", "email", "both"]);

export const reminderRuleSchema = z.object({
  bill_id: z.string().uuid(),
  anchor:  reminderAnchorSchema,
  offset_days: z
    .number()
    .int()
    .min(-30, "Offset cannot be more than 30 days before")
    .max(7,   "Offset cannot be more than 7 days after"),
  repeat_interval_hours: z
    .number()
    .int()
    .min(6, "Minimum repeat interval is 6 hours")
    .max(168, "Maximum repeat interval is 168 hours (1 week)")
    .optional()
    .nullable(),
  repeat_cap: z
    .number()
    .int()
    .min(1)
    .max(8, "Maximum 8 repeats per reminder rule")
    .optional()
    .nullable(),
  channel: reminderChannelSchema,
  enabled: z.boolean().default(true),
});

export type ReminderRuleFormData = z.infer<typeof reminderRuleSchema>;

// ── Email preference settings ────────────────────────────────────────────────

export const emailPreferenceSchema = z.enum([
  "milestones_only",  // default: generation day, expected payment day, due date, overdue
  "every_reminder",   // every push reminder also sends email
  "never",            // email notifications disabled
]);

export type EmailPreference = z.infer<typeof emailPreferenceSchema>;
