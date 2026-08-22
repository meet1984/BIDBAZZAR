import { Router } from "express";
import multer from "multer";
import { env } from "../../config/env.js";
import { optionalAuth, requireRole } from "../../middleware/auth.middleware.js";
import { requireAdminPermission } from "../admin-permissions/admin-permission.middleware.js";
import { writeRateLimit } from "../../middleware/rateLimit.middleware.js";
import { validate } from "../../middleware/validate.middleware.js";
import { requireVerifiedSeller } from "../../middleware/verification.middleware.js";
import { asyncHandler } from "../../shared/asyncHandler.js";
import { AppError } from "../../shared/AppError.js";
import { listingController } from "./listing.controller.js";
import { listingImageController } from "./listing-image.controller.js";
import {
  adminListingListQuerySchema,
  adminReviewListingSchema,
  createListingSchema,
  listingImageIdSchema,
  listingIdentifierSchema,
  listingIdSchema,
  publicListingQuerySchema,
  reorderListingImagesSchema,
  sellerUpdateListingSchema,
  updateListingSchema,
} from "./listing.schemas.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.MAX_UPLOAD_BYTES, files: 6 },
  fileFilter: (_request, file, callback) => {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.mimetype)) {
      callback(new AppError(422, "INVALID_IMAGE_TYPE", "Only JPG, PNG, and WebP image files are allowed."));
      return;
    }
    callback(null, true);
  },
});

export const publicListingRouter = Router();
publicListingRouter.get(
  "/",
  optionalAuth,
  validate(publicListingQuerySchema, "query"),
  asyncHandler(listingController.listPublic),
);
publicListingRouter.get("/:identifier", optionalAuth, validate(listingIdentifierSchema, "params"), asyncHandler(listingController.publicDetail));

export const sellerListingRouter = Router();
sellerListingRouter.use(requireRole("seller", "admin"));
sellerListingRouter.get("/", asyncHandler(listingController.listSeller));
sellerListingRouter.post(
  "/",
  ...requireVerifiedSeller,
  writeRateLimit,
  validate(createListingSchema),
  asyncHandler(listingController.createSeller),
);
sellerListingRouter.patch(
  "/:id",
  writeRateLimit,
  validate(listingIdSchema, "params"),
  validate(sellerUpdateListingSchema),
  asyncHandler(listingController.updateSeller),
);
sellerListingRouter.post(
  "/:id/submit",
  ...requireVerifiedSeller,
  writeRateLimit,
  validate(listingIdSchema, "params"),
  asyncHandler(listingController.submitSeller),
);
sellerListingRouter.post(
  "/:id/confirm",
  writeRateLimit,
  validate(listingIdSchema, "params"),
  asyncHandler(listingController.confirmSeller),
);
sellerListingRouter.delete(
  "/:id",
  writeRateLimit,
  validate(listingIdSchema, "params"),
  asyncHandler(listingController.deleteSeller),
);

// Listing Images Management
sellerListingRouter.get(
  "/:id/images",
  validate(listingIdSchema, "params"),
  asyncHandler(listingImageController.listImages),
);
sellerListingRouter.post(
  "/:id/images",
  writeRateLimit,
  validate(listingIdSchema, "params"),
  upload.array("images", 6),
  asyncHandler(listingImageController.uploadImages),
);
sellerListingRouter.patch(
  "/:id/images/reorder",
  writeRateLimit,
  validate(listingIdSchema, "params"),
  validate(reorderListingImagesSchema),
  asyncHandler(listingImageController.reorderImages),
);
sellerListingRouter.delete(
  "/:id/images/:imageId",
  writeRateLimit,
  validate(listingImageIdSchema, "params"),
  asyncHandler(listingImageController.deleteImage),
);

export const adminListingRouter = Router();
adminListingRouter.use(...requireAdminPermission("listing_review"));
adminListingRouter.get(
  "/",
  validate(adminListingListQuerySchema, "query"),
  asyncHandler(listingController.listAdmin),
);
adminListingRouter.patch(
  "/:id/review",
  validate(listingIdSchema, "params"),
  validate(adminReviewListingSchema),
  asyncHandler(listingController.reviewAdmin),
);
adminListingRouter.patch(
  "/:id",
  validate(listingIdSchema, "params"),
  validate(updateListingSchema),
  asyncHandler(listingController.updateAdmin),
);
adminListingRouter.delete(
  "/:id",
  validate(listingIdSchema, "params"),
  asyncHandler(listingController.deleteAdmin),
);
