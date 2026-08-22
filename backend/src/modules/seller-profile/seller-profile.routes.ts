import { Router } from "express";
import { requireAccountType } from "../../middleware/auth.middleware.js";
import { validate } from "../../middleware/validate.middleware.js";
import { asyncHandler } from "../../shared/asyncHandler.js";
import { sellerProfileController } from "./seller-profile.controller.js";
import { sellerProfileIdParamSchema, updateSellerProfileSchema } from "./seller-profile.schemas.js";

export const sellerProfileRouter = Router();

// Public safe lookup
sellerProfileRouter.get(
  "/public/:id",
  validate(sellerProfileIdParamSchema, "params"),
  asyncHandler(sellerProfileController.getPublicProfile),
);

// Authenticated seller endpoints
sellerProfileRouter.get(
  "/",
  ...requireAccountType("seller"),
  asyncHandler(sellerProfileController.getOwnProfile),
);

sellerProfileRouter.patch(
  "/",
  ...requireAccountType("seller"),
  validate(updateSellerProfileSchema),
  asyncHandler(sellerProfileController.updateOwnProfile),
);
