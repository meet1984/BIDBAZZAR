import { z } from "zod";

const commaSeparated = z.preprocess((value) => {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string");
  if (typeof value === "string" && value.trim()) return value.split(",");
  return [];
}, z.array(z.string().trim().min(1)).max(20));

const sanitizeString = (min: number, max: number) =>
  z.preprocess(
    (v) => (typeof v === "string" ? v.replace(/<[^>]*>/g, "").trim() : v),
    z.string().min(min).max(max),
  );

export const publicListingQuerySchema = z.object({
  q: z.string().trim().max(120).default(""),
  saleMode: z.enum(["negotiated_offer", "multi_unit_offer"]).optional(),
  category: commaSeparated.default([]),
  subcategory: commaSeparated.default([]),
  location: z.string().trim().max(120).default(""),
  condition: commaSeparated.default([]),
  status: z.enum(["all", "active", "live", "upcoming", "opening-soon", "ending-soon", "closed"]).optional(),
  minPrice: z.coerce.number().min(0).optional(),
  maxPrice: z.coerce.number().min(0).optional(),
  sort: z
    .enum(["recommended", "starting-soon", "ending-soon", "newly-listed", "price-low", "price-high"])
    .default("recommended"),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(12),
});

export const listingIdSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const listingImageIdSchema = listingIdSchema.extend({
  imageId: z.coerce.number().int().positive(),
});

export const reorderListingImagesSchema = z.object({
  items: z.array(z.object({
    id: z.coerce.number().int().positive(),
    displayOrder: z.coerce.number().int().min(0),
    isPrimary: z.boolean().optional(),
  })).min(1).max(6),
});

export const listingIdentifierSchema = z.object({
  identifier: z.string().trim().min(1).max(180),
});

export const baseListingFields = {
  saleMode: z.enum(["negotiated_offer", "multi_unit_offer"]).default("negotiated_offer"),
  categoryId: z.coerce.number().int().positive("Category is required."),
  subcategoryId: z.coerce.number().int().positive().nullable().optional(),
  title: sanitizeString(4, 180),
  description: sanitizeString(20, 10000),
  condition: z.enum(["new", "like-new", "used", "refurbished"]),
  location: sanitizeString(2, 120),
  askingPrice: z.coerce.number().min(0).max(9999999999999),
  currency: z.string().trim().max(10).default("INR"),
  startTime: z.coerce.date(),
  endTime: z.coerce.date(),
  offerSelectionDeadline: z.coerce.date().nullable().optional(),

  // Multi-unit offer specific fields
  totalQuantity: z.coerce.number().int().positive().nullable().optional(),
  unitName: z.string().trim().max(50).nullable().optional(),
  askingPricePerUnit: z.coerce.number().min(0).nullable().optional(),
  minOrderQuantity: z.coerce.number().int().positive().nullable().optional(),
  maxOrderQuantity: z.coerce.number().int().positive().nullable().optional(),
  quantityIncrement: z.coerce.number().int().positive().default(1).optional(),
  allowPartialAllocation: z.boolean().default(true).optional(),
  minAcceptableUnitPrice: z.coerce.number().min(0).nullable().optional(),
  offerStartTime: z.coerce.date().nullable().optional(),
  offerEndTime: z.coerce.date().nullable().optional(),
  buyerConfirmationDeadlineHours: z.coerce.number().int().positive().default(48).optional(),
  reviewStatus: z
    .enum([
      "draft",
      "submitted",
      "under_review",
      "approved",
      "scheduled",
      "open",
      "offer_selection",
      "sold",
      "partially_sold",
      "unsold",
      "completed",
      "changes_requested",
      "rejected",
      "cancelled",
      "suspended",
      "expired",
    ])
    .optional(),
};

