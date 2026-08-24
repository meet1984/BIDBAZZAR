import { z } from "zod";

const email = z.string().trim().toLowerCase().email().max(254);
const phone = z
  .string()
  .trim()
  .min(7, "Phone number must be at least 7 digits.")
  .max(30, "Keep the phone number within 30 characters.")
  .regex(/^[+]?[0-9\s\-()]+$/, "Please enter a valid phone number.");
const password = z
  .string()
  .min(8)
  .max(72)
  .refine((value) => /[A-Za-z]/.test(value) && /\d/.test(value), {
    message: "Password must contain at least one letter and one number.",
  });

export const buyerRegistrationSchema = z.object({
  accountType: z.literal("buyer").default("buyer"),
  fullName: z.string().trim().min(1).max(100),
  email,
  phone,
  password,
  acceptedTerms: z.literal(true),
  marketingConsent: z.boolean().default(false),
});

export const sellerRegistrationSchema = z.object({
  accountType: z.literal("seller").default("seller"),
  fullName: z.string().trim().min(1).max(100),
  email,
  phone,
  password,
  sellerName: z.string().trim().min(1, "Seller name is required").max(120),
  sellerType: z.enum(["individual", "business", "distributor"]),
  acceptedTerms: z.literal(true),
  marketingConsent: z.boolean().default(false),
});

export const registrationSchema = z
  .object({
    role: z.enum(["buyer", "seller"]).optional(),
    accountType: z.enum(["buyer", "seller"]).optional(),
    fullName: z.string().trim().min(1).max(100),
    email,
    phone,
    password,
    sellerName: z.string().trim().max(120).optional(),
    sellerType: z.enum(["individual", "business", "distributor"]).optional(),
    acceptedTerms: z.literal(true),
    marketingConsent: z.boolean().default(false),
  })
  .superRefine((data, context) => {
    const effectiveRole = data.accountType || data.role;
    if (!effectiveRole) {
      context.addIssue({ code: "custom", path: ["accountType"], message: "Choose a buyer or seller account type." });
      return;
    }
    if (data.accountType && data.role && data.accountType !== data.role) {
      context.addIssue({ code: "custom", path: ["accountType"], message: "role and accountType must match." });
    }
    if (effectiveRole === "seller") {
      if (!data.sellerName) {
        context.addIssue({
          code: "custom",
          path: ["sellerName"],
          message: "Seller name is required for seller accounts.",
        });
      }
      if (!data.sellerType) {
        context.addIssue({
          code: "custom",
          path: ["sellerType"],
          message: "Seller type is required for seller accounts.",
        });
      }
    }
  });

export const loginSchema = z.object({
  email,
  password: z.string().min(1).max(72),
  rememberMe: z.boolean().default(false),
  returnTo: z
    .string()
    .max(300)
    .refine(
      (value) => value.startsWith("/") && !value.startsWith("//") && !value.includes("\\"),
      "returnTo must be an internal path.",
    )
    .nullable()
    .optional(),
});

export const verifyOtpSchema = z.object({
  challengeId: z.string().min(1).max(100),
  otp: z.string().trim().regex(/^\d{6}$/, "Verification code must be 6 digits."),
});

export const resendOtpSchema = z.object({
  challengeId: z.string().min(1).max(100),
});

export const forgotPasswordSchema = z.object({ email });
export const resetPasswordSchema = z.object({
  token: z.string().regex(/^[a-f0-9]{64}$/i, "Invalid reset token."),
  password,
});

export type BuyerRegistrationInput = z.infer<typeof buyerRegistrationSchema>;
export type SellerRegistrationInput = z.infer<typeof sellerRegistrationSchema>;
export type RegistrationInput = z.infer<typeof registrationSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>;
export type ResendOtpInput = z.infer<typeof resendOtpSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
