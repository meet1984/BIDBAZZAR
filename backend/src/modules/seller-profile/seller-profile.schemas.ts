import { z } from "zod";

export const sellerProfileIdParamSchema = z.object({
  id: z.coerce.number().int().positive("Invalid seller profile ID"),
});

export const updateSellerProfileSchema = z.object({
  legalName: z.string().trim().min(2, "Legal name must be at least 2 characters").max(150),
  businessName: z.string().trim().min(2, "Business name must be at least 2 characters").max(150),
  sellerType: z.enum(["individual", "business", "distributor"]).default("individual"),
  registeredAddressLine1: z.string().trim().min(5, "Registered address line 1 is required").max(255).nullable().optional(),
  registeredAddressLine2: z.string().trim().max(255).nullable().optional(),
  city: z.string().trim().min(2, "City is required").max(100).nullable().optional(),
  state: z.string().trim().min(2, "State is required").max(100).nullable().optional(),
  pinCode: z.string().trim().min(3, "PIN code is required").max(20).nullable().optional(),
  country: z.string().trim().min(2, "Country is required").max(100).nullable().optional(),
  panGstNumber: z.string().trim().min(5).max(50).nullable().optional(),
  businessRegistrationInfo: z.string().trim().max(2000).nullable().optional(),
  productCategories: z.array(z.string().trim().min(1)).nullable().optional(),
  publicBusinessDescription: z.string().trim().max(2000).nullable().optional(),
  profileLogo: z.string().trim().url("Invalid profile logo URL").max(500).nullable().optional(),
});

export type UpdateSellerProfileInput = z.infer<typeof updateSellerProfileSchema>;
