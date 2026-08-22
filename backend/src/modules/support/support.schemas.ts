import { z } from "zod";

const consent = z.preprocess(
  (value) => value === true || value === "true",
  z.literal(true),
);

const sanitizeString = (min: number, max: number) =>
  z.preprocess(
    (v) => (typeof v === "string" ? v.replace(/<[^>]*>/g, "").trim() : v),
    z.string().min(min).max(max),
  );

export const supportEnquirySchema = z.object({
  fullName: sanitizeString(1, 100),
  email: z.string().trim().toLowerCase().email().max(254),
  phone: z.string().trim().max(30).optional(),
  role: z.enum(["buyer", "seller", "visitor", "other"]),
  reason: z.enum([
    "buyer-account",
    "seller-account",
    "auction-bidding",
    "auction-dispute",
    "seller-complaint",
    "buyer-complaint",
    "direct-deal",
    "listing-submission",
    "listing-review",
    "technical",
    "general",
  ]),
  subject: sanitizeString(4, 120),
  reference: z.string().trim().max(60).optional(),
  message: sanitizeString(20, 1500),
  consent,
});

export type SupportEnquiryInput = z.infer<typeof supportEnquirySchema>;

export const supportEnquiryIdSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const updateSupportStatusSchema = z.object({
  status: z.enum(["open", "in_progress", "resolved", "closed"]),
});

export type UpdateSupportStatusInput = z.infer<typeof updateSupportStatusSchema>;