function validateMultiUnit(val: Record<string, unknown>, ctx: z.RefinementCtx) {
  const endTime = val.endTime as Date | undefined;
  const startTime = val.startTime as Date | undefined;
  if (endTime && startTime) {
    const minDurationMs = 48 * 60 * 60 * 1000;
    if (endTime.getTime() < startTime.getTime() + minDurationMs) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endTime"],
        message: "Listing end time must be at least 48 hours after start time.",
      });
    }
  }

  if (val.saleMode === "multi_unit_offer") {
    const totalQuantity = val.totalQuantity as number | undefined;
    const askingPricePerUnit = val.askingPricePerUnit as number | undefined;
    const minOrderQuantity = val.minOrderQuantity as number | undefined;
    const maxOrderQuantity = val.maxOrderQuantity as number | undefined;

    if (!totalQuantity || totalQuantity <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["totalQuantity"],
        message: "Total quantity is required and must be greater than 0 for multi-unit listings.",
      });
    }
    if (askingPricePerUnit === undefined || askingPricePerUnit === null || askingPricePerUnit < 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["askingPricePerUnit"],
        message: "Asking price per unit is required and must be non-negative for multi-unit listings.",
      });
    }
    if (minOrderQuantity && maxOrderQuantity && minOrderQuantity > maxOrderQuantity) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["maxOrderQuantity"],
        message: "Maximum order quantity cannot be less than minimum order quantity.",
      });
    }
    if (totalQuantity && maxOrderQuantity && maxOrderQuantity > totalQuantity) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["maxOrderQuantity"],
        message: "Maximum order quantity cannot exceed total quantity.",
      });
    }
  }
}

export const createListingSchema = z
  .object(baseListingFields)
  .superRefine(validateMultiUnit);

export const updateListingSchema = z
  .object(baseListingFields)
  .partial()
  .superRefine((val, ctx) => {
    if (val.startTime && val.endTime) {
      const minDurationMs = 48 * 60 * 60 * 1000;
      if (val.endTime.getTime() < val.startTime.getTime() + minDurationMs) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["endTime"],
          message: "Listing end time must be at least 48 hours after start time.",
        });
      }
    }
    if (val.minOrderQuantity && val.maxOrderQuantity && val.minOrderQuantity > val.maxOrderQuantity) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["maxOrderQuantity"],
        message: "Maximum order quantity cannot be less than minimum order quantity.",
      });
    }
  });

export const sellerUpdateListingSchema = z
  .object(baseListingFields)
  .omit({ reviewStatus: true })
  .partial()
  .superRefine((val, ctx) => {
    if (val.startTime && val.endTime && val.endTime.getTime() < val.startTime.getTime() + 48 * 60 * 60 * 1000) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["endTime"], message: "Listing end time must be at least 48 hours after start time." });
    }
    if (val.minOrderQuantity && val.maxOrderQuantity && val.minOrderQuantity > val.maxOrderQuantity) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["maxOrderQuantity"], message: "Maximum order quantity cannot be less than minimum order quantity." });
    }
  });

export const adminReviewListingSchema = z
  .object({
    decision: z.enum(["approve", "reject", "request_changes"]),
    reason: z.string().trim().max(2000).default(""),
  })
  .refine(
    (value) =>
      value.decision === "approve" || value.reason.length >= 4,
    {
      path: ["reason"],
      message: "A mandatory reason (at least 4 characters) is required when rejecting or requesting changes.",
    },
  );

export const adminListingListQuerySchema = z.object({
  reviewStatus: z
    .enum([
      "draft",
      "submitted",
      "under_review",
      "approved",
      "scheduled",
      "open",
      "offer_selection",
      "sold",
      "partially_sold",
      "unsold",
      "completed",
      "changes_requested",
      "rejected",
      "cancelled",
      "suspended",
      "expired",
    ])
    .optional(),
  saleMode: z.enum(["negotiated_offer", "multi_unit_offer"]).optional(),
});

export type PublicListingQuery = z.infer<typeof publicListingQuerySchema>;
export type CreateListingInput = z.infer<typeof createListingSchema>;
export type UpdateListingInput = z.infer<typeof updateListingSchema>;
export type AdminReviewListingInput = z.infer<typeof adminReviewListingSchema>;
