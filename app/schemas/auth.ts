import { z } from "zod";

export const signInSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(12, "Password must be at least 12 characters"),
});

export const signUpSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(12, "Password must be at least 12 characters"),
  displayName: z
    .string()
    .min(1, "Display name is required")
    .max(50, "Display name must be 50 characters or less"),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
});

export const resetPasswordSchema = z.object({
  password: z.string().min(12, "Password must be at least 12 characters"),
  confirmPassword: z.string().min(12, "Password must be at least 12 characters"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

export type SignInFormData = z.infer<typeof signInSchema>;
export type SignUpFormData = z.infer<typeof signUpSchema>;
export type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>;
