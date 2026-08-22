import { z } from "zod";

export const buyerProfileIdParamSchema = z.object({
  id: z.coerce.number().int().positive("Invalid buyer profile ID"),
});

export const updateBuyerProfileSchema = z.object({
  legalFullName: z.string().trim().min(2, "Legal full name must be at least 2 characters").max(150),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date of birth must be YYYY-MM-DD format").nullable().optional(),
  buyerType: z.enum(["individual", "business"]).default("individual"),
  addressLine1: z.string().trim().min(5, "Address line 1 is required").max(255).nullable().optional(),
  addressLine2: z.string().trim().max(255).nullable().optional(),
  city: z.string().trim().min(2, "City is required").max(100).nullable().optional(),
  state: z.string().trim().min(2, "State is required").max(100).nullable().optional(),
  pinCode: z.string().trim().min(3, "PIN code is required").max(20).nullable().optional(),
  country: z.string().trim().min(2, "Country is required").max(100).nullable().optional(),
  governmentIdType: z.enum([
    "passport",
    "drivers_license",
    "national_id",
    "voter_id",
    "ssn_last4",
    "tax_id",
    "other",
  ]).nullable().optional(),
  governmentIdNumber: z.string().trim().min(4).max(100).nullable().optional(),
  businessName: z.string().trim().max(150).nullable().optional(),
  gstNumber: z.string().trim().max(50).nullable().optional(),
  profileImage: z.string().trim().url("Invalid profile image URL").max(500).nullable().optional(),
});

export type UpdateBuyerProfileInput = z.infer<typeof updateBuyerProfileSchema>;
