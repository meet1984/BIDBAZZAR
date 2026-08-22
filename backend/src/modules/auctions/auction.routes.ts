import { Router } from "express";
import { requireRole } from "../../middleware/auth.middleware.js";
import { writeRateLimit } from "../../middleware/rateLimit.middleware.js";
import { validate } from "../../middleware/validate.middleware.js";
import { asyncHandler } from "../../shared/asyncHandler.js";
import { auctionController } from "./auction.controller.js";
import {
  adminAuctionListSchema,
  adminAuctionUpdateSchema,
  adminReviewSchema,
  auctionIdSchema,
  createAuctionSchema,
  updateAuctionSchema,
} from "./auction.schemas.js";

import { requireVerifiedSeller } from "../../middleware/verification.middleware.js";

export const sellerAuctionRouter = Router();
sellerAuctionRouter.use(requireRole("seller", "admin"));
sellerAuctionRouter.get("/", asyncHandler(auctionController.listSeller));
sellerAuctionRouter.post(
  "/",
  ...requireVerifiedSeller,
  writeRateLimit,
  validate(createAuctionSchema),
  asyncHandler(auctionController.createSeller),
);
sellerAuctionRouter.patch(
  "/:id",
  writeRateLimit,
  validate(auctionIdSchema, "params"),
  validate(updateAuctionSchema),
  asyncHandler(auctionController.updateSeller),
);
sellerAuctionRouter.post(
  "/:id/submit",
  ...requireVerifiedSeller,
  writeRateLimit,
  validate(auctionIdSchema, "params"),
  asyncHandler(auctionController.submitSeller),
);
sellerAuctionRouter.post(
  "/:id/confirm",
  writeRateLimit,
  validate(auctionIdSchema, "params"),
  asyncHandler(auctionController.confirmSeller),
);
sellerAuctionRouter.delete(
  "/:id",
  writeRateLimit,
  validate(auctionIdSchema, "params"),
  asyncHandler(auctionController.deleteSeller),
);

export const adminAuctionRouter = Router();
adminAuctionRouter.use(requireRole("admin"));
adminAuctionRouter.get(
  "/",
  validate(adminAuctionListSchema, "query"),
  asyncHandler(auctionController.listAdmin),
);
adminAuctionRouter.patch(
  "/:id/review",
  validate(auctionIdSchema, "params"),
  validate(adminReviewSchema),
  asyncHandler(auctionController.reviewAdmin),
);
adminAuctionRouter.patch(
  "/:id",
  validate(auctionIdSchema, "params"),
  validate(adminAuctionUpdateSchema),
  asyncHandler(auctionController.updateAdmin),
);
adminAuctionRouter.delete(
  "/:id",
  validate(auctionIdSchema, "params"),
  asyncHandler(auctionController.deleteAdmin),
);
