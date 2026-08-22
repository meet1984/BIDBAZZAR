import { z } from "zod";

export const buyerToSellerCategoryRatingsSchema = z.object({
  productAccuracy: z.number().int().min(1).max(5),
  communication: z.number().int().min(1).max(5),
  transactionCooperation: z.number().int().min(1).max(5),
  overallExperience: z.number().int().min(1).max(5),
});

export const sellerToBuyerCategoryRatingsSchema = z.object({
  agreementReliability: z.number().int().min(1).max(5),
  communication: z.number().int().min(1).max(5),
  transactionCooperation: z.number().int().min(1).max(5),
});

export const buyerToSellerReviewSchema = z.object({
  ratingScore: z.number().int().min(1, "Rating must be at least 1 star").max(5, "Rating cannot exceed 5 stars"),
  categoryRatings: buyerToSellerCategoryRatingsSchema,
  comment: z.string().trim().min(5, "Review comment must be at least 5 characters").max(1000),
});

export const sellerToBuyerReviewSchema = z.object({
  ratingScore: z.number().int().min(1, "Rating must be at least 1 star").max(5, "Rating cannot exceed 5 stars"),
  categoryRatings: sellerToBuyerCategoryRatingsSchema,
  comment: z.string().trim().min(5, "Review comment must be at least 5 characters").max(1000),
});

export const reportReviewSchema = z.object({
  reason: z.enum([
    "offensive_language",
    "spam",
    "false_information",
    "harassment",
    "privacy_violation",
    "other",
  ]),
  details: z.string().trim().min(5, "Report details must be at least 5 characters").max(500),
});

export const moderateReviewSchema = z.object({
  action: z.enum(["hide", "restore", "dismiss_report"]),
  moderationReason: z.string().trim().min(5, "Moderation reason must be at least 5 characters").max(500),
  reportId: z.number().int().positive().optional(),
});

export const reviewIdSchema = z.object({ id: z.coerce.number().int().positive() });
export const orderReviewIdSchema = z.object({ orderId: z.coerce.number().int().positive() });

export type BuyerToSellerReviewInput = z.infer<typeof buyerToSellerReviewSchema>;
export type SellerToBuyerReviewInput = z.infer<typeof sellerToBuyerReviewSchema>;
export type ReportReviewInput = z.infer<typeof reportReviewSchema>;
export type ModerateReviewInput = z.infer<typeof moderateReviewSchema>;
