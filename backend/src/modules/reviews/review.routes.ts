import { Router } from "express";
import { requireAccountType, requireAuth } from "../../middleware/auth.middleware.js";
import { validate } from "../../middleware/validate.middleware.js";
import { requireAdminPermission } from "../admin-permissions/admin-permission.middleware.js";
import {
  getPublicTrustProfileHandler,
  listReviewReportsHandler,
  moderateReviewHandler,
  reportReviewHandler,
  submitBuyerReviewHandler,
  submitSellerReviewHandler,
} from "./review.controller.js";
import {
  buyerToSellerReviewSchema,
  moderateReviewSchema,
  reportReviewSchema,
  reviewIdSchema,
  orderReviewIdSchema,
  sellerToBuyerReviewSchema,
} from "./review.schemas.js";

export const reviewRouter = Router();

// Submit buyer review for completed order
reviewRouter.post(
  "/orders/:orderId/buyer-review",
  requireAuth,
  requireAccountType("buyer"),
  validate(orderReviewIdSchema, "params"),
  validate(buyerToSellerReviewSchema),
  submitBuyerReviewHandler,
);

// Submit seller review for completed order
reviewRouter.post(
  "/orders/:orderId/seller-review",
  requireAuth,
  requireAccountType("seller"),
  validate(orderReviewIdSchema, "params"),
  validate(sellerToBuyerReviewSchema),
  submitSellerReviewHandler,
);

// Report a review for moderation
reviewRouter.post(
  "/:id/report",
  requireAuth,
  validate(reviewIdSchema, "params"),
  validate(reportReviewSchema),
  reportReviewHandler,
);

// Admin review moderation (requires review_moderation permission)
reviewRouter.post(
  "/:id/moderate",
  requireAdminPermission("review_moderation"),
  validate(reviewIdSchema, "params"),
  validate(moderateReviewSchema),
  moderateReviewHandler,
);

// Admin list review reports (requires review_moderation permission)
reviewRouter.get(
  "/reports/admin",
  requireAdminPermission("review_moderation"),
  listReviewReportsHandler,
);

// Public trust profile lookup (also mounted at /api/users/:id/trust-profile)
reviewRouter.get("/trust-profile/:id", validate(reviewIdSchema, "params"), getPublicTrustProfileHandler);
